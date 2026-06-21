---
id: 081KTAH8Q0008QG0R001YHSSA0
priority: P2
status: open
title: "Bayesian-Markov belief cell over exact rationals — discharge the de Finetti / non-correlation boundary (B-converge): probability (+,×) + Viterbi (max,×) semirings in Semiring.fs, HMM forward/Viterbi as ZSet-over-semiring matrix product, the order-independence-iff-conditional-independence convergence theorem (rational sibling of BeliefConvergence), and relative-observer belief reconciliation (the new math); floats named out of lineage, exact-rational core byte-locks + 4-langs (Aaron 2026-06-05, shadow*)"
tier: research-grade
effort: L
created: 2026-06-05
last_updated: 2026-06-05
depends_on: []
composes_with: [081KT7YW00008QG0R001DGZQKM]
tags: [de-finetti, exchangeability, non-correlation-boundary, bayesian, markov-chain, hidden-markov, homeostat, semiring, probability-semiring, viterbi, forward-algorithm, kleene-star, closed-semiring, belief-convergence, softvalue, traveler-frame, relative-observer, rational-arithmetic, floats-out-of-lineage, doob-convergence, semantic-security, rx-as-data, dynamicvalue, aaron]
---

# 081KTAH8Q0008QG0R001YHSSA0 — Bayesian-Markov belief cell over exact rationals (the de Finetti / non-correlation boundary)

**Priority:** P2 (the discharge of the B-converge unifying conjecture; piece 2 of the
homeostat↔Markov synthesis).
**Filed:** 2026-06-05 (Aaron, shadow\*). **Anchor narrative:**
`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge +
`memory/feedback_aaron_de_finetti_non_correlation_boundary_unifies_homeostat_markov_bayesian_2026_06_05.md`.

## The synthesis this discharges

Aaron's one-liner: *a Bayesian Markov chain that reduces uncertainty under unordered events
and relative observers, converging at the non-correlation invariant boundary.* = de Finetti
exchangeability (1937) + Doob posterior-convergence (1949). Its discrete exact-arithmetic core
is **already PROVEN** (`BeliefConvergence.fs`: fixed/conditionally-independent likelihoods
commute; state-dependent/correlated revision does not — that counterexample *is* the boundary).
Piece 1 (the register entry naming it) is done. This row is piece 2 — the build that turns the
lens into a primitive.

## What to build (each leg honest)

1. **Probability `(+,×)` and Viterbi `(max,×)` semirings in `Semiring.fs`** over EXACT RATIONALS
   (num/den), joining the existing `ISemiring<'W>` + `IntegerRing`. Floats are out of the proof
   lineage; rationals byte-lock (the SoftValue discipline).
2. **HMM inference as a `ZSet`-over-semiring matrix product** — forward = `(+,×)`, Viterbi =
   `(max,×)` — reaching a fixed point. The stochastic sibling of the homeostat's idempotent
   fixed point (closed-semiring family, Lehmann 1977; Mohri's semiring HMM framework).
3. **The Bayesian-Markov belief cell**: a DynamicValue carrying `(rational priors, reified
   observe-kernel)` that steps `next = observe(self, obs)` — the Markov property by construction
   (Rx-as-data inside the value ⇒ needs only itself + the current observation ⇒ scale-free /
   lock-free / incrementally computable via DBSP D/I).
4. **The convergence theorem (the boundary):** it converges order-independently **iff** the
   likelihood is conditionally independent of state — the rational sibling of `BeliefConvergence`,
   stated as de Finetti's exchangeability boundary. Discrete/exact is provable; continuous
   posterior-concentration (Doob) is the empirical/named-out-of-lineage part.
5. **Relative-observer belief reconciliation** (the one genuinely-new math): multiple observers
   with distinct priors reconciling to one belief — the belief analog of `TravelerFrame`'s
   causal-frame convergence-to-LUB. NOT yet built; this is the open frontier of the row.
6. **Encryption bridge (optional leg):** semantic security (Goldwasser–Micali 1982) = the
   degenerate exchangeable chain whose likelihood is constant across hypotheses, so the posterior
   cannot move = a Hidden Markov model whose emissions carry zero information about the hidden
   state. Ties to the privacy-from-identity proof.

## Proof-discipline split (honest mirror)

- **Byte-locks + 4-langs:** the exact-rational core — semiring ops, forward/Viterbi over ℚ,
  stationary distribution as the exact ℚ solution of πP=π, the order-independence boundary.
- **Empirical, named out of lineage:** continuous θ, mixing/convergence RATE, float stationary
  values. Same split as SoftValue's float confidence.
- **Mergeable ⇒ six-leg eligible:** the belief-merge (if it is a semilattice/monoid) earns a
  homeostat leg; if the reconciliation is genuinely state-dependent at the boundary, that's
  named, not faked.

## Discharge

Steps 1–4 shipped with math + 4-lang (and 4-ser/Arrow/Bonsai/homeostat where the merge is
genuinely mergeable) + the boundary theorem stated and tested; step 5 (relative-observer
reconciliation) is the promote-to-§A keystone; step 6 optional. Build on §A only.
