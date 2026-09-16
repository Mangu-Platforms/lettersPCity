# Vercel — Letters P City

Git-linked project. Every push to `main` builds and deploys automatically.
Preview deployments also fire for every other branch and pull request.

## Project

| Field | Value |
| --- | --- |
| Vercel team | `redinc23s-projects` (`team_hc9sovtwUu2WJdNuoU7JtWUP`) |
| Project name | `letters-p-city` |
| Project id | `prj_YqGDC9ADLUf3pKq0vRZ9EvAQJ84j` |
| Framework | Next.js 14 (App Router), detected |
| Region | `iad1` (see `vercel.json`) |
| Git | `Mangu-Platforms/lettersPCity` → production branch `main` |

## Live URLs

| Kind | URL |
| --- | --- |
| Production | https://letters-p-city.vercel.app |
| Team alias | https://letters-p-city-redinc23s-projects.vercel.app |
| Git `main` alias | https://letters-p-city-git-main-redinc23s-projects.vercel.app |
| Dashboard | https://vercel.com/redinc23s-projects/letters-p-city |

Latest preview from `main` @ `2233adda`:
https://letters-p-city-o8k1u418p-redinc23s-projects.vercel.app

## Crons (`vercel.json`)

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/domains/verify` | `0 * * * *` | hourly DNS TXT ownership check |
| `/api/cron/housekeeping` | `30 3 * * *` | purge trash older than 30 days |

Both routes require `Authorization: Bearer $CRON_SECRET`.
Vercel Cron sends that header when `CRON_SECRET` is set in the project env.

## Environment (Vercel dashboard, never git)

Set these on the project for **Production** and **Preview**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
INBOUND_MAIL_WEBHOOK_SECRET
MAIL_PROVIDER                 # noop | resend
RESEND_API_KEY                # when MAIL_PROVIDER=resend
RESEND_INBOUND_WEBHOOK_SECRET # whsec_...
CRON_SECRET                   # >=16 chars
```

Copy the contract from `.env.example`. Do not commit real values.
Without the Supabase keys the app still builds; `/api/health?ready=1`
and signed-in routes will fail closed.

## How a change ships

1. Push to `main` (or open a PR — preview URL is posted on the GitHub check).
2. Vercel installs `npm` deps, runs `npm run build`, deploys the Next.js output.
3. Production domain updates only when the production branch (`main`) succeeds.

Local preview of the same build:

```bash
npm install
cp .env.example .env.local
npm run build && npm start
```

## Protection

New projects on this team use the team's default deployment protection.
If a preview URL returns 401/403, open it while signed into Vercel or use
the share-link from the deployment inspector.

## Honest limits

- This repo is the Next.js 14 + Supabase Letters platform (inbound webhook,
  Resend outbound, DNS verify, RLS). It is what Vercel is building today.
- A parallel TanStack Start / HEY-style desk prototype was explored in a
  local App Builder session. That tree is **not** in this repository and
  was not deployed here. Port it as a follow-up branch if it should replace
  or sit beside the App Router UI.
