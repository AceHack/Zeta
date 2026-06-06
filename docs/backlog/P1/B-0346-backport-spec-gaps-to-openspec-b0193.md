---
id: B-0346
zetaid: 081KR2E4K0008QG0R000JGRY8N
priority: P1
status: open
title: Back-port spec gaps to OpenSpec — close gaps the recreation experiment reveals
tier: foundation
effort: M
ask: B-0193 decomposition — close the loop (spec gaps → spec additions → specs become complete source of truth)
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0193
depends_on: [B-0345]
composes_with: [B-0193, B-0171, B-0340]
tags: [bootstrap-razor, spec-gaps, openspec, backport, trajectory-child]
type: friction-reducer
---

# B-0346 — Back-port spec gaps to OpenSpec

## Parent

B-0193 (bootstrap razor + 23-hour recreation test).

## What

For each spec gap found in B-0345's findings:

1. **Missing spec** — a code module exists in Zeta with no
   matching behavioral spec under `openspec/specs/`. Write
   the missing spec.
2. **Incomplete spec** — a spec exists but doesn't capture
   enough behavior for the fresh-context Otto to recreate
   equivalent code. Augment the spec.
3. **Missing formal spec** — an invariant or property exists
   in code but has no matching TLA+ or Lean proof. Add to
   the formal-verification backlog.

This closes the loop: the experiment reveals gaps → gaps
get filled → specs become a more complete source of truth →
the next recreation test should score higher.

## Acceptance criteria

1. Each gap from B-0345 has a disposition: spec-written,
   spec-augmented, formal-spec-filed, or won't-spec (with
   rationale).
2. New/augmented specs pass `bun tools/openspec/inventory.ts`
   (coverage improves).
3. Gap count delta is documented (before vs after).

## Effort

M — depends on gap count; each individual spec is S but
there may be many.
