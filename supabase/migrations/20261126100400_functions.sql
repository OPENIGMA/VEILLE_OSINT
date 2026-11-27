-- ============================================================================
-- 5/7 — Fonctions RPC : recherche, territoires, ingestion, RGPD, hachage
-- Les droits d'exécution sont fixés dans la migration 6.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_admin() : utilisé par les politiques RLS. SECURITY DEFINER pour lire
-- profiles sans récursion de politiques.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
$$;

-- ----------------------------------------------------------------------------
-- territory_lineage(ids) : les identifiants fournis + tous leurs ancêtres
-- (département, région, zone de défense) + l'EPCI des communes.
-- Les identifiants inconnus sont conservés tels quels.
--   territory_lineage('{com-31555}') → {com-31555, dep-31, reg-76, zds-sud, epci-243100518}
-- ----------------------------------------------------------------------------
create or replace function public.territory_lineage(p_ids text[])
returns text[]
language sql
stable
set search_path = public
as $$
  with recursive anc as (
    select t.id, t.parent_id, t.epci_id
    from public.territories t
    where t.id = any (p_ids)
    union
    select p.id, p.parent_id, p.epci_id
    from public.territories p
    join anc a on p.id = a.parent_id
  )
  select coalesce(array_agg(distinct x order by x), '{}'::text[])
  from (
    select unnest(p_ids) as x
    union select id from anc
    union select epci_id from anc where epci_id is not null
  ) s
  where x is not null
$$;

-- ----------------------------------------------------------------------------
-- resolve_postal_code(cp) : identifiants des communes portant ce code postal
-- ----------------------------------------------------------------------------
create or replace function public.resolve_postal_code(p_code text)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(t.id order by t.id), '{}'::text[])
  from public.territories t
  where t.type = 'com' and t.postal_codes @> array[btrim(p_code)]
$$;

