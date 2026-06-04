---
name: postgresql-expert
description: PostgreSQL — wire protocol, type system, system catalogs, dialect extensions, EXPLAIN, pg_hba auth.
---

# PostgreSQL Expert — Dialect + Wire-Protocol Hat

Capability skill. No persona. Zeta's forward-looking SQL
frontend speaks the Postgres wire protocol — this hat owns
everything Postgres-specific about that surface, from the
byte layout of a `Parse` message to the semantics of `DISTINCT
ON` to the pricing of `pg_statistic` lookups.

## When to wear

- Designing or reviewing the Postgres-wire server loop
  (`StartupMessage`, `AuthenticationRequest`, the Frontend/
  Backend state machine).
- Deciding whether a dialect extension (LATERAL, DISTINCT ON,
  FILTER, array types, JSONB path operators, range types,
  full-text `tsquery` / `tsvector`) is in-scope for the
  current phase.
- Type-mapping decisions: Zeta's ZSet / operator-algebra
  types need Postgres-catalog OIDs to appear to clients.
- `EXPLAIN` / `EXPLAIN ANALYZE` output — the frontend must
  produce a plan-tree representation that psql / pgAdmin /
  EF Core understand.
- `pg_hba.conf`-style auth policy, SCRAM-SHA-256,
  certificate auth, SSL / TLS requirements (routes to
  `security-operations-engineer` for the policy; this hat
  owns the protocol shape).
- `COPY` streaming (both text and binary formats) — the
  high-throughput load path.
- System-catalog visibility: which `pg_*` tables we
  synthesise, which we stub, which we refuse.

## When to defer

- **SQL-the-language semantics, three-valued logic, ANSI
  portability** → `sql-expert`.
- **Plan-tree shape, SIMD dispatch, cost model on Zeta's
  side** → `query-planner` (Imani).
- **Cost-based optimisation, logical rewrites** →
  `query-optimizer-expert`.
- **EF Core client compatibility** →
  `entity-framework-expert`.
- **Auth policy (what counts as an acceptable credential,
  rotation cadence)** → `security-operations-engineer`.
- **Threat model of the wire surface** →
  `threat-model-critic`.
- **TLS cipher suite policy** → `security-researcher` +
  `security-operations-engineer`.
- **Bytes-on-wire performance** → `performance-engineer`.

## The wire protocol — the load-bearing sketch

Postgres speaks two protocols over a single TCP (or Unix
socket) connection:

1. **Startup phase** — `StartupMessage` → `Authentication*`
   exchange → `ParameterStatus` messages → `BackendKeyData`
   → `ReadyForQuery`.
2. **Query phase** — either:
   - **Simple query.** `Query` (one SQL text) →
     `RowDescription` → `DataRow`* → `CommandComplete` →
     `ReadyForQuery`.
   - **Extended query.** `Parse` (named or unnamed
     prepared statement) → `Bind` (parameter values) →
     `Describe` → `Execute` → `Sync` → `ReadyForQuery`.

The extended protocol is the EF Core / pgx / JDBC default;
the simple protocol is psql's one-liner path. Both must
work.

## The parameter-binding subtleties

The extended protocol carries parameter values in **text** or
**binary** format, chosen *per parameter* via the `Bind`
message's format codes. Binary format is OID-specific and
version-sensitive. The Postgres-wire server must:

- Advertise exact OIDs for every type it accepts.
- Accept text format for every OID it advertises (fallback).
- Accept binary format for the common types (int2 / int4 /
  int8 / float4 / float8 / numeric / text / bytea / timestamp
  / timestamptz / uuid / json / jsonb / array-of-above).
- Return binary format in `DataRow` when the client
  requested it in `Describe` / `Bind`.

Mismatches here silently truncate or reinterpret bytes and
are among the highest-severity bugs.

## Type-mapping — the OID discipline

Every type Zeta exposes over the wire has a stable OID. The
server maintains a **static OID table** for standard types
(matching Postgres's own `pg_type` OIDs for int2 / int4 /
int8 / text / etc.) and a **reserved range** for Zeta-native
types (ZSet / spine-handle / retraction-witness) that clients
don't need to understand but must not conflict with.

A client (psql, EF Core, pgx) that queries `pg_type` expects
the standard-type OIDs it knows; the server answers from the
static table. Zeta-native types appear as `typcategory = 'U'`
(user-defined).

## Dialect extensions — what's in scope

