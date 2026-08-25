/**
 * Translation from Resend's receiving API shape to the delivery core's
 * InboundMail. Pure and defensive: the upstream shape is <1 year old and
 * loosely documented, so every field access tolerates strings, objects,
 * arrays or absence, and the output is always a complete seam payload.
 */
import type { InboundMail } from "@/lib/messages/deliver";

type MaybeAddress = string | { name?: string | null; address?: string | null; email?: string | null } | null | undefined;

export interface ResendReceivedEmail {
  message_id?: string | null;
  from?: MaybeAddress;
  to?: MaybeAddress[] | MaybeAddress;
  cc?: MaybeAddress[] | MaybeAddress;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | { name?: string; value?: string }[] | null;
  created_at?: string | null;
}

/** "Jane Doe <jane@x.com>" → { address, name }; bare addresses pass through. */
export function parseAddress(raw: MaybeAddress): { address: string; name: string | null } | null {
  if (!raw) return null;
  if (typeof raw === "object") {
    const address = raw.address ?? raw.email ?? null;
    if (!address) return null;
    return { address: address.trim().toLowerCase(), name: raw.name?.trim() || null };
  }
  const match = raw.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (match) {
    return { address: match[2].toLowerCase(), name: match[1]?.trim() || null };
  }
  const bare = raw.trim();
  if (/^[^\s@]+@[^\s@]+$/.test(bare)) return { address: bare.toLowerCase(), name: null };
  return null;
}

function toList(value: ResendReceivedEmail["to"]): MaybeAddress[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function headerValue(
  headers: ResendReceivedEmail["headers"],
  name: string
): string | null {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h?.name?.toLowerCase() === wanted && h.value) return h.value;
    }
    return null;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && value) return value;
  }
  return null;
}

export interface TranslatedInbound {
  /** Everything but the recipient; deliver once per recipient below. */
  base: Omit<InboundMail, "to">;
  /** Unique lowercased recipient addresses (To + Cc). */
  recipients: string[];
}

export function translateReceivedEmail(
  email: ResendReceivedEmail,
  webhookEmailId: string
): TranslatedInbound {
  const from = parseAddress(email.from) ?? { address: "unknown@invalid", name: null };

  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...toList(email.to), ...toList(email.cc)]) {
    const parsed = parseAddress(raw);
    if (parsed && !seen.has(parsed.address)) {
      seen.add(parsed.address);
      recipients.push(parsed.address);
    }
  }

  // A Message-ID must exist for idempotent redelivery. Prefer the parsed
  // field, then the raw header, then a deterministic id from Resend's own —
  // deterministic, so a webhook retry still dedupes.
  const messageId =
    email.message_id ||
    headerValue(email.headers, "message-id") ||
    `<resend-${webhookEmailId}@inbound.letters>`;

  return {
    base: {
      from: from.address,
      from_name: from.name,
      subject: email.subject ?? "",
      body_text: email.text ?? "",
      body_html: email.html ?? null,
      message_id: messageId,
      in_reply_to: headerValue(email.headers, "in-reply-to"),
      received_at: email.created_at ?? null,
    },
    recipients,
  };
}
