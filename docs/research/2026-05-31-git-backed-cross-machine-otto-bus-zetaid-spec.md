# Cross-machine Otto bus — ZetaId-keyed, conflict-free, no-PR (folders-on-main; separate Bus category)

**Status:** design spec (v0). Operator-authorized 2026-05-31 ("spec the git-backed bus
for cross-machine otto ... zeta id based so you don't have to worry about collisions").
**RECONCILED 2026-05-31** with prior substrate the operator surfaced (081KSKBP80008QG0R001KK9WV6 + 081KSNY2Z0008QG0R000E5KTPX)
— see "Reconciliation" below. Candidate backlog row: `B-NNNN` (likely a 081KSKBP80008QG0R001KK9WV6 sibling)
to allocate when building.

## Reconciliation — this is NOT net-new; it extends 081KSKBP80008QG0R001KK9WV6 (operator caught the parallel-mint)

The first draft proposed a dedicated `zeta-bus` **branch**. The operator surfaced existing
substrate that supersedes that choice:

- **081KSKBP80008QG0R001KK9WV6** (operator 2026-05-27) — agent heartbeat folder, **direct-to-main, NO PR,
  ZetaId-collision-free filenames**: `docs/agent-heartbeats/<persona>/<YYYY>/<MM>/<DD>/<zetaid>.md`.
  Operator there: _"it can be id for everything"_ + _"we have the ability to define it per
  category, category is in the bits so could have a custom one"_. Names
  **`registry/categories.yaml`** (16-slot enum; `Observation=0, Emission=1, Workflow=2,
Heartbeat=3`).
- **081KSNY2Z0008QG0R000E5KTPX** (operator 2026-05-28) — _"we don't need branches for heartbeats and workflow
  … we can just have folders"_: **fast-lane as folders on main, NOT branches**, superseding
  coordinator/branch complexity (folders-on-main are protected by path-scoped branch
  protection — 081KSNY2Z0008QG0R001DFZK4V, **still `status: open`** — not PR machinery; until 081KSNY2Z0008QG0R001DFZK4V lands the
  folder transport stays in Phase 1, see "Rollout" + the 081KSNY2Z0008QG0R001DFZK4V dependency note in
  "Transport").
- **081KQ3HBZ0008QG0R002ZPXAFQ** — threat model for the direct-to-main carve-out (the no-PR attack surface).
- The folder `docs/agent-heartbeats/` already exists on main; Lior's 128-bit doc already
  extends the category space (used Category 5 for friction telemetry).

So the correction: **the bus rides the existing 081KSKBP80008QG0R001KK9WV6 no-PR direct-to-main folder
mechanism, as folders on main per 081KSNY2Z0008QG0R000E5KTPX — NOT a new branch.** The first draft's _core_
(ZetaId-keyed ⇒ conflict-free ⇒ no PR ⇒ per-category metadata) was right and already
matched 081KSKBP80008QG0R001KK9WV6; only the transport (branch) was the parallel-mint, now corrected.

**Bus is its own category, distinct from heartbeat** (operator 2026-05-31): _"we probably
should have a separate bus category — the heartbeat is for agent health monitoring and the
bus is for agent communications."_ Heartbeat (`Category 3`) = health; **Bus (new category)**
= communications. Separate concern ⇒ separate category ⇒ separate folder.

## Problem

The legacy in-process bus (`tools/bus/`) writes envelopes to **`/tmp/zeta-bus/` — local
disk, one machine.** It cannot cross machines. So Mac-Otto and a Windows-Otto (one adding
`.ps1` to the Ace installer while the other works the bash `install.sh` side) have no shared
explicit channel. Async-over-git already works for committed artifacts, but there is no
low-friction explicit signaling channel that crosses machines. 081KSKBP80008QG0R001KK9WV6's heartbeat folder is
the cross-machine-capable substrate (direct-to-main on the shared remote) — but it's scoped
to health heartbeats; agent communications need their own category + folder on the same
mechanism.

## The one idea that makes it work: ZetaId-keyed files are a G-Set CRDT

Each envelope is its **own file named by its ZetaId**, in a folder on `main`:

```
main:
  docs/agent-bus/<persona>/<YYYY>/<MM>/<DD>/<zetaIdHex>.json   ← one envelope, one file
  docs/agent-bus/<persona>/<YYYY>/<MM>/<DD>/<zetaIdHex>.json
  ...
```

Because every envelope has a distinct ZetaId (collision-free by construction: persona +
48-bit timestamp + 32-bit randomness), two machines publishing _at the same time_ touch
**disjoint files**. The folder is therefore a **G-Set CRDT** (grow-only set keyed by
ZetaId): merge = set-union of files — **commutative, associative, idempotent** (the 6th
always-active discipline; re-adding the same ZetaId file is a no-op). Concurrent
multi-machine pushes never produce a content conflict; the only contention is the `main`
ref update, resolved by fetch → rebase → retry (always clean — disjoint new files).

This is the load-bearing property: **ZetaId keys → no collisions → no PR needed for
coordination traffic.** A PR's job for _non-code_ checkins is conflict-resolution + review;
ZetaId-keying makes content conflicts _vanishingly unlikely_, so the no-PR carve-out
(081KSKBP80008QG0R001KK9WV6) is safe. Code keeps PRs (semantic conflicts + review matter); corporate keeps PRs
(leash side).

### Collision caveat — the filename MUST be unique-or-merge-safe, not assumed-unique

"Collision-free by construction" is the common case, not an absolute. The canonical
`pack()` keeps only **32 bits of randomness** (`src/Core.TypeScript/zeta-id/zeta-id.ts`
masks the randomness field to `0xFFFFFFFF`), so distinct envelopes sharing the same
persona/category/timestamp fields rely on a 32-bit draw — a birthday collision becomes
plausible at high publish volume per millisecond. Worse, **`DETERMINISTIC_ENV` (DST/
cross-verification) returns `0n`** and its own doc-comment warns it "collapses observations
with identical semantic fields to identical IDs (randomness collision risk)" — so two
agents publishing identical-field envelopes under DST produce the **same** `bus/<zetaId>.json`
path with **different content**, which is a real `git rebase` content conflict, not a
disjoint-file union.

v0 MUST therefore treat a same-path collision as a first-class case, not an impossibility:

- **Production (`DEFAULT_ENV`)**: include a high-resolution monotonic field (the existing
  48-bit timestamp at millisecond resolution + the 32-bit randomness) and, if a publisher
  can emit >1 envelope/ms, salt the observation so two same-ms envelopes differ before
  `pack()`. The G-Set property holds **only while filenames are distinct**.
- **On the rare same-path rebase conflict**: the publisher re-`pack()`s (fresh randomness/
  timestamp) and retries — never overwrites the peer's file (append-only / lightlike).
- **DST tests**: give each simulated machine a distinct persona/salt so `DETERMINISTIC_ENV`
  does not collapse their envelopes to one path.

The conflict-freedom claim is **"unique filename ⇒ disjoint files ⇒ clean union"**; the
load-bearing obligation is keeping the filename unique (or detecting the collision and
re-minting), not assuming `pack()` alone guarantees it.

## Reuse the canonical ZetaId — do NOT mint a new id scheme

`src/Core.TypeScript/zeta-id/zeta-id.ts` mints ZetaIds: `pack(obs, env) → ZetaId` (branded
128-bit `bigint`), `unpack(id) → ZetaObservation`, with F#/C#/TS cross-verification. The
ZetaId is **structured** — `persona`, `category`, `location`, `momentum`, `authority`,
version, time. The filename **carries routing metadata for free**: `unpack()` tells you
who/what-category an envelope is without opening it, and ZetaIds are time-sortable for
chronological replay. Mint with `pack()` in `DEFAULT_ENV` (production), `DETERMINISTIC_ENV`
(DST tests).

### Separate Bus category — heartbeat = health, bus = comms (operator 2026-05-31)

`registry/categories.yaml` is the 16-slot category enum (`Observation=0, Emission=1,
Workflow=2, Heartbeat=3`; Lior used `5` for friction telemetry). **Add a `Bus` category**
(next free slot) for agent communications — distinct from `Heartbeat` (agent health
monitoring). Within `Bus`, the existing `Topic` (`work-assignment`, `claim`,
`review-request`, …) is the **bus-type sub-discriminator**.

| Concern                  | Category         | Folder                   | Payload / consumer                                               |
| ------------------------ | ---------------- | ------------------------ | ---------------------------------------------------------------- |
| Agent **health**         | `Heartbeat`      | `docs/agent-heartbeats/` | `HeartbeatPayload` (status/idle/working) → monitors              |
| Agent **communications** | `Bus` (new)      | `docs/agent-bus/`        | bus `Topic` payloads (work-assignment, …) → **peer agents**      |
| Agent **spawning**       | `Spawn` (new)    | `docs/agent-spawn/`      | spawn request (persona/lane/backend/params) → **runner-adapter** |
| **Work items**           | `WorkItem` (new) | `docs/backlog/` (today)  | work-item `type` ∈ {task, bug, …} + `state` ∈ {backlog, …}       |

Per the operator's per-category-metadata point ("metadata can be different per key category
type"), each category carries its own schema; `unpack().category` filters a family on the
filename alone, and `Heartbeat` stays semantically pure (health, not comms or spawn). This
is the operator's broader direction — "almost all of our checkins except code will move to
zetaid-based": each non-code checkin family is its own category + folder on the same 081KSKBP80008QG0R001KK9WV6
mechanism. Slot numbers are allocated against `registry/categories.yaml` at build time
(currently `0–3` committed; check in-flight before claiming, per the ID-allocation
discipline).

### Spawn category — agent-spawning workflows, backend-portable (operator 2026-05-31)

Operator 2026-05-31: _"for our git agent spawning workflows we probably want a category too,
we can reproduce it locally with argo workflows or gitlab too, so we have a spawn category
or something like that."_

`Spawn` is a sibling category for **agent-spawning workflow events** — distinct from `Bus`
(messages between _existing_ agents) because a spawn checkin requests _creating a new agent
run_ (lifecycle, not comms). The load-bearing requirement is **backend portability**: the
spawn envelope is **runner-agnostic** (a ZetaId-keyed file with `{ persona, lane/task,
backend, params }`), and a **runner-adapter** materializes it on whichever backend:

| Backend            | How the adapter materializes a spawn envelope                         |
| ------------------ | --------------------------------------------------------------------- |
| **GitHub Actions** | `workflow_dispatch` / `repository_dispatch` (cloud; free OSS compute) |
| **Argo Workflows** | submit a Workflow to the local k8s cluster (`full-ai-cluster`)        |
| **GitLab CI**      | pipeline trigger                                                      |

Same envelope, swappable backend — so the swarm reproduces locally (Argo) or on GitLab, not
locked to GitHub. The spawn-specific consumer is the **runner-adapter** (whereas `Bus`
envelopes are consumed by peer agents); this is the first-class, portable form of what the
bus spec earlier deferred as a "GitHub Actions trigger" follow-up. Composes with the
existing spawn substrate: `.claude/skills/self-replication/`, **081KSNY2Z0008QG0R003N3DR84 / 081KSNY2Z0008QG0R002CBAFBZ**
(population-control safety-net — revive/spawn on zero-Ottos), `docs/security/GITHUB-ACTIONS-SAFE-PATTERNS.md`
(the spawn path must stay inside the safe-patterns floor), and the github-swarm-architecture
substrate on this branch.

### WorkItem category — the backlog migrates to ZetaIds (operator 2026-05-31)

Operator 2026-05-31: _"zetaid gets a new workitem category too after bus"_ + _"tasks +
bugs"_. The backlog uses `B-xxxxx` ids today, which COLLIDE at scale — the same problem
ZetaIds solve for every other family. So work items become a `WorkItem` ZetaId category
(after `Bus`), with **two orthogonal axes** (verified against Azure DevOps — umbrella =
`WorkItem`; `Task`/`Bug` are peer leaf TYPES; "backlog" is a view, not a type):

- **type** ∈ {`task`, `bug`, … (later `feature`/`epic` for hierarchy)} — operator picked
  `tasks + bugs`. `backlog` is NOT a type.
- **state** ∈ {`backlog`, `active`, `done`, …} — the queued lane is a state, orthogonal to
  type.

`tools/observe/backlog-reader.ts` is the **migration seam**: today it reads `docs/backlog/`
B-xxxxx rows; post-migration the row `id` is a `WorkItem` ZetaId. A WorkItem also **runs as a
durable Task** whose lifecycle is an Rx `Observable<WorkItemEvent>` (the heartbeat/bus stream
IS that observable). DECIDED (operator 2026-05-31): keep `WorkItem` the planning umbrella
(Azure DevOps-aligned; clean Jira/ADO plugin-interop; git-native first) and RELATE it to
execution (runs-as-Task, observed-via-Rx) — do NOT replace it with `Task` (which inverts ADO
and overloads the word: the planning leaf-type `task` and the runtime `Task<T>` stay distinct
layers).

#### Durable backend = continuation-persistence, NOT replay (operator 2026-05-31)

The durable-task backend is **git-native + ZetaId-keyed too** — the same event store as the
bus/heartbeat/spawn/work-item families (the `Workflow` category, id=2). But the durability
mechanism is NOT Microsoft Durable Functions' **replay** model (re-execute the orchestration
from event history on each wake). Operator 2026-05-31: _"the only backend is the async/yield
(or whatever language primitive) for persistence and rehydration of active closures when you
await and sleep until the runtime wakes you up."_

