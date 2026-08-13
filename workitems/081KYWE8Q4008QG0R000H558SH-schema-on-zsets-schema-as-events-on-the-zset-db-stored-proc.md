---
id: 081KYWE8Q4008QG0R000H558SH
type: task
state: backlog
priority: P2
slug: schema-on-zsets-schema-as-events-on-the-zset-db-stored-proc
title: "Schema-on-ZSets — schema as events on the ZSet (DB stored-proc architecture)"
created: 2026-07-31T15:56:41.472Z
depends_on: []
composes_with: []
---

# Schema-on-ZSets — schema as events on the ZSet (DB stored-proc architecture)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYWE8Q4008QG0R000H558SH-*.md` glob. -->

## Context

Aaron 2026-07-31: schema-on-ZSets is *"our entire db stored-proc architecture long term."* Schema modeled as EVENTS on the ZSet (grant/revoke = +1/−1 retraction fold), never a static desired-state map.
Sources: [`docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md`](../docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md), [`docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md`](../docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md).

## STATUS — increment 1 LANDED (2026-08-01, PR #9823). Work-item stays OPEN

Shipped: the EVENT LOG layer above the pre-existing delta plane — `SchemaOp` (+`delta`/`invert`),
`SchemaEvent` (idempotency key; `compensate` appends a retraction, never erases), `SchemaLog`
(`dedupe`/`foldRaw`/`current`/`at n`/`fields`/`conflicts`/`idCollisions`). Laws gated (SchemaZTests
18→34): invert-is-additive-inverse; **order-independence** (any shuffle folds equal; two writers merge
either way — the DST/merge property, and the property that lets a trust plane converge with NO
coordinator); prefix-replay; **retraction-cancels** (revoked ⇒ weight 0, row GONE not tombstoned);
idempotency stated BOTH ways (redelivery idempotent; duplicate INTENT deliberately is not — surfaced as
a named conflict). Full suite 4416 passed.

STILL OPEN (do not close on the strength of increment 1): log persistence/serialisation; cross-oracle
C#/TS/Rust parity + golden vectors; wiring `SchemaLog` into the DB stored-proc surface; the `ZSetW`
semiring unification the design doc §7 sequences BEFORE this; `dedupe` uses in-memory `List.distinct`,
not the eventual streamed form.

Downstream: this fold is also the primitive for the zetadb-native identity plane (work-item
081KYXQ3SZN08QG0R002X3DTQM) — grant +1 / revoke −1, no central authority.

## STATUS — increment 2 LANDED (2026-08-13): persistence + streamed dedupe + golden vectors. Work-item stays OPEN

Shipped: `src/Core/SchemaLogCodec.fs` — canonical v1 text persistence for the
event log (the log IS the schema, so this is the schema's durable form):
versioned sentinel (`zschemalog/1`, a decoder never guesses), injective
escaping (arbitrary ordinal names/ids carried, never a carved-out "safe"
subset), deterministic byte-for-byte encode, all-or-nothing decode with 1-based
line numbers on every offence. GOLDEN VECTORS locked as literals in
`SchemaLogCodec.Tests.fs` (exact-bytes both directions, adversarial
separators-in-names row included) — the strings other oracles (C#/TS/Rust)
replay for parity. Plus `SchemaLog.dedupeStream` (the "eventual streamed form"
named open in increment 1): lazy, O(distinct) memory, first-occurrence-wins;
`dedupe = List.ofSeq ∘ dedupeStream` pinned as a law; `currentFrom` now folds
the stream directly (log never materialised); laziness proven against an
infinite redelivery stream. 14 tests. Full F# suite 4881 green.
`ZPlan.validateAgainstLogs` (sibling increment, same day) wires the log into
the stored-proc surface: plan validation reads the schema FOLD.

STILL OPEN: cross-oracle parity casts (C#/TS/Rust decoders replaying the locked
vectors — the F# reference + vectors now exist); wiring into the zetadb
stored-proc surface proper (the plan gate is the first consumer); binary/
compressed transport layering if size ever warrants it.
