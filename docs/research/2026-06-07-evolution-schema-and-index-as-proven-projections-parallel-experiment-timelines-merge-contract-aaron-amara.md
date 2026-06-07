# "Evolution" — schema + index as proven projections, parallel production experiment-timelines with a continual merge contract (Aaron + Amara, 2026-06-07)

The flagship capability the COW Merkle-DAG substrate builds toward, which Aaron wants to name **"Evolution"
something-or-other** (naming seed below, gated). It unifies three things Amara + Aaron worked through:
zero-downtime breaking schema change *as a proof*, multiple parallel production experiments with a merge
contract, and reindexing as a *proven projection from source truth*. Companion to the DDL/canary capture
(`2026-06-07-ddl-as-branchable-canary-...`) and the COW-testing capture
(`2026-06-07-cow-database-testing-from-prod-...`). Faithful capture; Beacon-anchored; hype peeled.

## We already have the START — it's CALLED "Evolution" (Aaron: "the existing schema 0-downtime migration proof we have are called evolution something or other")

The existing artifact is **`src/Core/SchemaEvolution.fs`** (the **B-0930** foundation — "the zero-downtime
versioning seed"), 8 tests in `SchemaEvolution.Tests.fs`. It already provides:
- **Migration algebra** — `addField` / `removeField` / `renameField`, total over `DynamicValue` (every
  non-`Object` shape passes through), order-respecting.
- **Forward compatibility** (old reader, new data): unknown fields *ignored* but *preserved* through
  migrations that don't touch them (extensible-data passthrough).
- **Backward compatibility** (new reader, old data): `addField` supplies a default for an absent field.
- **`migrate fromV toV`** composing adjacent N→N+1 migrations; **forward-only seed** (downgrade = a separate
  Down direction, not yet built). Lineage: Datomic schema-as-data, Kafka Schema Registry.
- **B-0930** = the full **schema-registry-over-DBSP** (P1, architecture) cataloging these as rows.

So "Evolution" is **not a name to decide** — it's the existing name of the started proof. Everything below
is its **extension**: the *down* direction + bidirectional backfill + the full compatibility-window proof
discharge (§1), parallel experiment-timelines (§2), reindex-as-projection (§3).

> ⚠️ **Disambiguation:** `src/Core/Evolution.fs` is a DIFFERENT module — the **B-1019** privacy-as-anti-
> collapse DST harness (pigeonhole bound), unrelated to schema migration. Do not conflate `Evolution.fs`
> (B-1019, privacy) with `SchemaEvolution.fs` (B-0930, schema). This capability extends the latter.

The reindex `full == incremental` theorem (§3) additionally rests on **DBSP incremental view maintenance**,
already in `src/Core`:
- **The `full == incremental` theorem IS DBSP's incrementalization soundness** — incremental view
  computation equals from-scratch; exactly the reindex proof obligation. Z-sets + the chain rule are the engine.
- **`IndexedZSet`** = an index as a derived Z-set; **`Aggregate`/`Residuated`** = derived views, already
  maintained incrementally.
- **Z-set retraction** = reversible deltas (the up/down-migration substrate).
- **B-0829** (schemas-as-rows + cluster-fork-as-trust-boundary) = schema-as-data + fork, the
  experiment-branch seed. The **COW Merkle-DAG store** (`081KTGTJC1Q`) gives cheap content-addressed timelines.

## 1. Zero-downtime breaking schema change as a PROOF OBLIGATION (not a runbook)

Schema changes are **events on the stream**; migrations are **transformations between schema versions**;
backfills are **replayable stream jobs**; rollout/rollback is **root selection + a compatibility proof**.
The proof shape (Amara):

```
old app + old schema works
new app + new schema works
old app + new schema works  during the compatibility window
new app + old schema works  during the window (if needed)
up-migration preserves meaning
down-migration preserves meaning OR names the loss
forward backfill converges
reverse backfill undoes or compensates
```

**Killer invariant:** *a breaking change is admitted only when the "breaking" part has been moved OUTSIDE
the compatibility window* — the classic **expand / migrate / contract** pattern made **formal** (expand →
dual-write/translate → backfill forward → canary on the fork → prove invariants → promote → contract after
the safety horizon → rollback by root-switch or reverse/compensating events).

**Invertibility taxonomy (the proof must distinguish):**
| Class | Property | Rollback |
|-------|----------|----------|
| lossless | `down(up(x)) = x` | inverse |
| lossy | `down(up(x)) ≈ x` only if shadow/history retained | inverse + retained shadow |
| non-invertible | — | **compensation**, not inverse |

For zero-downtime rollback of destructive DDL you **retain shadow state** (old column/table/translation
log/tombstones/derivable indexes) until the **rollback horizon** expires. Keeper: *DDL becomes stream
history; migration becomes a reversible-or-explicitly-compensated morphism; backfill becomes replay; zero
downtime becomes a compatibility theorem, not a deployment prayer.*

## 2. Parallel production experiment-timelines with a continual merge contract (Aaron)

Generalize §1 from one migration to **many concurrent experiments**, each a full alternate code+data
universe rooted at prod `main`:

```
main  = production truth branch
experiment E = code branch + data DAG branch + schema/event branch + side-effect sandbox
             + a CONTINUAL MERGE CONTRACT with main
```

An experiment is **free inside its branch but accountable to main** via the contract (Aaron's exact
requirement — "complete code and data freedom as long as it defines the continual merge contract"):

```
ExperimentContract =
  baseMainRoot · experimentRoot · codeBranch · dataBranch · schemaVersion
  mainToExperimentMerge · experimentToMainProjection · conflictPolicy
  backfillForward · backfillReverse · sideEffectPolicy · promotionGate · rollbackRule
```

**Admissibility theorem:** *an experiment is admissible iff it can continuously reconcile main → experiment
without corrupting main, and its promoted deltas satisfy the merge contract.* Many at once (new schema; new
index/plugin; alternate agent policy; migration rehearsal), each ingesting main continuously, each
droppable / archivable / promotable. This is **A/B on database reality** — schema, data shape, indexes,
logs, plugins, agent policies — not just app behavior. Keeper: *Main is the trunk of truth; experiments are
alternate production timelines; freedom lives in the branch, safety in the merge contract; promotion is
admitting a proven timeline, not deploying.*

## 3. The endgame — reindexing as a PROVEN PROJECTION (source sacred, indexes derived)

Aaron's anchor: the LexisNexis legal-search / Solr full-and-incremental reindex problem, generalized.

- **Source data is sacred; indexes are derived timelines / projections** — so indexes can be aggressively
  rebuilt, forked, deleted, replaced, experimented with, because they are *not* the truth.
- **Full reindex and incremental reindex are two execution strategies for the SAME derivation.** The proof
  obligation:
  ```
  full(source up to T)  ==  incremental( full(source up to T0), deltas T0→T )
  ```
  (or, honestly, "same docs / fields / analyzers / IDs / deletions-tombstones / indexable facts; only
  named allowed differences"). **This is the DBSP incrementalization theorem** — which is why we *already
  have the start*.
- Index experiment = an alternate derivation pipeline: fork source root → new index schema/analyzer/ranking
  → full backfill + incremental tail → prove `full == incremental` → shadow queries → compare coverage /
  missing docs / field distributions / query+ranking diffs / latency / size / invariant failures → promote
  or keep as an inspectable Merkle-diff artifact. Keeper: *a search index is not a database; it is a proven
  projection from source truth — every projection a branch, every backfill a replay, every experiment an
  admissible timeline.*

## Boundary law (carries across §1–§3, one discipline)

The DAG rolls back **database state** by root pointer; it **cannot** unsend an email / uncharge a card /
uncall a webhook. So:

```
Inside DAG  (DDL, indexes, data transforms, views, plugins, schema, data):  branch freely; rollback = root selection
Outside DAG (emails, payments, webhooks, hardware):  outbox / sandbox / replay-token / idempotency / compensation / approval
```

Same outbox/saga boundary as the prod-shadow testing safety law — one rule, three uses.

## Naming — "Evolution" is the EXISTING name (not a pending decision)

Aaron corrected an earlier mis-capture: *"no — the existing schema 0-downtime migration proof we have are
called evolution something or other."* The name is already in use: **`SchemaEvolution`** (`src/Core/
SchemaEvolution.fs`, B-0930). The capability described here is the **`SchemaEvolution`/Evolution family**
extended (down + bidirectional backfill, parallel experiment-timelines, reindex-as-projection) — keep using
the existing `SchemaEvolution`/Evolution naming, don't coin a new one. (If a broader umbrella name is ever
wanted for §2/§3, that would go through `naming-expert` + Ilyana — but the schema-proof core keeps its name.
Beacon caveat for any external use: "schema evolution" is also Avro/Protobuf's generic term.)

## Hype-peel (honest status)

The **math core (DBSP incremental view maintenance) ships**; everything else here — root-pointer rollout,
parallel experiment branches, the ExperimentContract, the schema-evolution proof discharge, the
full==incremental reindex proof for a concrete index, the outbox/saga boundary — is **designed/captured,
not built**, and sits on `081KTGTJC1Q` (the COW store) + the determinism work (B-0969 / `081KTGEVV75`).
Strong endgame; the foundation is real, the product is not yet.

## Ties

- DBSP (`src/Core` circuit/stream, `IndexedZSet`, `Aggregate`, `Residuated`) — the full==incremental engine ·
  Z-set retraction (reversible deltas) · `B-0829` (schemas-as-rows, fork-as-trust-boundary) · `081KTGTJC1Q`
  (COW Merkle-DAG store) · `081KTGXPTQ` (COW testing) · `2026-06-07-ddl-as-branchable-canary-...` (the DDL
  half) · app/plugin/schema-as-DynamicValue · B-0969 + `081KTGEVV75` (determinism) · the formal portfolio
  (Soraya — the schema-evolution + full==incremental proofs).

## Beacon anchors

- **DBSP** (Budiu et al.) — incremental view maintenance; the `full == incremental` theorem. · **Expand/
  contract (parallel change)** — Sato/Fowler. · **Online schema change** — gh-ost, pt-online-schema-change,
  Facebook OSC, Stripe 4-phase. · **Event-sourcing schema evolution / upcasting** — Greg Young. · **Schema
  evolution** — Avro/Protobuf. · **DB branching** — Dolt, Neon/PlanetScale. · **Search reindex** —
  Solr/Elasticsearch full+incremental, LexisNexis legal search (Aaron's anchor). · **Materialized views /
  derived data** — Kleppmann *DDIA* "turning the database inside out." Honest novelty: not these
  individually, but **schema + index + experiments as content-addressed, retractable, DBSP-incremental
  projections over one source-of-truth stream, making zero-downtime change, parallel prod timelines, and
  full==incremental reindex discharged proofs rather than runbooks.**
