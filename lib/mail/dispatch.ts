/**
 * Outbound dispatch: suppression check → provider hand-off → ledger row.
 *
 * The decision core (planDispatch) is pure so tests cover it without a
 * database. The shell records exactly what happened in send_attempts and
 * never throws into the compose path: a provider outage must not lose the
 * user's message, which is already persisted in Sent.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { noopProvider } from "./noop";
import { createResendProvider } from "./resend";
import { planDispatch, type Recipient } from "./plan";
import type { MailProvider, OutboundMessage } from "./provider";

export type { Recipient, RecipientKind, DispatchPlan } from "./plan";
export { planDispatch } from "./plan";

export function getProvider(): MailProvider {
  const env = serverEnv();
  if (env.MAIL_PROVIDER === "resend") {
    // The env schema already refuses MAIL_PROVIDER=resend without a key; the
    // non-null assertion here is backed by that refinement.
    return createResendProvider(env.RESEND_API_KEY!);
  }
  return noopProvider;
}

export type DispatchOutcome = "accepted" | "failed" | "suppressed" | "skipped";

export interface DispatchInput {
  /** Row id of the already-persisted outbound message. */
  messageRowId: string;
  /** Owner whose suppression list applies. */
  ownerId: string;
  from: OutboundMessage["from"];
  recipients: Recipient[];
  subject: string;
  text: string;
  html?: string;
  messageId: string;
  inReplyTo?: string;
}

/**
 * Uses the service-role client: send_attempts is deliberately not
 * user-writable (a delivery ledger a user can edit is not a ledger), and the
 * suppression read must see provider-written rows. Authorization: callers
 * pass a messageRowId they created for ownerId in this same request.
 */
export async function dispatchOutbound(input: DispatchInput): Promise<DispatchOutcome> {
  const admin = createAdminClient();

  let outcome: DispatchOutcome;
  let provider = "none";
  let providerMessageId: string | null = null;
  let error: string | null = null;

  try {
    const addresses = input.recipients.map((r) => r.address);
    const { data: suppressionRows, error: suppressionError } = await admin
      .from("suppression_list")
      .select("address")
      .eq("owner_id", input.ownerId)
      .in("address", addresses);
    if (suppressionError) {
      throw new Error(`suppression lookup failed: ${suppressionError.message}`);
    }

    const plan = planDispatch(
      input.recipients,
      (suppressionRows ?? []).map((row) => String(row.address))
    );

    if (plan.deliverable.length === 0) {
      outcome = "suppressed";
      error = `all recipients suppressed: ${plan.suppressed.join(", ")}`;
    } else {
      const mailProvider = getProvider();
      provider = mailProvider.name;

      // Split recipients by kind, then promote cc into to if to is empty.
      // Some providers require a non-empty to field; we keep the original kind
      // for the ledger but ensure sendable payload.
      const toList = plan.deliverable
        .filter((r) => r.kind === "to")
        .map((r) => r.address);
      const ccList = plan.deliverable
        .filter((r) => r.kind === "cc")
        .map((r) => r.address);
      const bccList = plan.deliverable
        .filter((r) => r.kind === "bcc")
        .map((r) => r.address);

      // If all To recipients were suppressed but Cc survives, promote the first Cc
      // into the To field so the provider payload is valid. This ensures the Cc
      // recipient actually receives the mail even when the To list empties via suppression.
      if (toList.length === 0 && ccList.length > 0) {
        toList.push(ccList.shift()!);
      }

      const result = await mailProvider.send({
        from: input.from,
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: input.subject,
        text: input.text,
        html: input.html,
        messageId: input.messageId,
        inReplyTo: input.inReplyTo,
      });

      if (result.ok) {
        outcome = result.simulated ? "skipped" : "accepted";
        providerMessageId = result.providerMessageId;
        if (plan.suppressed.length > 0) {
          error = `withheld suppressed recipients: ${plan.suppressed.join(", ")}`;
        }
      } else {
        outcome = "failed";
        error = result.error;
      }
    }
  } catch (err) {
    outcome = "failed";
    error = err instanceof Error ? err.message : String(err);
  }

  const { count } = await admin
    .from("send_attempts")
    .select("id", { head: true, count: "exact" })
    .eq("message_id", input.messageRowId);

  const { error: ledgerError } = await admin.from("send_attempts").insert({
    message_id: input.messageRowId,
    attempt: (count ?? 0) + 1,
    provider,
    status: outcome,
    provider_message_id: providerMessageId,
    error,
  });
  if (ledgerError) {
    // The ledger failing must not fail the send; surface it in logs only.
    console.error(`send_attempts insert failed for ${input.messageRowId}: ${ledgerError.message}`);
  }

  return outcome;
}
