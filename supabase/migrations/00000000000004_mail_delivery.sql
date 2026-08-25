-- Letters — mail delivery: outbound attempts, suppression, DNS verification
--
-- Additive to migrations 1–3. Three new append-mostly tables plus two
-- column-level hardening fixes to existing policies:
--
--   send_attempts                  one row per hand-off of an outbound message
--                                  to a mail provider
--   suppression_list               addresses an owner must not send to
--   domain_verification_attempts   log of DNS TXT checks per domain
--
-- Hardening: the broad `for update` policies on domains, messages and
-- mailboxes let an owner update *any* column of their own rows. That allowed
--   (a) flipping domains.status to 'verified' without ever publishing the TXT
--       record — claim google.com, self-verify, mint mailboxes on it; and
--   (b) updating messages.direction to 'inbound', forging a received message
--       that the insert policy correctly refuses.
-- RLS cannot restrict columns, but grants can: update rights are revoked and
-- re-granted only for the columns a user legitimately edits.

-- ---------------------------------------------------------------------------
-- send_attempts
-- ---------------------------------------------------------------------------
create type public.send_status as enum ('accepted', 'failed', 'suppressed', 'skipped');

create table public.send_attempts (
  id                  uuid primary key default uuid_generate_v4(),
  message_id          uuid not null references public.messages (id) on delete cascade,
  attempt             smallint not null default 1 check (attempt >= 1),
  provider            text not null,
  status              public.send_status not null,
  -- The provider's own id for the accepted message (e.g. Resend's `id`).
  provider_message_id text,
  error               text,
  created_at          timestamptz not null default now()
);
create index send_attempts_message_id_idx on public.send_attempts (message_id, created_at desc);

-- ---------------------------------------------------------------------------
-- suppression_list
--
-- Scoped per owner, not global: one creator's unsubscribes must not leak into
-- or affect another creator's audience. reason 'manual' is the only kind a
-- user may write; bounce/complaint/unsubscribe rows come from provider
-- webhooks through the service role, so the ledger stays honest.
-- ---------------------------------------------------------------------------
create type public.suppression_reason as enum ('bounce', 'complaint', 'unsubscribe', 'manual');

create table public.suppression_list (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid   not null references public.profiles (id) on delete cascade,
  address    citext not null,
  reason     public.suppression_reason not null,
  -- Where this row came from: 'user', or a provider event id for audit.
  source     text,
  created_at timestamptz not null default now(),
  unique (owner_id, address)
);
create index suppression_list_owner_idx on public.suppression_list (owner_id);

-- ---------------------------------------------------------------------------
-- domain_verification_attempts
-- ---------------------------------------------------------------------------
create type public.verification_result as enum ('verified', 'not_found', 'mismatch', 'dns_error');

create table public.domain_verification_attempts (
  id         uuid primary key default uuid_generate_v4(),
  domain_id  uuid not null references public.domains (id) on delete cascade,
  result     public.verification_result not null,
  -- TXT values found at _letters.<domain>, for support/debugging. These are
  -- public DNS data, not user content.
  found_records jsonb not null default '[]'::jsonb,
  error      text,
  checked_at timestamptz not null default now()
);
create index domain_verification_attempts_domain_idx
  on public.domain_verification_attempts (domain_id, checked_at desc);

-- The verification job picks the least-recently-checked unverified domains.
alter table public.domains add column last_checked_at timestamptz;
create index domains_status_checked_idx on public.domains (status, last_checked_at nulls first)
  where status <> 'verified';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.send_attempts                enable row level security;
alter table public.suppression_list             enable row level security;
alter table public.domain_verification_attempts enable row level security;

-- send_attempts: readable through a message the user owns; written only by
-- the service-role dispatch path. A delivery ledger a user can edit is not a
-- delivery ledger.
create policy "send_attempts: read via own message"
  on public.send_attempts for select
  using (
    exists (
      select 1 from public.messages m
      -- Qualified deliberately: unqualified message_id would capture
      -- messages.message_id (text) inside this subquery, not our column.
      where m.id = send_attempts.message_id and m.owner_id = auth.uid()
    )
  );

-- suppression_list: owners manage manual entries; provider-derived entries
-- (bounce/complaint/unsubscribe) arrive via the service role.
create policy "suppression: read own"
  on public.suppression_list for select
  using (auth.uid() = owner_id);

create policy "suppression: insert own manual"
  on public.suppression_list for insert
  with check (auth.uid() = owner_id and reason = 'manual');

create policy "suppression: delete own manual"
  on public.suppression_list for delete
  using (auth.uid() = owner_id and reason = 'manual');

-- domain_verification_attempts: readable through a domain the user owns;
-- written only by the service-role verification job.
create policy "dva: read via own domain"
  on public.domain_verification_attempts for select
  using (
    exists (
      select 1 from public.domains d
      where d.id = domain_verification_attempts.domain_id and d.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Column-level hardening of existing tables
--
-- Supabase grants ALL on public tables to authenticated by default. Revoke
-- update and re-grant only the columns users legitimately change. The
-- existing `for update` RLS policies still apply on top of these grants.
-- ---------------------------------------------------------------------------

-- domains: nothing on a domain row is user-editable after creation. Status
-- transitions belong to the verification job (service role). Without this, an
-- owner could set status='verified' by hand and mint mailboxes on a domain
-- they do not control.
revoke update on public.domains from authenticated, anon;

-- messages: users file messages (folder) and mark them read. Everything else
-- — direction above all — is immutable to them. Without this, an owner could
-- rewrite direction='inbound' and forge a received message.
revoke update on public.messages from authenticated, anon;
grant update (folder, is_read) on public.messages to authenticated;

-- mailboxes: choosing a default is the only user-side edit.
revoke update on public.mailboxes from authenticated, anon;
grant update (is_default) on public.mailboxes to authenticated;