-- ----------------------------------------------------------------------------
-- search_territories(q) : autocomplétion (nom, code INSEE, code postal exact)
-- ----------------------------------------------------------------------------
create or replace function public.search_territories(
  p_q      text,
  p_types  text[]  default null,
  p_limit  integer default 10
)
returns table (
  id           text,
  type         text,
  code         text,
  name         text,
  parent_id    text,
  postal_codes text[],
  population   integer
)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select
      btrim(p_q) as raw,
      private.immutable_unaccent(lower(btrim(p_q))) as n,
      -- échappe les jokers LIKE saisis par l'utilisateur
      replace(replace(replace(private.immutable_unaccent(lower(btrim(p_q))), '\', '\\'), '%', '\%'), '_', '\_') as esc
  )
  select t.id, t.type, t.code, t.name, t.parent_id, t.postal_codes, t.population
  from public.territories t, q
  where char_length(q.raw) >= 2
    and (p_types is null or t.type = any (p_types))
    and (
         private.immutable_unaccent(lower(t.name)) like q.esc || '%'
      or private.immutable_unaccent(lower(t.name)) % q.n
      or t.code = upper(q.raw)
      or t.postal_codes @> array[q.raw]
    )
  order by
    (private.immutable_unaccent(lower(t.name)) = q.n) desc,
    (private.immutable_unaccent(lower(t.name)) like q.esc || '%') desc,
    similarity(private.immutable_unaccent(lower(t.name)), q.n) desc,
    t.population desc nulls last,
    t.id
  limit least(greatest(coalesce(p_limit, 10), 1), 25)
$$;

-- ----------------------------------------------------------------------------
-- parse_search_query(texte) : syntaxe de recherche avancée → tsquery
--   mots séparés par des espaces ou ET   → tous les mots (AND)
--   OU                                   → l'un ou l'autre (priorité inférieure à ET)
--   SAUF / SANS (ou -mot)                → exclusion
--   "expression exacte"                  → mots adjacents, dans l'ordre
-- Les opérateurs s'écrivent EN MAJUSCULES (« ou », « et », « sans » minuscules
-- restent de simples mots). Pas de parenthèses. Ne lève jamais d'erreur de syntaxe.
-- ----------------------------------------------------------------------------
create or replace function private.parse_search_query(p_q text)
returns tsquery
language plpgsql
stable strict
set search_path = public, extensions
as $$
declare
  v_tok    text;
  v_out    text := '';
  v_negate boolean := false;
begin
  for v_tok in
    select m[1] from regexp_matches(left(p_q, 500), '("[^"]*"?|\S+)', 'g') as m
  loop
    if v_tok in ('"', '""') then
      continue;
    end if;
    -- guillemet non fermé : on le ferme
    if left(v_tok, 1) = '"' and right(v_tok, 1) <> '"' then
      v_tok := v_tok || '"';
    end if;

    if v_tok in ('ET', 'AND') then
      continue;
    elsif v_tok in ('OU', 'OR') then
      v_out := v_out || ' or ';
      v_negate := false;
      continue;
    elsif v_tok in ('SAUF', 'SANS', 'NOT') then
      v_negate := true;
      continue;
    end if;

    v_out := v_out || ' ' || case when v_negate then '-' else '' end || v_tok;
    v_negate := false;
  end loop;

  return websearch_to_tsquery('public.fr_unaccent'::regconfig, v_out);
end;
$$;

-- ----------------------------------------------------------------------------
-- search_content(params) : moteur de recherche unifié (articles, jeux de
-- données, menaces). Les paramètres sont un objet JSON — le même format que la
-- colonne searches.filters, donc une recherche sauvegardée s'exécute telle quelle.
--
--   q                 texte, syntaxe avancée (voir parse_search_query)
--   kinds             ["article","dataset","threat"]  (défaut : les trois)
--   territories       ["zds-sud","reg-76","dep-31","epci-…","com-31555"]
--   postal_code       "31000" (s'ajoute à territories : union)
--   lat, lon, radius_km   rayon GPS (articles et menaces géolocalisés)
--   themes            ["cybercriminalite", …]
--   entities          ["apt28", …]  (articles : entités ; menaces : acteurs)
--   sources           [uuid, …]  (articles et menaces)
--   content_types     ["article","communique", …]  (articles)
--   licence, producer, formats     (jeux de données)
--   severities, threat_kinds       (menaces)
--   date_from, date_to             sur la date de publication
--   ingested_after                 sur la date d'ajout (curseur des alertes)
--   sort              "relevance" (défaut si q) | "date"
--   limit (1-50, défaut 20), offset
--
-- Un filtre propre à un type (licence, rayon GPS, sévérité…) exclut
-- automatiquement les types qui ne le portent pas.
-- Pagination : demander limit+1 résultats pour savoir s'il y a une page suivante.
-- SECURITY INVOKER : la RLS de l'appelant s'applique.
-- ----------------------------------------------------------------------------
create or replace function public.search_content(p_params jsonb default '{}'::jsonb)
returns table (
  kind          text,
  id            text,
  title         text,
  snippet       text,
  url           text,
  source_name   text,
  published_at  timestamptz,
  themes        text[],
  territory_ids text[],
  lat           double precision,
  lon           double precision,
  rank          real
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_q          text        := nullif(btrim(left(p_params ->> 'q', 500)), '');
  v_tsq        tsquery;
  v_has_text   boolean;
  v_kinds      text[]      := private.text_array(p_params -> 'kinds');
  v_terr       text[]      := private.text_array(p_params -> 'territories');
  v_postal     text        := nullif(btrim(p_params ->> 'postal_code'), '');
  v_themes     text[]      := private.text_array(p_params -> 'themes');
  v_entities   text[]      := private.normalize_entities(private.text_array(p_params -> 'entities'));
  v_sources    uuid[]      := array(select s::uuid from unnest(private.text_array(p_params -> 'sources')) s);
  v_ctypes     text[]      := private.text_array(p_params -> 'content_types');
  v_formats    text[]      := array(select lower(f) from unnest(private.text_array(p_params -> 'formats')) f);
  v_licence    text        := nullif(btrim(p_params ->> 'licence'), '');
  v_producer   text        := nullif(btrim(p_params ->> 'producer'), '');
  v_severities text[]      := private.text_array(p_params -> 'severities');
  v_tkinds     text[]      := private.text_array(p_params -> 'threat_kinds');
  v_from       timestamptz := nullif(p_params ->> 'date_from', '')::timestamptz;
  v_to         timestamptz := nullif(p_params ->> 'date_to', '')::timestamptz;
  v_ingested   timestamptz := nullif(p_params ->> 'ingested_after', '')::timestamptz;
  v_lat        double precision := nullif(p_params ->> 'lat', '')::double precision;
  v_lon        double precision := nullif(p_params ->> 'lon', '')::double precision;
  v_radius_m   double precision := nullif(p_params ->> 'radius_km', '')::double precision * 1000;
  v_sort       text        := coalesce(p_params ->> 'sort', 'relevance');
  v_limit      integer     := least(greatest(coalesce(nullif(p_params ->> 'limit', '')::integer, 20), 1), 50);
  v_offset     integer     := least(greatest(coalesce(nullif(p_params ->> 'offset', '')::integer, 0), 0), 10000);

  v_common     text := '';
  v_geo        text := '';
  v_rank       text;
  v_order      text;
  v_outer      text;
  v_branches   text[] := '{}';
  v_sql        text;
begin
  -- null SQL et null JSON sont acceptés (= aucun filtre) ; tout autre non-objet est refusé
  if p_params is not null and jsonb_typeof(p_params) not in ('object', 'null') then
    raise exception 'p_params doit être un objet JSON' using errcode = '22023';
  end if;

  -- Texte
  v_tsq      := private.parse_search_query(v_q);
  v_has_text := v_tsq is not null and numnode(v_tsq) > 0;

  -- Rayon GPS : lat, lon et radius_km vont ensemble
  if (v_lat is null) <> (v_lon is null) or (v_lat is null) <> (v_radius_m is null) then
    raise exception 'lat, lon et radius_km doivent être fournis ensemble' using errcode = '22023';
  end if;
  if v_lat is not null then
    if v_lat not between -90 and 90 or v_lon not between -180 and 180 or v_radius_m <= 0 then
      raise exception 'coordonnées ou rayon invalides' using errcode = '22023';
    end if;
    v_radius_m := least(v_radius_m, 1000000);
  end if;

  -- Code postal → communes (union avec les territoires demandés)
  if v_postal is not null then
    v_terr := v_terr || public.resolve_postal_code(v_postal);
    if cardinality(v_terr) = 0 then
      return;   -- code postal inconnu
    end if;
  end if;

  -- Types à interroger
  if cardinality(v_kinds) = 0 then
    v_kinds := array['article', 'dataset', 'threat'];
  else
    v_kinds := array(select k from unnest(v_kinds) k where k in ('article', 'dataset', 'threat'));
  end if;
  if v_licence is not null or v_producer is not null or cardinality(v_formats) > 0 then
    v_kinds := array_remove(array_remove(v_kinds, 'article'), 'threat');
  end if;
  if v_lat is not null or cardinality(v_sources) > 0 or cardinality(v_entities) > 0 then
    v_kinds := array_remove(v_kinds, 'dataset');
  end if;
  if cardinality(v_ctypes) > 0 then
    v_kinds := array_remove(array_remove(v_kinds, 'dataset'), 'threat');
  end if;
  if cardinality(v_severities) > 0 or cardinality(v_tkinds) > 0 then
    v_kinds := array_remove(array_remove(v_kinds, 'article'), 'dataset');
  end if;
  if cardinality(v_kinds) = 0 then
    return;
  end if;

  -- Conditions communes aux trois tables (paramètres $n : jamais de concaténation de valeurs)
  if v_has_text                 then v_common := v_common || ' and x.fts @@ $1';              end if;
  if cardinality(v_terr) > 0    then v_common := v_common || ' and x.territory_ids && $2';    end if;
  if cardinality(v_themes) > 0  then v_common := v_common || ' and x.themes && $3';           end if;
  if v_from is not null         then v_common := v_common || ' and x.published_at >= $4';     end if;
  if v_to is not null           then v_common := v_common || ' and x.published_at < $5';      end if;
  if v_ingested is not null     then v_common := v_common || ' and x.ingested_at > $6';       end if;

  if v_lat is not null then
    v_geo := ' and extensions.earth_box(extensions.ll_to_earth($7, $8), $9) @> extensions.ll_to_earth(x.lat, x.lon)'
          || ' and extensions.earth_distance(extensions.ll_to_earth($7, $8), extensions.ll_to_earth(x.lat, x.lon)) <= $9';
  end if;

  v_rank  := case when v_has_text then 'ts_rank_cd(x.fts, $1, 32)' else '0' end;
  v_order := case when v_has_text and v_sort <> 'date'
                  then 'rank desc, x.published_at desc nulls last, x.id'
                  else 'x.published_at desc nulls last, x.id' end;
  v_outer := case when v_has_text and v_sort <> 'date'
                  then 'u.rank desc, u.published_at desc nulls last, u.kind, u.id'
                  else 'u.published_at desc nulls last, u.kind, u.id' end;

  if 'article' = any (v_kinds) then
    v_branches := v_branches || format(
      $f$(select 'article'::text as kind, x.id::text as id, x.title::text as title,
                 left(x.excerpt, 300)::text as snippet, x.url::text as url, s.name::text as source_name,
                 x.published_at, x.themes, x.territory_ids, x.lat, x.lon, (%s)::real as rank
          from public.articles_rss x
          left join public.sources_rss s on s.id = x.source_id
          where true %s %s %s %s %s
          order by %s limit $16)$f$,
      v_rank, v_common, v_geo,
      case when cardinality(v_entities) > 0 then ' and x.entities && $10' else '' end,
      case when cardinality(v_sources) > 0  then ' and x.source_id = any ($11)' else '' end,
      case when cardinality(v_ctypes) > 0   then ' and x.content_type = any ($12)' else '' end,
      v_order);
  end if;

  if 'dataset' = any (v_kinds) then
    v_branches := v_branches || format(
      $f$(select 'dataset'::text as kind, x.id::text as id, x.title::text as title,
                 left(x.description_short, 300)::text as snippet, x.url::text as url, x.producer::text as source_name,
                 x.published_at, x.themes, x.territory_ids,
                 null::double precision as lat, null::double precision as lon, (%s)::real as rank
          from public.datasets_datagouv x
          where true %s %s %s %s
          order by %s limit $16)$f$,
      v_rank, v_common,
      case when v_licence is not null          then ' and x.license = $13' else '' end,
      case when v_producer is not null         then ' and lower(x.producer) = lower($14)' else '' end,
      case when cardinality(v_formats) > 0     then ' and x.formats && $15' else '' end,
      v_order);
  end if;

  if 'threat' = any (v_kinds) then
    v_branches := v_branches || format(
      $f$(select 'threat'::text as kind, x.id::text as id, x.title::text as title,
                 left(x.summary, 300)::text as snippet, x.url::text as url, s.name::text as source_name,
                 x.published_at, x.themes, x.territory_ids, x.lat, x.lon, (%s)::real as rank
          from public.threats x
          left join public.sources_rss s on s.id = x.source_id
          where true %s %s %s %s %s %s
          order by %s limit $16)$f$,
      v_rank, v_common, v_geo,
      case when cardinality(v_entities) > 0   then ' and x.actors && $10' else '' end,
      case when cardinality(v_sources) > 0    then ' and x.source_id = any ($11)' else '' end,
      case when cardinality(v_severities) > 0 then ' and x.severity = any ($19)' else '' end,
      case when cardinality(v_tkinds) > 0     then ' and x.kind = any ($20)' else '' end,
      v_order);
  end if;

  v_sql := 'select * from (' || array_to_string(v_branches, ' union all ') || ') u'
        || ' order by ' || v_outer || ' offset $17 limit $18';

  return query execute v_sql
    using v_tsq, v_terr, v_themes, v_from, v_to, v_ingested, v_lat, v_lon, v_radius_m,
          v_entities, v_sources, v_ctypes, v_licence, v_producer, v_formats,
          v_offset + v_limit, v_offset, v_limit, v_severities, v_tkinds;
end;
$$;

-- ----------------------------------------------------------------------------
-- INGESTION (réservée à service_role : Worker Cloudflare)
-- Un seul appel par lot (500 éléments max) : compatible avec la limite de
-- 50 sous-requêtes par exécution du plan gratuit Cloudflare.
-- SECURITY INVOKER : service_role contourne la RLS, personne d'autre n'a accès.
-- Les thèmes inconnus sont ignorés ; les territoires sont étendus à leurs
-- ancêtres (commune → département → région → zone).
-- ----------------------------------------------------------------------------
create or replace function public.ingest_articles(p_items jsonb)
returns integer
language plpgsql
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items doit être un tableau JSON' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'Trop d''éléments (500 maximum par appel)' using errcode = '22023';
  end if;

  with src as (
    select
      (select ss.id from public.sources_rss ss where ss.id = private.safe_uuid(i ->> 'source_id')) as source_id,
      btrim(i ->> 'url')                                              as url,
      left(btrim(i ->> 'title'), 500)                                 as title,
      left(nullif(btrim(i ->> 'excerpt'), ''), 1000)                  as excerpt,
      left(nullif(btrim(i ->> 'author'), ''), 200)                    as author,
      least(coalesce(private.safe_timestamptz(i ->> 'published_at'), now()), now()) as published_at,
      coalesce(nullif(left(i ->> 'language', 8), ''), 'fr')           as language,
      case when i ->> 'content_type' in ('article', 'communique', 'tribune', 'video', 'podcast', 'alerte', 'publication_officielle')
           then i ->> 'content_type' else 'article' end               as content_type,
      private.text_array(i -> 'themes')                               as themes,
      (private.text_array(i -> 'territory_ids'))[1:10]                as territory_ids,
      private.text_array(i -> 'entities')                             as entities,
      private.safe_double(i ->> 'lat')                                as lat,
      private.safe_double(i ->> 'lon')                                as lon
    from jsonb_array_elements(p_items) as i
  ), ins as (
    insert into public.articles_rss
      (source_id, url, title, excerpt, author, published_at, language, content_type,
       themes, territory_ids, entities, lat, lon)
    select
      s.source_id, s.url, s.title, s.excerpt, s.author, s.published_at, s.language, s.content_type,
      coalesce((select array_agg(t.slug order by t.slug)
                from (select th.slug from public.themes th where th.slug = any (s.themes) order by th.slug limit 20) t), '{}'),
      (public.territory_lineage(s.territory_ids))[1:30],
      private.normalize_entities(s.entities),
      case when s.lat between -90 and 90 and s.lon between -180 and 180 then s.lat end,
      case when s.lat between -90 and 90 and s.lon between -180 and 180 then s.lon end
    from src s
    where s.url ~* '^https?://' and char_length(s.url) <= 2000 and coalesce(s.title, '') <> ''
    on conflict (url_hash) do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  return v_count;
end;
$$;

create or replace function public.ingest_threats(p_items jsonb)
returns integer
language plpgsql
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items doit être un tableau JSON' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'Trop d''éléments (500 maximum par appel)' using errcode = '22023';
  end if;

  with src as (
    select
      case when i ->> 'kind' in ('cyberattaque', 'cybercriminalite', 'ingerence', 'desinformation', 'espionnage', 'vulnerabilite')
           then i ->> 'kind' else 'autre' end                         as kind,
      case when i ->> 'severity' in ('info', 'modere', 'eleve', 'critique')
           then i ->> 'severity' else 'info' end                      as severity,
      left(btrim(i ->> 'title'), 500)                                 as title,
      left(nullif(btrim(i ->> 'summary'), ''), 1000)                  as summary,
      btrim(i ->> 'url')                                              as url,
      (select ss.id from public.sources_rss ss where ss.id = private.safe_uuid(i ->> 'source_id')) as source_id,
      (select a.id from public.articles_rss a where a.id = private.safe_bigint(i ->> 'article_id')) as article_id,
      least(coalesce(private.safe_timestamptz(i ->> 'published_at'), now()), now()) as published_at,
      private.text_array(i -> 'actors')                               as actors,
      private.text_array(i -> 'sectors')                              as sectors,
      private.text_array(i -> 'cve_ids')                              as cve_ids,
      private.text_array(i -> 'themes')                               as themes,
      (private.text_array(i -> 'territory_ids'))[1:10]                as territory_ids,
      private.safe_double(i ->> 'lat')                                as lat,
      private.safe_double(i ->> 'lon')                                as lon
    from jsonb_array_elements(p_items) as i
  ), ins as (
    insert into public.threats
      (kind, severity, title, summary, url, source_id, article_id, published_at,
       actors, sectors, cve_ids, themes, territory_ids, lat, lon)
    select
      s.kind, s.severity, s.title, s.summary, s.url, s.source_id, s.article_id, s.published_at,
      private.normalize_entities(s.actors),
      (s.sectors)[1:20],
      (select coalesce(array_agg(distinct upper(c)), '{}') from unnest((s.cve_ids)[1:50]) c),
      coalesce((select array_agg(t.slug order by t.slug)
                from (select th.slug from public.themes th where th.slug = any (s.themes) order by th.slug limit 20) t), '{}'),
      (public.territory_lineage(s.territory_ids))[1:30],
      case when s.lat between -90 and 90 and s.lon between -180 and 180 then s.lat end,
      case when s.lat between -90 and 90 and s.lon between -180 and 180 then s.lon end
    from src s
    where s.url ~* '^https?://' and char_length(s.url) <= 2000 and coalesce(s.title, '') <> ''
    on conflict (url_hash) do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  return v_count;
end;
$$;

-- Jeux de données : upsert par identifiant data.gouv.fr (insère ou met à jour)
create or replace function public.ingest_datasets(p_items jsonb)
returns integer
language plpgsql
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items doit être un tableau JSON' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'Trop d''éléments (500 maximum par appel)' using errcode = '22023';
  end if;

  with src as (
    select
      left(btrim(i ->> 'id'), 64)                                     as id,
      left(nullif(btrim(i ->> 'slug'), ''), 300)                      as slug,
      left(btrim(i ->> 'title'), 500)                                 as title,
      left(nullif(btrim(i ->> 'description'), ''), 600)               as description_short,
      left(nullif(btrim(i ->> 'producer'), ''), 300)                  as producer,
      (private.text_array(i -> 'tags'))[1:30]                         as tags,
      left(nullif(btrim(i ->> 'license'), ''), 100)                   as license,
      (array(select lower(f) from unnest(private.text_array(i -> 'formats')) f))[1:20] as formats,
      left(nullif(btrim(i ->> 'frequency'), ''), 50)                  as frequency,
      btrim(i ->> 'url')                                              as url,
      private.safe_timestamptz(i ->> 'created_at_source')             as created_at_source,
      private.safe_timestamptz(i ->> 'published_at')                  as published_at,
      least(greatest(coalesce(private.safe_bigint(i ->> 'resources_count'), 0), 0), 100000)::integer as resources_count,
      private.text_array(i -> 'themes')                               as themes,
      (private.text_array(i -> 'territory_ids'))[1:10]                as territory_ids
    from jsonb_array_elements(p_items) as i
  ), up as (
    insert into public.datasets_datagouv
      (id, slug, title, description_short, producer, tags, license, formats, frequency, url,
       created_at_source, published_at, resources_count, themes, territory_ids, ingested_at)
    select distinct on (s.id)
      s.id, s.slug, s.title, s.description_short, s.producer, s.tags, s.license, s.formats, s.frequency, s.url,
      s.created_at_source, s.published_at, s.resources_count,
      coalesce((select array_agg(t.slug order by t.slug)
                from (select th.slug from public.themes th where th.slug = any (s.themes) order by th.slug limit 20) t), '{}'),
      (public.territory_lineage(s.territory_ids))[1:30],
      now()
    from src s
    where coalesce(s.id, '') <> '' and coalesce(s.title, '') <> ''
      and s.url ~* '^https?://' and char_length(s.url) <= 2000
    order by s.id, s.published_at desc nulls last
    on conflict (id) do update set
      slug = excluded.slug, title = excluded.title, description_short = excluded.description_short,
      producer = excluded.producer, tags = excluded.tags, license = excluded.license,
      formats = excluded.formats, frequency = excluded.frequency, url = excluded.url,
      created_at_source = excluded.created_at_source, published_at = excluded.published_at,
      resources_count = excluded.resources_count, themes = excluded.themes,
      territory_ids = excluded.territory_ids, ingested_at = now()
    returning 1
  )
  select count(*) into v_count from up;

  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- purge_old_content() : rétention pour rester sous 500 Mo (appel hebdomadaire).
-- Les articles et menaces mis en favori ne sont jamais purgés.
-- Traite au plus p_batch lignes par table : à rappeler tant que le résultat
-- n'est pas à zéro.
-- ----------------------------------------------------------------------------
create or replace function public.purge_old_content(
  p_articles_months integer default 12,
  p_threats_months  integer default 24,
  p_batch           integer default 5000
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_articles integer;
  v_threats  integer;
  v_history  integer;
begin
  if p_articles_months < 1 or p_threats_months < 1 or p_batch < 1 then
    raise exception 'paramètres invalides' using errcode = '22023';
  end if;

  with doomed as (
    select a.id from public.articles_rss a
    where a.published_at < now() - make_interval(months => p_articles_months)
      and not exists (select 1 from public.favorites f where f.target_type = 'article' and f.target_id = a.id::text)
    order by a.published_at
    limit p_batch
  ), del as (
    delete from public.articles_rss a using doomed d where a.id = d.id returning 1
  )
  select count(*) into v_articles from del;

  with doomed as (
    select t.id from public.threats t
    where t.published_at < now() - make_interval(months => p_threats_months)
      and not exists (select 1 from public.favorites f where f.target_type = 'threat' and f.target_id = t.id::text)
    order by t.published_at
    limit p_batch
  ), del as (
    delete from public.threats t using doomed d where t.id = d.id returning 1
  )
  select count(*) into v_threats from del;

  with del as (
    delete from public.searches s
    where not s.is_saved and s.created_at < now() - interval '90 days'
    returning 1
  )
  select count(*) into v_history from del;

  return jsonb_build_object('articles', v_articles, 'threats', v_threats, 'search_history', v_history);
end;
$$;

-- ----------------------------------------------------------------------------
-- RGPD : export (portabilité) et suppression (droit à l'oubli) du compte
-- ----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'account',   (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at)
                  from auth.users u where u.id = v_uid),
    'profile',   (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'searches',  coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from public.searches s where s.user_id = v_uid), '[]'::jsonb),
    'alerts',    coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.alerts a where a.user_id = v_uid), '[]'::jsonb),
    'favorites', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.favorites f where f.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

-- Supprime le compte ET toutes ses données (cascade). Irréversible :
-- la confirmation explicite évite un appel accidentel.
create or replace function public.delete_my_account(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if p_confirm is distinct from 'SUPPRIMER' then
    raise exception 'Confirmation manquante : passer la valeur SUPPRIMER' using errcode = '22023';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- ----------------------------------------------------------------------------
-- Hachage HASH + SEL (bcrypt, coût 12) pour les secrets applicatifs.
-- Les mots de passe des comptes sont déjà hachés ainsi par Supabase Auth dans
-- auth.users ; ces fonctions servent aux autres secrets (jetons, clés d'API…).
-- Limite bcrypt : seuls les 72 premiers octets du secret comptent.
-- ----------------------------------------------------------------------------
create or replace function public.hash_secret(p_secret text)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select crypt(p_secret, gen_salt('bf', 12))
$$;

create or replace function public.verify_secret(p_secret text, p_hash text)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select p_hash = crypt(p_secret, p_hash)
$$;

-- ----------------------------------------------------------------------------
-- Import des territoires depuis geo.api.gouv.fr (voir supabase/seed/).
-- Format des éléments : celui de l'API (nom, code, codesPostaux, centre, ...).
-- ----------------------------------------------------------------------------
create or replace function private.import_epcis(p_items jsonb, p_region_codes text[] default null)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  with src as (
    select i ->> 'code' as code,
           left(i ->> 'nom', 200) as name,
           nullif(i ->> 'population', '')::integer as population,
           private.text_array(i -> 'codesRegions') as regions
    from jsonb_array_elements(p_items) i
  ), ins as (
    insert into public.territories (type, code, name, population)
    select 'epci', s.code, s.name, s.population
    from src s
    where s.code ~ '^[0-9]{9}$' and coalesce(s.name, '') <> ''
      and (p_region_codes is null or s.regions && p_region_codes)
    on conflict (type, code) do update set name = excluded.name, population = excluded.population
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

create or replace function private.import_communes(p_items jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  with src as (
    select i ->> 'code' as code,
           left(i ->> 'nom', 200) as name,
           i ->> 'codeDepartement' as dep,
           i ->> 'codeEpci' as epci,
           private.text_array(i -> 'codesPostaux') as cps,
           nullif(i #>> '{centre,coordinates,1}', '')::double precision as lat,
           nullif(i #>> '{centre,coordinates,0}', '')::double precision as lon,
           nullif(i ->> 'population', '')::integer as population
    from jsonb_array_elements(p_items) i
  ), ins as (
    insert into public.territories (type, code, name, parent_id, epci_id, postal_codes, lat, lon, population, is_overseas)
    select 'com', s.code, s.name, 'dep-' || s.dep,
           (select e.id from public.territories e where e.type = 'epci' and e.code = s.epci),
           s.cps, s.lat, s.lon, s.population, s.dep like '97%'
    from src s
    where s.code ~ '^([0-9]{5}|2[AB][0-9]{3})$' and coalesce(s.name, '') <> ''
      and exists (select 1 from public.territories d where d.id = 'dep-' || s.dep)
    on conflict (type, code) do update set
      name = excluded.name, parent_id = excluded.parent_id, epci_id = excluded.epci_id,
      postal_codes = excluded.postal_codes, lat = excluded.lat, lon = excluded.lon,
      population = excluded.population
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;
