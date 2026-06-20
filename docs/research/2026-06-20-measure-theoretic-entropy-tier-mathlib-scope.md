# Measure-theoretic entropy tier — Mathlib scope and routing map (handoff rows 1 + 3)

**Date:** 2026-06-20. **Author (source):** shadow (math-team / Tariq + Kenji capacity).
**Authorization:** none attached — this is a routing/scoping map for Tariq + Kenji to pick up.
**For:** the measure-theoretic tier of
`docs/handoffs/2026-06-19-otto-to-math-team-nft-ntp-anti-mirror-societal-dora-formalization.md`
rows 1 (NFT forgery-resistance `H_∞` lift) and 3 (anti-mirror `ρ_owe` / DPI soundness).

## TL;DR

- **Row 1 (min-entropy lift) — DONE at the finite-distribution measure-theoretic tier.** A real,
  Mathlib-backed leg landed: `src/Core.Lean4/Lean4/EntropyMeasureTheoretic.lean`. It defines
  min-entropy `H_∞(D) = −logb 2 (pmax D)` over a finite `ℝ`-valued distribution and proves the lift
  as an **exact equality** `H_∞(A × B) = H_∞(A) + H_∞(B)` for independent pairs (stronger than the
  row-1 `≥` claim), via `Real.logb_mul` and `Finset.sup'`. `lake build`-verified WITH Mathlib;
  `#print axioms` = `[propext, Classical.choice, Quot.sound]` (no `sorryAx`). The remaining rung is
  the general measure-space `H_∞` over an arbitrary `MeasureTheory.Measure` (vs a finite `Finset`).
- **Row 3 (real Shannon DPI `I(A;U|C) ≥ I(A;f(U)|C)`) — BLOCKED on a missing Mathlib def.** Mathlib
  **v4.30.0-rc1 has no Shannon entropy / mutual-information / conditional-entropy definitions at all**
  — there is no `measureEntropy`, no `mutualInfo`, no `condEntropy`. The DPI cannot be *stated* in
  Mathlib terms today without first **defining finite Shannon entropy** (`H(X) = ∑ negMulLog (p x)`)
  and mutual information from scratch. The convexity machinery the proof needs DOES exist
  (`Real.strictConcaveOn_negMulLog`, `strictConvexOn_klFun`, KL chain rule); the *definitions and the
  DPI theorem* do not. This is a multi-day Lean job. Skeleton + missing pieces below.

## What Mathlib v4.30.0-rc1 actually provides (exact names)

Searched the pulled Mathlib source (rev `v4.30.0-rc1`, under
`src/Core.Lean4/.lake/packages/mathlib/Mathlib/`).

### Present and load-bearing

| Concept | Exact Mathlib name | Module |
|---|---|---|
| Entropy summand `−x·log x` | `Real.negMulLog` | `Analysis/SpecialFunctions/Log/NegMulLog.lean` |
| `negMulLog` concavity | `Real.strictConcaveOn_negMulLog : StrictConcaveOn ℝ (Set.Ici 0) negMulLog` · `Real.concaveOn_negMulLog` | same |
| `negMulLog` product law | `Real.negMulLog_mul (x y : ℝ) : (x*y).negMulLog = y*x.negMulLog + x*y.negMulLog` | same |
| `negMulLog` bounds | `Real.negMulLog_nonneg` (`0≤x≤1`) · `Real.negMulLog_le_one_sub_self` | same |
| Base-`b` log | `Real.logb` | `Analysis/SpecialFunctions/Log/Base.lean` |
| `logb` additivity (the row-1 lift kernel) | `Real.logb_mul (hx : x≠0) (hy : y≠0) : logb b (x*y) = logb b x + logb b y` | same |
| `logb` monotone | `Real.logb_le_logb_of_le (h : 0<x) (hxy : x≤y)` · `Real.logb_le_logb` (iff) | same |
| `logb` sign | `Real.logb_nonpos (hb : 1<b) (0≤x) (x≤1)` · `Real.logb_nonneg` | same |
| Finite `max_x p(x)` | `Finset.sup'`, `Finset.le_sup'`, `Finset.sup'_le`, `Finset.exists_mem_eq_sup'` | `Data/Finset/Lattice/Fold.lean` |
| Scalar binary/`q`-ary entropy | `binEntropy`, `qaryEntropy`; `strictConcave_binEntropy : StrictConcaveOn ℝ (Icc 0 1) binEntropy`; `strictConcaveOn_qaryEntropy` | `Analysis/SpecialFunctions/BinaryEntropy.lean` |
| KL divergence (measure-theoretic) | `klDiv (μ ν : Measure α)` (in `ℝ≥0∞`) | `InformationTheory/KullbackLeibler/Basic.lean` |
| Gibbs' inequality (KL ≥ 0) | `integral_llr_add_sub_measure_univ_nonneg` (the real-valued form); `klDiv` is `≥0` by type | same |
| KL strict convexity (of the integrand) | `strictConvexOn_klFun : StrictConvexOn ℝ (Ici 0) klFun` · `convexOn_klFun` | `InformationTheory/KullbackLeibler/KLFun.lean` |
| KL chain rule / kernel compose | `klDiv_compProd_left : klDiv (μ ⊗ₘ κ) (ν ⊗ₘ κ) = klDiv μ ν`; `klDiv_compProd_eq_add` | `InformationTheory/KullbackLeibler/ChainRule.lean` |