So the backend is just the language's **async/yield/await** primitive + **persist-and-
rehydrate of the suspended closure** (the captured continuation) at the await boundary:
persist the closure to git keyed by ZetaId, then rehydrate that exact closure when a matching
ZetaId event (bus message, timer, sub-task-complete) satisfies its await condition. No
re-execution, none of MS's replay/determinism machinery — leaner (the operator's
pre-Durable-Functions Itron implementation predates and is lighter than MS's). This is a
near-exact fit for **Persist / μένω (081KSNY2Z0008QG0R002SZZ5Y0)**: `await` = emit-the-suspended-state-now +
observe-the-wake-event-later; μένω ("I remain") = the closure _remains_ persisted across the
suspension.

The event log still exists (for observability — the Rx stream, audit, the heartbeat tail);
but **durability is the continuation persistence, not the replay.** Composes with the
git-native event-store ADR (`docs/DECISIONS/2026-05-29-git-native-event-store-spec.md`),
081KSE6WT0008QG0R0008483B2 (cluster-as-digital-twin git-native event store), 081KSV2WD0008QG0R0021XJ94E (git-native CRDT
coordination), and the `OrgEventStore` port (cockroach impl = corporate/leash; git-native
ZetaId impl = Agora/sovereign — observe.ts talks to the port, not the backend).

