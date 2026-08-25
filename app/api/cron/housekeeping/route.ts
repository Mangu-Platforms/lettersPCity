/**
 * Housekeeping cron.
 *
 *   GET /api/cron/housekeeping
 *
 * Retention enforcement (docs/RISKS.md R-4): messages that have sat in
 * trash for TRASH_RETENTION_DAYS are deleted for real — recipients and
 * attachments follow by ON DELETE CASCADE. The clock is messages.trashed_at,
 * maintained by trigger (migration 7), so restores reset it and no
 * application path can forget it.
 *
 * Same authentication posture as the verify cron: bearer CRON_SECRET,
 * constant-time compare, disabled (503) when unset. Service-role client:
 * there is no user on this path, and the deletion predicate is folder +
 * age, never identity.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TRASH_RETENTION_DAYS = 30;

function bearerMatches(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const { CRON_SECRET } = serverEnv();
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; housekeeping is disabled" },
      { status: 503 }
    );
  }
  if (!bearerMatches(request.headers.get("authorization"), CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .delete()
    .eq("folder", "trash")
    .lt("trashed_at", cutoff)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: "ok", purged: data?.length ?? 0, cutoff });
}
