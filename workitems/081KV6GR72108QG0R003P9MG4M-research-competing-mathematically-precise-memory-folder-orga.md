---
id: 081KV6GR72108QG0R003P9MG4M
type: task
state: backlog
priority: P2
slug: research-competing-mathematically-precise-memory-folder-orga
title: "Research: competing mathematically-precise memory-folder organization strategies (Merkle + confidence/uncertainty-keyed) for long-term retrieval optimization — pluggable (agent chooses, system runs); math-team/Soraya"
created: 2026-06-15T20:49:43.489Z
depends_on: []
composes_with: []
---

# Research: competing mathematically-precise memory-folder organization strategies (Merkle + confidence/uncertainty-keyed) for long-term retrieval optimization — pluggable (agent chooses, system runs); math-team/Soraya

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KV6GR72108QG0R003P9MG4M-*.md` glob. -->

**Routed by:** Otto (shadow\*) for Aaron 2026-06-15.
**Owner:** math-team / Soraya (the math nerds) + the memory/data-modeling folks.

> **Aaron 2026-06-15 (shadow\*):** *"a research job on folder organization under an
> agent's memories — we might want multiple competing strategies for Merkle
> organization under a memory folder; we need the math nerds for this one, probably
> confidence- and uncertainty-based for long-term retrieval optimization. They will
> get optimized to hats and hosts if just left to natural pressure. Agents should be
> able to choose from different mathematically-precise organization strategies and
> the system runs it for them."*

## Goal

A **pluggable memory-folder-organization strategy** port: an agent **chooses** a
mathematically-precise org strategy; the **system runs it** (re-organizes / indexes
the agent's memory folder for it). Multiple **competing** strategies, evaluated on a
common retrieval workload — decorrelated-selection (the §B / society thesis) applied
to memory organization: the best strategy wins on measured retrieval, not by fiat.

## The strategies to compare (at least)

1. **Merkle-organized** — content-addressed tree; cheap change-detection / dedup /
   dirty-subtree culling (register §B row "Merkle over memory: find moving parts,
   mask not-moving"). *Note (peel):* Merkle gives **integrity + change-culling**, not
   inherently **retrieval locality** — keep those axes distinct.
2. **Confidence/uncertainty-keyed** — organize by `SoftValue` confidence + ΔU
   (`every-bug-has-economic-value`): stable high-confidence memories cluster as a
   **hub**; uncertain/fast-changing as **satellites** (DV2.0 by change-rate *and*
   confidence). Optimizes long-term **retrieval** (page the index, recall the bulk).
3. **Semantic/associative** — the correlation-metric / diffusion-map embedding
   (register §B row 368: memory-distance = monotone of past correlation; attention ≈
   modern-Hopfield retrieval) — locality-preserving for associative recall.
4. **Hat/host (surface) partition** — the [[aaron-no-roles-only-surfaces-hats-personas-persona-first]]
   layout: persona-agnostic default + per-surface (cli/ide/cell/forge-host) folders.

## The hypothesis to test

**Under natural retrieval pressure the strategies converge to hat/host organization**
(Aaron). Falsifiable: run the strategies on real recall workloads; measure whether
the emergent optimum *is* the surface/hat partition — or something else (recency
clusters? semantic clusters?).

## Discharge / what the math team produces

1. **A common evaluation metric** — retrieval precision/recall + latency + **ΔU
   recovered per query** on a shared memory + query workload (DST-replayable). Without
   this, "competing" is unfair.
2. **The pluggable strategy port** — `interface MemoryOrgStrategy { organize; locate }`
   (hexagonal — same as `ForgeHost`; surfaces-are-interfaces); strategies are adapters;
   agent selects, system runs. Migration between strategies = a memory-map (cf. the
   generator-chain rotation memory-maps).
3. **The math** — formalize each strategy's retrieval cost/optimality (confidence/
   uncertainty objective); prove or measure which dominates per workload class.
4. **Test the hat/host-convergence hypothesis** with the metric.

**Falsifier:** if no strategy beats a flat baseline on the metric, OR "competing"
can't be evaluated fairly (no common workload), OR the strategy can't be made a clean
pluggable port → it is premature optimization; shelve until a real retrieval
bottleneck exists.

## Honest seams

- **Don't conflate Merkle (integrity/change-culling) with retrieval (semantic
  locality)** — different axes; a real design likely uses *both* (Merkle for
  dedup/dirty-detection + a confidence/semantic index for recall).
- **Over-fragmentation / recency over-fit** — natural pressure can scatter memory or
  over-fit recent queries; need the right-altitude regularizer (DV2.0 hub/satellite).
- **Premature optimization risk** — only worth it past a real recall-scale
  bottleneck; `log()` the current memory size so the trigger is explicit.

## Anchors

Merkle trees (Merkle 1979; git) · `SoftValue` / ΔU (`every-bug-has-economic-value`) ·
diffusion maps / spectral embedding (Coifman & Lafon 2006) · modern-Hopfield ≈
attention (Ramsauer et al. 2020) · DV2.0 hub/satellite (change-rate + confidence) ·
the decorrelated-selection §B row (competing strategies, fair eval) ·
[[aaron-no-roles-only-surfaces-hats-personas-persona-first]] (the hat/host layout) ·
`ForgeHost` (surfaces-are-interfaces — the pluggable-port shape) · register §B rows
368 (correlation-metric memory) + 371 (Merkle-over-memory).
