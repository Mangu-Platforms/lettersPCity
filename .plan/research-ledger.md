# Research ledger — Letters

Claims are labeled FACT (directly verified), INFERENCE, ASSUMPTION, or
CONFLICT. Sources carry stable IDs.

## Sources

- SRC-001: repo README.md (known-gaps section)
- SRC-002: docs/INBOUND_MAIL.md (seam contract, provider options)
- SRC-003: supabase/migrations/*.sql (schema + RLS, read in full)
- SRC-004: app/ + lib/ source (read in full 2026-08-25)
- SRC-005: FORGE_PHASE1_PROGRESS.md (self-corrected; genome persistence had
  silently failed and was repaired in commit a37efa1)
- SRC-006: "Mangu Mail Phase 2 – Production-Grade Implementation.pdf" (540KB,
  root; skimmed for intent only — treat as aspiration, not spec)
- SRC-007: Supabase MCP — org project list + table listings (live query)
- SRC-008: git log (14 commits; app scaffold landed in 61d9dc0)
- SRC-009: background research workflow wf_804b9e30-8fe (competitors, MTA,
  compliance; pending)

## Claims

- FACT: No MTA integration exists; outbound stops at DB insert. (SRC-004:
  app/compose/page.tsx comment + code; package.json has no mail client)
- FACT: Letters schema deployed to no Supabase project in the org. (SRC-007)
- FACT: Inbound seam authenticates HMAC-SHA256 over raw body, constant-time;
  redelivery idempotent via unique index (mailbox_id, message_id). (SRC-003/004)
- FACT: RLS denies user-inserted `direction='inbound'` messages. (SRC-003)
- FACT: Mailbox creation requires a *verified* own domain (RLS with-check).
  (SRC-003) — so until DNS verify exists, no mailbox can be created without
  manually flipping `domains.status`. This makes the DNS job the critical
  unlock for the entire product loop.
- FACT: CI runs typecheck, lint, jest, build (placeholder env), forge build.
  (SRC-004 .github/workflows)
- INFERENCE: The compose flow has never been exercised against a real DB
  (schema nowhere deployed) — win #3 requires provisioning, not just code.
- CONFLICT: Forge vision said "not SendGrid/SES; we control the
  infrastructure" (SRC-002 quoting genome) vs README/INBOUND_MAIL.md
  accepting a provider relay as fastest path. RESOLVED toward provider relay
  for MVP by SRC-001/002 recency and the Vercel constraint; self-hosted MTA
  stays on the roadmap as the sovereignty path.
- ASSUMPTION: $8 mailbox / $20 creator-domain pricing from the brief is the
  pricing of record (matches brief section K; no contradicting source).
- UNKNOWN → for Max: which sending domain Mangu owns for Letters; brand
  ("Letters City" vs "Mangu Mail"); SES vs Resend preference; Supabase
  project budget approval.

## Session learnings (2026-08-25, appended at C10)

- FACT: Resend launched inbound receiving 2025-11-03 (webhook carries
  metadata + email_id; body via GET /emails/receiving/{id}; Svix-signed).
  Sources in .plan/evidence/research-full.json.
- FACT: This build container's egress gateway 403s CONNECT to
  *.supabase.co (verified via the agent-proxy status endpoint); the
  Supabase MCP rides a separate proxy. Any future in-container e2e demo
  needs an allowlist change or an external deploy.
- FACT: GoTrue password sign-in requires a row in auth.identities
  (provider='email'), not just auth.users — relevant for future seeding.
- INFERENCE: The "Migrations apply + RLS matrix" CI step takes <1s on a
  service container; its truthfulness was verified by reading the raw job
  log (all 7 migrations + RLS_MATRIX_PASSED present), not the green tick.
- DECISION DEC-006: drafts are insert-new + delete-old, never UPDATE —
  preserving the column-grant guarantee that message content is immutable
  to users after creation.
