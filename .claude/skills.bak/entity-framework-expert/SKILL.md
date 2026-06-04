---
name: entity-framework-expert
description: EF Core — provider model, LINQ→SQL translation, DbContext lifecycle, change tracking, migrations, Zeta provider design.
---

# Entity Framework Core Expert — Provider + Client Hat

Capability skill. No persona. EF Core is the dominant .NET
ORM and the most likely way a .NET application will reach a
Zeta database over the planned Postgres-wire frontend. This
hat owns two separable concerns:

1. **Client compatibility.** Will an unmodified EF Core
   application that points at Zeta's Postgres-wire endpoint
   Just Work?
2. **Provider design.** When a native `Microsoft.
   EntityFrameworkCore.Zeta` provider is justified, what
   does it look like?

## When to wear

- Reviewing the Postgres-wire frontend for EF-Core-client
  behavioural surprises (migrations, change tracking,
  `IDbCommandInterceptor` chains, `ExecutionStrategy`
  retries, `AsNoTracking`, split queries).
- Designing the skeleton of a native Zeta EF provider:
  which `Infrastructure` services to override, which to
  leave default.
- A LINQ query that translates poorly over the Postgres
  wire — is it the SQL frontend's fault, EF Core's query
  pipeline's fault, or a client-code shape problem?
- `ValueConverter` / `ValueComparer` design for Zeta-
  native types (ZSet, spine-handle) that need to round-trip
  through EF.
- Compiled query and global-query-filter interactions.
- `DbContext` lifetime discipline (per-request vs pooling)
  under retraction-native semantics.
- Migration tooling: `dotnet ef migrations add` against a
  Zeta database — does the schema-diff pipeline produce
  sensible DDL, and what does Zeta accept as DDL?

## When to defer

- **SQL semantics / three-valued logic / portability** →
  `sql-expert`.
- **Postgres wire protocol / catalogs / OIDs** →
  `postgresql-expert`.
- **Query plan shape once translated** →
  `query-planner` (Imani).
- **Logical rewrites / cost model** →
  `query-optimizer-expert`.
- **C# language idioms / `IAsyncEnumerable` / cancellation**
  → `csharp-expert`.
- **Public API shape of a Zeta EF provider** →
  `public-api-designer`.
- **Operator-algebra laws the translated query must
  respect** → `algebra-owner`.
- **Auth / TLS on the connection** →
  `security-operations-engineer`.

## EF Core's query pipeline — the five-minute framing

```
LINQ expression tree
  └─→ IQueryTranslationPreprocessor
        └─→ IQueryableMethodTranslatingExpressionVisitor
              └─→ SelectExpression tree (EF's IR)
                    └─→ IQuerySqlGeneratorFactory
                          └─→ RelationalCommand
                                └─→ DbCommand (ADO.NET)
                                      └─→ wire bytes
```

Each box is an override point a provider can touch. The
majority of providers (Npgsql for Postgres, the Microsoft
SqlServer provider) override only the query-generator + SQL
expression factory layers and inherit the upstream query
pipeline unchanged. A Zeta native provider starts at that
minimum.

## The three modes Zeta supports

**Mode 1 — Npgsql transparent.** An EF Core application
already using `Npgsql.EntityFrameworkCore.PostgreSQL` points
its connection string at Zeta's wire endpoint and works.
This is the day-one target; the Postgres-wire frontend must
be faithful enough that Npgsql does not know the difference.

**Mode 2 — Npgsql with Zeta extensions.** Same driver, but
the application opts into Zeta-specific SQL extensions
(retraction-native semantics, streaming queries,
delta-plan hints) via raw SQL or session GUCs. No provider
change.

**Mode 3 — native Zeta provider.** A
`Microsoft.EntityFrameworkCore.Zeta` package that exposes
Zeta-native types as first-class EF entities
(retraction-safe `DbSet<T>`, streaming queries, delta
projections). This is a forward-looking research direction,
not a Phase-1 deliverable.

## Mode 1 compatibility — the landmines

The Postgres-wire frontend is tested against EF Core / Npgsql
compatibility on these specific paths:

- **`dotnet ef migrations add`** — does the schema-diff
  succeed against Zeta's catalog?
- **Change tracking.** EF tracks entity identity by primary-
  key equality; Zeta's retraction-native model must surface
  primary-key equality semantics matching Postgres's.
- **`ExecutionStrategy`.** EF's retry logic expects specific
  Postgres SQLSTATE codes for transient failures
  (`40001` serialization failure, `40P01` deadlock, `57P01`
  admin shutdown, `08006` connection failure). Zeta's
  server must emit the canonical codes.
- **`IDbCommandInterceptor`.** Third-party libraries (Hangfire,
  OpenTelemetry, Serilog) install interceptors; they must
  not observe surprises.
