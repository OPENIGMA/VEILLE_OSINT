-- ============================================================================
-- 4/7 — Données personnelles : recherches, alertes, favoris (+ quotas)
-- Chaque ligne appartient à un utilisateur ; l'isolation est assurée par la RLS
-- (voir migration 6). Les quotas protègent le plan gratuit contre les abus.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- searches : recherches sauvegardées (is_saved) et historique (!is_saved)
-- `filters` a la forme acceptée par search_content() ; `query` est le texte saisi.
-- ----------------------------------------------------------------------------
create table public.searches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text check (name is null or char_length(name) between 1 and 120),
  query        text not null default '' check (char_length(query) <= 500),
  filters      jsonb not null default '{}'::jsonb
               check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 8192),
  is_saved     boolean not null default false,
  last_run_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint searches_saved_has_name check (not is_saved or name is not null)
);

create index searches_user_idx on public.searches (user_id, is_saved, created_at desc);

create trigger searches_touch_updated_at
  before update on public.searches
  for each row execute function private.touch_updated_at();

-- ----------------------------------------------------------------------------
-- alerts : alerte email attachée à une recherche sauvegardée
-- L'adresse email n'est PAS copiée ici : l'Edge Function la lit dans auth.users.
-- last_checked_at / last_sent_at servent de curseur (on n'envoie que le nouveau).
-- ----------------------------------------------------------------------------
create table public.alerts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  search_id        uuid not null references public.searches (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  frequency        text not null default 'quotidienne' check (frequency in ('immediate', 'quotidienne', 'hebdomadaire')),
  is_active        boolean not null default true,
  last_checked_at  timestamptz,
  last_sent_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index alerts_user_idx   on public.alerts (user_id);
create index alerts_search_idx on public.alerts (search_id);
create index alerts_due_idx    on public.alerts (frequency, last_checked_at) where is_active;

create trigger alerts_touch_updated_at
  before update on public.alerts
  for each row execute function private.touch_updated_at();

-- ----------------------------------------------------------------------------
-- favorites : éléments favoris (référence polymorphe, sans clé étrangère :
-- un élément purgé disparaît simplement des résultats ; les articles favoris
-- ne sont jamais purgés, voir purge_old_content()).
-- ----------------------------------------------------------------------------
create table public.favorites (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type  text not null check (target_type in ('article', 'dataset', 'threat', 'territory')),
  target_id    text not null check (char_length(target_id) between 1 and 64),
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  constraint favorites_unique_target unique (user_id, target_type, target_id)
);

create index favorites_target_idx on public.favorites (target_type, target_id);

-- ----------------------------------------------------------------------------
-- Quotas par utilisateur (limite souple, vérifiée à l'insertion)
-- ----------------------------------------------------------------------------
create or replace function private.enforce_user_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer := tg_argv[0]::integer;
  v_count bigint;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into v_count using new.user_id;
  if v_count >= v_limit then
    raise exception 'Quota atteint : % éléments maximum (%)', v_limit, tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger alerts_quota
  before insert on public.alerts
  for each row execute function private.enforce_user_quota(20);

create trigger favorites_quota
  before insert on public.favorites
  for each row execute function private.enforce_user_quota(1000);

-- Recherches : 50 sauvegardées maximum ; l'historique garde les 100 dernières.
create or replace function private.searches_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_saved bigint;
begin
  if new.is_saved and (tg_op = 'INSERT' or not old.is_saved) then
    select count(*) into v_saved from public.searches where user_id = new.user_id and is_saved;
    if v_saved >= 50 then
      raise exception 'Quota atteint : 50 recherches sauvegardées maximum'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger searches_quota
  before insert or update of is_saved on public.searches
  for each row execute function private.searches_quota();

create or replace function private.searches_prune_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.searches s
  where s.user_id = new.user_id
    and not s.is_saved
    and s.id not in (
      select h.id from public.searches h
      where h.user_id = new.user_id and not h.is_saved
      order by h.created_at desc, h.id
      limit 100
    );
  return null;
end;
$$;

create trigger searches_prune_history
  after insert on public.searches
  for each row when (not new.is_saved)
  execute function private.searches_prune_history();
