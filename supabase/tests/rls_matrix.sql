-- RLS behavior matrix. Fails loudly: expected-success cases run bare under
-- ON_ERROR_STOP, expected-failure cases catch insufficient_privilege (42501,
-- which covers both missing grants and RLS violations) and raise if the
-- forbidden thing was allowed. Run via scripts/db-check.sh, never against a
-- real project.
\set ON_ERROR_STOP on

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222');

-- u1 session -----------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- T1: u1 inserts own domain (must succeed)
insert into public.domains (id, owner_id, domain)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'author-one.com');

-- T2: u1 must NOT be able to self-verify the domain
do $$ begin
  begin
    update public.domains set status = 'verified'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'T2 FAILED: user could set their domain to verified';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T3: u1 must NOT create a mailbox on an unverified domain
do $$ begin
  begin
    insert into public.mailboxes (owner_id, domain_id, address)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'max@author-one.com');
    raise exception 'T3 FAILED: mailbox created on unverified domain';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The DNS job's write (service role bypasses RLS) ----------------------------
reset role;
update public.domains set status = 'verified', verified_at = now()
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- T4: mailbox on verified own domain (must succeed)
insert into public.mailboxes (id, owner_id, domain_id, address)
values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'max@author-one.com');

-- T5: outbound message (must succeed)
insert into public.messages (id, mailbox_id, owner_id, direction, folder, message_id, from_address, subject, body_text)
values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'outbound', 'sent', '<t5@letters>', 'max@author-one.com', 'hi', 'body');

-- T6: u1 must NOT insert an inbound message (forged received mail)
do $$ begin
  begin
    insert into public.messages (mailbox_id, owner_id, direction, folder, message_id, from_address, subject, body_text)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'inbound', 'inbox', '<t6@letters>', 'ceo@bank.com', 'forged', 'body');
    raise exception 'T6 FAILED: user inserted an inbound message';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T7: u1 must NOT rewrite direction on an existing message
do $$ begin
  begin
    update public.messages set direction = 'inbound'
    where id = 'cccccccc-0000-0000-0000-000000000001';
    raise exception 'T7 FAILED: user rewrote direction to inbound';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T8: refiling and marking read stays allowed (must succeed)
update public.messages set folder = 'archive', is_read = true
where id = 'cccccccc-0000-0000-0000-000000000001';

-- T9: manual suppression entry (must succeed)
insert into public.suppression_list (owner_id, address, reason)
values ('11111111-1111-1111-1111-111111111111', 'never@example.com', 'manual');

-- T10: u1 must NOT mint provider-reason suppression rows
do $$ begin
  begin
    insert into public.suppression_list (owner_id, address, reason)
    values ('11111111-1111-1111-1111-111111111111', 'fake@example.com', 'bounce');
    raise exception 'T10 FAILED: user wrote a bounce suppression row';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T11: u1 must NOT write the delivery ledger
do $$ begin
  begin
    insert into public.send_attempts (message_id, provider, status)
    values ('cccccccc-0000-0000-0000-000000000001', 'resend', 'accepted');
    raise exception 'T11 FAILED: user wrote send_attempts';
  exception when insufficient_privilege then null;
  end;
end $$;

-- u2 session -----------------------------------------------------------------
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

-- T12: u2 sees none of u1's messages
do $$ declare n int; begin
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'T12 FAILED: u2 sees % foreign messages', n; end if;
end $$;

-- T13: u2 must NOT mint a mailbox on u1's verified domain
do $$ begin
  begin
    insert into public.mailboxes (owner_id, domain_id, address)
    values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'intruder@author-one.com');
    raise exception 'T13 FAILED: mailbox minted on someone else''s domain';
  exception when insufficient_privilege then null;
  end;
end $$;

-- T14: u2 sees none of u1's domains
do $$ declare n int; begin
  select count(*) into n from public.domains;
  if n <> 0 then raise exception 'T14 FAILED: u2 sees % foreign domains', n; end if;
end $$;

-- Ledger readable by its owner ------------------------------------------------
reset role;
insert into public.send_attempts (message_id, provider, status, provider_message_id)
values ('cccccccc-0000-0000-0000-000000000001', 'resend', 'accepted', 're_123');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- T15: u1 reads exactly their one attempt row
do $$ declare n int; begin
  select count(*) into n from public.send_attempts;
  if n <> 1 then raise exception 'T15 FAILED: owner sees % attempt rows, want 1', n; end if;
end $$;

-- T16: trashing starts the retention clock; restoring stops it
update public.messages set folder = 'trash' where id = 'cccccccc-0000-0000-0000-000000000001';
do $$ declare ts timestamptz; begin
  select trashed_at into ts from public.messages where id = 'cccccccc-0000-0000-0000-000000000001';
  if ts is null then raise exception 'T16 FAILED: trashed_at not set on move to trash'; end if;
end $$;
update public.messages set folder = 'inbox' where id = 'cccccccc-0000-0000-0000-000000000001';
do $$ declare ts timestamptz; begin
  select trashed_at into ts from public.messages where id = 'cccccccc-0000-0000-0000-000000000001';
  if ts is not null then raise exception 'T16 FAILED: trashed_at not cleared on restore'; end if;
end $$;

reset role;
select 'RLS_MATRIX_PASSED' as result;
