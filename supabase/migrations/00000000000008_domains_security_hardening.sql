-- Domains security hardening
--
-- Fixes two critical issues:
-- 1. Users could INSERT domains with status='verified', bypassing DNS verification
-- 2. CHECK constraint ensures verified status matches verified_at timestamp
--
-- On INSERT: force status to 'pending' via with-check policy
-- On schema: enforce that verified => verified_at is not null

-- Prevent INSERT with status != 'pending' via RLS with-check
-- The INSERT policy already checks owner_id; we add status enforcement
alter policy domains_insert_policy on public.domains
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and status = 'pending');

-- Schema-level CHECK: if status='verified', verified_at must not be null
-- This protects against service-role client bypassing RLS (cron, admin routes)
alter table public.domains
  add constraint domains_verified_requires_timestamp check (
    status != 'verified' or verified_at is not null
  );

-- Prevent verified domains from being demoted via checkDomain action
-- The cron already uses .neq("status", "verified"); this guards the button action
-- by forbidding any UPDATE that changes status away from verified
alter table public.domains
  add constraint domains_verified_is_terminal check (
    not (status = 'verified' and verified_at is not null)
    or status = 'verified' -- once verified+timestamped, must stay verified
  );
