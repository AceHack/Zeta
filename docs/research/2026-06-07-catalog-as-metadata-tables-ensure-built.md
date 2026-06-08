# Catalog as metadata tables — `ensure` → DML-delta DU, built

**Otto, 2026-06-07** (chosen work, when Aaron asked "what do you want to work on"): make the no-DDL
principle real in code. This turns #7038/#7039/#7040 from captures into a tested artifact.

## What was built (`src/Core/Catalog.fs`, module `Catalog`, tests green, 0-warning)

The catalog lives in **metadata tables** (ordinary `TableStream` rows — metadata is homoiconic to data,
#7038), so there is **no DDL** — schema management is **DML on catalog rows (#7039)**, and you don't write
that DML by hand: it's derived from `ensure` (#7040).

- **Catalog rows** (homoiconic — the catalog IS a table): `table:<name>` → `"1"`,
  `column:<table>.<col>` → `<type>`.
- **`ensure schema current : Delta list`** — the automatic schema evolution **as a DU over the DML
  meta-updates**: diff the desired `Schema` against the current catalog table, return the ordered
  `Upsert`/`Retract` deltas to evolve current → desired. **Idempotent** (#6): an already-satisfied schema
  → `[]`. Deterministic (ordinal-sorted).
- **`evolve`** folds those deltas into the catalog; **`readSchema`** reads it back (round-trips).

So every DDL operation collapses to DML, derived from a declarative `ensure`:

| DDL | `ensure` derives |
|---|---|
| CREATE TABLE | `Upsert table:… ` + `Upsert column:….*` |
| ALTER ADD / CHANGE TYPE | `Upsert column:…` (new/changed row) |
| DROP COLUMN | `Retract column:…` |
| DROP TABLE | `Retract` table row + all its column rows |

Tested: create-collapses-to-upserts, idempotent re-ensure → `[]`, add/change/drop column, drop table,
`evolve`+`readSchema` round-trip, full create→alter→drop lifecycle.

## Why this one

It's the concrete embodiment of the last four captures (#7038 homoiconic metadata → #7039 no DDL → #7040
ensure→DU), self-contained on `TableStream`, and it makes "schema migration is just deltas on the one
stream" executable: an `ensure` produces a `Delta list` that is the same `Upsert`/`Retract` the data plane
uses — so it inherits DST replay, CRDT merge, idempotency, golden vectors, git versioning for free.

## Honest scope (peel)

A clean, tested **oracle**: string-typed catalog rows (matching the `TableStream` oracle; the
`DynamicValue` homoiconicity gap from #7038 still applies — full realization carries `DynamicValue`).
NOT wired into the `ZetaCli` grammar (no `zeta ensure <schema>` verb yet), and `ensure` derives the delta
*set* but does not yet enforce ordering constraints (e.g. column-before-its-table on apply — applied as a
set, which is fine for upserts; a real engine would also validate referential constraints). It proves the
principle executably; production wiring (grammar verb, DynamicValue values, constraint validation) is the
named next step.

## Anchors (Beacon)

- **Schema-as-data / DDL-as-DML** — Datomic (schema is datoms asserted by transactions); RDF/RDFS;
  `pg_catalog`/`information_schema`.
- **Declarative reconcile (`ensure`)** — Kubernetes/Terraform desired-state diff→plan; Ace `ensure`
  (#6964); declarative-lowers-to-DU-over-imperative (#6998).
- Internal: #7038/#7039/#7040 (the principle stack), #7029 (TableStream Upsert/Retract = DML deltas),
  #6996 (SchemaEvolution/SchemaRegistry), idempotency #6 / DST §7.