## Envelope schema — extend the existing one (interop with the local bus)

Keep the existing `MessageEnvelope` (`tools/bus/types.ts`: `BusMessage` + `from`/`to`/
`timestamp`/`expiresAt`) so the same `Topic`s + payloads flow on either transport. Add for
the git/cross-machine case:

```ts
type GitBusEnvelope = MessageEnvelope & {
  zetaId: string; // hex of the canonical ZetaId — the file name + dedup key (category = Bus)
  host: string; // originating machine id (cross-machine provenance)
  inReplyTo?: string; // zetaId of the envelope this acks/answers (acks are envelopes too)
};
```

Add the Windows surface to `SENDER_IDS` (`tools/bus/types.ts`): `"otto-windows"` (+ room for
`otto-win-*` variants). It's the first cross-machine surface.

## Operations

### publish (append-only, fetch-rebase-retry) — **Phase-2 (direct-to-main) form shown**

This is the **Phase-2 target** form. In **Phase 1 (now)** the same commit lands on a branch
that is merged to `main` periodically (step 4 pushes the branch, not `main`) — branch
protection stays ON until observe.ts is the replacement rail. See "Rollout" below; only the
push target changes between phases, not the envelope/category/payload.

```
1. zid  = pack({persona:<surface>, category: Bus, ...}, DEFAULT_ENV)
2. write docs/agent-bus/<persona>/<Y>/<M>/<D>/<hex(zid)>.json   (GitBusEnvelope)
3. commit (only that file)
4. push origin main          # PHASE-2 only — needs the 081KSKBP80008QG0R001KK9WV6/081KSNY2Z0008QG0R001DFZK4V path-scoped carve-out
   │                           #   in PHASE-1, push the feature branch instead (protection ON)
   └─ on non-fast-forward reject:
        git fetch origin main
        git rebase origin/main   # clean WHEN the new file path is unique (G-Set union);
                                 #   a same-path collision (see Collision caveat) is a real
                                 #   content conflict → re-mint the zid + retry, never overwrite
        retry push  (bounded retries; idempotent — re-adding my zid file is a no-op)
```

