# DDL as branchable canary rollouts (rollback = root selection); zero-downtime breaking schema changes as a math proof (Amara + Aaron, 2026-06-07)

The deployment/migration half of the COW Merkle-DAG capability — distinct from the *testing* half
(`2026-06-07-cow-database-testing-from-prod-...`). Two contributions: Amara on DDL-as-branchable canary
rollout, Aaron on zero-downtime breaking schema changes as a formal proof. Faithful capture; hype peeled.

## 1. DDL/schema rollout becomes branchable; rollback becomes root selection (Amara)

Normal DDL is burn-the-bridge: `ALTER TABLE` mutates prod shape in place; rollback needs an inverse
migration that may lose data. With the COW Merkle-DAG store, DDL becomes **branchable**:

```
prod root R
→ fork canary root C
→ apply DDL / migration / new plugin / new index to C
→ route 1% (or mirrored) traffic to C
→ observe invariants, latency, errors, data diffs
→ good: promote C / merge proven deltas    bad: drop C / stop routing
```

- **Rollback is not "run the opposite migration" — it is moving the active root pointer back to the
  known-good DAG.** Keeper: **"DDL rollback becomes root selection, not archaeology."**
- **A/B + canary at the database-STRUCTURE level** (not just app code): A = prod schema/root, B = candidate
  schema/root; canary routes a slice to B; rollback stops routing to B; promotion makes B the new main root
  (or merges approved deltas).
- **A failed canary is not lost** — it stays an inspectable artifact: candidate root + traffic slice +
  migration version + observed errors + Merkle diff + Z-set deltas + invariant failures + perf counters +
  rollback reason. **Every failed rollout becomes a reproducible test case.**

### Blade — external side effects still need a boundary

The DAG can roll back *database state* by root pointer, but it **cannot unsend an email, uncharge a card,
or uncall a webhook**. So:

| Inside DAG | Outside DAG |
|------------|-------------|
| DDL, indexes, data transforms, views, plugins | emails, payments, webhooks, hardware calls |
| → rollback by **root pointer** | → **outbox / saga / approval / idempotency / compensation** |

(Same outbox/saga boundary as the prod-shadow testing safety law — one discipline, two uses.)

### Schema is a value too

```
SchemaDefinition : DynamicValue      MigrationPlan : DynamicValue
IndexDefinition  : DynamicValue      PluginVersion : DynamicValue
```

A rollout is then a **new self-describing app/database value with tests attached**: candidate root + schema
value + migration value + tests/laws/vectors + compatibility gates + canary policy. Ties to
app-as-DynamicValue (`2026-06-07-app-definition-as-dynamicvalue-...`) + plugin-as-data.

Keeper: *Canary rollout becomes a branch. DDL becomes a value. Rollback becomes root-pointer selection.
Promotion becomes admitting a proven DAG.* Not "migrations are less scary" — **"migrations become testable
alternate timelines."** (And the COW substrate is also a debugger + fixture system + migration harness +
replay engine + proof surface, all on the same primitive — the framing from the testing capture, applied
to deployment.)

## 2. Zero-downtime BREAKING schema changes as a MATH PROOF (Aaron)

> Aaron: *"we are working through zero-downtime breaking schema changes too as a math proof — where the
> schema updates are events on the stream, and up/down migrations plus backfill in both directions are
> accounted for."*

The formal target: a **breaking** schema change with **zero downtime**, **proven** rather than
hand-rolled. The structure:

- **Schema updates are events on the stream** — a schema version is a point in the same Z-set/Log the data
  flows through, not an out-of-band DDL. (Schema-as-value, §1, made temporal.)
- **Up AND down migrations** are both defined — the change is reversible by construction.
- **Backfill in BOTH directions** is accounted for — old readers see new data correctly migrated *down*,
  new readers see old data migrated *up*, during the overlap window. This is the
  **expand/contract (parallel-change)** pattern, but made a **proof obligation** over the stream rather
  than a runbook: the migration is correct iff every (reader-version × data-version) pair resolves to a
  well-defined, lossless value for the duration of the transition.
- **Math proof** — discharge that the bidirectional migration + backfill preserve the data's meaning across
  the version boundary with no window where a reader gets an undefined/lossy view. A formal-verification
  target (Soraya's portfolio): the property class is "online schema evolution correctness" — provable here
  because schema, migration, and data are all values on one replayable, retractable, content-addressed
  substrate.

This is filed as a backlog item (a proof target), composing with the Merkle-DAG backend + the determinism
work.

## Hype-peel (honest status)

Both are **designed/captured, not built**. The COW substrate (`081KTGTJC1Q`), root-pointer rollout
machinery, canary routing, the outbox/saga boundary, and the schema-migration proof are all ahead of the
landed seeds (`ZSetMerkle` + `Collation`). Powerful direction; not yet real.

## Ties

- `2026-06-07-cow-database-testing-from-prod-...` (the testing half; same COW/Merkle-DAG substrate + same
  outbox/saga boundary) · `081KTGTJC1Q` (Merkle-DAG store) · `081KTGXPTQ` (COW testing workitem) ·
  app-as-DynamicValue + plugin-as-data (schema/migration/index/plugin as values) · 081KT07NV0008QG0R001YDB73K + `081KTGEVV75`
  (determinism — same-fork-same-root) · the formal-verification portfolio (Soraya — the schema-proof).

## Beacon anchors

- **Expand/contract (parallel change)** migration — Danilo Sato / Martin Fowler. · **Online schema change**:
  gh-ost (GitHub), pt-online-schema-change (Percona), Facebook OSC, Stripe's 4-phase migrations. ·
  **Database branching / canary**: Dolt, Neon/PlanetScale branches + deploy requests. · **Blue-green /
  canary deployment** (app-level, here pushed to the schema level). · **Event-sourcing schema evolution /
  upcasting** (Greg Young). Honest novelty: not these patterns individually, but **schema + migration as
  stream events on a content-addressed retractable substrate, making zero-downtime breaking change a
  discharged proof and rollback a root-pointer move** rather than a runbook.
