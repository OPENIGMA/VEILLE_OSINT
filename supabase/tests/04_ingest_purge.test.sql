-- Ingestion (données sales, lots, mises à jour) et purge de rétention
begin;
set local search_path = "$user", public, extensions;

select test.as_service();

-- ============================================================ A. validation des lots
select test.expect_error($$select public.ingest_articles('{"a":1}'::jsonb)$$, 'un lot doit être un tableau JSON');
select test.expect_error($$select public.ingest_articles(null)$$, 'lot null refusé');
select test.expect_error(
  $$select public.ingest_articles((select jsonb_agg(jsonb_build_object('url', 'https://x.fr/' || g, 'title', 't' || g)) from generate_series(1, 501) g))$$,
  'plus de 500 éléments refusé');

-- Données sales : aucune ne doit faire échouer le lot ; seules les lignes valides entrent
select test.assert(public.ingest_articles($j$[
  {"url":"https://s.fr/ok1","title":"Valide"},
  {"url":"ftp://s.fr/mauvais","title":"Protocole refusé"},
  {"url":"https://s.fr/sans-titre","title":""},
  {"url":"https://s.fr/sans-titre2"},
  {"title":"Sans URL"},
  "pas un objet",
  42,
  null,
  {"url":"https://s.fr/date-folle","title":"Date illisible","published_at":"pas une date","source_id":"pas-un-uuid","lat":"abc","lon":"def"},
  {"url":"https://s.fr/futur","title":"Date future","published_at":"2999-01-01T00:00:00Z"},
  {"url":"https://s.fr/coords","title":"Coordonnées hors plage","lat":95,"lon":10},
  {"url":"https://s.fr/type","title":"Type inconnu","content_type":"nimporte","language":"fr-FR-extra-long"},
  {"url":"https://s.fr/source-inconnue","title":"Source inconnue","source_id":"00000000-0000-0000-0000-00000000dead"}
]$j$::jsonb) = 6, 'lot sale : 6 éléments valides sur 13, aucune erreur');

select test.as_owner();
select test.assert((select published_at from public.articles_rss where url = 'https://s.fr/futur') <= now(), 'date future ramenée à maintenant');
select test.assert((select lat is null and lon is null from public.articles_rss where url = 'https://s.fr/coords'), 'coordonnées hors plage ignorées');
select test.assert((select lat is null and lon is null from public.articles_rss where url = 'https://s.fr/date-folle'), 'coordonnées illisibles ignorées');
select test.assert((select content_type from public.articles_rss where url = 'https://s.fr/type') = 'article', 'type de contenu inconnu → article');
select test.assert((select char_length(language) from public.articles_rss where url = 'https://s.fr/type') <= 8, 'langue tronquée');
select test.assert((select source_id is null from public.articles_rss where url = 'https://s.fr/source-inconnue'), 'source inconnue ignorée (pas d''erreur de clé étrangère)');
select test.assert((select source_id is null from public.articles_rss where url = 'https://s.fr/date-folle'), 'UUID illisible ignoré');

-- ============================================================ B. troncatures
select test.as_service();
select test.assert(public.ingest_articles(jsonb_build_array(jsonb_build_object(
  'url', 'https://s.fr/long', 'title', repeat('T', 800), 'excerpt', repeat('E', 3000), 'author', repeat('A', 500),
  'territory_ids', (select jsonb_agg('dep-' || lpad(g::text, 2, '0')) from generate_series(1, 40) g),
  'entities',      (select jsonb_agg('entité ' || g) from generate_series(1, 120) g),
  'themes',        '["economie","energie"]'::jsonb))) = 1, 'élément aux champs démesurés accepté');
select test.as_owner();
select test.assert((select char_length(title) from public.articles_rss where url = 'https://s.fr/long') = 500, 'titre tronqué à 500');
select test.assert((select char_length(excerpt) from public.articles_rss where url = 'https://s.fr/long') = 1000, 'extrait tronqué à 1000');
select test.assert((select char_length(author) from public.articles_rss where url = 'https://s.fr/long') = 200, 'auteur tronqué à 200');
select test.assert((select cardinality(territory_ids) from public.articles_rss where url = 'https://s.fr/long') <= 30, 'territoires plafonnés à 30');
select test.assert((select cardinality(entities) from public.articles_rss where url = 'https://s.fr/long') = 50, 'entités plafonnées à 50');

select test.assert((select max(char_length(snippet)) from public.search_content('{"kinds":["article"],"limit":50}')) <= 300, 'les extraits renvoyés par la recherche ne dépassent pas 300 caractères');

-- ============================================================ C. volume : 500 articles en un appel
select test.as_service();
do $$
declare
  v_start timestamptz := clock_timestamp();
  v_n integer;
  v_ms numeric;
