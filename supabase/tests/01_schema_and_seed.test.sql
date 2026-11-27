-- Structure, RLS et données de référence
begin;

-- Les 9 tables demandées existent (+ 2 tables d'appui)
select test.assert(
  (select count(*) from pg_tables
   where schemaname = 'public'
     and tablename in ('profiles','articles_rss','datasets_datagouv','searches','alerts',
                       'favorites','territories','sources_rss','threats')) = 9,
  'les 9 tables du cahier des charges existent');
select test.assert((select count(*) from pg_tables where schemaname = 'public') = 11,
  '11 tables au total (9 + themes + source_fetch_state)');

-- RLS sur TOUTES les tables
select test.assert(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0,
  'RLS activée sur toutes les tables publiques');

-- Chaque table a au moins une politique, sauf source_fetch_state (admin) -> aussi une
select test.assert(
  (select count(*) from pg_tables t
   where t.schemaname = 'public'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)) = 0,
  'chaque table a au moins une politique RLS');

-- Triggers updated_at présents
select test.assert(
  (select count(*) from pg_trigger
   where tgname in ('profiles_touch_updated_at','sources_rss_touch_updated_at','searches_touch_updated_at',
                    'alerts_touch_updated_at','source_fetch_state_touch_updated_at') and not tgisinternal) = 5,
  '5 triggers updated_at');

-- ---- Thèmes
select test.assert((select count(*) from public.themes) = 45, '45 thèmes');
select test.assert(exists (select 1 from public.themes where slug = 'sport'), 'thème sport présent (« sort » du cahier des charges)');
select test.assert(exists (select 1 from public.themes where slug = 'joph2030'), 'thème joph2030 présent');
select test.assert((select count(distinct tone) from public.themes) = 4, 'les 4 tons néon sont utilisés');

-- ---- Territoires : comptes
select test.assert((select count(*) from public.territories where type = 'reg') = 18, '18 régions (13 + 5 outre-mer)');
select test.assert((select count(*) from public.territories where type = 'dep') = 101, '101 départements');
select test.assert((select count(*) from public.territories where type = 'dep' and not is_overseas) = 96, '96 départements métropolitains');
select test.assert((select count(*) from public.territories where type = 'zds') = 7, '7 zones de défense');
select test.assert((select count(*) from public.territories where type = 'colom') = 6, '6 collectivités d''outre-mer');

-- Chaque département a une région existante
select test.assert(
  (select count(*) from public.territories d
   where d.type = 'dep' and not exists (select 1 from public.territories r where r.id = d.parent_id and r.type = 'reg')) = 0,
  'tous les départements ont une région valide');

-- Nombre de départements par région (répartition officielle)
select test.assert(
  (select string_agg(r.code || ':' || n, ',' order by r.code)
   from (select parent_id, count(*) n from public.territories where type = 'dep' group by 1) c
   join public.territories r on r.id = c.parent_id)
  = '01:1,02:1,03:1,04:1,06:1,11:8,24:6,27:8,28:5,32:5,44:10,52:5,53:4,75:12,76:13,84:12,93:6,94:2',
  'répartition des départements par région');

-- Périmètre prioritaire : Occitanie, PACA, Corse
select test.assert(
  (select array_agg(code order by code) from public.territories where type = 'dep' and parent_id = 'reg-76')
  = array['09','11','12','30','31','32','34','46','48','65','66','81','82'],
  'Occitanie = 13 départements exacts');
select test.assert(
  (select array_agg(code order by code) from public.territories where type = 'dep' and parent_id = 'reg-93')
  = array['04','05','06','13','83','84'], 'PACA = 6 départements exacts');
select test.assert(
  (select array_agg(code order by code) from public.territories where type = 'dep' and parent_id = 'reg-94')
  = array['2A','2B'], 'Corse = 2A et 2B');

-- Collision de codes : région 11 (Île-de-France) ≠ département 11 (Aude)
select test.assert(
  (select name from public.territories where id = 'reg-11') = 'Île-de-France'
  and (select name from public.territories where id = 'dep-11') = 'Aude',
  'codes identiques, identifiants distincts (reg-11 / dep-11)');

-- Zones de défense vérifiées : Occitanie, PACA, Corse -> Sud ; Nouvelle-Aquitaine -> Sud-Ouest
select test.assert(
  (select array_agg(code order by code) from public.territories where type = 'reg' and parent_id = 'zds-sud')
  = array['76','93','94'], 'zone Sud = Occitanie + PACA + Corse');
select test.assert(
  (select array_agg(code) from public.territories where type = 'reg' and parent_id = 'zds-sud-ouest') = array['75'],
  'zone Sud-Ouest = Nouvelle-Aquitaine seule');

-- ---- Lignée territoriale
select test.assert(public.territory_lineage(array['dep-31']) = array['dep-31','reg-76','zds-sud'],
  'lignée dep-31 → région Occitanie → zone Sud');
select test.assert(public.territory_lineage(array['dep-2A']) = array['dep-2A','reg-94','zds-sud'],
  'lignée dep-2A → Corse → zone Sud');
select test.assert(public.territory_lineage(array['dep-14']) = array['dep-14','reg-28'],
  'Normandie sans zone (à confirmer) : la lignée s''arrête à la région');
select test.assert(public.territory_lineage(array['com-99999','dep-13']) = array['com-99999','dep-13','reg-93','zds-sud'],
  'identifiant inconnu conservé, autres étendus');
select test.assert(public.territory_lineage(null) = '{}', 'lignée de null = tableau vide');

-- Cohérence : un identifiant est toujours « type-code »
select test.assert(
  (select count(*) from public.territories where id <> type || '-' || code) = 0, 'id = type-code partout');

-- Contraintes : une région ne peut pas avoir un code invalide ni un doublon
select test.expect_error($$insert into public.territories (type, code, name) values ('reg','76','Doublon')$$, 'doublon (type, code) refusé');
select test.expect_error($$insert into public.territories (type, code, name) values ('pays','FR','France')$$, 'type inconnu refusé');
select test.expect_error($$insert into public.territories (type, code, name, lat, lon) values ('com','00001','X',95,0)$$, 'latitude hors plage refusée');

rollback;
