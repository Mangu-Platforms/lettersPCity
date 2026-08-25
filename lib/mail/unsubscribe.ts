/**
 * One-click unsubscribe tokens (RFC 8058 groundwork).
 *
 * A token authorizes exactly one operation — "suppress address X for owner
 * Y" — for whoever holds it, with no session. It is therefore an HMAC over
 * that pair, keyed separately from the inbound-webhook secret by a purpose
 * string, so neither token kind can ever be replayed as the other.
 *
 * Format: base64url(JSON{o,a}) + "." + hex HMAC. Pure functions, injectable
 * nowhere needed — the secret is a parameter, so tests run without env.
 */
import { createHmac, timingSafeEqual } from "crypto";

const PURPOSE = "letters-unsubscribe-v1";

export interface UnsubscribeClaim {
  ownerId: string;
  address: string;
}

function derivedKey(secret: string): Buffer {
  return createHmac("sha256", secret).update(PURPOSE).digest();
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", derivedKey(secret)).update(payload).digest("hex");
}

export function makeUnsubscribeToken(claim: UnsubscribeClaim, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ o: claim.ownerId, a: claim.address }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function parseUnsubscribeToken(token: string, secret: string): UnsubscribeClaim | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  const expected = Buffer.from(sign(payload, secret), "utf8");
  const given = Buffer.from(provided, "utf8");
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      o?: unknown;
      a?: unknown;
    };
    if (typeof parsed.o !== "string" || typeof parsed.a !== "string") return null;
    if (!parsed.o || !parsed.a) return null;
    return { ownerId: parsed.o, address: parsed.a };
  } catch {
    return null;
  }
}
