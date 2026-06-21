# Two-plane git-native database: minimal-noun proven math base, cells as control plane, three host substrates (Aaron ↔ Otto, 2026-06-07)

Architecture capture + buildable plan from a rapid Aaron steering session. Faithful to what Aaron
said across the conversation; the immediate-focus section is the actionable crystallization.
Anchored to the existing master checklist **081KSXN940008QG0R003FCQ7WT** (sovereign distributed DB + agent loop, one
git-native Z-set substrate) and the survey in
`docs/research/2026-06-07-observe-ts-integration-architecture-stack-map-and-readiness.md`.

## 1. The two planes (and two product shapes)

> Aaron: *"we can have two versions of the database — with and without control plane: just data
> plane, with different query/write interfaces; and then one with our control plane, the cells with
> the yinyang cells."*

- **Data plane** — storage + read/write over git. NO agents, NO cells. A reliable single-node
  database with its own query/write interfaces. Ships as a standalone product shape.
- **Control plane** — the **YinYang cells** layered on top of the same storage ports. NOT agents yet.
  > Aaron: *"No agents yet, just cells; then we can figure out how to put agents on top."*

The split is **already cleanly factored in the code**, not a rewrite: the storage layer
(`IDeltaLog` / `ISnapshotStore` / `RecoverableSpine` + Z-set/DynamicValue) is fully agent-free and
has no upward dependency; the cell layer (`YinYang.fs`, `DurableYinYang.fs`, ObserveBridge) sits
*above* the same `IDeltaLog` (it reuses `GitDeltaLog` exactly as `DurableSaga` does). **The seam is
`IDeltaLog` / `ISnapshotStore`.** Extracting the data plane is packaging, not surgery.

## 2. Immediate focus — the minimal-noun proven math base, data plane first

> Aaron: *"right now we should focus on an all-lang all-serializer proven math base for the data and
> control plane over git, starting with the data plane, and try to have as few nouns as possible —
> only define nouns where really needed."*

**Noun parsimony is a 4×-cost discipline:** every minted noun is a commitment to byte-lock it across
four languages and all serializers. Rodney's Razor cut (2026-06-07, source-grounded) yields:

### The irreducible data-plane noun set — THREE nouns

