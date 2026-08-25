/**
 * Resend webhook endpoint — the single URL configured in Resend's dashboard.
 *
 *   email.received            → fetch body, deliver via the shared core
 *   email.bounced/complained  → suppression_list rows for the recipients,
 *                               attributed through the delivery ledger
 *   anything else             → acknowledged and ignored
 *
 * All events are Svix-signed (RESEND_INBOUND_WEBHOOK_SECRET). The generic
 * HMAC seam (/api/mail/inbound) is unchanged for other relays.
 *
 * Response policy: 2xx for everything that must not be retried (ignored
 * types, foreign recipients, duplicates, unattributable bounces); 5xx only
 * when our side genuinely failed, so Resend's retries do useful work.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { deliverInbound } from "@/lib/messages/deliver";
import { verifySvixSignature } from "@/lib/mail/svix";
import {
  parseAddress,
  suppressionReasonFor,
  translateReceivedEmail,
  type ResendReceivedEmail,
} from "@/lib/mail/resend-inbound";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 1_000_000;
const RECEIVING_API = "https://api.resend.com/emails/receiving";

const WebhookEvent = z.object({
  type: z.string(),
  data: z
    .object({
      email_id: z.string().min(1).optional(),
      to: z.unknown().optional(),
    })
    .passthrough(),
});

export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.RESEND_INBOUND_WEBHOOK_SECRET || !env.RESEND_API_KEY) {
    // A deployment without the secrets gets a disabled endpoint, not an
    // open one — same posture as the verification cron.
    return NextResponse.json({ error: "resend webhook is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const verification = verifySvixSignature(
    rawBody,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    env.RESEND_INBOUND_WEBHOOK_SECRET
  );
  if (!verification.valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "body is not valid JSON" }, { status: 400 });
  }
  const event = WebhookEvent.safeParse(payload);
  if (!event.success) {
    return NextResponse.json({ error: "invalid event shape" }, { status: 400 });
  }

  const { type, data } = event.data;

  if (type === "email.received") {
    if (!data.email_id) {
      return NextResponse.json({ error: "missing email_id" }, { status: 400 });
    }
    return handleReceived(data.email_id, env.RESEND_API_KEY);
  }

  const reason = suppressionReasonFor(type);
  if (reason) {
    return handleSuppressionEvent(reason, data, request.headers.get("svix-id"));
  }

  return NextResponse.json({ status: "ignored", type });
}

async function handleReceived(emailId: string, apiKey: string): Promise<NextResponse> {
  let email: ResendReceivedEmail;
  try {
    const response = await fetch(`${RECEIVING_API}/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Retryable from Resend's side: the email may not be readable yet.
      return NextResponse.json(
        { error: `receiving api returned ${response.status}` },
        { status: 502 }
      );
    }
    const body = (await response.json()) as { data?: ResendReceivedEmail } & ResendReceivedEmail;
    email = body.data ?? body;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const { base, recipients } = translateReceivedEmail(email, emailId);
  if (recipients.length === 0) {
    return NextResponse.json({ status: "no recipients" });
  }

  const admin = createAdminClient();
  const outcomes: Record<string, string> = {};
  let hardFailure = false;
  for (const to of recipients) {
    const { outcome, detail } = await deliverInbound(admin, { ...base, to });
    outcomes[to] = outcome;
    if (outcome === "error") {
      hardFailure = true;
      console.error(`resend webhook delivery failed for ${to}: ${detail}`);
    }
  }

  // Any real failure → 500 so Resend retries; deliverInbound's idempotency
  // makes the retry safe for the recipients that already landed.
  return NextResponse.json(
    { status: hardFailure ? "partial" : "ok", outcomes },
    { status: hardFailure ? 500 : 200 }
  );
}

/**
 * A bounce/complaint names recipients of one of OUR sends. Attribution runs
 * through the delivery ledger: data.email_id is the id Resend returned when
 * we sent, recorded as send_attempts.provider_message_id, which leads to the
 * message's owner — whose suppression list the recipients land on. An event
 * we cannot attribute is acknowledged, not retried: reprocessing will never
 * make it attributable.
 */
async function handleSuppressionEvent(
  reason: "bounce" | "complaint",
  data: { email_id?: string; to?: unknown },
  eventId: string | null
): Promise<NextResponse> {
  if (!data.email_id) {
    return NextResponse.json({ status: "ignored", detail: "no email_id" });
  }

  const rawRecipients = Array.isArray(data.to) ? data.to : data.to != null ? [data.to] : [];
  const addresses = rawRecipients
    .map((r) => parseAddress(r as string))
    .filter((r): r is NonNullable<ReturnType<typeof parseAddress>> => r !== null)
    .map((r) => r.address);
  if (addresses.length === 0) {
    return NextResponse.json({ status: "ignored", detail: "no recipients" });
  }

  const admin = createAdminClient();

  const { data: attempt, error: attemptError } = await admin
    .from("send_attempts")
    .select("message_id")
    .eq("provider_message_id", data.email_id)
    .limit(1)
    .maybeSingle();
  if (attemptError) {
    return NextResponse.json({ error: "ledger lookup failed" }, { status: 500 });
  }
  if (!attempt) {
    return NextResponse.json({ status: "ignored", detail: "unattributable" });
  }

  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("owner_id")
    .eq("id", attempt.message_id)
    .maybeSingle();
  if (messageError || !message) {
    return NextResponse.json({ error: "owner lookup failed" }, { status: 500 });
  }

  const { error: upsertError } = await admin.from("suppression_list").upsert(
    addresses.map((address) => ({
      owner_id: message.owner_id,
      address,
      reason,
      source: eventId ? `resend:${eventId}` : "resend",
    })),
    { onConflict: "owner_id,address", ignoreDuplicates: true }
  );
  if (upsertError) {
    return NextResponse.json({ error: "suppression write failed" }, { status: 500 });
  }

  return NextResponse.json({ status: "suppressed", reason, count: addresses.length });
}
