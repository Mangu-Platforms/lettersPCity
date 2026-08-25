/**
 * Route-level tests for POST /api/mail/inbound — the real handler, a fake
 * admin client. This is the security boundary between the public internet
 * and users' inboxes, so every status in the contract table gets a test.
 */
import { signPayload } from "../../lib/messages/signature";

const SECRET = "s".repeat(64);

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
process.env.INBOUND_MAIL_WEBHOOK_SECRET = SECRET;

jest.mock("@/lib/supabase/server", () => ({
  createAdminClient: jest.fn(),
  createClient: jest.fn(),
}));

import { POST } from "../../app/api/mail/inbound/route";
import { createAdminClient } from "@/lib/supabase/server";

interface FakeOptions {
  mailbox?: { id: string; owner_id: string } | null;
  mailboxError?: { message: string } | null;
  insertError?: { code?: string; message?: string } | null;
}

function fakeAdmin({ mailbox = { id: "mb1", owner_id: "u1" }, mailboxError = null, insertError = null }: FakeOptions = {}) {
  const inserts: unknown[] = [];
  const client = {
    inserts,
    from(table: string) {
      if (table === "mailboxes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mailbox, error: mailboxError }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          insert: async (row: unknown) => {
            inserts.push(row);
            return { error: insertError };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  (createAdminClient as jest.Mock).mockReturnValue(client);
  return client;
}

const VALID_MAIL = {
  to: "max@author-one.com",
  from: "reader@example.com",
  subject: "Hello",
  body_text: "Hi",
  message_id: "<route-test-1@example.com>",
};

function post(body: string, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request("http://localhost/api/mail/inbound", {
      method: "POST",
      body,
      headers,
    })
  );
}

function signedHeaders(body: string): Record<string, string> {
  return { "x-letters-signature": signPayload(body, SECRET) };
}

describe("POST /api/mail/inbound", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delivers a correctly signed message: 202, row written from the mailbox lookup", async () => {
    const admin = fakeAdmin();
    const body = JSON.stringify(VALID_MAIL);
    const response = await post(body, signedHeaders(body));

    expect(response.status).toBe(202);
    expect(admin.inserts).toHaveLength(1);
    const row = admin.inserts[0] as Record<string, unknown>;
    // owner/mailbox come from the lookup, never the payload.
    expect(row.mailbox_id).toBe("mb1");
    expect(row.owner_id).toBe("u1");
    expect(row.direction).toBe("inbound");
  });

  it("accepts the v2 scheme (timestamped signature)", async () => {
    fakeAdmin();
    const body = JSON.stringify(VALID_MAIL);
    const ts = String(Math.floor(Date.now() / 1000));
    const response = await post(body, {
      "x-letters-signature": signPayload(`${ts}.${body}`, SECRET),
      "x-letters-timestamp": ts,
    });
    expect(response.status).toBe(202);
  });

  it("401s an unsigned or mis-signed request without touching the database", async () => {
    const admin = fakeAdmin();
    const body = JSON.stringify(VALID_MAIL);

    expect((await post(body)).status).toBe(401);
    expect((await post(body, { "x-letters-signature": "deadbeef" })).status).toBe(401);
    expect(admin.inserts).toHaveLength(0);
  });

  it("413s an oversized body before verifying anything", async () => {
    fakeAdmin();
    const body = "x".repeat(1_000_001);
    expect((await post(body, signedHeaders(body))).status).toBe(413);
  });

  it("400s signed-but-invalid JSON and signed-but-invalid schema", async () => {
    fakeAdmin();
    const notJson = "not json";
    expect((await post(notJson, signedHeaders(notJson))).status).toBe(400);

    const badSchema = JSON.stringify({ to: "not-an-email", message_id: "" });
    expect((await post(badSchema, signedHeaders(badSchema))).status).toBe(400);
  });

  it("404s when no mailbox accepts the address", async () => {
    fakeAdmin({ mailbox: null });
    const body = JSON.stringify(VALID_MAIL);
    expect((await post(body, signedHeaders(body))).status).toBe(404);
  });

  it("reports redelivery (23505) as duplicate with a success status", async () => {
    fakeAdmin({ insertError: { code: "23505" } });
    const body = JSON.stringify(VALID_MAIL);
    const response = await post(body, signedHeaders(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "duplicate", delivered: true });
  });

  it("500s a genuine insert failure", async () => {
    fakeAdmin({ insertError: { code: "XX000", message: "boom" } });
    const body = JSON.stringify(VALID_MAIL);
    expect((await post(body, signedHeaders(body))).status).toBe(500);
  });
});
