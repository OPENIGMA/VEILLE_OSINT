-- ============================================================================
-- 1/7 — Extensions, schéma privé, configuration de recherche française
-- ============================================================================

create schema if not exists extensions;

create extension if not exists pg_trgm       with schema extensions; -- similarité, autocomplétion
create extension if not exists unaccent      with schema extensions; -- recherche insensible aux accents
create extension if not exists cube          with schema extensions; -- requis par earthdistance
create extension if not exists earthdistance with schema extensions; -- recherche par rayon GPS
create extension if not exists pgcrypto      with schema extensions; -- bcrypt (hash + sel)

-- Schéma privé : fonctions internes, jamais exposées par l'API REST.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- unaccent() n'est pas IMMUTABLE : on l'enveloppe pour pouvoir l'utiliser dans
-- des index et des colonnes générées. Tout est qualifié (search_path vide) car
-- les opérations de maintenance (autovacuum, REINDEX) ignorent le search_path.
-- ----------------------------------------------------------------------------
create or replace function private.immutable_unaccent(p_text text)
returns text
language sql
immutable parallel safe strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text)
$$;

-- Configuration de recherche plein texte : français + suppression des accents.
-- "élections" et "elections" se trouvent mutuellement ; "attaques" ↔ "attaque".
create text search configuration public.fr_unaccent (copy = pg_catalog.french);
alter text search configuration public.fr_unaccent
  alter mapping for hword, hword_part, word
  with extensions.unaccent, pg_catalog.french_stem;

-- ----------------------------------------------------------------------------
-- Trigger générique : met à jour updated_at à chaque UPDATE
-- ----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Convertit un jsonb (tableau ou chaîne) en text[] ; tout le reste → tableau vide
-- ----------------------------------------------------------------------------
create or replace function private.text_array(p_json jsonb)
returns text[]
language sql
immutable parallel safe
set search_path = ''
as $$
  select case jsonb_typeof(p_json)
    when 'array'  then coalesce(array(select btrim(e) from jsonb_array_elements_text(p_json) e where btrim(e) <> ''), '{}'::text[])
    when 'string' then case when btrim(p_json #>> '{}') = '' then '{}'::text[] else array[btrim(p_json #>> '{}')] end
    else '{}'::text[]
  end
$$;

-- ----------------------------------------------------------------------------
-- Conversions tolérantes pour l'ingestion : une valeur mal formée donne NULL au
-- lieu de faire échouer tout un lot de 500 éléments.
-- ----------------------------------------------------------------------------
create or replace function private.safe_uuid(p_text text)
returns uuid language plpgsql immutable set search_path = ''
as $$ begin return p_text::uuid; exception when others then return null; end $$;

create or replace function private.safe_timestamptz(p_text text)
returns timestamptz language plpgsql stable set search_path = ''
as $$ begin return p_text::timestamptz; exception when others then return null; end $$;

create or replace function private.safe_double(p_text text)
returns double precision language plpgsql immutable set search_path = ''
as $$ begin return p_text::double precision; exception when others then return null; end $$;

create or replace function private.safe_bigint(p_text text)
returns bigint language plpgsql immutable set search_path = ''
as $$ begin return p_text::bigint; exception when others then return null; end $$;

-- ----------------------------------------------------------------------------
-- Normalise des entités (personnes, organisations, lieux) pour la recherche :
-- minuscules, sans accents, dédoublonnées, 50 maximum.
-- ----------------------------------------------------------------------------
create or replace function private.normalize_entities(p_entities text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(
    select distinct e
    from (
      select left(private.immutable_unaccent(lower(btrim(x))), 100) as e
      from unnest(p_entities) as x
    ) s
    where e <> ''
    order by e
    limit 50
  ), '{}'::text[])
$$;
