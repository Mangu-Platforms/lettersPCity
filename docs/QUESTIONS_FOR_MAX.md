# Questions for Max

_Compiled during the 2026-08-25 autonomous session. Nothing here blocked the
build; each has a stated assumption I proceeded on. Answer at leisure —
answers change configuration, not architecture._

## Q1 — Which domain does Letters itself live on?
The platform needs a domain for transactional mail, the DMARC report
mailbox, and eventually the product itself. Is there one already owned
(letterscity.com? lettersp.city? mangumail.com?), or should one be bought?
**Assumed:** none yet; all code is domain-agnostic.

## Q2 — Brand: "Letters City", "Letters", or "Mangu Mail"?
The repo says lettersPCity, the app says Letters, the Phase 2 PDF says
Mangu Mail. This decides the domain purchase, the From footer, and the DNS
record prefix (currently `_letters.`, which would be annoying to change
after launch).
**Assumed:** "Letters" as product name; `_letters.` kept.

## Q3 — Resend vs SES vs Postal: confirm the pick
I chose **Resend for MVP (both outbound and inbound — they launched inbound
Nov 2025), SES as the documented scale path, Postal as the eventual
sovereignty path** (full comparison in ARCHITECTURE.md + evidence file).
Veto window is open until the Resend account is created; the adapter seam
makes a change cheap.

## Q4 — May I create a Supabase project for Letters?
The schema is deployed nowhere, which blocks every runtime milestone. If a
project add costs money on the org plan I will not create it without a nod;
if it's within the free allowance I'll proceed (checked at task 8 — see
execution-state for what actually happened).

## Q5 — Vercel plan: is this org on Pro?
The verify cron is hourly (`vercel.json`); Hobby only allows daily crons.
The per-domain "Check now" button covers the UX either way.
**Assumed:** Pro, or daily is acceptable initially.

## Q6 — Retention policy numbers
Proposed defaults (R-4): trash auto-purge 30 days; failed inbound-webhook
payloads never stored; send_attempts kept 12 months then aggregated;
deleted-account data hard-deleted within 30 days, backups age out ≤35 days.
Blessing needed before it goes in the Terms/DPA.

## Q7 — May I delete the ~70 root HTML mockups?
Quarantined in CLAUDE.md as design archive; git history preserves them
forever. Deleting them makes the repo state undeniable (and removes the
kill-signal temptation). Reversible with one revert.

## Q8 — First-10 list
ROADMAP.K says Mangu team + 8 authors from the press list. I need names/
domains only when onboarding starts (next-14-days item 4+). Anyone who
should *not* be a deliverability canary?

## Q9 — Pricing blessing
$8 mailbox / $20 creator-domain treated as pricing of record; competitors
undercut on raw mailboxes (Fastmail $6 includes domains) but nobody bundles
the creator loop — the $20 tier is defensible, the $8 tier is marketing
(details in COMPETITORS.md). OK to bake into a pricing page copy draft?

## Q10 — E2EE positioning
We are TLS-in-transit + at-rest, *not* end-to-end, and competitors will
point it out. I propose we say it plainly on the privacy page (Skiff had
E2EE and still died; Fastmail thrives without it). Comfortable with that
posture, or is E2EE a v2 commitment we should signal?
