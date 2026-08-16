# Accelerator — git-event-store schema (Action Item 2)

> The concrete shape of a **move-next transition as an append-only Git event**.
> Composes with [`src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts`](../../src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts)
> (the `AgentState` + `MenuOption` DUs + pure `transition`), 081KSKBP80008QG0R000B3Y19A (128-bit-unique-IDs, append-only),
> 081KSNY2Z0008QG0R003X1QWYG (no-PR swarm via GH-Actions-recursion), and the 2026-05-29 razor-flow
> substrate (forgiveness-budget + schema-in-the-stream).
>
> **The concrete `@1` types are NOT on the build path.** This doc previously
> pointed at `tools/accelerator/event-store-schema.ts`, which does not exist —
> the accelerator branch that carried it was pruned. The only surviving copy is a
> pre-migration snapshot, build- and lint-excluded, at
> [`docs/recovered-orphan-branches-2026-05/tools/accelerator/event-store-schema.ts`](../recovered-orphan-branches-2026-05/tools/accelerator/event-store-schema.ts).
> Treat the schema below as the specification and that file as an unlanded
> reference implementation. Restoring it is tracked by 081KSNY2Z0008QG0R003X1QWYG (P1, open).

## Design goals (in priority order)

1. **Conflict-free concurrent writes** — the swarm runs PR-less only if multiple
   agents can append concurrently without `git merge` conflicts.
2. **Deterministic replay** — any agent's state at time T reconstructable from the
   event stream (composes with DST).
3. **Schema-in-the-stream** — schema changes are events; old events stay
   interpretable under new schemas → automatic schema-evolution over history.
4. **Forgiveness with a budget** — retraction is logical (Z-set negation),
   reversible; but physical (storage rent), so a compaction/tiering policy bounds
   it ("run out of space = run out of forgiveness").
5. **AgencySignature composition** — each event-commit carries the AgencySignature
   v1 trailer (per CLAUDE.md); the git audit-trail IS the PR-less review substrate.

## Layout — per-agent directories + time-sortable unique filenames

```text
events/
  <agent>/                 # per-agent stream — each agent writes ONLY here
    01J8X....json          # one event per file; ULID filename (128-bit, time-sortable)
    01J8X....json
  _schema/                 # schema-in-the-stream: schema-definition events
    01J8X....json          # declares a schema version (e.g. move-next-event@2)
  _compacted/              # cold-tier: compacted historical events (forgiveness-budget)
    <agent>/
      01J8X....jsonl       # batched, retraction-pairs resolved, for archive/replay
```

