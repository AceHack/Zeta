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

Text canonical (`DynamicValue` canonical JSON) for the git-native/audit tier; **CBOR binary
perf mode** for the hot tier — **both are byte-verified golden-vector codecs**, so "binary" here
is fine (it earlier meant "no *unverified* binary"). Perf-engineer (Naledi) is analyzing
CBOR vs canonical-JSON vs `Checkpoint.toBytes` allocation/throughput to pick the seam; format
sits behind a pluggable `encode/decode` contract so we land the mechanism first and lock format
after measurement.

## 8. Anchors (Beacon)

- **Irmin** (mirage/irmin) — git-design distributed DB, LCA three-way merge. **MRDT**: Kaki,
  Priya, Sivaramakrishnan, Jagannathan, OOPSLA 2019; *Certified MRDTs* (arXiv 2203.14518).
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
