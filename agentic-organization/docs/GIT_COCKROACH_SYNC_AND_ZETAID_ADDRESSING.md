---
title: Git as Database and Event Store (Frontmatter + ZetaId CRDT)
canonical_name: Agentic Organization
status: v0
ideas: [1, 2, 3, 7, 8]
extends:
  - CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md
  - V0_SCHEMA_AND_COMMANDS.md
composes_with:
  - ./TECHNICAL_CA_PACKAGE_ARCHITECTURE.md
  - ./OBSERVE_COMPOSER_AND_RUN_STATE.md
  - ./DOC_FRONTMATTER_CONVENTION.md
code_anchors:
  - ../packages/frontmatter-db/src/schema.ts
  - ../packages/frontmatter-db/src/event.ts
  - ../packages/frontmatter-db/src/crdt-log.ts
  - ../packages/frontmatter-db/src/project.ts
  - ../packages/frontmatter-db/src/sql-to-schema.ts
  - ../packages/frontmatter-db/src/schema-to-sql.ts
  - ../packages/frontmatter-db/src/frontmatter-codec.ts
  - ../packages/frontmatter-db/src/event-codec.ts
  - ../packages/frontmatter-db/src/sync.ts
  - ../packages/frontmatter-db/src/git-fs-adapter.ts
  - ../packages/frontmatter-db/src/cockroach-row-sink.ts
  - ../packages/frontmatter-db/src/reconcile-worker.ts
  - ../packages/frontmatter-db/src/traverse.ts
  - ../packages/frontmatter-db/src/validate.ts
  - ../../src/Core.TypeScript/zeta-id/zeta-id.ts
supersedes: []
---

# Git as Database and Event Store (Frontmatter + ZetaId CRDT)

The persistence and addressing layer. Operator vision (2026-05-29): **git is the
database and the event store**. A markdown file is a row; its YAML frontmatter is
the typed schema/columns; foreign-key columns are graph edges; events are
unique-id files that merge conflict-free as a CRDT; and the schema converts
to/from SQL. CockroachDB demotes to a rebuildable query index. Covers operator
ideas 1 (git<->cockroach converter), 2 (explicit DUs), 3 (frontmatter graph), 7
(no-collision ids), 8 (ZetaId decimal index).

> **Why this is git's native shape.** Linus Torvalds built git as a
> content-addressable object database (a "stupid content tracker"): `git
> hash-object` writes a blob keyed by its SHA, `git cat-file` reads it back;
> trees and commits are just objects on top. Git-as-db is not a hack — it is
> git used for what it fundamentally is. The one thing we add is a *stable,
> semantic, time-ordered* key (ZetaId) because a content SHA changes whenever
> content changes and therefore cannot be a primary key or a foreign-key target.

## The stack

```text
git object DB (durability + conflict-free merge)
  └─ events/<table>/<ZetaIdDecimal>.md      append-only event files  ── G-Set CRDT
        │  (frontmatter = op + aggregateId + field values + schema_version)
        ▼  fold in (timestamp, id) order  ── retraction-native (Z-set)
     <table>/<ZetaIdDecimal>.md             materialized rows (current state)
        │  (frontmatter = typed columns; fk columns = graph edges; body = doc)
        ▼  derive
     CockroachDB                            rebuildable query / index projection
```

One **frontmatter schema** (derived from SQL) governs all four layers.

## Layer 1 — the schema is frontmatter, derived from SQL (ideas 2, 3)

`packages/frontmatter-db/src/schema.ts` defines the column model as an explicit
discriminated union (`ColumnType`: zeta_id, text, int, bool, timestamp, enum, fk,
fk_array). Payload-bearing kinds carry their payload as an explicit variant —
`enum` carries `values`, `fk`/`fk_array` carry `references` — never buried in
optional fields (repo rule: IMPLICIT-NOT-EXPLICIT is class error).

`sql-to-schema.ts` converts a `CREATE TABLE` into that schema:

| SQL | frontmatter column |
|-----|--------------------|
| `id TEXT PRIMARY KEY` | `{ type: zeta_id, pk: true, required: true }` |
| `status TEXT NOT NULL CHECK (status IN ('a','b'))` | `{ type: enum, required: true, values: [a, b] }` |
| `project_id TEXT REFERENCES project(id)` | `{ type: fk, references: project }` |
| `reviewer_ids TEXT[] REFERENCES hat_assignment(id)` | `{ type: fk_array, references: hat_assignment }` |
| `estimate INTEGER` / `created_at TIMESTAMPTZ NOT NULL` | `{ type: int }` / `{ type: timestamp, required: true }` |

The reverse (schema → `CREATE TABLE`) feeds the Cockroach projection, so the
schema is the single source both sides derive from — the existing
`state-cockroach/migrations` become derivable rather than hand-authored.

## Layer 2 — events are a ZetaId-keyed G-Set CRDT (ideas 7, 1)

`event.ts` + `crdt-log.ts`. Each event is one file named by its ZetaId decimal.
Because ZetaIds are globally unique (32-bit crypto-random field), two agents
writing concurrently produce **different filenames** — a git merge is a pure
union, never a content conflict. The log is therefore a **grow-only set keyed by
unique id**; `mergeLogs` is union, which is:

- **commutative** — `merge(a,b)` and `merge(b,a)` have the same ids
- **associative** — grouping does not matter
- **idempotent** — re-merging the same log changes nothing

(All three proven in `test/crdt-log.test.ts`.) These are the CRDT join laws, so
branches converge in any merge order. Collision policy is "minted once with
crypto randomness, addressed by decimal everywhere" — one id scheme, no
reconciliation.

