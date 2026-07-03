# `table` & `stream` nouns — the duality, meta-events in-band, and interface-vs-noun

**Aaron, 2026-06-07** (#7029–#7032), plus the design question "how to decide what's an interface vs a noun."

## `table` & `stream` — one or the other (#7029), built

`src/Core/TableStream.fs` (module `TableStream`, 5/5 tests green, 0-warning). The **stream is the
primitive** (the ordered changelog of deltas = the one DBSP Z-set stream #6997); a **table is its fold**
(materialized current state). "One or the other" = two views of the same data:

- `toTable stream` — fold the changelog → current state.
- `toStream table` — the `Upsert` deltas that reconstruct the table (ordinal-sorted).
- Duality: `toTable (toStream t) = t` (tested). Kafka KStream/KTable; DBSP; CQRS event-log vs read-model.

`db` (#6996), `file` (#7002), `key` (#6998) are all this one pattern — a table/tree/keyring folded from a
stream.

## Stream-metadata is a meta event in-band (#7031/#7032)

Aaron's sharpening: stream-metadata isn't a *separate* stream — it's **an event within the same stream as
the data**: there are `Meta` events interleaved over the one stream (in-band self-description).

- `Delta = Upsert | Retract | Meta(key, value)` — data events and `Meta` events on the SAME stream.
- `toTable` folds the data events → the table; `toMeta` folds the `Meta` events → the metadata. Two
  projections over ONE stream (tested). The self-hosting meta-recursion (#7027/#7028: file-meta is a file,
  table-meta is a table) **bottoms out here**: both are folds of a stream, and stream-meta is just more
  events on that stream — nothing more primitive, no separate meta-stream.
- **Prior art (Aaron #7033):** **CloudEvents** (envelope metadata carried with the event) and the
  **Debezium CDC** stream protocol (each change event carries schema + payload + source metadata) — both
  already in the repo (`CloudEvents.fs`, `DebeziumCdc.fs`). Meta-in-band is exactly their shape.

## Interface vs noun — the decision rule (#7030)

> "I'm not sure how to decide what's an interface vs a noun."

The grammar is `[seam] verb noun [dependson]`. The cut:

- **Interface (= seam = "noun-class")** — a **port**: it has its own **verb set** + **pluggable backends**
  (adapters). It *classifies a family* of things and defines the operations + where they persist. Examples:
  `db`, `file`, `key`, `table`, `stream`, `container`, `cell`, `research`, `sim`. (In code: a `SeamName` +
  `is<X>Command` + a `Backend` DU.)
- **Noun** — an addressable **instance** the interface's verbs act on: a **ZetaId / unique-in-scope name**,
  with **no verbs or backends of its own**. Examples: `users:42`, `/logs/app.log`, `branch:main`,
  `compiler.rust`.

**Decision test:**

1. Does it have a *verb set* and *pluggable backends* (ports & adapters)? → **interface/seam.**
2. Is it a *specific thing* those verbs operate on, named by ZetaId / unique-in-scope? → **noun.**
3. Write the command: in `zeta <X> <verb> <Y>`, `<X>` (the integration plane + its verbs/backends) is the
   **interface**; `<Y>` (the instance) is the **noun**.

So what we've loosely called "noun-classes" (db/file/key/table/stream) are precisely **interfaces (seams)**
— each *classifies* a family of nouns. The **noun is the instance**; the **interface is the noun-class**.
Corollary (hexagonal, #7019): a thing earns interface status by having a port (verbs) + adapters
(backends); if it has neither and is just an addressed instance, it's a noun. `table`/`stream` are dual
*views* of the one stream substrate — they can be one interface with two projections rather than two rival
seams.

## Layering: streams under tables under files (#7034)

Aaron: *"streams under tables and tables under files."* The composition stack:

```
stream  (deltas / the primitive event log)
  └─ table   = fold(stream)            — materialized rows
       └─ file = a table (+folders)    — the file/folder tree (#7002) is a table view with hierarchy
```

A **table is a fold of a stream**; a **file (tree) is a table** with path hierarchy + folders. So `file`
sits on `table` sits on `stream` — each a higher-level view of the one substrate. (Block storage —
captured separately — is what sits *under* stream for large/opaque content, out-of-band.)

## Honest scope (peel)

Built + tested: `TableStream` (Delta incl. `Meta`, `toTable`/`toStream` duality, `toMeta` in-band metadata,
seam predicates), 5/5 green, 0-warning. The interface-vs-noun rule is a **taxonomy clarification** (no
code) — it names what the existing `SeamName`/`Backend` pattern already encodes. NOT built: `table`/`stream`
verbs in the `ZetaCli` grammar; whether `table`+`stream` collapse to one seam with two views is left open.

## Anchors (Beacon)

- **Stream↔table duality:** Kafka Streams (KStream/KTable), DBSP (Budiu 2022), CQRS/event sourcing
  (Fowler/Young), Materialize/ksqlDB.
- **Meta-in-band:** CloudEvents spec; Debezium CDC change-event envelope (schema+payload+source); Kafka
  record headers. (`CloudEvents.fs`, `DebeziumCdc.fs`.)
- **Ports & adapters (hexagonal):** Cockburn — the interface-as-port / backend-as-adapter cut.
- Internal: #6996 (db one stream), #7002 (file), #6998 (key), #7027/#7028 (self-hosting meta-recursion),
  #7019 (pluggable/hexagonal), #6997/#7000 (everything-is-events on one stream).
