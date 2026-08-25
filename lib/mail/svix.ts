/**
 * Svix webhook signature verification (Resend signs its webhooks this way).
 *
 * Scheme: secret is `whsec_` + base64 key; the signed content is
 * `${svix-id}.${svix-timestamp}.${rawBody}`; the svix-signature header holds
 * space-separated `v1,<base64 hmac>` entries (multiple during secret
 * rotation — any one matching passes). Timestamps outside the window are
 * refused before any comparison.
 *
 * Implemented without the svix SDK: it is ~40 lines, and the dependency-free
 * adapter pattern (see resend.ts) keeps every integration testable with
 * injected inputs.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const SVIX_WINDOW_SECONDS = 300;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export type SvixVerification =
  | { valid: true }
  | { valid: false; reason: "missing-headers" | "bad-secret" | "bad-timestamp" | "stale" | "bad-signature" };

export function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
  nowSeconds: () => number = () => Math.floor(Date.now() / 1000)
): SvixVerification {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { valid: false, reason: "missing-headers" };
  }
  if (!secret.startsWith("whsec_")) return { valid: false, reason: "bad-secret" };

  let key: Buffer;
  try {
    key = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return { valid: false, reason: "bad-secret" };
  }
  if (key.length === 0) return { valid: false, reason: "bad-secret" };

  if (!/^\d{1,12}$/.test(headers.timestamp)) return { valid: false, reason: "bad-timestamp" };
  if (Math.abs(nowSeconds() - Number(headers.timestamp)) > SVIX_WINDOW_SECONDS) {
    return { valid: false, reason: "stale" };
  }

  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest();

  for (const entry of headers.signature.split(" ")) {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) continue;
    let provided: Buffer;
    try {
      provided = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: "bad-signature" };
}
