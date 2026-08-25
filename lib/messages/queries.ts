/**
 * Message queries.
 *
 * Every function here runs through the user-scoped Supabase client, so RLS is
 * doing the access control -- these queries do not filter by owner_id
 * themselves, and must not be re-pointed at the admin client.
 */
import { createClient } from "@/lib/supabase/server";

export type Folder = "inbox" | "sent" | "archive" | "trash" | "draft" | "spam";

export interface MessageSummary {
  id: string;
  from_address: string;
  from_name: string | null;
  subject: string;
  body_text: string;
  is_read: boolean;
  received_at: string;
}

const SUMMARY_COLUMNS = "id, from_address, from_name, subject, body_text, is_read, received_at";

export async function listMessages(
  folder: Folder = "inbox",
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<MessageSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(SUMMARY_COLUMNS)
    .eq("folder", folder)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`listMessages failed: ${error.message}`);
  return data ?? [];
}

export async function getMessage(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "*, message_recipients(kind, address, name), attachments(id, filename, content_type, size_bytes), send_attempts(attempt, provider, status, error, created_at)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getMessage failed: ${error.message}`);
  return data;
}

/**
 * Full-text search across sender, subject and body via the search_messages
 * function. That function is security invoker, so RLS still applies.
 */
export async function searchMessages(
  query: string,
  { folder, limit = 20, offset = 0 }: { folder?: Folder; limit?: number; offset?: number } = {}
): Promise<MessageSummary[]> {
  if (!query.trim()) return [];

  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_messages", {
    query,
    folder_filter: folder ?? null,
    result_limit: limit,
    result_offset: offset,
  });

  if (error) throw new Error(`searchMessages failed: ${error.message}`);
  return (data ?? []) as MessageSummary[];
}
