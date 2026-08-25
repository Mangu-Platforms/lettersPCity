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

/** How far a timestamped request may sit from our clock, either direction. */
export const REPLAY_WINDOW_SECONDS = 300;

export type InboundVerification =
  | { valid: true; scheme: "v1" | "v2" }
  | { valid: false; reason: "missing-signature" | "bad-timestamp" | "stale" | "bad-signature" };

/**
 * Two accepted schemes, chosen by the sender:
 *
 *   v1 — X-Letters-Signature: HMAC(rawBody). The original contract; a
 *        captured request stays replayable forever (the idempotency index
 *        limits the damage to re-delivering known mail).
 *   v2 — X-Letters-Timestamp: <unix seconds> and the signature is
 *        HMAC(`${timestamp}.${rawBody}`). Sending the timestamp commits the
 *        sender to v2: the signature must cover it, and requests outside
 *        ±REPLAY_WINDOW_SECONDS are refused, so a captured request dies with
 *        the window.
 *
 * Injectable clock so tests don't sleep.
 */
export function verifyInboundRequest(
  rawBody: string,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  secret: string,
  nowSeconds: () => number = () => Math.floor(Date.now() / 1000)
): InboundVerification {
  if (!signature) return { valid: false, reason: "missing-signature" };

  if (timestamp == null) {
    return signatureIsValid(rawBody, signature, secret)
      ? { valid: true, scheme: "v1" }
      : { valid: false, reason: "bad-signature" };
  }

  if (!/^\d{1,12}$/.test(timestamp)) return { valid: false, reason: "bad-timestamp" };
  const skew = Math.abs(nowSeconds() - Number(timestamp));
  if (skew > REPLAY_WINDOW_SECONDS) return { valid: false, reason: "stale" };

  return signatureIsValid(`${timestamp}.${rawBody}`, signature, secret)
    ? { valid: true, scheme: "v2" }
    : { valid: false, reason: "bad-signature" };
}
