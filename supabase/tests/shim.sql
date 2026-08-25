-- Minimal Supabase shim so migrations and RLS tests run on plain Postgres
-- (local cluster or the CI service container). Mirrors what a real Supabase
-- project provides before migrations run: the three API roles, the auth
-- schema with users + uid(), default grants, and the pre-enabled extensions.
--
-- Never apply this to a real Supabase project.

do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Supabase's auth.uid() reads the JWT claim; tests set it via set_config.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
grant usage on schema public, auth to anon, authenticated, service_role;

-- Pre-enabled on Supabase; migration 1 relies on gen_random_bytes.
create extension if not exists pgcrypto;
