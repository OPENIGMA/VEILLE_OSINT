-- ============================================================================
-- Chargement des EPCI et des communes depuis l'API officielle geo.api.gouv.fr
-- (Etalab). Les données viennent directement de la base Supabase, qui a accès à
-- Internet : rien n'est saisi à la main.
--
-- Ce fichier ne définit que la fonction. Le lancement est dans
-- supabase/seed/run_communes.sql (qui installe puis retire l'extension http).
-- ============================================================================

create or replace function private.seed_territories_from_geo_api(p_region_codes text[])
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_region     text;
  v_resp       extensions.http_response;
  v_items      jsonb;
  v_epcis      integer;
  v_communes   integer := 0;
  v_fetched    integer := 0;
  v_per_region jsonb := '{}'::jsonb;
  v_n          integer;
begin
  if p_region_codes is null or cardinality(p_region_codes) = 0 then
    raise exception 'Indiquer au moins un code région' using errcode = '22023';
  end if;

  -- Les codes sont insérés dans une URL : on n'accepte que des régions connues
  foreach v_region in array p_region_codes loop
    if not exists (select 1 from public.territories where id = 'reg-' || v_region) then
      raise exception 'Région inconnue : %', v_region using errcode = '22023';
    end if;
  end loop;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '90');

  -- EPCI : une requête nationale, filtrée sur les régions demandées. Ils doivent
  -- exister avant les communes, qui s'y rattachent.
  v_resp := extensions.http_get('https://geo.api.gouv.fr/epcis?fields=nom,code,codesRegions,population');
  if v_resp.status <> 200 then
    raise exception 'geo.api.gouv.fr/epcis : HTTP %', v_resp.status;
  end if;
  v_epcis := private.import_epcis(v_resp.content::jsonb, p_region_codes);

  -- Communes : une requête par région
  foreach v_region in array p_region_codes loop
    v_resp := extensions.http_get(format(
      'https://geo.api.gouv.fr/communes?codeRegion=%s&fields=nom,code,codesPostaux,codeDepartement,codeRegion,codeEpci,population,centre&format=json',
      v_region));
    if v_resp.status <> 200 then
      raise exception 'geo.api.gouv.fr/communes (région %) : HTTP %', v_region, v_resp.status;
    end if;
    v_items := v_resp.content::jsonb;
    v_n := private.import_communes(v_items);
    v_fetched  := v_fetched + jsonb_array_length(v_items);
    v_communes := v_communes + v_n;
    v_per_region := v_per_region || jsonb_build_object(
      v_region, jsonb_build_object('recues', jsonb_array_length(v_items), 'importees', v_n));
  end loop;

  -- « recues » ≠ « importees » signale des communes rejetées (code ou département inconnu)
  return jsonb_build_object(
    'epcis', v_epcis, 'communes_recues', v_fetched, 'communes_importees', v_communes, 'par_region', v_per_region);
end;
$$;

revoke execute on function private.seed_territories_from_geo_api(text[]) from public, anon, authenticated;
