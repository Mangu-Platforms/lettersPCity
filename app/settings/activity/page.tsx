import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The operator-truth view: what actually happened, from the ledgers.
 * Everything here is an RLS-scoped read — send_attempts through owned
 * messages, verification attempts through owned domains — so this page
 * needs no service role and can never show anyone else's activity.
 */

const STATUS_LABELS: Record<string, string> = {
  accepted: "accepted by provider",
  failed: "failed",
  suppressed: "suppressed",
  skipped: "skipped (no provider)",
};

const RESULT_LABELS: Record<string, string> = {
  verified: "verified",
  not_found: "record not found",
  mismatch: "value mismatch",
  dns_error: "DNS error",
};

interface AttemptRow {
  id: string;
  attempt: number;
  provider: string;
  status: string;
  error: string | null;
  created_at: string;
  messages: { id: string; subject: string; from_address: string } | null;
}

interface CheckRow {
  id: string;
  result: string;
  error: string | null;
  checked_at: string;
  domains: { domain: string } | null;
}

export default async function ActivityPage() {
  const supabase = createClient();

  const [{ data: sends }, { data: checks }] = await Promise.all([
    supabase
      .from("send_attempts")
      .select("id, attempt, provider, status, error, created_at, messages!inner(id, subject, from_address)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("domain_verification_attempts")
      .select("id, result, error, checked_at, domains!inner(domain)")
      .order("checked_at", { ascending: false })
      .limit(50),
  ]);

  const sendRows = (sends ?? []) as unknown as AttemptRow[];
  const checkRows = (checks ?? []) as unknown as CheckRow[];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-1 text-sm text-muted">
        Delivery hand-offs and domain checks, as recorded — not as hoped.
      </p>

      <h2 className="mt-8 text-lg font-medium">Deliveries</h2>
      {sendRows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No delivery attempts yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {sendRows.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <span>
                  {row.messages ? (
                    <Link href={`/inbox/${row.messages.id}`} className="underline">
                      {row.messages.subject || "(no subject)"}
                    </Link>
                  ) : (
                    "(message removed)"
                  )}
                </span>
                <time className="shrink-0 text-xs text-muted">
                  {new Date(row.created_at).toLocaleString()}
                </time>
              </div>
              <div className="text-xs text-muted">
                {row.messages?.from_address} · attempt {row.attempt} via {row.provider} ·{" "}
                {STATUS_LABELS[row.status] ?? row.status}
                {row.error ? ` — ${row.error}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-lg font-medium">Domain checks</h2>
      {checkRows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No verification checks yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {checkRows.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
              <span>
                {row.domains?.domain} · {RESULT_LABELS[row.result] ?? row.result}
                {row.error ? <span className="text-muted"> — {row.error}</span> : null}
              </span>
              <time className="shrink-0 text-xs text-muted">
                {new Date(row.checked_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