begin
  select public.ingest_articles(
    (select jsonb_agg(jsonb_build_object(
        'url', 'https://volume.fr/' || g, 'title', 'Article de volume numéro ' || g,
        'excerpt', 'Texte de démonstration ' || g, 'published_at', '2026-06-01T00:00:00Z',
        'territory_ids', jsonb_build_array('dep-31'), 'themes', jsonb_build_array('economie'),
        'entities', jsonb_build_array('entité ' || g)))
     from generate_series(1, 500) g)) into v_n;
  v_ms := extract(milliseconds from clock_timestamp() - v_start);
  perform test.assert(v_n = 500, '500 articles ingérés en un seul appel');
  perform test.assert(v_ms < 5000, format('500 articles ingérés en %s ms (< 5 s)', round(v_ms)));
end;
$$;
-- Rejouer le même lot ne duplique rien
select test.assert(
  public.ingest_articles((select jsonb_agg(jsonb_build_object('url', 'https://volume.fr/' || g, 'title', 'Rejeu ' || g)) from generate_series(1, 500) g)) = 0,
  'rejouer un lot ne crée aucun doublon (idempotent)');
select test.as_owner();

-- ============================================================ D. jeux de données : insertion puis mise à jour
select test.as_service();
select test.assert(public.ingest_datasets($j$[{"id":"dsA","title":"Titre initial","description":"v1","url":"https://d.fr/a","formats":["CSV"],"resources_count":"3"}]$j$::jsonb) = 1, 'jeu de données inséré');
select test.assert(public.ingest_datasets($j$[{"id":"dsA","title":"Titre modifié","description":"v2","url":"https://d.fr/a","formats":["JSON"]}]$j$::jsonb) = 1, 'même identifiant : mise à jour');
select test.assert(public.ingest_datasets($j$[
  {"id":"dsB","title":"B premier","url":"https://d.fr/b","published_at":"2026-01-01T00:00:00Z"},
  {"id":"dsB","title":"B plus récent","url":"https://d.fr/b","published_at":"2026-05-01T00:00:00Z"},
  {"title":"Sans identifiant","url":"https://d.fr/c"},
  {"id":"dsD","title":"URL invalide","url":"javascript:alert(1)"}
]$j$::jsonb) = 1, 'doublon dans un même lot toléré, éléments invalides ignorés');
select test.as_owner();
select test.assert((select count(*) from public.datasets_datagouv where id in ('dsA','dsB')) = 2, 'pas de doublon de jeu de données');
select test.assert((select title from public.datasets_datagouv where id = 'dsA') = 'Titre modifié', 'titre mis à jour');
select test.assert((select formats from public.datasets_datagouv where id = 'dsA') = array['json'], 'formats mis à jour et en minuscules');
select test.assert((select title from public.datasets_datagouv where id = 'dsB') = 'B plus récent', 'doublon dans le lot : la version la plus récente l''emporte');
select test.assert((select resources_count from public.datasets_datagouv where id = 'dsA') = 0, 'compteur absent → 0 après mise à jour');

-- ============================================================ E. menaces
select test.as_service();
select test.assert(public.ingest_threats($j$[
  {"kind":"inconnu","severity":"apocalyptique","title":"Valeurs hors liste","url":"https://t.fr/1",
   "article_id":"999999","cve_ids":["cve-2026-1","CVE-2026-1"],"actors":["APT28","apt28","Éxemple"]},
  {"kind":"ingerence","title":"Doublon URL","url":"https://t.fr/1"},
  {"kind":"cyberattaque","title":"Sans lien valide","url":"not-a-url"}
]$j$::jsonb) = 1, 'menaces : doublon d''URL et lien invalide ignorés');
select test.as_owner();
select test.assert((select kind || '/' || severity from public.threats where url = 'https://t.fr/1') = 'autre/info', 'type et gravité hors liste → valeurs par défaut');
select test.assert((select article_id is null from public.threats where url = 'https://t.fr/1'), 'article inexistant ignoré');
select test.assert((select cve_ids from public.threats where url = 'https://t.fr/1') = array['CVE-2026-1'], 'CVE normalisés et dédoublonnés');
select test.assert((select actors from public.threats where url = 'https://t.fr/1') = array['apt28','exemple'], 'acteurs normalisés et dédoublonnés');

