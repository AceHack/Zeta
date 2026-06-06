---
id: B-0255
zetaid: 081KQZVQW0008QG0R000K3AG4Z
priority: P1
status: open
title: "Probabilistic dials over existing posterior quorum substrate"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [B-0254, B-0251, B-0250]
decomposition: atomic
owners: [architect]
composes_with: [B-0244, B-0249, B-0250, B-0251, B-0254]
tags: [trajectory, bayesian-inference, posterior-quorum, dials]
type: feature
---

# B-0255 - Probabilistic dials over existing posterior quorum substrate

## What

Turn the orthogonal dials (Certainty / Friction / Space) into marginal
posteriors over the existing Bayesian DBSP substrate and the posterior-quorum
work tracked by B-0254.

This row does not claim Infer.NET, BP/EP, or Bayesian operators are missing.
They are already present as backlog/research anchors and F# substrate. The
missing P1 design is how the dials consume posterior-quorum outputs without
erasing uncertainty.

## Why

The current dials are useful but hand-shaped. Once B-0254 defines the
posterior-quorum layer, each dial should become a named marginal or projection
of that posterior:

- Certainty = evidence mass / posterior confidence.
- Friction = expected correction cost under uncertainty.
- Space = action-capacity / option-set width under current evidence.
- Shadow residue = low-evidence or high-variance regions.
- Coherence = posterior convergence, not just binary agreement.

## How

- B-0250 standing queries provide the evidence stream.
- B-0251 durable replay makes the evidence stream reproducible.
- B-0254 defines the posterior quorum over agent observations and git evidence.
- This row maps posterior outputs to dial semantics and dashboard/action gates.
- The fusion equation becomes a statement about expected learning gain under
  uncertainty.

## Acceptance

- [ ] Each dial is defined as a marginal, projection, or calibrated summary of
      the B-0254 posterior quorum.
- [ ] The design cites `src/Bayesian/BayesianAggregate.fs` and
      `tests/Bayesian.Tests/BayesianTests.fs` as existing substrate.
- [ ] The design preserves uncertainty; point estimates cannot replace "I
      don't know" when variance remains high.
- [ ] Standing queries (B-0250) provide the evidence stream feeding the dials.
- [ ] Durable replay (B-0251) can reproduce a historical dial reading.

## Composes with

- B-0254 - posterior quorum triangulation over existing Bayesian DBSP substrate
- B-0251 - durable computation stack
- B-0250 - standing queries
- B-0249 - autonomous backlog runner
- B-0244 - coherence AI

## Carved

Binary consensus is a special case of probabilistic consensus when uncertainty
is zero. The dials are the marginals. The shadow is the low-evidence region.
The factory computes over uncertainty, not around it.
