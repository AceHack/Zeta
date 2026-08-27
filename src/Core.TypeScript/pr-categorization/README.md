# PR categorization

Statistics on merged PRs **by area**, plus an honest comparison of three ways to
predict that area. Register: **toy / unmetered** throughout — see the bottom of
this file for exactly which parts are which.

```bash
bun src/Core.TypeScript/pr-categorization/cli.ts --write
```

Writes three artifacts, all flushed together by
`.github/workflows/pr-categorization-cadence.yml`:

| path | what it is |
|---|---|
| `data/pr-categorization/statistics.json` | the statistics file |
| `data/pr-categorization/index.html` | the dashboard |
| `docs/PR-AREA-STATISTICS.md` | the digest |

## The one idea that makes this a measurement

There are two independent notions of a PR's area, and keeping them apart is the
whole design:

- **measured area** — from the file paths the PR actually changed, recovered by
  walking `git log --name-only` and joining on the trailing `(#NNNN)` in each
  squash-merge subject. This is the label. It never reads a title.
- **declared area** — parsed from the title's conventional-commit scope, falling
  back to the branch prefix. This is the **baseline**. It never reads a path.

Because the label and the features come from different sources, predicting one
from the other is a real task rather than a restatement. `areas.test.ts` asserts
the separation directly; if it ever breaks, every accuracy number here becomes an
identity and means nothing.

## What the corpus says

Snapshot 2026-08-27 over 12,985 merged PRs, 16 areas. These figures move as the
corpus grows — the dashboard is the live version, this is orientation:

- the closed-form parse **abstains on ~27%** of PRs, and is **wrong ~32% of the
  time** on the ones it does label;
- of the abstentions, the large majority are `type-only` — a title declaring a
  *kind* of change (`feat:`, `fix:`) and no area at all. That is a fact about the
  fleet's convention, not a limitation of the parser;
- **~3,000 PRs** carry a declared area that disagrees with their diff. That set is
  the product: the closed form cannot produce it, because it never looks at a diff.

Most disagreements are conventions disagreeing with directory layout rather than
anyone being wrong — `society:` ticks that write telemetry, `ferry:` notes that
land in `docs/research`, `deps:` bumps that touch workflows rather than a
lockfile. Naming the pattern is the useful output.

## The models, and the verdict

Every model is reported as a **delta against the closed-form baseline**, never on
its own, and a **label-shuffle null** runs the identical pipeline on permuted
labels. If the null rises above the majority-class floor the pipeline is leaking
and `cli.ts` exits non-zero — a leak invalidates everything else, so it is a
failure and not a warning.

The result worth knowing, and it depends entirely on which split you ask about:

- under a **random (i.i.d.) split**, the BNN and the random forest are
  **statistically indistinguishable** — McNemar returns "no difference" on all
  five seeds tried (p 0.08–0.97). Both beat the baseline by ~11pp.
- under a **temporal split** — train on older PRs, predict newer, which is what a
  scheduled dashboard actually does — the **BNN beats the forest by 6.3–8.9pp on
  every seed tried** (p < 4e-22).

So the BNN earns its place *only under distribution shift*, and this corpus has a
lot of it: in the eleven days before this was written, telemetry went from 12% to
47% of merged PRs and `memory` went to zero. Reporting a single accuracy without
saying which split produced it would hide the only interesting thing here.

`--split temporal` is the default for that reason.

## k-means is not a classifier

`kmeans.ts` reports **chance-corrected** agreement (adjusted Rand index, NMI) and
nothing else. A partition is not a labelling, and `k` clusters matching `k` areas
by count is a coincidence, not an identification — see
`.claude/rules/numerology-vs-number-theory.md`. Measured ARI is ~0.04 (random
split) to ~0.13 (temporal) against a null of ~0.000: real but weak structure, and
it is **not** the area taxonomy. The `majorityMap` accuracy is a *supervised
ceiling* and is labelled as such wherever it appears.

