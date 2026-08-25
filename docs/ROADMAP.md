# Letters — Roadmap

## D. The 14-day wins — status after this branch

**Win 1 — Outbound via a provider for one verified domain.**
Code: DONE (Resend adapter, dispatch ledger, honest UI states, tests).
Remaining to "a real message left": Resend account + API key in Vercel,
platform domain verified at Resend, deploy. ~Half a day of operator work
once Q1/Q2 (domain, account) are answered.

**Win 2 — DNS verify job flips domains to verified.**
DONE end-to-end in code: hourly cron route (bearer-authenticated), status
machine (absence ≠ failure ≠ outage), per-domain Check now, attempts log,
and the RLS hardening that makes the job the *only* thing that can flip
status. Needs: CRON_SECRET set in Vercel.

**Win 3 — Inbox + compose + send persist in Supabase for that domain.**
Code: DONE (folder views, compose→persist→dispatch, detail view with
delivery status). Blocked on: **a Supabase project existing** (schema is
deployed nowhere — the single biggest unlock, task 8 of this session).

**Found along the way (not in the plan, shipped anyway):** the schema
couldn't apply at all (R-0), two RLS privilege holes (R-1, R-2), missing
add-domain form, no mailbox-creation path (still open, S3), CI had no
database truth at all — now a postgres:16 job.

## Next 14 days (proposed order)

1. Deploy schema to a Letters Supabase project; run smoke (health?ready=1,
   sign-up, claim domain, verify against a real TXT record).
2. Mailbox creation UI on verified domains (S3 — the last gap in the loop).
3. Resend account: platform domain, API key, first real send to a Gmail
   address; screenshot the DKIM-pass headers as evidence.
4. Resend Inbound on a Mangu-owned test domain → Svix-verified adapter →
   our HMAC seam → reply lands in inbox. Loop closed.
5. Suppression management UI + provider bounce/complaint webhook rows.
6. RFC 8058 one-click unsubscribe headers on any bulk-ish send path +
   unsubscribe landing route (R-5 gate).
7. Trash auto-purge + retention schedule doc (R-4).
8. Operator dashboard slice: per-domain verification history, per-message
   ledger (P3).

## K. Prosperity plan

**Cash engine:** creator tools. Letters is the identity + correspondence
layer Mangu's publishing stack already needs; every Mangu imprint author is
a natural first tenant.

**Pricing (of record, from the brief):** $8/mo mailbox · $20/mo creator
domain (mailboxes + sending identity on one domain). Competitive posture:
don't fight Fastmail/Proton on mailbox price — sell the *one-vendor,
one-domain, one-bill* creator bundle (see COMPETITORS.md). Suggested tier
shape when billing lands: Mailbox $8 (1 mailbox, bring-your-domain) ·
Creator $20 (domain + 5 mailboxes + sending) · Press $49 (3 domains, 15
mailboxes, suppression tools) — validate against the first ten.

**First 10 customers:** Mangu team (2) + 8 authors from the press list —
onboard by hand, white-glove DNS (screen-share the TXT paste), in exchange
for weekly feedback. Their domains become the deliverability canaries.

**Kill signal:** HTML mockups accreting instead of MTA connection — see
PRD kill criterion. Secondary kill signal: 90 days post-launch, if <5 of
the first 10 send at least weekly from their Letters address, the identity
thesis is wrong; stop before building teams/mobile.

**Moat honesty:** none of this is defensible tech; the moat is trust +
audience (Mangu's press list) + the Skiff lesson (independence as a
feature). Ship the loop, publish the privacy posture (TLS + at-rest, no
E2EE claims), stay small and legible.
