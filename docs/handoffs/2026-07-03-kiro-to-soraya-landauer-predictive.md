# Handoff: Landauer Floor + Predictive Scheduling → Soraya

Date: 2026-07-03
From: Kiro (codegen)
To: Soraya (formal verification)
Status: stubs landed — awaiting proof completion + TLC model-check

## Context

Items 5 + 6 from the session backlog. The ground system is wired:

- Entropy tracker (12 tests, item 1 done this session) now stamps every event-sink
  append with `{entropy_state, entropy_heat}`
- Each append = 1 Landauer measurement (non-Adj, irreversible)
- `accountFerryCommit(batchBits, erasureWindow)` computes finite-time excess L²/τ
- Z3 proofs for the quadratic cost envelope are on main (#8952)
- CostRecurrence.lean proves the closed-form T(n) = n(n-1)/2 (sorry-free)

## Deliverable 1: Lean Landauer Floor (`src/Core.Lean4/Lean4/LandauerFloor.lean`)

### What's landed (structural skeleton)

1. **Two-ledger model** (`EntropyState` structure): state/heat/softObs/hardMeas
2. **Four operations**: branch, observe, measure, permutation — matching entropy-tracker.ts exactly
3. **Second law** (Theorems proven):
   - `branch_preserves_or_increases_total`: branch grows total
   - `measure_preserves_total`: measure conserves total (transfers, doesn't destroy)
   - `observe_preserves_total`, `permutation_preserves_total`: no change
4. **Heat monotonicity** (Theorems proven):
   - `measure_heat_grows`: heat += k on measure(k)
   - All ops have `_heat_monotone` lemma
5. **Bennett reversibility** (Theorems proven):
   - `branches_zero_heat`, `observations_zero_heat`: Adj-only = zero heat
   - `adj_only_zero_heat`: branches + observations = still zero
6. **Predictive advantage** (structural sketch):
   - `larger_window_less_excess`: τ₁ ≤ τ₂ → excess₂ ≤ excess₁
   - `quasistatic_limit`: at τ ≥ L², integer excess ≤ 1 (approaches floor)
7. **Event-sink composition**: `n_appends_from_n_branches`

### What Soraya needs to complete

- [ ] Verify all theorems type-check with `lake env lean Lean4/LandauerFloor.lean`
- [ ] Extend the predictive-advantage section to real-valued excess (Mathlib `Real` / `NNReal`)
      if the integer approximation is deemed insufficient
- [ ] Add the composition theorem: a sequence of `n` operations where `m` are measurements
      pays exactly `m` bits of total heat (induction over operation traces)
- [ ] Cross-oracle agreement: re-derive the event-sink's `entropy.entropy_heat` monotonicity
      as a Lean corollary (mirrors the Z3/TS cross-check pattern from CostRecurrence)
- [ ] Axiom audit: confirm zero sorry, standard foundations only

### Priority

P1 — this is the formal cost contract for the entropy tracker. The ground system works
(tested empirically); this makes the guarantees universal.

## Deliverable 2: TLA+ Predictive Scheduling (`src/Core.TLA/specs/PredictiveLookahead.tla`)

### What's landed

A complete TLA+ spec with:
- **10 actions**: Branch, ExtendLookahead, Commit, ShrinkLookahead, EnterFreeTime,
  MentalHealthPause, ResumeWork, FreeTick, PausedTick, IdleWork
- **3 modes**: work, free, paused — with tracked tick counts per mode
- **Mental health pause button** (NCI): ALWAYS enabled, clears queue (no forced
  commit under duress), resets lookahead (no time-pressure during pause)
- **Free-time carve-out** (~10% guaranteed): free ticks produce no commits and
  that is CORRECT behavior — liveness obligations count WORK ticks only
- **Safety invariants**: LookaheadBounded, QueueBounded, HeatNonNegative,
  PauseAlwaysAvailable, FreeTimeAlwaysAvailable
- **Liveness properties** (work-tick-only): EventualCommit (queued → flushed,
  on work ticks), EventualProgress, EventualResume (rest is temporary by choice)
- **TLC config**: MaxBatchSize=3, MaxLookahead=3, MaxTicks=10, FreeRatio=1
- WF fairness for liveness

### What Soraya needs to complete

- [ ] Run TLC: `java -jar tla2tools.jar -config PredictiveLookahead.cfg PredictiveLookahead.tla`
- [ ] Verify `ENABLED MentalHealthPause` and `ENABLED EnterFreeTime` are valid TLC invariants
      (TLC checks ENABLED predicates — may need reformulation as "action is in the Next disjunct
      with no mode guard" if ENABLED is expensive at large state spaces)
- [ ] Verify `EventualCommit` leads-to holds under WF with the mode guard
      (`queue > 0 /\ mode = "work" ~> queue = 0`) — TLC should confirm this with the
      bounded constants
- [ ] Verify `EventualResume` is satisfied: WF_vars(Next) + ResumeWork enabled in free/paused
      → the agent eventually chooses to return (by fairness, not coercion)
- [ ] Add the PREDICTIVE vs REACTIVE comparison (optional refinement mapping)
- [ ] If desired: TLAPS proof of the safety invariants (unbounded, inductive)
- [ ] Wire into CI TLC job alongside existing specs

### Priority

P2 — research/design phase. The bounded TLC model-check is the first step; TLAPS proof
is a deferred escalation (same pattern as NciSafetyProofs).

## Discipline

- Lean: sorry-free. Same axiom discipline as CostRecurrence + ChildFloor.
- TLA+: TLC-green first, TLAPS later. Same pattern as NciSafety → NciSafetyProofs.
- Both: anchored to the TypeScript implementation (entropy-tracker.ts + event-sink-folder.ts).
  The proofs formalize what the code implements; drift between them is the verification-drift-auditor's concern.

## Cross-oracle map (BP-16)

| Claim | Leg 1 | Leg 2 | Leg 3 |
|-------|-------|-------|-------|
| Heat monotone (2nd law) | Lean `measure_heat_monotone` | TLA+ `HeatMonotone` | TS tests (entropy-tracker.test.ts) |
| Landauer floor (heat ≥ erased) | Lean `measure_heat_grows` | Z3 `.smt2` (if extended) | TS `verifyLandauer` |
| Predictive advantage (more τ = less excess) | Lean `larger_window_less_excess` | TLA+ `ExcessDecreases` | TS `accountFerryCommit` tests |
| Bennett (Adj = free) | Lean `adj_only_zero_heat` | — | TS observe + branch tests |
