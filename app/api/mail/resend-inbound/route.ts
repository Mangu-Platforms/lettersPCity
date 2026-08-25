/**
 * Resend inbound adapter.
 *
 *   POST /api/mail/resend-inbound   ← Resend `email.received` webhook (Svix-signed)
 *
 * The webhook carries metadata plus an email_id; the body is fetched from
 * Resend's receiving API, translated (lib/mail/resend-inbound.ts) and handed
 * to the shared delivery core once per recipient we host. The generic HMAC
 * seam (/api/mail/inbound) is unchanged — any other relay still uses it.
 *
 * Response policy: 2xx for everything that must not be retried (ignored
 * event types, foreign recipients, duplicates); 5xx only when a delivery
 * actually failed on our side, so Resend's retries do useful work.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { deliverInbound } from "@/lib/messages/deliver";
import { verifySvixSignature } from "@/lib/mail/svix";
import { translateReceivedEmail, type ResendReceivedEmail } from "@/lib/mail/resend-inbound";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 1_000_000;
const RECEIVING_API = "https://api.resend.com/emails/receiving";

const WebhookEvent = z.object({
  type: z.string(),
  data: z.object({ email_id: z.string().min(1) }).passthrough(),
});

export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.RESEND_INBOUND_WEBHOOK_SECRET || !env.RESEND_API_KEY) {
    // A deployment without the secrets gets a disabled adapter, not an open
    // one — same posture as the verification cron.
    return NextResponse.json({ error: "resend inbound is not configured" }, { status: 503 });
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
  if (event.data.type !== "email.received") {
    return NextResponse.json({ status: "ignored", type: event.data.type });
  }

  const emailId = event.data.data.email_id;

  let email: ResendReceivedEmail;
  try {
    const response = await fetch(`${RECEIVING_API}/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
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
      console.error(`resend-inbound delivery failed for ${to}: ${detail}`);
    }
  }

  // Any real failure → 500 so Resend retries; deliverInbound's idempotency
  // makes the retry safe for the recipients that already landed.
  return NextResponse.json({ status: hardFailure ? "partial" : "ok", outcomes }, {
    status: hardFailure ? 500 : 200,
  });
}