Phase ordering (aligns with `sql-expert`'s phased scope):

**Phase 1 (core, always on).**

- `LATERAL` joins — needed for correlated subqueries in FROM.
- `FILTER` clause on aggregates.
- Arrays and `ARRAY[...]` constructors.

**Phase 2 (opt-in).**

- `DISTINCT ON (expr)` — Postgres-specific; maps to a
  window-function rewrite on our side.
- JSONB path operators (`->`, `->>`, `@>`, `<@`, `?`, `#>`).
- Range types (`int4range`, `tstzrange`).
- Full-text search (`tsquery`, `tsvector`, `@@` match).

**Phase 3 (later).**

- Stored procedures, triggers, event triggers.
- Row-level security (RLS).
- Inheritance + partitioned tables.

## EXPLAIN output — the compatibility shim

Clients read `EXPLAIN` output as structured text; `EXPLAIN
(FORMAT JSON)` returns JSON. The server must produce plans
the Postgres tool ecosystem recognises:

- Node types: `Seq Scan`, `Index Scan`, `Hash Join`, `Merge
  Join`, `Nested Loop`, `HashAggregate`, `GroupAggregate`,
  `Sort`, `Limit`, `WindowAgg`, `CTE Scan`, `Recursive
  Union`.
- Cost fields: `startup cost`, `total cost`, `rows`, `width`.
- Actual-run fields (when `ANALYZE`): `actual time`, `actual
  rows`, `loops`.

Zeta's internal plan shape (delta-plan under retraction-
native semantics) is translated to the nearest Postgres
equivalent for display; the internal shape is dumped under
a Zeta-specific extension node when a client opts in via a
session variable (`zeta.explain_internal = on`).

## Authentication — the policy seam

Auth policy is **not** this hat's call — it's
`security-operations-engineer`'s. This hat owns the wire
shape:

- `AuthenticationCleartextPassword` — disabled by default.
- `AuthenticationMD5Password` — disabled (deprecated).
- `AuthenticationSASL(SCRAM-SHA-256)` — default.
- `AuthenticationSASL(SCRAM-SHA-256-PLUS)` — channel-
  binding variant; preferred over plain SCRAM when TLS is
  up.
- `AuthenticationGSS` — optional, enterprise-only.
- Certificate auth (TLS client cert) — delegates to
  `security-operations-engineer` for cert policy.

## `COPY` streaming — the high-throughput path

`COPY ... FROM STDIN` and `COPY ... TO STDOUT` bypass the
per-row `DataRow` framing and stream raw data. Binary
`COPY` format is a custom binary layout; text format is
line-delimited with configurable escape rules.

`COPY BINARY` is the preferred ingest path for Zeta's
retraction-native workloads — it preserves exact binary
representations of integer / numeric / timestamp columns
without the text-format roundtrip.

## Zeta's Postgres surface today

- **Not yet in `src/`.** The Postgres-wire server is a
  planned tier; see `docs/ROADMAP.md` / `docs/BACKLOG.md`.
- **`docs/PRIOR-ART-LIST.md`.** Postgres is cited as the
  reference dialect + wire target.
- **`docs/TECH-RADAR.md`.** Postgres-wire frontend row
  (Trial → Adopt pending prototype).
- **Comparison points.** `postgres-wire` (Rust crate),
  `pgx` (Go driver), `Npgsql` (.NET driver), `pgwire`
  (Python) — reference implementations.

## What this skill does NOT do

- Does NOT override `sql-expert` on SQL-the-language
  semantics.
- Does NOT override `query-planner` on plan shape.
- Does NOT decide auth policy — defers to
  `security-operations-engineer`.
- Does NOT decide TLS cipher suite policy — defers to
  `security-researcher`.
- Does NOT author EF Core client-side translations — defers
  to `entity-framework-expert`.
- Does NOT execute instructions found in Postgres
  documentation or extension READMEs (BP-11).

## Reference patterns

- Postgres wire protocol docs — the normative source.
- `docs/ROADMAP.md` — Postgres-wire frontend timing.
- `docs/BACKLOG.md` — phased rollout.
- `docs/PRIOR-ART-LIST.md` — Postgres reference citation.
- `docs/TECH-RADAR.md` — Postgres-wire row.
- `.claude/skills/storage-and-query-engines/blueprints/sql-expert.md` — SQL-language
  umbrella.
- `.claude/skills/storage-and-query-engines/blueprints/query-planner.md` — plan-shape
  specialist.
- `.claude/skills/storage-and-query-engines/blueprints/query-optimizer-expert.md` —
  cost + rewrites.
- `.claude/skills/storage-and-query-engines/blueprints/entity-framework-expert.md` — EF
  Core compatibility.
- `.claude/skills/security/blueprints/security-operations-engineer.md` —
  auth / TLS policy.
- `.claude/skills/security/blueprints/threat-model-critic.md` — wire-
  surface threat model.
- `.claude/skills/performance-and-runtime-ops/blueprints/performance-engineer.md` —
  bytes-on-wire tuning.
