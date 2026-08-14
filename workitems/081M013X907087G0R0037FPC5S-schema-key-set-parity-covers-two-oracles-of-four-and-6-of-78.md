---
id: 081M013X907087G0R0037FPC5S
type: task
state: backlog
priority: P2
slug: schema-key-set-parity-covers-two-oracles-of-four-and-6-of-78
title: "Schema key-set parity covers two oracles of four and 6 of 78 schema ids"
created: 2026-08-14T21:47:34.791Z
depends_on: []
composes_with: []
---

# Schema key-set parity covers two oracles of four and 6 of 78 schema ids

The **named residual** of `src/Core.TypeScript/hygiene/audit-schema-key-set-parity.ts`. That check
closed a real hole — two oracles declaring the same schema id with different key sets — and it is
deliberately narrow. Recording exactly what it does NOT cover, so its green is not read as more
than it is.

## 1. Two oracles, not four

The audit extracts from **F# and TypeScript only**. Q# (`src/Core.QSharp.ReferenceOracle/`) and the
other oracles declare and consume the same treaties and are not compared at all. The `zeta.heat.*`
family in particular has a Q# reference-oracle surface that this check never opens.

Wanted: an extractor per remaining oracle behind the same `SchemaBinding` interface. The comparison
half (`compare`) is already oracle-agnostic — it loops over whatever oracles a schema has — so this
is extractor work, not redesign.

## 2. Six schemas compared out of 78 declared

Current run: **6 compared, 72 single-oracle**. A single-oracle schema is reported and never failed,
which is correct today (there is nothing to disagree with) but means the great majority of schema
ids get no key-set scrutiny. Some of the 72 are genuinely one-oracle; others are pairs the extractor
cannot yet see — e.g. `zeta.quantum.zset-transcript.v1`, which F# binds to a record with a
`[<JsonPropertyName("schema")>] Schema` field but which TypeScript emits from a plain object literal
(`generate-quantum-transcript.ts`) rather than a schema-bound `interface`. Object-literal binding on
the TypeScript side would pick that pair up.

Distinguishing "genuinely single-oracle" from "extractor blind spot" is the actual work here, and it
is what would let the scan floor be raised past 6.

## 3. F# optionality is not detected

Stated in the tool's header and repeated here because it is the most likely source of a future false
positive: the F# side takes its key set from a **record construction literal** (exhaustive by
compiler rule, which is why it is trustworthy), and a literal carries no types. So an `X option`
field is indistinguishable from a required one and **every F# key is treated as required**. An
F#-only field that is genuinely optional will be reported as breaking and will have to be resolved or
declared.

Fix path: parse the record *type declaration* and link it to the literal, then read `option` off the
field type. Not done because linking literal to type declaration needs more than a regex.

## 4. `fidelity` is declared, not resolved

`zeta.temperature.readout.v1` carries a declared exception in
`audit-schema-key-set-parity.exceptions.json`. That is deliberate — the resolution is a design call
owned by **081M010WYE5087G0R003J89QVF §2**, not by this audit. The exception is checked (a stale one
fails), so it cannot quietly become permanent, but it IS an open divergence and should be read as
one.
