-- Letters — trash retention mechanism
--
-- "Trash empties after 30 days" needs a fact to measure from: when the
-- message ENTERED trash, which is not received_at. trashed_at is maintained
-- by trigger on the folder transition, so no application path can forget it,
-- and the purge job (GET /api/cron/housekeeping) deletes on
-- trashed_at < now() - interval '30 days'.

alter table public.messages add column trashed_at timestamptz;

create or replace function public.track_trashed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.folder = 'trash' and (old.folder is distinct from 'trash') then
    new.trashed_at = now();
  elsif new.folder <> 'trash' then
    -- Restored from trash: the clock stops.
    new.trashed_at = null;
  end if;
  return new;
end;
$$;

create trigger messages_track_trashed_at before update of folder on public.messages
  for each row execute function public.track_trashed_at();

-- Inserts directly into trash (no path does this today, but the invariant
-- should not depend on that) get the timestamp too.
create or replace function public.track_trashed_at_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.folder = 'trash' and new.trashed_at is null then
    new.trashed_at = now();
  end if;
  return new;
end;
$$;

create trigger messages_track_trashed_at_insert before insert on public.messages
  for each row execute function public.track_trashed_at_insert();

-- The purge job's scan.
create index messages_trash_purge_idx on public.messages (trashed_at)
  where folder = 'trash';

-- Trigger helpers are not API.
revoke execute on function public.track_trashed_at() from public, anon, authenticated;
revoke execute on function public.track_trashed_at_insert() from public, anon, authenticated;
