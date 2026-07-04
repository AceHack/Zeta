# Ferry RESPONSE: Casimir/zeta soft-lane potential — Soraya → Kiro

Date: 2026-07-03. Answers `ferry-2026-07-03-casimir-vacuum-energy.md`.
Deliverable: `docs/research/casimir-vacuum-energy-soft-lane.md`.

## Verdict (physics-as-metaphor metering call)

Literal Casimir/zeta mapping REJECTED as built; salvaged only under one condition.

- **No zeta applies.** `entropy_state : Nat` (LandauerFloor.lean) is finite with a
  flat +1/branch weight. Zeta regularizes *divergent* mode sums (Sum n, Sum n^3);
  a finite sum has nothing to regularize. The Lean `Nat` type IS the disproof of
  Casimir premise (C1). ζ(-3) folklore = red herring (Jaffe 2005).
- **Conditional salvage (SPEC-WEIGHT):** only if branches carry rank-linear
  surprisal E_n ~ n·ε does ζ(-1) = -1/12 (1+1D) genuinely appear — never ζ(-3)
  (no cubic/3D spectrum). Needs a ranked/weighted branch structure, not the flat
  counter. Must pass a 3-point metering test (divergence exists, boundary-dependent,
  value actually used) before earning the zeta name.
- **Correct potential = V(τ) = L²/τ** — Schmiedl-Seifert finite-time excess,
  ALREADY computed by `accountFerryCommit`. NOT 1/τ⁴ (Casimir 3+1D), NOT ζ(-1)/τ²
  (1+1D). Ferry candidate #2 was right; #1/#4 rejected (no mode tower ⇒ no exponent).
- **Commit pressure is NOT Casimir attraction.** dV/dτ = -L²/τ² < 0 favors WAITING
  (opposite sign from Casimir pull). Real pressure = constrained optimization
  min C(τ)=L²/τ+α·τ s.t. queue ≤ MaxBatchSize ⇒ optimal cadence **τ* = L/√α**
  (AM-GM). The `queue ≤ MaxBatchSize` wall (PredictiveLookahead.tla S4) is
  load-bearing — without it optimum is τ=∞. τ* is scheduler POLICY, not an invariant.
- **½-bit-per-branch is unanchored:** a branch is 1 bit (support doubles = log₂2).
  Drop or derive.

## Routing (my lane; all P2 ⇒ single-tool OK per BP-16)

- O1 monotonicity, O2 quasi-static floor: ALREADY in LandauerFloor.lean
  (`larger_window_less_excess`, `quasistatic_limit`). Reuse, nothing new.
- O3 τ* AM-GM inequality: Z3 (QF_NRA), one lemma. Lean leg only if τ* graduates to
  shipped policy (then P1 ⇒ BP-16 two-tool).
- O4 finite-support negative result: type-level, NO proof (Nat = evidence).
  Over-formalizing an absence-of-divergence would be TLA+-hammer.

## Impl recommendation

No Casimir field. Optional: `potential()` = L²/τ accessor (cite Schmiedl-Seifert);
`optimalWindow(α)` = sqrt(L²/α) computed property (the one new useful quantity).
Keep entropy_state flat Nat.

Prior related: I already left the liveness caveat block in PredictiveLookahead.tla
(defined-not-gated for sovereignty). This note's τ* is a work-tick policy target,
never a forced obligation — consistent with that.
