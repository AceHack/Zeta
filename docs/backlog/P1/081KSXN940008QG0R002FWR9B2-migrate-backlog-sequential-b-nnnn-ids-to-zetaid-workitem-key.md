---
id: 081KSXN940008QG0R002FWR9B2
title: Migrate work-items to ZetaId WorkItem keys (conflict-free, no cross-agent ID consensus) — type ∈ {task, bug}; backlog is a STATE, not a type
status: closed
priority: P1
created: 2026-05-31
attribution: aaron-otto-2026-05-31
last_updated: 2026-07-03
closed: 2026-07-03
closed_by: "#9291"
decomposition: umbrella
depends_on:
  - 081KSXN940008QG0R00171YAZW
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSE6WT0008QG0R0008483B2
  - 081KSNY2Z0008QG0R000E5KTPX
  - 081KQ8P5D0008QG0R001BH93SA
  - 081KSXN940008QG0R002KEJ7C2
tags:
  - work-item
  - zeta-id
  - g-set-crdt
  - z-set
  - conflict-free-id
  - multi-agent
  - scaling
  - no-consensus
  - git-native
  - observability
  - dora
  - umbrella
---

# 081KSXN940008QG0R002FWR9B2 — Work-items → ZetaId WorkItem keys (conflict-free, no consensus)

