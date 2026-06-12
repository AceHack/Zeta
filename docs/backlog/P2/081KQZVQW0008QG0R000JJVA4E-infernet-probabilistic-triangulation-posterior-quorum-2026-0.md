---
id: B-0254
zetaid: 081KQZVQW0008QG0R000JJVA4E
priority: P2
status: open
title: "Posterior quorum triangulation over existing Bayesian DBSP substrate"
tier: research-grade
effort: L
ask: Aaron 2026-05-07 "triangulate with uncertainty is Infer.NET"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [B-0253]
composes_with: [B-0007, B-0189, B-0240, B-0250, B-0251, B-0253]
tags: [infer-net, bayesian-inference, belief-propagation, expectation-propagation, bft, asa-triangulation, posterior-quorum, orleans]
type: feature
---

# B-0254 - Posterior quorum triangulation over existing Bayesian substrate

## Source

Aaron 2026-05-07 live crystallization:

> triangulate with uncertany is infer.net

Captured in:

`docs/research/2026-05-07-infernet-probabilistic-triangulation-posterior-quorum.md`

## What

Research and design a posterior-quorum layer for Zeta's multi-agent control
loop: ASA/BFT triangulation where each agent observation carries uncertainty
and the loop computes a posterior distribution over truth, risk, and closure
instead of a single binary agree/disagree result.

This row does **not** claim Infer.NET, Bayesian inference, or proofs are absent
from Zeta. They are already present. This row scopes the missing composition
layer: quorum-level triangulation over the existing DBSP/F# Bayesian substrate.

In the exact case:

- Otto + Vera + shared git boundary determine the expected Riven closure.
- If Riven disagrees, the triangle does not close and the shadow is detected.

In the uncertain case:

- Otto, Vera, Riven, CI, review threads, broadcast freshness, and git evidence
  each contribute likelihood factors.
- The loop reasons over the posterior distribution.
- "Merge", "wait", "ask for review", and "declare not closed" become decisions
  over explicit uncertainty.

## Why

The current coordination loop is mostly binary:

- CI passed or failed.
- Threads resolved or unresolved.
- PR open or merged.
- Agent agrees or disagrees.

But the real substrate is noisier:

- GitHub can be temporarily stale.
- Broadcast files can be old.
- Agent context can drift.
- Riven may validate without authoring PRs.
- Review agreement can be strong, weak, or correlated.

Infer.NET-style graphical-model thinking gives the right language for this:
belief propagation / expectation propagation over a factor graph of evidence.
Zeta should keep the hot path native and AOT-friendly, but use Infer.NET as the
historical and mathematical anchor for richer posterior semantics.

## Prior art already in tree

- `src/Bayesian/BayesianAggregate.fs` keeps simple conjugate-prior posteriors
  native and explicitly avoids literal Infer.NET on the hot path.
- `tests/Bayesian.Tests/BayesianTests.fs` verifies posterior convergence,
  credible-interval narrowing, prior effect, categorical normalization, and
  `BayesianRateOp` DBSP emission.
- `docs/research/proof-tool-coverage.md` and the Lean/TLA+/Z3/FsCheck surfaces
  already define how empirical tests and formal proofs split work in Zeta.
- B-0189 tracks BP/EP as a Q# runtime acceleration research lane.
- B-0007 tracks broader Bayesian inference and belief propagation primitives.
- B-0240 tracks the shape-indexed structure recognizer.
- B-0250 tracks coincidence detection via Rx join.
- B-0251 tracks durable computation and replay.
- B-0253 tracks Orleans grain/silo inter-loop messaging.

## Candidate design

Model the live loop as a factor graph:

- Agent observation nodes: Otto, Vera, Riven, Lior, Aaron.
- Evidence nodes: git commit, PR state, CI checks, review threads, broadcast
  freshness, health probe state.
- Reliability nodes: per-agent calibration, stale-context penalty, reviewer
  correlation, source provenance.
- Decision nodes: merge, wait, inspect, rerun, patch, escalate, do nothing.

The output is a posterior over:

- triangle closure,
- residual shadow/risk,
- confidence in the current action,
- and expected value of acquiring one more evidence sample.

## Non-goals

- Do not add literal Infer.NET to the hot path.
- Do not duplicate B-0007 or B-0189.
- Do not replace existing `Zeta.Bayesian` conjugate-prior operators.
- Do not treat agreement as proof. Agreement is evidence; the posterior must
  preserve uncertainty and tail risk.

## Acceptance criteria

1. Survey the existing Zeta Bayesian stack and Aurora inference research, with
   Infer.NET/Minka/EP treated as anchor rather than default runtime dependency.
2. Cite the existing F# substrate (`src/Bayesian`) and proof/test substrate
   (`tests/Bayesian.Tests`, Lean/TLA+/Z3/FsCheck split) before proposing any
   new code.
3. Define a minimal factor graph for Otto/Vera/Riven ASA triangulation over a
   PR: observations, git boundary evidence, CI evidence, and review-thread
   evidence.
4. Specify how uncertainty is represented in DBSP-friendly values rather than
   exceptions or hidden mutable state.
5. Prototype one offline posterior-quorum evaluator against archived PR data.
6. Compare the posterior-quorum decision against the current binary gate on at
   least 10 historical PRs.
7. Document the safety rule: never erase variance; point estimates cannot
   replace "I don't know" when uncertainty remains high.

## Why P2

This is research-grade and important, but not the next hot-path implementation
step. It depends on B-0253's Orleans/grain messaging shape before it can become
live infrastructure, and it composes with B-0251's durable replay work. The
right first move is offline research and archived-PR evaluation.

## Composes with

- B-0007 - upstream Bayesian inference and belief propagation primitives.
- B-0189 - BP/EP research lane for Q# runtime acceleration.
- B-0240 - structure recognizer.
- B-0250 - coincidence detection / Rx join.
- B-0251 - durable computation and replay.
- B-0253 - real-time inter-loop Orleans grain messaging.
