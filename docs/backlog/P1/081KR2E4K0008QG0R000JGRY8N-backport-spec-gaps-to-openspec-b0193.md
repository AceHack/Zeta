---
id: 081KR2E4K0008QG0R000JGRY8N
priority: P1
status: open
title: Back-port spec gaps to OpenSpec — close gaps the recreation experiment reveals
tier: foundation
effort: M
ask: 081KQTPYE0008QG0R00392KABJ decomposition — close the loop (spec gaps → spec additions → specs become complete source of truth)
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQTPYE0008QG0R00392KABJ
depends_on: [081KR2E4K0008QG0R003KQKYTJ]
composes_with: [081KQTPYE0008QG0R00392KABJ, 081KQNJ500008QG0R001N94412, 081KR2E4K0008QG0R001BRHAPK]
tags: [bootstrap-razor, spec-gaps, openspec, backport, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R000JGRY8N — Back-port spec gaps to OpenSpec

## Parent

081KQTPYE0008QG0R00392KABJ (bootstrap razor + 23-hour recreation test).

## What

For each spec gap found in 081KR2E4K0008QG0R003KQKYTJ's findings:

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

1. Each gap from 081KR2E4K0008QG0R003KQKYTJ has a disposition: spec-written,
   spec-augmented, formal-spec-filed, or won't-spec (with
   rationale).
2. New/augmented specs pass `bun tools/openspec/inventory.ts`
   (coverage improves).
3. Gap count delta is documented (before vs after).

## Effort

M — depends on gap count; each individual spec is S but
there may be many.
