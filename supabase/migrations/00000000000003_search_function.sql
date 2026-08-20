-- Full-text message search.
--
-- security invoker (the default) matters here: the function runs as the caller,
-- so RLS on public.messages still applies and a user cannot search another
-- user's mail through it.

create or replace function public.search_messages(
  query text,
  folder_filter public.message_folder default null,
  result_limit int default 20,
  result_offset int default 0
)
returns setof public.messages
language sql
stable
as $$
  select m.*
  from public.messages m
  where m.search_vector @@ websearch_to_tsquery('english', query)
    and (folder_filter is null or m.folder = folder_filter)
  order by ts_rank(m.search_vector, websearch_to_tsquery('english', query)) desc,
           m.received_at desc
  limit least(result_limit, 100)
  offset result_offset;
$$;
