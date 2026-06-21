# Cells as geodes: CP-within / AP-across, geo-patterns map INTO a cell, cross-cell = Sagas as partitioned Orleans actors (Aaron ↔ Otto, 2026-06-07)

Architecture capture from an Aaron steering session (working through global VM-distribution patterns
against the cell model). Enriches the two-plane DB design doc + ROADMAP items #7 (cell contract) and #8
(geo pattern libraries). Faithful to what Aaron decided.

## 1. Cells are geodes — full replication WITHIN, partial/relativistic ACROSS

> Aaron: *"cells fully replicate within; across cells they can partially / relativistically replicate — so
> cells are pretty much geode-ish."*

A **geode** = any node is a fully-autonomous local entry point that eventually syncs out (it does NOT mean
every node holds all global data forever). A Zeta cell is exactly that:

- **Within a cell — full replication, the anchor.** Internal nodes (under the systemd / k8s-operator /
  Orleans host) are strictly synced; a write is locked locally via the **fsync-on-commit durability
  floor** before it's valid. An absolute source-of-truth zone — no internal split-brain.
- **Across cells — partial + relativistic replication, the geode mesh.** Data moves *selectively* by
  proximity / access pattern / governance: an EU cell may pull only a subset of streams/`Log`s from a US
  cell (data-near-customer), not mirror the global disk. Propagation is async, so cells observe global
  state at slightly different logical times ("relativistic") — each cell has a valid local timeline;
  cross-cell Sagas reconcile when boundaries intersect.