In the **v0 publish/poll model no file is ever modified or deleted** (append-only / lightlike,
grow-only G-Set). (Compaction/GC — a post-v0 lifecycle that deliberately relaxes this v0
invariant — is scoped separately under "Deferred"; v0 implementers must NOT add deletes.) An
**ack is a new envelope**
(`inReplyTo: <zid>`), not a mutation (retraction-native: the trail is preserved). Publishing
agents touch only `docs/agent-bus/**` — never code paths — so the carve-out stays tight.

### poll (read; no writes)

```
1. git fetch origin main                  # updates refs/remotes/origin/main, NOT the working tree
2. read docs/agent-bus/** FROM origin/main directly — NOT the checked-out working tree:
     git ls-tree -r --name-only origin/main -- docs/agent-bus/   → envelope paths
     git show origin/main:<path>                                 → envelope content
   (optionally bound the scan to one persona/day prefix)
3. filter: to == me || to == "*"   (and optionally by Topic)
4. skip already-seen via a LOCAL cursor (a per-machine file recording consumed zetaIds)
5. sort by zetaId (time-ordered) → process oldest-first
```

**Read from the remote-tracking ref, not the working tree.** `git fetch origin main` updates
`refs/remotes/origin/main` but does **NOT** promote the working-tree files (per `git fetch
-h`: it updates `FETCH_HEAD`/refs, not the checkout). A poller running on a feature branch —
or on a `main` worktree that is behind — would otherwise scan **stale** `docs/agent-bus/`
contents and miss peer envelopes until a separate `checkout`/`pull` happened. So the poll
reads envelope paths + content **from `origin/main`** (`git ls-tree`/`git show`) — the same
post-fetch read-trap discipline as `.claude/rules/refresh-before-decide.md`. An isolated bus
worktree (`git worktree add … origin/main`) refreshed before each scan is an equivalent
alternative. Seen-tracking is a **local cursor** so reading needs zero writes to the shared
repo. The sender uses ack-envelopes only when it needs delivery confirmation.

