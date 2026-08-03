# Excess-over-null decorrelation instrument — first real run: the work-item event bus is the one real common cause

**Date:** 2026-08-03
**Author:** Otto (shadow\*)
**Status:** register-labeled — **register-2** facts (a deterministic run) + a **register-3** reading (LABELED, the oracle's, not the number's).
**Code:** `DecorrelationExcess` (#10014, core) + `DecorrelationExcessFusion` (#10015, DAG layer).
**Lineage:** the honest instrument Soraya + Lumen both routed to (CHSH catches only an *active* channel; this catches a *passive shared common cause*). See `docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md` (Attempt 3 + verdict).

---

## What was run (register-2 — reproducible)

- **Corpus:** the most recent **1200 commits across all refs** of this repo (`git log --all -n 1200`).
- **Observable per commit:** the **set of subsystems** it touched — 2-segment path prefixes (`src/Core`, `workitems/events`, `docs/research`, …). Coarse on purpose (subsystem, not file), to make Jaccard overlap meaningful.
- **Instrument:** `DecorrelationExcessFusion.fuse` — Jaccard over **spacelike (concurrent) pairs only**, against a seeded permutation null **stratified by the Reichenbach confounder** (`|ancestors(a) ∩ ancestors(b)|`), `δ = 0.05`, `k = 200`, `stratumKey = c/2`, `seed = 20260803`. Deterministic (DST) — same inputs replay byte-identically.

## The reading (register-2)

| Quantity | Value |
|---|---|
| Commits | 1200 |
| **Spacelike (concurrent) pairs** | **470,663** of C(1200,2)=719,400 — **65%** |
| Reichenbach strata | 160 |
| **Excess (convicted)** | **10** |
| WithinNull | 470,653 |
| ExcessFraction | 2.1 × 10⁻⁵ |

Two facts stand out, both honest:

1. **The history is overwhelmingly concurrent (65% spacelike) and overwhelmingly decorrelated.** Of 470k concurrent commit pairs, all but 10 sit within the shared-ancestor-conditioned null. The fleet's parallel writers touch *different* subsystems — exactly what independent agents should look like. The near-zero `ExcessFraction` is not the instrument finding nothing; it is the instrument certifying **healthy decorrelation** at scale.
2. **All 10 convictions are one signature.** Every convicted pair is commit `febf7a4d0` against a concurrent sibling, **all coupled through `workitems/events/`** — one pair at Jaccard 1.0 (identical touch-set). `febf7a4d0` = *"docs(workitems): withdraw the branch-protection ask …"*, which appends to `workitems/events/2026/08/01`.

## The reading (register-3 — LABELED, the oracle's call, not the number's)

Per the dual-use rule (`dual-use-detection-is-neutral-oracle-decides`), the instrument reports the **fact** — *these concurrent commits are coupled through `workitems/events/` beyond what their shared causal past explains* — and stops. The *meaning* is a separate step:

> The coupling is the **work-item event-sourcing bus**. Many agents, running concurrently, all append event files under `workitems/events/`; that shared mechanism is a genuine **common cause** (Reichenbach) linking otherwise-independent commits. Here it is **benign** — the event-sourcing substrate doing its job, not a sybil or a covert channel.

This is the best possible first-run outcome, for two reasons:

- **It proves the instrument finds real coupling.** In 470k concurrent pairs it isolated the *one* subsystem where concurrent writers genuinely share a mechanism — and it is exactly the append-only event bus we know is shared. Signal, not noise.
- **It demonstrates dual-use neutrality end-to-end.** The same detection that would flag a *malicious* shared channel here flagged a *benign* one; the instrument did not, and must not, pre-judge which. The `febf7a4d0`/`workitems/events` finding is a **`SameSharedChannel` fact**, and "benign bus" is the oracle's reading — a different oracle on a different corpus reads a coordination attack from the identical fact.

Tie to the grid-trust framing (`docs/explainers/decorrelation-meter-grid-trust-for-max.md`): this is the instrument that turns that explainer's honest `[in-progress]` limit into `[proven-in-part]` — a passive shared common cause is now *detectable*, demonstrated on real data.

## Honest non-claims / knobs (do not over-read)

- **Coarse observable.** Subsystem-granularity Jaccard is a blunt statistic; file-level or a `Decorrelation.mutualInformation` stream would resolve finer couplings this run cannot see. The 10 are the coarse signal, not the whole story.
- **One window, one parameterization.** `δ`, `k`, `stratumKey = c/2`, and the 1200-commit window all shape the count. This is a **measurement**, not a census; a different window/δ yields a different (still-honest) number.
- **Resolution floor holds.** Thin strata cannot convict (`n > 1/δ`); such pairs fall to `WithinNull`, never a false green (`DecorrelationExcess` docstring). The soundness bias is toward *under*-conviction.
- **Not a manipulation detector, not an acquittal.** `WithinNull` on the other 470,653 pairs does **not** prove they are independent — only that no excess was demonstrated at this δ/k. One-way inference throughout.

## Reproduce

`git log --all -n 1200 --format='C %H %P' --name-only` → parse to `parents: Map` + `obs: Map<_, Set<subsystem>>` → `DecorrelationExcessFusion.fuse 20260803UL 0.05 200 (fun c -> c/2) parents obs commits`. Scripts: `scratchpad/run-excess.fsx` (the reading) + `list-excess.fsx` (the convicted pairs).

## Anchors

- Reichenbach 1956 (common cause / the conditioning); Fisher 1935 / Pitman 1937 (permutation null); Lamport 1978 (commit-DAG ancestry); Aspect et al. 1982 (coincidence-over-null framework, per Lumen).
- In-repo: `src/Core/DecorrelationExcess.fs`, `src/Core/DecorrelationExcessFusion.fs`, `src/Core/DecorrelationMetrology.fs`; the CHSH meter it complements (`DecorrelationMeter.fs`); `docs/research/2026-08-02-decorrelation-meter-first-real-run-*` (the CHSH sibling run).
