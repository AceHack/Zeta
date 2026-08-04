# The decorrelation-instrument arc — capstone: what survives artifact-stripping is benign shared buses

**Date:** 2026-08-04
**Author:** Otto (shadow\*)
**Status:** capstone — consolidates the arc; **supersedes the framing of** `2026-08-03-excess-over-null-instrument-first-real-run-*` (that doc's Jaccard finding stands; this adds the finer lenses and the honest bottom line).
**Register:** **register-2** facts (deterministic runs) + a **register-3** reading (LABELED, the oracle's).
**Code:** PRs #10014 → #10019, all merged. `DecorrelationExcess`, `DecorrelationExcessFusion`, `DecorrelationMetrology`.

---

## 1. The arc, and why each layer exists

The question: *do concurrent (causally-independent) commits in our own history show coupling beyond chance — a hidden common cause?* Six layers, each shipping with its **own named limitation**, which the next layer answers. That handing-forward is the point — no layer over-claims.

| Layer | What it adds | Its named limitation → next layer |
|---|---|---|
| **Sensor** (`DecorrelationMetrology`, #9999/#10002) | selects spacelike (concurrent) commit pairs from the DAG | needs a fusion statistic |
| **CHSH meter** (`DecorrelationMeter`, #10004/#10010) | Bell-inequality test over spacelike pairs | **inverted for the primary threat** — catches only an *active* channel; a *passive shared seed* sits *under* the bound (Soraya + Lumen) |
| **Excess-over-null / Jaccard** (`DecorrelationExcess`, #10014/#10015) | catches the passive common cause: touch-set overlap vs a permutation null, Reichenbach-stratified | Jaccard sees only *literal* overlap |
| **Mutual information** (#10017) | the *finer* lens: identity-coupling (A-touches-X ⟺ B-touches-Y) with zero overlap | plain permutation null assumes **exchangeability** → over-convicts on autocorrelated streams |
| **Block-permutation null** (#10018) | preserves lag-`<L` autocorrelation (Künsch 1989); generation-ordered | can't rescue **band-0** — causally-disjoint pairs have no common cause to condition on |
| **Disjoint-pair exclusion** (#10019) | `minSharedAncestors` — meter only causally-related pairs | *(resting point)* |

## 2. The false-positive trajectory (register-2)

Each layer removed a real defect, and the spurious-conviction count fell **monotonically — never by moving a threshold**:

| configuration | convicting strata |
|---|---|
| plain MI (`fuseMI`) | **42** / 160 |
| + block null L=4 / L=16 / L=64 | 35 → 27 → **12** |
| + exclude causally-disjoint pairs (L=64) | **11** / 159 |

The striking register-2 fact along the way: **band-0 was 336,291 of 460,849 metered pairs (73%)** — most "concurrent" pairs in a 1200-commit all-refs window are cross-branch and causally disjoint, and never belonged in a common-cause test.

## 3. What actually survives (register-2 → register-3)

After both fixes, the survivors are ranked by how far real MI clears the block-null threshold. The **register-2 fact**: the surviving coupling is dominated by **shared-infrastructure buses** — `docs/github` (the PR-manifest / pr-reviews tracking substrate) appears in nearly every surviving stratum, alongside `docs/claims`, `workitems/done`, `docs/PRIOR-ART-LIST`.

The **strongest survivor, band-100** (excess ≈ 0.26; ~200 shared ancestors — one development "era"), was eyeballed directly: 589 commits, `docs/github`-dominated, with the MI driven by high-degree commits in `tools/setup` (the setup-doctrine / "13 toolchains" / "forge is a PLUGIN" commits), `docs/claims` (release + `dotnet-arm64` crash claims), and one FROZEN-CORE wasm-reproducibility fix.

**Register-3 reading (LABELED — the oracle's, not the number's):**

> There is **no smoking gun**. Every survivor is a **benign** common cause: concurrent agents co-touching a shared append-only tracking surface (PR manifest, claims ledger, work-item events) or clustering in one era around related infrastructure (setup doctrine + release claims). This is the exact pattern the Jaccard lens first found in the work-item event bus — a genuine `SameSharedChannel` **fact**, with "benign" supplied by policy, never by the number (`dual-use-detection-is-neutral-oracle-decides`).

The instrument, fully de-artifacted, tells the truth about our history: the real concurrent-commit coupling **is** the handful of shared substrate buses in the repo — and it names them as neutral facts.

## 4. Honest non-claims (do not over-read)

- **Coarse observable.** Subsystem / primary-subsystem, not file-level. Finer couplings are invisible here.
- **One window, one parameterization.** `δ=0.05`, `k=200`, `stratumKey=c/2`, `L=64`, 1200-commit window. A measurement, not a census; the survivor count shifts with the window (11 on 2026-08-03; ~16 on a window shifted a day).
- **`WithinNull` never acquits.** The non-convicting strata are not certified independent — only no excess was demonstrated at this δ/k/L.
- **Generation is a LOCAL null calibration.** It orders the block null; `RealMI` is order-invariant, so no local axis enters the shared conclusion (`local-time-never-enters-the-shared-fold`).
- **Open frontier (not built):** file-level observable; a within-era (not cross-history) null for finer strata; the CHSH-side sibling of the exchangeability fix — Soraya's `chshMargin` autocorrelation caveat (Caveat A) still stands for the CHSH meter; the CHSH-with-beacon probe Lumen filed as intentional debt.

## 5. Tie to the load-bearing claim

This is the instrument that turns the grid-trust explainer's honest `[in-progress]` limit (#10012) into `[proven-in-part]`: a **passive shared common cause is now detectable on real data**, with an exchangeability-honest null and a well-posed (causally-related) population — the case CHSH structurally could not see.

## Anchors

Bell 1964 / CHSH 1969 / Tsirelson 1980; Reichenbach 1956 (common cause); Shannon 1948 (MI); Fisher 1935 / Pitman 1937 (permutation test); Künsch 1989 / Politis–Romano 1994 (block bootstrap); Lamport 1978 (commit-DAG ancestry); Hoeffding 1963 / Pironio et al. 2010. In-repo: `src/Core/DecorrelationExcess.fs`, `DecorrelationExcessFusion.fs`, `DecorrelationMetrology.fs`, `DecorrelationMeter.fs`; `docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md`; `docs/research/2026-08-03-excess-over-null-instrument-first-real-run-*`.