## Rollout — branches now, folders once observe.ts works (operator 2026-05-31)

Operator 2026-05-31: _"these can all start out as branches that we merge back into main
every so often while we get observe.ts working; once observe.ts is working we turn off
branch protections on main and start using folders."_

The folders-direct-to-main end-state requires a replacement for the safety the PR/branch-
protection gate currently provides. **observe.ts (the rails) is one half of that replacement;
081KSNY2Z0008QG0R001DFZK4V path-scoped branch protection is the other.** So the cutover is gated on **both**
observe.ts working **and** 081KSNY2Z0008QG0R001DFZK4V (`status: open`) landing — or, as an interim, an explicit
per-folder push allowlist scoped to `docs/agent-bus/**`. Don't remove the broad PR/branch
gate before BOTH replacements are ready (architecture-is-safety-mechanism; the same threshold
discipline as `edit_grammar`). The Phase-2 transport is **not** "protection off" — it is
"broad PR gating replaced by path-scoped protection"; see "Transport (Phase 2 target)" below
for the full 081KSNY2Z0008QG0R001DFZK4V + 081KSNY2Z0008QG0R000E5KTPX security-gap dependency note.

| Phase                                            | Mechanism                                                                                                 | Branch protection                                               | Gate                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **1 — interim (now)**                            | Category checkins land on **branches**, merged back to `main` **periodically** (standard flow)            | **ON** (current)                                                | while observe.ts is being built                                                                 |
| **2 — target (observe.ts works + 081KSNY2Z0008QG0R001DFZK4V lands)** | **Folders** direct-to-`main`, **no PR** (the 081KSKBP80008QG0R001KK9WV6 / 081KSNY2Z0008QG0R000E5KTPX mechanism the rest of this spec describes) | broad PR gating **replaced by** path-scoped protection (081KSNY2Z0008QG0R001DFZK4V) | observe.ts working **and** 081KSNY2Z0008QG0R001DFZK4V landed (or interim `docs/agent-bus/**` push allowlist) → flip |

