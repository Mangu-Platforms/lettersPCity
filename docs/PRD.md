# Letters — PRD (MVP)

_Product: privacy-first email hosting for indie creators on their own
domains. Not Gmail; not a newsletter blaster. The unit of value is an
owned identity that can correspond and publish._

## E. Personas

**P1 — Indie author ("June", writes under her own imprint).**
Owns `junewrites.com` (bought for the website). Currently: Gmail for mail,
Substack for the newsletter — so her readers' replies land in Google and her
From address is `@substack.com`. Wants `june@junewrites.com` to be where
everything happens. Non-technical: DNS is copy-paste-with-screenshots at
best. Budget: $10–25/mo total. Success = a reader replies to her newsletter
and the reply is in her Letters inbox.

**P2 — Small press ops ("Ravi", runs a 4-person press).**
Manages `smallpress.com`: info@, submissions@, ravi@, plus author aliases.
Needs mailboxes for people *and* roles, a suppression list that's actually
honored, and to not be the one debugging SPF. Moderate technical skill.
Budget: $40–80/mo. Success = submissions@ triage without forwarding to
personal Gmail accounts.

**P3 — Mangu staff ("Max", operator/first customer).**
Dogfoods Letters for Mangu's own domains; needs the operator view: is DNS
verification working, are sends landing, did the webhook reject unsigned
mail, what's in the delivery ledger. Success = can answer "did author X's
mail go out?" from the product, not from Vercel logs.

## Non-functional requirements (SLAs from the brief, made testable)

| ID | Requirement | Target | Verification |
| --- | --- | --- | --- |
| NFR-1 | Compose save (message + recipients persisted) | p95 < 200 ms server-side | timing log around the two inserts; k6 smoke post-deploy |
| NFR-2 | Send accept (provider hand-off recorded) | p95 < 1 s | `send_attempts.created_at − messages.created_at`; provider timeout capped at 10 s hard |
| NFR-3 | Webhook signature rejection of unsigned/mis-signed mail | 100% rejected, ≥99.9% within 50 ms | unit tests (exists); load probe post-deploy |
| NFR-4 | Inbound idempotency under redelivery | 0 duplicates | unique index + 23505→duplicate path (exists; matrix-tested) |
| NFR-5 | DNS verify freshness | pending domain checked ≤ 1 h (cron) or on demand | cron schedule + Check now; `last_checked_at` audit |
| NFR-6 | Bulk-sender compliance gate | SPF+DKIM pass, DMARC aligned, spam rate < 0.1% | provider dashboard + Postmaster before any >5k/day sender |
| NFR-7 | CI truthfulness | build needs no real secrets; DB checks run on real Postgres | existing workflows |

## F. Stories with acceptance criteria

**S1 — Claim a domain (P1).** As June I add `junewrites.com` and see exactly
what to paste into DNS.
- AC1: bare-hostname validation rejects URLs/emails with a helpful message.
- AC2: the TXT name (`_letters.junewrites.com`) and token are shown
  verbatim, copyable.
- AC3: a domain already claimed anywhere on Letters reads "already claimed"
  (unique constraint surfaced, no info leak about who).
- Status: **shipped** (settings page, this branch).

**S2 — Verification flips without me (P1).**
- AC1: within an hour of publishing the TXT, status becomes `verified`
  with no user action (hourly cron).
- AC2: "Check now" gives an immediate answer with one of four honest
  outcomes (verified / not yet in DNS / value mismatch / DNS outage,
  which changes nothing).
- AC3: every check is logged in `domain_verification_attempts`.
- AC4: I cannot set the status myself by any API call (RLS matrix T2).
- Status: **shipped**; needs live cron on Vercel.

**S3 — First mailbox (P1).**
- AC1: mailbox creation succeeds only on my verified domain (T3/T4/T13).
- AC2: mailbox address is unique platform-wide (citext unique).
- Status: schema + RLS shipped; **mailbox creation UI missing** (gap —
  currently SQL-only). Next slice.

**S4 — Compose and it actually goes (P1).**
- AC1: multi-recipient To/Cc parsed, validated, deduped; bad addresses
  named in the error.
- AC2: message persists to Sent *before* any provider call — provider
  outage cannot lose it.
- AC3: outcome is stated honestly in the UI: accepted / failed (with
  provider error on the detail view) / suppressed / skipped-no-provider.
- AC4: each hand-off is one `send_attempts` row I can read but not write.
- Status: **shipped** to the seam; real delivery blocked on provider
  account + deploy (J-prerequisites).

**S5 — A reply lands in my inbox (P1).**
- AC1: mail to my mailbox arrives via the signed webhook only; unsigned or
  tampered POSTs are 401 (NFR-3).
- AC2: redelivery of the same Message-ID is a no-op (NFR-4).
- AC3: mail to an address with no mailbox is 404, not a crash, not a drop
  into someone else's box.
- Status: seam **shipped + tested**; no relay attached yet (DEC-002).

**S6 — Suppression is honored (P2).**
- AC1: Ravi adds `never@example.com` manually; future sends to it are
  withheld and the attempt row says so.
- AC2: provider bounces/complaints will land as service-role rows Ravi can
  see but not forge (T10) — wiring in the provider-webhook slice.
- Status: enforcement **shipped** (dispatch checks it); management UI
  missing; provider feedback loop not wired.

**S7 — Operator truth (P3).**
- AC1: `/api/health?ready=1` tells the truth against the live DB.
- AC2: delivery ledger and verification log are queryable per message /
  domain (owner-scoped reads shipped; operator dashboard later).

## Out of scope for MVP (explicit)

Teams/shared mailboxes, mobile apps, E2E encryption (TLS + at-rest only —
say so honestly in marketing; Skiff's E2EE didn't save it), AI features,
attachments upload UI (schema ready), threading UI (column ready), IMAP/JMAP
access, calendar. Each is a genome-roadmap v2+ item; none blocks the loop.

## Kill criterion (from the operator, in K of the brief)

If effort keeps flowing into HTML mockups instead of connecting the MTA
loop, stop. Tripwire in practice: any PR that adds root-level HTML gets
closed with a pointer to CLAUDE.md; the loop's four gates (domain verified →
mailbox created → send accepted by provider → reply delivered through
webhook) are the only progress that counts.
