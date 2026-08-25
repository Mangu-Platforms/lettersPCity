/**
 * Route-level tests for POST /api/mail/resend — real handler, fake admin
 * client, mocked receiving API. Covers the Svix boundary, event routing,
 * per-recipient delivery, and bounce attribution through the ledger.
 */
import { createHmac } from "crypto";

const KEY = Buffer.from("k".repeat(32), "utf8");
const WHSEC = `whsec_${KEY.toString("base64")}`;

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.INBOUND_MAIL_WEBHOOK_SECRET = "s".repeat(64);
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_INBOUND_WEBHOOK_SECRET = WHSEC;

jest.mock("@/lib/supabase/server", () => ({
  createAdminClient: jest.fn(),
  createClient: jest.fn(),
}));

import { POST } from "../../app/api/mail/resend/route";
import { createAdminClient } from "@/lib/supabase/server";

function svixHeaders(body: string): Record<string, string> {
  const id = "msg_test";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", KEY).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` };
}

function post(body: string, headers: Record<string, string> = {}): Promise<Response> {
  return POST(new Request("http://localhost/api/mail/resend", { method: "POST", body, headers }));
}

interface FakeState {
  mailboxes: Record<string, { id: string; owner_id: string }>;
  attempts: Record<string, { message_id: string }>;
  owners: Record<string, { owner_id: string }>;
  messageInserts: unknown[];
  suppressionUpserts: unknown[];
}

function fakeAdmin(state: Partial<FakeState> = {}): FakeState {
  const full: FakeState = {
    mailboxes: { "max@author-one.com": { id: "mb1", owner_id: "u1" } },
    attempts: {},
    owners: {},
    messageInserts: [],
    suppressionUpserts: [],
    ...state,
  };
  const client = {
    from(table: string) {
      if (table === "mailboxes") {
        return {
          select: () => ({
            eq: (_col: string, address: string) => ({
              maybeSingle: async () => ({ data: full.mailboxes[address] ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          insert: async (row: unknown) => {
            full.messageInserts.push(row);
            return { error: null };
          },
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: full.owners[id] ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === "send_attempts") {
        return {
          select: () => ({
            eq: (_col: string, providerId: string) => ({
              limit: () => ({
                maybeSingle: async () => ({ data: full.attempts[providerId] ?? null, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "suppression_list") {
        return {
          upsert: async (rows: unknown) => {
            full.suppressionUpserts.push(rows);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  (createAdminClient as jest.Mock).mockReturnValue(client);
  return full;
}

describe("POST /api/mail/resend", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("401s a request without a valid Svix signature", async () => {
    fakeAdmin();
    const body = JSON.stringify({ type: "email.received", data: { email_id: "em_1" } });
    expect((await post(body)).status).toBe(401);
    expect((await post(body, { ...svixHeaders(body), "svix-signature": "v1,forged" })).status).toBe(401);
  });

  it("acknowledges event types it does not handle without side effects", async () => {
    const state = fakeAdmin();
    const body = JSON.stringify({ type: "email.opened", data: { email_id: "em_1" } });
    const response = await post(body, svixHeaders(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ignored", type: "email.opened" });
    expect(state.messageInserts).toHaveLength(0);
  });

  it("delivers a received email to each hosted recipient after fetching the body", async () => {
    const state = fakeAdmin();
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            from: "June <june@junewrites.com>",
            to: ["max@author-one.com", "foreign@elsewhere.com"],
            subject: "hi",
            text: "body",
            headers: [{ name: "Message-ID", value: "<m1@junewrites.com>" }],
          },
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const body = JSON.stringify({ type: "email.received", data: { email_id: "em_1" } });
    const response = await post(body, svixHeaders(body));

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.outcomes["max@author-one.com"]).toBe("delivered");
    expect(result.outcomes["foreign@elsewhere.com"]).toBe("no-mailbox");
    expect(state.messageInserts).toHaveLength(1);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails/receiving/em_1");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
  });

  it("502s when the receiving API is not ready, so Resend retries", async () => {
    fakeAdmin();
    global.fetch = jest.fn().mockResolvedValue(new Response("{}", { status: 404 })) as unknown as typeof fetch;
    const body = JSON.stringify({ type: "email.received", data: { email_id: "em_x" } });
    expect((await post(body, svixHeaders(body))).status).toBe(502);
  });

  it("writes bounce suppression attributed through the delivery ledger", async () => {
    const state = fakeAdmin({
      attempts: { re_sent_1: { message_id: "msg-row-1" } },
      owners: { "msg-row-1": { owner_id: "u1" } },
    });

    const body = JSON.stringify({
      type: "email.bounced",
      data: { email_id: "re_sent_1", to: ["gone@example.com"] },
    });
    const response = await post(body, svixHeaders(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "suppressed", reason: "bounce", count: 1 });
    const rows = state.suppressionUpserts[0] as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({ owner_id: "u1", address: "gone@example.com", reason: "bounce" });
  });

  it("acknowledges an unattributable bounce instead of asking for retries", async () => {
    fakeAdmin();
    const body = JSON.stringify({
      type: "email.complained",
      data: { email_id: "re_unknown", to: ["x@example.com"] },
    });
    const response = await post(body, svixHeaders(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ignored", detail: "unattributable" });
  });
});
