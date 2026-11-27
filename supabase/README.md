# Base de données Supabase — ÉTAPE 3

Schéma PostgreSQL de veille-osint : tables, recherche plein texte, sécurité (RLS), fonctions d'ingestion et de hachage.
**Rien de ce dossier n'est appliqué automatiquement** : les migrations sont des fichiers, à appliquer dans l'ordre sur le projet Supabase après validation.

## Contenu

| Dossier | Rôle |
|---|---|
| `migrations/` | 7 fichiers numérotés, à appliquer dans l'ordre |
| `seed/` | Chargement des EPCI et communes depuis l'API officielle geo.api.gouv.fr |
| `tests/` | 340 vérifications automatiques (structure, recherche, sécurité, ingestion, chargement géo) |

### Migrations

1. `…100000_extensions_and_helpers` — extensions (`pg_trgm`, `unaccent`, `cube`, `earthdistance`, `pgcrypto`) dans le schéma `extensions`, schéma privé `private`, configuration de recherche française sans accents `public.fr_unaccent`, utilitaires de conversion sûrs.
2. `…100100_reference_tables` — `themes` (45) et `territories` (zones, régions, départements, EPCI, communes, collectivités d'outre-mer).
3. `…100200_core_tables` — `profiles`, `sources_rss`, `source_fetch_state`, `articles_rss`, `datasets_datagouv`, `threats` (colonne `fts` générée + index GIN, doublons impossibles via `url_hash`).
4. `…100300_user_tables` — `searches`, `alerts`, `favorites` avec quotas (20 alertes, 1 000 favoris, 50 recherches enregistrées, historique limité à 100).
5. `…100400_functions` — recherche (`search_content`, `search_territories`, `resolve_postal_code`), ingestion (`ingest_articles/threats/datasets`), `purge_old_content`, RGPD (`export_my_data`, `delete_my_account`), `hash_secret` / `verify_secret`.
6. `…100500_rls_and_grants` — RLS sur **toutes** les tables, droits colonne par colonne, et un garde-fou qui fait échouer la migration si une table n'a pas de RLS.
7. `…100600_seed_reference` — 45 thèmes, 7 zones de défense et de sécurité, 18 régions, 101 départements, 6 collectivités d'outre-mer.

## Lancer les tests en local

Il faut un PostgreSQL 15 ou 16 (pas de Docker nécessaire) et ces variables :

```bash
export PGHOST=/chemin/socket PGPORT=5432 PGUSER=postgres
bash supabase/tests/run.sh
```

Le script recrée une base `veille_test`, y installe une doublure minimale de Supabase (rôles `anon` / `authenticated` / `service_role`, `auth.users`, `auth.uid()`), applique les migrations puis tous les `*.test.sql`. Il s'arrête à la première assertion fausse.

## Appliquer sur Supabase (après validation)

1. Appliquer les 7 migrations dans l'ordre (SQL editor ou outil MCP `apply_migration`).
2. Charger les communes : exécuter `seed/run_communes.sql`. Le script installe l'extension `http`, appelle geo.api.gouv.fr pour Occitanie (76), PACA (93) et Corse (94), puis retire l'extension. Le résultat JSON donne `communes_recues` et `communes_importees` : **ils doivent être égaux**, sinon des communes ont été rejetées. Ce chargement n'a été testé qu'avec une fausse API (Internet est bloqué dans l'environnement de développement) : à vérifier au premier lancement réel.
3. Lancer les contrôles de sécurité et de performance de Supabase (`get_advisors`).
4. Réglages à faire dans le tableau de bord (pas faisables en SQL) : *Authentication → Providers → Email* : confirmation d'e-mail activée, longueur minimale du mot de passe à 10 ou plus.

## Devenir administrateur

Un utilisateur ne peut pas se promouvoir lui-même (la colonne `role` n'est pas modifiable par lui). Après inscription, depuis le SQL editor :

```sql
update public.profiles set role = 'admin' where id = '<uuid de l''utilisateur>';
```

## Points ouverts

- **Zones de défense et de sécurité (ZDS)** : rattachements vérifiés pour Occitanie, PACA, Corse et la majorité des régions. Ceux de Normandie, Centre-Val de Loire, Bourgogne-Franche-Comté et de l'outre-mer n'ont pas pu être confirmés par une source officielle. Correction éventuelle : `update public.territories set parent_id = 'zds-…' where id = 'reg-…';`.
- **Mots de passe** : Supabase Auth hache déjà les mots de passe (bcrypt). `hash_secret` / `verify_secret` (bcrypt, coût 12) servent pour d'autres secrets éventuels ; ils ne sont exécutables que par `service_role`.

## Budget de stockage (mesuré)

Mesure faite sur 50 000 articles, 20 000 jeux de données et 5 000 menaces synthétiques (texte réaliste en longueur, vocabulaire de 6 000 mots) :

| Table | Octets par ligne (données + index) | 
|---|---|
| `articles_rss` | ≈ 2 800 (dont ≈ 700 d'index) |
| `datasets_datagouv` | ≈ 2 900 |
| `threats` | ≈ 3 500 |

Le plan gratuit offre 500 Mo, dont environ 50 Mo occupés par les schémas internes de Supabase. Pour garder une marge, viser **≈ 300 Mo de contenu** :

- 100 000 articles ≈ 280 Mo → sert de plafond ; à 300 articles par jour, cela représente environ 11 mois.
- Au-delà de ≈ 300 articles par jour, raccourcir la rétention : `select public.purge_old_content(p_articles_months => 6);`. Les favoris ne sont jamais purgés.
- Les chiffres réels varieront avec la longueur des extraits (± 30 %).

## Latence de recherche (mesurée en local, 75 000 lignes)

| Requête | Temps |
|---|---|
| mot rare (300 résultats) | ≈ 11 ms |
| mot moyen (5 000 résultats) | ≈ 55 ms |
| deux termes `ET` | ≈ 70 ms |
| `OU` + filtre département | ≈ 40 ms |
| filtres seuls (région + thème + date) | ≈ 90 ms |
| rayon GPS 30 km | ≈ 50 ms |
| mot présent dans 97 % des articles (cas extrême) | ≈ 200 à 300 ms |

Sur le plan gratuit, le processeur est partagé : compter 2 à 3 fois plus.
