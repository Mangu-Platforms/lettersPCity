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

- **Inbound and outbound mail are not connected to any MTA.** The webhook seam
  exists and is tested; nothing delivers through it yet. See
  `docs/INBOUND_MAIL.md`.
- **Domain verification is not automated.** The TXT record and token are shown
  in settings; nothing checks DNS and flips the status to `verified` yet.
- Encryption is TLS-in-transit only. Teams, mobile apps and AI features are
  v2+ per the roadmap in the genome.
