# Letters — Architecture

_Last updated 2026-08-25. Companion docs: [RISKS.md](RISKS.md),
[COMPETITORS.md](COMPETITORS.md), [PRD.md](PRD.md), [ROADMAP.md](ROADMAP.md),
[QUESTIONS_FOR_MAX.md](QUESTIONS_FOR_MAX.md), [INBOUND_MAIL.md](INBOUND_MAIL.md)._

## A. What this repository actually is

| Layer | Contents | Status |
| --- | --- | --- |
| **The app** | `app/` (login, inbox, compose, settings/domains, api/health, api/mail/inbound, api/domains/verify), `lib/` (env, supabase clients, messages, mail, domains), `middleware.ts` | Real, tested, builds green |
| **The schema** | `supabase/migrations/` ×4 + `supabase/tests/` (shim + RLS matrix) | Applies cleanly to Postgres 16; **never yet deployed to a live Supabase project** |
| **The design layer** | `src/forge/` — agents, genome, constitution | Typechecked in CI; not the product |
| **Design archive** | ~70 root-level `*.html` Gmail-style mockups, `download*`, `delegat` | Quarantined by CLAUDE.md; not the app; never import from them |
| **Historical plans** | `FORGE_PHASE1_PROGRESS.md`, `Mangu Mail Phase 2 … .pdf` | Evidence, not ground truth |

**Ground truth on delivery (2026-08-25):** no message has ever been sent by
this system, and until this branch the schema could not even be applied — the
shipped RLS migration failed on a virgin database (see RISKS R-0). The compose
path now hands mail to a provider seam; delivery still requires a provider
account and a deployed Supabase project.

## The product loop and its seams

```
creator adds domain ──► TXT _letters.<domain> ──► verify job flips status
        │                                              (cron + Check now)
        ▼
creates mailbox (RLS: only on verified own domain)
        │
        ├── compose ──► messages(folder=sent) ──► lib/mail dispatch ──► provider API
        │                                              │
        │                                              └─► send_attempts ledger
        ▼
inbound: provider MX ──► provider webhook ──► adapter signs HMAC ──►
         POST /api/mail/inbound ──► messages(folder=inbox), idempotent
```

Two seams keep the app provider-agnostic:

1. **Outbound:** `lib/mail/provider.ts` (`MailProvider.send`). Adapters:
   `resend.ts` (real), `noop.ts` (default; records `skipped`). An SES adapter
   is the same ~80 lines against a different endpoint.
2. **Inbound:** `POST /api/mail/inbound` — HMAC-SHA256 over raw bytes,
   documented in INBOUND_MAIL.md. Whatever receives mail translates its
   payload to this contract and signs it. The app never changes per provider.

## The MTA blueprint (decision)

Evaluated (full evidence: `.plan/evidence/research-full.json`): Amazon SES,
Resend, Postmark, Mailgun, Cloudflare Email Routing/Email Service, Postal
(self-hosted), Postfix/Haraka (raw self-hosted).

**DEC-001 — MVP outbound: Resend.**
API-first, first-class Next.js/Vercel DX, per-domain onboarding built for
multi-tenant SaaS (`POST /domains` returns the SPF+DKIM records to show the
creator, verify endpoint to poll), custom domains ungated from the free tier,
and the adapter is already written. Pricing: free 3k emails/mo → Pro $20/mo
(50k, ~100 domains) → Scale $90/mo (100k, 1,000 domains).

