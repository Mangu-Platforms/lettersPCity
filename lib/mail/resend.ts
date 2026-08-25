/**
 * Resend adapter — plain fetch against POST https://api.resend.com/emails.
 *
 * Deliberately no SDK: the payload is a small stable JSON shape, and a
 * dependency-free adapter keeps the provider seam symmetric (an SES adapter
 * would be the same ~80 lines against a different endpoint).
 *
 * fetchImpl is injectable so tests exercise the real request construction and
 * response mapping without network.
 */
import {
  type MailProvider,
  type OutboundMessage,
  type SendResult,
  formatFromHeader,
  stripHeaderNewlines,
} from "./provider";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

export function buildResendPayload(message: OutboundMessage): Record<string, unknown> {
  const headers: Record<string, string> = {
    "Message-ID": stripHeaderNewlines(message.messageId),
  };
  if (message.inReplyTo) {
    headers["In-Reply-To"] = stripHeaderNewlines(message.inReplyTo);
  }

  const payload: Record<string, unknown> = {
    from: formatFromHeader(message.from),
    to: message.to,
    subject: stripHeaderNewlines(message.subject),
    text: message.text,
    headers,
  };
  if (message.cc?.length) payload.cc = message.cc;
  if (message.bcc?.length) payload.bcc = message.bcc;
  if (message.html) payload.html = message.html;
  return payload;
}

export function createResendProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): MailProvider {
  return {
    name: "resend",

    async send(message: OutboundMessage): Promise<SendResult> {
      let response: Response;
      try {
        response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildResendPayload(message)),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        // Network failure or timeout: the message may not have been seen at
        // all, so a retry is safe and worthwhile.
        return {
          ok: false,
          retryable: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      if (response.ok) {
        let id: string | null = null;
        try {
          const body = (await response.json()) as { id?: string };
          id = body.id ?? null;
        } catch {
          // A 2xx without parseable JSON is still an accepted send.
        }
        return { ok: true, providerMessageId: id };
      }

      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string; name?: string };
        if (body.message) detail = `${detail}: ${body.message}`;
      } catch {
        // Keep the bare status.
      }

      // 429 and 5xx are the provider telling us to come back later; anything
      // else 4xx is our payload's fault and will fail identically on retry.
      const retryable = response.status === 429 || response.status >= 500;
      return { ok: false, retryable, error: detail };
    },
  };
}
