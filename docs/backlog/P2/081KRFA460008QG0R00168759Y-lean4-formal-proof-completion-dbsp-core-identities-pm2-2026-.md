---
id: 081KRFA460008QG0R00168759Y
priority: P2
status: open
title: "Lean 4 formal proof completion — DBSP chain rule + core stream-calculus identities"
type: feature
origin: PM-2 gap-prediction pass (081KR2E4K0008QG0R003VB7ZZR) 2026-05-13
created: 2026-05-13
last_updated: 2026-05-13
depends_on: []
composes_with: []
tags: [lean4, formal-verification, proof, dbsp, chain-rule, identities, correctness]
---

# 081KRFA460008QG0R00168759Y — Lean 4 formal proof completion for DBSP core identities

## PM-2 signal

Academic reviewers and enterprise adopters want to cite Zeta as a
verified DBSP implementation. `proofs/lean/ChainRule.lean` is a stub
(no proof body). The four core identities are tested as F# property
tests but carry no formal proof certificate. TECH-RADAR has Lean 4
on "Assess" since Round 10 with no promotion.

## What

1. Complete `proofs/lean/ChainRule.lean`:
   - `D ∘ I = id` (differentiation cancels integration)
   - `I ∘ D = id` (integration cancels differentiation)
   These are the bijection identities; they establish Z-sets form a
   group under the stream calculus.
2. Add `proofs/lean/LinearityRule.lean`:
   - For linear Q: `Q^Δ = Q` (trivial incrementalization).
3. Wire `lake build` in `proofs/lean/` as a CI check (new GitHub
   Actions step, not blocking the main .NET build gate).
4. Promote TECH-RADAR Lean 4 from Assess → Trial.
5. README "formally verified" badge after CI check is green.

## Why now

TECH-RADAR Lean 4 has been on "Assess" since Round 10 with no action.
The stub proof `ChainRule.lean` is a lying stub — it exists but proves
nothing. A complete proof of two identities is the minimum step to a
verified claim, independent of the heavier F* extraction track.

## Non-goals

- Does not prove every operator.
- Does not require a full Mathlib port.
- Does not block the F* extraction path (TECH-RADAR "Assess" — runs
  in parallel).

## Acceptance criteria

- [ ] `proofs/lean/ChainRule.lean` contains a complete proof with no `sorry`.
- [ ] `proofs/lean/LinearityRule.lean` exists with a complete proof.
- [ ] CI runs `lake build` in `proofs/lean/` and the step is green.
- [ ] TECH-RADAR Lean 4 row updated: Assess → Trial.

## Kill criteria

If the F* extraction path (TECH-RADAR entry) ships first and covers the
same identities, subsume this row under that PR and close here.
