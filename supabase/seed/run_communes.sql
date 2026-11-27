-- Charge les EPCI et communes d'Occitanie (76), PACA (93) et Corse (94).
-- À exécuter une fois, après les migrations (SQL editor Supabase ou MCP).
-- Pour ajouter une région plus tard, relancer avec son code (ex. '84').
-- Idempotent : rejouer met simplement les données à jour.

create extension if not exists http with schema extensions;

\ir communes_function.sql

select private.seed_territories_from_geo_api(array['76', '93', '94']);

-- L'extension n'est utile que pour ce chargement : on la retire ensuite.
drop function private.seed_territories_from_geo_api(text[]);
drop extension http;
