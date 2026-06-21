---
id: 081KS3X9Y0008QG0R0006MQXA4
priority: P2
status: open
title: Tier-deferred causality worked example — 2-tier Z-set composition demonstrating different observable orderings
tier: research-grade
effort: M
ask: maintainer Aaron + Kestrel-claude.ai 2026-05-21
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R002ZRNDJ8, 081KRW63S0008QG0R002YAA09X, 081KRW63S0008QG0R001SAHYKV, 081KS3X9Y0008QG0R003044PQQ]
tags: [zeta-id, causality, hlc, vector-clock, crdt, dbsp, zset, publishable]
type: research
---

# Tier-deferred causality worked example

## Context

In the 2026-05-21 Kestrel conversation, Aaron proposed:

> "We have a concept of never collapsing tension like this and saving
> it into the metadata / enrichment layers"

Applied to causality: instead of forcing each ID to commit to a single
causality tier (monotonic-within-partition vs HLC-across-partition vs
tensor-across-trust-boundary) at write time, preserve the tension —
metadata carries enough information for downstream readers to interpret
under multiple causality models; tier choice happens at read time.

Kestrel's response: this is publishable IF we ship a one-page F# Z-set
worked example showing 2-tier protocols producing different observable
orderings, with a query composing across them. Without the worked
example, it risks being a metadata architecture that defers the hard
problem without solving it.

Aaron's DBSP/Z-set/retractable-time infrastructure (with LINQ /
circuit / filesystem / graph interfaces + Bayesian + physics operators
over composable computation expressions) is exactly the substrate where
this can be expressed.

## Scope

### Phase 1 (this row) — minimal worked example

`docs/research/tier-deferred-causality-zset-worked-example.fsx`
(~8-12 lines per Kestrel's spec) showing:

1. Two events A and B
2. Two causality tiers:
   - Tier α (monotonic-within-partition): A precedes B (lower counter)
   - Tier β (vector-clock-across-partition): A and B concurrent
3. Z-sets indexed by tier holding both views
4. Query that composes across tiers + returns the partial order
   appropriate for the reader's declared policy

Each tier's view is a separate Z-set maintained incrementally under
its own protocol. Retraction semantics shown explicitly when a tier's
view changes.

### Phase 2 (follow-up row) — publishable artifact

If Phase 1 demonstrates the algebra works:

- Write up as a research note in `docs/research/zeta-tier-deferred-causality.md`
- Frame in Lamport/CRDT/event-sourcing/Riak DVV lineage
- Show end-to-end use case where tier-deferred outperforms tier-fixed
  on a realistic workload (Kestrel's bar for publishable: "show
  measurable wins from tiered causality with numbers")
- Submit to a distributed-systems venue (PODC / DISC / ICDCS) or
  AI-safety-adjacent track

Composes with Riak DVV substrate, Aaron's CRDT library in F#, HLC
(081KS3X9Y0008QG0R003044PQQ), and the broader Agora V6 architecture (081KRW63S0008QG0R002YAA09X integrate-as-
choice-locus is the read-time tier-selection mechanism).

## Acceptance

### Phase 1

- Worked example compiles + runs against existing DBSP/Z-set library
- Output demonstrates two different orderings for same event pair
  under different tier protocols
- Retraction semantics validated when a tier view updates

### Phase 2

- Research note shipped to `docs/research/`
- Internal review pass via cross-substrate triangulation (Mika /
  DeepSeek / Amara)
- External submission decision (publish vs hold as internal substrate)

## Substrate-honest framing

Kestrel: "The instinct is good, the precedent is partial, the
load-bearing question is whether you can describe the read-time
tier-selection precisely enough that two implementors would build
the same system from your spec. If yes, you've got something
genuinely novel. If no, you've got a metadata architecture that
defers the hard problem without solving it."

Phase 1 is the discriminator. Ship it small; let the result decide
Phase 2 scope.

## Composes with

- 081KRW63S0008QG0R002KC5DSR (wave-particle duality)
- 081KRW63S0008QG0R002ZRNDJ8 (Limit-as-simulation — tier-views can be Limit-mode
  speculations before Integrate commits)
- 081KRW63S0008QG0R002YAA09X (Integrate-as-choice-locus — read-time tier selection IS
  the Integrate)
- 081KRW63S0008QG0R001SAHYKV (English-as-projection — different tier views project to
  different English narrations of "what happened")
- 081KS3X9Y0008QG0R003044PQQ (ZetaId v2 HLC — provides one of the tier protocols)
- Riak DVV (external substrate, cited)
- Lamport 1978 logical clocks (external substrate, cited)
- Aaron's CRDT library + DBSP infrastructure
