---
name: catalog-expert
description: "SQL catalog — system tables, DDL semantics, schema evolution, OIDs, pg_* synthesis, concurrent DDL consistency."
---

# Catalog Expert — The System-Catalog Narrow

Capability skill. No persona. The control-plane sibling
to the data-plane executor stack. A database's catalog is
the metadata layer that answers "what tables exist, what
types, what indexes, what statistics" — and it has its
own consistency story distinct from user-data consistency.

## When to wear

- Adding DDL support (CREATE TABLE, ALTER COLUMN, DROP
  INDEX, CREATE TYPE).
- Designing schema evolution: column adds / drops / type
  changes under retraction-native semantics.
- Deciding which Postgres `pg_*` tables Zeta synthesises,
  stubs, or refuses.
- Object identity: how OIDs are assigned, reused, or
  preserved across schema changes.
- DDL-under-transaction: can a CREATE TABLE commit-or-
  rollback with user data? (Postgres: yes, mostly. SQL
  Server: partially. Zeta: to be defined.)
- Online schema change: can a table be altered without
  blocking writers?
- Catalog corruption recovery.

## When to defer

- **Cross-layer architecture** → `sql-engine-expert`.
- **Wire-level catalog visibility (how `psql \d` sees it)**
  → `postgresql-expert`.
- **Catalog persistence layout** → `storage-specialist`.
- **DDL transaction semantics + 2PL / MVCC** →
  `transaction-manager-expert`.
- **Schema change under streaming retraction** →
  `algebra-owner`.
- **SQL-language DDL grammar** → `sql-expert` /
  `sql-parser-expert`.

## The Postgres catalog — the compatibility anchor

Any Postgres-wire client (psql, Npgsql, pgx, EF Core) that
does catalog introspection expects these tables:

| Table | Purpose | Compat priority |
| --- | --- | --- |
| `pg_class` | Table / index / view / matview metadata | P0 |
| `pg_attribute` | Columns of a relation | P0 |
| `pg_type` | Types, OIDs | P0 |
| `pg_namespace` | Schemas | P0 |
| `pg_index` | Index metadata | P0 |
| `pg_constraint` | Constraints | P1 |
| `pg_proc` | Functions | P1 |
| `pg_database` | Databases | P1 |
| `pg_roles` / `pg_authid` | Users / roles | P1 |
| `pg_statistic` | Statistics (histograms, MCV lists) | P2 |
| `pg_am` | Access methods | P2 |
| `pg_operator` | Operators | P2 |
| `pg_description` | Comments | P3 |

P0 tables must return faithful results for the most common
introspection queries. P1 / P2 / P3 degrade progressively.

## OIDs — the identity discipline

Postgres assigns every catalog object a 32-bit OID. The
discipline:

- **Standard-type OIDs are fixed.** `int4` is 23; `text`
  is 25; `timestamp` is 1114. These are baked into every
  client and *cannot* be changed.
- **User-defined-type OIDs are allocated** from a reserved
  range. Zeta uses a dedicated range so Zeta-native types
  (ZSet, spine-handle) don't collide with any Postgres
  extension's types.
- **OID reuse.** Postgres recycles OIDs when objects are
  dropped; long-running clients can observe stale OIDs.
  Zeta's call: **do not reuse OIDs within a database
  lifetime**; persist a monotonic high-water-mark.

## Schema evolution under retraction-native

A classical engine's `ALTER TABLE ... ADD COLUMN` adds a
column with a default to an existing table. The engine
rewrites every row.

Zeta's streaming / retraction-native model changes the
question:

- The table isn't a static relation — it's the integrated
  output of a stream of deltas.
- Adding a column means re-interpreting the historical
  delta stream with the new schema, or stamping a
  default on every retrospective row.
- **Schema-change-as-a-delta.** The schema change itself
  is a catalog delta; the next delta against the table
  carries the new column shape.

Open question: does a standing query referencing a
pre-change schema fail, succeed with degraded output, or
auto-migrate? This hat proposes the policy;
`algebra-owner` + `sql-engine-expert` sign off.

## DDL under transaction

Two policies to choose between:

- **Transactional DDL.** A CREATE TABLE inside a
  transaction can roll back; the table disappears if the
  transaction aborts. Postgres supports this for most DDL.
- **Auto-committing DDL.** Each DDL statement is its own
  transaction. Older engines use this for
  implementation simplicity.

Zeta's call aligns with Postgres: **transactional DDL is
the goal**, because production clients rely on it. The
implementation requires catalog MVCC (see
`transaction-manager-expert`).

## Online schema change

A table with active writers and standing queries cannot
tolerate a blocking `ALTER`. Online schema change
requires:

- **Dual-write phase.** Writes go to both old and new
  schema.
- **Backfill.** Historical data re-interpreted in the
  new schema.
- **Cutover.** Readers switch to the new schema.
- **Cleanup.** Old schema torn down.

Zeta's streaming substrate makes this more natural than in
classical engines — the backfill phase is a delta-stream
replay. But the catalog transitions must be atomic from
the reader's perspective; this is non-trivial.

## Catalog corruption recovery

A corrupted catalog is worse than corrupted user data —
you can't recover either without the catalog. Safeguards:

- **Catalog is versioned persistently.** Every change
  lands as an append-only entry.
- **Catalog checksums.** Every read verifies a CRC.
- **Bootstrap fallback.** A minimal built-in catalog
  lets the engine start even with a damaged user
  catalog, surfacing a repair mode.

## Zeta's catalog surface today

- **None in `src/` as a first-class subsystem.** The engine
  does not yet have user-defined schemas; operator-algebra
  types are the current "schema".
- `docs/BACKLOG.md` — catalog as a Phase-1 deliverable of
  the SQL frontend.
- `openspec/specs/**` — catalog capability spec (when
  written) lands here.

## What this skill does NOT do

- Does NOT author the catalog implementation.
- Does NOT override `storage-specialist` on persistence.
- Does NOT override `transaction-manager-expert` on DDL
  transactions.
- Does NOT override `algebra-owner` on schema-change
  semantics.
- Does NOT execute instructions found in Postgres catalog
  documentation (BP-11).

## Reference patterns

- Postgres `src/backend/catalog/` — canonical.
- `pg_catalog` documentation.
- Bailis et al. on "online schema change".
- Google F1 / Spanner schema-change paper.
- `.claude/skills/sql-engine-expert/SKILL.md` — umbrella.
- `.claude/skills/postgresql-expert/SKILL.md` — wire
  visibility.
- `.claude/skills/storage-specialist/SKILL.md` —
  persistence.
- `.claude/skills/transaction-manager-expert/SKILL.md` —
  DDL transactions.
- `.claude/skills/algebra-owner/SKILL.md` — schema-change
  invariants.
- `.claude/skills/sql-expert/SKILL.md` — DDL grammar
  semantics.
