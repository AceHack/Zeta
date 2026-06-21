# ADR: Zeta's database design — an event-sourced G-Set/Bag/Z-set log, folded by Rx-observables into incremental materialized views; one logical design, two physical backends

**Date:** 2026-05-31
**Status:** Proposed — names + ratifies the unified design that several already-built pieces
share (the F# Z-set algebra, the multi-language observe algebra, the git-native bus). Routed
through the product-team agreement before it becomes binding doctrine.
**Owner:** operator (Aaron, shaping) + Otto (synthesis).
**Decision confidence:** medium-high — the core pieces exist in code; this ADR is mostly
*recognition + naming* of one design across them, plus the explicit two-backends equivalence.

## Context & problem

Over 2026-05-31 the same shape kept recurring across unrelated-looking features: the
agent-bus (081KSXN940008QG0R00171YAZW) is a **G-Set**; Ace deps + work-items (081KSGS9H0008QG0R0031PBNGA / 081KSXN940008QG0R002FWR9B2) are **Z-sets**;
DORA/metrics/observability (#6289 git-native LGTM) are **Bag-folds**; the `observe`
event-algebra (081KSXN940008QG0R0033T2BQT) is the **Rx-style fold**; and the F# core already ships a **Z-set
algebra** (`src/Core/ZSet.fs`, `IndexedZSet.fs`, `Algebra.fs`). These are not separate
systems — they are **one database design** seen from different angles. Without naming it,
each new feature re-derives a slice of it and the cross-backend equivalence stays implicit.

This ADR states the design once.

## The design

**One sentence:** the database is an *append-only event log* whose entries live in the
**G-Set / Bag / Z-set** algebra, and every query/report/index is a **materialized view**
produced by **folding** that log with **Rx-style observables that update incrementally**
(DBSP / differential-dataflow IVM) — add and retract propagate as deltas, never full
recompute.

### 1. The log is the source of truth (event-sourced)

Append-only, ZetaId-keyed events. Nothing is updated-in-place; state is *derived*. (Same
principle as the event-sourced-observability ADR, 2026-05-29.)

### 2. Entries live in the algebra ladder

| Container | Element count | Merge | Use |
|---|---|---|---|
| **G-Set** | {0,1} | union (idempotent) | grow-only / comms / append-only facts (the bus) |
| **Bag** | ℕ | sum | counts / metrics / DORA (the LGTM "M") |
| **Z-set** | ℤ (retraction) | sum | sets with add+remove → resolved views (Ace deps, work-items, the open backlog) |

(G-Set = Z-set restricted to non-negative multiplicity; Bag sits between. See the bus↔Ace
synthesis doc.)

### 3. Views = Rx-observable folds, incrementally maintained

A query is a **standing fold** over the log → a **materialized view**. Built on Rx-style
observables (`src/Core/*` + `Core.{CSharp,Rust}.Observe` `observe`/`fold` algebra; the
durable-reactive lineage in 081KQZVQW0008QG0R000PPQ3MH Reaqtor/Temporal/Bonsai, 081KQZVQW0008QG0R001FG05RZ Rx-join). The fold is
**incremental (DBSP IVM)**: an inserted/retracted event propagates as a **delta** through
the view graph; reads are O(view), writes are O(change), no full recompute. Retraction is
first-class (Z-set −1), so "remove a dep / close a work-item / correct a metric" is a delta,
not a rebuild.

### 4. One logical design, two physical backends

The logical model above is **identical** across two storage substrates; only the on-disk
encoding + transport differ:

| | **git-native backend** | **F# filesystem backend** |
|---|---|---|
| Encoding | ZetaId-keyed JSON files | **binary-efficient** on-disk format |
| Transport / merge | git (replication log; CRDT/G-Set merge; no-PR folders-on-main) | local filesystem / the F# engine |
| Algebra home | the `observe`/fold tools (TS) | `src/Core/ZSet.fs` · `IndexedZSet.fs` · `Algebra.fs` |
| Strengths | conflict-free **multi-agent** (no ID consensus — ZetaId PKs), human-auditable, zero-infra, cross-machine/Windows-safe | **throughput + compactness**, hot-path, deterministic-simulation replay |
| Used for | bus (081KSXN940008QG0R00171YAZW), work-items (081KSXN940008QG0R002FWR9B2), Ace (081KSGS9H0008QG0R0031PBNGA), observability/LGTM (#6289) | the engine's high-volume state; binary-efficient storage over the same Z-set algebra |
| **Same** | **event log + G-Set/Bag/Z-set algebra + Rx-fold→incremental materialized view** | **(identical)** |

A fold/query/view written against the algebra **ports between backends** — write the view
once, run it over git-native JSON *or* F# binary storage. git-native is the
multi-agent/audit/zero-infra surface; the F# binary backend is the perf/compactness surface;
both are the same database.

## Why this design

- **Multi-agent without consensus:** ZetaId-keyed append-only log = conflict-free across
  shards (agents). Incrementing IDs are a hidden consensus point; ZetaId PKs remove it
  (081KSXN940008QG0R002FWR9B2). git is the replication log for free.
- **Queries are cheap + always-fresh:** materialized views are maintained incrementally
  (DBSP), not recomputed; retraction-native, so corrections are deltas.
- **One mental model, many features:** bus / Ace / work-items / observability / DORA are
  all *folds over one log* — learn the algebra once.
- **Right tool per surface, same logic:** git-native for collaboration/audit/zero-infra; F#
  binary for throughput — without forking the design.

## Consequences

- **Positive:** unified storage/query model; portable views; conflict-free multi-agent;
  incremental + retraction-native; zero-infra collaboration surface + a fast binary surface;
  observability is just another fold (no separate metrics store).
- **Costs / open questions (route through ratification):** keeping the two backends' algebra
  semantics provably equivalent (a differential/property-test obligation — cf. the golden-
  vectors BFT oracle, 081KSV2WD0008QG0R00051XS0N/081KSXN940008QG0R0033T2BQT); the binary-efficient on-disk format spec for the F#
  backend; when a view should be git-native (auditable/shared) vs F#-binary (hot/large);
  view-definition language shared across TS + F#.

## Composes with

- `src/Core/ZSet.fs` · `IndexedZSet.fs` · `Algebra.fs` — the built F# Z-set algebra (the F# backend's algebra home)
- `Core.CSharp.Observe/Algebra.cs` · `Core.Rust.Observe/src/algebra.rs` + 081KSXN940008QG0R0033T2BQT — the multi-language `observe`/`fold` algebra (cross-language parity)
- the event-sourced-observability ADR (2026-05-29) + its git-native LGTM addendum (#6289) — observability is the Bag-fold view of this design
- the bus↔Ace synthesis (`docs/research/2026-05-31-bus-and-ace-…`) — the G-Set/Bag/Z-set ladder
- 081KSXN940008QG0R00171YAZW (agent-bus, G-Set) · 081KSXN940008QG0R002FWR9B2 (work-items, Z-set + ZetaId PKs) · 081KSGS9H0008QG0R0031PBNGA (Ace, dependency Z-set)
- 081KQZVQW0008QG0R000PPQ3MH (durable-computation: Reaqtor/Temporal/Orleans/Bonsai) · 081KQZVQW0008QG0R001FG05RZ (Rx-join) — the durable-reactive fold lineage
- 081KSE6WT0008QG0R0008483B2 (cluster-as-git-native-event-store) · 081KSNY2Z0008QG0R000E5KTPX (folders-on-main, no-PR) — the git-native substrate + transport
- the `algebra-owner` skill (Z-set + Clifford + BP/EP) — the algebra steward
- the 5 always-active disciplines (DST / lock-free / weight-free / scale-free / DV2.0) — the design satisfies them (deterministic replay over the log; conflict-free merge; change-rate partitioning)
