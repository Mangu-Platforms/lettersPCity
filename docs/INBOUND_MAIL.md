# Inbound mail

## Why this is not just an SMTP server

Letters is an email host, and the original Forge plan called for a custom SMTP
receiver — "not SendGrid/AWS SES; we control the infrastructure."

Standardizing on Vercel makes that impossible in the web app. Vercel runs
serverless functions: a process starts when a request arrives and stops when the
response is sent. Receiving SMTP requires a process holding port 25 open
indefinitely. There is no configuration of a Vercel deployment that does this.

So inbound mail is split out. The Next.js app on Vercel owns the mailbox UI,
auth, search and outbound composition. Receiving is a separate always-on
concern that hands messages to the app through one endpoint.

## The seam

`POST /api/mail/inbound`

```
Content-Type: application/json
X-Letters-Signature: <hex HMAC-SHA256 of the raw request body>
```

```json
{
  "to": "you@your-domain.com",
  "from": "sender@example.com",
  "from_name": "A Sender",
  "subject": "Hello",
  "body_text": "…",
  "body_html": "<p>…</p>",
  "message_id": "<abc123@example.com>",
  "in_reply_to": "<earlier@example.com>",
  "received_at": "2026-08-20T10:00:00Z"
}
```

Responses:

| Status | Meaning |
| --- | --- |
| `202` | Delivered. |
| `200` `{"status":"duplicate"}` | Already delivered; redelivery is a no-op. |
| `400` | Body is not valid JSON, or fails the payload schema. |
| `401` | Signature missing/invalid, or a stale v2 timestamp. |
| `413` | Body exceeds 1 MB. |
| `404` | No mailbox accepts mail at that address. |
| `500` | Lookup or insert failed. |

### Authentication

There is no user session on this path, so the endpoint authenticates the
*sender* by HMAC-SHA256 using `INBOUND_MAIL_WEBHOOK_SECRET`, in one of two
schemes the sender chooses:

- **v1** — `X-Letters-Signature: HMAC(rawBody)`. The original contract.
- **v2** — additionally send `X-Letters-Timestamp: <unix seconds>`; the
  signature must then cover `` `${timestamp}.${rawBody}` `` and the timestamp
  must be within ±300 s of the server clock. Prefer v2: a captured request
  dies with the window instead of being replayable forever. Sending the
  timestamp commits the request to v2 — a body-only signature is refused.

Bodies over 1 MB are refused with `413` (attachments travel via storage, not
this endpoint). The comparison is constant-time
(`lib/messages/signature.ts`); tests cover forged secrets, tampered bodies,
truncated signatures, re-serialized JSON, stale/future timestamps and
cross-scheme downgrade attempts.

Because there is no session, the handler uses the service-role Supabase client
and **bypasses RLS**. It therefore does its own authorization: it resolves
`to` to a row in `mailboxes` and writes only into that mailbox. It cannot be
made to write anywhere else, because `owner_id` and `mailbox_id` both come from
that lookup and never from the payload.

### Idempotency

Mail gets redelivered — that is normal, not an error. A unique index on
`(mailbox_id, message_id)` makes a repeat insert fail with `23505`, which the
handler reports as `duplicate` with a success status rather than surfacing an
error to the sender. A retrying relay will not produce duplicates in the inbox.

## The Resend adapter

`POST /api/mail/resend-inbound` is a ready adapter for Resend Inbound (the
MVP pick — docs/ARCHITECTURE.md DEC-002): it verifies the Svix signature
(`RESEND_INBOUND_WEBHOOK_SECRET`, ±300 s window), fetches the message body
from Resend's receiving API, translates it, and hands it to the same
delivery core as the seam — once per hosted recipient, idempotently. It
answers 2xx for everything that must not be retried and 5xx only when a
delivery genuinely failed, so provider retries do useful work. Unconfigured
deployments answer 503 (disabled, never open).

To go live: add the MX record Resend specifies on the receiving (sub)domain,
create a webhook pointed at this route for `email.received`, and set the two
env vars.

## Attaching a real receiver

Any of these can sit in front of the endpoint. None is wired up yet.

1. **A relay provider** (Postmark, Mailgun, SES + Lambda). Fastest path: point
   the domain's MX at the provider, translate their webhook shape to the payload
   above, sign it, forward it. Costs a dependency and some privacy positioning.
2. **A self-hosted MTA** (Postfix/Haraka on a small always-on VM). Matches the
   original "we control the infrastructure" intent. Costs an ops surface:
   IP reputation, SPF/DKIM/DMARC, TLS certs, spam filtering.

Either way the app does not change — the payload contract above is the seam.

## Outbound

`app/compose/page.tsx` persists the message to `Sent`, then hands it to the
provider behind `lib/mail/` — suppression list first, then the adapter chosen
by `MAIL_PROVIDER`, with the outcome recorded per attempt in `send_attempts`
(`accepted` / `failed` / `suppressed` / `skipped`). The default `noop`
provider keeps every environment working with nothing configured, and the UI
reports those sends honestly as not delivered.

DKIM/SPF/DMARC for each creator domain are set up at the provider (Resend
returns the records to publish alongside our `_letters` verification TXT).
Deliverability strategy and the SES exit path live in `docs/ARCHITECTURE.md`.
