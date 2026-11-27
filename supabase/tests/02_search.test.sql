-- Moteur de recherche : texte, booléens, filtres géographiques et thématiques, index
begin;

-- Même search_path que les sessions Supabase (l'opérateur cube @> vit dans « extensions »)
set local search_path = "$user", public, extensions;

create function test.n(p jsonb) returns integer language sql stable as
  $$ select count(*)::integer from public.search_content(p) $$;

create function test.titles(p jsonb) returns text language sql stable as
  $$ select string_agg(title, ' | ') from public.search_content(p) $$;

-- Vérifie que le plan d'exécution utilise l'index indiqué (balayage séquentiel interdit)
create function test.uses_index(p_sql text, p_index text) returns boolean language plpgsql as $$
declare
  r record;
  v_plan text := '';
begin
  set local enable_seqscan = off;
  for r in execute 'explain ' || p_sql loop
    v_plan := v_plan || (r."QUERY PLAN") || E'\n';
  end loop;
  if v_plan not ilike '%' || p_index || '%' then
    raise notice 'plan obtenu : %', v_plan;
  end if;
  return v_plan ilike '%' || p_index || '%';
end;
$$;

-- ---------------------------------------------------------------- jeu d'essai
select private.import_epcis(
  '[{"code":"243100518","nom":"Toulouse Métropole","population":800000,"codesRegions":["76"]}]'::jsonb,
  array['76']);

select test.assert(private.import_communes($j$[
  {"code":"31555","nom":"Toulouse","codeDepartement":"31","codeRegion":"76","codeEpci":"243100518",
   "codesPostaux":["31000","31100","31200","31300","31400","31500"],"population":493465,
   "centre":{"type":"Point","coordinates":[1.4437,43.6047]}},
  {"code":"13055","nom":"Marseille","codeDepartement":"13","codeRegion":"93",
   "codesPostaux":["13001","13002"],"population":873076,
   "centre":{"type":"Point","coordinates":[5.3698,43.2965]}},
  {"code":"2A004","nom":"Ajaccio","codeDepartement":"2A","codeRegion":"94",
   "codesPostaux":["20000","20090"],"population":71000,
   "centre":{"type":"Point","coordinates":[8.7386,41.9192]}},
  {"code":"XXXXX","nom":"Invalide","codeDepartement":"31","codesPostaux":[]},
  {"code":"99001","nom":"Dép. inconnu","codeDepartement":"99","codesPostaux":[]}
]$j$::jsonb) = 3, 'import des communes : 3 valides, 2 rejetées (code invalide, département inconnu)');

select test.assert(
  (select epci_id from public.territories where id = 'com-31555') = 'epci-243100518',
  'la commune est rattachée à son EPCI');
select test.assert(
  (select lat from public.territories where id = 'com-31555') = 43.6047
  and (select lon from public.territories where id = 'com-31555') = 1.4437,
  'coordonnées GeoJSON [lon, lat] correctement lues');

insert into public.sources_rss (id, name, feed_url, kind, scope) values
  ('00000000-0000-0000-0000-0000000000a1', 'Presse régionale test', 'https://exemple.fr/rss', 'presse', 'regionale'),
  ('00000000-0000-0000-0000-0000000000a2', 'CERT test', 'https://cert.example/rss', 'cyber', 'specialisee');

select test.as_service();

select test.assert(public.ingest_articles($j$[
  {"source_id":"00000000-0000-0000-0000-0000000000a1","url":"https://exemple.fr/a1",
   "title":"Cyberattaque contre l'hôpital de Toulouse",
   "excerpt":"Un rançongiciel a paralysé les systèmes du centre hospitalier.",
   "published_at":"2026-09-15T08:00:00Z","themes":["cybercriminalite","sante","inconnu"],
   "territory_ids":["com-31555"],"entities":["Hôpital Purpan","HÔPITAL PURPAN"],"lat":43.6047,"lon":1.4437},
  {"url":"https://exemple.fr/a2","title":"Élections 2027 : les candidats en Occitanie",
   "excerpt":"Panorama des premiers candidats déclarés.","published_at":"2026-10-30T08:00:00Z",
   "themes":["elections-2027"],"territory_ids":["reg-76"]},
  {"url":"https://exemple.fr/a3","title":"Blocage du port de Marseille",
   "excerpt":"Les grévistes bloquent les accès au port.","published_at":"2026-05-02T08:00:00Z",
   "themes":["blocage","greve"],"territory_ids":["com-13055"],"lat":43.2965,"lon":5.3698},
  {"url":"https://exemple.fr/a4","title":"Ingérence étrangère en Corse",
   "excerpt":"Des campagnes de désinformation ciblent l'île.","published_at":"2026-01-10T08:00:00Z",
   "themes":["ingerences-etrangeres"],"territory_ids":["dep-2A"]},
  {"url":"https://exemple.fr/a1","title":"Doublon de a1","published_at":"2026-09-16T08:00:00Z"},
  {"url":"https://exemple.fr/a5","title":"Survol de drones près d'une centrale",
   "excerpt":"Plusieurs appareils ont été repérés.","published_at":"2026-08-01T08:00:00Z",
   "themes":["drones","nucleaire"],"territory_ids":["dep-13"]},
  {"url":"https://exemple.fr/a6","title":"Incident près de la centrale",
   "excerpt":"Un drone a été aperçu en fin de journée.","published_at":"2026-08-02T08:00:00Z",
   "territory_ids":["dep-13"]}
]$j$::jsonb) = 6, 'ingestion : 7 éléments dont 1 doublon → 6 articles');

select test.assert(public.ingest_threats($j$[
  {"kind":"cyberattaque","severity":"critique","title":"Rançongiciel visant un CHU",
   "summary":"Alerte CERT-FR sur une campagne.","url":"https://cert.example/t1",
   "source_id":"00000000-0000-0000-0000-0000000000a2","published_at":"2026-09-20T08:00:00Z",
   "actors":["LockBit"],"sectors":["santé"],"cve_ids":["cve-2026-0001"],
   "themes":["cybercriminalite"],"territory_ids":["dep-31"],"lat":43.6,"lon":1.44},
  {"kind":"ingerence","severity":"modere","title":"Campagne de désinformation en Corse",
   "url":"https://osint.example/t2","published_at":"2026-07-01T08:00:00Z",
   "actors":["Acteur X"],"themes":["ingerences-etrangeres"],"territory_ids":["dep-2B"]}
]$j$::jsonb) = 2, 'ingestion de 2 menaces');

select test.assert(public.ingest_datasets($j$[
  {"id":"ds1","title":"Qualité de l'air en Occitanie","description":"Mesures horaires des polluants atmosphériques.",
   "producer":"Atmo Occitanie","license":"Licence Ouverte","formats":["CSV","JSON"],
   "url":"https://data.gouv.fr/d/ds1","published_at":"2026-10-01T00:00:00Z",
   "territory_ids":["reg-76"],"themes":["ecologie"],"tags":["air","pollution"]},
  {"id":"ds2","title":"Budget des communes de PACA","description":"Comptes des communes.",
   "producer":"DGFiP","license":"Licence Ouverte","formats":["xlsx"],
   "url":"https://data.gouv.fr/d/ds2","published_at":"2026-03-01T00:00:00Z",
   "territory_ids":["reg-93"],"themes":["economie"]},
  {"id":"ds3","title":"Registre des drones","description":"Aéronefs circulant sans pilote.",
   "producer":"DGAC","license":"ODbL","formats":["csv"],
   "url":"https://data.gouv.fr/d/ds3","published_at":"2026-06-01T00:00:00Z","themes":["drones"]}
]$j$::jsonb) = 3, 'ingestion de 3 jeux de données');

select test.as_owner();

-- ---------------------------------------------------------------- données ingérées
select test.assert((select themes from public.articles_rss where url = 'https://exemple.fr/a1') = array['cybercriminalite','sante'],
  'thème inconnu ignoré à l''ingestion');
select test.assert((select territory_ids from public.articles_rss where url = 'https://exemple.fr/a1')
                    = array['com-31555','dep-31','epci-243100518','reg-76','zds-sud'],
  'territoires étendus à la lignée complète (commune → EPCI, département, région, zone)');
select test.assert((select entities from public.articles_rss where url = 'https://exemple.fr/a1') = array['hopital purpan'],
  'entités normalisées (minuscules, sans accents, dédoublonnées)');
select test.assert((select cve_ids from public.threats where url = 'https://cert.example/t1') = array['CVE-2026-0001'],
  'identifiants CVE mis en majuscules');

-- ---------------------------------------------------------------- vue d'ensemble
select test.assert(test.n('{}') = 11, 'sans filtre : 6 articles + 3 jeux de données + 2 menaces');
select test.assert(test.n('null'::jsonb) = 11, 'paramètres null JSON acceptés');
select test.assert(test.n(null) = 11, 'paramètres null SQL acceptés');
select test.assert(test.n('{"kinds":["article"]}') = 6, 'kinds = article');
select test.assert(test.n('{"kinds":["dataset"]}') = 3, 'kinds = dataset');
select test.assert(test.n('{"kinds":["threat"]}') = 2, 'kinds = threat');
select test.assert(test.n('{"kinds":["dataset","threat"]}') = 5, 'kinds = dataset + threat');
select test.assert(test.n('{"kinds":["nimporte"]}') = 0, 'kinds invalide → aucun résultat');
select test.expect_error($$select * from public.search_content('[]'::jsonb)$$, 'paramètres non-objet refusés');

-- ---------------------------------------------------------------- texte
select test.assert(test.n('{"q":"elections","kinds":["article"]}') = 1, 'recherche « elections » (sans accent) trouve « Élections »');
select test.assert(test.n('{"q":"ÉLECTIONS","kinds":["article"]}') = 1, 'recherche insensible à la casse et aux accents');
select test.assert(test.n('{"q":"cyberattaques","kinds":["article"]}') = 1, 'lemmatisation : pluriel → singulier');
select test.assert(test.n('{"q":"hopital","kinds":["article"]}') = 1, '« hopital » trouve « hôpital »');
select test.assert(test.n('{"q":"cyberattaque ET hopital","kinds":["article"]}') = 1, 'ET');
select test.assert(test.n('{"q":"cyberattaque hopital","kinds":["article"]}') = 1, 'espace = ET implicite');
select test.assert(test.n('{"q":"cyberattaque SAUF hopital","kinds":["article"]}') = 0, 'SAUF exclut');
select test.assert(test.n('{"q":"cyberattaque SANS hopital","kinds":["article"]}') = 0, 'SANS exclut');
select test.assert(test.n('{"q":"-elections","kinds":["article"]}') = 5, '-mot exclut');
select test.assert(test.n('{"q":"blocage OU elections","kinds":["article"]}') = 2, 'OU');
select test.assert(test.n('{"q":"blocage ou elections","kinds":["article"]}') = 0, '« ou » en minuscules n''est pas un opérateur');
select test.assert(test.n('{"q":"\"hôpital de Toulouse\"","kinds":["article"]}') = 1, 'expression exacte');
select test.assert(test.n('{"q":"\"Toulouse hôpital\"","kinds":["article"]}') = 0, 'expression exacte : l''ordre compte');
select test.assert(test.n('{"q":"\"hôpital de","kinds":["article"]}') = 1, 'guillemet non fermé toléré');
select test.assert(test.n('{"q":"ET","kinds":["article"]}') = 6, 'requête sans mot utile : pas de filtre texte, pas d''erreur');
select test.assert(test.n('{"q":"de la","kinds":["article"]}') = 6, 'requête de mots vides : pas d''erreur');
select test.assert(test.n('{"q":"\"","kinds":["article"]}') = 6, 'guillemet seul toléré');
select test.assert(test.n($j${"q":"'; drop table public.articles_rss; --"}$j$) >= 0
                    and to_regclass('public.articles_rss') is not null, 'tentative d''injection SQL inoffensive');
select test.assert(test.n(jsonb_build_object('q', repeat('mot ', 5000))) >= 0, 'requête très longue tronquée sans erreur');

-- Classement : un mot dans le titre passe avant un mot dans l'extrait
select test.assert((select title from public.search_content('{"q":"drone","kinds":["article"]}') limit 1) like 'Survol%',
  'classement par pertinence : titre avant extrait');
select test.assert((select title from public.search_content('{"q":"drone","kinds":["article"],"sort":"date"}') limit 1) like 'Incident%',
  'tri par date : le plus récent d''abord');
select test.assert(test.n('{"q":"drone"}') = 3, 'recherche unifiée « drone » : 2 articles + 1 jeu de données');
select test.assert(
  (select array_agg(kind order by ord) from (select kind, row_number() over () as ord from public.search_content('{"q":"drone"}')) s)
  = array['article','dataset','article'] or
  (select array_agg(kind order by ord) from (select kind, row_number() over () as ord from public.search_content('{"q":"drone"}')) s)
  = array['dataset','article','article'],
  'les deux correspondances dans le titre passent avant celle de l''extrait');

-- ---------------------------------------------------------------- territoires
select test.assert(test.n('{"territories":["reg-76"],"kinds":["article"]}') = 2, 'région Occitanie : 2 articles');
select test.assert(test.n('{"territories":["dep-31"],"kinds":["article"]}') = 1, 'département 31 : 1 article');
select test.assert(test.n('{"territories":["com-31555"],"kinds":["article"]}') = 1, 'commune de Toulouse : 1 article');
select test.assert(test.n('{"territories":["epci-243100518"],"kinds":["article"]}') = 1, 'EPCI : 1 article');
select test.assert(test.n('{"territories":["zds-sud"],"kinds":["article"]}') = 6, 'zone de défense Sud : les 6 articles (Occitanie, PACA, Corse)');
select test.assert(test.n('{"territories":["zds-sud-ouest"],"kinds":["article"]}') = 0, 'zone Sud-Ouest : aucun');
select test.assert(test.n('{"territories":["reg-94"],"kinds":["article"]}') = 1, 'Corse : 1 article');
select test.assert(test.n('{"territories":["reg-94","reg-76"],"kinds":["article"]}') = 3, 'plusieurs territoires = OU');
select test.assert(test.n('{"postal_code":"31000","kinds":["article"]}') = 1, 'code postal 31000 → Toulouse');
select test.assert(test.n('{"postal_code":"13001","kinds":["article"]}') = 1, 'code postal 13001 → Marseille');
select test.assert(test.n('{"postal_code":"99999"}') = 0, 'code postal inconnu → aucun résultat');
select test.assert(test.n('{"postal_code":"31000","territories":["reg-94"],"kinds":["article"]}') = 2, 'code postal + territoire = union');
select test.assert(test.n('{"territories":["reg-76"],"q":"elections","kinds":["article"]}') = 1, 'territoire + texte');

-- ---------------------------------------------------------------- thèmes, entités, dates
select test.assert(test.n('{"themes":["blocage"],"kinds":["article"]}') = 1, 'thème blocage');
select test.assert(test.n('{"themes":["blocage","greve"],"kinds":["article"]}') = 1, 'thèmes = OU, sans doublon');
select test.assert(test.n('{"themes":["drones"]}') = 2, 'thème drones : 1 article + 1 jeu de données');
select test.assert(test.n('{"entities":["Hôpital Purpan"]}') = 1, 'entité normalisée (casse, accents)');
select test.assert(test.n('{"entities":["lockbit"]}') = 1, 'entité = acteur d''une menace');
select test.assert(test.n('{"date_from":"2026-09-01","kinds":["article"]}') = 2, 'date_from');
select test.assert(test.n('{"date_to":"2026-02-01","kinds":["article"]}') = 1, 'date_to');
select test.assert(test.n('{"date_from":"2026-05-01","date_to":"2026-06-01","kinds":["article"]}') = 1, 'fenêtre de dates');
select test.assert(test.n('{"ingested_after":"2000-01-01"}') = 11, 'ingested_after (curseur des alertes) : tout');
select test.assert(test.n('{"ingested_after":"2099-01-01"}') = 0, 'ingested_after : rien de plus récent');

-- ---------------------------------------------------------------- rayon GPS
select test.assert(test.n('{"lat":43.6047,"lon":1.4437,"radius_km":10}') = 2, 'rayon 10 km autour de Toulouse : 1 article + 1 menace');
select test.assert(test.n('{"lat":43.6047,"lon":1.4437,"radius_km":100}') = 2, 'rayon 100 km : Marseille hors rayon');
select test.assert(test.n('{"lat":43.6047,"lon":1.4437,"radius_km":600}') = 3, 'rayon 600 km : Marseille incluse');
select test.assert(test.n('{"lat":43.6047,"lon":1.4437,"radius_km":600,"kinds":["dataset"]}') = 0, 'le rayon exclut les jeux de données');
select test.expect_error($$select * from public.search_content('{"lat":43.6}'::jsonb)$$, 'lat sans lon ni rayon refusé');
select test.expect_error($$select * from public.search_content('{"lat":143.6,"lon":1,"radius_km":5}'::jsonb)$$, 'latitude invalide refusée');
select test.expect_error($$select * from public.search_content('{"lat":43.6,"lon":1,"radius_km":-5}'::jsonb)$$, 'rayon négatif refusé');

-- ---------------------------------------------------------------- filtres propres à un type
select test.assert(test.n('{"licence":"Licence Ouverte"}') = 2, 'licence : jeux de données seulement');
select test.assert(test.n('{"formats":["CSV"]}') = 2, 'format (insensible à la casse)');
select test.assert(test.n('{"producer":"atmo occitanie"}') = 1, 'producteur (insensible à la casse)');
select test.assert(test.n('{"severities":["critique"]}') = 1, 'sévérité critique');
select test.assert(test.n('{"threat_kinds":["ingerence"]}') = 1, 'type de menace');
select test.assert(test.n('{"content_types":["article"]}') = 6, 'type de contenu : articles seulement');
select test.assert(test.n('{"sources":["00000000-0000-0000-0000-0000000000a1"]}') = 1, 'filtre par source');
select test.assert(test.n('{"sources":["00000000-0000-0000-0000-0000000000a2"]}') = 1, 'source d''une menace');
select test.assert((select source_name from public.search_content('{"q":"hopital"}') limit 1) = 'Presse régionale test', 'nom de la source renvoyé');
select test.assert((select source_name from public.search_content('{"licence":"ODbL"}') limit 1) = 'DGAC', 'producteur renvoyé comme source pour un jeu de données');

-- ---------------------------------------------------------------- pagination
select test.assert(test.n('{"limit":4}') = 4, 'limit 4');
select test.assert(test.n('{"limit":1000}') = 11, 'limit plafonné à 50');
select test.assert(test.n('{"limit":0}') = 1, 'limit minimal = 1');
select test.assert(
  (select count(distinct kind || id) from (
     select * from public.search_content('{"limit":4,"offset":0}')
     union all select * from public.search_content('{"limit":4,"offset":4}')
     union all select * from public.search_content('{"limit":4,"offset":8}')) p) = 11,
  'pagination : 3 pages, 11 résultats distincts sans chevauchement');

-- ---------------------------------------------------------------- anonyme : lecture seule autorisée
select test.as_anon();
select test.assert(test.n('{"q":"elections"}') >= 1, 'un visiteur non connecté peut rechercher');
select test.as_owner();

-- ---------------------------------------------------------------- autocomplétion des territoires
select test.assert((select id from public.search_territories('toul') limit 1) = 'com-31555', 'autocomplétion « toul » → Toulouse');
select test.assert((select id from public.search_territories('TOULOUSE') limit 1) = 'com-31555', 'nom exact prioritaire');
select test.assert((select id from public.search_territories('ile de') limit 1) = 'reg-11', '« ile de » → Île-de-France (sans accent)');
select test.assert(exists (select 1 from public.search_territories('haute garonne') where id = 'dep-31'), 'tolérance aux fautes de ponctuation');
select test.assert(exists (select 1 from public.search_territories('2A') where id = 'dep-2A'), 'code département 2A');
select test.assert((select id from public.search_territories('31000') limit 1) = 'com-31555', 'code postal exact');
select test.assert((select id from public.search_territories('ajac') limit 1) = 'com-2A004', 'préfixe « ajac » → Ajaccio');
select test.assert(not exists (select 1 from public.search_territories('a')), '1 caractère : aucun résultat');
select test.assert(not exists (select 1 from public.search_territories('%%')), 'jokers LIKE échappés');
select test.assert(not exists (select 1 from public.search_territories('toul', array['dep'])), 'filtre par type');
select test.assert(exists (select 1 from public.search_territories('toulouse', array['epci'])), 'filtre par type : EPCI');
select test.assert((select count(*) from public.search_territories('a', null, 5)) = 0
                    and (select count(*) from public.search_territories('sa', null, 3)) <= 3, 'limite respectée');

-- ---------------------------------------------------------------- index réellement utilisés
select test.assert(test.uses_index($$select id from public.articles_rss where fts @@ private.parse_search_query('cyberattaque')$$, 'articles_fts_gin'), 'index plein texte (articles)');
select test.assert(test.uses_index($$select id from public.articles_rss where territory_ids && array['dep-31']$$, 'articles_territory_gin'), 'index territoires');
select test.assert(test.uses_index($$select id from public.articles_rss where themes && array['drones']$$, 'articles_themes_gin'), 'index thèmes');
select test.assert(test.uses_index($$select id from public.articles_rss where entities && array['lockbit']$$, 'articles_entities_gin'), 'index entités');
select test.assert(test.uses_index($$select id from public.articles_rss order by published_at desc limit 5$$, 'articles_published_idx'), 'index de date');
select test.assert(test.uses_index($$select id from public.articles_rss where extensions.earth_box(extensions.ll_to_earth(43.6,1.44), 10000) @> extensions.ll_to_earth(lat, lon)$$, 'articles_geo_gist'), 'index géographique (rayon GPS)');
select test.assert(test.uses_index($$select id from public.threats where extensions.earth_box(extensions.ll_to_earth(43.6,1.44), 10000) @> extensions.ll_to_earth(lat, lon)$$, 'threats_geo_gist'), 'index géographique (menaces)');
select test.assert(test.uses_index($$select id from public.threats where severity = 'critique' order by published_at desc$$, 'threats_severity_idx'), 'index sévérité des menaces');
select test.assert(test.uses_index($$select id from public.datasets_datagouv where fts @@ private.parse_search_query('drone')$$, 'datasets_fts_gin'), 'index plein texte (jeux de données)');
select test.assert(test.uses_index($$select id from public.datasets_datagouv where formats && array['csv']$$, 'datasets_formats_gin'), 'index formats');
select test.assert(test.uses_index($$select id from public.datasets_datagouv where lower(producer) = 'dgfip'$$, 'datasets_producer_idx'), 'index producteur');
select test.assert(test.uses_index($$select id from public.territories where private.immutable_unaccent(lower(name)) like 'toul%'$$, 'territories_name_trgm'), 'index trigramme des noms de territoires');
select test.assert(test.uses_index($$select id from public.territories where postal_codes @> array['31000']$$, 'territories_postal_gin'), 'index des codes postaux');
select test.assert(test.uses_index($$insert into public.articles_rss (url, title) values ('https://exemple.fr/a1','x') on conflict (url_hash) do nothing$$, 'articles_rss_url_hash_key'), 'dédoublonnage par url_hash indexé');

rollback;