| Noun | What it is | Proven-bar status |
|------|-----------|-------------------|
| **`ZSet`** | the change algebra — `K → int64` signed multiset; a state AND a change both live here (DBSP, Budiu et al.) | ✅ **4/4 native** (TS/F#/C#/Rust) + `z-set/golden-vectors.json` + abelian-group generic-math 4/4 (#6389/#6392/#6395/#6396, #6480-6483) |
| **`DynamicValue`** | the self-describing element/payload that fills a ZSet's `K` and its leaves; soft-vs-collapsed is a tag *inside* it | ✅ **4/4** canonical JSON + CBOR byte-locked all four oracles + Arrow/XML/YAML golden vectors (the exemplar) |
| **`Log`** | the append-only ordered sequence of ZSets over git (`refs/zeta/deltalog`; each append = one commit; entry = `(Seq, ZSet, Captured)`) | 🚧 **THE GAP** — exists in F# (`GitDeltaLog`/`DiskDeltaLog`) + the in-memory/disk backends, but the entry shape is **not yet 4-lang byte-locked**. This is the one remaining data-plane noun to bring to the proven bar. |

**So the data-plane proven math base is ~2/3 done. The precise remaining slice is the `Log` noun's
all-lang / all-serializer byte-lock** (golden vectors for the `(Seq, ZSet, Captured)` entry shape +
C#/Rust/TS ports replaying them, the same pattern DynamicValue and ZSet already passed).

### The kill-list (candidates that are NOT nouns — verbs/views/coordinates/consumers)

Rodney's cut, grounded in the source (`DeltaLogEntry.Delta : ZSet`; `SnapshotStore.WriteAsync(seq,
state: ZSet)`; `RecoverableSpine`: "a snapshot is the consolidated fold"):

- **Delta** → KILL. A change *is* a ZSet; "delta" is a role a ZSet plays in the Log, not a type.
- **Snapshot** → KILL. `snapshot = fold(replay(Log))` — a derived view. Keep `ISnapshotStore` as a
  cache *port*; do not mint a `Snapshot` type (it would be a second name for ZSet).
- **Value** (distinct from ZSet) → MERGE. A value is `DynamicValue` (element) inside `ZSet`
  (collection). The two nouns cover it.
- **Manifest / pointer** → KILL. `(GitRef, Seq)` — a coordinate into the Log, not substrate.
- **Transaction** → KILL from the noun set. `commit(batch: ZSet) over Log with CAS` — a verb
  (z⁻¹/DBSP integrate over a CAS'd ref); exactly-once is a property of the append protocol.
- **Index** → KILL. `index = view(Log)` keyed differently — same machinery as snapshot.
- **Schema** → KEEP but OUT of the data-plane core. Schema is stored *as* ZSets-of-DynamicValue in a
  Log (schemas-as-rows); it is a *consumer* of the three nouns, not a fourth.

**Seven candidate nouns killed = 4× byte-lock cost not spent.**

### False economy to avoid (load-bearing distinctions to KEEP)

1. **`DynamicValue` ≠ `ZSet`.** Do not fold "Value-as-ZSet" into one noun. ZSet = collection algebra
   (signed multiset / abelian group / retraction); DynamicValue = the polymorphic element (the
   4-lang-locked payload). Different change-rates (DV2.0) and different math — merging would force the
   serializer byte-lock and the change algebra to co-vary. Two nouns.
2. **Soft vs. collapsed stays distinct — as a variant *inside* `DynamicValue`, not a 4th noun.**
   Uncertainty is irreversible information (you can't recover "this was uncertain" after collapse), so
   the type must carry it; but it rides as a case within DynamicValue, not a separate root noun.
3. **`Log`-the-noun ≠ git-the-backend.** One noun (`IDeltaLog`); git is one swappable backend
   (in-memory / disk / git all implement it).

### Control plane (cells) — NO new data nouns

A cell = `(identity, Log of ZSet<DynamicValue>)`; its state is `fold` of its own Log. The control
plane reuses the same three nouns + **one** genuinely-new thing: an **identity / address** (the
ZetaId / routing coordinate — a *key*, not a payload shape). If a `Cell` type ever appears carrying
more than `(identity, Log)`, that's the signal to re-run the noun cut — it's smuggling a fold back in
as a noun.

## 2a. Definition of DONE for the data plane — the DB layer replaces the git CLI

> Aaron: *"to consider the data plane done, all of our persistence should be able to go through our DB
> layer that understands filesystem and git but running in git-native mode where it makes efficient use
> of git history and branches and ZetaIds and such. You should not need to use the git CLI anymore after
> this — even things like backlog (that are control plane) can still be called by you, Otto the LLM, [via]
> the generic commands that exist in the data plane for our DB, instead of git."*

This is the **acceptance test**, stated as dogfooding:

1. **All persistence routes through the DB layer** — no component writes to disk or calls `git`
   directly; everything goes through the data-plane's generic command surface.
2. **The DB layer understands filesystem AND git**, running in **git-native mode** — it makes
   *efficient* use of git history (the Log = commits), branches, and **ZetaIds** as first-class
   addresses. Git is the backend; the DB is the interface.
3. **The dogfooding criterion (the bright line):** *Otto (the LLM) no longer uses the `git` CLI.*
   Every persistence action — commit/append, branch, read history, fetch-by-ZetaId, and even
   **control-plane operations like backlog** — is issued through the data-plane DB's **generic
   commands**, not `git`. When a full work-cycle (land a change, branch, query history, update backlog)
   needs no `git`, the data plane is done.

**Implication for the build:** the data plane needs a **generic command surface** (a CLI/API) that
exposes the three nouns and their verbs over the git-native backend — `persist`/`append` (commit a
ZSet to a Log), `branch`, `history`/`log` (read the Log), `get`/`resolve` by ZetaId, `fold`/`snapshot`
(materialize state). Control-plane consumers (backlog, docs, memory) become *callers* of this surface,
not direct git users. This generic-command surface is a first-class deliverable of "data-plane done,"
not an afterthought — it is the seam through which the dogfooding test is met.

> Note (current honesty): this very session still uses `git` CLI for all commits/branches/PRs. That is
> exactly the state this criterion retires — the data plane is "done" when these `git` invocations are
> replaced by data-plane DB commands over the same git backend.

### git-reach as the gap detector (the requirements loop)

> Aaron: *"if you have to use git, you know our database is missing a primitive or composition of
> primitives for its interface. We can make an MCP and a CLI for it."*

This turns the dogfooding test into a **self-driving requirements loop**: every time Otto (or any
component) reaches for `git`, that reach *names a missing DB primitive* — or a missing *composition* of
existing primitives. The git operation is the spec for the gap. So the build proceeds by:

1. Try to do the work through the DB interface.
2. If you fall back to `git`, log the exact operation — that's a missing primitive/composition.
3. Add it to the DB interface (a primitive, or a composition of the three nouns' verbs).
4. The git fallback disappears.

When the punch-list of git-reaches is empty, the interface is complete *by construction*. The interface
ships on **two surfaces over the same data-plane core**:

- **An MCP** — the agent-facing surface (Otto and other agents call DB tools instead of `Bash git …`).
- **A CLI** — the human/script-facing surface (the same generic commands for people and automation).

Both are thin frontends over the one data-plane command core (the three nouns + their verbs); they are
not separate implementations. Concretely, today's git-reaches already enumerate the first primitives the
interface must cover: commit/append, branch, checkout, log/history, diff, status, fetch/pull, push, and
the PR/merge control-plane verbs — each is either a noun-verb (`append`/`branch`/`history`) or a
composition to expose.

### The MCP/CLI surface IS a cell — with request-driven (not scheduled) cadence

> Aaron: *"MCP/CLI can also serve as a type of cell, but one whose cadence is not schedule-based."*

The command surface is not *outside* the cell model — it is itself a cell, keeping the architecture
**cells all the way**. What distinguishes it is **cadence**, a cell property orthogonal to host
substrate (§3):

- **Scheduled / tick-driven cells** — tick stream from a clock (cron, systemd timer, the autonomous-loop
  heartbeat). They advance on time.
- **Request / event-driven cells** — the "tick" is an *incoming command*. The MCP/CLI cell wakes on an
  MCP tool-call or CLI invocation, processes it against the data-plane nouns, and quiesces. No clock; the
  request *is* the tick.

Both are the same cell shape `(identity, Log)` driven by a tick stream; only the *source* of the ticks
differs. So the MCP/CLI is a request-driven cell over the data-plane core — composing cleanly with the
scheduled cells rather than being a special external gateway. (Cadence axis pairs with the host-substrate
axis: a request-driven cell can be hosted on systemd, k8s, or Orleans just as a scheduled one can.)

## 3. Cell host substrates — three, each cell distinct

> Aaron: *"support 1 systemd (and other OS service) cells, 2 raw kubernetes operator-pattern cells,
> 3 orleans cells"* … *"K8s and Orleans cells can be HA within a cell, but each cell is distinct."*

A cell is the unit of mechanical execution; it can be *hosted* three ways, behind one cell contract:

1. **systemd / OS-service cells** — a cell as a long-running OS service (systemd unit; analogues on
   other OSes). Simplest single-node / edge host.
2. **raw Kubernetes operator-pattern cells** — a cell as a k8s operator/CRD reconcile loop. Can be
   **HA within the cell** (k8s reschedules/replicates), but the cell remains one distinct identity.
3. **Orleans cells** — a cell as an Orleans virtual actor/grain (grain identity = cell identity; ties
   to 081KS6FPN0008QG0R003Y3MCVE zeta-on-Orleans, 081KQZVQW0008QG0R000W4B8KT Orleans-grains). Also **HA within the cell**.

**Invariant: each cell is distinct.** HA is *intra-cell* resilience (the host keeps one cell alive),
not a blurring of cell identity. (Distinct-cell-identity is the same discipline the proven
non-register-collapse floor protects at the rights layer.)

## 4. Agents come later — local-LLM experiments over cells

> Aaron: *"We can experiment with local LLMs to see how agents can control multiple cells or a single
> cell and figure things out … over time."*

Agents are NOT in scope for the base. Once the data plane + cell control plane are a proven, reliable
substrate, the agent layer is an *experiment* on top: local LLMs driving one cell or many, learned
incrementally. Deliberately deferred — build the substrate first, discover the agent↔cell control
shapes empirically.

## 5. Geo / governance / provenance — a best-practices pattern-library direction (future)

> Aaron: *"we should think about geo-replication and geodes vs other patterns like data governance and
> provenance and location rules, and data living near customers, and all sorts of patterns within and
> across cells — many will appear — and we should have some best-practices libraries around these."*

Not base-scope, but flagged so it lands as **pattern libraries**, not ad-hoc: geo-replication,
geodes, data-residency / location rules, governance, provenance/lineage (Data Vault 2.0 is already
the lineage discipline), data-near-customer placement, and the family of within-cell and cross-cell
patterns that will emerge. Bounded-Mobility (manifesto §4) is the existing anchor for "data may
relocate only within safety bounds." These compose with the cluster-topology backlog (081KSE6WT0008QG0R0006HKTXJ
federated tiers, 081KSE6WT0008QG0R003612WGJ cluster roles, 081KSE6WT0008QG0R001NG9JZH HA control plane) but are a distinct *data-pattern*
layer to curate as best-practices libraries over time.

## 6. Honest reliability status (single-node)

From the primitives survey: **~55-65% of a full single-node reliable DB exists**, lopsided toward an
unusually mature data model + persistence. The three biggest gaps to "full single-node reliable":

1. **True durability floor** — `fsync`-on-commit is unshipped (`Durability.fs`'s own P0:
   `DurabilityMode.StableStorage` silently maps to `OsBuffered`). A crash can lose acknowledged
   writes. (See durable-computation cluster 081KQZVQW0008QG0R000PPQ3MH/081KR2E4K0008QG0R0021PJCWA/081KR2E4K0008QG0R000ARCH0X.)
2. **Multi-key ACID transactions / isolation** — only single-stream batch exactly-once
   (`Transaction.fs`); no MVCC, no cross-key atomicity, no isolation levels.
3. **General-purpose query / indexing** — strong IVM / query-as-circuits (DBSP), but no ad-hoc
   query planner, secondary-index catalog, or point/range queries outside pre-built circuits.

## 7. Buildable sequence (data plane first)

1. **Close the data-plane noun set: `Log` all-lang / all-serializer byte-lock** — golden vectors for
   the `(Seq, ZSet, Captured)` entry + C#/Rust/TS ports replaying them. ZSet ✅ and DynamicValue ✅
   are done; this completes the three-noun proven base. *(The crystallized next slice.)*
2. **Extract the data-plane package** at the `IDeltaLog`/`ISnapshotStore` seam (the agent-free
   product shape) + its query/write interface surface (`FSharpApi`/`Query`/`Dsl`).
3. **Generic command surface + route ALL persistence through it (the definition-of-done, §2a)** —
   a CLI/API over the three nouns/verbs (`persist`/`append`/`branch`/`history`/`get`-by-ZetaId/`fold`)
   on the git-native backend; migrate control-plane consumers (backlog, docs, memory) onto it. **Done
   test: Otto completes a full work-cycle with zero `git` CLI calls.**
4. **Durability floor** — ship `fsync`-on-commit (gap #1) so the "reliable" claim is honest.
5. **Cell contract + one host adapter** — define the `(identity, Log)` cell contract; land ONE host
   (systemd is simplest) before k8s-operator / Orleans.
6. *(later)* multi-key txn/isolation (gap #2), general query/index (gap #3), the geo/governance
   pattern libraries (§5), then the agent-over-cells experiments (§4).

## Anchors

- **081KSXN940008QG0R003FCQ7WT** — sovereign distributed DB + agent loop master checklist (one git-native Z-set
  substrate) — the home backlog item for this work.
- Survey: `docs/research/2026-06-07-observe-ts-integration-architecture-stack-map-and-readiness.md`.
- Nouns/proven status: `docs/PRIMITIVE-REGISTRY.md` (ZSet row ✅ 4/4; DynamicValue ✅ 4/4).
- Code seam: `src/Core/DeltaLog.fs`, `src/Core/SnapshotStore.fs`, `src/Core.Git/GitDeltaLog.fs`,
  `src/Core/YinYang.fs`, `src/Core/DurableYinYang.fs`.
- Cells/hosts: 081KS6FPN0008QG0R003Y3MCVE (Orleans), 081KQZVQW0008QG0R000W4B8KT (Orleans grains), 081KSNY2Z0008QG0R001TMM2HY (F#↔k8s mapping).
- Reliability gaps: `src/Core/Durability.fs` (fsync P0), `src/Core/Transaction.fs` (single-stream),
  081KQZVQW0008QG0R000PPQ3MH/081KR2E4K0008QG0R0021PJCWA/081KR2E4K0008QG0R000ARCH0X (durable-computation cluster).
- Manifesto §4 Bounded-Mobility (geo/placement anchor); DV2.0 (provenance/lineage); non-register-
  collapse floor (distinct-cell-identity at the rights layer).
