---
id: 081KZ7H82J708QG0R002C1EBH1
type: bug
state: backlog
priority: P1
slug: decorrelationexcess-permutation-test-lacks-1-b-k-1-monte-car
title: "DecorrelationExcess permutation test lacks (1+b)/(k+1) Monte-Carlo correction — false-conviction rate exceeds delta at small k"
created: 2026-08-04T23:20:24.903Z
depends_on: []
composes_with: []
---

# DecorrelationExcess permutation test lacks (1+b)/(k+1) Monte-Carlo correction — false-conviction rate exceeds delta at small k

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZ7H82J708QG0R002C1EBH1-*.md` glob. -->

**Found:** 2026-08-04 (autonomous review, harsh-critic pass; confirmed against source by Otto).
**Class:** security-sensitive soundness (anti-Sybil / decorrelation instrument). Verify-before-trust gate applies.

## The defect

`DecorrelationExcess` classifies a pair by `stat > quantile(1 − δ, nullStats)` (`nullThreshold` +
`classifyPair`), with **no `(1 + b)/(k + 1)` Monte-Carlo p-value correction** (Phipson–Smyth 2010; North
et al. 2002) and the **observed statistic excluded** from the reference set. For the MI paths the null is
**exactly `k` values** (`permutationNullMI` yields one MI per permutation), so the per-stratum
false-conviction rate is `P(realMI > quantile(1−δ, k null MIs))` — which for small `k` is unrelated to δ.

- `k = 1`: `quantile(_, [v0]) = v0`; under independence `realMI` and `v0` are exchangeable ⇒ convicts at
  **≈ 0.5** regardless of δ.
- `k = 5, δ = 0.05`: rate **≈ 0.15** (≈ 3× budget).

This **contradicts the module's own repeated "≤ δ per-pair false-conviction budget" / "never a false
green" docstrings**, in the false-conviction direction — falsely flagging honest independent identities,
the exact harm the oracle claims to bound.

## Scope (all affected)

- `src/Core/DecorrelationExcess.fs`: `nullThreshold` (:139), `classifyPair` (:144), `permutationNullMI*`
  (null size = `k`).
- `src/Core/DecorrelationExcessFusion.fs`: **every** consumer — `fuse` (:106-109), `fuseMI` (:178-184),
  `fuseMIBlock`, `fuseMIWindow`, `fuseMIWindowBlock` (all use `nullThreshold delta` + `classifyPair`).
- Per-pair pooled `permutationNull` (null size `k·n`) is **less** exposed but shares the missing `+1` and
  is anti-conservative for thin strata (a 2-pair stratum has ≤ 4 distinct null values however large `k`).

The resolution-floor prose (`DecorrelationExcess.fs:47-52`) covers `n > 1/δ` **pairs**, NOT the
permutation count `k`; an MI test needs `k ≳ 1/δ` because the null size *is* `k`. No `k` guard exists.

## Secondary (same review)

- **P2 — `quantile` throws `IndexOutOfRangeException` on `delta ∉ (0,1)`** (`DecorrelationExcess.fs:116-124`
  via `nullThreshold`): `q = 1 − δ`; `δ < 0 ⇒ q > 1 ⇒ hi > Length−1`; `δ > 1 ⇒ q < 0 ⇒ lo < 0`. Sibling
  `AntiSybil.chshMargin` guards `δ ≤ 0 || δ ≥ 1 → infinity`; this path crashes instead of degrading to
  `WithinNull`.
- **P2 (UNPROVEN) — pooled per-pair null mixes heterogeneous pairs** under one threshold, so the per-pair
  level is not uniformly δ (partly acknowledged at `DecorrelationExcess.fs:42-45`). No closed-form witness
  constructed; flagged, not confirmed.

**Clean (checked, no defect):** `effectiveSampleSizeHAC` / `neweyWestBandwidth` / `lagKAutocorr` (Bartlett
VIF Newey–West form correct), `chshMarginAutocorr` (`n_eff < 1 ⇒ ∞` guard), AR(1) `effectiveSampleSize`,
`mutualInformation` + entropy stack, `spacelikeCommitPairs`/`ancestors`/`generation`, all four
shuffle/blockShuffle/windowShuffle permutation families (genuine permutations, safe degenerate paths).

## Proposed fix (design choices for Soraya + Aaron — the reason this is gated, not auto-landed)

Exact Monte-Carlo p-value (self-enforces the k-floor in the safe direction):
`p = (1 + #{null_i ≥ observed}) / (k + 1)`, convict iff `p ≤ δ`. When `k + 1 < 1/δ`, `p ≤ δ` is
impossible ⇒ nothing convicts (soundness-biased toward `WithinNull` — matches the module's stated
philosophy). Add `permutationPValue` + `classifyByPValue`, rewire the five fusion consumers, guard
`nullThreshold`/`quantile` for `δ ∉ (0,1)`, and add a **falsifier test** measuring empirical
false-conviction rate vs δ across `k ∈ {1,5,19,50}` on independent categories.

**Design decisions a reviewer should weigh:** (a) p-value classification vs explicit `k ≥ 1/δ` guard on
the quantile path; (b) whether `MIStratum` gains a `PValue` field (additive) and how `NullThreshold`'s
role shifts to audit-only; (c) the UNPROVEN heterogeneous-pooling item.

Fix PR is up but **NOT auto-merged** — security-soundness verify-before-trust gate
(`security-verify-gate-is-a-du-workflow-transition`); needs Soraya BP-16 cross-check + Aaron sign-off.

---

## UPDATE 2026-08-06 — merged fix landed (#10052); Soraya BP-16 cross-check DONE; P2 CONFIRMED + fixed

**#10052 merged** (Aaron sign-off). Then the deferred **Soraya BP-16 independent cross-check** ran:

- **Claim 1 (the `(1+b)/(k+1)` p-value math): CLEAN.** Correct Phipson–Smyth; `≥` counts ties toward the
  null (conservative); `+1`/denominator correct; `p ≤ δ` valid. Ships as-is.
- **Claim 2 (edge cases): CLEAN.** empty null / nan observed / `δ ∉ (0,1)` / `k=1` / the k-floor / the
  `quantile` clamp all correct; the P2-quantile crash is double-protected.
- **Claim 3 (the UNPROVEN heterogeneous-pooling P2): CONFIRMED DEFECT** — real, confined to the `fuse`
  jaccard path. It pooled ONE null over all pairs in a stratum, so an honest **heavy-touch commit**
  (broad touch-set, statistic high-but-CONSTANT across partners = zero excess over its own null) convicts
  at `p≈1/n` against a pool dominated by light pairs' zeros. Witness: 30 pairs, `k=100`, `δ=0.05` →
  pooled `p=0.034` (convict) vs correct per-pair `p=1.0` (WithinNull). The MI paths (`fuseMI*`) are CLEAN.

**Fix (Soraya-prescribed, 2026-08-06):** added `DecorrelationExcess.permutationNullPerSlot` (each pair's
OWN null = `a_i` re-paired with random B's); rewired `DecorrelationExcessFusion.fuse` to classify each pair
against its per-slot null instead of the shared pooled null. Added a falsifier reproducing Soraya's exact
witness. MI paths untouched (clean). **Rides the same verify-gate: NOT auto-merged; Soraya's cross-check
backs the approach; needs Aaron's sign-off to land.**
