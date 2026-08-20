-- Letters — initial schema
--
-- Maps to the Session 3 requirements held in the Product Genome:
--   REQ auth/profile      -> profiles
--   REQ custom domain     -> domains
--   REQ inbox/compose     -> mailboxes, messages, message_recipients
--   REQ attachments       -> attachments
--   REQ audit             -> audit_logs
--   REQ search            -> messages.search_vector + GIN index
--
-- RLS is enabled on every table in this migration, not bolted on later.

create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- domains: a custom domain a user has claimed, plus its verification state
-- ---------------------------------------------------------------------------
create type public.domain_status as enum ('pending', 'verifying', 'verified', 'failed');

create table public.domains (
  id                uuid primary key default uuid_generate_v4(),
  owner_id          uuid        not null references public.profiles (id) on delete cascade,
  domain            citext      not null unique,
  status            public.domain_status not null default 'pending',
  -- Random token the user publishes as a DNS TXT record to prove ownership.
  verification_token text       not null default encode(gen_random_bytes(16), 'hex'),
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index domains_owner_id_idx on public.domains (owner_id);

-- ---------------------------------------------------------------------------
-- mailboxes: an address that receives mail (user@their-domain.com)
-- ---------------------------------------------------------------------------
create table public.mailboxes (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid        not null references public.profiles (id) on delete cascade,
  domain_id  uuid        not null references public.domains (id) on delete cascade,
  address    citext      not null unique,
  is_default boolean     not null default false,
  created_at timestamptz not null default now()
);
create index mailboxes_owner_id_idx on public.mailboxes (owner_id);
create index mailboxes_domain_id_idx on public.mailboxes (domain_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create type public.message_folder as enum ('inbox', 'sent', 'archive', 'trash', 'draft', 'spam');
create type public.message_direction as enum ('inbound', 'outbound');

create table public.messages (
  id           uuid primary key default uuid_generate_v4(),
  mailbox_id   uuid        not null references public.mailboxes (id) on delete cascade,
  owner_id     uuid        not null references public.profiles (id) on delete cascade,

  direction    public.message_direction not null,
  folder       public.message_folder    not null default 'inbox',

  -- RFC 5322 Message-ID, used to dedupe redelivery and to thread replies.
  message_id   text        not null,
  in_reply_to  text,
  thread_id    uuid,

  from_address citext      not null,
  from_name    text,
  subject      text        not null default '',
  body_text    text        not null default '',
  body_html    text,

  is_read      boolean     not null default false,
  received_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  -- Full-text search over sender, subject and body. Generated, so it can never
  -- drift out of sync with the columns it indexes.
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(from_address::text, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subject, '')),           'A') ||
    setweight(to_tsvector('english', coalesce(body_text, '')),         'B')
  ) stored
);

-- One copy of a given Message-ID per mailbox: makes webhook redelivery
-- idempotent instead of duplicating the message.
create unique index messages_mailbox_message_id_key on public.messages (mailbox_id, message_id);
create index messages_owner_folder_idx on public.messages (owner_id, folder, received_at desc);
create index messages_thread_idx       on public.messages (thread_id);
create index messages_search_idx       on public.messages using gin (search_vector);

-- ---------------------------------------------------------------------------
-- message_recipients: To/Cc/Bcc, one row each
-- ---------------------------------------------------------------------------
create type public.recipient_kind as enum ('to', 'cc', 'bcc');

create table public.message_recipients (
  id         uuid primary key default uuid_generate_v4(),
  message_id uuid   not null references public.messages (id) on delete cascade,
  kind       public.recipient_kind not null default 'to',
  address    citext not null,
  name       text
);
create index message_recipients_message_id_idx on public.message_recipients (message_id);

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------
create table public.attachments (
  id           uuid primary key default uuid_generate_v4(),
  message_id   uuid        not null references public.messages (id) on delete cascade,
  filename     text        not null,
  content_type text        not null,
  size_bytes   bigint      not null check (size_bytes >= 0),
  storage_path text        not null,
  created_at   timestamptz not null default now()
);
create index attachments_message_id_idx on public.attachments (message_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id         uuid primary key default uuid_generate_v4(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text        not null,
  target     text,
  metadata   jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_id_idx   on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger domains_touch_updated_at before update on public.domains
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile whenever a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