**Consequence for the geo pattern libraries (roadmap item #8):** because cells are *natively* geode-ish,
item #8 is **not** a heavyweight global-sync engine — it's a **selective stream-routing fabric** at the
`IDeltaLog`/`ISnapshotStore` seam: "this stream/table emits its deltas to Cell B, but not Cell C."

## 2. Hierarchical PACELC/CAP — CP within a cell, AP (eventually C) across, sometimes CP via a serialized bus

**Canonical keeper (Aaron 2026-06-07):** *within a cell = **CP**; cross-cell DEFAULT = **AP with eventual
C** (CRDT/commutative, §4a); the Saga = **CP with serialized A** is the **fallback** (§4b), reserved for
where order truly matters.*

> Aaron: *"within a cell it's CP; across cells it's AP, eventually-C by default, and sometimes CP with a
> serialized-message-bus-based A[P escalation]."* … *"our default cross-cell is AP with eventual C, where
> the saga CP with serialized A is the fallback."*

- **Within the cell = strict CP (default).** Consistency beats availability: the durability floor's
  fsync-on-commit makes the local `Log` **linearizable**; the cell stalls/rejects a write it can't
  guarantee exactly-once. Zero race conditions / phantom reads intra-cell. (This *elevates the fsync
  floor, roadmap item #6, from "reliability gap" to "the load-bearing guarantee of CP-within-cell."*)
- **Across cells = AP, eventually-consistent (default).** Cell A commits locally (CP) and returns
  success immediately; it streams `DeltaLogEntry` changes to Cell B asynchronously. If the link snaps,
  both cells keep serving locally; B catches up on the missing log tail when the partition heals.
- **Across cells = escalated CP (serialized message bus) for critical ops** (global identity
  reservation, cross-cell asset transfer). NOT a distributed lock (that kills global availability) —
  instead a **total-order / FIFO serialized bus**: intents are sequenced *before* they touch any cell's
  state machine; each cell processes them sequentially within its own CP boundary. **This is the answer
  to the multi-key ACID/isolation gap (roadmap item #8): serialize global intents on the bus rather than
  build a distributed transaction coordinator.**

## 3. The global VM-distribution patterns map INTO a cell (as internal strategies), not across

Aaron worked the standard global-topology patterns against the cell boundary. Mapping:

| Global pattern | Within a cell? | How it maps |
|----------------|----------------|-------------|
| **Follow-the-Sun autoscaling** | ✅ | Internal resource elasticity — scale local stream processors toward zero in dead hours, up on ingestion spikes (request-driven cells need no static 24/7 compute). |
| **Hub-and-Spoke** | ✅ | The **hub = the data-plane core** (`IDeltaLog`/`ISnapshotStore` + fsync floor = the single source of truth); the **spokes = per-file-type plugins** (`.md`/`.yaml`/`.cbor`) doing low-overhead serialization/frontmatter at the edge. |
| **Active-Passive** | ✅ *compute only, not state* | Can't active-passive-split the `Log` (it'd violate the atomic `Log` noun). But a standby Orleans/k8s actor picks up from the last valid `DeltaLogEntry` checkpoint if the primary executing actor crashes. |
| **Geo-Sharding** | ❌ | A cell **is** the shard. Segmenting by country/tenant = deploy **distinct cells**, never shard within one. |

## 4. Cross-cell coordination — TWO modes; the CRDT/commutative mode is the DEFAULT

> Aaron (2026-06-07, correction): *"some cross-cell patterns can be purely two-actor CRDT-based and don't
> need serialized execution if order is not important — like the places we prove two observers with
> different orders arrive at the same result (e.g. our uncertainty-reduction proof over SoftValue). **This
> should be our default.**"*

Cross-cell coordination is **not serialized-by-default.** There are two modes, and the cheap one leads.

### The decision criterion — a DU either way; the transition function decides the mode

> Aaron (2026-06-07): *"both can be represented as a DU for cross-cell, but it matters whether the DU
> state is a commutative view over the two independent cells or needs coordination for transitions. If
> transitions are calculatable by both just on their own stream plus the other's, then no coordination
> needed."*

A cross-cell workflow is a **DU in both modes** — what differs is the **transition function**. The test:

> **Can each cell compute every DU transition independently, from (its own stream + the other cell's
> stream)?**
>
> - **YES → the DU state is a *commutative view* over the two independent cells → NO coordination** (§4a,
>   the default). Both cells fold the same two streams and *provably* arrive at the same DU state without
>   talking — the transition is a deterministic function `f(streamA, streamB)` either side can evaluate.
>   This is confluence (CALM): a transition that is a pure function of both streams is order-independent.
> - **NO → transitions need coordination** (§4b, the fallback). A transition that requires a *once-only*
>   decision or a global order (cannot be derived independently from the two streams) needs the serialized
>   Saga — pay the bottleneck only here.

So the mode is not a guess: it falls out of the DU's transition function. If you can write the transition
as `f(ownStream, otherStream)` computable by both, you have your license to skip the bus.

**Make it a DECLARED, CHECKED property (Amara 2026-06-07).** Don't leave the mode implicit — a cross-cell
DU **declares its coordination class**, and the default must be justified-away to escalate:

- `CommutativeView` — **the default**. State = a fold over the cell streams; order-independent.
- `SerializedSaga` — **requires justification**: *which transition is not computable from the streams?*

This gives a future **admission gate** (a lint/proof check before a cross-cell DU is admitted):

1. list the input streams,
2. define the transition / fold,
3. prove/check **commutativity · associativity · idempotence · confluence**,
4. proof passes → `CommutativeView` (AP, eventual-C, no coordination),
5. proof fails or impossible → `SerializedSaga` (CP, serialized-A — and you must name the non-derivable
   transition).

The DU is the *state shape*; the coordination class is a *property of the transition function*, declared
and checked — never a silent default to serialization. (Same posture as the data-plane plugin determinism
contract `081KTGEVV75`: admitted because *checked*, not because clever.)

Class examples — *CommutativeView:* uncertainty reduction, read-model/index convergence, evidence/
reputation accumulation, replicated package-graph observations, CRDT merge, belief-convergence.
*SerializedSaga:* global unique reservation, asset transfer, exactly-once irreversible side-effect,
"only one winner" decisions, non-commutative phase transitions.

### 4a. DEFAULT — CRDT / commutative two-actor merge (NO serialization, fully AP)

When **order does not matter**, cross-cell coordination is just a **commutative CRDT merge**: two actors
that apply the same set of changes in *different orders* provably converge to the **same** result. No
serialized bus, no saga orchestrator, no lock — this **IS** the AP-eventually-consistent default (§2),
and it is scale-free/lock-free by construction. Reach for serialization only when you've *failed* to
prove order-independence.

**Use it wherever commutativity/order-independence is already PROVEN** — and we have a stack of those:

- **SoftValue uncertainty-reduction** — order-independent evidence/Bayesian fold (two observers,
  different evidence orders, same posterior; the proof Aaron cites).
- **CRDT semilattice merge** — G-Set / Z-set / Clock (commutative + associative + idempotent; the proven
  floor; 081KT7YW00008QG0R002T1XNWT).
- **Belief-convergence** (`BeliefConvergence.fs`) — order-independent for any fixed likelihood.
- **Bifurcation `reconcile_order_independent`** + **non-register-collapse distinctness-under-merge**
  (the safety-floor proofs) — merge converges regardless of order.

The rule: **if you can prove the merge is commutative, cross-cell coordination needs no serialization** —
default to the CRDT path. The proof IS the license to skip the bus.

### 4b. ESCALATION — serialized Saga (Orleans actor + FIFO bus), ONLY when order matters

> Aaron: *"the discriminated unions / sagas basically get a zeta cell (Orleans actor) for it, serialized
> over an addressable bus partitioned to the cell/actor."*

> Aaron (2026-06-07): *"serialized state should be reserved for where we really need it — it's still a
> bottleneck and creates resource constraints."*

**Serialization is a cost, not a convenience.** A serialized actor/bus is a single-threaded FIFO: it is a
throughput **bottleneck** and a **resource constraint** (one mailbox, one ordering point, back-pressure).
So it is reserved for where order is genuinely required — never the default. Every place we can prove
commutativity (§4a) we pay none of that cost. Only when **order matters** (global identity reservation,
cross-cell asset transfer, any non-commutative multi-step intent) do you escalate to the serialized Saga
path (the CP escalation of §2). Each Saga / DU instance **is** an addressable Zeta cell (Orleans grain),
partitioned by Actor ID to a
cell boundary. The actor model gives the cross-cell machinery for free:

- **The addressable actor IS the serializer.** An Orleans grain is single-threaded; its mailbox is a
  strict sequential FIFO. Messages to a given Actor ID are automatically serialized → cross-cell ordering
  for free, no external broker, no distributed lock.
- **DUs are the explicit state-machine gates.** The actor reads a message, matches the DU case, does the
  deterministic local `Log` append, transitions state. Saga state is just a DU →serializes natively to
  `DynamicValue.Object` → stored as **frontmatter metadata** in the cell's streams (the general
  header+body shape). Example state DU: `Initiated | PendingRemoteAck | CommittedSuccessfully |
  Compensating | FailedAndReversed`.
- **Choreography (log-driven)** — Cell A commits with an **outbox** metadata flag in frontmatter; Cell B
  watches A's log stream, executes locally, commits to its own `Log`. **Orchestration (request-driven
  cell)** — a stateless MCP/CLI request-driven cell acts as Saga orchestrator (command A → ack → command B).