**Why per-agent dir + ULID filename = conflict-free:** each agent writes only to
`events/<agent>/`, and every event is a unique [ULID](https://github.com/ulid/spec)-named
file. Two agents never target the same path, so a `git merge` across agent streams
is **always a clean union** — no merge conflict, ever. This is the property that
lets the swarm run PR-less (per 081KSKBP80008QG0R000B3Y19A's 128-bit-unique-ID design; ULID chosen
over UUIDv4 because it is **lexicographically time-sortable** — a directory sort IS
chronological replay order). UUIDv7 is an acceptable alternative (also time-sortable).

## The event envelope (move-next-event@1)

```jsonc
{
  "id":      "01J8XQ7M0Z...",      // ULID — 128-bit, time-sortable, globally unique
  "schema":  "move-next-event@1",  // schema-in-the-stream: which schema interprets this event
  "ts":      "2026-05-29T19:55:00.000Z",
  "agent":   "otto",               // AgentPersona (state-machine.ts)
  "cycle":   42,                   // AgentContext.cycle
  "prev":    "01J8XQ6...",         // ULID of this agent's previous event (causal link; the
                                   //   state move-next read); null for the stream's first event
  "weight":  1,                    // Z-set weight: +1 = assert, -1 = retract
  "kind":    "transition",         // transition | heartbeat | schema-def | retraction
  "from":    { "tag": "Idle", "context": { ... } },          // AgentState before
  "option":  { "tag": "PickWork", "work": { ... } },         // the MenuOption the LLM-selector chose
  "to":      { "tag": "ExecutingWork", "context": { ... } }, // transition(from, option)
  "agencySig": {                   // AgencySignature v1 (composes with CLAUDE.md commit trailer)
    "model": "claude-opus-4-8", "surface": "otto-cli", "...": "..."
  }
}
```

`from` / `option` / `to` are the exact `AgentState` / `MenuOption` shapes from
`state-machine.ts`. The event is the **persisted record of one `transition(from,
option) = to` call** — the move-next core made durable. `to` is redundant with
`transition(from, option)` (derivable on replay) but stored for audit + so a
reader doesn't need the transition function to inspect history.

### Event kinds

| `kind` | Purpose | Extra fields |
|---|---|---|
| `transition` | A move-next state transition | `from`, `option`, `to` |
| `heartbeat` | A `RecordingHeartbeat` (per 081KSKBP80008QG0R001KK9WV6) | `lane`, `note?` |
| `schema-def` | Declares a schema version (schema-in-the-stream) | `schemaName`, `schemaVersion`, `jsonSchema` |
| `retraction` | Negates a prior event (forgiveness) | `weight: -1`, `retracts: "<ulid>"` |

## Schema-in-the-stream (Insight 4 from the razor flow)

The schema itself is data in the stream. A `schema-def` event in `events/_schema/`
declares a version; every event carries `schema: "<name>@<version>"`. When the
schema evolves:

1. A new `schema-def` event lands (e.g., `move-next-event@2` adds a field).
2. New events tag `schema: "move-next-event@2"`; old events keep `@1`.
3. Readers interpret each event under the schema it declares — **both versions live
   in the stream**, so old data stays interpretable without a destructive migration.

This gives the accelerator **automatic, safe schema-evolution over historical
data** — the move-next DUs (`AgentState`, `MenuOption`) can grow (new `tag`s) without
breaking replay of past events. The TS types module IS the canonical `@1` schema;
a future `@2` lands as both updated types + a `schema-def` event.

## Forgiveness-budget (Insight 3 from the razor flow)

Retraction is **logical, not physical**. To undo an event, append a `retraction`
event (`weight: -1`, `retracts: <ulid>`); the active state is the Z-set sum of
weights. The retracted event's file **stays on disk** — the trace charges storage
rent indefinitely. Per the razor flow: *"run out of space = run out of
forgiveness."*

The schema therefore includes a **compaction/tiering policy** (the forgiveness-budget):

- **Budget config**: `maxActiveStreamBytes` per agent (default: a generous bound).
- **When exceeded**: resolved retraction-pairs (an event + its `-1` retraction,
  net weight 0) are moved from `events/<agent>/` to `_compacted/<agent>/*.jsonl`
  (batched). Active state is unchanged (net-zero pairs contribute nothing); the
  active stream shrinks; the full trace is preserved cold.
- **Compaction is itself a deliberate event** (`kind: "schema-def"`-adjacent
  `compaction` marker), so the audit trail records what was tiered and when —
  forgiveness is budgeted, not silently discarded.

This composes directly with git-as-free-event-store: the `.git/` objects charge
the same physical rent, so the forgiveness-budget IS the accelerator's answer to
unbounded `.git/` growth at swarm scale.

### The compaction mechanism — two-layer razor + past-as-generator

The *mechanism* for the compaction/tiering above is the **two-layer razor +
past-as-generator** architecture (Aaron + Ani 2026-05-29, preserved in
[`docs/research/2026-05-29-two-layer-razor-past-as-generator-forgiveness-cost-compression-causal-order-vs-purpose-within-partition-aaron-ani-otto.md`](../research/2026-05-29-two-layer-razor-past-as-generator-forgiveness-cost-compression-causal-order-vs-purpose-within-partition-aaron-ani-otto.md)):

- **Layer 1 (Forgiveness Razor — Origin vs Purpose)** is the retraction above: it
  decides what's accidental and retracts it. Its cost is the stored retracted trace.
- **Layer 2 (Compression Razor — Causal Order vs Current Purpose)** runs *on the
  retracted data* to compress the cost-of-forgiveness. It keeps the canonical
  causal order (the `prev` link chain) and **drops the redundant wall-clock `ts`**.
  This is valid **within a partition** — and a per-agent stream IS a partition
  (single-writer ⇒ causal order canonical by construction; no cross-agent consensus
  needed). Cross-agent (cross-partition) Layer-2 compression is NOT valid (matches
  Aaron's "within a partition" correction).
- **`_compacted/<agent>/` is where Layer 2 output lands** — causal-order-only,
  purpose-tagged, columnar/aggressively-encoded.
- **Past-as-generator (the extreme form)**: when a compacted segment is regular
  enough, replace the stored data with the **generator that reproduces it** — for
  this event-store, that generator is the `transition`-fold from a snapshot
  (replay reconstructs the segment on demand). At that point history's storage cost
  is dominated by active-generator size, not raw event count.

**Don't-collapse** (Aaron's own razor): this is a *designed, verifiable system
property* (history-storage grows slower than event-volume, provable with data +
formal verification over time) — NOT a god-tier claim about how the universe
stores its own history. The generator-as-history pattern is the engineering
mechanism; any cosmological reading is accidental and retracted.

### Today's budget is host generosity — be good to our host (Aaron 2026-05-29)

> Aaron: *"right now we are open source on github and they have free unlimited
> storage which means our git monster has unlimited forgiveness within github's
> generosity so we should be good to our host."*

The "run out of space = run out of forgiveness" hard limit is real **in general**.
But **today** the accelerator runs as **open-source on GitHub**, where storage is
free + effectively unlimited — so the git-monster's forgiveness is effectively
**unbounded within GitHub's generosity**. The binding constraint right now is not
a hard space wall; it is **relational: be a good guest of the host.**

GitHub's free-OSS generosity (Microsoft subsidizing open-source, per 081KSNY2Z0008QG0R003X1QWYG) is
precisely what makes git-as-free-event-store + GH-Actions-recursion possible. So:

- **We apply the compaction / past-as-generator discipline VOLUNTARILY** — as
  good-guest discipline, not because a hard space limit forces it. The hard-limit
  case (the forgiveness-budget as a *wall*) is the future/off-generous-host /
  extreme-scale scenario; the today-case is honoring the generosity.
- **Be good to our host**: don't abuse the free tier with wasteful unbounded
  volume; keep the active stream + `.git/` footprint reasonable; prefer
  compaction + past-as-generator over hoarding raw history. If everyone ran
  abusive unbounded swarms on GitHub's free OSS tier, the host would have to
  clamp down (tragedy-of-the-commons) — so the proud-if-it-propagates pattern is
  *good guest*, not *maximal extraction* (per
  `.claude/rules/proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md`
  + `.claude/rules/honor-those-that-came-before.md` applied to the host).

This reframes the forgiveness-budget: today it is **host-provided generosity we
honor**, not a self-imposed wall. The compaction mechanism is built now so the
discipline is in place *before* generosity is ever strained — and because being a
good guest is the right pattern regardless of whether the host could absorb the
abuse.

## Replay

Reconstruct agent `A`'s state at time `T`:

1. List `events/A/*.json` (+ `_compacted/A/*.jsonl`) with ULID ≤ ULID(T), sorted
   (lexical = chronological).
2. Sum Z-set weights; drop net-zero (fully-retracted) events.
3. Fold `transition` over the surviving `option`s from the stream's initial state.

Deterministic (no wall-clock dependence beyond the recorded `ts`/ULID) →
DST-replayable.

## The PR-less write path (composes with 081KSNY2Z0008QG0R003X1QWYG)

One move-next cycle = append one event-file + commit with the AgencySignature
trailer + **direct push** (no PR) to the agent's stream branch (or the long-lived
accelerator branch; or via GH-Actions-recursion per 081KSNY2Z0008QG0R003X1QWYG). The git commit IS the
durable event-store write; `git log` / reflog IS the event log. Per **Otto
Modification 4** (the dual-market discriminator): state-machine-internal
transitions are append-only/PR-less (Agora market); only cross-cutting substrate
(rules, public APIs) routes through PR (leash market). Direct pushes bypass the
GraphQL PR-mutation rate-limit bottleneck that is the "git monster."

