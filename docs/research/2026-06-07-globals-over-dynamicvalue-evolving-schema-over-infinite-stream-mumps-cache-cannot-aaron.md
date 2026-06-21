# Globals over DynamicValue: a free evolving schema over an infinite stream — what MUMPS/Caché can't do (Aaron, 2026-06-07)

Records the `Globals` rebase onto `DynamicValue` (per the soft-tensor collapse) and the differentiator
Aaron named. Faithful capture; Beacon-anchored.

## The rebase (landed with this doc)

`Globals` no longer carries a parallel `Map<Path,'V>` store (the Rodney's-Razor finding). The MUMPS verbs
now navigate **`DynamicValue` directly**: `set`/`get`/`kill`/`data`/`nextChild`($ORDER)/`nextNode`($QUERY)/
`children`/`count`, ordinal subscript collation (081KT07NV0008QG0R001YDB73K), leaf-xor-object semantics (DynamicValue's nature;
`$DATA` ∈ {0,1,10}, not 11 — see the module note). One ragged tree in the system, not two. Leaf-agnostic, so
`DynamicValue`-over-`SoftValue` leaves = the soft (probabilistic) sparse tensor for free, and a model
`state_dict` (dotted-path → tensor) is navigable as a global — the human-readable model API.

## The differentiator (Aaron)

> *"We also get a free evolving schema over [an] infinite stream — MUMPS can't do that, neither can Caché."*

Because a global is now `DynamicValue` **on the Zeta substrate**, it inherits two things classical globals
never had:

1. **An evolving schema with *proven* migrations.** MUMPS globals are schemaless (no schema to evolve, no
   migration guarantees); Caché classes have a schema but evolving it is a manual DDL/recompile, not a
   lossless/invertible algebra. Our globals ride **`SchemaEvolution` / `SchemaRegistry`** — the
   migration algebra with up/down directions, dump-position-exact reshaping, and round-trip laws
   (`081KTH0HFZ8`). So the subscript shape *and* leaf types can change (add/rename/remove a subscript level,
   widen a leaf, split a node) with **verified** forward/backward migration — the schema evolves under the
   data instead of freezing it.
2. **Over an *infinite/unbounded stream*, incrementally.** MUMPS/Caché operate on a stored array, not a
   stream. Our globals are `DynamicValue` deltas in a **Z-set** flowing through **DBSP incremental views**:
   the global is the *materialized fold* of an unbounded event stream, updated incrementally (retraction-
   native, `+1`/`−1`), DST-replayable. So "the schema evolves" and "the data is an infinite stream" compose:
   a migration is itself a streaming operator applied to the ongoing fold — **schema evolution over an
   infinite stream**, which neither MUMPS nor Caché can express.

| | MUMPS global | Caché | **Global over DynamicValue (ours)** |
|---|---|---|---|
| schema | none (schemaless) | fixed class, manual DDL | **evolving, proven migrations (up/down, lossless laws)** |
| data model | stored array | stored multi-model | **Z-set delta fold of an unbounded stream (DBSP)** |
| change over time | overwrite in place | overwrite + DDL | **retraction-native, incremental, DST-replayable** |
| schema-change-while-streaming | n/a | n/a | **yes — migration is a streaming operator** |

## Why it's "free"

Nothing new was built for this property — it falls out of the substrate the global now sits on:
`DynamicValue` (the ragged tree) + `SchemaEvolution` (the migration algebra) + Z-set/DBSP (the incremental
infinite-stream fold) already exist and already carry their proofs. Rebasing `Globals` onto `DynamicValue`
(rather than a private `Map`) is precisely what *connects* the MUMPS-verb navigation to all three. The
parallel store would have been an island; the rebase makes the global a first-class citizen of the evolving,
streaming, content-addressed substrate.

## Beacon anchors

- **MUMPS** (Octo Barnett et al., 1966) / **InterSystems Caché-IRIS** — the global model being surpassed
  (schemaless / fixed-class, non-streaming). · **DBSP** (Budiu et al., VLDB 2023) — incremental view
  maintenance over unbounded streams (the "infinite stream" engine). · **Schema evolution / migration**
  — Curino et al. (schema evolution); our `SchemaEvolution` algebra (`081KTH0HFZ8`). · **CALM / monotonicity**
  (Hellerstein) — why retraction-native streaming folds stay coordination-free. · **Event sourcing** — the
  global as a materialized fold of an event log. Honest novelty: not the global (MUMPS), not incremental view
  maintenance (DBSP), not schema migration (Curino) — the contribution is their **composition**: a
  MUMPS-navigable global whose schema evolves with proven migrations *while* it is the incremental fold of an
  infinite Z-set stream.
