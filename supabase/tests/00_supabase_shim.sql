-- Émule, sur un Postgres vierge, les éléments de Supabase dont dépendent les
-- migrations : rôles de l'API, schéma auth, auth.uid(), privilèges par défaut.
-- Utilisé uniquement pour les tests locaux (supabase/tests/run.sh).

-- Les rôles sont globaux au serveur : on ne les crée que s'ils n'existent pas
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema auth;
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Identité de l'appelant : lue dans les claims JWT, comme PostgREST le fait
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), '')::uuid
$$;

create schema if not exists extensions;
grant usage on schema auth, public, extensions to anon, authenticated, service_role;

-- Supabase accorde par défaut tous les droits sur les nouveaux objets du schéma public
alter default privileges for role postgres in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;

-- Cadre de test : petites fonctions d'assertion
create schema test;
grant usage on schema test to anon, authenticated, service_role;

create function test.assert(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'ÉCHEC : %', p_label;
  end if;
  raise notice 'ok   - %', p_label;
end;
$$;

-- Passe en identité « utilisateur connecté » (ou anon) jusqu'à la fin de la transaction
create function test.as_user(p_uid uuid, p_role text default 'authenticated') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

create function test.as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;

create function test.as_service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
end;
$$;

create function test.as_owner() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

-- Vérifie qu'une instruction est REFUSÉE (erreur ou permission) dans le rôle courant
create function test.expect_error(p_sql text, p_label text) returns void
language plpgsql as $$
declare
  v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'ok   - refusé (%) : %', v_state, p_label;
    return;
  end;
  raise exception 'ÉCHEC : devait être refusé : %', p_label;
end;
$$;
