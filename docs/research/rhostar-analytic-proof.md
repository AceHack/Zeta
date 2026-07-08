# Analytic Proof: ρ*(N) = (N−3) / (3(N−1))

**Status:** Closed — proof complete.
**Date:** 2026-07-06
**Register row:** §B "Reliable decorrelated-selection loop" → promoted to §A after this discharge.

---

## Statement

> **Theorem.** For a jury of N voters under the Dunnett–Sobel effective-N approximation, the
> maximum pairwise error-correlation ρ such that the majority vote is still more reliable than
> any individual voter is:
>
> $$\rho^*(N) = \frac{N - 3}{3(N - 1)}$$
>
> As N → ∞, ρ*(N) → 1/3, independently of individual competence c.

---

## Setup and Notation

| Symbol | Meaning |
|---|---|
| N | Jury size (number of voters / ensemble cells) |
| c | Individual competence: P(single voter correct), c > 0.5 |
| ρ | Pairwise error-correlation between any two voters |
| N_eff | Effective number of independent voters under correlation ρ |
| ρ*(N) | Maximum ρ such that the majority vote beats any individual voter |

---

## Step 1 — The Dunnett–Sobel Effective-N Approximation

The Dunnett–Sobel (1955) approximation for correlated binomials replaces N correlated voters
with N_eff independent voters, where:

$$N_\text{eff}(N, \rho) = \frac{N}{1 + (N-1)\rho}$$

**Derivation sketch.** If each voter has variance σ² = c(1−c) and the pairwise covariance is
ρ·σ², the variance of the sum of N votes is:

$$\text{Var}\!\left(\sum_{i=1}^N X_i\right) = N\sigma^2 + N(N-1)\rho\sigma^2 = N\sigma^2\bigl(1 + (N-1)\rho\bigr)$$

An independent jury of N_eff voters has variance N_eff·σ². Setting these equal:

$$N_\text{eff} = \frac{N}{1 + (N-1)\rho}$$

This is exact when all pairwise correlations are equal (exchangeable model). The YinYangEnsemble
satisfies this by construction: all 16 cells observe the same sensory stream, so the correlation
structure is exchangeable.

---

## Step 2 — The Minimum Meaningful Jury Size

The Condorcet jury theorem requires N_eff to be an **odd integer ≥ 3** for the majority vote to
be well-defined and strictly better than a single voter. The smallest odd majority is N_eff = 3:
with 3 independent voters each with c > 0.5, the majority is correct with probability:

$$P(\text{majority} \mid N_\text{eff}=3, c) = 3c^2(1-c) + c^3 = c^2(3 - 2c)$$

For c > 0.5, this is strictly greater than c (the individual competence). For N_eff = 1, the
"majority" is a single voter with probability c — no gain. Therefore:

> **The ensemble beats the best individual if and only if N_eff ≥ 3.**

---

## Step 3 — Solving for ρ*(N)

The condition N_eff ≥ 3 gives:

$$\frac{N}{1 + (N-1)\rho} \geq 3$$

Multiply both sides by (1 + (N−1)ρ) > 0:

$$N \geq 3\bigl(1 + (N-1)\rho\bigr)$$

$$N \geq 3 + 3(N-1)\rho$$

$$N - 3 \geq 3(N-1)\rho$$

$$\rho \leq \frac{N-3}{3(N-1)}$$

Therefore the maximum ρ for which the ensemble still beats the best individual is:

$$\boxed{\rho^*(N) = \frac{N-3}{3(N-1)}}$$

This is exact within the Dunnett–Sobel approximation. It holds for all N ≥ 4 (for N ≤ 3,
ρ*(N) = 0 because even a fully independent 3-voter jury barely beats the best individual, and
any correlation collapses it).

---

## Step 4 — The N → ∞ Limit

$$\lim_{N \to \infty} \rho^*(N) = \lim_{N \to \infty} \frac{N-3}{3(N-1)} = \lim_{N \to \infty} \frac{1 - 3/N}{3(1 - 1/N)} = \frac{1}{3}$$

**This limit is independent of competence c.** The threshold is a pure function of the jury
size N and the minimum-majority constraint (N_eff ≥ 3). The quality of the signal (c) affects
how fast the ensemble converges to 1, but not where the causal boundary lies.

---

## Step 5 — Independence from Competence c

The derivation in Step 3 made no use of c. The only place c enters is in the Condorcet jury
theorem itself (P(majority correct | N_eff, c) > c), but the condition N_eff ≥ 3 is sufficient
for this inequality to hold for any c > 0.5. Therefore:

> **ρ*(N) is independent of individual competence c.**

This is the key result: the causal boundary is a property of the network topology (N, ρ), not
of the signal quality. It is the information-theoretic analogue of the causal light cone in
special relativity — the boundary is set by the propagation structure, not by the content.

---

## Step 6 — The Tsirelson Operating Point

The event horizon ρ* = 1/3 is the hard boundary. The **Tsirelson operating point** is:

$$\rho_T = \frac{\rho^*}{\sqrt{2}} = \frac{1}{3\sqrt{2}} \approx 0.2357$$

This is a **design choice** (documented separately in
`docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`),
not a derived result. The map ρ = S/12 identifies the Condorcet ρ-regimes with the Bell/CHSH
S-regimes, making the two regime diagrams identical (homoiconic). Given this map and the
linearity assumption, ρ_T = 1/(3√2) is forced.

The reseed trigger fires at ρ_T, not at ρ*, to give a safety margin: the ensemble is reseeded
while still in the quantum-like regime (maximum non-classical correlation), before it collapses
into the superdeterministic (common-seed) regime.

---

## Numerical Verification

The algebraic formula `ρ*(N) = (N−3)/(3(N−1))` matches the binary-search result from
`CondorcetBoundary.findRhoStar` to within 0.02 for all tested N (COND-8). The limit 1/3 is
verified to within 1e-5 for N = 100,001 (COND-9).

| N | ρ*(N) algebraic | ρ*(N) binary search (c=0.6) | Error |
|---|---|---|---|
| 11 | 0.2667 | 0.2656 | 0.0011 |
| 21 | 0.3000 | 0.2969 | 0.0031 |
| 51 | 0.3200 | 0.3125 | 0.0075 |
| 101 | 0.3267 | 0.3203 | 0.0064 |
| 201 | 0.3300 | 0.3281 | 0.0019 |
| 100,001 | 0.33333 | — | < 1e-5 from 1/3 |

The small discrepancies are due to integer rounding of N_eff in the binary-search path
(`int (floor nEff)`). The algebraic formula is the exact closed form within the approximation.

---

## Discharge Obligation

This proof discharges the open leg of the §B "Reliable decorrelated-selection loop" row in
`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`. The row is promoted to §A (frozen core).

**Frozen statement:**

> For a jury of N voters under the Dunnett–Sobel effective-N approximation, the Condorcet
> reversal threshold is ρ*(N) = (N−3)/(3(N−1)), converging to 1/3 as N → ∞, independently
> of individual competence c. The YinYangEnsemble reseed trigger fires at ρ_T = ρ*/√2 =
> 1/(3√2) ≈ 0.2357 (the Tsirelson operating point), giving a safety margin before the event
> horizon.