## Layer 3 — state is a timestamp-ordered fold (ideas 8, 2)

`project.ts`. ZetaId embeds a 48-bit timestamp, so the event log is
self-ordering — `timestampMsFromZetaId` reads it straight out of the id. `project`
folds a table's events in `(timestamp, id)` order:

- `upsert` merges field values (last-writer-wins by timestamp)
- `retract` tombstones the aggregate (retraction-native, Z-set style; a later
  upsert revives it)

Because the order is derived from the ids (not from insertion or merge order),
`project(merge(a,b)) === project(merge(b,a))` — the convergence property, proven
in `test/project.test.ts`. The resulting `FrontmatterRow`s are the materialized
rows of Layer 1; they are fully rebuildable from the event log (DST-replayable).

## Layer 4 — frontmatter is graph-traversed (idea 3)

`traverse.ts`. `fk` and `fk_array` columns are edges; `edgesOf(row, schema)`
yields them and `neighbors(row, schema, column, store)` resolves them against a
row store keyed by `ZetaIdDecimal`. This is the same edge mechanism the doc graph
uses (`composes_with` in `DOC_FRONTMATTER_CONVENTION.md`) — docs and data rows
share one traversal model.

### Markdown index projection into context packs

Context packs do not read arbitrary markdown blobs directly. The frontmatter
index projects markdown into the document-intelligence and graph contracts that
`observe.ts` can replay:

1. A markdown row's frontmatter is validated against its schema and folded from
   the git event log.
2. Document rows become `DocUnit` records with `docType`, scope, lifecycle
   status, content pointer, content hash, hat/stage bindings, provenance change
   set, freshness, and version.
3. Foreign-key and `fk_array` fields become graph edges: document-to-work,
   document-to-decision, document-to-entity, document-to-hat, and
   document-to-superseded-document.
4. The Cockroach projection indexes those rows for low-latency scope queries.
5. `ContextPackDocumentReadPort` loads scoped active `DocUnit`s and bound
   consults, then returns them as `doc_unit` source pointers.
6. `ContextPackBuilderPort` turns those units into context-pack items and graph
   roots, while preserving the original git content ref and content hash.
7. A later source change creates a new event, changes the projected content hash
   or lifecycle state, and invalidates future wake decisions through freshness,
   consult outcomes, or explicit stale/superseded status.

The invariant is simple: if a director sees a document in a context pack, the UI
and future agents must be able to traverse back to the markdown row, git change,
source document, graph neighbors, and work outcomes that made it useful or
dangerous.

## Layer 5 — Cockroach is the index, and the converter is generic (idea 1)

CockroachDB is the low-latency query projection (`WHERE status='ready' ORDER BY
created_at` over thousands of `.md` files is not viable; the index is). The
generic converter (`sync.ts`) is keyed by the schema and driven entirely through
injected ports (`GitEventSource`, `IndexRowSink`, `IndexRowSource`,
`GitEventSink`, `IdGenerator`), so the pure core has no git/db dependency and is
fully testable with in-memory fakes:

- **git → cockroach** (`syncGitToIndex`): fold the event log to rows via
  `project`, upsert each into the index, and `deleteRow` any index id no longer
  in the projection (tombstoned aggregates drop out) — returns
  `{ applied: { upserted, deleted } }`
- **cockroach → git** (`syncIndexToGit`): emit one `Upsert` event per changed
  row (id from `IdGenerator`, aggregateId from the row's pk); a row missing its
  pk returns `row_missing_id` feedback rather than emitting a malformed event
- a committed command's event file rides the existing `messaging-nats` outbox;
  a periodic full reconcile (`ALWAYS_ON_ORCHESTRATION_RUNTIME.md`) is the
  recovery net

Conflicts cannot arise at the event layer (unique ids). At the *row* layer, two
upserts to the same aggregate are resolved deterministically by the timestamp
fold — there is no last-write-wins ambiguity to hand-resolve, because the id
*is* the clock.

## Status

Implemented and tested: `packages/frontmatter-db` — schema DUs, SQL→schema
(`sql-to-schema.ts`) and schema→SQL (`schema-to-sql.ts`, round-trip verified),
event/CRDT log, timestamp-ordered projection, validation, traversal, the on-disk
frontmatter YAML codec (`frontmatter-codec.ts`, lossless round-trip incl.
number-looking strings and arrays), and the port-based git↔cockroach sync core
(`sync.ts`). Full suite 318 green; real `tsc` clean for these files.

Also implemented and tested: the filesystem-backed Git adapter
(`git-fs-adapter.ts` + `event-codec.ts`, async load/flush over an in-memory
snapshot so the sync ports stay synchronous), the in-memory CockroachDB row sink
(`cockroach-row-sink.ts`, the rebuildable index, with a SQL-host `// TODO`), and
the periodic reconcile worker (`reconcile-worker.ts`, a `runOnce()` cycle
mirroring `worker-host.ts`). The reconcile cycle runs **index→git before
git→index** so a row written only to the index this cycle becomes an event before
the projection diff — otherwise git→index would tombstone-delete it as canonical.

Design/next: the real SQL-backed `CockroachRowSink` behind the port (the
`// TODO(cockroach-host)`), committing the adapter's written event files to git,
and wiring the reconcile worker onto the existing `messaging-nats` outbox +
scheduler. The ZetaId codec (ideas 7, 8) is the existing
cross-verified `src/Core.TypeScript/zeta-id`; `frontmatter-db` mirrors only its
timestamp-bit layout to stay self-contained.