### Absent (the gap)

Searched for and **did not find** anywhere in the tree:

- `measureEntropy` — no measure-theoretic Shannon entropy `H(μ)`.
- `mutualInfo` / `mutualInformation` — no mutual information `I(X;Y)`.
- `condEntropy` / `conditionalEntropy` — no conditional entropy `H(X|Y)`.
- conditional mutual information `I(A;U|C)` — absent (it is the row-3 target).
- a **data-processing inequality** for `klDiv` (no `klDiv` monotonicity under a Markov kernel
  push-forward, no `klDiv_comp_le`). The chain-rule pieces exist; the DPI inequality does not.

(`Mathlib/Dynamics/TopologicalEntropy/*` is *topological* entropy of a dynamical system — unrelated
to Shannon entropy. `InformationTheory/Hamming.lean` and `Coding/*` are coding theory, also not it.)

## Row 1 — exact target, what was proven, the remaining rung

**Target (handoff row 1):** real-distribution min-entropy `H_∞ = −log₂ max_x p(x)`, and the lift
`H_∞(pair) ≥ H_∞(a) + H_∞(b)` for independent pairs.

**Proven (this PR, `EntropyMeasureTheoretic.lean`):** over a finite `ℝ`-valued distribution
(`FinDist`: a nonempty `Finset` of outcomes + a strictly-positive mass `p`),

```text
pmax D        = D.outcomes.sup' D.nonempty D.p          -- max_x p(x), via Finset.sup'
Hmin D        = - logb 2 (pmax D)                        -- H_∞, base-2
product A B   : p(a,b) = A.p a * B.p b                   -- independent join
pmax_product  : pmax (product A B) = pmax A * pmax B     -- guessing prob factorizes
Hmin_product  : Hmin (product A B) = Hmin A + Hmin B     -- THE LIFT (exact equality)
Hmin_product_ge      : ka ≤ Hmin A → kb ≤ Hmin B → ka+kb ≤ Hmin (product A B)  -- the row-1 ≥ form
Hmin_product_ge_left : ka ≤ Hmin A → 0 ≤ Hmin B → ka ≤ Hmin (product A B)
Hmin_nonneg          : pmax D ≤ 1 → 0 ≤ Hmin D
```

The equality is the load-bearing measure-theoretic upgrade of `EntropyFloorLift.floor_lifts` (which
proved the `≥` floor combinatorially over `Nat` guessing-spaces). It does **not** weaken or replace
the operational leg — both stand, cross-checking each other (BP-16 ≥2-tool).

**Remaining rung (next pick-up):** lift `FinDist` → a general `MeasureTheory.Measure` with
`pmax = essSup`/`Measure.rnDeriv` essential-supremum, so `H_∞` is the genuine measure-space
min-entropy. The factorization `pmax (μ ⊗ ν) = pmax μ · pmax ν` then routes through
`Measure.prod` + `essSup` of a product, which is real analysis work (no single named Mathlib lemma —
estimated 1–2 days). The finite tier here is faithful and sufficient for the NFT (the commit surface
is a finite content-hash space), so this rung is optional unless a continuous source is modelled.

## Row 3 — exact target, the gap, and the proof skeleton

**Target (handoff row 3):** the real Shannon DPI for conditional mutual information,
`I(A;U|C) ≥ I(A;f(U)|C)` for any deterministic post-processing `f` of the conditioning variable `U`
— hence `ρ_owe(U) ≤ ρ_owe(f(U))` where `ρ_owe = H(A|U,C)/H(A|C)`.

**The gap (precise):** none of `I(·;·|·)`, `H(·|·)`, or even unconditional `H(X)` exist in Mathlib
v4.30.0-rc1. The DPI **cannot be stated** in Mathlib terms today; you must first **define** finite
Shannon entropy and mutual information. The proof *ingredients* (concavity / log-sum) are present;
the *vocabulary* is not. This is why the structural/operational leg (`DecorrelationDpi.lean`,
support-monotone-under-merging) was the right call on `main` — it proves the partition-coarsening the
measure-theoretic DPI reduces to, without needing the absent entropy defs.

