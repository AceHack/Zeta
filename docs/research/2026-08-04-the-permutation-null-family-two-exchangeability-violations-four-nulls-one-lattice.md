# The permutation-null family — two exchangeability violations, four nulls, one containment lattice

**Date:** 2026-08-04
**Author:** Otto (shadow\*)
**Status:** method note (register-2 throughout — this is about the *instrument*, not a claim about the world).
**Code:** `DecorrelationExcess` (`permutationNull*` family) + `DecorrelationExcessFusion` (`fuse*`), PRs #10017–#10022, merged.
**Companion:** the arc capstone `2026-08-04-decorrelation-instrument-arc-capstone-*` (what the instrument *found*); this note is how its **null** is built.

---

## 1. Why a family, not a null

The excess-over-null instrument convicts a pair/stratum when its real statistic exceeds a permutation-null threshold. The permutation null's validity rests on one assumption — **exchangeability**: that under the null, any re-ordering of the samples is equally likely. A real commit stream **violates exchangeability in two independent ways**, and each violation, left unmodelled, makes the null too tight and the test over-convict:

| Violation | What it is | Concretely, in commit history |
|---|---|---|
| **Fine autocorrelation** | short-range dependence (lag `< L`) | a writer touches one subsystem across a *span* of consecutive commits |
| **Era-marginal drift** | the marginal distribution shifts over time | the fleet's focus moves — a docs-heavy window, a Core-heavy window |

A single shuffle that ignores both destroys both structures, so the null under-states the true fluctuation and manufactures "excess." The family is four nulls, each preserving a different subset of that structure. (This is Soraya's autocorrelation caveat — first raised for the CHSH Hoeffding margin — generalized to the whole permutation family.)

## 2. The four nulls

Each null is a **restricted permutation** of the B-side stream (ordered by commit `generation`, a pure causal-temporal ordinal — a *local* null calibration that never enters the shared conclusion, `local-time-never-enters-the-shared-fold`). What differs is *which* permutations are allowed:

| Null | Permutation allowed | Preserves | Anchor |
|---|---|---|---|
| **plain** (`permutationNull`) | any permutation | nothing | Fisher 1935 / Pitman 1937 |
| **block** (`…Block`, L) | permute *order* of length-`L` blocks, blocks intact | fine autocorrelation (lag `< L`) | Künsch 1989; Politis–Romano 1994 |
| **within-era / window** (`…Window`, W) | permute *within* each length-`W` window, windows in place | era-level marginals | Reichenbach 1956 (condition on era) |
| **combined** (`…WindowBlock`, W,L) | block-permute *within* each era-window | **both** | Künsch ⊗ Reichenbach |

`blockSize = 1` collapses block→plain and combined→window; `windowSize ≥ n` collapses window→plain and combined→block. So the family is one parameterized object, not four ad-hoc tools.

## 3. The containment lattice (why "combined" is provably most conservative)

The allowed-permutation sets are **nested**:

```
        combined  ⊆  block   ⊆  plain
            ∩                     ∪
        combined  ⊆  window  ⊆  plain
```

The combined null's permutations respect era boundaries (so ⊆ block, which does not) **and** keep blocks intact (so ⊆ window, which does not). A **smaller** permutation group means the null distribution sits **closer to the real data** ⇒ a **higher** `(1 − δ)` threshold ⇒ **fewer** convictions. Hence, provably (unit-tested, not merely observed):

> **threshold(combined) ≥ max(threshold(block), threshold(window)) ≥ threshold(plain)**, so
> **convictions(combined) ≤ min(block, window) ≤ plain.**

Conservatism is a lattice, and "combined" is its bottom.

## 4. What it did on real history (register-2)

1200 commits, primary-subsystem observable, exclude causally-disjoint pairs, δ=0.05, k=200, `stratumKey=c/2`. Surviving (convicting) strata:

| null | survivors | removed |
|---|---|---|
| plain MI | **42** | — |
| window-only (W=128) | 42 | *(era drift alone is not the dominant nuisance here)* |
| **block-only (L=64)** | **16** | fine autocorrelation (the dominant nuisance) |
| **combined (W=256, L=64)** | **6** | + era drift |

Every step removed a **named** statistical artifact — never a moved threshold. The order of the drop (block helps a lot, window alone barely) is itself a finding: **on this repo the dominant exchangeability violation is fine autocorrelation, not era drift** (writers work a subsystem across consecutive commits more than the fleet's focus shifts between eras).

## 5. The tuning caveat (do not over-read the combined null)

The combined null has a degenerate regime: as `blockSize → windowSize`, each window holds `≈ 1` block, so **almost no shuffling happens** — the null becomes the identity, the threshold meets the real MI, and convictions collapse to **0** (observed at W=128,L=64 and W=64,L=32). That 0 is meaningless (over-conservative), not "nothing is coupled." The usable regime is **block ≈ ¼ window** (W=256,L=64 → 6; W=128,L=32 → 9). Report the (W,L) with any combined-null reading; a bare survivor count is uninterpretable without it.

## 6. The practical recommendation

- **Default:** block-null + exclude-disjoint (**16** survivors). Corrects the dominant nuisance; not degenerate.
- **Strict reading:** combined W≈4L + exclude-disjoint (**6** survivors). The hardest, most defensible candidates — coupling surviving *both* nulls.
- **Lenses:** window-only isolates era-marginal coupling; plain is the baseline. Keep in the kit, not the default.
- **Always:** `WithinNull` never acquits; the observable is coarse; a single (window, δ, k, W, L, window-of-history) is a measurement, not a census.

## 7. What this buys the load-bearing claim

The grid-trust instrument (`docs/explainers/decorrelation-meter-grid-trust-for-max.md`) needs a null that a skeptic can't dismiss as "you just didn't model the autocorrelation." The family answers that: the null is now **exchangeability-honest on two axes at once**, provably the most conservative member is available, and the whole ladder from 42→6 is a readable audit of exactly which artifacts were removed. A shared, deterministic, re-runnable instrument whose *null* is itself defensible is the point — trust the math, re-run the math.

## Anchors

Fisher 1935 / Pitman 1937 (permutation test); Künsch 1989 (moving-block bootstrap); Politis–Romano 1994 (block bootstrap); Reichenbach 1956 (common cause / conditioning); Shannon 1948 (MI); Lamport 1978 (commit-DAG generation). In-repo: `src/Core/DecorrelationExcess.fs` (`shuffle`/`blockShuffle`/`windowShuffle`/`windowBlockShuffle` + the `permutationNullMI*` family), `src/Core/DecorrelationExcessFusion.fs` (`fuseMI`/`fuseMIBlock`/`fuseMIWindow`/`fuseMIWindowBlock`); companion capstone `2026-08-04-decorrelation-instrument-arc-capstone-*`.
