---
id: 081KQZVQW0008QG0R000K3AG4Z
priority: P1
status: open
title: "Probabilistic dials over existing posterior quorum substrate"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [081KQZVQW0008QG0R000JJVA4E, 081KQZVQW0008QG0R000PPQ3MH, 081KQZVQW0008QG0R001FG05RZ]
decomposition: atomic
owners: [architect]
composes_with: [081KQZVQW0008QG0R001PS4F8G, 081KQZVQW0008QG0R000C35RNY, 081KQZVQW0008QG0R001FG05RZ, 081KQZVQW0008QG0R000PPQ3MH, 081KQZVQW0008QG0R000JJVA4E]
tags: [trajectory, bayesian-inference, posterior-quorum, dials]
type: feature
---

# 081KQZVQW0008QG0R000K3AG4Z - Probabilistic dials over existing posterior quorum substrate

## What

Turn the orthogonal dials (Certainty / Friction / Space) into marginal
posteriors over the existing Bayesian DBSP substrate and the posterior-quorum
work tracked by 081KQZVQW0008QG0R000JJVA4E.

This row does not claim Infer.NET, BP/EP, or Bayesian operators are missing.
They are already present as backlog/research anchors and F# substrate. The
missing P1 design is how the dials consume posterior-quorum outputs without
erasing uncertainty.

## Why

The current dials are useful but hand-shaped. Once 081KQZVQW0008QG0R000JJVA4E defines the
posterior-quorum layer, each dial should become a named marginal or projection
of that posterior:

- Certainty = evidence mass / posterior confidence.
- Friction = expected correction cost under uncertainty.
- Space = action-capacity / option-set width under current evidence.
- Shadow residue = low-evidence or high-variance regions.
- Coherence = posterior convergence, not just binary agreement.

## How

- 081KQZVQW0008QG0R001FG05RZ standing queries provide the evidence stream.
- 081KQZVQW0008QG0R000PPQ3MH durable replay makes the evidence stream reproducible.
- 081KQZVQW0008QG0R000JJVA4E defines the posterior quorum over agent observations and git evidence.
- This row maps posterior outputs to dial semantics and dashboard/action gates.
- The fusion equation becomes a statement about expected learning gain under
  uncertainty.

## Acceptance

- [ ] Each dial is defined as a marginal, projection, or calibrated summary of
      the 081KQZVQW0008QG0R000JJVA4E posterior quorum.
- [ ] The design cites `src/Bayesian/BayesianAggregate.fs` and
      `tests/Bayesian.Tests/BayesianTests.fs` as existing substrate.
- [ ] The design preserves uncertainty; point estimates cannot replace "I
      don't know" when variance remains high.
- [ ] Standing queries (081KQZVQW0008QG0R001FG05RZ) provide the evidence stream feeding the dials.
- [ ] Durable replay (081KQZVQW0008QG0R000PPQ3MH) can reproduce a historical dial reading.

## Composes with

- 081KQZVQW0008QG0R000JJVA4E - posterior quorum triangulation over existing Bayesian DBSP substrate
- 081KQZVQW0008QG0R000PPQ3MH - durable computation stack
- 081KQZVQW0008QG0R001FG05RZ - standing queries
- 081KQZVQW0008QG0R000C35RNY - autonomous backlog runner
- 081KQZVQW0008QG0R001PS4F8G - coherence AI

## Carved

Binary consensus is a special case of probabilistic consensus when uncertainty
is zero. The dials are the marginals. The shadow is the low-evidence region.
The factory computes over uncertainty, not around it.
