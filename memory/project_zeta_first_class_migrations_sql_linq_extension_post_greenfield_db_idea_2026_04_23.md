---
name: Zeta first-class migrations — candidate feature for post-greenfield DB-change discipline; SQL/LINQ-extension shape; works for any consumer not just EF; EF migrations are the best discipline Aaron knows but are tough; thinking-out-loud idea
description: Aaron 2026-04-23 thinking-out-loud after the greenfield-phases framing. *"EF migrations is the best decipline i know for post greefield database changes but it's tough, it would be nice if Zeta has some first class migrations support from any consumer not just EF mabye some SQL extension to our own dialet of SQL/LINQ IDK just thinking out lout for post greenfield with a database."* Candidate Zeta feature — first-class migrations primitive that works for any consumer (not tied to EF), possibly surfaced as a Zeta SQL-dialect or LINQ extension. Load-bearing for Phase-2/Phase-3 when Zeta-as-database has deployed consumers.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Zeta first-class migrations — post-greenfield feature idea

## Verbatim (2026-04-23)

> EF migrations is the best decipline i know for post
> greefield database changes but it's tough, it would be
> nice if Zeta has some first class migrations support
> from any consumer not just EF ,mabye some SQL extension
> to our own dialet of SQL/LINQ IDK just thinking out lout
> for post greenfield with a database.

## What Aaron is pointing at

### The EF-migrations reference point

Entity Framework (EF Core / EF6) migrations are Aaron's
reference for post-greenfield DB discipline:

- Declarative schema changes under version control
- Deterministic apply / rollback per migration
- Migration history stored in the DB itself
  (`__EFMigrationsHistory`)
- Backcompat-aware — migrations consider prior schema
  shape
- Model-code-first workflow (C# model → EF generates
  migration SQL) or DB-first workflow (existing DB →
  EF scaffolds model)

### The "tough" observation

EF migrations are genuinely hard because:

- **Schema-and-data are entangled** — a migration that
  adds a non-null column needs a backfill strategy
- **Concurrent running producers + consumers** — the
  deployment can't just "pause everything" and migrate;
  old-version consumers must keep running against
  transitional schema
- **Rollback complexity** — forward migrations are hard;
  backward migrations are harder because data written
  under the forward migration may not fit the previous
  schema
- **Cross-team coordination** — when multiple services
  share a DB, migrations become a coordination exercise
- **EF-specific** — the discipline is coupled to EF's
  code-first model; non-EF consumers (raw SQL, Dapper,
  non-.NET consumers) don't benefit

### The Zeta-first-class aspiration

What Aaron is imagining:

- A migration primitive **Zeta-native** rather than
  EF-coupled
- Accessible from **any consumer** (EF, Dapper, raw SQL,
  non-.NET, cross-language)
- Possibly surfaced as:
  - A **Zeta SQL-dialect extension** —
    `CREATE MIGRATION ...` / `APPLY MIGRATION ...` /
    `RETRACT MIGRATION ...` as first-class statements
  - A **LINQ extension** — migration-as-query-expression
    in the Zeta IQueryable-like layer
  - Or both — authoritative in SQL-dialect, mirrored in
    LINQ for .NET convenience

### Why Zeta is uniquely positioned

Zeta's retraction-native operator algebra (D / I / z⁻¹ / H
over Z-sets) already treats change as first-class:

- Signed weights make **add-then-remove-then-re-add**
  equivalent to **never-happened** (algebraically) —
  EF's forward/backward-migration asymmetry is an
  algebraic artifact Zeta could avoid
- **K-relations / semiring-parameterization** (per
  `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`)
  means migrations over provenance-aware state are
  expressible as semiring-parameterised algebra —
  migration history tracked inside the algebra
- **Spine compaction** with trace preservation means
  old-schema data can be retained-for-rollback without
  unbounded growth (amortised tier migration)

### Composition with greenfield-phases framing

This idea explicitly lives in **Phase 2 / Phase 3**
territory. Greenfield has no migration cost because
there's nothing to migrate from. Once Zeta-as-database is
deployed (Phase 2+), the migration discipline becomes
load-bearing.