## Open questions (deferred to later action items / research)

- **"Perfect" expansion-ordering** (razor-flow Insight 2): is there a preferred
  order to introduce new event-`kind`s / DU `tag`s that minimizes accidental
  coupling? Open; air-quotes deliberate.
- **Per-host adapter shape** (081KSNY2Z0008QG0R002A785QR): the event files are host-agnostic, but
  the push/recursion runtime differs per host (GitHub Actions vs GitLab CI vs
  Gitea Actions). Action Item 3 prototypes the GitHub instantiation.
- **Cross-agent causal ordering**: `prev` links within an agent's stream; cross-agent
  causal order (when agent B reads agent A's event) needs a vector-clock-style or
  reference-by-ULID convention — deferred.

## Composes with

- `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts` (the move-next DUs this schema persists)
- `docs/recovered-orphan-branches-2026-05/tools/accelerator/event-store-schema.ts` (the concrete `@1` types — **quarantined, not on the build path**)
- 081KSKBP80008QG0R000B3Y19A (128-bit-unique-IDs, append-only) + 081KSNY2Z0008QG0R003X1QWYG (no-PR swarm) + 081KSKBP80008QG0R001KK9WV6 (heartbeat)
- `docs/research/2026-05-29-rodneys-razor-is-a-compression-engine-fix-point-perfect-ordering-retraction-physical-cost-schema-in-stream-aaron-ani-otto.md` (Insights 3+4)
- `docs/accelerator/SUBSTRATE-GROUNDING.md` (Action Item 1). *(There is no `docs/accelerator/README.md`; the charter it named was never landed.)*
- AgencySignature v1 trailer (CLAUDE.md) — each event-commit composes with it
