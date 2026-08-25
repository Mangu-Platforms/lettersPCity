-- Letters — RLS initplan optimization (performance advisor, first deploy)
--
-- Bare auth.uid() in a policy is re-evaluated per row; wrapped in a scalar
-- subselect it becomes an InitPlan evaluated once per query. Semantics are
-- identical — every expression below is the original with only that wrapping
-- (verified by the RLS matrix, which runs unchanged in CI).

-- profiles -------------------------------------------------------------------
alter policy "profiles: read own" on public.profiles
  using ((select auth.uid()) = id);
alter policy "profiles: update own" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- domains --------------------------------------------------------------------
alter policy "domains: read own" on public.domains
  using ((select auth.uid()) = owner_id);
alter policy "domains: insert own" on public.domains
  with check ((select auth.uid()) = owner_id);
alter policy "domains: update own" on public.domains
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
alter policy "domains: delete own" on public.domains
  using ((select auth.uid()) = owner_id);

-- mailboxes ------------------------------------------------------------------
alter policy "mailboxes: read own" on public.mailboxes
  using ((select auth.uid()) = owner_id);
alter policy "mailboxes: insert own on verified own domain" on public.mailboxes
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.domains d
      where d.id = domain_id
        and d.owner_id = (select auth.uid())
        and d.status = 'verified'
    )
  );
alter policy "mailboxes: update own" on public.mailboxes
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
alter policy "mailboxes: delete own" on public.mailboxes
  using ((select auth.uid()) = owner_id);

-- messages -------------------------------------------------------------------
alter policy "messages: read own" on public.messages
  using ((select auth.uid()) = owner_id);
alter policy "messages: insert own outbound" on public.messages
  with check (
    (select auth.uid()) = owner_id
    and direction = 'outbound'
    and exists (
      select 1 from public.mailboxes m
      where m.id = mailbox_id and m.owner_id = (select auth.uid())
    )
  );
alter policy "messages: update own" on public.messages
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
alter policy "messages: delete own" on public.messages
  using ((select auth.uid()) = owner_id);

-- message_recipients ---------------------------------------------------------
alter policy "recipients: read via own message" on public.message_recipients
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_recipients.message_id and m.owner_id = (select auth.uid())
    )
  );
alter policy "recipients: insert via own message" on public.message_recipients
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_recipients.message_id and m.owner_id = (select auth.uid())
    )
  );
alter policy "recipients: delete via own message" on public.message_recipients
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_recipients.message_id and m.owner_id = (select auth.uid())
    )
  );

-- attachments ----------------------------------------------------------------
alter policy "attachments: read via own message" on public.attachments
  using (
    exists (
      select 1 from public.messages m
      where m.id = attachments.message_id and m.owner_id = (select auth.uid())
    )
  );
alter policy "attachments: insert via own message" on public.attachments
  with check (
    exists (
      select 1 from public.messages m
      where m.id = attachments.message_id and m.owner_id = (select auth.uid())
    )
  );
alter policy "attachments: delete via own message" on public.attachments
  using (
    exists (
      select 1 from public.messages m
      where m.id = attachments.message_id and m.owner_id = (select auth.uid())
    )
  );

-- audit_logs -----------------------------------------------------------------
alter policy "audit: read own" on public.audit_logs
  using ((select auth.uid()) = actor_id);

-- send_attempts --------------------------------------------------------------
alter policy "send_attempts: read via own message" on public.send_attempts
  using (
    exists (
      select 1 from public.messages m
      where m.id = send_attempts.message_id and m.owner_id = (select auth.uid())
    )
  );

-- suppression_list -----------------------------------------------------------
alter policy "suppression: read own" on public.suppression_list
  using ((select auth.uid()) = owner_id);
alter policy "suppression: insert own manual" on public.suppression_list
  with check ((select auth.uid()) = owner_id and reason = 'manual');
alter policy "suppression: delete own manual" on public.suppression_list
  using ((select auth.uid()) = owner_id and reason = 'manual');

-- domain_verification_attempts ------------------------------------------------
alter policy "dva: read via own domain" on public.domain_verification_attempts
  using (
    exists (
      select 1 from public.domains d
      where d.id = domain_verification_attempts.domain_id and d.owner_id = (select auth.uid())
    )
  );
