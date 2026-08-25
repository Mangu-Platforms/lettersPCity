/**
 * Outbound mail provider seam.
 *
 * The app never talks SMTP (mail transfer does not run on Vercel — see
 * docs/INBOUND_MAIL.md). Outbound is a hand-off to a provider API behind
 * this interface, so the provider choice stays reversible: swapping Resend
 * for SES is a new adapter, not a rewrite of the compose path.
 */

export interface OutboundMessage {
  from: { address: string; name?: string };
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  /** RFC 5322 Message-ID minted by the compose path. */
  messageId: string;
  inReplyTo?: string;
}

export type SendResult =
  | {
      ok: true;
      /** The provider's id for the accepted message; null when simulated. */
      providerMessageId: string | null;
      /** True when no real provider is configured and nothing actually left. */
      simulated?: boolean;
    }
  | {
      ok: false;
      /** Whether a retry could plausibly succeed (rate limit, 5xx, network). */
      retryable: boolean;
      error: string;
    };

export interface MailProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<SendResult>;
}

/**
 * Display names go into an RFC 5322 From header on the provider side. Strip
 * the characters that would let a name break out of its position; the address
 * itself is validated separately by the compose path.
 */
export function formatFromHeader(from: OutboundMessage["from"]): string {
  const name = from.name?.replace(/[\r\n<>"]/g, "").trim();
  return name ? `${name} <${from.address}>` : from.address;
}

/** Header values must be single-line; CRLF here is an injection attempt. */
export function stripHeaderNewlines(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}
