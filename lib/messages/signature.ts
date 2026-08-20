/**
 * HMAC verification for the inbound-mail webhook.
 *
 * Kept separate from the route handler so it can be tested without a database:
 * this is the only thing standing between the public internet and the ability
 * to write into a user's inbox.
 */
import { createHmac, timingSafeEqual } from "crypto";

export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Constant-time comparison. A plain `===` leaks how much of the signature
 * matched via timing, which is enough to forge one byte at a time.
 */
export function signatureIsValid(
  rawBody: string,
  provided: string | null | undefined,
  secret: string
): boolean {
  if (!provided) return false;
  const expected = signPayload(rawBody, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  // timingSafeEqual throws on length mismatch, so that is checked first. The
  // length of a hex SHA-256 digest is not itself a secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
