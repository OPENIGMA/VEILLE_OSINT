-- ============================================================================
-- 3/7 — Tables principales : profils, sources, articles, jeux de données, menaces
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles : 1 ligne par compte (créée automatiquement à l'inscription)
-- Le mot de passe n'est JAMAIS stocké ici : il est haché (bcrypt + sel) par
-- Supabase Auth dans auth.users. Le rôle ne peut pas être modifié depuis l'API.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (display_name is null or char_length(display_name) between 1 and 60),
  role          text not null default 'user' check (role in ('user', 'admin')),
  comfort_mode  boolean not null default false,
  preferences   jsonb not null default '{}'::jsonb
                check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 4096),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Création automatique du profil à l'inscription
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60), ''));
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ----------------------------------------------------------------------------
-- sources_rss : catalogue des flux (CRUD réservé aux admins)
-- ----------------------------------------------------------------------------
create table public.sources_rss (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(name) between 2 and 120),
  feed_url                text not null unique check (feed_url ~* '^https?://' and char_length(feed_url) <= 2000),
  site_url                text check (site_url is null or (site_url ~* '^https?://' and char_length(site_url) <= 2000)),
  kind                    text not null default 'presse'
                          check (kind in ('presse', 'cyber', 'institutionnel', 'economie', 'geopolitique', 'officiel')),
  scope                   text not null default 'nationale'
                          check (scope in ('nationale', 'regionale', 'departementale', 'locale', 'specialisee')),
  territory_ids           text[] not null default '{}' check (cardinality(territory_ids) <= 30),
  themes                  text[] not null default '{}' check (cardinality(themes) <= 20),
  language                text not null default 'fr',
  fetch_interval_minutes  integer not null default 60 check (fetch_interval_minutes between 15 and 1440),
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger sources_rss_touch_updated_at
  before update on public.sources_rss
  for each row execute function private.touch_updated_at();