> **Progress 2026-07-03 (#9291):** work-item **event G-Set** slices 1–3 landed —
> `created` / `state-changed` / `closed` events, open-backlog Z-set fold,
> `--push` direct-to-main, DORA Bag-folds (`dora-metrics.ts`). Agent rule
> `.claude/rules/workitems-mint-with-zetaid.md` retires `otto-channels`
> B-NNNN allocation for new work-items. **Umbrella stays open** for optional
> dashboard wiring + full acceptance bookkeeping.

> **Progress 2026-06-21 (#8948 merged):** the **backlog shard** slice is complete —
> all `docs/backlog/*` rows use zetaid-only `id:` frontmatter; repo-wide prose refs
> migrated; `lint-no-b-refs` + `lint-no-new-bnnnn` gate the surface; migration scripts
> retired; ~1,251 frozen aliases in `b-to-zetaid-map.json`. **This umbrella stays open**
> for the work-item **event G-Set**, lifecycle state machine, and DORA Bag-folds (below).

> **Product-team design review (2026-06-06):** the design memo this umbrella asks for is
> [`docs/research/2026-06-06-product-team-review-b0956-backlog-to-zetaid-workitem-migration-pm2-ilyana-rodney-otto.md`](../../research/2026-06-06-product-team-review-b0956-backlog-to-zetaid-workitem-migration-pm2-ilyana-rodney-otto.md).
> Unanimous: **incremental alias-and-keep, NOT big-bang**; first slice = mint tool + frontmatter-lint +
> ref-integrity-lint (zero row changes). Blocker found: **081KS3X9Y0008QG0R000W00V73 (ZetaId string encoding) must lock first**
> (promote P2→P1) — must be **filename-safe AND sort-preserving** (time high-bits → lexicographic sort =
> chronological). **Filename shape DECIDED (Aaron 2026-06-06, the 500-agent collision test): option A —
> `workitems/<zetaid>-<description>.md`** (ZetaId PREFIX = conflict-free + time-sortable key; description
> suffix = human-readable). A slug-only filename would collide across concurrent agents (slug = a hidden
> consensus point); the ZetaId prefix makes files disjoint (the 081KSXN940008QG0R00171YAZW G-Set property) and chronologically
> sortable. Lookups/cross-refs key on the ZetaId-prefix glob (`<zetaid>-*.md`), so reword is safe. Root
> cause of the chronic `backlog-index-integrity` red also found there (081KT7YW00008QG0R002T1XNWT has no frontmatter; 081KR50HA0008QG0R0002PGV1N
> id mismatch).

## Problem (the does-not-scale pain, operator-named 2026-05-31)

> Aaron: *"do we have a backlog migration row to workitems with zeta ids ... so you don't
> have to fumble over ID consensus across agents that does not scale"*

Allocating a sequential **`B-NNNN`** id requires **cross-agent consensus**: check the
highest id on `origin/main` **and** scan in-flight PRs for the next free number, and hope
no peer grabs it first (the
[`otto-channels-reference-card.md`](../../../.claude/rules/otto-channels-reference-card.md)
ID-allocation discipline + the empirical 081KRFA460008QG0R002DG8KPZ/081KRFA460008QG0R001QFS6EV collision). With N concurrent agents
this is a coordination bottleneck + collision source — it **does not scale**.

**Empirical anchor (this session):** filing 081KSXN940008QG0R002KEJ7C2 required exactly that dance. That's the
cost this row removes.

## Prior art — an incrementing ID is a hidden consensus (operator 2026-05-31)

> Aaron: *"incrementing IDs are a hidden consensus most don't think of unless you are
> designing a sharded database — which we are lol"*

A monotonic/auto-increment id (`B-NNNN`, SQL `AUTO_INCREMENT`, Postgres `SERIAL`) needs a
**single source of truth for "the next number"** — that source IS a consensus point. It's
invisible at one node and becomes the bottleneck the moment you shard, which is the classic
reason sharded databases abandon auto-increment PKs for **locally-mintable, conflict-free
ids**: UUID(v4/v7), Twitter **Snowflake**, **ULID**, KSUID, Mongo ObjectId. Each encodes
time/shard/random so every shard mints unique ids with **zero coordination**.

**Zeta IS that sharded database:** agents/machines are the shards, git is the
replication-log, the append-only event G-Set is the log, folds are the materialized views —
and the **ZetaId is our distributed primary key** (128-bit, category-tagged, crypto-minted
locally). So `B-NNNN → ZetaId WorkItem` is not a novel move; it is the **auto-increment-PK →
distributed-ID migration every sharded system does**, applied to our work-item table.

## The model (operator correction 2026-05-31 — type vs state)

> Aaron: *"backlog is a state of a workitem not it's type — types are tasks and bugs"*

A **work-item** has:

- an **identity** — today `B-NNNN` (consensus-allocated); → a `Category.WorkItem` **ZetaId**
  (crypto-minted, conflict-free, no consensus).
- a **type** (kind) — **`task` | `bug`** (the `WorkItem: 8` comment: *"tasks + bugs"*); the
  type does not change over the item's life.
- a **state** (lifecycle) — **`backlog` | `in-progress` | `done` | `closed` | …**.
  **"Backlog" is a STATE** (the queued/open state), *not* a type and *not* the entity. The
  thing we migrate is the **work-item identity**; "the backlog" is a *view* of items whose
  state is open.

## Where work-items sit in the G-Set / Bag / Z-set / DORA ladder

Same substrate as the bus (081KSXN940008QG0R00171YAZW) + the git-native LGTM observability (event-sourced-obs
ADR addendum, #6289). The four rungs map cleanly:

| Layer | What | Algebra |
|---|---|---|
| **Work-item events** (created / typed / state-changed / closed) | ZetaId-keyed, append-only event files | **G-Set** (base; events never deleted — like the bus) |
| **A work-item's current state** | fold of its own events → current `{type, state, …}` | a **fold** over the G-Set |
| **"The backlog"** (open items) | items netted to an open state: `created − closed/superseded` | **Z-set view** (add = +1, close/retract = −1; the net is "open") — a *state-filter*, not a type; same shape as Ace deps |
| **Metrics / DORA** (open bugs, tasks closed/week, lead-time, MTTR) | count/aggregate folds over the events | **Bag-folds** (the "M"imir of the git-native LGTM) |

So:

- the **backlog is a Z-set view** (a fold filtered to open state), not a stored list and
  not a type;
- **type (task/bug)** is a field on the item, set at creation;
- **DORA observability** (lead time = fold over `created→done` timestamps; throughput =
  Bag-count by state/type) rides the *same* event G-Set — work-items feed the metrics layer
  the git-native LGTM addendum (#6289) describes, no separate store.

This is the unifying point: **bus, Ace, work-items, and observability are all folds over
one git-native ZetaId-keyed event substrate** — G-Set base, Z-set/Bag views.

## What already exists (verify-existing-substrate)

- `Category.WorkItem = 8` — reserved ZetaId category (comment: *"tasks + bugs; B-xxxxx →
  ZetaId migration"*). Design intent in the type; no row owned the migration until this one.
- **081KSXN940008QG0R00171YAZW** (agent-bus, landed #6283) — the proven git-native ZetaId G-Set the work-item
  event store mirrors (disjoint files, no-PR, conflict-free, cross-machine).
- **081KSKBP80008QG0R000B3Y19A** (workflow-engine v1) — work-items are its lifecycle objects (the state machine).
- **081KSE6WT0008QG0R0008483B2** (git-native event store) + **081KSNY2Z0008QG0R000E5KTPX** (folders-on-main, no-PR) — substrate + transport.
- **081KQ8P5D0008QG0R001BH93SA** (monolith→per-row backlog migration) — backlog-representation-migration precedent.
- **#6289** (event-sourced-observability ADR + git-native LGTM addendum) — the Bag/DORA layer.

## Design questions (umbrella sub-targets)

1. **Identity + human-readability.** ZetaId is the conflict-free identity; keep a human
   **slug + title** alongside (ZetaId not memorable). Filename shape TBD
   (`workitems/<zetaid>.md` + slug index? `<slug>.<zetaid-short>.md`?).
2. **type / state as first-class fields** — `type: task|bug`, `state: backlog|in-progress|
   done|closed`; the lifecycle is the 081KSKBP80008QG0R000B3Y19A state machine; "backlog" = a `state` value.
3. **Cross-references.** `depends_on`/`composes_with` move from `B-NNNN` to ZetaId or stable slug.
4. **Backward-compat.** ~950 existing `B-NNNN` rows: **alias-and-keep** (new items ZetaId-keyed,
   legacy keep `B-NNNN` as their stable slug) — low-risk, incremental, not big-bang.
5. **Index + views.** `BACKLOG.md` (and a per-state view, since backlog is just `state=open`)
   regenerate from the new shape.
6. **Consensus-free mint.** `bun tools/backlog/new-workitem.ts` mints a `Category.WorkItem`
   ZetaId **locally** — no `origin/main` check, no PR scan. (Node-safe per 081KSXN940008QG0R002KEJ7C2 / ADR v6.)

## Acceptance

- [x] Existing `B-NNNN` backlog rows migrated to zetaid keys (#8948; frozen alias map for history).
- [x] New work-items get a `Category.WorkItem` ZetaId minted **locally, no consensus** (#9214–#9291; `new-workitem.ts` + CI wall).
- [x] `type ∈ {task, bug}` and `state ∈ {backlog, in-progress, done, closed, …}` are
      first-class; **"backlog" is a state value**, derivable as a Z-set view (#9263 `open-backlog.ts`).
- [x] Disjoint-id files never collide across concurrent agents (G-Set property; crypto-minted event ids).
- [x] Metrics/DORA are Bag-folds over the work-item event G-Set (no separate store; #9291 `dora-fold.ts`).
- [x] Cross-references in backlog shard use zetaids (#8948).
- [x] The `otto-channels` ID-allocation consensus discipline is retired for work-items (rule + `AGENTS.md` + CI).

## Substrate-honest framing

**Umbrella** — file the design memo (schema + type/state fields + readability + backward-
compat) first; route the schema through the product-team agreement before any bulk
migration. Low-risk path: **new items ZetaId-keyed now (consensus-free), legacy B-NNNN
aliased**. Mirrors the agent-bus (081KSXN940008QG0R00171YAZW); the lifecycle is the workflow engine (081KSKBP80008QG0R000B3Y19A);
metrics ride the git-native LGTM (#6289).

## Composes with

- 081KSXN940008QG0R00171YAZW (agent-bus) — the proven git-native ZetaId G-Set the work-item store mirrors
- 081KSKBP80008QG0R000B3Y19A (workflow engine) — the state machine work-items live in (state = lifecycle)
- 081KSE6WT0008QG0R0008483B2 (git-native event store) + 081KSNY2Z0008QG0R000E5KTPX (folders-on-main, no-PR) — substrate + transport
- #6289 (event-sourced-observability + git-native LGTM) — DORA/metrics as Bag-folds
- 081KQ8P5D0008QG0R001BH93SA (monolith→per-row migration) — backlog-representation precedent
- 081KSXN940008QG0R002KEJ7C2 (Bun→Node migration) — the mint tool is Node-safe per the same ADR v6
- `Category.WorkItem = 8` (`src/Core.TypeScript/zeta-id/types.ts`) — the reserved slot
- `.claude/rules/otto-channels-reference-card.md` — the ID-allocation consensus this removes
