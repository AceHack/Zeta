---
id: 081KQNJ500008QG0R002E583TF
priority: P2
status: open
title: Delta-CRDT property tests redesign — careful single-pass design after #1426 close
tier: formal-verification
effort: M
ask: Otto 2026-05-03 — closed PR #1426 after 5 reviewer threads surfaced distinct design issues; needs full-pass redesign rather than incremental property additions
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with:
  - docs/research/2026-05-03-math-proofs-honest-assessment.md
  - memory/feedback_under_specified_action_preconditions_recurring_class_in_formal_specs_aaron_2026_05_03.md
tags: [c3, fscheck, delta-crdt, anti-entropy, redesign, math-proofs-assessment]
type: friction-reducer
---

# 081KQNJ500008QG0R002E583TF — Delta-CRDT property tests redesign

## What happened

PR #1426 attempted to add delta-CRDT anti-entropy property tests with 3 (then 5) properties for `GCounterDelta` + `PNCounterDelta`. After review, 5 unresolved threads surfaced distinct correctness issues. PR closed honestly rather than ship a flawed property suite.

## Issues identified by reviewers

1. **Same-replica deltas built from same `priorDvv` carry identical dots.** Doesn't exercise the out-of-order anti-entropy case (two distinct successive deltas from one replica that arrive reordered).
2. **GCounter coverage misses within-replica path.** Successive causal-state deltas from one replica applied out of order — the genuinely interesting case for anti-entropy.
3. **PN same-replica test with unconstrained `int` falls back to disjoint-component scenario.** When `d1` and `d2` have opposite signs, one lands in P-side and one in N-side — the test loses its within-component-merge intent.
4. **Delta convergence checked on `Value` only, not full state.** Different internal states can have equal `Value`; full-state equality is the stronger invariant.
5. **Description/test-plan drift.** After adding properties post-review, the PR description didn't reflect the actual property count.

## Path forward (what the redesign should include)

- **Causal-state tracking via DVV.Sync chains.** Build a sequence of deltas where each carries a different causality (`priorDvv = previousDelta.Causality`) so out-of-order anti-entropy is genuinely tested.
- **Full-state equality, not just Value equality.** Compare on the underlying CRDT state representation directly (or convert both sides to a canonical form).
- **Per-component sign constraints.** For PNCounter, generate same-sign deltas explicitly to exercise within-component merge; have a separate test for cross-component (different sign) deltas to exercise disjoint-component merge.
- **Within-replica path coverage.** Two successive same-replica deltas with different dots, applied in different orders. Both for GCounter and PNCounter.
- **Idempotence on full state.** `apply(apply(s, d), d) == apply(s, d)` on full state, not just Value.
- **Single-pass design.** Land all properties together, not incrementally. Each property's domain constraints should be visible in the property name (mirrors LWW-Register's `under unique replica ids` pattern from #1424).

## Effort

M — 1-2 days of careful design + implementation. Worth doing properly because the layer-protected (DeltaCrdt's apply) is a foundational anti-entropy contract; partial coverage that misses within-replica path could mask future regressions.

## Composes with

- `feedback_under_specified_action_preconditions_recurring_class_in_formal_specs_aaron_2026_05_03.md` — same author-time class: missing precondition / domain constraint that lets a property "pass" without actually validating the law.
- The 14+ already-merged C3 properties (PN-Counter, OR-Set, LWW-Register, MerkleTree) substantially close the C3 → B grade upgrade in the math-proofs assessment; this row tracks the residual delta-CRDT layer.

## Why P2 (not P1)

- The math is already proven via Z3 axioms (8 unbounded-Int theorems) + Lean Mathlib chain rule. Delta-CRDT property tests pin the F# wrapper layer; failures wouldn't invalidate the underlying math, only the wrapper's correctness.
- C3 row in math-proofs assessment is substantially closed by the merged properties; this row is residual coverage, not a load-bearing gap.
- 1-2 day effort with multi-axis constraints — worth doing right rather than rushed.

## Acceptance criteria

- [ ] DVV.Sync chain builds successive deltas with distinct causality
- [ ] Full-state equality used (not just Value equality)
- [ ] Per-component sign constraints for PNCounter same-replica properties
- [ ] Within-replica out-of-order anti-entropy case covered for both GCounter and PNCounter
- [ ] Idempotence checked on full state, not just Value
- [ ] Single PR with all properties — no incremental additions
- [ ] PR description matches the property set actually validated
