# Letters — Competitor matrix

_Researched 2026-08-25 (14-agent web sweep; full evidence with sources in
`.plan/evidence/research-full.json`). Scores 1–5. Letters is **not** Gmail:
the job is "own your email identity on your own domain, privately, with
creator-grade sending" — no incumbent covers that intersection._

| Vendor | Privacy | Custom domain | Creator UX | Deliverability | Entry price (custom-domain tier) |
| --- | :-: | :-: | :-: | :-: | --- |
| Fastmail | 4 | 5 | 3 | 4 | $6/mo (included) |
| Proton Mail | 4 | 4 | 2 | 4 | $3.99/mo (1 domain) |
| HEY (37signals) | 4 | 3 | 3 | 4 | $12/user/mo (Work/Domains) |
| Skiff (defunct) | 3 | 4 | 3 | 2 | — (shut down by Notion 2024) |
| Google Workspace | 2 | 5 | 3 | 4 | $7/user/mo |
| ImprovMX | 3 | 4 | 3 | 4 | $9/mo (sending unlocked) |
| Resend (as product) | 3 | 4 | 2 | 3 | $0–20/mo (sending API only) |
| Buttondown | 4 | 4 | 5 | 4 | $9/mo (sending domain free all tiers) |
| Substack | 2 | 2 | 4 | 4 | 10% of revenue; email domain **never** |
| Migadu | 4 | 5 | 2 | 3 | $19/yr (unlimited domains) |
| Posteo | 5 | 1 | 2 | 4 | €1/mo (custom domain refused by design) |
| Mailbox.org | 4 | 3 | 2 | 4 | €3/mo (Standard) |

## What the matrix actually says

**Nobody holds the intersection.** The mailbox hosts (Fastmail, Proton,
Migadu, Mailbox.org, Posteo) all ban or throttle bulk/newsletter sending —
Proton caps ~1,000/day, Migadu's ToS prohibits newsletters outright, Fastmail
closes accounts for bulk. The creator-sending tools (Buttondown, Substack,
Resend) host no mailbox — creators still read replies in Gmail, so the
surveillance problem survives. Letters' wedge is being *creator-complete*:
mailbox + identity + sending on one domain.

**Price reality check for our $8/$20.** Fastmail includes 100 domains at
$6/mo and Proton a domain at $3.99/mo — Letters cannot win on mailbox price.
The $20 creator-domain tier competes instead with *stacks*: Fastmail ($6) +
Buttondown ($9+) + two DNS setups ≈ $15–35/mo across two vendors with no
shared identity. One-vendor, one-domain, one-bill is the pitch.

**Attack surfaces the research exposed:**
- *Fastmail*: no E2EE; Australian anti-encryption jurisdiction (publicly
  lost customers over it); US-stored mail.
- *Proton*: send-limited (not creator-usable); logged a French activist's
  IP (2021), Spanish de-anonymization (2024), 8.3k/9.3k Swiss legal orders
  complied in 2025; relocating infra out of Switzerland over new
  surveillance law.
- *Google*: Gemini-in-Gmail backlash + Illinois class action (2025);
  privacy-first users are actively leaving.
- *Substack*: From address is permanently @substack.com; Oct 2025 breach
  (~697k records, disclosed 4 months late); took $100M and launched native
  ads — the surveillance trajectory Letters positions against.
- *Mailbox.org*: unresolved custom-domain spoofing weakness (any account
  can send as another's custom domain) — a cautionary tale for our own
  outbound authorization: **we only send from verified-domain mailboxes.**
- *Skiff*: the market-proof and the warning. ~2M users wanted exactly this
  product; acquisition killed it in 6 months, and its successor (Notion
  Mail) dies 2026-09. "Small, independent, revenue-funded" is a *feature*
  to this audience — say so in marketing.

**The closest living analog is Buttondown** (indie, privacy-respecting,
$392k/yr bootstrapped, beloved) — but it's sending-only. Letters vs
Buttondown is mailbox + replies + identity vs newsletter tooling; a
partnership/import path is more natural than a fight.

## Scoring note

Deliverability scores reflect the *vendor's* track record, not Letters'.
Letters inherits Resend's shared-IP reputation at MVP (a 3) and buys up via
dedicated IP or SES + warm-up (DEC-005).
