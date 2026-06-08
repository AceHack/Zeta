# No DDL — just DML (insert/update/delete) on metadata tables

**Aaron, 2026-06-07 (#7039):**

> "we don't need DDL if we do it right — just DML insert/update/deletes to metadata tables."

A direct consequence of **metadata being homoiconic to data** (#7038): if the schema/catalog lives in
**metadata tables** (which are just tables, #7028), then **schema changes are ordinary DML on those
tables** — there is no separate Data Definition Language.

## The collapse

| Traditional DDL | Becomes (DML on a metadata table) |
|---|---|
| `CREATE TABLE users (...)` | `INSERT` a row into the `tables` (+`columns`) metadata table |
| `ALTER TABLE users ADD ...` | `UPDATE` / `INSERT` rows in the `columns` metadata table |
| `DROP TABLE users` | `DELETE` (retract) the row(s) from the metadata table |
| `CREATE INDEX ...` | `INSERT` into the `indexes` metadata table |

So "defining a schema" = upserting catalog rows; "evolving a schema" = more upserts/retracts. One
operation set (DML), not two languages.

## Why this falls out of the substrate

- **Metadata tables are tables (#7028); metadata is data (#7038).** A table-definition row is just data
  in the catalog table — so editing it is DML.
- **DML = data events on the one stream (#7032/#7036).** An `INSERT`/`UPDATE`/`DELETE` is an `Upsert`/
  `Retract` delta (#7029); a catalog edit is a `Meta` edge on the same stream. **Schema migration is
  therefore just deltas on the stream** — it reuses *everything* data gets: DST replay, CRDT merge,
  idempotency (#6), golden vectors, the 4 serializers, git versioning, time-travel. `SchemaEvolution`
  Up/Down + `SchemaRegistry` (already in-repo) become *catalog DML*, not a bespoke DDL engine.
- **No DDL/DML schism = no metadata/data schism (#7038).** The reason most DBs need DDL is that their
  catalog is privileged/separate. Homoiconic metadata removes the privilege: the catalog is an ordinary
  table, so ordinary DML suffices.

## DDL = `ensure`; schema evolution = a DU over the DML meta-updates (#7040)

Aaron's refinement: *"DDL becomes just `ensure` and automatic schema evolution — a DU over the DML meta
updates."* So you don't even write the catalog DML by hand:

- **DDL collapses to `ensure`** — the idempotent declarative verb (Ace #6964): you `ensure` the *desired*
  catalog state (the target schema), not the steps to get there. `ensure(desired schema)` is idempotent
  (apply-N == apply-once, #6) — running it when already-satisfied is a no-op.
- **Automatic schema evolution = a DU over the DML meta-updates.** `ensure` **diffs** desired vs current
  catalog and **emits the meta-DML delta DU automatically** — a discriminated union of
  `Upsert`/`Retract` (add column, drop column, change type, add index…) over the metadata tables. The
  *evolution* is that computed DU; you declare the target, the system derives the imperative meta-DML.
- This is exactly **declarative lowers to a DU over imperative** (#6998) applied to schema: `ensure`
  (declarative) → diff → DU of DML meta-updates (imperative deltas on the catalog stream). `SchemaEvolution`
  Up/Down (#6996) *is* the down/up direction of that DU; `SchemaRegistry` holds the catalog state diffed
  against.

So the full picture: **`ensure` (declare target) → auto-diff → DU of DML deltas on metadata tables →
events on the one stream.** No DDL, no hand-written migration — a declarative `ensure` whose evolution is
a derived DU.

## Consequences

- **Migrations are data deltas** — reviewable as a diff, mergeable as a CRDT, replayable under DST,
  reversible (retract). No special migration DSL; a migration is a stream of catalog upserts.
- **Online by construction** — since a schema change is just an event on the stream, it folds
  incrementally like any other (the 0-downtime `SchemaEvolution`/`DurableSaga` story #6996 is now "DML on
  the catalog," not a separate path).
- **Self-hosting stays clean** — the catalog describes the catalog (it's a metadata table about tables,
  including itself), edited by the same DML (#7027/#7028).

## Honest scope (peel)

Principle/consequence of #7038 — names what homoiconic metadata implies; **no new code**. It does *not*
claim a built catalog with `tables`/`columns`/`indexes` metadata tables wired to DML — that's the
realization (define the catalog metadata tables; route `SchemaEvolution`/`SchemaRegistry` through catalog
DML; carry `DynamicValue` per #7038's named gap). Recorded as the design rule: **build the catalog as
metadata tables and you get schema management for free via DML — do not add a DDL layer.**

## Anchors (Beacon)

- **Catalog-as-tables** — System R / SQL `information_schema`, Postgres `pg_catalog` (catalog *is*
  tables, though DDL still wraps it); the relational ideal of self-describing catalogs (Codd).
- **Schema-as-data / DDL-as-DML** — **Datomic** (schema is datoms, asserted by ordinary transactions —
  the cleanest prior art for "no DDL"); RDF/RDFS (schema is triples); Dgraph; Meta's schema-as-data.
- **Event-sourced schema** — migrations as events (CQRS/event sourcing); `SchemaEvolution`/`SchemaRegistry`.
- Internal: #7038 (metadata homoiconic to data), #7028 (table-meta-is-a-table), #7032 (meta-in-band),
  #7029 (DML = Upsert/Retract deltas), #6996 (SchemaEvolution/SchemaRegistry, 0-downtime), manifesto §8
  DV2.0 / §7 DST, idempotency #6.