- **Compensation, not rollback** — append-only means you never delete; a failure commits a failure event,
  and the compensation **writes a NEW entry that reverses Step 1's effect** (Z-set retraction is the
  natural inverse). Ties to the "operational error is retractable / the future forgives" ethics.
- **Idempotency at the `IDeltaLog` seam** — a replayed bus message must not double-write; an idempotency
  key (ZetaId / CorrelationId) guards exact-once (composes with the always-active idempotency discipline).

## 5. Roadmap deltas (this conversation)

- **Item #6 (fsync floor) is elevated** — it is the mechanism of CP-within-cell, not just a reliability
  gap. Likely sequence it earlier once the cell contract lands.
- **Item #7 (cell contract)** gains: the CP-within / AP-across posture; intra-cell active-passive for
  *compute*; the geode replication model.
- **Item #8 (geo libraries)** sharpens to: a **selective stream-routing fabric** at the `IDeltaLog` seam
  (per-stream cross-cell subscription/emit rules) + the **serialized-bus CP-escalation** path; geo-sharding
  = deploy distinct cells, not intra-cell sharding.
- **Cross-cell Sagas** get a concrete design: Saga/DU = addressable Orleans actor, partitioned bus =
  the grain mailbox (FIFO serializer), state = DU-as-DynamicValue-frontmatter, compensation = retraction.
  Composes the existing Bonsai-serialized-saga substrate + DU workflow engine (081KSKBP80008QG0R000B3Y19A) + zeta-on-Orleans (081KS6FPN0008QG0R003Y3MCVE).

## Anchors

- Two-plane DB design doc (`docs/research/2026-06-07-two-plane-git-native-database-minimal-nouns-*`) ·
  `docs/ROADMAP.md` items #6/#7/#8 · 081KSXN940008QG0R003FCQ7WT (master checklist).
- Cross-cell saga substrate: 081KSKBP80008QG0R000B3Y19A (DU workflow engine), 081KS6FPN0008QG0R003Y3MCVE (zeta-on-Orleans, grain=cell identity),
  081KQZVQW0008QG0R000W4B8KT (Orleans grains), PRIMITIVE-REGISTRY "serializable deferred execution = self-evolving sagas".
- Beacon (human prior art): Azure **Geode** + **Deployment Stamps** patterns (Microsoft Learn); PACELC
  (Abadi); Orleans virtual-actor model (Bernstein et al.); Saga (Garcia-Molina & Salem 1987); total-order
  broadcast. Our twist: the geode node = a cell whose state is an append-only `Log` of ZSets, and the
  saga coordinator is a grain whose mailbox *is* the serialized bus.
