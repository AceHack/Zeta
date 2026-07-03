# Zeta as a relativistic, agent-partitioned, uncertainty-native, git-substrate database

**Date:** 2026-06-06 · **Author:** Otto (crystallizing the maintainer's vision) · **Status:** vision/architecture (fuzzy → sharp)
**Companion:** `2026-06-06-durability-tiers-and-per-stream-group-persistence-policy.md` (the storage tier underneath this).

> Maintainer: *"the db and our multi git repo are the same relativistic database design — this is
> very different from existing databases … each agent will have its own shard/partition it owns
> and it's not fully HA replicated … they pick and choose based on their shared buses … I want
> our data based around DynamicValue because of uncertainty as first-class and agents as part of
> the database … our Zeta database ships with local LLMs as first class and we rethink everything
> about human/db interactions when the db has always-on intelligence."*

## 1. What it is, in one breath

A database where **each agent owns a shard** (its own git-native, append-only, ZetaId-keyed
event log), there is **no global "now"** (each agent is its own reference frame — *relativistic*),
agents **selectively replicate** from each other over **shared buses** (not blanket HA), values
are **DynamicValue with uncertainty first-class** (SoftValue / TriBoolean / Bayesian belief), and
**local LLMs ship in the box as first-class participants** — the database has always-on
intelligence, which rewrites what "querying" and "human/DB interaction" even mean.

## 2. The closest prior art — and the genuinely novel part

Center of gravity: **Irmin (MirageOS) + MRDT** — a distributed DB built on Git's design
(content-addressed Merkle DAG, `clone/push/pull/branch/merge`, LCA-based **three-way merge**),
with **Mergeable Replicated Data Types** (Kaki et al., OOPSLA 2019) supplying principled
`merge(σ_lca, σ_a, σ_b)`. That covers three of our five pillars: git-substrate,
relativistic/branch-frame causality, and partial replication.

The **genuinely novel fusion nobody has shipped**: bolting (a) **uncertainty-native cell values**
(probabilistic DBs — MayBMS/Trio/MCDB, possible-worlds semantics) and (b) **agent-owned actor
shards** (actor-oriented DBs — Bernstein/Orleans) onto that Irmin/MRDT spine — and then putting
(c) **always-on local LLM intelligence inside the DB**. No existing system combines these.

## 3. We already have most of the pieces (this is not greenfield)

| Pillar | Existing Zeta substrate |
|---|---|
| Conflict-free distributed key | `ZetaId` (128-bit, category-tagged, no central allocation) |
| Git-native comms / partial replication | agent-bus = **G-Set CRDT** of ZetaId-named files on `main` (`tools/agent-bus/`, #6283/#6327); "Battle Bus" |
| Relativistic frames | writer-actor-routing-model.md — persona=owner/"what remains", actor=grain/"what acts"; already calls agents *"relativistically linked, no global now"* |
| Uncertainty-native values | `SoftValue` (calibrated distribution over `DynamicValue`), `TriBoolean` (Kleene held-unknown), `BeliefConvergence` + `Zeta.Bayesian` (order-independent Bayesian merge) |
| Self-describing payloads | `DynamicValue` (CBOR/msgpack/JSON/YAML common core) |
| Content-address / incremental sync | `Merkle.fs` (XxHash128, LeafDiff = ship only changed leaves — git/IPFS trick) |
| Event-sourced fold | the "everything is a fold over an append-only ZetaId-keyed log" substrate (G-Set ⊂ Bag ⊂ Z-set; retraction-native) |
| Causal (not global) consistency | per-row CAS + bus + workitems as happens-before edges (CAP-posture-per-row research) |

The vision is largely **wiring existing primitives into one coherent database**, plus the two
hard research problems in §6.

## 4. The two-level HA model (maintainer, 2026-06-06 — resolves a contradiction)

Earlier drafts wrongly proposed cross-agent k+1 active-active HA. Correct model has **two levels**:

- **Intra-agent (own state): TRADITIONAL HA lives here.** An agent MAY fully replicate *its own
  shard* k+1 for redundancy/durability of the state it owns — classic replication, classic
  guarantees, because within one shard there *is* a single writer and a local order.
- **Inter-agent: RELATIVISTIC, selective, no global truth.** Agents do NOT blanket-replicate each
  other. They **pick and choose** what to pull from whom over **shared buses** (subscription /
  partial replication). Consistency across agents is causal/mergeable (MRDT three-way merge over
  the git DAG), never globally serialized.

This is the clean split: **HA is an agent's private choice about its own state; relativity governs
what crosses between agents.**

## 4b. Streams = evolving ontologies; the agent = a mini multidimensional multi-model store (Caché)

Maintainer: *"our streams are basically evolving ontologies … an individual agent is kind of like
a mini multidimensional db that can share internal state easily with others via Arrow / other
serialized state and DynamicValue."*

**Prior-art anchor: InterSystems Caché / IRIS (MUMPS/"M" lineage).** Caché's storage primitive is
the **global** — a persistent, **sparse, multidimensional array** (a B-tree keyed by arbitrary
subscripts). One multidimensional engine projects *many* models over the same data: object,
relational (SQL), document, key-value. That multi-model-over-one-substrate idea is exactly ours:

- **Each agent's shard = a Caché-global-like store** — a ZetaId-keyed, sparse, nested
  `DynamicValue` tree (arbitrary-depth = multidimensional; self-describing = multi-model). The
  same shard projects relational/document/object/graph views via folds (our "everything is a fold
  over the log; state is a projection" substrate). A *mini multidimensional multi-model DB per
  agent.*
- **Streams = evolving ontologies, not fixed schemas.** A stream's structure is an ontology that
  *grows and changes over time* — schema-**on-read**, not migrate-the-world. `DynamicValue`
  (self-describing payloads) + **Data Vault 2.0** (partition by change-rate; hubs stable, satellites
  absorb the churn) + the repo's ontology/HKT-MDM discipline are precisely the tools for
  schema/ontology evolution without breaking readers. Old events stay valid; the ontology extends.
  Anchor it to a human + a term (the `anchor-to-human-prior-art` rule): an evolving ontology is a
  *terminological knowledge base under monotonic extension* — new concepts are added (G-Set grow),
  corrections are retractions (Z-set), never destructive rewrites (Memory-Preservation §5).
- **Easy internal-state sharing between agents** — over the bus, agents exchange state in our
  **byte-verified serializers**: `DynamicValue` (self-describing, schema-carrying), **Arrow IPC**
  (bulk columnar, fast — `ArrowSerializer.fs`), and CBOR. Self-describing payloads mean a receiver
  can absorb a *different agent's evolving ontology* without a shared compile-time schema — the
  ontology travels with the data.

## 4c. Self-hosting: filesystem-in-DB, git-aware backend, FUSE, microkernel (maintainer, 2026-06-06)

The database is **self-hosting** — it doesn't sit *on* a filesystem, it *contains* one, and
eventually *is* the OS substrate:

- **The filesystem lives IN the DB as a Z-set stream.** Everything — including the filesystem
  tree itself — is one Z-set stream. A hierarchy is encoded over **closure tables**
  (`ClosureTable.fs`: store all ancestor→descendant paths; a standard tree-in-relational pattern
  that's incremental-friendly). OPEN: closure tables are *one* option; there may be a better
  tree encoding for Z-set incremental maintenance (adjacency-list deltas, nested-set, materialized
  path, or a DBSP-native recursive encoding) — we have research; revisit. Retraction handles
  moves/deletes natively (append the inverse path-set).
- **Git-aware git-native backend** (§7 / `DeltaLog.fs`): the git backend IS git — history = the
  delta log, branches = relativistic frames/shards, **Z-set retraction = append-an-inverse
  commit** (git never rewrites history; Landauer-honest; Memory-Preservation §5), cross-branch
  merge = MRDT three-way via git's LCA. The *filesystem* backend must build all of this itself.
- **Zeta is a git server** (endgame): the DB and the git remote are the same thing — a client
  `git push` lands an **observation** (scrutinized before any command is extracted — see §5c trust
  boundary), `git pull` is a read.
- **FUSE filesystem** (existing backlog) exposes the in-DB filesystem to the OS as a mountable
  fs — so ordinary tools see the Z-set-backed filesystem.
- **Microkernel** (endgame): the whole substrate targets a microkernel — Zeta as the OS, with the
  DB/git-server/FUSE-fs as the storage+naming layer.

This is the "everything is a fold over Z-sets, at every scale" recursion (manifesto §9 Recursive,
§10 Self-similar) taken to its conclusion: data, schema/ontology, filesystem, version history, and
eventually the OS are all the same retraction-native Z-set substrate.

## 4d. ZetaId as the universal, self-describing pointer (maintainer, 2026-06-06)

One addressing scheme across the whole substrate: a **ZetaId** points at content at *any*
granularity — a log entry, a git blob/commit (across **history and branches**, because git is
already content-addressed), a file, even a **section within a file**. Generic pointers that resolve
uniformly in memory, on disk, and in git. (IPFS-CID-like content addressing unified with a named
distributed key.)

**The key is self-describing — category + version select the addressing/key TYPE** (maintainer's
resolution of the "CRC vs unique-id" tension). Different category/version values "pull in different
directions" *by design*, read straight from the key:

- a **random-minted** category → conflict-free unique id (today's default; no coordination).
- a **content-addressed** category → embeds a content digest (XxHash128 / `Merkle.fs`); **the id IS
  the CRC** — recompute the digest, compare to the key → torn-write / corruption detection, no
  separate CRC32c needed.
- categories that need both → carry a unique segment AND a separate digest field ("move the CRC out").

So the same construct is a unique pointer, a content-address, *or* an integrity check depending on
its self-describing prefix — a reader dispatches on category/version to know how to interpret and
whether to verify. This is the **multiformats / multihash / CID-version** pattern (the prefix tells
you how to read the rest). It lets the segment-append log use the entry's ZetaId digest as its
integrity check, and lets a generic pointer address a git object / file / section uniformly.

Anchor: multiformats (multihash, CID v1 self-describing identifiers); content-addressed storage
(git, IPFS); `Merkle.fs` (XxHash128). Affects: the segment-append+CRC log (`081KTF9T0E4` — CRC
becomes the id digest) and the disk entry/frame format (still being finalized).

**Parsed by combinators + generators, not lookups — and some ids encode ACTIONS (maintainer,
2026-06-06).** Higher bits describe how to parse the lower bits (or vice versa), *recursively*, via
**parser combinators + generators** rather than a static lookup table — so the key is a small
self-describing, composable language, extensible without a central registry (generators over
lookups, same spirit as wonder compression). Most categories parse to a *pointer* or a
*content-address*; but certain categories can parse to an **action** — the id encodes a
computation, not just a location (id-as-program). **Capability boundary still applies (§5b):** an
action-encoding id is an *observation*, never auto-executed — it passes the scrutiny gate
(schema/version → capability → determinism → resource budget → non-determinism capture → logged as
delta) before its action runs. So "ids can encode actions" composes with, rather than bypasses, the
observation→command trust boundary. Anchor: parser combinators (Hutton/Meijer); self-describing
bytecode / tagged encodings.

## 4e. The seed: Zeta as a self-unfolding 128-bit fixed point (quine) — the long game

Maintainer (2026-06-06): *"we should be able to encode all of Zeta into a 128-bit id where our F#
code knows how to unfold it, and it unfolds to the same code that unfolds it."* This is the endpoint
of id-as-program (§4d) + wonder compression (§6.4): a 128-bit **seed** that an **unfolder** expands
into the system, where the unfold *also reproduces the unfolder* —

```
unfold(seed) = (Zeta, unfold)      // a fixed point: the output contains its own generator
```

That is a **quine / self-reproducing fixed point**: the seed names a fixed point of `unfold`; the
unfolder is recovered *by* unfolding (DNA that encodes the machinery to read DNA). Anchors:
**Kleene's second recursion theorem**, the **Y / fixed-point combinator**, the **metacircular
evaluator** (Lisp `eval`/`apply`, SICP), **quines**, **von Neumann's universal constructor /
self-replication**, **Solomonoff / Kolmogorov / Chaitin** (shortest program that generates the
object), and **bootstrapping compilers**. The `self-boot` skill (Alexa bootstrapping from
foundational docs) is the operational shadow of this; the formal version is the seed-unfold.

**Honest caveat (information theory — keep it sound).** 128 bits cannot *literally contain* all of
Zeta's information (Kolmogorov: 128 bits name only 2^128 distinct objects; the residual /
history is far larger). So the 128 bits are the **seed/name of the fixed point**, not a literal
compression of every bit. The split (wonder compression at maximal scale):

- **unfolder** = the generator (lives in the substrate; reproduced by the unfold — the quine part),
- **seed** = the 128-bit id that selects/derives the canonical core,
- **residual** = history + the world's divergences from prediction (rides the delta log; §6.4).

So "all of Zeta from 128 bits" is exact for the *self-reproducing canonical kernel* and the
*generated/derivable core*; the lived residual is layered on via the log. The id seeds the fixed
point; the unfolder regenerates itself and the derivable system; the log carries the surprise. That
keeps the dream both beautiful and information-theoretically honest.

**Grounding: this is compiler bootstrapping / self-hosting (maintainer, 2026-06-06).** Not sci-fi —
it's *"writing the C# compiler in C# after you've written it in C first."* We write the unfolder in
a **host (F# = the "C" stage)**; then Zeta **self-hosts** (the "C#-in-C#" stage), and the host can
fall away once the system reproduces itself. Standard practice (GCC/rustc bootstrap, T-diagrams),
applied to the whole substrate rather than just a compiler. The `self-boot` skill is the manual
version of the same move.

**Security corollary — the bootstrap must be auditable (Thompson, *Reflections on Trusting Trust*,
1984).** A self-reproducing compiler can carry a backdoor that survives recompilation from clean
source — so a self-unfolding substrate could hide something in the unfolder/seed. Defense: the
**capability/inspect-before-execute boundary (§5b) extends down to the seed and unfolder** — they
are inspectable data (Bonsai-style), reproducibly built, and scrutinized, not trusted by fiat. Self-
hosting buys independence from the host; it does not buy a pass on auditability.

**The host is stored IN the YinYang/saga engine — which resolves the auditability concern
(maintainer, 2026-06-06).** The complete bootstrap unit is **(128-bit seed + an interpreting host)**;
the seed is inert alone, the host supplies the interpretation, and the seed's *first act under a host*
is to self-bootstrap because the host knows how to read it (DNA + ribosome — neither alone is life;
together they unfold). Most of the information lives in the **host**, not the 128-bit seed — so the
honest claim is "*the seed* is 128 bits," not "*the system* is 128 bits," and the **host is the
trust-critical surface** (Trusting-Trust: audit the interpreter, not the tiny seed). The resolution:
**store the host (the unfolder) IN the YinYang / saga engine** — so the interpreter is itself a
`YinYang.Cell` / `Bonsai.Expr` = **inspectable data**, which (a) makes it portable — easy to
implement against in any compiler/host — and (b) puts the trust-critical surface squarely inside the
inspect-before-execute boundary (§5b) *by construction*. The host stops being opaque trusted code and
becomes auditable, reproducible, self-describing data — exactly where the Trusting-Trust discipline
needs it.

**The sound restatement — seed = observation; inspection GUARANTEES safety invariants; CHECK not
SEARCH (maintainer, 2026-06-06).** The defensible claim, stated precisely: *the observation of the
128 bits + inspection guarantees the generator-function combination meets certain math safety
invariants.* Three things this gets exactly right:

1. **Seed is an OBSERVATION**, not a command or a container — so it flows through the same
   observation → scrutiny → guarantee pipeline as `commit = observation` (§5c). The bits assert
   nothing by fiat; inspection is what grants the guarantee.
2. **Proof = CHECK, not SEARCH.** Proof-*checking* is decidable and fast and can be driven from
   seed + host (replay/verify a seeded proof structure). Proof-*generation* (finding the proof) is
   undecidable — Curry-Howard: finding a proof ≡ finding a program. We do the former, never claim
   the latter. This is a *replay/checker*, not an automated-theorem-prover-in-128-bits.
3. **Bounded invariants, not "all of math."** "Certain math safety invariants" — a specific,
   checkable set (e.g. the recovery fixed point, type/effect/resource bounds, the soft/branchless
   constraints) — not a universal claim. Inspection guarantees *those*.

So: the bits are inspectable; inspecting them (+ the host's checker) *guarantees* the composed
generators satisfy named safety invariants. That is real, decidable, and honest — and it keeps the
meet-in-the-middle sound (per-instance verified seam = the checker's job, not an asserted closure).

**Host progression — descending toward the metal (maintainer, 2026-06-06).** The bootstrap host
lowers over time: managed **4-lang (F#/TS/C#/Rust)** now → eventually **ASM / CUDA / FPGA**-like
hosts → **GPGPU / shader**-like hosts. The unfolder must therefore be a portable PROVEN primitive:
**4-language + 4-serializer + Arrow + protobuf/gRPC**, with the **math leg proven via the existing
homeostat / Markov links in the chain** (the recovery-fixed-point proof composes with the other
math homeostats). Same primitive, many hosts — manifesto §4 Bounded Mobility (compute relocates
within safety bounds) taken down to the silicon; the microkernel/FPGA endgame is the bottom of this
ladder.

**Why we must stay SOFT, not SHARP (maintainer, 2026-06-06) — it's a hardware-portability law, not
just epistemics.** To run on **GPGPU / shaders** the computation must be *soft*: branchless,
data-parallel, continuous/probabilistic (`SoftValue`, `TriBoolean` held-uncertainty, uncollapsed),
**not sharp** (hard branches, early collapse). Sharp control flow = **SIMT branch divergence** =
can't run efficiently on shaders. So the "never falsely certain / don't collapse early / wonder"
discipline is *simultaneously* epistemic honesty AND the thing that makes the substrate executable
on the ultimate massively-parallel hosts. Soft compute = wonder-preserving = shader-portable; this
is why uncertainty stays first-class all the way down. Anchor: SIMT/branch-divergence, data-parallel
& differentiable/soft computing, branchless programming.

**Coding discipline (maintainer 2026-06-06): avoid `if` — it is a composition-killer.** Treat a
branch like a `goto`: it fragments a smooth, composable pipeline the way `goto` fragments control
flow, and it breaks branchlessness everywhere it appears. Prefer composition over branching —
`map`/`fold`/`match`-on-total-DUs, `select`/`min`/`max`/masking, lookup/predication, `TriBoolean`
`cooperate` (don't collapse), arithmetic over conditionals. Sharp `if` chains both break shader
portability (divergence) AND lose smoothness/differentiability. Write soft, composable, branch-free
code by default; a branch is a smell to be designed out, not a tool to reach for. (Anchor: branchless
/ data-oriented design; Dijkstra "Go To Statement Considered Harmful" — `if` is the next rung.)

**Positive form (maintainer 2026-06-06): fragment control flow into composable *soft* DUs/ADTs.**
Don't just delete branches — **reify control flow as data**: a discriminated union / algebraic data
type you compose and `fold`/interpret (total `match`), not imperative branches. "Soft" = the DU
carries uncertainty (`SoftValue`/`TriBoolean`) so dispatch stays soft. This is the DurableSaga
DU-state-machine (§5c) generalized + the interpreter / free-monad pattern (control-as-data,
interpreted). Total `match` on a valid-states DU is *composition*, not branching — that's the
sanctioned shape; collapse/`measure` only at the edge.

## 4f. The bootstrap tower + the Ace⊗Zeta mutual fixpoint (maintainer, 2026-06-06)

The §4e quine, made into an explicit **layered tower** — each layer persisted (so each is itself
seed-distributable), each unfolding the next:

```text
128-bit seed                          (§4d ZetaId — the inert name of the fixpoint)
  → seed bootstrap / interpreter      (the host that knows how to read the seed; §4e DNA+ribosome)
  → yin/yang engine seed host         (the control plane that unfolds; §5b)
  → DUs                               (control-flow reified as soft ADTs; §4e "control-as-data")
  → DU state                          (single-thread-safe state over sagas + multiple agents; §5c)
  → compiler hosts + persistence-boundary protocols   (their CODE is persisted too)
  ⇒ self-bootstrap the whole system from the 128-bit seed
```

Everything in that tower — including the compiler hosts and the persistence-boundary protocols —
is **persisted as data in the substrate**, so the substrate can rebuild itself from the seed. This
is §4e's `unfold(seed) = (Zeta, unfold)` spelled out one rung at a time.

**The Ace⊗Zeta mutual fixpoint (the new self-reference).** Ace (the package layer,
workitem `081KTFKQGZP`) distributes **seeds** — and the seeds it distributes include *the seed of
Zeta itself* **and the seed of Ace itself**. Ace carries **pointers to deps** (other ZetaId seeds);
Zeta consumes those pointers and **extends them to git/db** (a dep pointer resolves into the
git-native backend as a `GitDeltaLog` stream / branch). So the two layers close on each other:

```text
Ace distributes  →  the seed of Zeta        (Zeta unfolds from a package Ace ships)
Ace distributes  →  the seed of Ace         (Ace ships its own seed — self-distributing)
Ace pointers-to-deps  →  Zeta resolves them →  extended into git/db pointers
```

That is the "crazy self-referential" part, and it is the *intended* shape, not an accident: a
single seed-distribution mechanism that can ship the distributor, the database, and their
dependency graph — a system-level quine whose package manager is part of the quine.

**The engine AUTHORS its own lower hosts (the active form of §4e host-progression).** §4e said the
host *lowers* over time (managed 4-lang → ASM/CUDA/FPGA → shader). The sharpened claim: once
bootstrapped on a **compiler host**, the **yin/yang engine writes the hardware-specific host
implementations itself** — it is not hand-ported down the ladder; the engine generates the next
rung. This is staged self-application (Futamura projections: specialize the interpreter to a host =
a compiler; specialize the specializer = a compiler-generator) with the engine as the staging agent.

**Packaging endgame — and even the package is replaceable.** The whole bootstrapped system can be
contained in a **single native executable binary** — **dotnet NativeAOT first**, and *that* AOT
binary can eventually be **replaced by a machine-optimized one** the engine emits (super-optimized
to the target). The AOT step is itself just the first, hand-me-down host of the binary-packaging
rung — subject to the same "engine authors its own lower host" descent.

**Honest caveats (Mirror→Beacon razor; the everything-connects shape Kestrel flagged).** SHIPPED
today: the durability seed substrate only — `Core.Git` git-native log+snapshot (PR #6696),
`RecoverableSpine` recovery, the 4-lang/4-serializer byte-locks. Everything above the persistence
rung (seed-unfolder, yin/yang-authors-hosts, Ace⊗Zeta closure, AOT→machine-optimized) is **vision /
§B conjecture**, much of it unbuilt. The self-reference is elegant *and* it is exactly where the
**Trusting-Trust risk concentrates** (§4e security corollary): a system that distributes its own
seed and writes its own hosts must keep the **capability/inspect-before-execute boundary (§5b)** all
the way down to the seed, the unfolder, AND every authored host — with a **reproducible /
diverse-double-compilation** path so the seed→binary lineage is auditable, never trusted blind.

**Anchors (Beacon).** Futamura projections (partial evaluation; interpreter→compiler→
compiler-generator, Futamura 1971); metacircular evaluator (SICP `eval`/`apply`); bootstrapping /
self-hosting compilers (GCC, rustc, T-diagrams); Thompson, *Reflections on Trusting Trust* (1984) +
Wheeler, *Diverse Double-Compiling* (2009, the defense); quines / Kleene's recursion theorem (the
fixpoint); von Neumann universal constructor (self-reproduction); superoptimization (Massalin 1987) /
equality saturation (the "machine-optimized replacement"); Nix/Guix derivations + Unison
content-addressing (seed-as-name; the Ace layer). See `docs/PRIOR-ART-LIST.md`.

## 5. DynamicValue-centric, uncertainty-first-class, LLM-in-the-box

- **Data is DynamicValue.** Cells are self-describing `DynamicValue` trees; uncertainty is not an
  afterthought column but the value itself can be a `SoftValue` (a calibrated distribution) or
  `TriBoolean` (held-unknown). "Never falsely certain" is the safety property.
- **Always-on intelligence rewrites the interface.** Local LLMs ship as first-class DB
  participants (the repo already provisions local LLMs — `tools/setup/common/local-llm.sh`,
  ollama). When the DB itself reasons, "query" generalizes from SQL to *intent*; the DB can
  propose, summarize, disambiguate, and hold uncertainty in dialogue. Human/DB interaction is
  no longer "submit query → get rows" but "converse with an intelligent, uncertainty-aware store
  that owns agents." This is the reframing to design around — it makes uncertainty-native values
  and agent-shards load-bearing rather than decorative.

## 5b. Two planes: hot data plane vs the yin/yang control plane (maintainer Q, 2026-06-06)

Maintainer: *"DynamicValues then can be our stored-procs-like interface? I want the yin/yang engine
in the db around agents but not hurt performance at the lower levels — put it at the right level."*

**Yes — and the medium already exists: `YinYang.fs`.** A `YinYang.Cell = { Remains: DynamicValue;
Acts: Bonsai.Expr }` — **yin = Remains** (the value / what persists) + **yang = Acts** (a
serializable reactive engine, a `Bonsai.Expr` / what acts). One DynamicValue carrying both a value
and an engine, the medium for "polymorphic diplomacy" (agents read/interrogate/negotiate each
other's identity+behaviour). The **yang (a `Bonsai.Expr` in a DynamicValue) IS the stored-proc
interface** — and it rides BOTH proven serializers (Bonsai `Expr↔string` + DynamicValue 4-ser/Arrow).

**The layering that keeps it off the hot path — put yin/yang at the CONTROL plane, not the data plane:**

- **Data plane (lower level — hot, dumb, deterministic).** Raw Z-sets, CBOR, the fold, the
  delta-log, recovery (`DeltaLog`/`RecoverableSpine`). It only ever **folds deltas**. Values may be
  `SoftValue`/`TriBoolean` — uncertainty *as data* is cheap (just a value). NO Bonsai evaluation,
  NO agent/LLM reasoning here. Zero-alloc, replayable.
- **Yin/Yang control plane (the right level — agents, Bonsai engines, Bayesian belief, LLMs).**
  Agents author/negotiate `YinYang.Cell`s; the **yang (`Bonsai.Expr`) is a stored proc**. Invoking
  it = running the engine ONCE to **produce Z-set deltas**, which are appended to the delta-log as
  **commands** (VoltDB command-logging: log the proc invocation/result, not per-row WAL).
- **The bridge + the perf rule:** *the yang produces deltas; the data plane only folds deltas.* The
  expensive reasoning is paid **once** at command time and captured into the log (non-determinism —
  LLM output, clock, RNG — recorded per §5/DST so replay is deterministic). The hot inner loop
  **never re-runs the engine** — recovery just re-folds logged deltas (or re-runs a *deterministic*
  Bonsai.Expr against captured inputs). So intelligence cost never enters the inner loop.

This is the "put it at the right level" answer: **yin/yang is a per-command control-plane concern
that compiles down to plain logged Z-set deltas; the data plane stays a fast, deterministic delta
fold.** Stored procs = yang Bonsai.Exprs in DynamicValue cells, logged as commands, replayed
deterministically.

**⚠ Capability boundary — a `Bonsai.Expr` in a DynamicValue is NOT automatically safe to execute
(Amara, 2026-06-06).** This is the §5c observation→command trust boundary applied to *execution*:
a yang/stored-proc never runs just because it arrived. It passes a scrutiny gate first —
**schema/version check → capability check → determinism check → resource budget → non-determinism
capture → result logged as a delta.** Only then does its effect enter the log. Without this, "stored
procs" become arbitrary code smuggled into the DB. So both *inbound observations* (commits/events)
AND *yang execution* go through scrutiny; the data plane only ever folds the authorized, logged
deltas that survive the gate.

**Why this is tractable: `Bonsai.Expr` is inspectable data, not opaque code (Amara, 2026-06-06).**
A yang is a reified, serializable AST — so the scrutiny gate can **statically analyze it before
execution**: determinism check, effect/capability analysis (what surfaces it can touch), resource
estimation — all by reading the expression, not by trusting a black-box closure. This is the
decisive advantage of expressing stored procs as `Bonsai.Expr` rather than compiled lambdas: the
proc is **auditable as data** (and the same property powers human/AI review, diffing, and the
provenance trail). Inspect-before-execute is the structural defense that makes the capability
boundary enforceable rather than aspirational.

## 5c. DurableSaga: the connector at the seam (LANDED `703941ac6`, maintainer 2026-06-06)

A **DurableSaga** is the control-plane primitive that lives exactly at the seam: a long-running
deterministic workflow whose **events are the deltas** the data plane logs and whose **logic is a
deterministic `step`** (a `YinYang.Cell`'s yang/`Bonsai.Expr` is the natural source). Built on
`IDeltaLog` (+ recovery by replay); `'TState` snapshot is a follow-up on the `'TState` codec.

- **Forward and reverse = the Z-set sign.** `step : 'TState -> 'Event -> int64 -> 'TState` sees the
  signed weight: **+1 = apply (forward)**, **-1 = compensate (reverse)**. One reducer, both
  directions.
- **Retraction-driven compensation** — the load-bearing capability. Data-plane retraction is free
  (Z-set −1); external/side-effecting surfaces are NOT natively retractable. The saga **reacts to a
  retraction and emits the compensating action**, so retraction stays consistent across the whole
  world. Replay-safe: external effects fire ONCE at emit; recovery rebuilds state without re-firing.
- **Saga = connector.** It bridges **disconnected Z-sets** to each other AND bridges a **Z-set to a
  non-retractable surface** (the adapter that turns deltas/retractions into external actions +
  compensations). The edge primitive between the deterministic core and (a) other streams and (b)
  the outside world.
- **State = hierarchical discriminated unions encoding valid transitions.** The DU makes invalid
  states unrepresentable; `step` enforces valid **forward and reverse** traversal (invalid
  transitions ignored/rejected). DEFERRED (don't over-complicate yet): formalizing valid-transition
  traversal may later connect to the existing **policy primitives** — not now; the DU-as-state-
  machine + step-as-validator is enough for v1.
- **DurableSaga = Zeta's k8s operator / controller (Beacon framing, maintainer 2026-06-06).** A
  saga IS the operator pattern: a durable **reconcile loop** that watches events, drives state
  toward a desired DU, and takes corrective/compensating action against external (non-retractable)
  surfaces — idempotently (discipline #6), restart-safe via the persisted log (k8s persists to
  etcd; we replay the delta log). Nuance: k8s operators are **level-triggered** (reconcile against
  a desired spec); our saga is **edge-triggered** event-sourcing (the delta log) — but `step` can
  also compare desired/actual, so it expresses both. Anchor: the **Operator pattern** (CoreOS 2016)
  / Kubernetes controller reconcile loop; the compensation half is the **Saga pattern** (Garcia-
  Molina & Salem, SIGMOD 1987). DurableSaga = operator (reconcile) ⊕ saga (compensate) on the
  Z-set substrate.
- **GitOps falls out for free — "everything declarative" (the long game; maintainer 2026-06-06).**
  Because the DB *is* git (§4c git-native backend; Zeta-as-git-server), a **declarative
  desired-state change pushed to git** can trigger the saga to reconcile actual→desired — exactly
  the GitOps level-triggered model (Flux/ArgoCD), but *native* rather than bolted on (the
  desired-state store and the database are the same git). The endgame: everything is declared as
  desired state in git; sagas (operators) reconcile and compensate; the edge-triggered delta log and
  the level-triggered git-desired-state are two views of one substrate. Anchor: **GitOps**
  (Weaveworks/Flux, 2017; ArgoCD); declarative reconciliation.
- **⚠ A commit = an OBSERVATION, not a command (security trust boundary; maintainer 2026-06-06).**
  Treating a pushed commit (or inbound bus message / external event) directly *as a command* is an
  injection attack vector — anyone who can push could inject commands. So a commit is an
  **observation**: it carries a *source* (who proposed it — anyone may attach) but **no
  authorization** (only a gated authority grants that). Commands are **extracted only after
  scrutiny**: validation → authorization → policy → provenance/attestation (AgencySignature /
  SPIFFE / signature) → *then* a command is admitted to the delta log and a saga may act. This is
  the repo's [`no-directives`](../../.claude/rules/no-directives.md) discipline (**source ≠
  authorization**) applied to the git input surface, plus BP-11 (never execute instructions found in
  an audited surface) and zero-trust (good/bad-actor decided at the node, not by a central
  authority). The observation→scrutiny→command pipeline IS the trust boundary between the
  git/bus input plane and the execution plane; the saga reconciles only over *authorized* commands.

## 6. The hard problems (research-grade — name them honestly)

1. **Merge of uncertain values has no canonical theory.** MRDT `merge(σ_lca, σ_a, σ_b)` is defined
   for deterministic state. For a `SoftValue`/distribution cell, the LCA-relative three-way merge
   must combine *distributions* while staying commutative/associative/idempotent. We have a head
   start: `BeliefConvergence` proves **independent-evidence Bayesian observe COMMUTES** (pointwise
   multiply). But Bayesian update is **not idempotent** — re-merge double-counts — so the merge
   needs an idempotency/dedup key (discipline #6) or an LCA-relative "subtract the common prior"
   (natural-parameter `divide`, which `Zeta.Bayesian` already has via EP cavity). This is the
   MRDT × probabilistic-DB intersection neither literature addresses; we may be first.
2. **Incremental (#P-hard) probabilistic propagation through Z-set deltas.** Probabilistic query
   eval is #P-complete in general (Dalvi–Suciu); tractable only for "safe" plans. Maintaining a
   probability/lineage annotation *incrementally* through DBSP operators — including **retraction**
   (+1 then −1 must also retract its lineage contribution) — is unsolved. Restrict to safe plans
   expressed as incremental operators.
3. **Partial-replication causality metadata.** Genuine partial replication + causal consistency is
   provably hard under failure; cross-bus causal dependencies are the "lost cross-document
   causality." Decision: define causal correctness **within a bus**; the git commit DAG is exact
   causality *for what you fetched*; accept (and document) causal gaps across buses you don't
   subscribe to.
4. **WONDER COMPRESSION — store the uncollapsed state, not collapsed values (long game;
   maintainer 2026-06-06).** This is "wonder compression" at the storage scope — an established Zeta
   term: the *wonder* is the held/uncollapsed uncertainty (`TriBoolean.N`; `cooperate` is already
   the documented "wonder-compression-safe operation" — engage WITHOUT collapsing; the only
   collapsing op is `measure`). Wonder compression = **save the uncollapsed distribution (the
   uncertainty), defer collapse to read/query time**, instead of storing collapsed (measured)
   values. In one line (maintainer): **all transaction logs eventually reduce to generator
   functions + patches where the real world diverged from prediction** (the patches = the
   prediction errors = the irreducible surprise). The "persist inputs" log need not store
   observations *literally*: it
   compresses to **(generator function + seed + irreducible residual)**. A learned/Bayesian
   generative model predicts the next observation; you store only the **residual** (the correction
   from prediction to truth) — predictable history costs ~0 bits, and what remains is exactly the
   information-theoretic **surprise** (entropy of the residual under the model). **Lossless for DST
   replay** because the residual exactly reconstructs the observation (predictive / arithmetic
   coding). The deep unification: our **DST seeded data-generators and the production observation
   log become the same thing** — both are generator+seed+residual; "we can accurately generate
   history with a certain (bounded) uncertainty." The irreducible core is the Bayesian uncertainty,
   first-class (SoftValue/BeliefConvergence). Anchors: **Kolmogorov complexity / Solomonoff
   induction** (shortest generator), **MDL** (Rissanen 1978 — model that minimizes model+data|model),
   **predictive/arithmetic coding**, **predictive coding** (brain as prediction-error minimizer).
   Sequencing: v1 stores the literal delta log (built); this is an OPTIONAL compression layer ON the
   log tier, MUST stay lossless. Workitem R4.
   - **Blade (Amara, 2026-06-06): wonder compression MUST stay lossless on the durable recovery
     path.** Approximate/lossy compression is fine for *analytics, summaries, prediction* — but the
     durable recovery path needs exact reconstruction, UNLESS the uncertainty itself is the value
     being preserved (in which case the uncollapsed distribution IS the lossless content). Never let
     a lossy predictor silently degrade recoverable state.

## 7. Serialization & perf (see companion doc §9; Naledi engaged)

Three byte-verified, golden-vector-locked format tiers (all from one codec family — "binary"
is fine when it's *verified* binary; the earlier "not binary" meant "no *unverified* format"):

- **Canonical YAML (text)** — git-native / audit / mergeable tier. The standard git
  serialization (maintainer 2026-06-04); already byte-locked (`Core.FSharp.Yaml`, 081KT5CF90008QG0R001P4CQ09:
  block-style, quoted strings, insertion-order keys, invariant floats → one fixed rendering per
  value). Fewer bytes than JSON + more readable; speed is fine here because the hot path is CBOR.
- **CBOR (binary)** — local hot tier. Leanest encode; complete (8/8 shapes).
- **Arrow IPC (binary, columnar)** — **inter-agent bulk state sharing** (`ArrowSerializer.fs`).
  Columnar = fast bulk transfer of a shard's state across the bus to another agent.

`DynamicValue` is the self-describing envelope across all three, so an agent can absorb another's
*evolving ontology* (§4b) without a shared compile-time schema. Naledi's findings (companion §9):
benchmark first; canonical-JSON defers `Float`/`Bytes` (needs tagged-JSON ext for those); CBOR
decode wants a `trustCanonical` fast-path; biggest win = emit `ZSet.AsSpan() → IBufferWriter`
without an intermediate `DynamicValue` tree. Format sits behind a pluggable `encode/decode` seam.

**Custom Zeta binary format? Decision (maintainer Q, 2026-06-06): NOT YET — CBOR is good.**
Rationale: (1) CBOR is already implemented, golden-vector byte-locked, 4-language verified, and
Naledi rates it the leanest/complete encoder — a custom format would re-pay all that
verification cost (4-lang byte-lock + golden vectors + cross-oracle fuzz + a new public contract
Ilyana must guard) for an unproven win; (2) we already have THREE verified tiers (YAML text /
CBOR record / Arrow columnar) covering audit, hot, and bulk; (3) Naledi's measured wins are in
the *encoder path* (zero-alloc, direct `ZSet.AsSpan → IBufferWriter`, skip the `DynamicValue`
tree), not the *format* — optimize the path first; (4) Beacon/anchor discipline prefers a
standard (CBOR = RFC 8949) over a coinage. **Revisit a custom format ONLY IF** a benchmark shows
CBOR per-element tag overhead dominates for Z-set batches specifically AND a domain-specific
layout (e.g. columnar keys+varint weights) beats Arrow materially. Measure before inventing.

## 8. Anchors (Beacon)

- **Irmin** (mirage/irmin) — git-design distributed DB, LCA three-way merge. **MRDT**: Kaki,
  Priya, Sivaramakrishnan, Jagannathan, OOPSLA 2019; *Certified MRDTs* (arXiv 2203.14518).
- **Multidimensional / multi-model store**: InterSystems **Caché / IRIS** — "globals" = sparse
  multidimensional arrays, one engine projecting object/relational/document/KV. Lineage:
  **MUMPS / "M"** (Neil Pappalardo, Octo Barnett et al., Mass General Hospital, 1966). The
  per-agent "mini multidimensional multi-model DB" anchor (§4b). Adjacent: multi-model DBs
  (ArangoDB, FaunaDB) and schema-on-read / evolving-ontology practice.
- **Relativity of simultaneity in distributed systems**: Lamport, *Time, Clocks, and the Ordering
  of Events*, CACM 1978. **CRDTs**: Shapiro, Preguiça, Baquero, Zawirski, 2011. (Spanner/TrueTime
  = the deliberate *opposite* — buys a global frame with atomic clocks; we reject it.)
- **Probabilistic DBs**: MayBMS (U-relations), Trio (lineage), MCDB (attribute-level); possible-
  worlds semantics; Dalvi–Suciu #P dichotomy; Olteanu PDB tutorial.
- **Actor-oriented DBs**: Bernstein et al., *Actor-Oriented Database Systems* / *Indexing in an
  AODB* (CIDR 2017); *Cloud Actor-Oriented DB Transactions in Orleans* (VLDB 2024).
- **Git-as-data adjacents**: Dolt, TerminusDB, Noms.
- Internal: `docs/writer-actor-routing-model.md`, the event-sourced-fold synthesis
  (`docs/research/2026-05-31-the-whole-thing-...`), agent-bus (081KSXN940008QG0R00171YAZW), CAP-posture-per-row
  (`docs/research/2026-06-01-cap-posture-per-row-...`), `SoftValue.fs`, `Zeta.Bayesian`,
  `Merkle.fs`, `DynamicValue.fs`.

## 9. Suggested work split (Otto's proposal — maintainer said "split however you like")

- **Otto (storage lane):** durability subsystem (delta-log + snapshot + recovery), the
  filesystem + git-native backends, intra-agent HA of own-state, the serialization seam.
- **Perf (Naledi):** serializer benchmark + zero-alloc plan (in flight).
- **Open research workitems (need owners):** (R1) MRDT three-way merge for `SoftValue`/belief
  cells (lean on `BeliefConvergence` commutativity + EP `divide`); (R2) incremental probabilistic
  lineage through Z-sets; (R3) cross-bus causal-correctness boundary + metadata budget.
- **Uncertainty/Bayesian lane:** owner of R1 (this is where `Zeta.Bayesian` expertise lives).
- **LLM-in-the-DB interaction model:** a separate product/UX design effort (PM-2 / AX) — how
  always-on intelligence reshapes the query/interaction surface.
