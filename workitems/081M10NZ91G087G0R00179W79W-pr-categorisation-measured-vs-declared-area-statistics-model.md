---
id: 081M10NZ91G087G0R00179W79W
type: task
state: backlog
priority: P2
slug: pr-categorisation-measured-vs-declared-area-statistics-model
title: "PR categorisation: measured-vs-declared area statistics, model comparison, dashboard"
created: 2026-08-27T03:59:42.128Z
depends_on: []
composes_with: []
---

# PR categorisation: measured-vs-declared area statistics, model comparison, dashboard

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M10NZ91G087G0R00179W79W-*.md` glob. -->

## What was asked

Aaron: PR categorisation with statistics by area, tied into the existing PR
archive, updating a statistics file, shown on an ever-updated GitHub-Actions
webpage — using k-means / a forest / "our BNN, with some comparison".

## The design decision that makes it a measurement

"Area" is largely derivable from a conventional-commit title, so a study that
predicts the declared area from title features would be reproducing its own
input. Two independent sources are used instead:

- **label** = *measured* area, from the file paths the PR's squash-merge
  actually touched (recovered from `git log --name-only`, joined on the trailing
  `(#NNNN)`); 98.1% of merged PRs are recoverable this way.
- **features** = *declared* side only — title prose with the scope prefix
  stripped, branch, author, timing.

`areas.test.ts` asserts the separation. Without it, every accuracy below is an
identity rather than a result.

## Findings

- Closed-form baseline: **73.6% coverage**, **68.1% correct where it speaks**,
  **50.1% overall**. (Snapshot 2026-08-27, 12,985 PRs; the dashboard is live.) It abstains on ~27% of PRs, and most abstentions are
  `type-only` — a title declaring a *kind* of change and no area at all.
- **3,050 PRs (31.9% of those with a parseable area) disagree with their diff.**
  This set is the deliverable; the closed form cannot produce it. Dominant
  patterns are conventions vs directory layout, not error: `society:` ticks
  writing telemetry, `ferry:` notes landing in `docs/research`, `deps:` bumps
  touching workflows.
- **Label-shuffle null is clean**: under a random split both null models land at
  20.4%/20.5% against a 20.2% majority-class floor — they degenerate to guessing
  the biggest class, which is what a non-leaking pipeline does.
- **The BNN's value is entirely a distribution-shift effect**, and this is the
  result worth keeping:
  - random (i.i.d.) split — BNN and forest are **indistinguishable**; McNemar
    returns "no difference" on all five seeds (p 0.08–0.97). Both beat the
    baseline by ~11pp.
  - temporal split — **BNN beats the forest by 6.3–8.9pp on every seed**
    (p < 4e-22), 73.8% vs 69.2% vs a 58.9% baseline.
- **k-means does not recover the taxonomy.** ARI ~0.04 (random) to 0.131
  (temporal) against a null of ~0.000. Real but weak structure, and not the areas.
- Incidental finding, and the reason the temporal split matters: in the eleven
  days to 2026-08-27 the merged-PR mix went to **46.5% telemetry and 23.4%
  archive**, with `memory` at **0.0%** — against 11.6%/6.1%/11.2% before.

## Shipped

- `src/Core.TypeScript/pr-categorization/` — taxonomy, extractor, feature map,
  three models, metrics, study, renderer, CLI, and falsifiers.
- `data/pr-categorization/statistics.json` · `index.html` · `docs/PR-AREA-STATISTICS.md`.
- `.github/workflows/pr-categorization-cadence.yml` — 6-hourly, flushes via the
  staging lane, never pushes `main`.
- Registered in `FRESHNESS_ROSTER` so the lane's own silence is caught.

## Honest limits

- The taxonomy is a hand-authored convention (`toy`): it has falsifiers for
  self-consistency but nothing derives it, and a different fleet needs a
  different table.
- Multi-area PRs (29.9%) are collapsed to an argmax for the headline label;
  per-area counts are kept in the row so multi-label work is possible later.
- `demo/red/red-state.json` is telemetry living under `demo/`, so red-state
  flushes show up as a `telemetry -> demo-web` disagreement. That is the
  taxonomy and the layout disagreeing, and it is reported rather than tuned away.
