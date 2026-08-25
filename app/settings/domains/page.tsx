import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkDomainDns, recordDomainCheck, verificationRecordName } from "@/lib/domains/verify";

export const dynamic = "force-dynamic";

/**
 * A hostname, not a URL and not an email address: labels of alphanumerics and
 * hyphens, at least two of them, no leading/trailing dot.
 */
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4)
  .max(253)
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "must be a bare domain like example.com"
  );

async function addDomain(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/domains");

  const parsed = domainSchema.safeParse(String(formData.get("domain") ?? ""));
  if (!parsed.success) redirect("/settings/domains?error=bad-domain");

  // The unique constraint on domains.domain is what actually prevents two
  // accounts claiming the same name; RLS hides the conflicting row, so the
  // error code is the only signal available here.
  const { error } = await supabase
    .from("domains")
    .insert({ owner_id: user.id, domain: parsed.data });

  if (error) {
    redirect(`/settings/domains?error=${error.code === "23505" ? "taken" : "add-failed"}`);
  }
  revalidatePath("/settings/domains");
}

/**
 * Owner-triggered "Check now". Ownership is proven with the user-scoped
 * client first (RLS returns nothing for someone else's domain); only then
 * does the admin client write the status transition, which users are not
 * permitted to write themselves.
 */
async function checkDomain(formData: FormData) {
  "use server";

  const domainId = String(formData.get("domain_id") ?? "");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/domains");

  const { data: domain } = await supabase
    .from("domains")
    .select("id, domain, verification_token")
    .eq("id", domainId)
    .maybeSingle();
  if (!domain) redirect("/settings/domains?error=unknown-domain");

  const check = await checkDomainDns(domain.domain, domain.verification_token);
  await recordDomainCheck(createAdminClient(), domain.id, check);

  revalidatePath("/settings/domains");
  redirect(`/settings/domains?checked=${check.result}`);
}

/**
 * Local part of a new mailbox address. A pragmatic subset of RFC 5321:
 * alphanumerics with dots, underscores, hyphens and plus inside — the shapes
 * providers actually deliver to.
 */
const localPartSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/, "invalid mailbox name");

async function addMailbox(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/domains");

  const domainId = String(formData.get("domain_id") ?? "");
  const parsed = localPartSchema.safeParse(String(formData.get("local_part") ?? ""));
  if (!parsed.success) redirect("/settings/domains?error=bad-mailbox");

  // RLS returns nothing for a domain the user doesn't own; verified status is
  // re-checked by the mailbox insert policy, so this read is for the address.
  const { data: domain } = await supabase
    .from("domains")
    .select("id, domain, status")
    .eq("id", domainId)
    .maybeSingle();
  if (!domain) redirect("/settings/domains?error=unknown-domain");
  if (domain.status !== "verified") redirect("/settings/domains?error=not-verified");

  // First mailbox becomes the default sender in compose.
  const { count } = await supabase
    .from("mailboxes")
    .select("id", { head: true, count: "exact" });

  const { error } = await supabase.from("mailboxes").insert({
    owner_id: user.id,
    domain_id: domain.id,
    address: `${parsed.data}@${domain.domain}`,
    is_default: (count ?? 0) === 0,
  });

  if (error) {
    redirect(
      `/settings/domains?error=${error.code === "23505" ? "mailbox-taken" : "mailbox-failed"}`
    );
  }
  revalidatePath("/settings/domains");
}

const ERROR_MESSAGES: Record<string, string> = {
  "bad-domain": "Enter a bare domain like example.com — no https://, no @.",
  taken: "That domain is already claimed on Letters.",
  "add-failed": "The domain could not be added. Try again.",
  "unknown-domain": "That domain is not on your account.",
  "bad-mailbox": "Mailbox names are letters and numbers, with . _ - + inside.",
  "not-verified": "Verify the domain before creating mailboxes on it.",
  "mailbox-taken": "That address already exists.",
  "mailbox-failed": "The mailbox could not be created. Try again.",
};

