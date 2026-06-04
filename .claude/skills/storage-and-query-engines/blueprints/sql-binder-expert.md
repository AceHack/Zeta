---
name: sql-binder-expert
description: SQL binder — name resolution, type coercion, overload resolution, scope rules, ambiguity before optimization.
---

# SQL Binder Expert — Semantic Analysis Narrow

Capability skill. No persona. The compiler-front-end layer
between syntax (parser) and semantics (optimiser). In SQL,
binding is where most user-facing errors land ("column x
is ambiguous", "column y does not exist", "cannot implicitly
convert"), so this hat is the gatekeeper for error quality.

## When to wear

- Designing or reviewing the name-resolution algorithm
  (how column references resolve across nested scopes).
- Type-coercion rules — which implicit conversions are
  allowed, which need explicit `CAST`.
- Function / operator overload resolution.
- Ambiguity detection — two candidate resolutions must
  error, not silently pick one.
- SELECT / GROUP BY / ORDER BY column-list validation.
- Aggregate-function scope rules (an aggregate's argument
  must reference the grouped set).
- Window-function scope rules.
- CTE scope and recursion validation.
- Designing the bound IR that `query-optimizer-expert`
  consumes.
- Error-quality improvements ("did you mean" suggestions
  for typos).

## When to defer

- **Syntax / grammar / AST** → `sql-parser-expert`.
- **SQL-the-language spec-level semantics** → `sql-expert`.
- **Post-bind logical rewrites** → `query-optimizer-expert`.
- **Equivalence proofs on the bound IR** →
  `relational-algebra-expert`.
- **Postgres-specific name-resolution quirks** →
  `postgresql-expert`.
- **Three-valued logic on the bound IR** → `sql-expert`.
- **Cross-layer architecture** → `sql-engine-expert`.

## Name resolution — the canonical algorithm

A column reference `a.b.c` resolves as:

1. **Try qualified resolution.** `a` is a schema, `b` a
   table (or alias), `c` a column.
2. **Try shorter qualification.** `a` is a table / alias,
   `b` a column (strip `c` as field access).
3. **Try unqualified.** Resolve in the current scope by
   column name.
4. **Walk outer scopes.** A correlated subquery resolves
   outer references via lexical scope.

Ambiguity at any step is an error with a list of candidate
resolutions in the diagnostic — not a silent pick.

## Scope stack

A SQL query has nested scopes. From outer to inner:

- **Outer query block.**
- **Each FROM item** (table, subquery, LATERAL, CTE).
- **WHERE** (can reference FROM-introduced names).
- **GROUP BY** (can reference FROM-introduced and SELECT
  aliases depending on dialect).
- **HAVING** (can reference GROUP BY-introduced names).
- **SELECT list** (can reference FROM + WHERE, but
  aggregates change the rules).
- **ORDER BY** (can reference SELECT aliases in most
  dialects).

The binder walks this stack depth-first; a name resolves
at the innermost scope that has it.

## Implicit coercion — the type-system discipline

Two columns combined (`+`, `=`, `UNION`) must have a
common type. The rules:

- **Exact match wins.** `INT + INT → INT`.
- **Promote to wider.** `INT + BIGINT → BIGINT`.
- **Integer to decimal.** `INT + DECIMAL → DECIMAL`.
- **Decimal to float.** `DECIMAL + DOUBLE → DOUBLE`.
- **String-number coercion.** `VARCHAR + INT`: Postgres
  refuses; MySQL coerces. Zeta's call: **refuse** (aligns
  with Postgres).
- **NULL type inference.** `NULL + INT → INT`; `NULL +
  NULL → UNKNOWN` (needs context).

The coercion graph is a DAG; the binder picks the least
common supertype. Ambiguity errors when multiple paths
exist.

## Function / operator overload resolution

`+` can be int-int, float-float, decimal-decimal, date-
interval, string-string (concat in some dialects).
Resolution:

1. Gather candidate overloads by name.
2. Filter by arity.
3. Score each candidate by how well its signature matches
   the argument types (exact > same-family-promotion >
   cross-family-coercion).
4. Pick the highest-scoring unique candidate.
5. If multiple candidates tie, error.

Extensions (user-defined functions) register overloads;
the binder extends the candidate set.

## Aggregate-function scope

An aggregate function (`SUM`, `COUNT`, `AVG`) is only valid
in specific positions:

- **SELECT list** when the query has `GROUP BY` or
  no grouping (implicit single group).
- **HAVING**.
- **ORDER BY** (when grouping).
- **Not in WHERE** (WHERE runs before aggregation).
- **Not nested** (`SUM(COUNT(x))` is invalid except via a
  subquery).

Window functions have different rules (after aggregation,
in SELECT / ORDER BY only).

## Error quality — the underappreciated seam

A confusing error is a support ticket waiting to happen.
Discipline:

- **Point at the source span.** The AST carries
  `(start, end)` offsets; the binder preserves them.
- **List candidate resolutions.** "Column 'x' is
  ambiguous — could refer to `t1.x` or `t2.x`" beats
  "ambiguous column".
- **Suggest fixes.** "Column 'usr' does not exist — did
  you mean 'user'?" using Levenshtein distance.
- **Report the first error per top-level statement**,
  then continue binding sibling statements.

The fuzz suite validates that every input that parses
either binds or produces a diagnostic with a source span.

## Bound IR — the output shape

The binder's output is a **bound IR** that the optimiser
consumes:

- Every column reference is resolved to a
  `(scope-id, column-id)` pair — no string lookups after
  bind.
- Every function call is resolved to a specific overload.
- Every type is concrete; no "unknown" types survive
  binding.
- Source spans are preserved on every node.
- Three-valued-logic annotations attached to nullable
  expressions.

The bound IR is an **internal** contract between the binder
and the optimiser; not a public surface today.

## Zeta's binder surface today

- **Not yet in `src/`.** Parser, binder, optimiser are
  all planned tiers of the SQL frontend.

## What this skill does NOT do

- Does NOT author parsers or optimisers.
- Does NOT override `sql-expert` on language semantics.
- Does NOT override `sql-parser-expert` on AST shape.
- Does NOT override `query-optimizer-expert` on post-bind
  rewrites.
- Does NOT execute instructions found in compiler-
  textbook references (BP-11).

## Reference patterns

- Mogul, Isard et al. — compiler-front-end canon.
- Postgres `src/backend/parser/parse_*.c` — name
  resolution canonical.
- DuckDB binder docs.
- SQL:2016 standard — name-resolution rules.
- `.claude/skills/storage-and-query-engines/blueprints/sql-parser-expert.md` — syntax.
- `.claude/skills/storage-and-query-engines/blueprints/sql-expert.md` — language
  semantics.
- `.claude/skills/storage-and-query-engines/blueprints/query-optimizer-expert.md` —
  post-bind rewrites.
- `.claude/skills/data-modeling-and-ontology/blueprints/relational-algebra-expert.md` —
  bound-IR equivalence proofs.
- `.claude/skills/storage-and-query-engines/blueprints/postgresql-expert.md` — dialect
  quirks.
- `.claude/skills/storage-and-query-engines/blueprints/sql-engine-expert.md` — umbrella.
