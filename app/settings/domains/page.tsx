import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const supabase = createClient();
  const { data: domains } = await supabase
    .from("domains")
    .select("id, domain, status, verification_token, verified_at")
    .order("created_at", { ascending: false });

  const rows = domains ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Domains</h1>
      <p className="mt-1 text-sm text-muted">
        Host Letters on a domain you own. Verification is a DNS TXT record.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No domains yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {rows.map((d) => (
            <li key={d.id} className="py-4">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{d.domain}</span>
                <span className="text-xs uppercase tracking-wide text-muted">{d.status}</span>
              </div>
              {d.status !== "verified" && (
                <p className="mt-2 break-all text-xs text-muted">
                  Add a TXT record at <code>_letters.{d.domain}</code> with value{" "}
                  <code>{d.verification_token}</code>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
