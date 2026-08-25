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

- C0 (this commit): recon complete, baseline green, survival files written.
  Next action: migration 4.

## Blockers

- None.

## In-flight background work

- Workflow `wf_804b9e30-8fe` (letters-market-research): 14 research agents
  (12 competitors, MTA landscape, compliance). Results feed docs/COMPETITORS.md
  and docs/ARCHITECTURE.md. If it returns empty, read its journal.jsonl before
  assuming loss.
