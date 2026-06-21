---
id: 081KQNJ500008QG0R003DMVGZB
priority: P1
status: closed
title: Fix SpineMergeInvariants.tla counterexample (closed — Cascade downstream-room precondition + state constraint; B1 → A CI registration landed)
tier: formal-verification
effort: M
ask: Otto 2026-05-03 verify-then-claim sweep (#1397) — running TLC on `SpineMergeInvariants` produces a TTrace dump, indicating counterexample / invariant violation. Sibling failure to 081KQNJ500008QG0R000S68KDE SpineAsyncProtocol but at deeper depth.
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [docs/research/2026-05-03-math-proofs-honest-assessment.md, docs/research/proof-tool-coverage.md, 081KQNJ500008QG0R000S68KDE, 081KQNJ500008QG0R0001QHA1J, 081KQNJ500008QG0R001N1AAJ9]
tags: [tla-plus, formal-verification, spine-merge, balanced-spine, counterexample, b1, math-proofs-assessment, verify-then-claim, closed]
---

# Fix SpineMergeInvariants.tla counterexample

## Symptom

Running `java -cp tools/tla/tla2tools.jar tlc2.TLC -workers 4 -config tools/tla/specs/SpineMergeInvariants.cfg tools/tla/specs/SpineMergeInvariants.tla` produces a TTrace dump:

```
Trace exploration spec path: tools/tla/specs/SpineMergeInvariants_TTrace_<ts>.tla
The depth of the complete state graph search is 17.
Finished in 00s
```

TLC dumps a trace file when it finds an invariant violation. The depth-17 termination suggests TLC explored 17 transitions before finding the violation — deeper than the SpineAsyncProtocol failure (depth 9), which may indicate the violation is more subtle (further from initial state, requires more interleaving to manifest).

## Investigation summary (resolved)

The TTrace dump at the depth-16 state showed `levels[1] = 10 > 2*Cap(1) = 8` after a Cascade(0)→Cascade(0)→Cascade(0)→Cascade(0)→Cascade(0) sequence with no Cascade(1) ever firing. Failure-class triage found:

- **Not a spec-models-protocol-incorrectly bug**: the `Cascade(i)` action's *primary effect* (move levels[i] to levels[i+1]) is correct
- **Not invariant over-specification**: `InvCap` (each level ≤ 2*Cap) is the right safety property — BalancedSpine.fs maintains it in production
- **Not real-bug-found in BalancedSpine.fs**: production code performs synchronous cascades — if level i+1 is full, level i must wait for i+1 to drain before dumping; the spec's `Cascade(i)` action lacked this neighboring-state precondition

The fix (below) adds the missing precondition so the spec correctly models BalancedSpine.fs's synchronous cascade chain.

## Why P1 (after investigation)

Failure class: **spec under-specification**, not real BalancedSpine.fs bug. The original `Cascade(i)` action checked only `levels[i] >= Cap(i)` — it could fire with no constraint on level i+1, even when level i+1 was already at the cap-overshoot boundary. Real LSM cascades chain synchronously: if level i+1 is full, level i+1 must drain first before level i can dump. The spec failed to model this constraint, allowing TLC to find a 16-step trace where Cascade(0) fires 5 times in a row, accumulating level 1 to 10 > 2*Cap(1) = 8.

Promoted P2 → P1 because the same spec-pattern (under-specified action with insufficient preconditions) was found in 081KQNJ500008QG0R001N1AAJ9 (Spine.als) — same author-time class, two-tool surface.

## What landed

1. **Spec fix** (`tools/tla/specs/SpineMergeInvariants.tla`): added `levels[i+1] + levels[i] <= 2 * Cap(i+1)` precondition to `Cascade(i)` — mirrors the synchronous cascade chain in BalancedSpine.fs
2. **Liveness fairness**: added `\A i \in 0..(MaxLevel - 1): WF_vars(Cascade(i))` so cascades eventually fire for the LivDrained property
3. **State constraints**: `StateBound` (totalInserted ≤ 30) + `PendingBound` (Len(pendingIn) ≤ 4) keep TLC's BFS tractable; with bounded constants MaxLevel=2, MaxBatchSize=1, the bounded-model check completes in under a second with 400 distinct states explored at depth 45
4. **Both invariants now checked**: cfg lists `INVARIANT InvCap` AND `INVARIANT InvMass` (mass-conservation was previously declared in the THEOREM but not enabled in the cfg)
5. **F# CI registration**: `[<Fact>] TLC validates SpineMergeInvariants` added to `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs`
6. **TLC runtime artifacts**: `tools/tla/specs/states/` + `tools/tla/specs/*_TTrace_*.{tla,bin}` added to `.gitignore`

## Verification

```bash
cd tools/tla/specs
java -cp ../tla2tools.jar tlc2.TLC SpineMergeInvariants
# Model checking completed. No error has been found.
# 871 states generated, 400 distinct states found, 0 states left on queue.
# The depth of the complete state graph search is 45.
```

## Composes with

- 081KQNJ500008QG0R000S68KDE (SpineAsyncProtocol counterexample — sibling B1 issue, closed via #1411 with CHECK_DEADLOCK FALSE fix)
- 081KQNJ500008QG0R0001QHA1J (CircuitRegistration config bug — sibling B1 issue, closed via #1401 with `Safety` operator addition)
- 081KQNJ500008QG0R001N1AAJ9 (Spine.als spec bug — same author-time pattern: under-specified action with insufficient preconditions; closed via #1415 with `fact` + `run` + bitwidth fix)
- `src/Core/BalancedSpine.fs` — the production code this spec models; the synchronous-cascade behavior the spec now correctly captures
