# "Evolution" — schema + index as proven projections, parallel production experiment-timelines with a continual merge contract (Aaron + Amara, 2026-06-07)

The flagship capability the COW Merkle-DAG substrate builds toward, which Aaron wants to name **"Evolution"
something-or-other** (naming seed below, gated). It unifies three things Amara + Aaron worked through:
zero-downtime breaking schema change *as a proof*, multiple parallel production experiments with a merge
contract, and reindexing as a *proven projection from source truth*. Companion to the DDL/canary capture
(`2026-06-07-ddl-as-branchable-canary-...`) and the COW-testing capture
(`2026-06-07-cow-database-testing-from-prod-...`). Faithful capture; Beacon-anchored; hype peeled.

## We already have the START — it's CALLED "Evolution" (Aaron: "the existing schema 0-downtime migration proof we have are called evolution something or other")

The existing artifact is **`src/Core/SchemaEvolution.fs`** (the **081KSRGFP0008QG0R001Y6RTY9** foundation — "the zero-downtime
versioning seed"), 8 tests in `SchemaEvolution.Tests.fs`. It already provides:
- **Migration algebra** — `addField` / `removeField` / `renameField`, total over `DynamicValue` (every
  non-`Object` shape passes through), order-respecting.
- **Forward compatibility** (old reader, new data): unknown fields *ignored* but *preserved* through
  migrations that don't touch them (extensible-data passthrough).
- **Backward compatibility** (new reader, old data): `addField` supplies a default for an absent field.
- **`migrate fromV toV`** composing adjacent N→N+1 migrations; **forward-only seed** (downgrade = a separate
  Down direction, not yet built). Lineage: Datomic schema-as-data, Kafka Schema Registry.
- **081KSRGFP0008QG0R001Y6RTY9** = the full **schema-registry-over-DBSP** (P1, architecture) cataloging these as rows.

So "Evolution" is **not a name to decide** — it's the existing name of the started proof. Everything below
is its **extension**: the *down* direction + bidirectional backfill + the full compatibility-window proof
discharge (§1), parallel experiment-timelines (§2), reindex-as-projection (§3).

> ⚠️ **Disambiguation:** `src/Core/Evolution.fs` is a DIFFERENT module — the **081KT7YW00008QG0R001DGZQKM** privacy-as-anti-
> collapse DST harness (pigeonhole bound), unrelated to schema migration. Do not conflate `Evolution.fs`
> (081KT7YW00008QG0R001DGZQKM, privacy) with `SchemaEvolution.fs` (081KSRGFP0008QG0R001Y6RTY9, schema). This capability extends the latter.

The reindex `full == incremental` theorem (§3) additionally rests on **DBSP incremental view maintenance**,
already in `src/Core`:
- **The `full == incremental` theorem IS DBSP's incrementalization soundness** — incremental view
  computation equals from-scratch; exactly the reindex proof obligation. Z-sets + the chain rule are the engine.
- **`IndexedZSet`** = an index as a derived Z-set; **`Aggregate`/`Residuated`** = derived views, already
  maintained incrementally.
- **Z-set retraction** = reversible deltas (the up/down-migration substrate).
- **081KSGS9H0008QG0R000Q18PGQ** (schemas-as-rows + cluster-fork-as-trust-boundary) = schema-as-data + fork, the
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

**Backward-projection constraint — you cannot EXPAND-INTO new relations until contract completes (Aaron
2026-06-07).** A subtle but mathematically-forced *temporal ordering* on expand/migrate/contract:

> *"when you add new relations to the database you can't expand into them until the migration window is
> complete and the old flat code is removed — because you can't project backwards in a lossless way. So you
> have to wait to expand until the expanded relations are all that exists."*

Adding a relation (the *schema* expand) is safe and reversible. But **writing data that only the new
relations can represent** (the *behavioral* expand — "expand-into") is **not** safe while any old flat
reader still exists, because serving that reader requires projecting the richer shape back down to the flat
shape — a **lossy backward projection** (the down direction of an `addField`-of-structure is fine, but the
down of "data that has no flat representation" is information loss). So the gate:

```
1. expand schema      — add the new relations; nobody writes the richer-only data yet (reversible)
2. migration window   — old flat + new relational coexist; backfill; old readers still served by lossless down-projection
3. CONTRACT           — remove the old flat code / the last old reader
4. expand-INTO         — only NOW write data that only the new relations can hold
                         (safe because the expanded relations are all that exists — no backward projection owed)
```

The rule: **expand-into is gated on contract-complete** — `mayExpandInto(relation) ⟺ no reader remains that
needs a lossless flat projection of it`. This is the down-direction of the invertibility taxonomy applied
*temporally*: a write is admissible only when its backward projection to every still-living reader is
lossless (or no such reader exists). It's a correctness barrier, not a policy convenience — emitting
richer-only data during the window would owe a lossy down-projection to a flat reader and corrupt it.
**LANDED:** `src/Core/EvolutionWindow.fs` mechanizes exactly this — `mayExpandInto`/`guardExpandInto` over a
live-reader set; `readerLeaves` = contract.

**Reduction-side complement — the temporary GARBAGE DUMP for lossy removals (Aaron 2026-06-07).** The
expand-into gate covers the *expansion* side; reduction (a forward projection that REMOVES a relation) is
the dual, and it's where the lossy/non-invertible row of the taxonomy gets its concrete mechanism:

> *"when a forward projection removes a relation then you need a temporary garbage dump on the new schema to
> hold the lossy data in case a rollback is needed; it can be dropped after full migration including
> cleaning up the old schema."*

A `removeField`/relation-drop loses the removed data, so its down-migration can only restore a default
(lossy / "names the loss" — see `removeFieldMigration`). To make the removal **rollback-safe during the
window**, **stash the removed data in a temporary garbage dump on the new schema** instead of discarding it:

```
forward (reduce):  remove relation R  →  move R's data into the dump (don't discard)
rollback:          restore R from the dump  →  LOSSLESS rollback (not just a default)
GC the dump:       only after FULL migration + old-schema cleanup (the rollback horizon / contract-complete)
```

This is the taxonomy's *"lossy = invertible only if shadow/history is retained"* row made concrete: **the
dump IS the retained shadow.** It upgrades a lossy removal to an effectively-lossless rollback *for the
duration of the window*, then GCs once rollback is no longer possible/needed — the **same contract-complete
horizon** the `EvolutionWindow` already tracks (so dump-GC and expand-into-enable fire at the same gate).
Cheap on the COW/content-addressed store (the dump is content-addressed side state, dedup'd, dropped by
forgetting a root). Implementation sketch: a `removeFieldMigration` variant that stashes the removed value
under a reserved dump key and whose `Down` restores from the dump (real value, not default) while the dump
lives — turning the only non-invertible primitive op into a window-scoped lossless one. **LANDED:**
`SchemaEvolution.removeFieldWithDumpMigration` + `stashToDump`/`restoreFromDump`/`dropDump` (position-exact,
FsCheck-proven `down∘up = id`). Together: **expand is gated on contract; reduce is made reversible by a
contract-scoped dump — full bidirectional safety.**

**The continuous-merge-to-dump + BRANCHLESS null-writer + two-phase cleanup (Aaron 2026-06-07).** The piece
that wires the dump into the *parallel-timeline merge contract* (§2) and makes the write path
shader-portable:

1. **The merge contract dual-writes to the dump.** While the new branch's continual merge flows to main, it
   must *also* merge the extra (removed/lossy) data **into the garbage dump**, until the original code is
   removed — so rollback always has the shadow. Cleanup order: **remove OG code → remove dump → remove the
   dump-writing code.**
2. **Branchless null-writer instead of `IF dump_exists`** (Aaron's branchless/shader discipline —
   [[feedback-aaron-avoid-if-branchless]]): do NOT write `if dump exists then write_extra`. Always write to
   the **dump address**; when the dump is gone, that **address forwards to a null writer** (a no-op sink).
   No branch → **uniform control flow → runs in shaders / SIMD / GPU** (no divergent warps, no pipeline
   stalls). The null writer is the *identity sink* — write semantics are identical regardless of
   destination, which also makes the write trivially formally-verifiable.
3. **Cleanup = one atomic address repoint**, not a code change: `dump_address → null_writer`. The
   application layer is unaware; orphaned writes are safely absorbed (no leak, no unbounded growth).
4. **Two-phase cleanup (safety now, zero overhead later):**
   - *Phase 1* — repoint `dump_address → null_writer`: instant, zero-downtime; rollback still possible until
     verified.
   - *Phase 2* — after migration is verified, **dead-code-eliminate the write entirely** (the no-op was a
     temporary safety mechanism; DCE turns it into permanent zero-overhead, back to the pre-migration
     baseline).

Net: the temporary rollback-safety mechanism is **branchless while live** (shader-portable) and **gone
after verification** (zero residual cost). This is a *write-path / store* concern — it lands with the COW
store + merge engine (`081KTGTJC1Q`), not in the pure `SchemaEvolution` algebra (which is already done).
Model now: a `Writer` abstraction with a redirectable address + a null-writer identity sink (branchless).

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
SchemaEvolution.fs`, 081KSRGFP0008QG0R001Y6RTY9). The capability described here is the **`SchemaEvolution`/Evolution family**
extended (down + bidirectional backfill, parallel experiment-timelines, reindex-as-projection) — keep using
the existing `SchemaEvolution`/Evolution naming, don't coin a new one. (If a broader umbrella name is ever
wanted for §2/§3, that would go through `naming-expert` + Ilyana — but the schema-proof core keeps its name.
Beacon caveat for any external use: "schema evolution" is also Avro/Protobuf's generic term.)

## Hype-peel (honest status)

The **math core (DBSP incremental view maintenance) ships**; everything else here — root-pointer rollout,
parallel experiment branches, the ExperimentContract, the schema-evolution proof discharge, the
full==incremental reindex proof for a concrete index, the outbox/saga boundary — is **designed/captured,
not built**, and sits on `081KTGTJC1Q` (the COW store) + the determinism work (081KT07NV0008QG0R001YDB73K / `081KTGEVV75`).
Strong endgame; the foundation is real, the product is not yet.

## Ties

- DBSP (`src/Core` circuit/stream, `IndexedZSet`, `Aggregate`, `Residuated`) — the full==incremental engine ·
  Z-set retraction (reversible deltas) · `081KSGS9H0008QG0R000Q18PGQ` (schemas-as-rows, fork-as-trust-boundary) · `081KTGTJC1Q`
  (COW Merkle-DAG store) · `081KTGXPTQ` (COW testing) · `2026-06-07-ddl-as-branchable-canary-...` (the DDL
  half) · app/plugin/schema-as-DynamicValue · 081KT07NV0008QG0R001YDB73K + `081KTGEVV75` (determinism) · the formal portfolio
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
