# CLAUDE.md — Letters

Letters is privacy-first email hosting for indie creators: custom domains,
clean UX, no surveillance. This file is the execution manifest for anyone —
human or agent — working in this repo.

## What is real and what is not

| Path | Status |
| --- | --- |
| `app/`, `lib/`, `supabase/`, `middleware.ts`, `tests/` | **The product.** Next.js 14 App Router + Supabase. |
| `src/forge/` | The Forge design layer (agents, genome, constitution). Typechecked in CI; not the product. |
| Root `*.html`, `download*`, `delegat` | **Design archive.** Gmail-style mockups predating the app. Never treat as the app, never import from, never extend. |
| `Mangu Mail Phase 2 – ….pdf`, `FORGE_PHASE1_PROGRESS.md` | Historical planning documents. Read as evidence, not as ground truth. |

## Ground truth as of 2026-08-25

- **No message has ever been sent.** Compose persists to `messages` with
  `folder='sent'` and stops. There is no MTA client in the dependency tree.
- **The schema has never been deployed.** No Supabase project in the org
  carries the Letters tables. The app has never had a live backend.
- Domain verification UI shows a TXT token; the DNS check + status flip is
  the `lib/domains/` + cron seam.
- Inbound mail arrives only through `POST /api/mail/inbound` (HMAC-signed).
  See `docs/INBOUND_MAIL.md` — that seam contract is stable; adapters
  translate provider webhooks to it, the app does not change per provider.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run typecheck` | `tsc --noEmit` — must pass before any commit |
| `npm test` | Jest (pure unit tests, no network, no DB) |
| `npm run lint` | ESLint via `next lint` |
| `npm run build` | Production build (works with placeholder env — keep it that way) |
| `npm run forge:build` | Typecheck + emit the Forge CLI |

## Invariants — do not break these

1. **RLS is the access control.** `lib/messages/queries.ts` and every
   user-facing query run through the user-scoped client. Only the inbound
   webhook and cron jobs use `createAdminClient()`, and each such caller must
   do its own authorization and say so in a comment.
2. **Env is validated lazily** (`lib/env.ts`). `next build` must never
   require real secrets. New env vars go through the Zod schemas there;
   optional integrations use `.optional()` and fail at *use*, not boot.
3. **The inbound seam is HMAC over raw bytes.** Signature checks read
   `request.text()` first and never re-serialize before verifying.
4. **Users cannot forge inbound mail.** The RLS insert policy on `messages`
   refuses `direction='inbound'` from user sessions. Keep it that way.
5. **Tests stay pure.** `tests/` runs without network or database. DB-shaped
   logic is factored so its decision core is testable (see
   `lib/messages/signature.ts` as the pattern).
6. **Migrations are additive and ordered.** New DDL is a new
   `supabase/migrations/<n>_name.sql`; never edit an applied migration.
7. **Mail transfer does not run on Vercel.** Outbound goes through a provider
   API (see `lib/mail/`); inbound through the webhook seam. No SMTP listeners
   in this repo.

## Forbidden shortcuts

- No disabling RLS, tests, lint rules, or the HMAC check to make something pass.
- No secrets in files — `.env.local` only, never committed.
- No new root-level HTML mockups. UI work happens in `app/`.
- No `getSession()` where `getUser()` is meant (middleware revalidates).

## Working agreement for agents

- Current program state lives in `.plan/execution-state.md`; evidence in
  `.plan/evidence/`. Resume from there, not from memory.
- Verification: `npm run typecheck && npm run lint && npm test` before every
  commit; `npm run build` before every push.
- Branch: work lands on `claude/letters-platform-architecture-fztmb0` until
  its PR merges.
