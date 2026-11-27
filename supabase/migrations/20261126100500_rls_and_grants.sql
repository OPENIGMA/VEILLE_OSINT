-- ============================================================================
-- 6/7 — Sécurité : RLS sur TOUTES les tables + droits explicites
--
-- Principe : « tout est interdit sauf ce qui est écrit ».
--  * Supabase accorde par défaut tous les droits à anon / authenticated sur les
--    nouvelles tables : on les retire, puis on redonne le strict nécessaire.
--  * service_role (clé secrète, jamais dans le navigateur) contourne la RLS :
--    il sert uniquement au Worker d'ingestion et aux tâches planifiées.
--  * Les colonnes modifiables par un utilisateur sont listées une à une : il ne
--    peut pas s'attribuer le rôle admin ni toucher aux curseurs des alertes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles : chacun lit et modifie le sien (sauf le rôle)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, comfort_mode, preferences) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- sources_rss : lecture publique des sources actives ; CRUD réservé aux admins
-- ---------------------------------------------------------------------------
alter table public.sources_rss enable row level security;
revoke all on public.sources_rss from anon, authenticated;
grant select on public.sources_rss to anon;
grant select, insert, update, delete on public.sources_rss to authenticated;

create policy sources_read_anon on public.sources_rss
  for select to anon
  using (is_active);

create policy sources_read_authenticated on public.sources_rss
  for select to authenticated
  using (is_active or (select public.is_admin()));

create policy sources_admin_insert on public.sources_rss
  for insert to authenticated
  with check ((select public.is_admin()));

create policy sources_admin_update on public.sources_rss
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy sources_admin_delete on public.sources_rss
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- source_fetch_state : état technique, lisible par les admins seulement
-- (écrit uniquement par service_role)
-- ---------------------------------------------------------------------------
alter table public.source_fetch_state enable row level security;
revoke all on public.source_fetch_state from anon, authenticated;
grant select on public.source_fetch_state to authenticated;

create policy fetch_state_admin_read on public.source_fetch_state
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Contenu public en lecture seule : thèmes, territoires, articles, jeux de
-- données, menaces. Aucune écriture possible via l'API (service_role seulement).
-- ---------------------------------------------------------------------------
alter table public.themes enable row level security;
revoke all on public.themes from anon, authenticated;
grant select on public.themes to anon, authenticated;
create policy themes_public_read on public.themes
  for select to anon, authenticated using (true);

alter table public.territories enable row level security;
revoke all on public.territories from anon, authenticated;
grant select on public.territories to anon, authenticated;
create policy territories_public_read on public.territories
  for select to anon, authenticated using (true);

alter table public.articles_rss enable row level security;
revoke all on public.articles_rss from anon, authenticated;
grant select on public.articles_rss to anon, authenticated;
create policy articles_public_read on public.articles_rss
  for select to anon, authenticated using (true);

alter table public.datasets_datagouv enable row level security;
revoke all on public.datasets_datagouv from anon, authenticated;
grant select on public.datasets_datagouv to anon, authenticated;
create policy datasets_public_read on public.datasets_datagouv
  for select to anon, authenticated using (true);

alter table public.threats enable row level security;
revoke all on public.threats from anon, authenticated;
grant select on public.threats to anon, authenticated;
create policy threats_public_read on public.threats
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- searches : strictement personnelles. user_id n'est jamais fourni par le
-- client (valeur par défaut auth.uid()) et ne peut pas être modifié.
-- ---------------------------------------------------------------------------
alter table public.searches enable row level security;
revoke all on public.searches from anon, authenticated;
grant select, delete on public.searches to authenticated;
grant insert (name, query, filters, is_saved) on public.searches to authenticated;
grant update (name, query, filters, is_saved, last_run_at) on public.searches to authenticated;

create policy searches_select_own on public.searches
  for select to authenticated using (user_id = (select auth.uid()));
create policy searches_insert_own on public.searches
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy searches_update_own on public.searches
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy searches_delete_own on public.searches
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- alerts : personnelles ; une alerte ne peut viser qu'une recherche à soi.
-- Les curseurs (last_checked_at, last_sent_at) sont écrits par service_role.
-- ---------------------------------------------------------------------------
alter table public.alerts enable row level security;
revoke all on public.alerts from anon, authenticated;
grant select, delete on public.alerts to authenticated;
grant insert (name, search_id, frequency, is_active) on public.alerts to authenticated;
grant update (name, frequency, is_active) on public.alerts to authenticated;

create policy alerts_select_own on public.alerts
  for select to authenticated using (user_id = (select auth.uid()));
create policy alerts_insert_own on public.alerts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.searches s
      where s.id = alerts.search_id and s.user_id = (select auth.uid())
    )
  );
create policy alerts_update_own on public.alerts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy alerts_delete_own on public.alerts
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- favorites : personnels
-- ---------------------------------------------------------------------------
alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, delete on public.favorites to authenticated;
grant insert (target_type, target_id, note) on public.favorites to authenticated;
grant update (note) on public.favorites to authenticated;

create policy favorites_select_own on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_insert_own on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy favorites_update_own on public.favorites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy favorites_delete_own on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Droits d'exécution des fonctions
-- ---------------------------------------------------------------------------

-- Réservées au service (Worker d'ingestion, tâches planifiées, secrets)
revoke execute on function public.ingest_articles(jsonb)               from public, anon, authenticated;
revoke execute on function public.ingest_threats(jsonb)                from public, anon, authenticated;
revoke execute on function public.ingest_datasets(jsonb)               from public, anon, authenticated;
revoke execute on function public.purge_old_content(integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.hash_secret(text)                    from public, anon, authenticated;
revoke execute on function public.verify_secret(text, text)            from public, anon, authenticated;
grant  execute on function public.ingest_articles(jsonb)               to service_role;
grant  execute on function public.ingest_threats(jsonb)                to service_role;
grant  execute on function public.ingest_datasets(jsonb)               to service_role;
grant  execute on function public.purge_old_content(integer, integer, integer) to service_role;
grant  execute on function public.hash_secret(text)                    to service_role;
grant  execute on function public.verify_secret(text, text)            to service_role;

-- Import des territoires : exécutable par le propriétaire (migrations, SQL editor) seulement
revoke execute on function private.import_epcis(jsonb, text[])         from public, anon, authenticated;
revoke execute on function private.import_communes(jsonb)              from public, anon, authenticated;

-- Réservées aux comptes connectés
revoke execute on function public.is_admin()                           from public, anon;
revoke execute on function public.export_my_data()                     from public, anon;
revoke execute on function public.delete_my_account(text)              from public, anon;
grant  execute on function public.is_admin()                           to authenticated;
grant  execute on function public.export_my_data()                     to authenticated;
grant  execute on function public.delete_my_account(text)              to authenticated;

-- Recherche, territoires : publics (anon + authenticated), RLS appliquée
-- (search_content, search_territories, territory_lineage, resolve_postal_code
--  gardent leur droit d'exécution par défaut).

-- ---------------------------------------------------------------------------
-- Garde-fou : la migration échoue si une table du schéma public n'a pas la RLS
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'RLS non activée sur : %', v_missing;
  end if;
end;
$$;