const CHECK_MESSAGES: Record<string, string> = {
  verified: "Verified — you can create mailboxes on this domain now.",
  not_found: "No TXT record found yet. DNS changes can take up to an hour to appear.",
  mismatch: "A TXT record exists but its value does not match. Check for a typo.",
  dns_error: "The DNS lookup failed. That says nothing about your record — try again shortly.",
};

const STATUS_HELP: Record<string, string> = {
  pending: "Not checked yet.",
  verifying: "Waiting for the TXT record to appear in DNS.",
  failed: "A record was found but did not match. Fix it and check again.",
  verified: "Verified.",
};

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: { error?: string; checked?: string };
}) {
  const supabase = createClient();
  const { data: domains } = await supabase
    .from("domains")
    .select("id, domain, status, verification_token, verified_at, last_checked_at")
    .order("created_at", { ascending: false });

  const rows = domains ?? [];

  const { data: mailboxes } = await supabase
    .from("mailboxes")
    .select("id, domain_id, address, is_default")
    .order("created_at", { ascending: true });
  const mailboxesByDomain = new Map<string, { id: string; address: string; is_default: boolean }[]>();
  for (const m of mailboxes ?? []) {
    const list = mailboxesByDomain.get(m.domain_id) ?? [];
    list.push(m);
    mailboxesByDomain.set(m.domain_id, list);
  }
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : null;
  const checkMessage = searchParams.checked ? CHECK_MESSAGES[searchParams.checked] : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/inbox" className="text-sm text-accent underline">
        ← Inbox
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Domains</h1>
      <p className="mt-1 text-sm text-muted">
        Host Letters on a domain you own. Verification is a DNS TXT record.{" "}
        <Link href="/settings/suppression" className="text-accent underline">
          Do-not-send list
        </Link>
      </p>

      {errorMessage && (
        <p className="mt-4 rounded-md border border-border px-3 py-2 text-sm text-muted">
          {errorMessage}
        </p>
      )}
      {checkMessage && (
        <p className="mt-4 rounded-md border border-border px-3 py-2 text-sm text-muted">
          {checkMessage}
        </p>
      )}

      <form action={addDomain} className="mt-6 flex gap-2">
        <input
          name="domain"
          required
          placeholder="example.com"
          className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Add domain
        </button>
      </form>

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

              <p className="mt-1 text-xs text-muted">{STATUS_HELP[d.status] ?? ""}</p>

              {d.status !== "verified" && (
                <>
                  <p className="mt-2 break-all text-xs text-muted">
                    Add a TXT record at <code>{verificationRecordName(d.domain)}</code> with value{" "}
                    <code>{d.verification_token}</code>
                  </p>
                  <form action={checkDomain} className="mt-3">
                    <input type="hidden" name="domain_id" value={d.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                    >
                      Check now
                    </button>
                  </form>
                </>
              )}

              {d.last_checked_at && (
                <p className="mt-2 text-xs text-muted">
                  Last checked {new Date(d.last_checked_at).toLocaleString()}
                </p>
              )}

              {d.status === "verified" && (
                <div className="mt-3">
                  {(mailboxesByDomain.get(d.id) ?? []).length > 0 && (
                    <ul className="mb-2 text-sm">
                      {(mailboxesByDomain.get(d.id) ?? []).map((m) => (
                        <li key={m.id} className="py-0.5">
                          {m.address}
                          {m.is_default && (
                            <span className="ml-2 text-xs uppercase tracking-wide text-muted">
                              default
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <form action={addMailbox} className="flex items-center gap-2">
                    <input type="hidden" name="domain_id" value={d.id} />
                    <input
                      name="local_part"
                      required
                      placeholder="you"
                      className="w-32 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm"
                    />
                    <span className="text-sm text-muted">@{d.domain}</span>
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                    >
                      Add mailbox
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