**Proof skeleton (the multi-day Lean job, finite-distribution route):**

```lean
-- 1. DEFINE finite Shannon entropy from the present `Real.negMulLog` (this is the missing primitive).
noncomputable def H (D : FinDist Ω) : ℝ := ∑ x ∈ D.outcomes, Real.negMulLog (D.p x)

-- 2. DEFINE conditional entropy and (conditional) mutual information from joints/marginals:
--      H(A|C) := H(joint A C) − H(C)             -- chain rule as the definition
--      I(A;U|C) := H(A|C) − H(A|U,C)
--    (all as finite sums over product Finsets; Fubini/Finset.sum_product available.)

-- 3. The log-sum inequality (the analytic heart). Either:
--    (a) derive it from `Real.strictConcaveOn_negMulLog` + Jensen
--        (`ConcaveOn.le_sum` / `inner_le_weight_mul_Lp`-style finite Jensen in
--         `Mathlib/Analysis/MeanInequalities*`), OR
--    (b) route through `klFun` (`strictConvexOn_klFun`) + `klDiv_compProd_left`/chain rule,
--        recasting mutual information as a KL divergence `I(X;Y) = klDiv (joint) (prod of marginals)`
--        and DPI as KL-monotonicity under the deterministic kernel `f` — but note Mathlib has the
--        chain rule and `klDiv_compProd_left`, NOT the kernel-push-forward monotonicity, so this
--        path ALSO needs a new lemma (`klDiv` decreases under a deterministic/Markov post-kernel).

-- 4. DPI proper: post-processing the conditioning side is a coarsening kernel on U; mutual info
--    is non-increasing under it. Combine step 3 with the marginalization identity
--    H(A|f(U),C) ≥ H(A|U,C)  ⟺  I(A;U|C) ≥ I(A;f(U)|C).

-- 5. ρ_owe corollary: divide by H(A|C) > 0 (the genuine-other normalizer), monotonicity preserved.
```

**Missing Mathlib pieces, named:**

1. **Finite Shannon entropy `H` and (conditional) mutual information** — must be defined in-tree
   from `Real.negMulLog` (step 1–2). This is the bulk of the work and is reusable substrate.
2. **A finite log-sum / Jensen application** to `negMulLog` — Mathlib has `ConcaveOn` + the mean
   inequalities, but the *log-sum inequality* `∑ aᵢ log(aᵢ/bᵢ) ≥ (∑aᵢ) log(∑aᵢ/∑bᵢ)` is not a named
   lemma; it must be assembled from `concaveOn_negMulLog` + finite Jensen.
3. **OR** (KL route) **`klDiv` data-processing monotonicity** under a kernel — also a new lemma; the
   chain rule (`klDiv_compProd_eq_add`) and `klDiv_compProd_left` are the closest present scaffolding.

**Estimated shape:** defining entropy/MI + the log-sum lemma + the DPI theorem is a **multi-day Lean
job** (the entropy-defs alone are a small library). The honest outcome for *this* summon is the map +
skeleton above; the row-3 measure-theoretic theorem stays open for Tariq/Kenji and would be a strong
upstream contribution to Mathlib (a Shannon-entropy module) if pursued.

## Honesty / scope notes

- **No operational leg weakened.** `EntropyFloorLift.lean` and `DecorrelationDpi.lean` are untouched;
  the new file is additive and cross-checks row 1.
- **`Classical.choice` in the axiom set is expected** for the real-number leg (Mathlib's `ℝ`/`logb`
  machinery is classical), unlike the pure-`Nat` operational legs (`[propext, Quot.sound]`). This is
  named, not hidden — it is the price of the genuine measure-theoretic statement.
- **`ρ_owe` stays evidence, not the lemma** (handoff invariant): the row-3 skeleton above is the
  lemma route; the FsCheck `ρ_owe` leg (#8715) remains an independent evidence channel.

## Beacon anchors

- Rényi 1961 (α→∞ Rényi entropy = min-entropy); Cover & Thomas, *Elements of Information Theory*
  (entropy, independence-additivity, DPI Thm 2.8.1); Dodis–Reyzin–Smith 2004 (min-entropy as
  cryptographic guessing-hardness); Bell 1964 (single-body floor, lifted to a pair);
  Goguen–Meseguer 1982 (noninterference — `ρ_owe` is this, Shannon-quantified).
- Mathlib modules cited by exact path above (rev `v4.30.0-rc1`).