-- ============================================================ F. purge de rétention
-- Jeu d'essai : articles de 2024 (dont 1 en favori), récents, menaces anciennes et récentes
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000009', 'purge@example.org');
select test.as_service();
select public.ingest_articles($j$[
  {"url":"https://purge.fr/vieux1","title":"Vieil article 1","published_at":"2024-01-01T00:00:00Z"},
  {"url":"https://purge.fr/vieux2","title":"Vieil article 2","published_at":"2024-02-01T00:00:00Z"},
  {"url":"https://purge.fr/vieux-favori","title":"Vieil article en favori","published_at":"2024-03-01T00:00:00Z"},
  {"url":"https://purge.fr/recent","title":"Article récent","published_at":"2026-10-01T00:00:00Z"}
]$j$::jsonb);
select public.ingest_threats($j$[
  {"kind":"cyberattaque","title":"Menace 2023","url":"https://purge.fr/t-2023","published_at":"2023-01-01T00:00:00Z"},
  {"kind":"cyberattaque","title":"Menace 2023 favorite","url":"https://purge.fr/t-2023-fav","published_at":"2023-02-01T00:00:00Z"},
  {"kind":"cyberattaque","title":"Menace de 2025","url":"https://purge.fr/t-2025","published_at":"2025-09-01T00:00:00Z"}
]$j$::jsonb);
select test.as_owner();

insert into public.favorites (user_id, target_type, target_id)
  select 'aaaaaaaa-0000-0000-0000-000000000009', 'article', id::text from public.articles_rss where url = 'https://purge.fr/vieux-favori';
insert into public.favorites (user_id, target_type, target_id)
  select 'aaaaaaaa-0000-0000-0000-000000000009', 'threat', id::text from public.threats where url = 'https://purge.fr/t-2023-fav';
insert into public.searches (user_id, name, is_saved, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000009', 'Ancienne sauvegardée', true, now() - interval '200 days');
insert into public.searches (user_id, query, is_saved, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000009', 'ancien historique', false, now() - interval '100 days'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'historique récent', false, now() - interval '10 days');

select test.as_service();
select test.expect_error($$select public.purge_old_content(0, 24, 100)$$, 'durée de rétention invalide refusée');
select test.expect_error($$select public.purge_old_content(12, 24, 0)$$, 'taille de lot invalide refusée');

do $$
declare
  v_first  jsonb;
  v_second jsonb;
  v_third  jsonb;
begin
  -- Lot de 1 : au plus une ligne par table (2 vieux articles supprimables, 1 menace, l'historique est hors lot)
  v_first := public.purge_old_content(12, 24, 1);
  perform test.assert(v_first = '{"articles":1,"threats":1,"search_history":1}'::jsonb,
    'lot de 1 : un article, une menace, l''ancien historique — obtenu ' || v_first::text);

  -- Second passage : le dernier vieil article ; plus de menace ni d'historique à purger
  v_second := public.purge_old_content(12, 24, 5000);
  perform test.assert(v_second = '{"articles":1,"threats":0,"search_history":0}'::jsonb,
    'second passage : le dernier vieil article seulement — obtenu ' || v_second::text);

  -- Troisième passage : tout est purgé, le favori est protégé
  v_third := public.purge_old_content(12, 24, 5000);
  perform test.assert(v_third = '{"articles":0,"threats":0,"search_history":0}'::jsonb,
    'troisième passage : plus rien à purger (idempotent) — obtenu ' || v_third::text);
end;
$$;
select test.as_owner();

select test.assert(not exists (select 1 from public.articles_rss where url in ('https://purge.fr/vieux1', 'https://purge.fr/vieux2')), 'articles de plus de 12 mois purgés');
select test.assert(exists (select 1 from public.articles_rss where url = 'https://purge.fr/vieux-favori'), 'article en favori conservé malgré son âge');
select test.assert(exists (select 1 from public.articles_rss where url = 'https://purge.fr/recent'), 'article récent conservé');
select test.assert(not exists (select 1 from public.threats where url = 'https://purge.fr/t-2023'), 'menace de plus de 24 mois purgée');
select test.assert(exists (select 1 from public.threats where url = 'https://purge.fr/t-2023-fav'), 'menace en favori conservée');
select test.assert(exists (select 1 from public.threats where url = 'https://purge.fr/t-2025'), 'menace de moins de 24 mois conservée');
select test.assert(not exists (select 1 from public.searches where query = 'ancien historique'), 'historique de plus de 90 jours purgé');
select test.assert(exists (select 1 from public.searches where query = 'historique récent'), 'historique récent conservé');
select test.assert(exists (select 1 from public.searches where name = 'Ancienne sauvegardée'), 'recherche sauvegardée jamais purgée');

-- Une menace liée à un article purgé garde sa ligne (article_id passe à null)
select test.as_service();
select public.ingest_articles('[{"url":"https://purge.fr/lie","title":"Article lié","published_at":"2023-06-01T00:00:00Z"}]'::jsonb);
select test.as_owner();
insert into public.threats (kind, title, url, article_id)
  select 'autre', 'Menace liée', 'https://purge.fr/t-liee', id from public.articles_rss where url = 'https://purge.fr/lie';
select test.as_service();
select public.purge_old_content(12, 24, 5000);
select test.as_owner();
select test.assert(exists (select 1 from public.threats where url = 'https://purge.fr/t-liee' and article_id is null),
  'menace conservée, lien vers l''article purgé mis à null');

rollback;
