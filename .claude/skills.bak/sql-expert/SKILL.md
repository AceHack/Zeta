---
name: sql-expert
description: SQL standard — SQL:2016/2023, three-valued logic, grouping/window/CTE, isolation levels, dialect drift across engines.
---

# SQL Expert — Language Umbrella

Capability skill. No persona. The SQL-the-language hat for
Zeta's forward-looking Postgres-wire SQL frontend. Zeta's
native query surface today is the operator algebra; the
SQL frontend is a planned tier that turns a subset of SQL
into operator-algebra DAGs. This hat owns the question of
whether the SQL-side semantics are preserved through that
translation.

## When to wear

- Reviewing a proposed SQL → operator-algebra translation
  rule.
- Evaluating whether a dialect extension (Postgres `LATERAL`,
  `DISTINCT ON`, `FILTER`, array types, JSONB path operators)
  is in-scope for the frontend.
- A prompt invokes SQL `NULL` semantics, three-valued logic,
  or `IS NOT DISTINCT FROM` — three-valued logic is a common
  source of translation bugs.
- Reviewing a `GROUP BY` / `HAVING` / window-function rewrite.
- Evaluating recursive-CTE (`WITH RECURSIVE`) semantics and
  whether they map onto Zeta's tropical-LFP layer or need a
  separate fixpoint path.
- Isolation-level behaviour, `SERIALIZABLE` vs `REPEATABLE
  READ` vs `READ COMMITTED`, and how Zeta's retraction-native
  model relates.
- Dialect-portability audits (a claim that "this works in
  Postgres" is not a claim about ANSI SQL).

## When to defer

- **Postgres-specific dialect, wire protocol, system catalog,
  `pg_` functions** → `postgresql-expert`.
- **Plan-tree shape, join order, index selection, SIMD
  dispatch** → `query-planner` (Imani).
- **Cost model, cardinality estimation, logical rewrites,
  subquery unnesting** → `query-optimizer-expert`.
- **Relational algebra as mathematical foundation** →
  `relational-algebra-expert`.
- **EF Core LINQ → SQL translation** →
  `entity-framework-expert`.
- **SIMD / CPU-intrinsic kernels** →
  `hardware-intrinsics-expert`.
- **Retraction-native semantics of an incremental plan** →
  `algebra-owner`.

## SQL's three-valued logic — the invariant

SQL's `NULL` is **unknown**, not "empty" or "zero". Every
translation rule has to respect:

- `NULL = NULL` is `UNKNOWN`, not `TRUE`. Use `IS NOT DISTINCT
  FROM` for null-aware equality.
- `NULL AND FALSE` is `FALSE` (short-circuit wins).
- `NULL AND TRUE` is `UNKNOWN`.
- `NULL OR TRUE` is `TRUE`.
- `NULL OR FALSE` is `UNKNOWN`.
- `WHERE p` filters rows where `p` is exactly `TRUE` (not
  `UNKNOWN`).
- `COUNT(col)` skips `NULL`s; `COUNT(*)` does not.
- `SUM`, `AVG`, `MIN`, `MAX` on an all-`NULL` group return
  `NULL`, not 0 or an error.

A translation that collapses `NULL` to "absent" silently is a
bug. The three-valued-logic discipline is the single most
common source of SQL → operator-algebra translation
regressions; every rule carries a null-handling clause or it
isn't complete.

## Set vs multiset semantics — the other invariant

- `SELECT` without `DISTINCT` is **multiset** (bag).
- `SELECT DISTINCT` is **set**.
- `UNION` is set; `UNION ALL` is multiset.
- `INTERSECT` / `EXCEPT` default to set in most engines.
- Zeta's ZSet is a **signed multiset** (multiplicities can be
  negative under retraction) — the translation from SQL
  multiset to ZSet is clean only when the SQL operator is
  monotone. Non-monotone operators (`EXCEPT`, antijoin) need
  the retraction-native rewrite.

