---
id: B-0321
priority: P1
status: open
title: "Guarded UI mutation helpers — click/fill/save with before-after snapshots and authorization check"
tier: agent-capability-expansion
effort: M
parent: B-0064
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0317, B-0318, B-0320]
composes_with: [B-0064, B-0322]
tags: [agent-capability, github-ui, playwright, mutation, guardrails, safety]
type: friction-reducer
---

# Guarded UI mutation helpers

Build `tools/playwright/github-ui/mutate.ts` — helpers that
let the agent change GitHub UI settings through Playwright,
with mandatory guardrails: authorization check against the
surface list (B-0320), before-and-after snapshots (B-0318),
and visibility constraint satisfaction.

## Why

This is Phase 2 of B-0064 — the friction-reduction payload.
Every time Aaron has to manually click a GitHub toggle because
the API doesn't expose it, that's a maintainer interrupt.
This tool eliminates that interrupt for pre-authorized
surfaces.

## Scope

- Implement a TS module that:
  1. Accepts a mutation request: `{ surfaceId, action, params }`.
  2. Validates `surfaceId` against
     `authorized-surfaces.json` (B-0320) — rejects if not
     found.
  3. Takes a **before snapshot** via B-0318.
  4. Executes the mutation (click toggle, fill form, save).
  5. Takes an **after snapshot** via B-0318.
  6. Computes a structured diff (before vs after).
  7. Logs the mutation to the drain log (B-0322).
  8. Returns `{ success, before, after, diff, drainLogEntry }`.
- Guardrails (in code, not discipline):
  - Authorization check is mandatory — no bypass path.
  - Before/after snapshots are mandatory — mutations without
    snapshots fail.
  - Visibility constraint: the diff is echoed to chat output
    per the don't-ask-permission echo discipline.
  - Reversibility: the module records the inverse action
    in the drain log entry.

## Done-criteria

- [ ] `tools/playwright/github-ui/mutate.ts` exists.
- [ ] Authorization check rejects unlisted surfaces.
- [ ] Before/after snapshot pair is captured for every
      mutation.
- [ ] At least one end-to-end mutation demonstrated
      (e.g., toggling a Dependabot setting).

## What this row does NOT do

- Does NOT define the authorized surfaces — that is B-0320.
- Does NOT implement the reversibility drain log format —
  that is B-0322.
- Does NOT bypass branch-protection or required-review
  governance — UI mutations go through the same audit
  trail as API mutations.
