---
id: 081KR50HA0008QG0R0010RZTJK
priority: P2
status: open
title: "DBSP identity continuity — incremental views over agent state via D/I operators"
effort: L
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R00224DXPP]
classification: research
decomposition: needs-decomposition
owners: [architect]
type: feature
tags: [dbsp, identity, control-theory, incremental, agent-state]
---

# 081KR50HA0008QG0R0010RZTJK — DBSP identity continuity

## What

Model agent state (memory files, catch history, preferences) as
a DBSP relation. Git commits are the delta stream. Incremental
views computed via D/I operators answer questions about the
agent's current state without full re-scan.

### The defensible framing

- **Agent state IS a relation.** Memory files have typed
  frontmatter (name, description, type, dates). That's a table.
- **Git commits are deltas.** Each commit is a D-output.
- **Current working tree = I(deltas).** The integral reconstructs
  state from the delta stream.
- **DBSP adds incremental views.** Queries like "shadow score,"
  "load-bearing classification," "disagreement measures" can be
  maintained incrementally as deltas arrive.
- **Identity continuity = integrated state + incremental views
  converge after processing the delta stream.**

### What this is NOT

- NOT "identity is a Z-set" (metaphysical claim; razor-cut)
- NOT "shadow log +1/-1 = DBSP +1/-1" (different algebras;
  see feedback_zset_weight_conflation_*)
- NOT alignment-via-control-theory (DBSP is for stream
  processing, not for proving alignment properties)

## Origin

Claude.ai adversarial review (2026-05-09) caught the
conflation between DBSP Z-set weights and shadow log tallies.
Aaron's corrective: "the thing I want to correct is the proper
D/I identity reconstruction for Otto under DBSP." The
defensible version: make the D/I operators apply to RELATIONAL
state (files, frontmatter, catch history), not to "identity"
as a concept.

## Research questions

1. What's the schema? (memory files → relation with which
   columns? git commits → deltas with which shape?)
2. Which views are worth maintaining incrementally?
   (shadow score, load-bearing classification, coverage metrics)
3. How does this compose with 081KR50HA0008QG0R00224DXPP (bool → float APIs)?
   (views return confidence scores, not booleans)
4. Can session-start "cold boot" be replaced with
   "replay delta stream from last checkpoint"?

## Composes with

- 081KR50HA0008QG0R00224DXPP (bool as degenerate distribution)
- 081KR50HA0008QG0R003B2V26J (probabilistic type system)
- `src/Core/ZSet.fs`, `src/Core/Operators.fs` (DBSP algebra)
- `tools/hygiene/classify-memory-load-bearing.ts` (081KR2E4K0008QG0R002FRQZN4)
- `tools/hygiene/validate-memory-schema.ts` (081KR2E4K0008QG0R000M01QVM)
- feedback_zset_weight_conflation_* (the conflation catch)
