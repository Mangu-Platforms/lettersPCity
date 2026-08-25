# Execution state — Letters platform build

**Mission:** 10-hour autonomous session (2026-08-25, authorized by Max,
max@mangu-publishers.com): map the repo, deliver the architecture/PRD pack
(deliverables A–L), and implement the 14-day wins — outbound mail seam,
DNS verification job, persistent inbox/compose — on branch
`claude/letters-platform-architecture-fztmb0`. Draft PR at the end.
Questions compiled in `docs/QUESTIONS_FOR_MAX.md`, never blocking.

**Branch:** `claude/letters-platform-architecture-fztmb0` (checked out, clean)
**Verification gate:** `npm run typecheck && npm run lint && npm test && npm run build`

## Established facts (do not re-derive)

- Baseline green: typecheck ✓, 11/11 jest ✓ (evidence: .plan/evidence/C0-baseline.log)
- **No message ever sent**: compose persists `folder='sent'` and stops; no MTA
  client exists in package.json; no MTA code in git history.
- **Schema never deployed**: no Supabase project in org `cdtsocpicbaaprzrvhau`
  has the Letters tables (checked all 5 active projects 2026-08-25).
- Migrations 1–3 are sound: deny-by-default RLS, `(mailbox_id, message_id)`
  unique index for idempotent redelivery, generated tsvector search, RLS
  refuses user-forged `direction='inbound'`.
- Inbound webhook: HMAC-SHA256 over raw bytes, constant-time compare, tested
  (6 signature tests). Uses service-role client, resolves mailbox itself.
- Root HTML files (≈70) are design archive — quarantined by CLAUDE.md, left
  untouched on disk.
- Forge (`src/forge/`) is the design layer; FORGE_PHASE1_PROGRESS.md admits a
  corrected genome-persistence failure; treat its claims as evidence only.

## Decisions (DEC log)

- DEC-001: MVP outbound = **Resend** (API-first, per-domain DKIM onboarding,
  free tier); SES documented as the scale/exit path. Pending research
  workflow confirmation; adapter interface keeps the choice reversible.
- DEC-002: MVP inbound = provider relay translated to the existing HMAC seam
  (candidates: SES-receive+Lambda, Postmark inbound, Cloudflare Email
  Routing); final pick recorded in docs/ARCHITECTURE.md after research lands.
- DEC-003: Plan files committed to the repo (.plan/) so any future session
  cold-starts from disk.
- DEC-004: New tables: `send_attempts`, `suppression_list`,
  `domain_verification_attempts` (brief's "domain_verify"). Additive
  migration 4; existing tables not redrawn.

## Task queue (mirrors TaskList)

1. ✅→ in progress: survival files + checkpoint 0
2. Migration 4 (send_attempts, suppression_list, domain_verification_attempts)
3. lib/mail outbound seam + env + tests
4. Compose wiring + sent folder view
5. DNS verify job + cron + tests
6. Docs pack A–L (research workflow wbarf82io feeding competitor matrix)
7. CI + README updates
8. Supabase deploy (cost-gated; else question for Max)
9. Push, draft PR, session report artifact

## Milestone budget / pace triggers

- M1 (code: tasks 2–5) target: by checkpoint 8. If not green by checkpoint 10,
  descope tier 1: drop the settings-page "Check now" button, keep cron route.
- M2 (docs: task 6) target: by checkpoint 12. If research workflow hasn't
  returned by then, write the matrix from repo evidence + provider docs and
  mark rows UNVERIFIED.
- M3 (deploy+PR: tasks 7–9) target: by checkpoint 15.

## Checkpoint ledger

- C0 8ae596f: recon complete, baseline green, survival files written.
- C1 70c0ec2: **migration 2 was broken at source** (unqualified message_id in
  6 policies → uuid=text; never applied anywhere) — repaired in place;
  migration 4 added (send_attempts, suppression_list,
  domain_verification_attempts, column-level UPDATE hardening that closes
  self-verify + direction-rewrite holes). Evidence:
  .plan/evidence/C1-rls-matrix.log (15/15).
- C2 2f85bad: lib/mail seam (Resend adapter, noop, dispatch ledger, plan
  logic); env grows MAIL_PROVIDER/RESEND_API_KEY/CRON_SECRET. 28 tests.
- C3 45dfbf7: compose dispatches + honest outcome banners; folder tabs;
  delivery status on detail view. Full gate green incl. build.
- C4 035eb3b: DNS verification — lib/domains/verify.ts status machine,
  hourly cron route (bearer CRON_SECRET), add-domain + Check now on
  settings. 40 tests.
- C5 0d9d31e: db-check.sh + shim + rls_matrix.sql committed and wired into
  CI as postgres:16 service job (verified green locally); README/docs
  refreshed. Next action: docs pack A–L (task 6).

## Blockers

- None.

## In-flight background work

- Workflow `wf_804b9e30-8fe` (letters-market-research): 14 research agents
  (12 competitors, MTA landscape, compliance). Results feed docs/COMPETITORS.md
  and docs/ARCHITECTURE.md. If it returns empty, read its journal.jsonl before
  assuming loss.

- C6 26cf7a1: docs pack A–L committed (research from 14-agent workflow;
  evidence in .plan/evidence/research-full.json). DEC-002 updated: Resend
  Inbound (launched Nov 2025) = MVP inbound; DEC-005 SES scale path.
- C7 570e244: **live deploy**. New Supabase project costs $10/mo (Pro org)
  → NOT created without Max (Q4). Deployed instead to the empty project
  `alice-chains` (ibhubceuifgjshjaggtz, created same day, zero tables) as
  zero-cost staging. All 6 migrations applied; live 15-check RLS matrix
  passed; advisors: security 0 lints, performance INFO-only. Migrations
  5 (advisor hardening) + 6 (initplan) born from live findings.
  NOTE for Max: alice-chains now carries the Letters schema — rename it
  or say the word and I stand up a dedicated $10/mo project.
- C8 af93ccc..3b274db: post-PR slices — mailbox creation UI (loop closed),
  suppression UI + RFC8058 one-click unsubscribe (purpose-separated HMAC
  tokens), inbound v2 scheme (replay window + 1MB cap), Resend adapter
  (/api/mail/resend: Svix verify, receiving-API fetch, shared delivery
  core, bounce/complaint -> suppression via ledger attribution), trash
  retention (trashed_at triggers + daily housekeeping cron; migration 7
  live). 70 tests. PR #3 updated.
- C9 a3a4bcb..890ddfa: message actions + threaded replies; activity page;
  route-level tests for both webhook routes (84 total). CI verified green
  in GitHub Actions incl. database job (RLS_MATRIX_PASSED in the log).
  PR #3 description refreshed; ROADMAP statuses updated (items 1,2,4,5,7,8
  DONE). Next: render smoke vs staging, session report artifact.
- C10: live render smoke (landing/login 200, health ok vs staging; egress
  gateway blocks *.supabase.co from this container -> full walkthrough
  needs a deploy, logged as Q11). Smoke user seeded+removed (auth.users
  back to 0). Session report artifact published:
  https://claude.ai/code/artifact/383f79d0-d48e-4bfc-a8ea-0db9e3749f19