-- État technique de collecte, séparé de sources_rss pour ne pas l'exposer
-- publiquement (ETag, erreurs, calendrier de relève).
create table public.source_fetch_state (
  source_id           uuid primary key references public.sources_rss (id) on delete cascade,
  etag                text,
  last_modified       text,
  last_fetched_at     timestamptz,
  last_success_at     timestamptz,
  last_error          text check (last_error is null or char_length(last_error) <= 500),
  consecutive_errors  integer not null default 0,
  next_fetch_at       timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index source_fetch_state_next_idx on public.source_fetch_state (next_fetch_at);

create trigger source_fetch_state_touch_updated_at
  before update on public.source_fetch_state
  for each row execute function private.touch_updated_at();

-- Une ligne d'état est créée automatiquement pour chaque nouvelle source
create or replace function private.create_fetch_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.source_fetch_state (source_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function private.create_fetch_state() from public, anon, authenticated;

create trigger sources_rss_create_fetch_state
  after insert on public.sources_rss
  for each row execute function private.create_fetch_state();

-- ----------------------------------------------------------------------------
-- articles_rss : articles de presse et publications (métadonnées + extrait)
-- Pas de texte intégral : on reste sous les 500 Mo du plan gratuit.
-- url_hash (16 octets) sert au dédoublonnage, à la place d'un index sur l'URL.
-- ----------------------------------------------------------------------------
create table public.articles_rss (
  id            bigint generated always as identity primary key,
  source_id     uuid references public.sources_rss (id) on delete set null,
  url           text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  url_hash      uuid generated always as (md5(url)::uuid) stored,
  title         text not null check (char_length(title) between 1 and 500),
  excerpt       text check (excerpt is null or char_length(excerpt) <= 1000),
  author        text check (author is null or char_length(author) <= 200),
  published_at  timestamptz not null default now(),
  ingested_at   timestamptz not null default now(),
  language      text not null default 'fr',
  content_type  text not null default 'article'
                check (content_type in ('article', 'communique', 'tribune', 'video', 'podcast', 'alerte', 'publication_officielle')),
  themes        text[] not null default '{}' check (cardinality(themes) <= 20),
  territory_ids text[] not null default '{}' check (cardinality(territory_ids) <= 30),
  entities      text[] not null default '{}' check (cardinality(entities) <= 50),
  lat           double precision check (lat between -90 and 90),
  lon           double precision check (lon between -180 and 180),
  fts           tsvector generated always as (
                  setweight(to_tsvector('public.fr_unaccent'::regconfig, coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('public.fr_unaccent'::regconfig, coalesce(excerpt, '')), 'B')
                ) stored,
  constraint articles_rss_url_hash_key unique (url_hash),
  constraint articles_rss_coords_together check ((lat is null) = (lon is null))
);

create index articles_published_idx   on public.articles_rss (published_at desc);
create index articles_ingested_idx    on public.articles_rss (ingested_at);
create index articles_source_idx      on public.articles_rss (source_id, published_at desc);
create index articles_fts_gin         on public.articles_rss using gin (fts);
create index articles_themes_gin      on public.articles_rss using gin (themes);
create index articles_territory_gin   on public.articles_rss using gin (territory_ids);
create index articles_entities_gin    on public.articles_rss using gin (entities);
create index articles_geo_gist        on public.articles_rss
  using gist (extensions.ll_to_earth(lat, lon)) where lat is not null;

-- ----------------------------------------------------------------------------
-- datasets_datagouv : métadonnées des jeux de données de data.gouv.fr
-- (jamais le contenu des fichiers). La clé est l'identifiant data.gouv.fr :
-- la réindexation est un simple upsert.
-- ----------------------------------------------------------------------------
create table public.datasets_datagouv (
  id                 text primary key check (char_length(id) between 1 and 64),
  slug               text check (slug is null or char_length(slug) <= 300),
  title              text not null check (char_length(title) between 1 and 500),
  description_short  text check (description_short is null or char_length(description_short) <= 600),
  producer           text check (producer is null or char_length(producer) <= 300),
  tags               text[] not null default '{}' check (cardinality(tags) <= 30),
  license            text check (license is null or char_length(license) <= 100),
  formats            text[] not null default '{}' check (cardinality(formats) <= 20),
  frequency          text check (frequency is null or char_length(frequency) <= 50),
  url                text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  created_at_source  timestamptz,
  published_at       timestamptz,               -- dernière modification côté data.gouv.fr
  resources_count    integer not null default 0 check (resources_count >= 0),
  themes             text[] not null default '{}' check (cardinality(themes) <= 20),
  territory_ids      text[] not null default '{}' check (cardinality(territory_ids) <= 30),
  ingested_at        timestamptz not null default now(),
  fts                tsvector generated always as (
                       setweight(to_tsvector('public.fr_unaccent'::regconfig, coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('public.fr_unaccent'::regconfig, coalesce(description_short, '')), 'B') ||
                       setweight(to_tsvector('public.fr_unaccent'::regconfig, coalesce(producer, '')), 'C')
                     ) stored
);

create index datasets_published_idx   on public.datasets_datagouv (published_at desc nulls last);
create index datasets_ingested_idx    on public.datasets_datagouv (ingested_at);
create index datasets_fts_gin         on public.datasets_datagouv using gin (fts);
create index datasets_themes_gin      on public.datasets_datagouv using gin (themes);
create index datasets_territory_gin   on public.datasets_datagouv using gin (territory_ids);
create index datasets_formats_gin     on public.datasets_datagouv using gin (formats);
create index datasets_tags_gin        on public.datasets_datagouv using gin (tags);
create index datasets_producer_idx    on public.datasets_datagouv (lower(producer));

-- ----------------------------------------------------------------------------
-- threats : veille cyber et ingérences (CERT-FR, ANSSI, OSINT géopolitique)
-- severity : info < modere (ambre) < eleve < critique (magenta)
-- ----------------------------------------------------------------------------
create table public.threats (
  id             bigint generated always as identity primary key,
  kind           text not null
                 check (kind in ('cyberattaque', 'cybercriminalite', 'ingerence', 'desinformation', 'espionnage', 'vulnerabilite', 'autre')),
  severity       text not null default 'info' check (severity in ('info', 'modere', 'eleve', 'critique')),
  title          text not null check (char_length(title) between 1 and 500),
  summary        text check (summary is null or char_length(summary) <= 1000),
  url            text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  url_hash       uuid generated always as (md5(url)::uuid) stored,
  source_id      uuid references public.sources_rss (id) on delete set null,
  article_id     bigint references public.articles_rss (id) on delete set null,
  published_at   timestamptz not null default now(),
  ingested_at    timestamptz not null default now(),
  actors         text[] not null default '{}' check (cardinality(actors) <= 30),   -- groupes, États, acteurs
  sectors        text[] not null default '{}' check (cardinality(sectors) <= 20),  -- secteurs ciblés
  cve_ids        text[] not null default '{}' check (cardinality(cve_ids) <= 50),
  themes         text[] not null default '{}' check (cardinality(themes) <= 20),
  territory_ids  text[] not null default '{}' check (cardinality(territory_ids) <= 30),
  lat            double precision check (lat between -90 and 90),
  lon            double precision check (lon between -180 and 180),
  fts            tsvector generated always as (
                   setweight(to_tsvector('public.fr_unaccent'::regconfig, coalesce(title, '')), 'A') ||
                   setweight(to_tsvector('public.fr_unaccent'::regconfig, coalesce(summary, '')), 'B')
                 ) stored,
  constraint threats_url_hash_key unique (url_hash),
  constraint threats_coords_together check ((lat is null) = (lon is null))
);

create index threats_published_idx    on public.threats (published_at desc);
create index threats_severity_idx     on public.threats (severity, published_at desc);
create index threats_kind_idx         on public.threats (kind, published_at desc);
create index threats_ingested_idx     on public.threats (ingested_at);
create index threats_fts_gin          on public.threats using gin (fts);
create index threats_themes_gin       on public.threats using gin (themes);
create index threats_territory_gin    on public.threats using gin (territory_ids);
create index threats_actors_gin       on public.threats using gin (actors);
create index threats_article_idx      on public.threats (article_id) where article_id is not null;
create index threats_source_idx       on public.threats (source_id) where source_id is not null;
create index threats_geo_gist         on public.threats
  using gist (extensions.ll_to_earth(lat, lon)) where lat is not null;
