import {
  headerValue,
  parseAddress,
  translateReceivedEmail,
} from "../../lib/mail/resend-inbound";

describe("parseAddress", () => {
  it("parses display-name form and lowercases the address", () => {
    expect(parseAddress('Jane Doe <Jane@Example.COM>')).toEqual({
      address: "jane@example.com",
      name: "Jane Doe",
    });
  });

  it("parses quoted display names", () => {
    expect(parseAddress('"Doe, Jane" <jane@example.com>')).toEqual({
      address: "jane@example.com",
      name: "Doe, Jane",
    });
  });

  it("parses bare addresses and object shapes", () => {
    expect(parseAddress("reader@example.com")).toEqual({ address: "reader@example.com", name: null });
    expect(parseAddress({ name: "R", address: "r@example.com" })).toEqual({
      address: "r@example.com",
      name: "R",
    });
    expect(parseAddress({ email: "e@example.com" })).toEqual({ address: "e@example.com", name: null });
  });

  it("returns null for garbage instead of throwing", () => {
    expect(parseAddress("not an address")).toBeNull();
    expect(parseAddress("")).toBeNull();
    expect(parseAddress(null)).toBeNull();
    expect(parseAddress({})).toBeNull();
  });
});

describe("headerValue", () => {
  it("reads from array-of-objects form, case-insensitively", () => {
    const headers = [{ name: "Message-ID", value: "<x@y>" }, { name: "In-Reply-To", value: "<z@y>" }];
    expect(headerValue(headers, "message-id")).toBe("<x@y>");
    expect(headerValue(headers, "IN-REPLY-TO")).toBe("<z@y>");
  });

  it("reads from record form, case-insensitively", () => {
    expect(headerValue({ "Message-Id": "<x@y>" }, "message-id")).toBe("<x@y>");
  });

  it("returns null when absent", () => {
    expect(headerValue([], "message-id")).toBeNull();
    expect(headerValue(null, "message-id")).toBeNull();
  });
});

describe("translateReceivedEmail", () => {
  const email = {
    from: "June Writes <june@junewrites.com>",
    to: ["max@author-one.com", "Max Again <MAX@author-one.com>", "other@elsewhere.com"],
    cc: ["cc@author-one.com"],
    subject: "Reply to your newsletter",
    text: "Loved it.",
    html: "<p>Loved it.</p>",
    headers: [{ name: "Message-ID", value: "<orig@junewrites.com>" }],
    created_at: "2026-08-25T12:00:00Z",
  };

  it("maps fields and de-duplicates recipients case-insensitively", () => {
    const { base, recipients } = translateReceivedEmail(email, "em_123");
    expect(base.from).toBe("june@junewrites.com");
    expect(base.from_name).toBe("June Writes");
    expect(base.message_id).toBe("<orig@junewrites.com>");
    expect(base.received_at).toBe("2026-08-25T12:00:00Z");
    expect(recipients).toEqual(["max@author-one.com", "other@elsewhere.com", "cc@author-one.com"]);
  });

  it("falls back to a deterministic message id derived from the webhook email id", () => {
    const { base } = translateReceivedEmail({ ...email, headers: null }, "em_123");
    expect(base.message_id).toBe("<resend-em_123@inbound.letters>");
    // Deterministic: a webhook retry produces the same id, so redelivery
    // still dedupes on (mailbox_id, message_id).
    expect(translateReceivedEmail({ ...email, headers: null }, "em_123").base.message_id).toBe(
      base.message_id
    );
  });

  it("survives a nearly-empty payload with safe defaults", () => {
    const { base, recipients } = translateReceivedEmail({}, "em_9");
    expect(base.from).toBe("unknown@invalid");
    expect(base.subject).toBe("");
    expect(base.body_text).toBe("");
    expect(recipients).toEqual([]);
  });
});
