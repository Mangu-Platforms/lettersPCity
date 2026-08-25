/**
 * The no-provider provider. Default in every environment without a mail
 * account configured: the compose path still works end to end, and the
 * send_attempts ledger records the hand-off as `skipped` — never as a lie
 * that something was delivered.
 */
import type { MailProvider, SendResult } from "./provider";

export const noopProvider: MailProvider = {
  name: "noop",
  async send(): Promise<SendResult> {
    return { ok: true, providerMessageId: null, simulated: true };
  },
};