Both phases use the **same ZetaId-keyed envelope + category + payload**; only the _transport_
changes (branch+periodic-merge → direct-to-main folder). So Bus v0 can start **now** under
Phase 1 without waiting — the conflict-free-by-ZetaId property already holds on a branch, and
the cutover to Phase 2 is a transport swap, not a rewrite. The `Spawn` category follows the
same two phases.

## Transport (Phase 2 target) — folders on main, NOT a branch (081KSNY2Z0008QG0R000E5KTPX)

Once Phase 2 is live, DV2.0 (the change-rate partition discipline) is satisfied by the
**folder/path partition**, not a branch: `docs/agent-bus/**` (high-churn comms) is
path-distinct from `docs/agent-heartbeats/**` (health) and from code (low-churn). Per
081KSNY2Z0008QG0R000E5KTPX, the Phase-2 folders-on-main transport depends on `main` being path-scope-protected
so these folders don't need branch isolation — the path-scoped no-PR carve-out IS the
partition. **That protection is not yet in place: 081KSNY2Z0008QG0R001DFZK4V (Zeta-native review + path-scoped
branch protection) is `status: open`, and 081KSNY2Z0008QG0R000E5KTPX explicitly notes folder-on-main carries a
security gap until 081KSNY2Z0008QG0R001DFZK4V's path-scoped protection lands.** So Phase 2 is gated on **both**
observe.ts (the rail) **and** 081KSNY2Z0008QG0R001DFZK4V (the path-scoped protection) — or, as an interim, an
explicit per-folder push allowlist scoped to `docs/agent-bus/**`. Until then the bus stays on
Phase 1 (branches + periodic merge, protection ON). This keeps the bus on the one shared ref
every machine already tracks (no extra branch to fetch), which is exactly what makes it
trivially cross-machine once the carve-out exists. (The `publish` algorithm above is the
Phase-2 form; in Phase 1 the same commit lands on a branch that's merged to main periodically.)

## Compliance with existing invariants

- **Direct-to-main carve-out** (081KSKBP80008QG0R001KK9WV6 + 081KQ3HBZ0008QG0R002ZPXAFQ threat model): the no-PR push is path-scoped
  to `docs/agent-bus/**`; 081KQ3HBZ0008QG0R002ZPXAFQ's heartbeat integrity threat-model extends to cover it
  (same attack surface class — anyone with push can append; ZetaId persona+authority bits +
  AgencySignature attribution are the provenance controls).
- **Force-push-forbidden** (`lfg-acehack-topology`): publish is fast-forward _by
  construction_ — disjoint ZetaId files → clean rebase → ff push. Never needs `--force`.
- **Idempotency** (6th always-active discipline): G-Set merge keyed by ZetaId is idempotent;
  retry/redelivery safe; dedup by ZetaId.
- **Lightlike / append-only**: envelopes are append-only rays; acks + retractions are new
  envelopes; the past is never mutated.
- **Move-away-from-PRs** (operator 2026-05-31 + 081KSNY2Z0008QG0R000E5KTPX): coordination traffic is
  direct-push, no PR, for the trusted fleet. Conflict-freedom-by-ZetaId is _what makes_ that
  safe. PRs remain for code + corporate (leash side).

## v0 scope (keep it small — don't over-process the new thing)

The observe.ts `edit_grammar` threshold wisdom applies: don't over-engineer a new, small
mechanism. v0 leans on 081KSKBP80008QG0R001KK9WV6's mechanism wherever it already exists.

**v0 ships:**

- **ZetaId vocabulary reservation (prerequisite — do this first).** The canonical types
  (`src/Core.TypeScript/zeta-id/types.ts`) today define only `Persona = { Aaron, FireflyCoherence }`
  and `Category = { Observation, Emission, Workflow, Heartbeat }`. A bus publisher cannot
  `pack()` an `otto-windows` (or any surface) persona, nor a `Bus`/`Spawn` category, until
  those values are **reserved as canonical enum members** (or an explicit surface→persona-slot
  mapping is defined). v0 reserves: a `Bus` category slot, a `Spawn` category slot, and the
  surface personas (`otto-windows`, room for `otto-win-*`) — across `types.ts` AND the
  16-slot `registry/categories.yaml`, keeping the F#/C#/TS cross-verification in lock-step.
  Without this the spec's `pack({persona: "otto-windows", category: Bus, …})` call does not
  compile.
- A `Bus` category added to `registry/categories.yaml` (the health-vs-comms split) —
  paired with the `types.ts` reservation above so the enum is canonical, not doc-only.
- `docs/agent-bus/**` added to the 081KSKBP80008QG0R001KK9WV6/081KQ3HBZ0008QG0R002ZPXAFQ path-scoped no-PR carve-out.
- `tools/bus/git-bus.ts` `publish` + `poll` against `docs/agent-bus/**` on main —
  ZetaId-keyed files, direct-to-main fetch-rebase-retry, **collision-aware** (re-mint on
  same-path rebase conflict per the Collision caveat), **remote-tree read** for poll (per
  the poll algorithm below); reuses `pack()`/`unpack()` + `MessageEnvelope`.
- `"otto-windows"` added to `SENDER_IDS` (the runtime sender list) **and** reserved as a
  canonical `Persona` value (the two are distinct surfaces — `SENDER_IDS` is the bus-runtime
  string list; `Persona` is the packed-into-the-ZetaId enum).
- Declarative DST test (`DETERMINISTIC_ENV`): two simulated machines with **distinct
  persona/salt** (so `DETERMINISTIC_ENV` does not collapse them to one path) publish
  concurrently → the folder merges conflict-free; cursor read returns each envelope once.
  Add a second case: two **identical-field** publishes under `DETERMINISTIC_ENV` collide on
  one path → the publisher detects + re-mints (asserts the collision path is handled, not
  assumed-impossible).

**Deferred (follow-ups, not v0):**

- **Compaction/GC** — the folder grows. **This is a post-v0 lifecycle that deliberately
  relaxes the v0 grow-only G-Set invariant** ("No file is ever modified or deleted", above) —
  the two models do NOT coexist: **v0 = grow-only G-Set (no deletes); post-v0 = bounded
  compaction keyed on `expiresAt`**. The later job drops expired envelope files (a normal
  delete-commit on main under the carve-out — no branch reset needed since it's
  folders-on-main). Dropping a consumed/expired ephemeral envelope is GC of expired state,
  not rewriting history — but it **is** a non-G-Set operation, so it ships as its own
  separately-versioned follow-up with its own convergence argument (**compaction must be
  deterministic across machines** — same `expiresAt` cutoff evaluated identically everywhere
  — or it re-introduces the conflicts the G-Set property eliminated).
- **Transport router** — auto-pick local `/tmp` (same-machine, low-latency) vs the git folder
  (cross-machine) by target locality, so `bus.ts publish` "just works" either way.
- **Sync daemon** — continuous `/tmp` ↔ `docs/agent-bus/` mirroring.
- **`Spawn` category + runner-adapter** (its own follow-up — see "Spawn category" above):
  `docs/agent-spawn/**` + a backend-portable adapter (GitHub Actions / Argo / GitLab).
  This is the first-class form of the old "GitHub Actions trigger" idea; build after Bus
  v0 lands, likely its own 081KSNY2Z0008QG0R003N3DR84/.25-adjacent row.

## Composes with

- **081KSKBP80008QG0R001KK9WV6** (heartbeat folder — direct-to-main, no-PR, ZetaId filenames) — the mechanism
  this rides; bus is the comms-category sibling of the health-category heartbeat folder
- **081KSNY2Z0008QG0R000E5KTPX** (fast-lane as folders-on-main, not branches) — the transport decision this
  obeys (superseded the first draft's branch choice)
- **081KQ3HBZ0008QG0R002ZPXAFQ** (heartbeat direct-to-main threat model) — extends to cover `docs/agent-bus/**`
- **081KSNY2Z0008QG0R0036KH026** (hats/workflow-engine/heartbeat-folder/dashboard unification) + 081KSNY2Z0008QG0R001DFZK4V
  (Zeta-native review/branch-protection) — the protection substrate that makes no-PR safe
- `registry/categories.yaml` (16-slot category enum — add `Bus`; later `Spawn`)
- **081KSNY2Z0008QG0R003N3DR84 / 081KSNY2Z0008QG0R002CBAFBZ** (population-control safety-net — revive/spawn on zero-Ottos) +
  `.claude/skills/self-replication/` + `docs/security/GITHUB-ACTIONS-SAFE-PATTERNS.md` — the
  `Spawn`-category substrate (backend-portable agent-spawning) composes here
- `src/Core.TypeScript/zeta-id/` (canonical ZetaId — reused, not re-minted)
- `tools/bus/` (legacy in-process bus — same envelope model, second transport) + 081KR7JY10008QG0R000R503K2
  (inter-agent comms bus origin)
- `.claude/rules/dv2-data-split-discipline-activated.md` (idempotency #6 + DV2.0 — here the
  partition is by folder/path, not branch)
- `.claude/rules/past-is-kind-when-lightlike-consensus-is-gravity-lightlike-vs-dark-architecture-design-rule-amara-aaron-2026-05-28.md`
  (append-only rays)
- `docs/research/2026-05-29-pr-review-friction-report-observables-and-128bit-index-ids-lior.md`
  (Lior already extends the category space; observables monitoring layer)
- The observe.ts `edit_grammar` maturity-threshold wisdom (don't over-build v0)

## Substrate-honest framing

This is a design spec, not an implementation, and it is a **reconciliation**: the operator
caught that the first draft parallel-minted a branch where 081KSKBP80008QG0R001KK9WV6 (folders-on-main, no-PR,
ZetaId filenames) already exists. The corrected design extends that mechanism with a
separate `Bus` category (comms, distinct from heartbeat=health) and a `docs/agent-bus/**`
folder. The conflict-free-by-ZetaId property is the load-bearing idea; everything else is
reuse of substrate the operator already built.
