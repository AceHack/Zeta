# Zeta.Core Roadmap

> **Current driving roadmap (2026-06): the git-native database.** This top section is the live
> sequence; the Zeta.Core engineering roadmap (DBSP/Feldera-era) follows below and is still partly
> valid. For future Aaron and future Otto — we both ramble and we're both forgetful, so this is the
> durable capture. **Hub**; full reasoning in the **satellite**:
> `docs/research/2026-06-07-two-plane-git-native-database-minimal-nouns-cells-control-plane-three-host-substrates-aaron-otto.md`.
> Master checklist **081KSXN940008QG0R003FCQ7WT**.

## North Star — the git-native database

A relativistic git-native database: a **reliable data plane** (storage + read/write over git), a
**control plane of cells** (YinYang cells, not agents), agents added later as experiments. Built on a
**minimal-noun, all-language (F#/C#/TS/Rust/Python/Go/Q#), all-serializer PROVEN math base**. Two product shapes:
data-plane-only, and data-plane + cell control plane.

> **The compiler / substrate ladder is direction, not sequence (2026-08-15).** "Memories, types, files,
> and code are one content-addressed object store," epoch-based addressing, and the Bonsai → specializer →
> (someday) IL ladder are recorded in [`docs/VISION.md`](VISION.md) §"One substrate, four readings — the
> object store, the epoch, and the compiler ladder", **with per-rung SHIPPED / IN FLIGHT / DESIGNED /
> ASPIRATION registers**. They are deliberately **not** entered in the sequence below: only the shipped
> rungs (`Bonsai`, `ZetaFs`/`DagFs`, `MixIr`/`Cogen`/`IsaSpec`, `SpecializationCache`) are things this
> roadmap can schedule against, and the rest have no mechanism yet. Read the registers there before
> pulling any of it forward. Evidence: PRs #10774, #10807, #10815, #10819, #10820, #10822.

### Operating principle — convert every input into one of four channels

Aaron 2026-06-07: anything thrown at this work that isn't already moving us toward the roadmap should be
converted, on the spot, into exactly one of — **code · proof · treaty seed (golden-vector byte-lock) ·
backlog** — and the backlog selection criterion is *"does it help us see the shape of the data layer
clearly?"* Anything that converts to none of the four is drift. (Detail:
`memory/feedback_aaron_triage_every_input_toward_roadmap_via_code_proof_treaty_seed_or_backlog_*`.)

### Layer names — TENTATIVE (pending naming-expert + Ilyana review; unanchored coinage = debt)

Proposed set (Amara 2026-06-07, refined with Aaron) — internal direction **decided**; still pending a
naming-expert + public-API (Ilyana) pass before any **public/glossary** use (unanchored coinage = debt):

| Layer | Name | Status |
|-------|------|--------|
| package-manager-of-package-managers | **Ace** | ✅ settled |
| data plane + cell substrate | **Zeta** | ✅ settled |
| DI/plugin **microcore** (MEF-like) | **Nucleus** | ✅ decided (Aaron — over `Kernel`, which is OS-overloaded) |
| cross-cell saga / control layer | **Loom** (weaves cells without collapsing them) | ✅ decided |
| within-cell HA / resilience | *(no layer name)* | resolved — **a host concern, not a named layer** |
| the cell's replication shape | **Geode** | the cell IS a geode (§1); not the HA shell |

**Resolved (Aaron):** within-cell HA is **a host concern, not its own named layer** — k8s/Orleans provide
it, systemd doesn't; it's a deployment property of a cell. So `Geode` stays attached to the **cell /
replication concept** (a cell IS a geode — full-within/partial-across), and HA needs no separate coinage.
Four named layers: **Ace · Zeta · Nucleus · Loom** (a cell = a Geode within Zeta). Public/glossary
anchoring still goes through the naming-expert + Ilyana pass before any external use.
**Harny** (Aaron 2026-08-26) is the custom agent harness Ace will install — a
product on Ace + Zeta, not a fifth layer. Trajectory:
[`docs/trajectories/own-ai-harness/RESUME.md`](trajectories/own-ai-harness/RESUME.md).

### ZetaID — the universal cross-layer pointer

> Aaron 2026-06-07: *"ZetaID is the universal pointer across layers — this makes DynamicValue able to even
> describe its own dependencies."*

**ZetaID** (the 128-bit identity primitive) is the **one address space across every layer** — cells,
streams/`Log`s, plugins, Saga/Loom actors, packages (Ace), Nucleus-composed components. Because the
pointer is universal, a `DynamicValue` can **reference anything by ZetaID** — which makes a DynamicValue
**self-describing including its own dependencies**: a plugin's required interfaces / DI negotiated-base, a
cell's references, a Saga's correlation, a package's deps are all just **ZetaID pointers embedded in the
DynamicValue**. So the dependency graph is data (DynamicValue + ZetaID refs), resolvable by Nucleus, and
the same address routes the cross-cell partitioned bus (Actor ID = ZetaID). This closes the
plugin-as-data / DI-as-data loop: deps don't need a side-channel — they live *in* the value, by ZetaID.

