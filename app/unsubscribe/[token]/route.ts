/**
 * One-click unsubscribe endpoint (RFC 8058).
 *
 *   GET  /unsubscribe/<token>   confirmation page (humans following the link)
 *   POST /unsubscribe/<token>   performs the suppression (mail clients POST
 *                               List-Unsubscribe=One-Click here, no session)
 *
 * The token itself is the authorization: it names one (owner, address) pair
 * and is HMAC-signed (lib/mail/unsubscribe.ts). The write uses the service
 * role because there is no user session on this path — the token's claim is
 * the entire scope of what it can touch. Idempotent: unsubscribing twice is
 * success, not an error.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { parseUnsubscribeToken } from "@/lib/mail/unsubscribe";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function page(body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Letters</title><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem;line-height:1.5">${body}</body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const claim = parseUnsubscribeToken(params.token, serverEnv().INBOUND_MAIL_WEBHOOK_SECRET);
  if (!claim) return page("<p>This unsubscribe link is not valid.</p>");

  return page(
    `<h1 style="font-size:1.25rem">Unsubscribe</h1>
     <p>Stop receiving mail at <strong>${claim.address.replace(/</g, "&lt;")}</strong> from this sender?</p>
     <form method="post"><button type="submit" style="padding:.5rem 1rem">Unsubscribe</button></form>`
  );
}

export async function POST(_request: Request, { params }: { params: { token: string } }) {
  const claim = parseUnsubscribeToken(params.token, serverEnv().INBOUND_MAIL_WEBHOOK_SECRET);
  if (!claim) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("suppression_list").upsert(
    {
      owner_id: claim.ownerId,
      address: claim.address,
      reason: "unsubscribe",
      source: "one-click",
    },
    { onConflict: "owner_id,address", ignoreDuplicates: true }
  );

  // A vanished owner (23503) means there is nothing left to receive from —
  // that is a successful unsubscribe from the recipient's point of view.
  if (error && error.code !== "23503") {
    return NextResponse.json({ error: "unsubscribe failed" }, { status: 500 });
  }
  return page("<p>You have been unsubscribed.</p>");
}
