-- Letters — hardening from the Supabase security advisors (first live deploy)
--
-- Every item here is a WARN the database linter raised against the deployed
-- schema; each fix is stated with the attack it forecloses.

-- handle_new_user is SECURITY DEFINER and, under Supabase's default grants,
-- was callable by anon and authenticated through /rest/v1/rpc/. The function
-- body is harmless when fired by its trigger, but a callable definer function
-- is API surface nobody asked for. Triggers fire as the table owner, so the
-- trigger keeps working with all API execute rights revoked.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Same posture for the touch trigger helper: not an API.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Functions without a pinned search_path resolve names through the caller's
-- path — a hijack vector if any writable schema precedes pg_catalog. Pin to
-- empty: both functions already qualify (or don't need) everything;
-- pg_catalog is always implicitly first.
alter function public.touch_updated_at() set search_path = '';
alter function public.search_messages(text, public.message_folder, int, int) set search_path = '';

-- citext landed in public because migration 1 didn't name a schema. Move it
-- to the extensions schema (standard on Supabase; created here for plain
-- Postgres). Existing citext columns bind by OID and are unaffected; unquoted
-- `citext` in future SQL still resolves because Supabase's default
-- search_path includes extensions.
create schema if not exists extensions;
alter extension citext set schema extensions;