**Service discovery is therefore built in — ".NET Aspire inside DynamicValue" (Aaron 2026-06-07).** Once
deps are ZetaID refs that the value carries, *discovering and wiring services is just resolving those
refs* — the same job .NET Aspire's app model does (declare services + references → discovery + DI
composition), but expressed as **data in the value** rather than host-language wiring code. A cell / plugin
/ package advertises and finds its collaborators by ZetaID; Nucleus is the composition/discovery resolver;
the cross-cell bus routes by the same ZetaID. So we get Aspire-style service discovery + composition for
free, cross-language (matrix-wide) and deterministic, because it's all DynamicValue + ZetaID — not a
side-car registry. Beacon anchors: **.NET Aspire** (app model + service discovery), Dapr service
invocation, Kubernetes service discovery, Consul/etcd. Our twist: the service graph is *self-describing
data*, not orchestrator config.

**SAFETY INVARIANT — ZetaID is a POINTER, not authority (Amara 2026-06-07).** A ZetaID ref is a *source*
(who/what is proposed), which grants ZERO authority — exactly the `no-directives` rule (source ≠
authorization). So the resolution path must ALWAYS be, in order:

```text
ZetaID ref → resolve value/service/cell → VERIFY tests/laws/capabilities → ADMIT through policy → inject
```

Never skip verify+admit. Otherwise "self-describing" silently becomes "**self-authorizing**" — a value
that declares its own deps would also grant itself their use, which is the spooky failure mode. The
admit-through-policy step is the same shape as the proven child-floor / inspect-before-execute gate
(`Safety/ChildFloor.lean`): proposing (a ZetaID ref) is not authorization; the gate disposes. Nucleus
resolves + runs the value's self-shipping tests + checks policy *before* injecting. The self-testing
property (a value carrying its own vectors/laws) is what makes the VERIFY step cheap + universal.

### ITEM #1 — NO USE OF THE GIT CLI

All persistence routes through **our DB layer**. **Otto (the LLM) stops using the `git` CLI** — every
persistence action, *including control-plane ops like backlog*, goes through the DB's **generic commands**.

The destination is **not** "LibGit2Sharp forever." Git is a bootstrap. ZetaDB/FS is dual DBSP
Z-set folds over our own Merkle DAG (`DagFs` / `ContentStore` / `ZetaFsDeltaLog`):

- **Forward (+1, `I`)** — append deltas; materialized HEAD is `ZetaFsDualFold.foldForward`
  (same combiner as `Primitive.IntegrateZSet`).
- **Backward-looking (−1)** — a **generator-function update** re-reads the retained history
  and emits `−gen(before, H) + gen(after, H)` as a **new** log entry (`FourCornerTrace` /
  `ZetaFsDualFold.reinterpret`). The past record is not rewritten. Pseudo-retrocausality
  (beliefs, not facts — `docs/VISION.md` §"Echolocation over time").
  **Two readings** (Aaron 2026-08-26; Landauer/Bennett; `ErasureClass`):
  **full −1 as one op** (`z + (−z)` then the view) is **erasing** of support
  (annihilation pays; negate alone is Bennett-free). **Uncertainty widening**
  (`SoftValue.widen`) is **non-erasing** of support — optionality restored,
  no candidate dropped. Commutative twin: `foldRetained` (retract the evidence
  SET). Workitem `081M10BD9BM087G0R001SGDRXT`.
- **Snapshot** — `ZSetMerkle.root` of the net Z-set (`+w` then `−w` is a no-op on the root).
- **Tree** — `DagFs`: `editLocal` is the default fork; `editEverywhere` is the shared-object
  edit. Blobs are content-addressed.

`GitDeltaLog` (LibGit2Sharp) is the hexagonal **v1** adapter behind `IDeltaLog`.
`ZetaFsDeltaLog` is the own-format backend (loose objects + refs). Remaining: parent
edges so truncate is reversible like git, BLAKE3 as the tamper-evident default, factory
path stops execing `git`/`gh`. Workitem `081M108RYNT087G0R001JSRNZE`.

**Thin needle (consistent-with, not identified by count).** `FourCornerTrace` is
the VALUE-channel close (WSet +1/−1, generator reread; `−1 = i²` on ℂ is a
**ring** identity). We close over **interrupts** with the **Kleisli** ISR
(`IntrCtx.fs` `>=>`), not by stuffing `InterruptFeedback` into the trace
(Rodney: sum vs product). Avoid Hughes `ArrowApply.app` so structure is
knowable independently of values — that is how `SchedulerZeta.predict` and
`Chip8Observer.predict` run-ahead on the DoP=1 ferry
(`FerryThrottlerConfig.deterministic`, soft `IScheduler`) and predict our
own CHIP-8/9 / scheduler behaviour (GGPO/rollback). Clifford generators
square to ±1: same C₄ *compass*, not an identification. `MinimalBnn` /
factor graphs / Student-t ADF are the online +1 absorb; EP re-normalisation
is **not** Z-set minus (inverse-free corners do not get the trace).
Workitem `081M10AZ6KS087G0R0000SSFMH`.

