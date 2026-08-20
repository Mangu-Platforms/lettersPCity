/**
 * Inbound mail webhook.
 *
 * Letters is an email host, but inbound SMTP cannot run on Vercel -- serverless
 * functions have no long-lived listener on port 25. Receiving mail is therefore
 * a separate always-on concern (a provider relay, or a self-hosted MTA), and
 * this endpoint is the seam it delivers through. See docs/INBOUND_MAIL.md.
 *
 * Authentication is an HMAC over the raw body, NOT a session cookie -- there is
 * no user on this path. Because of that it uses the service-role client and
 * bypasses RLS, so it does its own authorization: it resolves the recipient
 * address to a mailbox and writes only into that mailbox.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { signatureIsValid } from "@/lib/messages/signature";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const InboundMessage = z.object({
  to: z.string().email(),
  from: z.string().email(),
  from_name: z.string().optional(),
  subject: z.string().default(""),
  body_text: z.string().default(""),
  body_html: z.string().optional(),
  message_id: z.string().min(1),
  in_reply_to: z.string().optional(),
  received_at: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  // The signature covers the exact bytes sent, so read the body as text and
  // parse afterwards -- re-serializing would change what is being verified.
  const rawBody = await request.text();

  if (!signatureIsValid(rawBody, request.headers.get("x-letters-signature"), serverEnv().INBOUND_MAIL_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "body is not valid JSON" }, { status: 400 });
  }

  const parsed = InboundMessage.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const mail = parsed.data;

  const supabase = createAdminClient();

  const { data: mailbox, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, owner_id")
    .eq("address", mail.to)
    .maybeSingle();

  if (mailboxError) {
    return NextResponse.json({ error: "mailbox lookup failed" }, { status: 500 });
  }
  if (!mailbox) {
    // Not an error on our side: nothing here accepts mail for that address.
    return NextResponse.json({ error: "no such mailbox" }, { status: 404 });
  }

  // Redelivery is normal for mail. The unique index on (mailbox_id, message_id)
  // makes a repeat a no-op rather than a duplicate in the user's inbox.
  const { error: insertError } = await supabase.from("messages").insert({
    mailbox_id: mailbox.id,
    owner_id: mailbox.owner_id,
    direction: "inbound",
    folder: "inbox",
    message_id: mail.message_id,
    in_reply_to: mail.in_reply_to ?? null,
    from_address: mail.from,
    from_name: mail.from_name ?? null,
    subject: mail.subject,
    body_text: mail.body_text,
    body_html: mail.body_html ?? null,
    received_at: mail.received_at ?? new Date().toISOString(),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ status: "duplicate", delivered: true });
    }
    return NextResponse.json({ error: "delivery failed" }, { status: 500 });
  }

  return NextResponse.json({ status: "delivered" }, { status: 202 });
}
