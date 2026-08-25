# Letters — Risk register

_Status values: **CLOSED** (fixed on this branch, with evidence),
**MITIGATED** (defense exists, residual noted), **OPEN** (needs work),
**ACCEPTED** (deliberate for MVP)._

## R-0 · The shipped schema could never be applied — CLOSED
Migration 2's recipients/attachments policies compared `m.id = message_id`
inside a subquery over `messages`, capturing `messages.message_id` (text):
`uuid = text` fails at CREATE POLICY. Every fresh deploy would have died at
`supabase db push`, so "RLS protects messages" was untested theory.
**Fix:** qualified references; `scripts/db-check.sh` + 15-case RLS matrix now
run in CI. Evidence: `.plan/evidence/C1-rls-matrix.log`.

## R-1 · Custom-domain takeover via self-verification — CLOSED
`domains: update own` RLS allowed an owner to UPDATE *any* column — including
`status='verified'` — on a domain they claimed but do not control
(`google.com`), then mint `anyone@google.com` mailboxes and, once outbound
existed, send as that identity through our relay. **Fix:** UPDATE revoked on
`domains` for users (migration 4); status transitions only via the DNS job /
service role. RLS matrix T2 proves the block.

## R-2 · Inbound forgery by UPDATE — CLOSED
The messages INSERT policy refused `direction='inbound'` but UPDATE did not:
insert outbound, update it to inbound → forged received mail (phishing
canvas inside a trusted inbox). **Fix:** user UPDATE grant narrowed to
`(folder, is_read)`. Matrix T6/T7.

## R-3 · Open inbound webhook / HMAC — MITIGATED
HMAC-SHA256 over raw bytes, constant-time compare, 401 on absence — tested
(6 unit cases: forged secret, tampered body, truncation, re-serialization).
Residual: no replay window (a captured signed payload can be re-posted; the
idempotency index makes it a no-op for duplicates, so impact is limited to
first delivery); no rate limit on signature attempts; secret is single and
static (no rotation story). Add timestamp header + dual-secret rotation when
the first real relay is attached.

## R-4 · Storing raw email / PII retention — OPEN (policy decision)
We store parsed text/html bodies, not raw MIME — good for minimization, bad
for fidelity (no DKIM re-verification, no original headers for abuse
forensics). GDPR: platform is *processor* for message content, *controller*
for account data; obligations = DPA with creators (list Supabase/Vercel/
Resend as subprocessors), documented retention schedule per data class,
erasure "without undue delay" with backups aged out beyond use.
Needed: retention schedule doc, delete flows that actually cascade (schema
cascades exist), trash auto-purge job, data export. → PRD FR-9, Q6.

## R-5 · CAN-SPAM posture — MITIGATED by design, OPEN in product
The platform is protected by the *routine conveyance* exemption (15 U.S.C.
7702(15)) **as long as** creators supply their own recipients and we never
append platform promotion to their mail or sell/reuse their lists. The
suppression_list table (per-owner, provider-writable) is the enforcement
seam. Missing in product: one-click unsubscribe headers (RFC 8058) on bulk
sends, visible unsubscribe link, postal-address footer prompt for creators.
Required before any >5k/day sender onboards (Gmail/Yahoo bulk rules).

## R-6 · Deliverability — OPEN (inherent, managed)
Shared Resend IPs to start; DKIM d=creator.com gives DMARC alignment that
survives forwarding; DMARC rua centralized at the platform. Spam-rate
ceiling 0.1%/0.3% (Postmaster Tools) must be monitored once volume exists.
Dedicated IP / SES migration is the pressure valve (ARCHITECTURE DEC-005).

## R-7 · RLS on messages — CLOSED as designed
Deny-by-default; cross-user reads return zero rows (matrix T12/T14); the
search function is security *invoker* so RLS applies through it; queries in
`lib/messages/queries.ts` run user-scoped and must not be re-pointed at the
admin client (enforced by comment + review, not by types — residual).

## R-8 · Service-role blast radius — MITIGATED
`createAdminClient()` callers: inbound webhook (does its own mailbox
resolution; writes only into the resolved mailbox), dispatch ledger (writes
send_attempts for a message the caller just created), DNS job (reads
unverified domains, writes their own verification state), settings
check-now (ownership proven via RLS-scoped read first). Each caller
documents its own authorization. Residual: nothing *mechanically* prevents a
future caller from misusing it; CLAUDE.md invariant + review.

## R-9 · Design-archive confusion — MITIGATED
~70 root HTML mockups predate the app and once let "the repo looks like an
email product" pass for "the product works". CLAUDE.md quarantines them;
the kill-signal in ROADMAP.md ("adding mockups instead of connecting the
MTA") is the tripwire. Deleting them wholesale is Max's call (they may have
design value) → Q7.

## R-10 · Schema deployed nowhere — OPEN (deploy gate)
No Supabase project carries the Letters schema; every runtime path is
therefore untested against a live database. The branch's next step (task 8)
is a cost-gated deploy; until then the RLS matrix on postgres:16 is the
strongest evidence we have.