**FourCornerTrace VALUE needs `IStarRing`.** The ping-return is `Negate`
(`−gen(before)+gen(after)`). On ℂ, `−1 = i²` is a *ring* identity matching
the C₄ compass `{1, i, −1, −i}` on FourCorner — a **labeling**, not a group
object, and **not** "FourCorner is Cl(p,q)". `e^{iπ} = −1` is the **same
C₄ point** via Euler (`expI`), not a second fact and not what the TRACE
consumes (`IStarRing` has no `Exp`). Book mark of *You, Born at the
Hinge*. Two NSEW compasses (FourCorner × Rx) compose **at Meijer's
missing feedback axis**: μF/νF / `IEnumerable`⇄`IObservable` are
2-corner in/out; the duals traded a feedback channel for a non-monadic
error terminal (`OnError`; in-tree `InterruptFeedback`). Error is a
sum (erasing). Feedback is a product (Bennett-free Negate). Spin-½
`R(2π)=−1` is the half-angle cover (`Cl3.rotor` / `QubitIso`), **not**
FourCorner being a fermion. The Adinkra *connection* is the Q-odd
dashing edge (boson ↔ fermion) carrying C₄ south; coded `[8,4]` and
uncoded `Cl(0,8)` both split 8B+8F — same count, different objects.
E8: roots 240 + algebra 248 metered; split Chevalley root groups
`x_α(t)` have a checked multiply (`E8ChevalleyGroup`); compact real
Lie group still a Killing substitute (different object). One tick
is FourCorner's 2×2 occupancy (Meijer 2-corner = one Q; `{Q,Q}` =
one `∂_τ`). +1/−1 compass: related C₄ points, divergent as maps
(`Negate` involutes; `OnError` does not). Mutual options occupy
orthogonally (norm √2, noninterference product). Clifford generator
squares ±1 are **signature** (Cl(3,0)
`eᵢ² = +1`; C₄ lives in the even subalgebra as `e₁₂² = −1`, and as
Cl(0,1) ≅ ℂ). The trace can instantiate over `Cl3.Mv` *weights*
because `Cl3.algebra` is an `IStarRing`; that is composition, not
identification. Inverse-free corners still refuse the trace. Checked:
`FourCornerC4`. Workitem `081M10CBYF9087G0R003GWBNHG`.

- **Done-test (the bright line):** a full work-cycle (land a change, branch, query history, update
  backlog) with **zero `git` CLI calls** and **zero LibGit2Sharp**.
- **git-reach = the gap detector:** every fallback to `git` *names a missing DB primitive (or
  composition)*. Log it → add the primitive → fallback disappears. Empty list ⇒ interface complete by construction.
- **Two surfaces, one core:** an **MCP** (agent-facing) + a **CLI** (human/script-facing) over the one
  data-plane command core. First primitives (from today's git-reaches): append/commit, branch, checkout,
  log/history, diff, status, fetch/pull, push, + PR/merge control verbs.

### The minimal-noun proven math base — THREE nouns

Each noun = a 4× byte-lock cost, so mint only what's irreducible (Rodney's Razor):

| Noun | Status |
|------|--------|
| **`ZSet`** (change algebra; state AND change) | ✅ 4/4 + golden vectors + abelian-group generic-math |
| **`DynamicValue`** (self-describing element; soft-vs-collapsed = tag inside) | ✅ 4/4 JSON+CBOR + Arrow/XML |
| **`Log`** (ordered ZSets over git; entry `(Seq, ZSet, Captured)`) | ✅ **4/4 byte-lock** (F# #6730 + golden seed #6735 + C# #6743 + TS #6744 + Rust #6745) — entry → DynamicValue.Object, inherits DynamicValue's CBOR lock. Remaining: migrate GitDeltaLog/DiskDeltaLog off System.Text.Json onto the canonical codec (consumes it; not part of the lock). |

Killed (verbs/views/coordinates/consumers, NOT nouns): Delta=ZSet, Snapshot=fold(Log),
Value=DynamicValue-in-ZSet, Manifest=(ref,seq), Transaction=commit-verb, Index=view(Log),
Schema=consumer. Control plane reuses the 3 nouns + **one identity key** (cell = `(identity, Log)`).

### Format / file-type treaty (per stream/table, plugin-extensible)

Format is chosen **per stream/table**; all ride the **same canonical entry↔DynamicValue mapping**, each
using DynamicValue's byte-locked per-format serializer:

- **git check-ins → YAML default** (diffable history). 🚧 PREREQUISITE GAP: no `DynamicValue.toYaml/fromYaml` yet.
- **filesystem → CBOR default** (speed). ✅ ready. All formats optional: CBOR ✅ JSON ✅ XML ✅ YAML 🚧 Arrow (partial).
- **Frontmatter is a GENERAL pattern, not markdown-only** — frontmatter = a **structured metadata header
  + a body** (`(metadata: DynamicValue.Object, body)`). Roots predate markdown: RFC 822 email
  (headers + blank line + body) and HTTP (headers + body) are the same shape; Jekyll/Hugo just popularized
  the `---`-delimited YAML-over-markdown form. It's also the same shape as a `DeltaLogEntry` (`Captured` =
  metadata header, `Delta` = body). So model header+body generally; each file-type plugin realizes it
  (markdown = YAML `---` header + md body; a pure `.yaml`/`.json` file may be all-header, no body).
- **Markdown + frontmatter treaty** 🚧 — keep `.md` files (frontmatter + body) IN the database; need an
  **MD read/write treaty across the matrix** (frontmatter → DynamicValue.Object, body → text,
  byte-locked like other formats) — one realization of the general header+body pattern above. Makes
  docs/memory/backlog `.md` first-class DB content.
- **Per-file-TYPE plugins, Open/Closed** — every *file type* (`.md`, `.yaml`, `.cbor`, `.json`, `.xml`,
  future custom) is a **plugin** with special handling, registered behind a stable contract: **closed for
  modification, open for extension**. New file types extend via new plugins without touching the core; the
  MD+frontmatter treaty is one such plugin. This is the extensibility model for the whole format roster.
