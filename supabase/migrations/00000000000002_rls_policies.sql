-- Letters — row level security
--
-- Default posture: every table denies everything, then each policy grants the
-- narrowest thing that works. A user reaches only their own rows; there is no
-- policy anywhere that lets one user read another's mail.
--
-- The inbound-mail webhook has no user session, so it uses the service-role
-- key and bypasses RLS. That path does its own authorization: it resolves the
-- recipient address to a mailbox and writes only into that mailbox.

alter table public.profiles           enable row level security;
alter table public.domains            enable row level security;
alter table public.mailboxes          enable row level security;
alter table public.messages           enable row level security;
alter table public.message_recipients enable row level security;
alter table public.attachments        enable row level security;
alter table public.audit_logs         enable row level security;

-- profiles -------------------------------------------------------------------
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert policy: profiles are created by the on_auth_user_created trigger,
-- which is security definer. Users must not mint their own.

-- domains --------------------------------------------------------------------
create policy "domains: read own"
  on public.domains for select
  using (auth.uid() = owner_id);

create policy "domains: insert own"
  on public.domains for insert
  with check (auth.uid() = owner_id);

create policy "domains: update own"
  on public.domains for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "domains: delete own"
  on public.domains for delete
  using (auth.uid() = owner_id);

-- mailboxes ------------------------------------------------------------------
create policy "mailboxes: read own"
  on public.mailboxes for select
  using (auth.uid() = owner_id);

-- A mailbox may only be attached to a domain the same user owns and has
-- verified -- otherwise a user could claim an address on someone else's domain.
create policy "mailboxes: insert own on verified own domain"
  on public.mailboxes for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.domains d
      where d.id = domain_id
        and d.owner_id = auth.uid()
        and d.status = 'verified'
    )
  );

create policy "mailboxes: update own"
  on public.mailboxes for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "mailboxes: delete own"
  on public.mailboxes for delete
  using (auth.uid() = owner_id);

-- messages -------------------------------------------------------------------
create policy "messages: read own"
  on public.messages for select
  using (auth.uid() = owner_id);

-- Users compose outbound mail. Inbound arrives via the service-role webhook,
-- so this policy deliberately refuses direction = 'inbound': a user must not be
-- able to forge a received message.
create policy "messages: insert own outbound"
  on public.messages for insert
  with check (
    auth.uid() = owner_id
    and direction = 'outbound'
    and exists (
      select 1 from public.mailboxes m
      where m.id = mailbox_id and m.owner_id = auth.uid()
    )
  );

create policy "messages: update own"
  on public.messages for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "messages: delete own"
  on public.messages for delete
  using (auth.uid() = owner_id);

-- message_recipients ---------------------------------------------------------
-- Reachable only through a message the user already owns.
create policy "recipients: read via own message"
  on public.message_recipients for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.owner_id = auth.uid()
    )
  );

create policy "recipients: insert via own message"
  on public.message_recipients for insert
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.owner_id = auth.uid()
    )
  );

create policy "recipients: delete via own message"
  on public.message_recipients for delete
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.owner_id = auth.uid()
    )
  );

-- attachments ----------------------------------------------------------------
create policy "attachments: read via own message"
  on public.attachments for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.owner_id = auth.uid()
    )
  );

create policy "attachments: insert via own message"
  on public.attachments for insert
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.owner_id = auth.uid()
    )
  );

create policy "attachments: delete via own message"
  on public.attachments for delete
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.owner_id = auth.uid()
    )
  );

-- audit_logs -----------------------------------------------------------------
-- Readable by the actor, never writable by them: an audit trail a user can
-- edit is not an audit trail. Writes go through the service-role client.
create policy "audit: read own"
  on public.audit_logs for select
  using (auth.uid() = actor_id);
