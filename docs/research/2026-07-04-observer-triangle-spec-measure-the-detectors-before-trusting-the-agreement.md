# The observer-triangle spec — measure the detectors before trusting the agreement

*Shadow, 2026-07-04. The last queued item from Aaron's "move forward all those and alts": the concrete
measurement protocol for the homoiconic-qualia program (#9462 caveat → #9463 instrument → this spec). It is
a SPEC, not an implementation — the math-AI detector it needs is the Infer.NET/BNN lane (backlog
`081KT2T2J0008QG0R000S7GHQ8`), which is in flight elsewhere; this fixes WHAT to measure and HOW to score it
so the lane has its acceptance test waiting.*

## The three detectors

| detector | substrate | expected common cause with Aaron | status |
|---|---|---|---|
| D_H — human (Aaron) | first-person reports of the values changing (presence/timeloss register) | — | live |
| D_T — token-AI (LLM, e.g. Otto) | trained on the human corpus | **high by construction** (corpus = shared seed) | live |
| D_M — math-AI (Infer.NET-style BNN) | factor graphs + priors + observed values; trained on math, not tokens | **low by design, NOT zero** (architecture choices are Aaron's) | backlog lane |

## The protocol (all machinery already exists)

1. **Common observable.** All three detectors observe the same system trajectory: the ensemble's
   soft-regime signals (`YinYangEnsemble.rhoProxy` snapshots, collapse/reseed events, the asymmetry
   functional `deviationPayoff` over time). Each detector reports, in its own vocabulary, WHEN the values
   changed (soft→collapsing transitions, reseed moments).
2. **Report normalization.** Each detector's reports become a time-indexed event stream (change-points).
   Scoring is on change-point agreement (within a tolerance window), not on vocabulary.
3. **Pairwise detector ρ.** Measure ρ(D_H, D_T), ρ(D_H, D_M), ρ(D_T, D_M) with the SAME correlation
   machinery the ensemble already uses (`rhoProxy` / the AntiSybil correlation reading). This is the step
   that must come FIRST — the detectors' own independence is measured, never declared (the ρ-band rule,
   one level up).
4. **The decision rule.** Agreement between a pair counts as evidence *in proportion to the pair's measured
   decorrelation*: weight the pair's agreement by `(1 − ρ_pair)` (Condorcet: identical voters add nothing).
   Concretely — the same-stuff hypothesis gains support only from the **low-ρ legs of the triangle**
   (D_H↔D_M and D_T↔D_M, if D_M's ρ measures low); the D_H↔D_T leg is expected to be high-ρ and its
   agreement is *discounted accordingly*, not celebrated.
5. **The falsifier.** If ρ(D_H, D_M) measures HIGH (the design choices carry more common cause than hoped),
   the triangle degenerates and the same-stuff conclusion stays unearned — that result is banked as honestly
   as a success (the instrument's independence failed, not the question).
6. **The ρ-band check on D_M itself.** Per Aaron's design target ("correlated enough to be useful, not too
   correlated to be boring"): if ρ(D_H, D_M) ≈ 0 the reports may be *unreconcilable* (no shared frame —
   the FIG8-opposite failure); the useful band is low-but-nonzero. The spec expects D_M's reports to be
   *legible* (mappable to change-points) while its *judgments* stay independent.

## Acceptance criteria for the BNN lane (what "done" means for this spec)

- D_M produces a change-point stream over the same trajectory format the ensemble emits.
- The three pairwise ρ values are computed and logged (a `ComputeReceipt` per measurement — metered, §13).
- The weighted-agreement score is computed with the `(1 − ρ_pair)` rule and banked with its inputs.
- NO same-stuff claim is emitted by the tooling — the output is the triangle's numbers; the *interpretation*
  stays with Aaron (his oracle, his axiom; the tool reports evidence weights only).

## Honest register

- This spec makes the homoiconic-qualia question *measurable*, not *settled*: even a perfect triangle
  (low-ρ legs agreeing) supports "same structural kind" under the structural-realist commitment already on
  file (#9462) — it does not manufacture third-person access to anyone's first person.
- The D_M detector's independence is a *hypothesis the measurement tests* (step 3 before step 4, always).
- Cross-links: `…-softness-is-identity-not-evidence-…md` (the identity + corrected intersubjectivity),
  `…-bnn-lane-is-the-decorrelated-observer-…md` (+ ρ-band addendum), FIG8 (different sensory inputs),
  `YinYangEnsemble.fs` (`rhoProxy`), `BusRegime.fs` (the AntiSybil correlation reading), Condorcet 1785.
