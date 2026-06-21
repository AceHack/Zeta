# OpenSpec: Retraction-Native Semantics

This document specifies the principles and guarantees of Retraction-Native Semantics, a core architectural pattern in the Zeta factory.

**Parent:** 081KSNY2Z0008QG0R0016VFTRX

## 1. Core Principle

A system is "retraction-native" if all mutations are modeled as the application of a signed delta, rather than as destructive updates. This means:

- **Addition:** Adding a new element is represented by a positive delta.
- **Removal (Retraction):** Removing an element is represented by a negative delta of the same magnitude.

This approach ensures that no information is destructively lost. Compaction and aggregation are permitted — they collapse a run of deltas into an equivalent net delta — as long as the resulting semantics are preserved. A history of deltas (a "trace") can be replayed to reconstruct the state of the system at any point in time, modulo such compaction.

## 2. Foundation in Z-Set Algebra

Retraction-native semantics are built upon the foundation of the Z-Set algebra, as specified in `openspec/specs/z-set-algebra/spec.md`.

A Z-Set is a map from keys to integer weights. The `add` and `neg` operations on Z-Sets provide the mathematical basis for retraction:

- To add an element `e` to a collection, we add the Z-Set `{e -> +1}`.
- To retract the element `e`, we add the Z-Set `{e -> -1}`.

The sum of these two operations is the empty Z-Set, which represents a clean retraction.

## 3. Guarantees

A retraction-native system provides the following guarantees:

- **History Preservation:** Because no data is ever destructively deleted, the full history of all operations is preserved in the event trace.
- **Counterfactual Queries:** It is possible to efficiently query the state of the system as if a certain operation (or set of operations) had never happened. This is achieved by applying the negative of the corresponding deltas.
- **Auditability:** Every state change is attributable to a specific delta in the trace, providing a clear and complete audit trail.
- **Invertibility (Cancellation) of Retraction:** Applying a retraction delta `-d` after applying an addition delta `+d` is guaranteed to return the system to its original state (modulo compaction). This is cancellation/invertibility — `+d` then `-d` nets to zero — not idempotency (`f(f(x)) = f(x)`).

## 4. Example: Retraction-Native Graph

The `Graph<'N>` data structure is a key example of retraction-native design.

- **Representation:** A graph is represented as a `ZSet<'N * 'N>`, where each entry is an edge `(source, target)` with a weight.
- **Adding an edge:** `Graph.addEdge` adds a positive-weight entry to the ZSet.
- **Retracting an edge:** `Graph.removeEdge` adds a negative-weight entry for the same edge.

This allows for the non-destructive removal of edges and the ability to reason about the graph's history. This is specified in the ADR at `docs/DECISIONS/2026-04-24-graph-substrate-zset-backed-retraction-native.md`.
