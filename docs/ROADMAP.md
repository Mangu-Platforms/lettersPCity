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

## Next 14 days — updated at end of session (most items landed same-day)

1. ~~Deploy schema~~ **DONE** (staging on `alice-chains`; advisors clean).
2. ~~Mailbox creation UI~~ **DONE** (settings, verified domains only).
3. Resend account: platform domain, API key, first real send to a Gmail
   address; screenshot the DKIM-pass headers as evidence. **← the next
   human step; everything downstream of it is code-complete.**
4. Resend Inbound: adapter is **DONE** (`/api/mail/resend`, Svix-verified,
   per-recipient delivery). Remaining: MX record + webhook config in the
   Resend dashboard once the account exists.
5. ~~Suppression UI + bounce/complaint rows~~ **DONE** (management page;
   bounce/complaint events attributed through the ledger).
6. RFC 8058: unsubscribe route + tokens **DONE**; remaining: attach
   List-Unsubscribe headers when a bulk/broadcast send path exists (no
   such path yet — deliberate).
7. ~~Trash auto-purge~~ **DONE** (trashed_at triggers + daily cron);
   retention schedule numbers still need Max's blessing (Q6).
8. ~~Operator slice~~ **DONE** (/settings/activity).

Newly next: Vercel project + env + crons (operator, ~1h); first real
send/receive on a Mangu domain; drafts; broadcast primitive design
(needs Q8/Q9 answers); DPA + retention schedule docs.

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
