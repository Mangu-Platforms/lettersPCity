# Letters

Privacy-first email hosting for indie creators. Custom domains, clean UX,
standards-based, no surveillance.

Built with **Forge** — the autonomous product foundry in `src/forge/`, which
produced this product's vision, requirements and roadmap before any of the app
was written.

## Stack

Deliberately identical to `mangu-publishers`, so the two repos are one stack:

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database / auth / storage | Supabase (Postgres, RLS, Auth) |
| Styling | Tailwind CSS |
| Validation | Zod |
| Tests | Jest |

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project values
npm run dev                    # http://localhost:3000
```

Apply the schema to a Supabase project:

```bash
supabase link --project-ref <ref>
supabase db push               # runs supabase/migrations/*.sql in order
```

## Layout

```
app/                    Next.js App Router
  login/                sign in + sign up
  inbox/                message list, search, message detail
  compose/              outbound composition
  settings/domains/     custom domain setup + DNS verification
  api/health/           liveness, and ?ready=1 readiness against Supabase
  api/mail/inbound/     HMAC-signed inbound mail webhook
lib/
  env.ts                Zod-validated environment contract
  supabase/             browser, server and middleware clients
  messages/             query layer + webhook signature verification
supabase/migrations/    schema, RLS policies, search function
src/forge/              the Forge design layer (agents, genome, constitution)
tests/                  Jest
docs/INBOUND_MAIL.md    why inbound SMTP is not on Vercel, and the seam it uses
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest |
| `npm run forge:research` | Re-run the research swarm agents |
| `npm run forge:design` | Re-run the product design agents |
| `npm run forge:build` | Typecheck + emit the Forge CLI |

`genome.json` and `output/` are build products of the two `forge:` commands and
are not committed.

## Known gaps

- **Inbound mail is not yet connected to a relay.** The HMAC webhook seam
  exists and is tested; no provider delivers into it yet. See
  `docs/INBOUND_MAIL.md`.
- **Outbound needs a provider account.** The compose path hands mail to the
  provider behind `lib/mail/` (Resend adapter shipped; `MAIL_PROVIDER=noop`
  default records sends as `skipped`). Sending for real requires a Resend
  API key and a verified sending domain — see `docs/ARCHITECTURE.md`.
- **Domain verification is automated but needs the cron secret.** The DNS
  TXT check runs hourly via `/api/domains/verify` (plus a per-domain
  "Check now" button); set `CRON_SECRET` in Vercel or the job stays off.
- Encryption is TLS-in-transit only. Teams, mobile apps and AI features are
  v2+ per the roadmap in the genome.

## Database checks

`scripts/db-check.sh` applies every migration to a scratch Postgres (using
`supabase/tests/shim.sql` to stand in for a Supabase project) and runs
`supabase/tests/rls_matrix.sql` — 15 behavioral assertions that forged
inbound mail, self-verified domains and cross-user reads stay impossible.
CI runs it against a `postgres:16` service on every push.
