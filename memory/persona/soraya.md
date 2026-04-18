# Formal-Verification Expert — Notebook

Running notes for Soraya. ASCII only (BP-09). 3000-word cap
(BP-07). Pruned every third invocation.

Frontmatter at `.claude/skills/formal-verification-expert/SKILL.md`
is canon (BP-08). This notebook supplements, never overrides.

---

## Portfolio metric

Reported each invocation:

- **Formal-coverage ratio** = (code paths with an in-gate formal
  artefact) / (code paths flagged as needing one).
- Trend over rounds matters more than the absolute number.

### Round 21 baseline

- Numerator: files covered by a CI-gated spec — 4 TLA+ specs
  in gate (`TickMonotonicity`, `OperatorLifecycleRace`,
  `TransactionInterleaving`, `TwoPCSink`) + 8 Z3 pointwise
  lemmas in `tests/Dbsp.Tests.FSharp/Formal/Z3.Laws.Tests.fs`.
  ≈ 12 artefacts touching ≈ 15 code paths.
- Denominator: numerator + `docs/BUGS.md` formal-gap entries
  (`InfoTheoreticSharder` missing spec, `RecursiveCounting`
  multi-tick-seed unproven, `FeedbackOp` memory-ordering
  unproven) = ≈ 18 paths.
- **Ratio ≈ 15 / 18 ≈ 0.83.** The denominator grows every time
  a new research claim lands; a stable or rising ratio means
  Soraya's routing is keeping up with claim intake.

---

## Current-round routing recommendations

### Round 21 targets

1. **TLA+ `InfoTheoreticSharder`** — Observe-pure, Pick-commits-
   once, cold-start tie-break. TLC at 3×2×4. Effort: M.
   In-flight (dispatched this round).
2. **Z3 pointwise tie-break identity** for the sharder — proves
   the argmin on cold start distributes by hash index. Effort: S.
   Bundle with #1.
3. **Multi-tick-seed tests for `RecursiveCounting`** — not
   formal, but the empirical cross-check the claim needs.
   FsCheck property + three targeted `[<Fact>]`s. Effort: S-M.
   In-flight (dispatched this round).
4. **Z3 lemma expansion from 8 → ~16** — chain rule pointwise,
   Distinct idempotence, H-function correctness, tropical
   distributivity, weight overflow soundness, residuation
   adjunction, Bloom probe determinism, Merkle second-preimage
   on one level. Effort: S (one evening each). In-flight.
5. **Alloy CI hook for `Spine.als`** + new
   `tools/alloy/specs/InfoTheoreticSharder.als`. Effort: S. In-flight.

### Round 22+ targets (not yet dispatched)

6. **Finish Lean 4 chain-rule proof.** `proofs/lean/ChainRule.lean`
   stub has been sitting five rounds. Effort: L. Mathlib abelian-
   group hierarchy is now complete enough to support the proof.
7. **Wire Stryker + Semgrep + CodeQL into CI.** Configs exist;
   gate is free coverage. Effort: S (each).
8. **LiquidF# trial on FastCdc + SimdMerge + BloomFilter.pairOf.**
   Off-by-one class is exactly what LiquidF# catches at compile
   time. One-week trial. Effort: M.
9. **Fifteen missing FsCheck properties.** PN-Counter, OR-Set,
   LWW-Register, DeltaCrdt, Residuated lattice, Merkle collision-
   freedom, Watermark monotonicity, KLL quantile ε-bound, and
   more. Cheapest coverage expansion on the board. Effort: S.
10. **`FeedbackOp` memory-ordering proof.** Viper or a hand-proof
    reviewed by Anjali; TLA+ doesn't fit heap aliasing well.
    Effort: M.

---

## Running observations

- **2026-04-17 (round 21) — seeded.** Skill just landed. First
  live routing reviews are the in-flight round-21 dispatches;
  next-round recommendations captured above.
- **2026-04-17 (round 21) — TLA+-hammer check.** Of the 14 TLA+
  specs in the repo, 2 were properly TLA+-shaped safety
  invariants; the other 12 are a mix of algebraic identities
  (should have been Z3) and structural invariants (should have
  been Alloy). Not urgent to refactor, but flag for next
  portfolio review.
- **2026-04-17 (round 21) — Stainless viability note.** Stainless
  4.x with Scala 3 is finally stable enough to evaluate for our
  termination claims. Put on the Assess row in `TECH-RADAR.md`
  when the Tech-Radar Owner (Jun) runs his next sweep.

---

## Pruning log

- Round 21: seeded. First prune review: round 24.
