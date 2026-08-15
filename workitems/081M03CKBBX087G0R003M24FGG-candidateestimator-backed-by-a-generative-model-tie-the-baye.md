---
id: 081M03CKBBX087G0R003M24FGG
type: task
state: backlog
priority: P2
slug: candidateestimator-backed-by-a-generative-model-tie-the-baye
title: "CandidateEstimator backed by a generative model: tie the Bayesian factor graph / BNN into PredictionScheduler so alternative futures are theorized, not hand-supplied"
created: 2026-08-15T18:57:55.581Z
depends_on: []
composes_with: []
---

# CandidateEstimator backed by a generative model: tie the Bayesian factor graph / BNN into PredictionScheduler so alternative futures are theorized, not hand-supplied

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M03CKBBX087G0R003M24FGG-*.md` glob. -->

## Why

Aaron 2026-08-15: *"for prune to fully be realized we have to tie our Bayesian factor graphs
and/or our BNNs into the scheduler so different alternative futures can be theorized and
pruned. I don't think we have this yet — this is future work, but very very important for
implementation of Rodney's Razor."*

**Cost-bound pruning and possibility-space pruning are different mechanisms, and the first
never becomes the second by getting better.** Cost-bound pruning drops a branch whose
predicted cost blows up — it prunes *within one plan* and needs only a cost model
(`Vision.predictBranches` + `BonsaiCost`, shipped). Rodney's Razor chooses *among alternative
plans that do not exist yet*, which requires representing counterfactual futures. That is
inference, not bookkeeping. A scheduler with a perfect cost model still cannot do it, because
it has nothing to compare against.

## Measured state — this is "finish it," not "build it"

Aaron's *"I don't think we have this yet"* is a hedge; the measurement is narrower and
cheaper than the hedge implies. The F# path from a posterior to the scheduler **already
exists and is complete**:

```
PredictionInference.Candidate {Prior; Likelihood; Cost}   src/Core/PredictionInference.fs:16
  -> infer               exact rational posterior = prior x likelihood, deterministic rank
  -> rankWithPriority    boarding weight = posterior x attention x gravity
  -> Vision.predictBranches      board the affordable prefix, DEFER the rest
  -> PredictionScheduler.Planned -> SoftScheduler.HandlerK
```

The scheduler therefore **already takes a distribution rather than a scalar cost**, and
`src/Bayesian/QuantumFusion.fs:421` already feeds Beta posteriors through the declared
`Vision.IBranchForecaster` port. Dependency direction is `Bayesian -> Core.Vision`, which is
the right way round.

Two things are genuinely missing:

1. **The candidate generator.** `PredictionScheduler.CandidateEstimator` is caller-supplied
   and no production implementation *derives* candidates with priors from a learned generative
   model — priors and likelihoods are hand-supplied at every call site. This is the
   "alternative futures are theorized" half.
2. **The TypeScript Bayesian layer is disjoint.** `src/Core.TypeScript/bayesian/`
   (`bnn-persistence.ts`, `shiva-weak-factor-graph.ts`, `categorical-bayesian-planner.ts` —
   which contains `BayesianHierarchicalSearch`, an actual candidate search) has **zero**
   references to `Vision`, `BranchCost`, `FutureBranch`, `predictBranches`, or any scheduler.
   It is consumed only by `planning/society-bnn.ts` and `planning/society-heat-readout.ts`.

## Shape of the work

One `CandidateEstimator` implementation backed by a generative model, against the
scheduler-side interface that already exists. The interesting design question is which
generative model supplies the prior — the F# `QuantumFusion` Beta path is already wired and
is the cheapest join; the TS factor-graph / BNN layer is the richer one and needs a crossing.

## Bar

A generated candidate set must be **falsifiable as a prediction**, not merely produced: there
must be a case where the theorized futures and the observed outcome disagree and something
reports it. Absent that, the estimator is `unmetered` and must say so
(`toy-is-free-metered-must-be-earned.md`). Do **not** let a shipped cost-bound pruner be
described as satisfying Rodney's Razor — that is the silent-promotion failure.

## Successor thread: decorrelated cheap estimators

Aaron 2026-08-15: *"this is where AI intelligence comes into play. This has had humans stuck
for a long time because of disagreements. Fast failures and decorrelated cheap AI is the way
to improve this."*

`BonsaiCostMeasure.measureWith` already takes **the predictor as a parameter**, so N
independent estimators can be scored against the same actuals with no further plumbing. The
open question — untested — is whether many cheap decorrelated estimates beat one
carefully-argued recurrence for cost prediction.

**Register:** this is a structural resemblance to the PR #10834 tangle finding (a correlated
quorum buys nothing at any N; a decorrelated one bounds the stall), **not** a transfer with
evidence. That finding is about escape times, not big-O estimates. Per
`numerology-vs-number-theory.md` it stays a coincidence-index entry until someone supplies the
structure — which here means actually scoring an ensemble against `standardCorpus` and
reporting whether `ConcordantFraction` improves.

## Pointers

- `docs/research/2026-08-15-inject-the-scheduler-at-the-evaluation-seam-not-the-encoding-seam-and-what-the-app-free-claim-actually-survives.md` §6 — the measurement above
- `src/Core/PredictionScheduler.fs` — `CandidateEstimator`, the caller-supplied seam
- `src/Core/PredictionInference.fs` · `src/Core/Vision.fs` — the existing posterior -> budget -> prune path
- `src/Bayesian/QuantumFusion.fs:421` — the one production `IBranchForecaster`
- `src/Core/BonsaiCost.fs` — cost-bound pruning, shipped; explicitly NOT this
