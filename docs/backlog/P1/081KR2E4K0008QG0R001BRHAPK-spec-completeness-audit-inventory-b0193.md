---
id: B-0340
zetaid: 081KR2E4K0008QG0R001BRHAPK
priority: P1
status: closed
title: Spec completeness audit — run inventory.ts, document coverage gaps
tier: foundation
effort: S
ask: B-0193 decomposition — informs minimal bootstrap seed (what specs cover, what's missing)
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0193
depends_on: []
composes_with: [B-0193, B-0171, B-0339, B-0341]
tags: [bootstrap-razor, spec-completeness, openspec, inventory, audit, trajectory-child]
type: friction-reducer
---

# B-0340 — Spec completeness audit

## Parent

B-0193 (bootstrap razor + 23-hour recreation test).

## What

Run `bun tools/openspec/inventory.ts` (landed in B-0171,
PR #2147) against the current codebase and document:

1. Which `src/` modules have matching specs under
   `openspec/specs/`.
2. Which modules lack specs (spec-gap inventory).
3. Which specs reference code that no longer exists
   (spec-drift inventory).
4. Coverage of `docs/*.tla` formal specs vs code modules.

The output informs B-0341 (what to seed the test repo with)
and validates the "specs as source of truth" claim — if
large code areas lack specs, the 23-hour recreation test
will fail there by design, revealing the gap.

## Acceptance criteria

1. `bun tools/openspec/inventory.ts` runs cleanly and output
   is captured in `docs/bootstrap-razor/SPEC-AUDIT.md`.
2. Each gap is classified: spec-missing, spec-stale,
   formal-spec-missing.
3. Gap count is a numeric metric citeable by B-0341.

## Effort

S — run existing tool, format output.
