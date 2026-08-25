import { makeUnsubscribeToken, parseUnsubscribeToken } from "../../lib/mail/unsubscribe";

const SECRET = "s".repeat(64);
const CLAIM = { ownerId: "11111111-1111-1111-1111-111111111111", address: "reader@example.com" };

describe("unsubscribe tokens", () => {
  it("round-trips a claim", () => {
    const token = makeUnsubscribeToken(CLAIM, SECRET);
    expect(parseUnsubscribeToken(token, SECRET)).toEqual(CLAIM);
  });

  it("rejects a token signed with a different secret", () => {
    const token = makeUnsubscribeToken(CLAIM, "t".repeat(64));
    expect(parseUnsubscribeToken(token, SECRET)).toBeNull();
  });

  it("rejects a tampered payload — the signature covers the claim", () => {
    const token = makeUnsubscribeToken(CLAIM, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ o: CLAIM.ownerId, a: "victim@example.com" }),
      "utf8"
    ).toString("base64url");
    expect(parseUnsubscribeToken(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects structural garbage without throwing", () => {
    for (const bad of ["", ".", "abc", "abc.", ".def", "not-base64.deadbeef", "a.b.c"]) {
      expect(() => parseUnsubscribeToken(bad, SECRET)).not.toThrow();
      expect(parseUnsubscribeToken(bad, SECRET)).toBeNull();
    }
  });

  it("rejects a valid signature over a claim missing fields", () => {
    // Sign an incomplete payload with the real scheme by making a token for a
    // claim whose address is empty — parse must refuse it.
    const token = makeUnsubscribeToken({ ownerId: CLAIM.ownerId, address: "" }, SECRET);
    expect(parseUnsubscribeToken(token, SECRET)).toBeNull();
  });

  it("does not accept the inbound-webhook signature scheme (purpose separation)", () => {
    // A raw HMAC over the payload with the shared secret — the inbound
    // webhook's construction — must not validate as an unsubscribe token.
    const { createHmac } = require("crypto") as typeof import("crypto");
    const payload = Buffer.from(JSON.stringify({ o: CLAIM.ownerId, a: CLAIM.address })).toString(
      "base64url"
    );
    const inboundStyleSig = createHmac("sha256", SECRET).update(payload).digest("hex");
    expect(parseUnsubscribeToken(`${payload}.${inboundStyleSig}`, SECRET)).toBeNull();
  });
});
