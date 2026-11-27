-- Logique du chargement des communes, avec une FAUSSE API (l'extension http et
-- Internet ne sont pas disponibles ici). Le format des réponses reproduit celui
-- de geo.api.gouv.fr ; le vrai appel est vérifié au premier lancement sur Supabase.
begin;
set local search_path = "$user", public, extensions;

-- Doublure de l'extension http : même type de retour, réponses préenregistrées
create type extensions.http_response as (status integer, content_type varchar, headers text[], content varchar);

create function extensions.http_set_curlopt(p_name text, p_value text) returns boolean
language sql as $$ select true $$;

create table test.http_calls (url text);

create function extensions.http_get(p_url text) returns extensions.http_response
language plpgsql as $$
begin
  insert into test.http_calls values (p_url);
  if p_url like 'https://geo.api.gouv.fr/epcis%' then
    return row(200, 'application/json', null, $j$[
      {"code":"243100518","nom":"Toulouse Métropole","codesRegions":["76"],"population":800000},
      {"code":"200054807","nom":"Métropole Aix-Marseille-Provence","codesRegions":["93"],"population":1900000},
      {"code":"200000172","nom":"CC Hors périmètre","codesRegions":["84"],"population":10000},
      {"code":"pas-un-siren","nom":"Invalide","codesRegions":["76"]}
    ]$j$)::extensions.http_response;
  elsif p_url like '%codeRegion=76%' then
    return row(200, 'application/json', null, $j$[
      {"code":"31555","nom":"Toulouse","codeDepartement":"31","codeRegion":"76","codeEpci":"243100518",
       "codesPostaux":["31000","31100"],"population":493465,"centre":{"type":"Point","coordinates":[1.4437,43.6047]}},
      {"code":"31001","nom":"Commune sans EPCI connu","codeDepartement":"31","codeRegion":"76","codeEpci":"999999999",
       "codesPostaux":["31001"],"centre":{"type":"Point","coordinates":[1.0,43.0]}}
    ]$j$)::extensions.http_response;
  elsif p_url like '%codeRegion=93%' then
    return row(200, 'application/json', null, $j$[
      {"code":"13055","nom":"Marseille","codeDepartement":"13","codeRegion":"93","codeEpci":"200054807",
       "codesPostaux":["13001","13002"],"population":873076,"centre":{"type":"Point","coordinates":[5.3698,43.2965]}}
    ]$j$)::extensions.http_response;
  elsif p_url like '%codeRegion=94%' then
    return row(200, 'application/json', null, $j$[
      {"code":"2A004","nom":"Ajaccio","codeDepartement":"2A","codeRegion":"94",
       "codesPostaux":["20000","20090"],"population":71000,"centre":{"type":"Point","coordinates":[8.7386,41.9192]}},
      {"code":"2B033","nom":"Bastia","codeDepartement":"2B","codeRegion":"94",
       "codesPostaux":["20200"],"population":48000,"centre":{"type":"Point","coordinates":[9.4500,42.7000]}}
    ]$j$)::extensions.http_response;
  elsif p_url like '%codeRegion=11%' then
    return row(500, 'text/plain', null, 'erreur serveur')::extensions.http_response;
  end if;
  return row(404, 'text/plain', null, 'introuvable')::extensions.http_response;
end;
$$;

\ir ../seed/communes_function.sql

-- ---------------------------------------------------------------- cas nominal
do $$
declare
  r jsonb := private.seed_territories_from_geo_api(array['76', '93', '94']);
begin
  perform test.assert((r ->> 'epcis')::int = 2, 'seulement les 2 EPCI des régions demandées, l''invalide et le hors-périmètre ignorés — obtenu ' || r::text);
  perform test.assert((r ->> 'communes_recues')::int = 5 and (r ->> 'communes_importees')::int = 5, '5 communes reçues, 5 importées');
  perform test.assert((r #>> '{par_region,76,importees}')::int = 2, 'détail par région');
end;
$$;

select test.assert((select count(*) from public.territories where type = 'epci') = 2, 'EPCI présents');
select test.assert((select epci_id from public.territories where id = 'com-31555') = 'epci-243100518', 'Toulouse rattachée à son EPCI');
select test.assert((select epci_id from public.territories where id = 'com-31001') is null, 'EPCI inconnu : commune importée sans rattachement');
select test.assert((select parent_id from public.territories where id = 'com-2A004') = 'dep-2A', 'Ajaccio rattachée à la Corse-du-Sud');
select test.assert((select not is_overseas from public.territories where id = 'com-13055'), 'commune métropolitaine non marquée outre-mer');
select test.assert(public.territory_lineage(array['com-2A004']) = array['com-2A004','dep-2A','reg-94','zds-sud'], 'lignée complète d''Ajaccio');
select test.assert(public.territory_lineage(array['com-13055']) = array['com-13055','dep-13','epci-200054807','reg-93','zds-sud'], 'lignée de Marseille avec son EPCI');

-- Les URL appelées sont bien celles de l'API officielle, et une seule fois par région
select test.assert((select count(*) from test.http_calls where url like 'https://geo.api.gouv.fr/epcis?%') = 1, 'une seule requête EPCI nationale');
select test.assert((select count(*) from test.http_calls where url like 'https://geo.api.gouv.fr/communes?codeRegion=%') = 3, 'une requête communes par région');
select test.assert((select bool_and(url like 'https://geo.api.gouv.fr/%') from test.http_calls), 'seul geo.api.gouv.fr est interrogé');

-- ---------------------------------------------------------------- idempotence
select private.seed_territories_from_geo_api(array['76', '93', '94']);
select test.assert((select count(*) from public.territories where type = 'com') = 5, 'rejouer le chargement ne duplique rien');

-- ---------------------------------------------------------------- erreurs
select test.expect_error($$select private.seed_territories_from_geo_api(array['11'])$$, 'erreur HTTP de l''API : remontée, pas d''import silencieux');
select test.expect_error($$select private.seed_territories_from_geo_api(array['99'])$$, 'région inconnue refusée');
select test.expect_error($$select private.seed_territories_from_geo_api(array['76/../../x'])$$, 'code région piégé refusé (pas d''injection dans l''URL)');
select test.expect_error($$select private.seed_territories_from_geo_api(array[]::text[])$$, 'liste vide refusée');
select test.expect_error($$select private.seed_territories_from_geo_api(null)$$, 'null refusé');

-- Droits : réservé au propriétaire (migrations / SQL editor)
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.expect_error($$select private.seed_territories_from_geo_api(array['76'])$$, 'utilisateur : chargement interdit');
select test.as_anon();
select test.expect_error($$select private.seed_territories_from_geo_api(array['76'])$$, 'anon : chargement interdit');
select test.as_owner();

rollback;