**DEC-002 — MVP inbound: Resend Inbound** (launched Nov 2025 — one vendor,
both directions). Creator publishes an MX on a **subdomain** (Resend's own
recommendation, e.g. `mail.creator.com`, because MX captures all mail for the
name it's on); Resend fires a Svix-signed `email.received` webhook; a thin
adapter (Vercel route or worker) verifies the Svix signature, fetches the
body via the follow-up API call, translates to the seam payload, signs our
HMAC, and POSTs to `/api/mail/inbound`. Fallbacks if Resend Inbound
disappoints (it is <1 year old): **Postmark** (reference-quality single-POST
inbound JSON, but inbound gated to its Pro tier) or **Mailgun** (routes +
1,000 domains at $35/mo, form-encoded payload).

**DEC-005 — Scale/exit path: Amazon SES.** ~$0.10/1k vs Resend's effective
~$0.90/1k at volume; per-recipient billing makes newsletter fan-out the
dominant cost (2.5M sends ≈ $250 SES vs $1,150 Resend). SES also has real
MX-based receiving (S3 + Lambda glue). The provider seam exists precisely so
this migration is an adapter, not a rewrite. Trigger: sustained >50k
sends/month or the first creator with a >5k-subscriber list.

**Rejected for MVP:**
- *Cloudflare Email Routing*: requires every domain to be a zone on
  Cloudflare nameservers — breaks "creator pastes 3 records" onboarding.
  Keep for Letters-owned domains (free inbound tap via Worker).
- *Postal / Postfix / Haraka self-hosted*: philosophically aligned
  (nobody else sees mail) but a stateful mail cluster with IP warm-up and
  blocklist on-call is a company function, not an MVP feature. Revisit as
  the sovereignty milestone; Haraka is the natural inbound-only edge if we
  ever in-house the MX.

## DNS per creator domain (the records a creator publishes)

| Record | Name | Value | Purpose |
| --- | --- | --- | --- |
| TXT | `_letters.creator.com` | verification token | Prove ownership to Letters |
| CNAME/TXT ×2–3 | per provider | DKIM keys (d=creator.com) | Signing + DMARC alignment |
| MX | `mail.creator.com` | provider inbound host | Receiving |
| TXT | `_dmarc.creator.com` | `v=DMARC1; p=none; rua=mailto:dmarc@…letters…` | Monitoring → later `p=quarantine` |

DMARC alignment strategy: rely on **DKIM d=creator.com** (survives
forwarding); SPF alignment needs a custom MAIL FROM subdomain and comes with
the SES migration. Platform-controlled `rua` mailbox watches all creators
centrally. Gmail/Yahoo bulk rules (Feb 2024, enforced since): SPF+DKIM+DMARC,
RFC 8058 one-click unsubscribe on bulk mail, spam rate <0.1% (hard ceiling
0.3%) — see PRD NFRs.

## G. Schema audit (migrations 1–4)

Verdict: the modeled schema was sound; the *shipped SQL* was not (RISKS R-0,
fixed). Current state after migration 4:

- `profiles` 1:1 auth.users via trigger; users cannot mint their own. ✓
- `domains` unique citext, token via pgcrypto, status enum; **UPDATE revoked
  from users** — only the verify job transitions status. `last_checked_at`
  added for job scheduling. ✓
- `mailboxes` insert gated on *verified own domain* (RLS with-check);
  user UPDATE limited to `is_default`. ✓
- `messages` idempotency via unique `(mailbox_id, message_id)`; generated
  tsvector (can't drift); RLS refuses user-inserted `direction='inbound'`;
  user UPDATE limited to `(folder, is_read)` so direction can't be laundered
  post-insert. ✓
- `message_recipients` / `attachments` reachable only through owned
  messages (policies repaired — they never applied as shipped). ✓
- `audit_logs` readable by actor, writable only by service role. ✓
- **New:** `send_attempts` (delivery ledger; owner-readable,
  service-writable), `suppression_list` (per-owner; users may only write
  `reason='manual'`), `domain_verification_attempts` (check log).
- Deliberately NOT redrawn: threading (`thread_id` exists, unused), raw MIME
  storage (see RISKS R-4), attachments upload path (storage bucket wiring is
  post-MVP).

Verification: `scripts/db-check.sh` applies everything to scratch Postgres
and runs `supabase/tests/rls_matrix.sql` (15 behavioral assertions); CI runs
it on every push against postgres:16.

## H. Environment matrix

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | yes | RLS-scoped key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | yes | Webhook/cron writes (bypasses RLS) |
| `INBOUND_MAIL_WEBHOOK_SECRET` | server | yes (≥32 chars) | HMAC for the inbound seam |
| `MAIL_PROVIDER` | server | no (default `noop`) | `noop` \| `resend` |
| `RESEND_API_KEY` | server | iff `MAIL_PROVIDER=resend` | Outbound hand-off |
| `CRON_SECRET` | server | no (job disabled without it) | Bearer auth on `/api/domains/verify` |

Per environment: **local** `.env.local` (noop provider fine); **CI**
placeholders only — the build must never need real secrets (enforced by the
existing workflow); **Vercel preview** real Supabase (branch DB) + noop;
**Vercel production** all seven, `MAIL_PROVIDER=resend`.

## I. CI (GitHub Actions)

`build` job: typecheck → lint → jest → next build (placeholder env) → forge
typecheck. `database` job: migrations apply + RLS matrix on postgres:16.
Missing (deliberate, next): Supabase preview-branch deploy on PR; Vercel
preview smoke against `/api/health?ready=1`.

## J. Prerequisites to first real delivery

1. **Supabase project** for Letters (schema has never been deployed — this
   blocks *everything* runtime).
2. **Resend account** + API key; platform sending domain verified there.
3. **A domain Mangu owns** for the platform itself (transactional mail,
   DMARC rua mailbox, webhook adapter host). → QUESTIONS Q1.
4. Vercel project wired to the repo with the env matrix above + cron enabled.
5. SPF/DKIM/DMARC published for the platform domain per the table above.
6. First creator domain onboarded end-to-end as the dogfood (Mangu's own).
