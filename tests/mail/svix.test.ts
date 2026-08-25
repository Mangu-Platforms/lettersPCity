import { createHmac } from "crypto";
import { SVIX_WINDOW_SECONDS, verifySvixSignature } from "../../lib/mail/svix";

const KEY = Buffer.from("k".repeat(32), "utf8");
const SECRET = `whsec_${KEY.toString("base64")}`;
const BODY = JSON.stringify({ type: "email.received", data: { email_id: "em_1" } });
const NOW = 1_756_000_000;
const clock = () => NOW;

function sign(id: string, timestamp: string, body: string, key: Buffer = KEY): string {
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

describe("verifySvixSignature", () => {
  const headers = (overrides: Partial<{ id: string; timestamp: string; signature: string }> = {}) => ({
    id: "msg_1",
    timestamp: String(NOW),
    signature: `v1,${sign("msg_1", String(NOW), BODY)}`,
    ...overrides,
  });

  it("accepts a correctly signed request", () => {
    expect(verifySvixSignature(BODY, headers(), SECRET, clock)).toEqual({ valid: true });
  });

  it("accepts when any one of several rotated signatures matches", () => {
    const sig = `v1,${"A".repeat(43)}= v1,${sign("msg_1", String(NOW), BODY)}`;
    expect(verifySvixSignature(BODY, headers({ signature: sig }), SECRET, clock)).toEqual({
      valid: true,
    });
  });

  it("rejects a signature keyed with a different secret", () => {
    const sig = `v1,${sign("msg_1", String(NOW), BODY, Buffer.from("other-key"))}`;
    expect(verifySvixSignature(BODY, headers({ signature: sig }), SECRET, clock).valid).toBe(false);
  });

  it("rejects when the id or timestamp differ from what was signed", () => {
    expect(verifySvixSignature(BODY, headers({ id: "msg_2" }), SECRET, clock).valid).toBe(false);
    const shifted = String(NOW - 10);
    expect(
      verifySvixSignature(BODY, headers({ timestamp: shifted }), SECRET, clock).valid
    ).toBe(false);
  });

  it("rejects a stale timestamp before comparing signatures", () => {
    const ts = String(NOW - SVIX_WINDOW_SECONDS - 1);
    const result = verifySvixSignature(
      BODY,
      headers({ timestamp: ts, signature: `v1,${sign("msg_1", ts, BODY)}` }),
      SECRET,
      clock
    );
    expect(result).toEqual({ valid: false, reason: "stale" });
  });

  it("rejects missing headers and malformed secrets without throwing", () => {
    expect(verifySvixSignature(BODY, { id: null, timestamp: null, signature: null }, SECRET, clock).valid).toBe(false);
    expect(verifySvixSignature(BODY, headers(), "not-a-whsec-secret", clock)).toEqual({
      valid: false,
      reason: "bad-secret",
    });
  });

  it("ignores non-v1 entries rather than failing on them", () => {
    const sig = `v2,garbage v1,${sign("msg_1", String(NOW), BODY)}`;
    expect(verifySvixSignature(BODY, headers({ signature: sig }), SECRET, clock)).toEqual({
      valid: true,
    });
  });
});
