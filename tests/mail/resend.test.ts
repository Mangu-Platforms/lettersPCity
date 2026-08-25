import { buildResendPayload, createResendProvider } from "../../lib/mail/resend";
import type { OutboundMessage } from "../../lib/mail/provider";

const MESSAGE: OutboundMessage = {
  from: { address: "max@author-one.com", name: "Max" },
  to: ["reader@example.com"],
  subject: "Hello",
  text: "Body text",
  messageId: "<abc@letters>",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("buildResendPayload", () => {
  it("formats From with display name and carries the Message-ID header", () => {
    const payload = buildResendPayload(MESSAGE);
    expect(payload.from).toBe("Max <max@author-one.com>");
    expect(payload.to).toEqual(["reader@example.com"]);
    expect(payload.headers).toEqual({ "Message-ID": "<abc@letters>" });
  });

  it("omits cc/bcc/html when empty rather than sending empty fields", () => {
    const payload = buildResendPayload({ ...MESSAGE, cc: [], bcc: [] });
    expect(payload).not.toHaveProperty("cc");
    expect(payload).not.toHaveProperty("bcc");
    expect(payload).not.toHaveProperty("html");
  });

  it("includes cc, bcc, html and In-Reply-To when present", () => {
    const payload = buildResendPayload({
      ...MESSAGE,
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      html: "<p>hi</p>",
      inReplyTo: "<earlier@letters>",
    });
    expect(payload.cc).toEqual(["cc@example.com"]);
    expect(payload.bcc).toEqual(["bcc@example.com"]);
    expect(payload.html).toBe("<p>hi</p>");
    expect((payload.headers as Record<string, string>)["In-Reply-To"]).toBe("<earlier@letters>");
  });

  it("strips header-injection characters from the display name and subject", () => {
    const payload = buildResendPayload({
      ...MESSAGE,
      from: { address: "max@author-one.com", name: 'Max\r\nBcc: victim@x.com <evil>"' },
      subject: "Hi\r\nX-Injected: yes",
    });
    expect(payload.from).toBe("MaxBcc: victim@x.com evil <max@author-one.com>");
    // The only angle brackets left are the ones formatFromHeader itself adds.
    expect(String(payload.from)).not.toMatch(/[\r\n"]/);
    expect(payload.subject).toBe("Hi X-Injected: yes");
  });
});

describe("createResendProvider", () => {
  it("sends a bearer-authorized POST and maps 200 to an accepted result", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { id: "re_123" }));
    const provider = createResendProvider("key_test", fetchMock as unknown as typeof fetch);

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({ ok: true, providerMessageId: "re_123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer key_test");
    expect(JSON.parse(init.body).to).toEqual(["reader@example.com"]);
  });

  it("maps 422 to a non-retryable failure with the provider's message", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(422, { name: "validation_error", message: "Invalid `to`" }));
    const provider = createResendProvider("key_test", fetchMock as unknown as typeof fetch);

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({ ok: false, retryable: false, error: "HTTP 422: Invalid `to`" });
  });

  it("maps 429 and 5xx to retryable failures", async () => {
    for (const status of [429, 500, 503]) {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(status, {}));
      const provider = createResendProvider("key_test", fetchMock as unknown as typeof fetch);
      const result = await provider.send(MESSAGE);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.retryable).toBe(true);
    }
  });

  it("maps a network failure to a retryable failure instead of throwing", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("socket hang up"));
    const provider = createResendProvider("key_test", fetchMock as unknown as typeof fetch);

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({ ok: false, retryable: true, error: "socket hang up" });
  });

  it("treats a 2xx with an unparseable body as accepted without an id", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    const provider = createResendProvider("key_test", fetchMock as unknown as typeof fetch);

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({ ok: true, providerMessageId: null });
  });
});
