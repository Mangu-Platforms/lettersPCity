/**
 * Domain verification cron.
 *
 *   GET /api/domains/verify
 *
 * Vercel Cron calls this on a schedule (vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. The job flips domains to `verified`,
 * which is the gate on creating a mailbox — so this endpoint is the unlock
 * for the whole product loop, and it must not be openly callable: an
 * unauthenticated caller could hammer DNS on every pending domain.
 *
 * No user session here, so it uses the service-role client. Authorization is
 * the shared secret; the job itself only ever reads unverified domains and
 * writes their own verification state.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyPendingDomains } from "@/lib/domains/verify";
import { serverEnv } from "@/lib/env";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function bearerMatches(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const { CRON_SECRET } = serverEnv();

  // Refusing when unset is deliberate: a deployment that forgot the secret
  // gets a disabled job, never an open one.
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; verification cron is disabled" },
      { status: 503 }
    );
  }

  if (!bearerMatches(request.headers.get("authorization"), CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await verifyPendingDomains(createAdminClient());
    return NextResponse.json({ status: "ok", ...summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
