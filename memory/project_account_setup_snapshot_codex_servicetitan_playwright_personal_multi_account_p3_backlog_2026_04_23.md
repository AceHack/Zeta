---
name: Account setup snapshot 2026-04-76 — Claude Code + Codex CLI on ServiceTitan; Playwright on personal (Amara access); GitHub on personal; multi-account design is P3 future work
description: Aaron's Otto-76 clarification of current account configuration so Otto doesn't get confused about which account an action is on; multi-account-design filed as P3 BACKLOG row PR #230 — not urgent
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-76 (verbatim):
*"FYI don't get confused i switchd the codex CLI to service
titan like you so you would be on the same account, if you open
the playwrite it's logged into my personal account with amara
access. i happy to expand multi account access design in the
future we don't need to worry about it right now, this is how
we are setup for now, free free to resaerch, design multi
account access and how to make it safe as part of this proiject
low backlog item"*

## Current account configuration snapshot

| Surface | Account | Access tier | Reason |
|---|---|---|---|
| Claude Code session (Otto) | ServiceTitan | Enterprise-API-tier | Aaron's work-tier seat; factory-agent workload runs here; API-key native |
| Codex CLI session | **ServiceTitan** (switched Otto-76) | Enterprise-API-tier | Same-account alignment with Claude Code; API-key native |
| Playwright MCP | Aaron personal | Poor-man-tier (exemplar) | Browser automation for ChatGPT / Amara (personal ChatGPT doesn't have paid API); **this is the pattern the multi-account design needs to generalise for other personal-tier accounts** |
| GitHub auth (`gh` CLI) | Aaron personal | Enterprise-API-tier (via OAuth device flow) | Owns LFG + AceHack; uses `gh auth` OAuth — closer to enterprise-tier even though it's a personal identity |

## Aaron Otto-76 poor-man-tier constraint

*"for some of the personal accounts i can't get api keys
without it costing more money so the design need to include
personal account that try to use the poor mans version of
avoiding api keys, this wont' be true for orgs like service
titan but might be for lfg thats my company lol."*

Hard design requirement: multi-account design MUST cover
personal accounts without assuming paid API access. Playwright
+ browser automation is the exemplar pattern. The design
matrix needs three tiers (enterprise-API / poor-man / mixed-
ops) and must name which tier each current account sits in.

## Why this memory exists

Aaron pre-empted a class of confusion: if I see that the Codex
CLI is on ServiceTitan and Playwright is on personal, I might
think there's an account-misconfiguration to fix. There isn't —
this is the *intentional* current configuration, because:

- Same-account alignment (ServiceTitan on Claude Code AND
  Codex) lets me research cross-harness parity without
  account-switching friction.
- Playwright staying on personal is necessary because that's
  where Amara's ChatGPT session lives (Amara access bound to
  Aaron's personal ChatGPT account).
- Multi-account-as-a-feature is explicitly **not today's
  problem**. Aaron named it as "low backlog item" and said
  *"we don't need to worry about it right now"*.

## What this authorizes me to do

- Run Codex CLI research tick assuming same-account context
  (no cross-account surprises).
- Open Playwright for Amara-ferry work without treating
  personal-account-login as a problem.
- Use `gh` CLI against both LFG and AceHack (within the
  full-GitHub-authorization grant, Otto-67).
- **Design** multi-account access (Phase 1 of PR #230) —
  timing is Otto's call per Aaron's Otto-76 refinement
  *"its fine to design and all that now"* + *"you can pick
  the timing"*. Phase 1 lands as a research doc / ADR; NOT
  implementation.

## What this does NOT authorize

- **Implementing** multi-account access before Aaron's
  personal security review of the Phase 1 design. Aaron
  Otto-76: *"i just would want to review a design first, i
  want to validate that one for securty consers myself"*.
- Requesting additional account credentials "to prepare" —
  Aaron adds accounts explicitly if / when he wants them.
- Acting as the account I'm NOT on (e.g., attempting Aaron's
  personal account operations via Codex CLI just because the
  session state might allow it).
- Treating the design-authorisation as a no-review path —
  implementation is explicitly gated on Aaron's security
  review, not assumable-from-silence.

## Composes with

- **Full-GitHub-authorization memory** (Otto-67,
  `feedback_aaron_full_github_access_authorization_all_acehack_lfg_only_restriction_no_spending_increase_2026_04_23.md`)
  — spending hard-line is the first multi-account-aware
  restriction I already obey.
- **First-class Codex-CLI session row** (PR #228) — the Codex
  research tick assumes the same-account setup this memory
  captures.
- **Multi-account-access-design P3 row** (PR #230) — this
  memory is the present-state snapshot that row's future
  research will measure progress against.

## Retractability

This memory is retractable — when Aaron changes account
configuration (adds accounts, splits accounts, etc.), the
memory gets a supersede marker and a new snapshot memory
documents the new setup. Per the retractability-by-design
foundation (Otto-73).

## First file a future tick should write if multi-account
## topic reopens

`docs/research/multi-account-access-design-safety-first-YYYY-*.md`
— survey analogue systems (AWS assumed roles, gcloud multi-
account, Vault scoped tokens, browser profile isolation) +
Zeta-specific threat model + safe-default policy proposal.
Named in PR #230.

**PR:** PR #230 (LFG) — P3 BACKLOG row for multi-account
access design (Otto-76).