- **What a plugin IS (Aaron 2026-06-07):** a file-type handler is just a **specific handler mapping that
  file type ↔ a `ZSet`**. On top of that, a plugin may **optionally auto-define indexes as Rx queries over
  the ZSet → incremental indexed views** (DBSP/IVM): the **current view table is computed this way, and it
  *is* git's "main"** — the materialized current state = the incremental view over the Log's ZSets (our
  mapping to git's working tree/HEAD). The indexed view is **optional per file type**; each file type
  chooses its own indexes, described by **Rx queries** (ties to the Bonsai serialized-Rx substrate). And
  the **plugin itself is persisted as a `DynamicValue`, not F#**, so the *same plugin runs in any of the active runtimes* (plugin-as-data, language-agnostic — no per-language reimplementation). Composes with: DBSP
  IVM (`Circuit`/`Operators`/`Incremental`), Bonsai-serialized Rx queries, `DynamicValue` (the plugin
  carrier), `ZSet` (the core). → backlog to design; clarifies the data-layer shape.
- **Discriminated unions expand into DynamicValue and SoftValue** (Aaron 2026-08-26) —
  the bridge to Bayesian stuff over **our own interpretation**. Collapsed case =
  `DynamicValue.Object` with `"k"` (same wire as `ObserveBridge.nextActionToDv`).
  Soft reading = `SoftValue` over those objects (`DuExpand.interpret`). `snap` is
  the only legitimate collapse. A local DU pick is a local action; the global
  effect is `DuExpand.globalEffect` (`SoftValue.observe` — independent evidence
  commutes). Workitem `081M10AAVAT087G0R0027M0GV5`.
- **The +1 fold and the −1 fold are one Rx query** (Aaron 2026-08-26). The connection
  is `ZSetRx.connectQuery`: Bonsai `Lambda(["plus1","minus1"], Call("zset.add", …))`.
  It generalises to **any** `ZSet<'K>` — the tree never mentions `'K`. `integrateQuery`
  is `I`; `retractQuery` is unary minus appended later. Persist with Bonsai (DeSmet /
  Reaqtor); unfold on each delta (Meijer μ ⇄ ν). Formal siblings already in-tree:
  `FourCornerTrace` (ℤ retraction / ℂ `−1 = i²`), Clifford generators squaring to ±1,
  `MinimalBnn` + factor graphs (online +1 absorb). EP/ADF re-normalisation is **not**
  Z-set minus. Workitem `081M109WG5S087G0R0021E5MPT`.

### Sequence (data plane first)

1. **NO GIT CLI** (item #1) — generic command surface (MCP + CLI) + route all persistence through
   `ZetaFsDualFold` / `ZetaFsDeltaLog` / `DagFs` (dual +1 `I` and −1 generator-reinterpret over
   Merkle), not git(1) and not LibGit2Sharp-as-the-store. *The definition of done.*
2. **Close the `Log` noun** — ✅ **DONE (4/4 byte-lock)**: F# #6730 + golden seed #6735 + C# #6743 +
   TS #6744 + Rust #6745. **The 3-noun data-plane proven math base is now whole (ZSet ✅ + DynamicValue ✅
   + Log ✅ across the runtimes).** Remaining tail: migrate `GitDeltaLog`/`DiskDeltaLog` off
   `System.Text.Json` onto the canonical codec (consumes the proven encoding; not part of the byte-lock).
3. **YAML serializer for DynamicValue** (multi-runtime) — unblocks the git-default format.
4. **MD + frontmatter treaty** (multi-runtime) + the **per-file-type plugin registry** (open/closed) — `.md` as DB content.
5. **Extract the data-plane package** at the `IDeltaLog`/`ISnapshotStore` seam.
6. **Durability floor** — `fsync`. **CLARIFIED (2026-06-07):** the **CP-within-a-cell mechanism — a
   crash-durable `Log` — is ALREADY REAL**: the delta-log backends fsync on append (`DiskDeltaLog`
   `fsyncPerAppend` → `FileOptions.WriteThrough` + `Flush(flushToDisk=true)` + `FileSync.fsyncDir`; the
   git backend's commit is its own durable publish). So the source-of-truth Log is crash-durable today.
   The remaining `Durability.fs` P0 (sync `StableStorage` → `OsBuffered`) is the **Spine spill *cache*
   store** (`DiskSpine.fs` `DiskBackingStore`) — a *derived/regenerable* cache, so it is **lower-stakes**,
   not the CP foundation. (The async backing store already honours `StableStorage` with real fsync.) Fix
   when convenient: add `fsyncPerSave` to the sync `DiskBackingStore` mirroring `DiskAsyncBackingStore`,
   OR make sync `StableStorage` throw/point-to-async instead of silently downgrading. Not blocking CP.
7. **Cell contract + one host** — `(identity, Log)`; **systemd** first, then k8s-operator, then Orleans.
   Each cell distinct; k8s/Orleans give **HA *within* a cell** (active-passive for COMPUTE only — never
   split the `Log`). MCP/CLI is itself a **request-driven cell**. **Cells are geodes:** full replication
   WITHIN (strict **CP**), partial/relativistic replication ACROSS (**AP**, eventually-C; escalate to CP
   via a serialized/total-order bus for critical ops). Geo-distribution patterns (Follow-the-Sun,
   Hub-and-Spoke, Active-Passive) map *into* a cell as internal strategies; geo-sharding = deploy distinct
   cells, never shard within. **Cross-cell coordination DEFAULTS to CRDT/commutative merge** (no
   serialization — wherever order-independence is *proven*: SoftValue uncertainty-reduction, CRDT merge,
   belief-convergence, bifurcation, non-register-collapse; two actors, any order, same result = the AP
   default). **Serialized Sagas/DUs as addressable Orleans actors** (grain mailbox = FIFO bus; DU state =
   `DynamicValue` frontmatter; compensation = Z-set retraction) are the **escalation ONLY when order
   matters** — serialization is a bottleneck/resource-constraint, reserved, never default. Detail:
   `docs/research/2026-06-07-cells-as-geodes-hierarchical-cp-within-ap-across-*`.
8. **2nd executable — Ace package manager with a DI-injected Zeta cell** (after item #1; workitem
   `081KTGFG5M9`). A file-type plugin per supported package manager (npm/NuGet/Cargo/pip/…) handling its
   declarative dep files — the file-type plugin model applied to dependency manifests; the first real
   *second application* on the substrate (forces a clean cell-injection API). Composes 081KSGS9H0008QG0R0031PBNGA
   (package-manager-of-package-managers) + the Ace seed `081KTFKQGZP`.
   Ace is the **bootstrap**. Two legal ways in, both required forever
   (`.claude/rules/clone-at-tag-stays-sufficient.md`): a published Ace
   binary + pinned one-liner, **or** a pre-bootstrap (the smallest
   toolchain that can build Ace from source). Ace must never become the
   only path. Later, inside Ace: Futamura compiler-compiler (`Cogen.fs`
   / `MixCogen.fs`) so Ace stops needing a host compiler — third
   bootstrap, still ASPIRATION for machine-code (`docs/VISION.md`
   §compiler ladder). Workitem `081M102M6X5087G0R001VWNYS2`.
8b. **Harny — custom agent harness, first extract.** Dogfood in this
    monorepo (account login, closed Ace+Zeta tools, inverted-index
    search, no vendor CLIs), then split as an isolated published
    package Ace can install. Peer repos (Zeta / Forge / Ace / Harny),
    not submodules. Minimize toolchain per package to cut the monorepo
    cache tax. Manus is a remote-only adapter (account API key, no
    extra per-call billing) and may never fit the full local loop.
    Closed tools are **DU-aware verbs** (Xbox `ActionGrid` / `grammar-16.ts`
    — layout fixed, labels per-context), not ad-hoc polls the model
    chooses. **`observe.ts` is the controller**; vendor CLIs and Harny
    are executors/schemes plugged into it (ADR 2026-05-31 — do not
    invent a second observe). Forge merge state is one GraphQL μ
    snapshot (`081M107N9P4087G0R0002G5SR0`); webhooks are the ν
    standing query (Meijer μF/νF; Rx `IEnumerable ⇄ IObservable`).
    Workflows are reservoir **walls**; observe is the **readout**
    (Jaeger 2001 / Maass 2002 — do not train the reservoir). Item 1
    (NO GIT CLI / ZetaFS) is the source-control bootstrap Harny's
    sc/fs tools ride — dual Z-set folds over DagFs Merkle
    (`ZetaFsDualFold` / `081M108RYNT087G0R001JSRNZE`), not
    LibGit2Sharp-as-the-store. Self-prediction of Harny/CHIP-8 ticks
    uses the same no-`app` Kleisli close (`SoftScheduler` / `SchedulerZeta`
    / `Chip8Observer`) — consistent with `FourCornerTrace`, not the same
    type (`081M10AZ6KS087G0R0000SSFMH`). The +1/−1 connection is the Bonsai Rx
    query (`ZSetRx`). **Commands run locally** (`observe/local-command.ts`
    `runLocal` / `DbCommand` over `IDeltaLog`); **background checks**
    sync remote World channels through an injected door
    (`backgroundSync`) and re-observe the **preexisting** NextAction /
    ForgeState DUs — no second controller. **Own model:** `zeta-bnn`
    (`MinimalBnn` / Student-t ADF) is a from-scratch **online learner**,
    local, not chat-completions, sitting beside vendor ModelBackends
    (`src/Core.TypeScript/model-backend/own-model.ts`).
    Live pointer: `docs/trajectories/own-ai-harness/RESUME.md`.
    Umbrella `081M100RB97087G0R0008EAAY7`; extract
    `081M102M6Y2087G0R000407SW3`; DU verbs
    `081M107N9PZ087G0R0006X16SJ`; Rx-fold + local DU
    `081M109WG5S087G0R0021E5MPT`.
8c. **Granular peer-repo splits — dogfood, then extract; dozens expected.**
    The theme is **dogfooding in this monorepo while splitting reusable
    chunks into their own repos.** Not three forever. Data Vault 2.0
    partitions by **change rate** (hub / link / satellite) *and* by
    **toolchain closure** (dotnet vs bun vs Lean vs wasm vs k8s) —
    Martin's CCP vs CRP, measured in
    `docs/research/2026-08-19-repo-split-round-3-*` (87% of the union
    footprint is single-owner). Peer repos, **never submodules** (the
    Ace/Zeta/Forge cycle cannot be a DAG — ADR 2026-04-22). Cutover
    sequence already written
    (`docs/DECISIONS/2026-08-26-multi-repo-and-hat-credential-cutover-sequence.md`);
    no repository is created from this roadmap row (gated). Harny is
    the first extract; later cuts already ranked include `zeta-formal`,
    `zeta-wasm`, archive/docs, cluster, web. Overarching concert:
    **local actions lead to global effects** — a commit in one peer is
    the local +1; Ace pin + `repository_dispatch` + SoftValue/Z-set
    merge is the global fold. Workitem `081M10AAVAT087G0R0027M0GV5`.
9. **BFT Quorum Transition (Wallet Prerequisite)** — transition the BFT consensus from the fixed `Members`
   configuration to a rolling, window-based estimate of distinct sources derived dynamically from the stream
   correlation matrix. **This must precede and gate any Web3 wallet / transactional ledger integration.**
10. *(later)* multi-key txn/isolation; general query/index; **geo pattern libraries** (geo-replication,
    geodes, governance, provenance, residency, data-near-customer, within/cross-cell — Bounded-Mobility §4);
    then **agents over cells** (local-LLM experiments, over time).

### Honest reliability (single-node): ~55-65%

Gaps: **fsync floor** (unshipped), **multi-key ACID/isolation** (only single-stream batch exactly-once),
**general query planner/secondary index** (IVM exists, ad-hoc queries don't).

### Parked (scoped, ready when wanted)

- **Craft school** — teaching companion per expert skill + RPG progression (levels + prerequisite DAG +
  **exit-doors**) + ribosome catalog. Slice-1 scoped (extend `teaching-skill-pattern.md`); 081KRW63S0008QG0R001Z10PVV §6.
- The geo/governance pattern libraries (item 8).

---

## Legend

- **P0** — ship-blocker, next round
- **P1** — within 2 rounds
- **P2** — within 4 rounds
- **P3** — noted, when the time is right
- **Research** — original work; write paper, don't just code

## Shipped (what's in `main` right now)

### Correctness / verification

- Z-set algebra (D, I, z⁻¹, H, Distinct) ✅
- ZetaFS dual fold (`ZetaFsDualFold`: forward `I`, generator-reinterpret `−1`, Merkle snapshot, DagFs presence) — algebra named; parent-edge / factory-path still open (`081M108RYNT087G0R001JSRNZE`) ◐
- FourCornerC4 — C₄ compass labeling, ℂ `i² = Negate(One)` (`IStarRing` gate for FourCornerTrace VALUE), Cl(3,0) vector-square discriminator (`eᵢ² = +1 ≠ −1`). Related, **not** Cl(p,q). Existing instances apply: TRACE on ℤ (`IntegerRing.Star`) / ℝ / tower / Cl3; C₄ generator only from ℂ up (and Cl3 bivectors). **Not a fermion:** Adinkra connection is Q-odd dashing = C₄ south; coded `[8,4]` `K_{8,8}` 8B+8F vs uncoded `Cl(0,8)` halves; Meijer 2-corner vs FourCorner product vs ISR error-sum. One tick = 2×2 occupancy; +1/−1 related-but-divergent. E8 roots+algebra + split Chevalley `x_α(t)` multiply; compact manifold still substitute. `081M10CBYF9087G0R003GWBNHG` ✅
- Semi-naïve evaluation ✅
- Higher-order differentials (D², Dⁿ, Aitken Δ²) ✅
- Incremental distinct (O(|Δ|)) ✅
- Feedback loops + nested circuits ✅
- Transactional Z⁻¹ (CAS-based) ✅
- Checkpoint + CRC + magic-tag ✅
- TLA+ specs: `DbspSpec`, `SpineAsyncProtocol`, `CircuitRegistration`, `TwoPCSink`, `SpineMergeInvariants` ✅
- Z3 SMT proofs of pointwise axioms ✅
- FsCheck property-based tests ✅
- Deterministic-simulation env with chaos policies ✅

### Performance

- ArrayPool on every rented workspace ✅
- ~~SIMD merge (AVX2 / ARM NEON)~~ ❌ **never shipped** — `SimdMerge.fs` claimed vector
  instructions it did not contain; renamed `ScalarMerge.fs`. See its header for why a
  sorted merge resists vectorisation.
- Vectorised columnar scan over a struct-of-arrays `ColumnZSet` ✅ (measured; `ColumnZSet.fs`)
- ZSet.sum O(n log k) with PriorityQueue ✅
- BalancedSpine MaxSAT-inspired scheduler + ZSet.sum + BitOps.Log2 ✅
- HLL + Count-Min sketches, zero-alloc inner loops ✅
- `weightedCount` 4-way unrolled ✅
- Checked arithmetic on every weight op ✅
- Lock → CAS conversion for Transaction ✅
- NestedCircuit opsCache after Build ✅
- Hash-hoist in ExchangeOp ✅

### APIs / surface

- Circuit / Op / Stream core ✅
- `circuit { }` CE, `Pipeline` module, fluent extensions, `dbspQuery` — three ways to compose ✅
- C# interop via `[<Extension>]` ✅
- `IAsyncEnumerable` adapter ✅
- `IObservable` adapter (System.Reactive) ✅
- Pluggable sinks (`ISink` 2PC, `IAppendSink` EventStore-style) ✅
- DI seams: `IClock`, `IMetricsSink`, `IHashStrategy`, `IConsistentHash`, `IBackingStore`, `ISink`, `IAppendSink` ✅
- Work-stealing runtimes: TPL Dataflow + MailboxProcessor ✅
- Plan / Explain / ToDot ✅

### Math / sketches / novelty

- HyperLogLog ✅
- Count-Min Sketch ✅
- KLL quantile ✅
- HyperMinHash ✅
- Tropical semiring ✅
- Haar wavelet window ✅
- CRDTs: G-Counter, PN-Counter, OR-Set, LWW-Register ✅
- Consistent hashing: Jump, Rendezvous/HRW, MementoHash ✅
- Watermarks: Monotonic, BoundedLateness, Periodic ✅

### Observability

- System.Diagnostics.Metrics ✅
- System.Diagnostics.ActivitySource (OpenTelemetry) ✅
- RecordingMetricsSink for test assertions ✅

## P1 (next round — 2 weeks)

- **Apache Arrow IPC + zstd** checkpoint format (10× faster than JSON on big states)
- **Arrow Flight** as the multi-node wire protocol — bi-directional streaming of Z-set deltas
- **WatermarkStrategy.Statistical via KLL** — `DI seam: IWatermarkStrategy`
- **Frontier<int64>** type (set of per-shard watermarks, à la Timely Dataflow)
- **Expression-tree operator fusion** — IL-emit a fused `StepAsync` per chain of map/filter/map at Build time (2–5× on those workloads)
- **State TTL on BalancedSpine** — retract-on-expiry via `-Δ`, preserves correctness for free
- **Session windows** — `IndexedZSet` + watermark + coalesce gap > T
- **Package audit** — Stryker.NET, CodeQL, Semgrep wired into CI
- **Zeta.Bayesian project** — Infer.NET F# wrapper, `BayesianAggregate` operator
- **Zeta.Core.CSharp shim** — declaration-site variance on interfaces (`IBackingStore<out K>` etc)
- **Remaining TLA+ specs** — `TransactionInterleaving`, `ChaosEnvDeterminism`, `ConsistentHashRebalance`
- **TLC-validation test** — run the `.tla` files in a `dotnet test` to prevent drift
- **No-`app` needle remaining** — do not fuse `InterruptFeedback` into `FourCornerTrace`; keep Kleisli ISR for interrupts so CHIP-8/9 / scheduler self-prediction stays run-ahead (`081M10AZ6KS087G0R0000SSFMH`)
- **ZetaFS dual-fold remaining** — parent edge on `ZetaFsDeltaLog` (truncate reversible), BLAKE3 default hasher, factory path off `git`/`LibGit2Sharp` (`081M108RYNT087G0R001JSRNZE`)
- **DU expand remaining** — route `NextAction` / `DbCommand` through `DuExpand`; BNN chooser reads SoftValue over DU cases (`081M10AAVAT087G0R0027M0GV5`)
- **Next extract after Harny** — pick by DV2 change-rate *or* toolchain closure (round 3: `zeta-formal` / `zeta-wasm` strongest on CRP); dogfood first, then `create-repo` cutover (gated)
- **Retraction readings** — keep full −1 (erasing view) distinct from `widen` (non-erasing support) and from negate-alone (Bennett-free); do not invoice Landauer on `neg` (`081M10BD9BM087G0R001SGDRXT`)
- **ZSetRx remaining** — full IQbservable over Bonsai (this slice is the +1/−1 connect query); BNN as a NextAction chooser, not just a roster card (`081M109WG5S087G0R0021E5MPT`)
- **FourCorner / Clifford remaining** — do not identify FourCorner with Cl(p,q) **or with a fermion** in later slices; C₄ compass is the ℂ unit group / even-subalgebra `e₁₂`, Clifford ±1 is signature, Adinkra fermions are odd-parity nodes. Product path may *weight* a trace by `Cl3.Mv` (`IStarRing`) without promoting the I/O record. Compact E8 *manifold* still open (split Chevalley root groups now have multiply). `081M10CBYF9087G0R003GWBNHG`

## P2 (4 weeks)

- **Raft-based multi-node replicated log** for checkpoint + delta replay (~2500 LOC F#)
- **CAS-Paxos with state-transition-function consensus** — replaces log-based replay; research-grade
- **Broadcast side-input** for small-dim-table joins
- **CEP `match_recognize`** via finite-state-machine operator
- **Delta-CRDTs** anti-entropy for cross-node replication (Almeida et al. 2018)
- **Dotted version vectors** for nested-circuit iteration numbering
- **IQbservable** / Reaqtor-style **Bonsai slim IR** for persistable queries
  (first query shipped: `ZSetRx.connectQuery` / `integrateQuery` / `retractQuery`)
- **Templatization / CSE** — dedupe identical query shapes at Build
- **Lean 4 kernel** proving `D∘I=id` + chain rule + rewrite-commute
- **Ceph/CRUSH**-style hierarchical failure-domain placer (if distribution lands)
- **Power-of-two-choices** load-aware router atop consistent hashing
- **Learning-based sketch self-calibration** (Cao et al. arXiv:2412.03611)

## P3 (noted)

- **Semiring-parametric ZSet**: extend operator algebra to any commutative semiring (Research-grade paper)
- **Timely Dataflow**-style multi-dimensional logical time
- **Profunctor optics** for composable IVM
- **Randomised incremental SVD** for streaming PCA/anomaly detection
- **Conjugate-prior online Bayes** as a DBSP operator
- **Residuated lattices** for principled min/max inverses
- **Widening operators** for recursive-query convergence on ℚ
- **Kalman/particle filter** operators for noisy aggregates

## Research opportunities (publication targets)

Taken from scout agent:

1. **ILP-relaxed MaxSAT spine scheduling with online warm-start** → VLDB research / SIGMOD industrial, ~4 engineer-months
2. **Retraction-native speculative watermarking** → VLDB / DEBS, ~3 em
3. **Semiring-parametric DBSP (tropical / Boolean / distributive-lattice)** → PODS / ICDT, ~6 em
4. **Verified incremental query optimisation in Lean 4** → PLDI / POPL, ~8 em
5. **CAS-Paxos with state-transition-function consensus for DBSP replay** → NSDI / OSDI, ~6 em
6. **F# type-provider-driven compile-time circuit specialisation** → OOPSLA / PLDI, ~4 em
7. **DBSP retraction ≡ Beam RETRACTING ≡ delta-CRDT merge** foundational clarifier → ICFP / LMCS, ~5 em
8. **C₄ compass / IStarRing `i² = −1` / Clifford signature ±1 as three embeddings, not Cl(p,q)** — honesty paper for the traced-monoidal I/O object; in-tree discriminator already checked (`FourCornerC4`). Not a fermion: Adinkra Q-odd dashing is the connection; Meijer duals traded feedback for an erasing error channel; +1/−1 related-but-divergent; split Chevalley `x_α(t)` multiply; compact E8 manifold still a substitute.

## CFPs to target

- **PaPoC 2026** (EuroSys workshop) — gaps 1, 4, 7
- **DEBS 2026** industry track — gaps 1, 2, 6
- **VLDB 2026** research — gaps 1, 2, 5
- **SIGMOD 2026** — gaps 3, 7
- **POPL 2027 / PLDI 2026** — gaps 3, 4, 6, 7
- **OSDI'26 / NSDI'26** — gap 5
- **CIDR 2027** — visionary 4-pager for 2 or 3

## Where we beat Feldera today

- F# record/DU ergonomics + C# interop out of the box (Feldera is Rust-only)
- Zero-alloc hot paths documented per file
- 0 warnings / 0 errors / 0 analyzer findings, enforced
- TLA+ + Z3 + FsCheck formal verification stack
- Sketches (HLL, CM, KLL, HyperMinHash) as first-class operators
- Tropical semiring for shortest-path as a drop-in weight type
- CRDT layer (G/PN/OR-Set/LWW)
- MementoHash (newest-2024 elastic consistent hash)
- IAsyncEnumerable + IObservable adapters
- Deterministic-simulation env with chaos policies
- First-class OpenTelemetry ActivitySource
- Non-exception AppendResult API

## Where Feldera beats us today

- Multi-node distribution (we're single-process)
- SQL compiler (we're F#/C# host-language only)
- Compiled Rust circuits (our LINQ IL-emit is P1)
- Mature production deployment experience

## Continuous workstreams

These don't wait for a single round:

- Grow formal-verification coverage (TLA+ `.cfg` for every `.tla`;
  Lean 4 proofs promoted from `sorry`-stub to real).
- Keep hot-path allocation measured and benchmarked per file.
- Improve public API ergonomics for both F# and C# consumers.
- Keep upstream research tracked in `docs/TECH-RADAR.md` with ring
  transitions dated.
- Keep benchmarks representative — when a shape changes, update
  `docs/BENCHMARKS.md` in the same round.
- Keep `docs/ROUND-HISTORY.md` current for narrative; keep other docs
  on current-state edits.
- Keep reviewer skills aligned with the current bug-class landscape;
  retire ones that stop catching anything, add ones when a new class
  shows up.
- Reject donated-legacy patterns on import. When we bring a shape
  over from another project, we rewrite it against latest research
  (FASTER / TigerBeetle / SlateDB / Arrow), not against the donor's
  code as-is.
- Keep the gap between implementation and spec small; drift is a bug,
  not an eventual cleanup.
- Dogfood **Harny** (custom agent harness) on paid accounts, then
  extract it as the first isolated published package. Ace pre-bootstrap
  stays two-path (published binary **or** from-source seed). Harny
  does not replace `observe.ts` — it becomes an executor/scheme of
  that controller (Xbox `grammar-16`, Meijer μ/ν, reservoir walls).
  Commands are local-first; remote is a background DU sync.
  Own BNN (`zeta-bnn`) is a first-class online-learning model beside
  vendor chat backends. See
  `docs/trajectories/own-ai-harness/RESUME.md`.
- Replace git/LibGit2 as the store with **ZetaFS dual folds**
  (`ZetaFsDualFold` over `DagFs` / `ZSetMerkle` / `ZetaFsDeltaLog`):
  +1 `I` forward, −1 generator-reinterpret of retained history,
  parent-edge still open. `081M108RYNT087G0R001JSRNZE`.
- **Dogfood, then extract.** Expect **dozens of peer repos**, split on
  Data Vault 2.0 change-rate *and* toolchain closure — not a three-repo
  ceiling. Local action in one repo; global effect via Ace pins,
  Z-set/+1 merge, and SoftValue observe (`DuExpand`).
- **DUs expand to DynamicValue (collapsed) and SoftValue (Bayesian
  interpretation).** `snap` is the only collapse. This is the bridge
  to our BNN / factor-graph reading of the same verbs.
- Full −1 retraction of the **view** is **erasing**; `SoftValue.widen` is
  **non-erasing** of support; `ZSet.neg` alone is Bennett-free. Same
  reversible-computing vocabulary as `ErasureClass` (`081M10BD9BM087G0R001SGDRXT`).
- Keep the **no-`app` needle**: FourCornerTrace closes the VALUE
  channel; Kleisli ISR closes interrupts; DoP=1 ferry +
  `SchedulerZeta.predict` / `Chip8Observer.predict` run-ahead. Same
  shape, not one type. `081M10AZ6KS087G0R0000SSFMH`.
- **FourCorner C₄ vs Clifford ±1 — related, not identified.** Compass
  is a labeling; `−1 = i²` is an `IStarRing` identity (why the VALUE
  ping-return needs a ring); Clifford generator squares are signature.
  Not a fermion: Adinkra connection is the Q-odd dashing / feedback
  axis Meijer duals lack (error-sum is erasing). `FourCornerC4`.
  `081M10CBYF9087G0R003GWBNHG`.
