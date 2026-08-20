/**
 * Health endpoint.
 *
 *   GET /api/health          -> liveness. Cheap, no dependencies.
 *   GET /api/health?ready=1  -> readiness. Actually touches Supabase.
 *
 * Readiness must not be a lie: it runs a real query, and reports not-ready if
 * that query fails.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const wantsReadiness = new URL(request.url).searchParams.get("ready") === "1";

  if (!wantsReadiness) {
    return NextResponse.json({ status: "ok" });
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" });
    checks.database = error ? { ok: false, detail: error.message } : { ok: true };
  } catch (err) {
    checks.database = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  try {
    // Touching serverEnv() proves the server secrets validated at boot.
    const { serverEnv } = await import("@/lib/env");
    serverEnv();
    checks.env = { ok: true };
  } catch (err) {
    checks.env = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  const ready = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ready, checks }, { status: ready ? 200 : 503 });
}