The feature is **not urgent today** (Aaron's "thinking
out loud") — the factory is in Phase 1. But it's a
forward-feature worth queuing as research.

## Candidate feature shape

### Option A — SQL-dialect extension

```sql
-- Zeta-SQL extended grammar (sketch)
CREATE MIGRATION v2.add_customer_email
  WHEN APPLIED DO
    ALTER TABLE customers ADD COLUMN email TEXT;
    UPDATE customers SET email = legacy_email_derived(id);
    ALTER TABLE customers ALTER COLUMN email SET NOT NULL;
  WHEN RETRACTED DO
    ALTER TABLE customers DROP COLUMN email;
  WITH PROVENANCE
    AUTHOR 'aaron', DATE '2026-04-23';

APPLY MIGRATION v2.add_customer_email;
-- ... later ...
RETRACT MIGRATION v2.add_customer_email;
-- z^-1 over migrations: point-in-time schema view
AT MIGRATION v1.initial SELECT * FROM customers;
```

### Option B — LINQ-first

```csharp
db.Migrations.Register(
  "v2.add_customer_email",
  apply: tx => tx.Customers.AddColumn(c => c.Email, backfill: ...),
  retract: tx => tx.Customers.RemoveColumn(c => c.Email),
  provenance: new Prov("aaron", "2026-04-23"));

db.Migrations.Apply("v2.add_customer_email");
```

### Option C — SQL authoritative + LINQ mirror

The full design. SQL is the cross-consumer contract
(any language hits it); LINQ mirrors for .NET ergonomics.
Parity enforcement via spec tests.

## Consumer-independence observation

The key differentiator Aaron is pointing at is
**consumer-independence**. EF migrations only work for EF
consumers. Zeta first-class migrations should work for:

- EF consumers (via an EF provider)
- Dapper / raw-SQL .NET consumers
- Non-.NET consumers (any language hitting the Zeta wire
  protocol)
- Cross-language microservices sharing the Zeta DB

The migration history + state lives in the Zeta DB
itself, not in a per-consumer runtime library.

## How to apply

### Near-term (Phase 1 / current)

- **Defer implementation.** Not urgent; Zeta-as-database
  has no deployed consumers yet.
- **Keep the idea in the research queue.** Natural home:
  a BACKLOG P2/P3 row under `docs/BACKLOG.md` or a
  research doc under `docs/research/`.
- **Cross-reference** the greenfield-phases memory
  (`feedback_greenfield_until_deployed_then_backcompat_learning_mode_DORA_cost_2026_04_23.md`)
  — migrations become load-bearing at the Phase-1→Phase-2
  transition.

### Near-deployment (Phase 1 → Phase 2 transition)

- **Promote to research doc** when first deployment is
  anticipated. Likely candidate trigger: ServiceTitan
  demo commits to a Postgres-backed deployment, and the
  factory wants Zeta-as-database in that path.
- **Align with Zeta SQL dialect work** — if Zeta has a
  SQL-dialect design underway (the SQL-engine skills
  hint at one), migrations land alongside not
  after-the-fact.

### Post-deployment (Phase 2+)

- Full feature design → ADR → implementation → tests.
- Cross-consumer contract tests (EF provider, Dapper
  provider, non-.NET consumer).

## What this is NOT

- **Not an immediate implementation commitment.** Aaron
  called it thinking-out-loud. No code lands until Phase 2
  approaches.
- **Not a rejection of EF migrations.** EF remains useful
  for the .NET-only case; Zeta-first-class is a broader
  alternative, not a replacement for EF where EF is
  sufficient.
- **Not a decision on SQL-dialect vs LINQ primary
  surface.** Both options live; design decision deferred.
- **Not a promise of better-than-EF ergonomics.** The
  claim is consumer-independence + retraction-native
  algebraic fit — ergonomics would require the same
  hard design work EF did.
- **Not a Zeta-as-database commitment.** This idea
  assumes Zeta-as-database; if Zeta ends up primarily a
  library (not a standalone DB with external consumers),
  the migration-feature question doesn't arise.

## Composes with

- `feedback_greenfield_until_deployed_then_backcompat_learning_mode_DORA_cost_2026_04_23.md`
  (three-phase trajectory; this feature is Phase 2+
  substrate)
- `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  (semiring-parameterized Zeta; migration algebra
  composes with semiring parameterization)
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (signal-preservation; retract-migration preserving
  signal via retraction algebra)
- `.claude/skills/sql-engine-expert/SKILL.md`,
  `sql-parser-expert`, `sql-binder-expert`,
  `linq-expert`, `relational-algebra-expert`,
  `entity-framework-expert` — relevant expert skills
  for the design
- `docs/TECH-RADAR.md` — future row: "Zeta first-class
  migrations" at Assess (placeholder until research
  doc lands)
- `docs/BACKLOG.md` — candidate P2/P3 row for the
  research doc at Phase-1→Phase-2 transition
