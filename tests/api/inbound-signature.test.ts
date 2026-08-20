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
