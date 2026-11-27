-- ============================================================================
-- 2/7 — Tables de référence : thèmes et territoires
-- ============================================================================

-- ----------------------------------------------------------------------------
-- themes : filtres thématiques (agriculture, cybercriminalité, ...)
-- `tone` = couleur néon du tag dans l'interface (cyan, magenta, lime, amber).
-- ----------------------------------------------------------------------------
create table public.themes (
  slug        text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label       text not null,
  group_name  text not null,
  tone        text not null default 'cyan' check (tone in ('cyan', 'magenta', 'lime', 'amber')),
  sort_order  smallint not null default 0
);

comment on table public.themes is 'Référentiel des thématiques de veille. Les articles et jeux de données les référencent par slug (text[]).';

-- ----------------------------------------------------------------------------
-- territories : hiérarchie nationale + outre-mer
--   zds (zone de défense) > reg (région) > dep (département) > com (commune)
--   epci : intercommunalité, rattachée aux communes via epci_id
--   colom : collectivités d'outre-mer (975, 977, 978, 986, 987, 988)
-- L'identifiant est « type-code » (ex. reg-76, dep-31, com-31555, epci-243100518).
-- Les codes seuls peuvent collisionner (région 11 = Île-de-France, département 11 = Aude).
-- ----------------------------------------------------------------------------
create table public.territories (
  id           text generated always as (type || '-' || code) stored primary key,
  type         text not null check (type in ('zds', 'reg', 'dep', 'epci', 'com', 'colom')),
  code         text not null check (code ~ '^[0-9A-Za-z-]{1,12}$'),
  name         text not null check (char_length(name) between 1 and 200),
  parent_id    text references public.territories (id) on delete set null,
  epci_id      text references public.territories (id) on delete set null,
  postal_codes text[] not null default '{}',
  lat          double precision check (lat between -90 and 90),
  lon          double precision check (lon between -180 and 180),
  population   integer check (population >= 0),
  is_overseas  boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (type, code)
);

comment on table public.territories is 'Territoires français (zones de défense, régions, départements, EPCI, communes, outre-mer).';

create index territories_parent_idx   on public.territories (parent_id);
create index territories_epci_idx     on public.territories (epci_id) where epci_id is not null;
create index territories_type_idx     on public.territories (type);
create index territories_postal_gin   on public.territories using gin (postal_codes);
-- Autocomplétion sur le nom, insensible à la casse et aux accents
create index territories_name_trgm    on public.territories
  using gin (private.immutable_unaccent(lower(name)) extensions.gin_trgm_ops);
