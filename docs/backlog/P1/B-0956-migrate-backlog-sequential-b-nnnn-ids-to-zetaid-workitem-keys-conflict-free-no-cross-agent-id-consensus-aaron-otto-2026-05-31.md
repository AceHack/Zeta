---
id: B-0956
zetaid: 081KSXN940008QG0R002FWR9B2
title: Migrate work-items to ZetaId WorkItem keys (conflict-free, no cross-agent ID consensus) — type ∈ {task, bug}; backlog is a STATE, not a type
status: open
priority: P1
created: 2026-05-31
attribution: aaron-otto-2026-05-31
last_updated: 2026-05-31
decomposition: umbrella
depends_on:
  - B-0954
composes_with:
  - B-0867
  - B-0773
  - B-0890.1
  - B-0061
  - B-0955
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

# B-0956 — Work-items → ZetaId WorkItem keys (conflict-free, no consensus)

> **Product-team design review (2026-06-06):** the design memo this umbrella asks for is
> [`docs/research/2026-06-06-product-team-review-b0956-backlog-to-zetaid-workitem-migration-pm2-ilyana-rodney-otto.md`](../../research/2026-06-06-product-team-review-b0956-backlog-to-zetaid-workitem-migration-pm2-ilyana-rodney-otto.md).
> Unanimous: **incremental alias-and-keep, NOT big-bang**; first slice = mint tool + frontmatter-lint +
> ref-integrity-lint (zero row changes). Blocker found: **B-0682 (ZetaId string encoding) must lock first**
> (promote P2→P1) — must be **filename-safe AND sort-preserving** (time high-bits → lexicographic sort =
> chronological). **Filename shape DECIDED (Aaron 2026-06-06, the 500-agent collision test): option A —
> `workitems/<zetaid>-<description>.md`** (ZetaId PREFIX = conflict-free + time-sortable key; description
> suffix = human-readable). A slug-only filename would collide across concurrent agents (slug = a hidden
> consensus point); the ZetaId prefix makes files disjoint (the B-0954 G-Set property) and chronologically
> sortable. Lookups/cross-refs key on the ZetaId-prefix glob (`<zetaid>-*.md`), so reword is safe. Root
> cause of the chronic `backlog-index-integrity` red also found there (B-1016 has no frontmatter; B-0366.2
> id mismatch).

## Problem (the does-not-scale pain, operator-named 2026-05-31)

> Aaron: *"do we have a backlog migration row to workitems with zeta ids ... so you don't
> have to fumble over ID consensus across agents that does not scale"*

Allocating a sequential **`B-NNNN`** id requires **cross-agent consensus**: check the
highest id on `origin/main` **and** scan in-flight PRs for the next free number, and hope
no peer grabs it first (the
[`otto-channels-reference-card.md`](../../../.claude/rules/otto-channels-reference-card.md)
ID-allocation discipline + the empirical B-0449/B-0450 collision). With N concurrent agents
this is a coordination bottleneck + collision source — it **does not scale**.

**Empirical anchor (this session):** filing B-0955 required exactly that dance. That's the
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

Same substrate as the bus (B-0954) + the git-native LGTM observability (event-sourced-obs
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
- **B-0954** (agent-bus, landed #6283) — the proven git-native ZetaId G-Set the work-item
  event store mirrors (disjoint files, no-PR, conflict-free, cross-machine).
- **B-0867** (workflow-engine v1) — work-items are its lifecycle objects (the state machine).
- **B-0773** (git-native event store) + **B-0890.1** (folders-on-main, no-PR) — substrate + transport.
- **B-0061** (monolith→per-row backlog migration) — backlog-representation-migration precedent.
- **#6289** (event-sourced-observability ADR + git-native LGTM addendum) — the Bag/DORA layer.

## Design questions (umbrella sub-targets)

1. **Identity + human-readability.** ZetaId is the conflict-free identity; keep a human
   **slug + title** alongside (ZetaId not memorable). Filename shape TBD
   (`workitems/<zetaid>.md` + slug index? `<slug>.<zetaid-short>.md`?).
2. **type / state as first-class fields** — `type: task|bug`, `state: backlog|in-progress|
   done|closed`; the lifecycle is the B-0867 state machine; "backlog" = a `state` value.
3. **Cross-references.** `depends_on`/`composes_with` move from `B-NNNN` to ZetaId or stable slug.
4. **Backward-compat.** ~950 existing `B-NNNN` rows: **alias-and-keep** (new items ZetaId-keyed,
   legacy keep `B-NNNN` as their stable slug) — low-risk, incremental, not big-bang.
5. **Index + views.** `BACKLOG.md` (and a per-state view, since backlog is just `state=open`)
   regenerate from the new shape.
6. **Consensus-free mint.** `bun tools/backlog/new-workitem.ts` mints a `Category.WorkItem`
   ZetaId **locally** — no `origin/main` check, no PR scan. (Node-safe per B-0955 / ADR v6.)

## Acceptance

- [ ] New work-items get a `Category.WorkItem` ZetaId minted **locally, no consensus**.
- [ ] `type ∈ {task, bug}` and `state ∈ {backlog, in-progress, done, closed, …}` are
      first-class; **"backlog" is a state value**, derivable as a Z-set view.
- [ ] Disjoint-id files never collide across concurrent agents (G-Set property).
- [ ] Metrics/DORA are Bag-folds over the work-item event G-Set (no separate store; reuses #6289).
- [ ] Existing `B-NNNN` rows keep working (alias-and-keep) — no lost rows.
- [ ] The `otto-channels` ID-allocation consensus discipline is retired for work-items.

## Substrate-honest framing

**Umbrella** — file the design memo (schema + type/state fields + readability + backward-
compat) first; route the schema through the product-team agreement before any bulk
migration. Low-risk path: **new items ZetaId-keyed now (consensus-free), legacy B-NNNN
aliased**. Mirrors the agent-bus (B-0954); the lifecycle is the workflow engine (B-0867);
metrics ride the git-native LGTM (#6289).

## Composes with

- B-0954 (agent-bus) — the proven git-native ZetaId G-Set the work-item store mirrors
- B-0867 (workflow engine) — the state machine work-items live in (state = lifecycle)
- B-0773 (git-native event store) + B-0890.1 (folders-on-main, no-PR) — substrate + transport
- #6289 (event-sourced-observability + git-native LGTM) — DORA/metrics as Bag-folds
- B-0061 (monolith→per-row migration) — backlog-representation precedent
- B-0955 (Bun→Node migration) — the mint tool is Node-safe per the same ADR v6
- `Category.WorkItem = 8` (`src/Core.TypeScript/zeta-id/types.ts`) — the reserved slot
- `.claude/rules/otto-channels-reference-card.md` — the ID-allocation consensus this removes