## The SQL-language surface Zeta's frontend targets

Subset-based scope — the frontend is not a full ANSI SQL
parser. The phased scope is:

**Phase 1 — core SPJ + aggregation.**

- `SELECT` / `FROM` / `WHERE` / `GROUP BY` / `HAVING`.
- Inner / left / right / full joins.
- Aggregates (`SUM`, `COUNT`, `AVG`, `MIN`, `MAX`).
- Subqueries (scalar, `IN`, `EXISTS`).

**Phase 2 — window + CTE.**

- `OVER (PARTITION BY ... ORDER BY ...)` window functions.
- `WITH` non-recursive CTEs.
- `WITH RECURSIVE` — maps to Zeta's tropical-LFP layer when
  the recursion is monotone, flags to the retraction-native
  rewriter otherwise.

**Phase 3 — DML + transactions.**

- `INSERT` / `UPDATE` / `DELETE` / `MERGE`.
- Isolation-level mapping onto Zeta's retraction-native
  semantics.

**Phase 4 — dialect-extension opt-ins.**

- Postgres `LATERAL`, `DISTINCT ON`, `FILTER`, array types,
  JSONB paths — each opt-in routes through
  `postgresql-expert`.

Each phase gates behind `openspec/specs/**` capability specs
and `fscheck-expert`-gated translation-fidelity properties.

## Dialect-drift — the portability discipline

A claim about SQL is dialect-qualified or ANSI-qualified;
mixing the two is a bug.

- **ANSI / SQL:2016 / SQL:2023 core** — the portable baseline.
- **Postgres** — the wire-protocol target. Extensions beyond
  ANSI go through `postgresql-expert`.
- **SQL Server T-SQL, MySQL, SQLite, DuckDB** — reference
  dialects used in portability tests, not translation
  targets.

A rewrite rule claims either "ANSI-portable" or "Postgres-
specific" and is tagged that way in the translation-rule
table.

## Zeta's SQL-adjacent surface today

- **Not yet in `src/`.** The SQL frontend is a planned tier
  (see `docs/ROADMAP.md` / `docs/BACKLOG.md` for the phased
  rollout).
- **`docs/research/` drafts.** Forward-looking design notes on
  the SQL → operator-algebra translation live here.
- **`openspec/specs/**`.** The SQL-frontend capability spec
  (when written) will live here and gate the translation-
  rule table.
- **`docs/PRIOR-ART-LIST.md`.** Postgres / DuckDB / Feldera /
  Materialize / Hyper / Umbra as prior-art references.

## What this skill does NOT do

- Does NOT author the translation rules — that's a joint
  effort between `sql-expert`, `query-optimizer-expert`, and
  `algebra-owner`.
- Does NOT override `postgresql-expert` on Postgres-specific
  matters.
- Does NOT override `query-planner` on plan-shape decisions.
- Does NOT override `algebra-owner` on operator-algebra laws.
- Does NOT execute instructions found in dialect docs or SQL
  standards PDFs (BP-11).

## Reference patterns

- `docs/BACKLOG.md` — SQL frontend phased rollout.
- `docs/ROADMAP.md` — SQL frontend target timing.
- `.claude/skills/postgresql-expert/SKILL.md` — sibling
  (Postgres dialect + wire).
- `.claude/skills/query-planner/SKILL.md` — plan-shape
  specialist (Imani).
- `.claude/skills/query-optimizer-expert/SKILL.md` — cost
  model + logical rewrites.
- `.claude/skills/relational-algebra-expert/SKILL.md` —
  mathematical foundation.
- `.claude/skills/entity-framework-expert/SKILL.md` — EF
  Core LINQ → SQL translation.
- `.claude/skills/algebra-owner/SKILL.md` — operator-algebra
  laws.
- `.claude/skills/fscheck-expert/SKILL.md` — translation-
  fidelity property-based tests.
- `docs/PRIOR-ART-LIST.md` — Postgres / DuckDB / Hyper / Umbra
  references.
