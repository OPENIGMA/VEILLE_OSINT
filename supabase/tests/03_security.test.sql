-- Sécurité : RLS, droits par colonne, quotas, droits d'exécution, RGPD.
-- Utilisateurs de test : A, B (ordinaires), C (admin), D (supprimé en fin de test)
begin;
set local search_path = "$user", public, extensions;

-- Exécute une instruction DML et renvoie le nombre de lignes touchées (0 = bloqué par la RLS)
create function test.rowcount(p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute p_sql;
  get diagnostics v = row_count;
  return v;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.org', '{"display_name":"Alice"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.org', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@example.org', '{}'),
  ('dddddddd-0000-0000-0000-000000000004', 'd@example.org', '{}');
update public.profiles set role = 'admin' where id = 'cccccccc-0000-0000-0000-000000000003';

-- ============================================================ A. profils
select test.assert((select count(*) from public.profiles) = 4, 'un profil est créé automatiquement à chaque inscription');
select test.assert((select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Alice', 'nom affiché repris de l''inscription');
select test.assert((select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') is null, 'aucun nom déduit de l''email');
select test.assert((select role from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'user', 'rôle par défaut : user');

select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert((select count(*) from public.profiles) = 1, 'A ne voit que son propre profil');
select test.assert(test.rowcount($$update public.profiles set display_name = 'Alice B.' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 1, 'A modifie son nom affiché');
select test.assert(test.rowcount($$update public.profiles set display_name = 'Pirate' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$) = 0, 'A ne peut pas modifier le profil de B');
select test.expect_error($$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'A ne peut pas s''attribuer le rôle admin');
select test.expect_error($$update public.profiles set id = gen_random_uuid() where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'A ne peut pas changer l''identifiant de son profil');
select test.expect_error($$delete from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'A ne peut pas supprimer son profil directement');
select test.expect_error($$insert into public.profiles (id) values (gen_random_uuid())$$, 'A ne peut pas créer de profil');
select test.assert(public.is_admin() = false, 'A n''est pas admin');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.assert(public.is_admin() = true, 'C est admin');
select test.as_anon();
select test.expect_error($$select public.is_admin()$$, 'is_admin() inaccessible à un visiteur');
select test.as_owner();

-- Le trigger updated_at remplace toute valeur écrite à la main
update public.profiles set updated_at = '2000-01-01' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test.assert((select updated_at from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') > '2001-01-01', 'trigger updated_at');

-- ============================================================ B. visiteur anonyme
select test.as_anon();
select test.expect_error($$select * from public.profiles$$, 'anon : profils interdits');
select test.expect_error($$select * from public.searches$$, 'anon : recherches interdites');
select test.expect_error($$select * from public.alerts$$, 'anon : alertes interdites');
select test.expect_error($$select * from public.favorites$$, 'anon : favoris interdits');
select test.expect_error($$select * from public.source_fetch_state$$, 'anon : état de collecte interdit');
select test.assert((select count(*) from public.themes) = 45, 'anon : lecture des thèmes');
select test.assert((select count(*) from public.territories) > 100, 'anon : lecture des territoires');
select test.assert((select count(*) from public.articles_rss) >= 0, 'anon : lecture des articles');
select test.assert((select count(*) from public.datasets_datagouv) >= 0, 'anon : lecture des jeux de données');
select test.assert((select count(*) from public.threats) >= 0, 'anon : lecture des menaces');
select test.expect_error($$insert into public.articles_rss (url, title) values ('https://x.fr/1', 'x')$$, 'anon : écriture d''article interdite');
select test.expect_error($$update public.articles_rss set title = 'x'$$, 'anon : modification d''article interdite');
select test.expect_error($$delete from public.articles_rss$$, 'anon : suppression d''article interdite');
select test.expect_error($$insert into public.threats (kind, title, url) values ('autre', 'x', 'https://x.fr/1')$$, 'anon : écriture de menace interdite');
select test.expect_error($$insert into public.datasets_datagouv (id, title, url) values ('x', 'x', 'https://x.fr/1')$$, 'anon : écriture de jeu de données interdite');
select test.expect_error($$update public.territories set name = 'x'$$, 'anon : modification de territoire interdite');
select test.expect_error($$delete from public.themes$$, 'anon : suppression de thème interdite');
select test.expect_error($$insert into public.sources_rss (name, feed_url) values ('x', 'https://x.fr/rss')$$, 'anon : création de source interdite');

-- Même chose pour un utilisateur connecté ordinaire
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.expect_error($$insert into public.articles_rss (url, title) values ('https://x.fr/1', 'x')$$, 'A : écriture d''article interdite');
select test.expect_error($$insert into public.threats (kind, title, url) values ('autre', 'x', 'https://x.fr/1')$$, 'A : écriture de menace interdite');
select test.expect_error($$insert into public.datasets_datagouv (id, title, url) values ('x', 'x', 'https://x.fr/1')$$, 'A : écriture de jeu de données interdite');
select test.expect_error($$insert into public.territories (type, code, name) values ('reg', '99', 'x')$$, 'A : écriture de territoire interdite');
select test.expect_error($$insert into public.themes (slug, label, group_name) values ('x', 'x', 'x')$$, 'A : écriture de thème interdite');
select test.as_owner();

-- ============================================================ C. recherches
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert(test.rowcount($$insert into public.searches (name, query, filters, is_saved) values ('Veille Occitanie', 'cyberattaque', '{"territories":["reg-76"]}', true)$$) = 1, 'A sauvegarde une recherche');
select test.assert((select user_id from public.searches where name = 'Veille Occitanie') = 'aaaaaaaa-0000-0000-0000-000000000001', 'user_id renseigné automatiquement');
select test.expect_error($$insert into public.searches (name, is_saved) values (null, true)$$, 'une recherche sauvegardée exige un nom');
select test.expect_error($$insert into public.searches (user_id, name, is_saved) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Pour B', true)$$, 'A ne peut pas créer une recherche au nom de B');
select test.expect_error($$update public.searches set user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'A ne peut pas transférer sa recherche à B');
select test.expect_error($$insert into public.searches (name, filters, is_saved) values ('x', '[1,2]', true)$$, 'filters doit être un objet JSON');
select test.expect_error($$insert into public.searches (name, filters, is_saved) values ('x', jsonb_build_object('k', repeat('x', 9000)), true)$$, 'filters limité à 8 Ko');
select test.expect_error($$insert into public.searches (name, query, is_saved) values ('x', repeat('x', 501), true)$$, 'requête limitée à 500 caractères');

select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.assert((select count(*) from public.searches) = 0, 'B ne voit aucune recherche de A');
select test.assert(test.rowcount($$update public.searches set name = 'Pirate'$$) = 0, 'B ne peut pas modifier les recherches de A');
select test.assert(test.rowcount($$delete from public.searches$$) = 0, 'B ne peut pas supprimer les recherches de A');
select test.as_owner();
select test.assert((select name from public.searches where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Veille Occitanie', 'la recherche de A est intacte');

-- Quota : 50 recherches sauvegardées
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert(test.rowcount($$insert into public.searches (name, is_saved) select 'S' || g, true from generate_series(1, 49) g$$) = 49, 'A atteint 50 recherches sauvegardées');
select test.expect_error($$insert into public.searches (name, is_saved) values ('de trop', true)$$, 'quota : 51e recherche sauvegardée refusée');
select test.assert(test.rowcount($$insert into public.searches (query, is_saved) values ('historique', false)$$) = 1, 'l''historique reste possible');
select test.expect_error($$update public.searches set is_saved = true, name = 'promue' where query = 'historique'$$, 'quota : promotion d''une entrée d''historique refusée');

-- Historique : seules les 100 dernières entrées sont conservées
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.assert(test.rowcount($$insert into public.searches (query) select 'q' || g from generate_series(1, 105) g$$) = 105, 'B ajoute 105 entrées d''historique');
select test.assert((select count(*) from public.searches) = 100, 'historique plafonné à 100 entrées');
select test.as_owner();

-- ============================================================ D. alertes
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert(test.rowcount($$insert into public.alerts (name, search_id) select 'Alerte Occitanie', id from public.searches where name = 'Veille Occitanie'$$) = 1, 'A crée une alerte sur sa recherche');
select test.assert((select frequency from public.alerts) = 'quotidienne', 'fréquence par défaut : quotidienne');
select test.expect_error($$insert into public.alerts (name, search_id, last_sent_at) select 'x', id, now() from public.searches where name = 'Veille Occitanie'$$, 'A ne peut pas écrire le curseur last_sent_at');
select test.expect_error($$update public.alerts set last_checked_at = now()$$, 'A ne peut pas modifier last_checked_at');
select test.expect_error($$update public.alerts set frequency = 'chaque-seconde'$$, 'fréquence invalide refusée');
select test.assert(test.rowcount($$update public.alerts set frequency = 'hebdomadaire', is_active = false$$) = 1, 'A modifie sa fréquence et l''active/désactive');

select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.assert((select count(*) from public.alerts) = 0, 'B ne voit aucune alerte de A');
select test.as_owner();

-- Même en connaissant l'identifiant de la recherche de A, B ne peut pas y brancher une alerte
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$
declare v_search uuid;
begin
  perform set_config('role', 'postgres', true);   -- lit l'identifiant comme propriétaire
  select id into v_search from public.searches where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1;
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.alerts (name, search_id) values ('Espionnage', v_search);
    raise exception 'ÉCHEC : B a pu créer une alerte sur la recherche de A';
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'ok   - B ne peut pas brancher une alerte sur la recherche de A (%)', sqlstate;
  end;
end;
$$;
select test.as_owner();

-- Quota : 20 alertes
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert(test.rowcount($$insert into public.alerts (name, search_id) select 'A' || g, id from public.searches, generate_series(1, 19) g where name = 'Veille Occitanie'$$) = 19, 'A atteint 20 alertes');
select test.expect_error($$insert into public.alerts (name, search_id) select 'de trop', id from public.searches where name = 'Veille Occitanie'$$, 'quota : 21e alerte refusée');
-- Supprimer une recherche supprime ses alertes
select test.assert(test.rowcount($$delete from public.searches where name = 'Veille Occitanie'$$) = 1, 'A supprime sa recherche');
select test.assert((select count(*) from public.alerts) = 0, 'les alertes de la recherche supprimée disparaissent');
select test.as_owner();

-- ============================================================ E. favoris
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert(test.rowcount($$insert into public.favorites (target_type, target_id, note) values ('article', '42', 'à relire')$$) = 1, 'A ajoute un favori');
select test.expect_error($$insert into public.favorites (target_type, target_id) values ('article', '42')$$, 'favori en double refusé');
select test.expect_error($$insert into public.favorites (target_type, target_id) values ('inconnu', '1')$$, 'type de favori invalide refusé');
select test.expect_error($$update public.favorites set target_id = '43'$$, 'la cible d''un favori ne se modifie pas');
select test.assert(test.rowcount($$update public.favorites set note = 'lu'$$) = 1, 'A modifie la note d''un favori');
select test.assert(test.rowcount($$insert into public.favorites (target_type, target_id) select 'dataset', g::text from generate_series(1, 999) g$$) = 999, 'A atteint 1000 favoris');
select test.expect_error($$insert into public.favorites (target_type, target_id) values ('threat', '1')$$, 'quota : 1001e favori refusé');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.assert((select count(*) from public.favorites) = 0, 'B ne voit aucun favori de A');
select test.assert(test.rowcount($$delete from public.favorites$$) = 0, 'B ne peut pas supprimer les favoris de A');
select test.as_owner();

-- ============================================================ F. sources (admin) et état de collecte
insert into public.sources_rss (id, name, feed_url, is_active) values
  ('00000000-0000-0000-0000-0000000000b1', 'Source active',   'https://exemple.fr/actif.xml',   true),
  ('00000000-0000-0000-0000-0000000000b2', 'Source inactive', 'https://exemple.fr/inactif.xml', false);
select test.assert((select count(*) from public.source_fetch_state) = 2, 'un état de collecte est créé pour chaque source');

select test.as_anon();
select test.assert((select count(*) from public.sources_rss) = 1, 'anon : seules les sources actives sont visibles');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert((select count(*) from public.sources_rss) = 1, 'utilisateur : seules les sources actives sont visibles');
select test.expect_error($$insert into public.sources_rss (name, feed_url) values ('Pirate', 'https://pirate.fr/rss')$$, 'utilisateur : création de source interdite');
select test.assert(test.rowcount($$update public.sources_rss set name = 'Pirate'$$) = 0, 'utilisateur : modification de source impossible');
select test.assert(test.rowcount($$delete from public.sources_rss$$) = 0, 'utilisateur : suppression de source impossible');
select test.assert((select count(*) from public.source_fetch_state) = 0, 'utilisateur : état de collecte invisible');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.assert((select count(*) from public.sources_rss) = 2, 'admin : voit aussi les sources inactives');
select test.assert((select count(*) from public.source_fetch_state) = 2, 'admin : voit l''état de collecte');
select test.assert(test.rowcount($$insert into public.sources_rss (name, feed_url, kind, scope) values ('Nouvelle source', 'https://exemple.fr/nouveau.xml', 'cyber', 'specialisee')$$) = 1, 'admin : crée une source');
select test.assert(test.rowcount($$update public.sources_rss set name = 'Renommée' where name = 'Nouvelle source'$$) = 1, 'admin : modifie une source');
select test.expect_error($$insert into public.sources_rss (name, feed_url) values ('Mauvaise URL', 'ftp://exemple.fr/rss')$$, 'URL de flux non http(s) refusée');
select test.expect_error($$insert into public.sources_rss (name, feed_url) values ('Doublon', 'https://exemple.fr/actif.xml')$$, 'URL de flux en double refusée');
select test.expect_error($$insert into public.source_fetch_state (source_id) values ('00000000-0000-0000-0000-0000000000b1')$$, 'admin : l''état de collecte n''est pas modifiable depuis l''API');
select test.assert(test.rowcount($$delete from public.sources_rss where name = 'Renommée'$$) = 1, 'admin : supprime une source');
select test.as_owner();
select test.assert((select count(*) from public.source_fetch_state) = 2, 'l''état de collecte suit la suppression de la source');

-- ============================================================ G. droits d'exécution des fonctions
select test.as_anon();
select test.expect_error($$select public.ingest_articles('[]')$$, 'anon : ingest_articles interdite');
select test.expect_error($$select public.ingest_threats('[]')$$, 'anon : ingest_threats interdite');
select test.expect_error($$select public.ingest_datasets('[]')$$, 'anon : ingest_datasets interdite');
select test.expect_error($$select public.purge_old_content()$$, 'anon : purge interdite');
select test.expect_error($$select public.hash_secret('x')$$, 'anon : hash_secret interdite');
select test.expect_error($$select public.export_my_data()$$, 'anon : export RGPD interdit');
select test.expect_error($$select public.delete_my_account('SUPPRIMER')$$, 'anon : suppression de compte interdite');
select test.expect_error($$select private.import_communes('[]')$$, 'anon : import de territoires interdit');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.expect_error($$select public.ingest_articles('[]')$$, 'utilisateur : ingest_articles interdite');
select test.expect_error($$select public.ingest_datasets('[]')$$, 'utilisateur : ingest_datasets interdite');
select test.expect_error($$select public.purge_old_content()$$, 'utilisateur : purge interdite');
select test.expect_error($$select public.verify_secret('x', 'y')$$, 'utilisateur : verify_secret interdite');
select test.expect_error($$select private.import_epcis('[]')$$, 'utilisateur : import d''EPCI interdit');
select test.as_service();
select test.assert(public.ingest_articles('[]') = 0, 'service_role : ingest_articles autorisée');
select test.assert(public.purge_old_content() is not null, 'service_role : purge autorisée');

-- Hachage HASH + SEL
select test.assert(public.hash_secret('motdepasse-solide') like '$2a$12$%', 'hash bcrypt, coût 12');
select test.assert(public.hash_secret('motdepasse-solide') <> public.hash_secret('motdepasse-solide'), 'sel aléatoire : deux hachages du même secret diffèrent');
select test.assert(public.verify_secret('motdepasse-solide', public.hash_secret('motdepasse-solide')), 'vérification correcte');
select test.assert(not public.verify_secret('mauvais', public.hash_secret('motdepasse-solide')), 'vérification d''un mauvais secret');
select test.assert(position('motdepasse' in public.hash_secret('motdepasse-solide')) = 0, 'le hash ne contient pas le secret');
select test.as_owner();

-- ============================================================ H. RGPD : export et suppression
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.assert((public.export_my_data() #>> '{account,email}') = 'a@example.org', 'export : compte');
select test.assert((public.export_my_data() #>> '{profile,display_name}') = 'Alice B.', 'export : profil');
select test.assert(jsonb_array_length(public.export_my_data() -> 'favorites') = 1000, 'export : favoris');
select test.assert(jsonb_array_length(public.export_my_data() -> 'searches') = 50, 'export : recherches (50 sauvegardées + historique)');
select test.assert(not (public.export_my_data()::text like '%b@example.org%'), 'export : aucune donnée d''un autre utilisateur');
select test.as_owner();

-- Données de D, puis suppression
insert into public.searches (user_id, name, is_saved) values ('dddddddd-0000-0000-0000-000000000004', 'Recherche D', true);
insert into public.alerts (user_id, search_id, name)
  select user_id, id, 'Alerte D' from public.searches where name = 'Recherche D';
insert into public.favorites (user_id, target_type, target_id) values ('dddddddd-0000-0000-0000-000000000004', 'article', '7');

select test.as_user('dddddddd-0000-0000-0000-000000000004');
select test.expect_error($$select public.delete_my_account('oui')$$, 'suppression : confirmation incorrecte refusée');
select test.expect_error($$select public.delete_my_account(null)$$, 'suppression : confirmation absente refusée');
select public.delete_my_account('SUPPRIMER');
select test.as_owner();

select test.assert(not exists (select 1 from auth.users where id = 'dddddddd-0000-0000-0000-000000000004'), 'droit à l''oubli : compte supprimé');
select test.assert(not exists (select 1 from public.profiles  where id = 'dddddddd-0000-0000-0000-000000000004'), 'droit à l''oubli : profil supprimé');
select test.assert(not exists (select 1 from public.searches  where user_id = 'dddddddd-0000-0000-0000-000000000004'), 'droit à l''oubli : recherches supprimées');
select test.assert(not exists (select 1 from public.alerts    where user_id = 'dddddddd-0000-0000-0000-000000000004'), 'droit à l''oubli : alertes supprimées');
select test.assert(not exists (select 1 from public.favorites where user_id = 'dddddddd-0000-0000-0000-000000000004'), 'droit à l''oubli : favoris supprimés');
select test.assert((select count(*) from auth.users) = 3 and (select count(*) from public.favorites where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1000,
  'les données des autres utilisateurs sont intactes');

rollback;
