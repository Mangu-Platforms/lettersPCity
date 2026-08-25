import { signPayload, signatureIsValid } from "../../lib/messages/signature";

const SECRET = "a".repeat(64);
const BODY = JSON.stringify({ to: "me@example.com", message_id: "<1@x>" });

describe("inbound webhook signature", () => {
  it("accepts a signature produced with the same secret and body", () => {
    expect(signatureIsValid(BODY, signPayload(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects a missing signature", () => {
    expect(signatureIsValid(BODY, null, SECRET)).toBe(false);
    expect(signatureIsValid(BODY, undefined, SECRET)).toBe(false);
    expect(signatureIsValid(BODY, "", SECRET)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(signatureIsValid(BODY, signPayload(BODY, "b".repeat(64)), SECRET)).toBe(false);
  });

  it("rejects a valid signature over different bytes (no replay onto a new body)", () => {
    const tampered = JSON.stringify({ to: "attacker@example.com", message_id: "<1@x>" });
    expect(signatureIsValid(tampered, signPayload(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects a truncated signature rather than throwing on length mismatch", () => {
    const short = signPayload(BODY, SECRET).slice(0, 32);
    expect(() => signatureIsValid(BODY, short, SECRET)).not.toThrow();
    expect(signatureIsValid(BODY, short, SECRET)).toBe(false);
  });

  it("is sensitive to whitespace, since the signature covers raw bytes", () => {
    const reserialized = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(signatureIsValid(reserialized, signPayload(BODY, SECRET), SECRET)).toBe(false);
  });
});

describe("verifyInboundRequest (schemes v1/v2 + replay window)", () => {
  const { verifyInboundRequest, REPLAY_WINDOW_SECONDS } =
    require("../../lib/messages/signature") as typeof import("../../lib/messages/signature");
  const NOW = 1_756_000_000;
  const clock = () => NOW;

  it("accepts a v1 request (no timestamp header) with a body-only signature", () => {
    const result = verifyInboundRequest(BODY, signPayload(BODY, SECRET), null, SECRET, clock);
    expect(result).toEqual({ valid: true, scheme: "v1" });
  });

  it("accepts a v2 request whose signature covers timestamp.body, inside the window", () => {
    const ts = String(NOW - 30);
    const sig = signPayload(`${ts}.${BODY}`, SECRET);
    expect(verifyInboundRequest(BODY, sig, ts, SECRET, clock)).toEqual({
      valid: true,
      scheme: "v2",
    });
  });

  it("refuses a stale v2 request — a captured request dies with the window", () => {
    const ts = String(NOW - REPLAY_WINDOW_SECONDS - 1);
    const sig = signPayload(`${ts}.${BODY}`, SECRET);
    expect(verifyInboundRequest(BODY, sig, ts, SECRET, clock)).toEqual({
      valid: false,
      reason: "stale",
    });
  });

  it("refuses a v2 request from the future beyond the skew allowance", () => {
    const ts = String(NOW + REPLAY_WINDOW_SECONDS + 1);
    const sig = signPayload(`${ts}.${BODY}`, SECRET);
    expect(verifyInboundRequest(BODY, sig, ts, SECRET, clock)).toEqual({
      valid: false,
      reason: "stale",
    });
  });

  it("sending a timestamp commits to v2: a body-only signature no longer passes", () => {
    const ts = String(NOW);
    const v1sig = signPayload(BODY, SECRET);
    expect(verifyInboundRequest(BODY, v1sig, ts, SECRET, clock)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("refuses a non-numeric timestamp without throwing", () => {
    const sig = signPayload(`abc.${BODY}`, SECRET);
    expect(verifyInboundRequest(BODY, sig, "abc", SECRET, clock)).toEqual({
      valid: false,
      reason: "bad-timestamp",
    });
  });

  it("refuses a missing signature under either scheme", () => {
    expect(verifyInboundRequest(BODY, null, null, SECRET, clock).valid).toBe(false);
    expect(verifyInboundRequest(BODY, "", String(NOW), SECRET, clock).valid).toBe(false);
  });
});
