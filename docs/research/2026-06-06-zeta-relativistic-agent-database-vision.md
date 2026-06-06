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
  `git push`/`pull` IS a DB commit/read.
- **FUSE filesystem** (existing backlog) exposes the in-DB filesystem to the OS as a mountable
  fs — so ordinary tools see the Z-set-backed filesystem.
- **Microkernel** (endgame): the whole substrate targets a microkernel — Zeta as the OS, with the
  DB/git-server/FUSE-fs as the storage+naming layer.

This is the "everything is a fold over Z-sets, at every scale" recursion (manifesto §9 Recursive,
§10 Self-similar) taken to its conclusion: data, schema/ontology, filesystem, version history, and
eventually the OS are all the same retraction-native Z-set substrate.

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

## 7. Serialization & perf (see companion doc §9; Naledi engaged)

Three byte-verified, golden-vector-locked format tiers (all from one codec family — "binary"
is fine when it's *verified* binary; the earlier "not binary" meant "no *unverified* format"):

- **Canonical YAML (text)** — git-native / audit / mergeable tier. The standard git
  serialization (maintainer 2026-06-04); already byte-locked (`Core.FSharp.Yaml`, B-1011:
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
  (`docs/research/2026-05-31-the-whole-thing-...`), agent-bus (B-0954), CAP-posture-per-row
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
