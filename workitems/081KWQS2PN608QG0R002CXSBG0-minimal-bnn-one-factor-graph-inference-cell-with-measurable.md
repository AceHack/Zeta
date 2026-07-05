---
id: 081KWQS2PN608QG0R002CXSBG0
type: task
state: backlog
priority: P2
slug: minimal-bnn-one-factor-graph-inference-cell-with-measurable
title: "Minimal BNN — one factor-graph inference cell with measurable IV task (not doc vocabulary)"
created: 2026-07-04T23:58:00.000Z
depends_on: []
composes_with: ["081KT2T2J0008QG0R000S7GHQ8"]
---

# Minimal BNN — one factor-graph inference cell with measurable IV task

## Why

External audit (2026-07-04): **"BNN" does not exist as code** — only research/docs use the term.
What exists is conjugate Bayesian message passing in `src/Bayesian/` (factor graph, EP, Gaussian
messages). Docs conflate that with a future "Bayesian neural network transformer."

This work item lands a **minimal, honestly named** slice: one inference cell you can point to as
"BNN" without lying — either extend the factor graph with a single learnable/updateable cell and
a numeric benchmark, or rename/document the boundary so "BNN" = factor-graph runtime until a
true weight-bearing network lands.

## Distinct from

- **081KWQS0NGS** (CliffordAntiSybil AUC benchmark) — Sybil detection metric, not inference/training.
- **081KWPHRNFW** (FROST DKG) — key custody, unrelated.
- Existing `src/Bayesian/FactorGraph.fs` — already ships BP/EP; this item adds the *minimal BNN*
  deliverable (measurable task + explicit "what are the parameters / update rule / objective").

## Done when

1. One module (F# under `src/Bayesian/` preferred) implementing a **minimal inference cell**:
   - explicit state (e.g. Gaussian prior/posterior or one Beta-Bernoulli node on the factor graph)
   - explicit update on observation (conjugate or one EP factor — no backprop required for v0)
   - explicit objective: KL / IV (`InformationValue.compute`) or log-likelihood improvement per step
2. One **measurable task** in CI: input format, output format, numeric metric (e.g. IV nats after
   N observations, or reconstruction error on a toy dataset).
3. Doc comment or ADR stub stating honest scope: "minimal BNN v0 = factor-graph cell with
   measurable IV; not a transformer; not gradient-trained weights."
4. Tests green; no new doc-only "BNN" claims without this code path cited.

## Suggested v0 shape (smallest honest slice)

- Single Gaussian variable + Gaussian likelihood factor on the existing `FactorGraph`
- Stream of observations → running posterior + cumulative IV
- Metric: `InformationValue.compute` sum or mean IV per observation (already defined in
  `src/Bayesian/InformationValue.fs:37-57`)
- Optional: one TypeScript oracle under `tools/` if 4-lang parity is required later — not blocking v0

## Priority

P2 — after 081KWPHRNFW (FROST DKG slice 1) and USB/onboarding round-trip; before or parallel with
081KWQS0NGS (benchmark) depending on research priority.

## Anchors

- `src/Bayesian/FactorGraph.fs`, `Message.fs`, `InformationValue.fs`
- `src/Bayesian/BayesianAggregate.fs` (conjugate online updates — prior art for "parameters")
- Audit note: no `\bBNN\b` in `src/` today
