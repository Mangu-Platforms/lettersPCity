/**
 * Domain ownership verification.
 *
 * A domain proves ownership by publishing the row's verification_token as a
 * DNS TXT record at _letters.<domain>. The check itself is pure string work
 * over resolver output (evaluateTxtRecords), the resolver is injectable for
 * tests, and the job core (verifyPendingDomains) drives the status machine:
 *
 *   pending    never checked
 *   verifying  checked, record not there yet — keep polling
 *   failed     a _letters TXT exists but with the wrong value: the user
 *              pasted something, and it's wrong. Actionable, so distinct.
 *   verified   token found; terminal (job never re-checks verified domains)
 *
 * DNS errors keep the current status: an outage tells us nothing about
 * ownership. Every check — whatever the outcome — lands one row in
 * domain_verification_attempts and bumps domains.last_checked_at.
 */
import { resolveTxt as nodeResolveTxt } from "node:dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";

export function verificationRecordName(domain: string): string {
  return `_letters.${domain}`;
}

export type TxtEvaluation =
  | { result: "verified"; found: string[] }
  | { result: "not_found"; found: string[] }
  | { result: "mismatch"; found: string[] };

/**
 * DNS TXT values arrive as arrays of chunks (a single logical record longer
 * than 255 bytes is split); each record's chunks are joined before compare.
 * Tokens are public once published, so plain comparison is fine here.
 */
export function evaluateTxtRecords(records: string[][], expectedToken: string): TxtEvaluation {
  const found = records.map((chunks) => chunks.join("").trim()).filter((v) => v.length > 0);
  if (found.length === 0) return { result: "not_found", found };
  if (found.includes(expectedToken.trim())) return { result: "verified", found };
  return { result: "mismatch", found };
}

export type ResolveTxt = (hostname: string) => Promise<string[][]>;

export type DnsCheck =
  | TxtEvaluation
  | { result: "dns_error"; found: string[]; error: string };

const NO_RECORD_CODES = new Set(["ENOTFOUND", "ENODATA"]);

export async function checkDomainDns(
  domain: string,
  expectedToken: string,
  resolveTxt: ResolveTxt = nodeResolveTxt
): Promise<DnsCheck> {
  try {
    const records = await resolveTxt(verificationRecordName(domain));
    return evaluateTxtRecords(records, expectedToken);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "";
    if (NO_RECORD_CODES.has(code)) {
      // The name simply doesn't exist yet — the normal state before the user
      // publishes the record, not an error.
      return { result: "not_found", found: [] };
    }
    return {
      result: "dns_error",
      found: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** What a check outcome does to domains.status. null = leave unchanged. */
export function nextDomainStatus(check: DnsCheck["result"]): "verified" | "verifying" | "failed" | null {
  switch (check) {
    case "verified":
      return "verified";
    case "not_found":
      return "verifying";
    case "mismatch":
      return "failed";
    case "dns_error":
      return null;
  }
}

export interface VerifyJobSummary {
  checked: number;
  verified: number;
  waiting: number;
  failed: number;
  errors: number;
}

interface PendingDomainRow {
  id: string;
  domain: string;
  verification_token: string;
}

/**
 * Runs one batch of checks. Callers hold the service-role client: status
 * transitions are deliberately not user-writable (see migration 4), so this
 * job — and the settings page's owner-scoped "check now" action — are the
 * only writers.
 */
export async function verifyPendingDomains(
  admin: SupabaseClient,
  { limit = 20, resolveTxt = nodeResolveTxt }: { limit?: number; resolveTxt?: ResolveTxt } = {}
): Promise<VerifyJobSummary> {
  const { data: domains, error } = await admin
    .from("domains")
    .select("id, domain, verification_token")
    .neq("status", "verified")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`pending domain query failed: ${error.message}`);

  const summary: VerifyJobSummary = { checked: 0, verified: 0, waiting: 0, failed: 0, errors: 0 };

  for (const row of (domains ?? []) as PendingDomainRow[]) {
    const check = await checkDomainDns(row.domain, row.verification_token, resolveTxt);
    await recordDomainCheck(admin, row.id, check);

    summary.checked += 1;
    if (check.result === "verified") summary.verified += 1;
    else if (check.result === "not_found") summary.waiting += 1;
    else if (check.result === "mismatch") summary.failed += 1;
    else summary.errors += 1;
  }

  return summary;
}

/** Persists one check: an attempts row plus the domain's status transition. */
export async function recordDomainCheck(
  admin: SupabaseClient,
  domainId: string,
  check: DnsCheck
): Promise<void> {
  const { error: attemptError } = await admin.from("domain_verification_attempts").insert({
    domain_id: domainId,
    result: check.result,
    found_records: check.found,
    error: "error" in check ? check.error : null,
  });
  if (attemptError) {
    throw new Error(`verification attempt insert failed: ${attemptError.message}`);
  }

  const status = nextDomainStatus(check.result);
  const update: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
  if (status) update.status = status;
  if (status === "verified") update.verified_at = new Date().toISOString();

  const { error: updateError } = await admin.from("domains").update(update).eq("id", domainId);
  if (updateError) {
    throw new Error(`domain status update failed: ${updateError.message}`);
  }
}
