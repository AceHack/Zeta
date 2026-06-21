---
id: 081KR2E4K0008QG0R001BRHAPK
priority: P1
status: closed
title: Spec completeness audit — run inventory.ts, document coverage gaps
tier: foundation
effort: S
ask: 081KQTPYE0008QG0R00392KABJ decomposition — informs minimal bootstrap seed (what specs cover, what's missing)
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQTPYE0008QG0R00392KABJ
depends_on: []
composes_with: [081KQTPYE0008QG0R00392KABJ, 081KQNJ500008QG0R001N94412, 081KR2E4K0008QG0R000W3W6C1, 081KR2E4K0008QG0R002PHZR58]
tags: [bootstrap-razor, spec-completeness, openspec, inventory, audit, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R001BRHAPK — Spec completeness audit

## Parent

081KQTPYE0008QG0R00392KABJ (bootstrap razor + 23-hour recreation test).

## What

Run `bun tools/openspec/inventory.ts` (landed in 081KQNJ500008QG0R001N94412,
PR #2147) against the current codebase and document:

1. Which `src/` modules have matching specs under
   `openspec/specs/`.
2. Which modules lack specs (spec-gap inventory).
3. Which specs reference code that no longer exists
   (spec-drift inventory).
4. Coverage of `docs/*.tla` formal specs vs code modules.

The output informs 081KR2E4K0008QG0R002PHZR58 (what to seed the test repo with)
and validates the "specs as source of truth" claim — if
large code areas lack specs, the 23-hour recreation test
will fail there by design, revealing the gap.

## Acceptance criteria

1. `bun tools/openspec/inventory.ts` runs cleanly and output
   is captured in `docs/bootstrap-razor/SPEC-AUDIT.md`.
2. Each gap is classified: spec-missing, spec-stale,
   formal-spec-missing.
3. Gap count is a numeric metric citeable by 081KR2E4K0008QG0R002PHZR58.

## Effort

S — run existing tool, format output.