## The BNN is the repo's own, and that claim is checked

`bnn.ts` is a diagonal-Gaussian weight posterior with a probit likelihood updated
by moment matching — the same update as `ToyBosonFermionBnn.absorb`, which routes
through `Ep.probitProject`. It is honestly **ADF**, not full EP: one pass, no
per-example site refinement against a cavity. Calling it EP would be a real
citation attached to a claim it does not support.

It is re-derived in TypeScript rather than invoked, because `src/Bayesian` has no
callable entry point outside `dotnet test` — no executable in the repo holds a
ProjectReference to `Bayesian.fsproj` — and a six-hourly statistics lane should
not shell out to a test host. The equivalence is **checked, not asserted**:
`bnn.test.ts` transcribes the F# formulas verbatim and compares a full fold term
by term to 1e-12.

Multi-class is one-vs-rest. The per-class scores are normalised for reporting
only; that normalisation is not a softmax and is not Bayes-exact for a
multinomial-probit likelihood, and the argmax is unaffected by it.

## Anchors (Beacon)

- **k-means** — Lloyd (1957/1982); MacQueen (1967); k-means++ seeding, Arthur &
  Vassilvitskii, SODA 2007.
- **Random forest** — Breiman, *Machine Learning* 45(1):5–32 (2001); CART,
  Breiman, Friedman, Olshen & Stone (1984). Split search is over quantile bins
  (the histogram trick, Ke et al., NeurIPS 2017), which is an approximation of
  Breiman's forest and is named as one in `forest.ts`.
- **ADF / probit moment matching** — Minka, MIT PhD thesis (2001); Bayes Point
  Machines, Herbrich, Graepel & Campbell, JMLR 1:245–279 (2001); the v/w
  correction functions as in TrueSkill™, Herbrich, Minka & Graepel, NeurIPS 2006.
- **Adjusted Rand index** — Hubert & Arabie, *Journal of Classification*
  2:193–218 (1985), correcting Rand (1971).
- **Comparing two classifiers** — McNemar, *Psychometrika* 12(2):153–157 (1947);
  Dietterich, *Neural Computation* 10(7):1895–1923 (1998).
- **Wilson interval** — Wilson (1927).

## Register

- **toy** — `areas.ts` (the taxonomy is a hand-authored convention, not a measured
  partition of the repo; a different fleet needs a different table) and `bnn.ts`
  (a linear model wearing a Bayesian posterior).
- **unmetered** — everything else: standard algorithms, exercised by falsifiers
  on problems with known answers, but no claim that any of them is *good*.
- Nothing here is **metered**. The numbers are measurements of this corpus under
  this taxonomy, and the taxonomy is the part with no falsifier behind it.

## Determinism

No `Math.random()` and no ambient clock anywhere in the model path — entropy
enters only through a seeded `mulberry32` threaded explicitly (discipline #13,
noninterference). Same repo state and same seed give byte-identical output, so a
diff in `statistics.json` means the corpus moved, not that the dice did.
`extract.ts` is idempotent and upserts by PR number; re-running over an unchanged
repo rewrites byte-identical content.

The 6.7MB intermediate feature matrix is deliberately **not** committed — it is a
pure function of the manifest and the git history, and `--features-cache` exists
only to make local iteration fast.

## Files

| file | role |
|---|---|
| `areas.ts` | the taxonomy; `measuredArea` (label) and `declaredArea` (baseline) |
| `extract.ts` | manifest + `git log` + review archives → feature rows |
| `features.ts` | rows → vectors, with the **leakage boundary** between declared-side and diff-derived groups |
| `forest.ts` · `kmeans.ts` · `bnn.ts` | the three approaches |
| `metrics.ts` | accuracy, macro-F1, ARI, NMI, McNemar, Wilson |
| `study.ts` | the comparison, the null, the disagreement set |
| `render.ts` | self-contained HTML + markdown |
| `cli.ts` | the entry point the lane runs; `ARTIFACTS` is the flush list's source of truth |