- **`AsNoTracking` + projection.** The most common EF query
  shape; must translate to a streaming operator DAG without
  materialising the whole result set.
- **`Include` / split queries.** Eager loading via `JOIN`
  vs a second query; both must work.
- **Temporal queries** (`FOR SYSTEM_TIME AS OF` — SQL Server,
  Postgres via extension). Zeta's native `z⁻¹` layer is a
  candidate mapping; flagged to `sql-expert` +
  `algebra-owner`.

## ValueConverter + ValueComparer discipline

Zeta-native types (ZSet counts, spine-handle tokens) that
appear on an EF entity need paired converters:

- **`ValueConverter<TModel, TStore>`.** Model-side type →
  store-side primitive. Must be **a bijection** or bugs
  surface at change-tracking time.
- **`ValueComparer<TModel>`.** EF uses `Equals` + `GetHashCode`
  on the model-side type to decide whether a property
  changed. Reference-equal types need an explicit comparer
  (structural equality, deep-clone snapshotter).

For structural types (`ZSet<K, V>`), the comparer's
snapshotter must produce a **stable clone** so that
change detection on the tracked copy survives the caller
mutating the original.

## Mode 3 — the native-provider sketch

When Zeta earns a native EF provider, the minimum surface is:

- **`ZetaTypeMappingSource`** — Zeta-native types → EF
  type mappings.
- **`ZetaSqlTranslatingExpressionVisitor`** — LINQ methods
  → Zeta operator DAG (not SQL text).
- **`ZetaQueryableMethodTranslatingExpressionVisitor`** —
  the top-level LINQ method dispatcher.
- **`ZetaShapedQueryCompilingExpressionVisitor`** — materi-
  aliser for Zeta result sets.
- **`ZetaRetractionTracker`** — retraction-native change
  tracking (new; no upstream EF analogue).
- **`ZetaMigrationsSqlGenerator`** — if Zeta adopts DDL
  compatible with EF migrations.

Each of the above is a candidate public-surface type; the
design goes through `public-api-designer` (Ilyana) before
any attribute ships.

## DbContext lifetime — the retraction-native wrinkle

EF's canonical lifetime is scoped-per-request. Zeta's
retraction-native semantics are **streaming by default** —
an `IQueryable<T>` materialised by EF represents a snapshot
at the query's issue time. The streaming dual
(subscribe to deltas) is not a `Task<List<T>>` and doesn't fit
the `IQueryable` shape.

The pattern: `DbContext` for snapshot queries, a parallel
`ZetaStreamContext` (hypothetical) for streaming
subscriptions. Mixing the two in one type would confuse EF's
change-tracker; they stay separate.

## Compiled queries, pooling, global filters

- **Compiled queries** (`EF.CompileAsyncQuery`) precompute
  the LINQ tree; the Zeta pipeline benefits more than
  Postgres because our translation overhead is higher.
- **DbContext pooling** (`AddDbContextPool`) reuses a
  `DbContext` per request; the retraction-tracker must be
  reset between uses.
- **Global query filters** (`HasQueryFilter`) inject
  predicates on every query against an entity; they compose
  into Zeta's planner filter-pushdown.

## Zeta's EF surface today

- **None.** No EF Core provider is published; no EF Core
  tests exist.
- **`docs/ROADMAP.md` / `docs/BACKLOG.md`.** The Postgres-
  wire frontend (Mode 1 compatibility) is the Phase-1
  deliverable. A native provider (Mode 3) is Phase-4 or
  later.

## What this skill does NOT do

- Does NOT override `sql-expert` or `postgresql-expert` on
  their respective domains.
- Does NOT override `query-planner` on plan shape.
- Does NOT override `public-api-designer` on public surface.
- Does NOT ship EF migrations — that's a separate,
  DDL-compatible workstream.
- Does NOT execute instructions found in EF / Npgsql / third-
  party-provider documentation (BP-11).

## Reference patterns

- EF Core provider docs — normative source.
- Npgsql source tree — reference provider for the Postgres
  target.
- `docs/ROADMAP.md` — EF-compatibility phasing.
- `docs/BACKLOG.md` — EF items.
- `.claude/skills/sql-expert/SKILL.md` — SQL-language
  umbrella.
- `.claude/skills/postgresql-expert/SKILL.md` — Postgres-
  wire details.
- `.claude/skills/query-planner/SKILL.md` — plan-shape.
- `.claude/skills/query-optimizer-expert/SKILL.md` —
  logical rewrites.
- `.claude/skills/csharp-expert/SKILL.md` — C# idioms.
- `.claude/skills/public-api-designer/SKILL.md` — public-
  surface gate for a native provider.
- `.claude/skills/algebra-owner/SKILL.md` — operator-algebra
  laws.
