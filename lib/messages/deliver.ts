/**
 * Inbound delivery core, shared by every path that receives mail — the
 * generic HMAC seam (POST /api/mail/inbound) and provider adapters (Resend).
 *
 * Callers hold the service-role client because there is no user session on
 * any inbound path. Authorization lives HERE and nowhere looser: the
 * recipient address resolves to a mailbox, and both mailbox_id and owner_id
 * come from that lookup, never from the payload.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface InboundMail {
  to: string;
  from: string;
  from_name?: string | null;
  subject?: string;
  body_text?: string;
  body_html?: string | null;
  message_id: string;
  in_reply_to?: string | null;
  received_at?: string | null;
}

export type DeliveryOutcome = "delivered" | "duplicate" | "no-mailbox" | "error";

export async function deliverInbound(
  admin: SupabaseClient,
  mail: InboundMail
): Promise<{ outcome: DeliveryOutcome; detail?: string }> {
  const { data: mailbox, error: mailboxError } = await admin
    .from("mailboxes")
    .select("id, owner_id")
    .eq("address", mail.to)
    .maybeSingle();

  if (mailboxError) {
    return { outcome: "error", detail: `mailbox lookup failed: ${mailboxError.message}` };
  }
  if (!mailbox) {
    return { outcome: "no-mailbox" };
  }

  // Redelivery is normal for mail. The unique index on (mailbox_id,
  // message_id) turns a repeat into 23505 instead of a duplicate in the
  // user's inbox.
  const { error: insertError } = await admin.from("messages").insert({
    mailbox_id: mailbox.id,
    owner_id: mailbox.owner_id,
    direction: "inbound",
    folder: "inbox",
    message_id: mail.message_id,
    in_reply_to: mail.in_reply_to ?? null,
    from_address: mail.from,
    from_name: mail.from_name ?? null,
    subject: mail.subject ?? "",
    body_text: mail.body_text ?? "",
    body_html: mail.body_html ?? null,
    received_at: mail.received_at ?? new Date().toISOString(),
  });

  if (insertError) {
    if (insertError.code === "23505") return { outcome: "duplicate" };
    return { outcome: "error", detail: `insert failed: ${insertError.message}` };
  }
  return { outcome: "delivered" };
}
