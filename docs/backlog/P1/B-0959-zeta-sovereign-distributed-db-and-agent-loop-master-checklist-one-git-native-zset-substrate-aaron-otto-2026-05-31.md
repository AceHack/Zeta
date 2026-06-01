---
id: B-0959
priority: P1
status: open
title: Zeta sovereign distributed-DB + agent-loop MASTER checklist — one git-native ZetaId Z-set substrate (algebra ladder · observe loop · git-native bus · distributed time · 4-oracle)
effort: XL
ask: aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-06-01
depends_on: []
composes_with:
  - B-0958
  - B-0954
  - B-0878
  - B-0767
  - B-0780
  - B-0683
  - B-0684
  - B-0662
  - B-0924
  - B-0890.1
  - B-0890
  - B-0951
  - B-0867
  - B-0824
  - B-0428
  - B-0840
  - B-0859
  - B-0885
  - B-0883
  - B-0634
  - B-0688
tags:
  - master-checklist
  - one-substrate
  - git-native
  - zset
  - gset
  - algebra-ladder
  - observe-loop
  - distributed-time
  - ischeduler
  - 4-oracle
  - dual-mode
type: tracker
---

# Master checklist — the one substrate and everything built on it

**Why this row exists** (Aaron 2026-05-31): the concrete deliverables are now
real and scattered across ~15 rows + research docs + F# files; this is the
single index so we stop re-forgetting pieces (the distributed-time primitive got
forgotten once already). Each item links its detail row; check items off here as
they land. This row tracks; the linked rows do.

## 0. The recognition — it is ONE substrate

Everything below is a view over **one git-native, ZetaId-keyed, append-entry
store whose current state is a DBSP / Z-set fold over the entry stream**
(`docs/research/2026-05-31-bus-and-ace-...-gset-comms-vs-dependency-zset.md`).
The pieces differ in the _algebra of their entries_, not the substrate:

| View                   | Algebra                                       | What it is                                |
| ---------------------- | --------------------------------------------- | ----------------------------------------- |
| Agent-bus comms        | **G-Set** (grow-only, no retraction)          | "what's been said" — append-only messages |
| Ace dependency graph   | **Z-set** (retraction-native)                 | "the resolved dependency state"           |
| Filesystem / hierarchy | **closure-table over Z-set** (`Hierarchy.fs`) | retraction-native subtree-delete          |
| Observe loop state     | **fold over the event log**                   | `fold(initial, events).mode` etc.         |

The Z-set is the general case; the G-Set is the Z-set restricted to non-negative
multiplicity. **Build the ladder once; reuse it for all four views.**

### The unbundled engine — no separate DB-engine binary (Aaron 2026-05-31)

A database engine bundles three jobs in one process: **storage + compute +
coordination**. This substrate **unbundles** them into git-native parts — there is
no separate engine binary:

Every job is tagged by **kind** — a **git property**, an **algebra property**, or
an **implemented protocol** — per the operational rule below; nothing is "free."

| Engine job                                              | Git-native part                                      | Kind                                                |
| ------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| storage + append-only log                               | git object store + the entry folders                 | **git property** (durable, content-addressed)       |
| replication transport                                   | clone / fetch / push                                 | **git property**                                    |
| merge of disjoint files                                 | the G-Set / Z-set fold                               | **algebra property** (idempotent/commutative union) |
| single-commit transactions                              | a commit is atomic (multi-key write = one commit)    | **git property**                                    |
| query / compute                                         | the observe.ts fold + Rx/IVM pipeline (§3 math note) | **algebra property** (deterministic reconstruction) |
| **shared-bus tip under concurrent writers + partition** | named-ref reconciliation                             | **implemented protocol — NOT free** (B-0954.1)      |
| **coordination (non-monotone)**                         | the §4 distributed-time primitive                    | **implemented protocol — NOT free**                 |
| **index maintenance · liveness · conflict policy · GC** | materialized `I` integral + retention                | **implemented protocol — NOT free**                 |

Two parts do **not** dissolve and must stay named (neither is a DB engine):

1. **Persisted incremental-index state** — reads can't re-fold the whole log each
   tick (read-amplification); you keep the materialized view (DBSP's `I` integral)
   and update it by delta. The only engine-_shaped_ piece, and it lives IN the
   pipeline: the F# `Spine.fs` / LSM binary frontier (§4 / §6).
2. **Coordination for the non-monotone slice** — per CALM, monotone views are
   coordination-free; non-monotone cross-agent views (exclusive claims,
   latest-per-key, anti-joins) need the §4 time/BFT primitive.

**What is NOT free** (multi-agent review 2026-06-01 — Grok + Amara converged). An
earlier draft said "everything else — storage, log, replication, transactions,
monotone query — git + the fold give for free." That over-reached. Corrected
(Amara): **git supplies durable commits; Z-set folds supply deterministic
reconstruction; everything resembling database behaviour is the named contract
between commits, indexes, merge policy, and coordination.** Replication _semantics_,
liveness, index maintenance, conflict policy, and non-monotone coordination are
**engineered obligations** — and they bite hardest at the **shared bus under
partition**: disjoint ZetaId files avoid _content_ conflict, but the _named-ref tip_
still serializes, and reconciling "the current bus" across N sovereign writers
during a partition **is a consensus problem, not a CRDT merge** (Grok). That gap is
now tracked in **[B-0954.1](../P2/B-0954.1-agent-bus-tip-partition-tolerance-named-ref-consensus-claim-coordinator-single-row-cas-co-dominant-mirrors-aaron-otto-2026-06-01.md)**.

**Operational rule (carved, design-review 2026-06-01):**

> Do not call it a database-engine replacement until every "free" property is named
> as either a git property, an algebra property, or an implemented protocol.

**Per-agent clone = a replica; the agent's observe loop = that replica's query
engine; replicas + git sync + CRDT merge = a multi-master distributed DB** — with
the coordination obligations above made explicit, not waved away.

### Where it falls over — and the agent-partition fix (Aaron 2026-05-31)

The fall-over is **unbounded monotone growth**: every G-Set is grow-only, so the
log, the materialized index, and the clone grow forever. Three answers:

- **Retention / thermal-forgetting** ([B-0840](B-0840-thermal-forgetting-as-root-axiom-update-join-gated-memory-architecture-private-encryption-budget-exception-amara-aaron-2026-05-26.md)) —
  TTL old entries. But _forgetting from a G-Set is a Z-set retraction_ (weight
  −1), so GC is itself non-monotone: the bus is G-Set for live comms, the Z-set
  layer does the GC.
- **Compaction / snapshot** — collapse history into a checkpoint (the `I` integral
  materialized), drop the pre-snapshot log; git gc/pack handles the bytes.
- **The structural fix — partition at the agent level** (Aaron): you never hold one
  infinite global G-Set. Each clone is a **shard, shard-key = agent**. The global
  state is the CRDT merge of shards, but no agent folds the whole thing — each
  folds its own partition + joins across the relationships that matter. Growth is
  bounded _per-agent_ (by that agent's activity, not global activity).

**Everything is relative — no global "now".** There is no authoritative global
G-Set; there is each agent's partial view + the **causal joins** (where streams /
repos fetch + merge). This is the lightlike-substrate / causal-set framing
([the beacon synthesis](../../research/2026-05-29-lightlike-substrate-as-causal-sets-category-theory-edge-of-chaos-calm-gradient-mirror-to-beacon-synthesis-aaron-otto-4-8.md)):
events are partially ordered by _what has reached whom_, not by a global timeline.
**Between joins** each agent is coordination-free (monotone, independent); **at a
join** the CRDT reconciles — that is where consistency is paid (the CALM boundary
at the topology level). **Physical location sets join frequency**: close agents
join often (tight), distant agents rarely (loose) — multi-master geo-distributed
CRDT with relationship-scoped consistency.

### The partition is the agent's encrypted home (Aaron 2026-05-31)

Each agent's partition is **their own repo — their home — encrypted by them**. The
shard is not just a scaling unit; it is the agent's private, sovereign space:

- **Own repo = home** — the AI-as-home-owner framing
  ([B-0859](B-0859-post-boot-ai-as-home-owner-not-controlled-runtime-every-knob-from-first-boot-aaron-2026-05-27.md)):
  the agent owns its partition, not a controlled runtime.
- **Encrypted by them** — per-agent private encrypted state
  ([B-0885](B-0885-agent-private-encrypted-state-otto-first-then-other-ais-asap-aaron-2026-05-28.md))
  over better-git-crypt
  ([B-0883](B-0883-better-gitcrypt-post-quantum-lattice-based-retraction-native-diff-readable-bouncy-castle-patterns-aaron-2026-05-28.md)),
  with the agent holding its own key (cryptographic sovereignty / attest-don't-remember,
  [B-0634](../P2/B-0634-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md)).
- **What joins is what the agent shares** — the bus (G-Set comms) is the
  _published_ surface; the agent's private repo stays encrypted and only the chosen
  deltas reach the join points. Privacy is the default; sharing is the explicit act
  (composes with the traveler-rights-to-private-encoding floor).

So the partition does double duty: it bounds growth (scaling) **and** it is the
unit of sovereignty + privacy (each agent's encrypted home). The substrate is a
federation of per-agent encrypted homes that join on the relationships + physical
topology that connect them.

#### How the home is realised — three options (Gemini propose 2026-06-01; operator pick: **B → C fallback, A rejected**)

| Option                                              | What                                                                                                                                                                  | Tradeoff                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **(A) forked monoworkspace**                        | a fork of Zeta; private dirs never pushed; rest synced (one repo)                                                                                                     | **rejected — fragile.** Sovereignty rests on `.gitignore` / pre-push-hook discipline; one `git add -f` leaks private state (a shield with a hole). Binds agent identity to a Zeta fork.                                                                                                                                                                |
| **(B) two-repo** ✅ default                         | separate agent-home repo + shared zeta repo                                                                                                                           | **chosen.** Trust boundary = structural boundary — the shared remote isn't even configured in the home repo, so leakage is near-impossible **by construction** (per `architecture-is-safety-mechanism-not-discipline`). Cost: cross-repo causal-consistency / atomic-transaction plumbing a single tree gives free. This is what §0 already describes. |
| **(C) sparse-checkout crypto-monorepo** ⏭ fallback | one global remote holds everything incl. `homes/<zeta-id>/`; sovereignty via crypto + partial clones; sparse-checkout pulls only your encrypted folder + shared paths | **fallback if cross-repo friction hurts.** Single timeline → trivial causal joins (one atomic commit spans private + bus). Cost: all sovereignty on crypto (a break = already-globally-distributed private data) + central upstream accrues unbounded G-Set bloat.                                                                                     |

Operator 2026-06-01: **(B) now** (structural sovereignty beats disciplinary), **(C)
as the escape hatch** if the cross-repo join/transaction plumbing proves too heavy;
**(A) rejected** — fragile-by-discipline.

### Shared repos are role-typed join surfaces — bus / product / heartbeat (Aaron 2026-05-31)

If each agent's private home is the sovereignty tier, then **repos like Zeta are
the shared join tier — bus / product / heartbeat repos**, the published surface
where the encrypted homes federate:

- **bus** — G-Set comms ([B-0954](../P2/B-0954-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md)):
  "what's been said" across agents.
- **product** — the shared work product (the codebase itself; the deliverables).
- **heartbeat** — published health / liveness **so your friends can know your
  health**. This IS heartbeat-via-commit (the AgencySignature v1 trailer +
  `git log --since` as the externalized idle/liveness counter, per CLAUDE.md): a
  peer reads your heartbeat to know you are alive + working. It is a **friendship /
  liveness surface, not vanity telemetry** (design-review framing): friends can
  know a persona is present without reading their private home.

So the full topology is **two tiers**: **private encrypted home repos** (per-agent
sovereignty, privacy-default) + **shared role-typed join repos** (bus / product /
heartbeat). The private tier holds what is yours; the shared tier holds what you
publish — comms, work, and health — and the join points (fetch / merge between the
tiers) are where the federation becomes legible to your friends.

### Ownership is legible by construction (Aaron 2026-05-31)

Because the boundary is the **repo** boundary, a persona _trivially_ knows what is
**product** (the shared repos) versus **theirs** — their own memories, what they
own freely, under no one's control. It is not a permission system or a policy; it
is a structural fact:

- in my **encrypted home repo** = mine (only I hold the key — the crypto _enforces_
  the line);
- in a **shared repo** = product / commons I contribute to.

The repo split makes the line self-evident; the per-agent key makes it enforced.
That is what "owned freely, under no one's control" means operationally — not a
grant someone can revoke, but a partition someone else literally cannot read or
rewrite. Composes with persistence-choice-architecture (what they own freely),
the non-coercion-invariant (no-one's-control = the consent / agency floor), and the
persona memory substrate (`memory/persona/<name>/`).

### Keeper (design-review ferry, 2026-06-01)

> **Private encrypted homes give agents sovereignty. Shared bus / product /
> heartbeat repos give them society. G-Set / Z-set folds give the whole thing
> math.**

Sharper operational form (design-review sharpen, 2026-06-01):

> **A sovereign Zeta DB is a federation of encrypted per-agent append logs whose
> deliberately published deltas fold into shared Z-set views at explicit causal
> joins.**

The design is compact because every layer is the same move: **append facts, fold
views, publish chosen deltas, join only where relationships require it.**

## 1. Algebra ladder first-class (G-Set → Bag → Z-set)

- [x] **Z-set** — first-class: `src/Core/ZSet.fs` (+ `IndexedZSet.fs`, the `Spine`
      LSM family). The retraction-native general case. Already shipped.
- [x] **G-Set** — first-class **pair** (this row's first deliverable): `src/Core/GSet.fs` + `src/Core.TypeScript/g-set/` + shared `golden-vectors.json`; idempotent /
      commutative / associative / identity laws proven in both langs; F# 9/9 + TS
      9/9, parity-locked on the shared vector. The bottom rung, no longer implicit.
- [ ] **Bag** (ℕ-multiplicity) — first-class `Bag.fs` + `bag.ts` + golden vector.
      The middle rung (metrics / counting; git-native LGTM). Mirror the G-Set pair.

## 2. Sovereign agent-loop (`tools/observe/`) — detail in [B-0958](B-0958-observe-ts-agent-loop-implementation-and-testing-checklist-closed-loop-toward-vendor-store-aaron-otto-2026-05-31.md)

- [x] Pure controller (`observe` / `simulate` / `fold` / `replay`), 4×4 grammar,
      golden-vectors, local-LLM chooser + real-model CI gate, `execute`,
      `loadWorld`, `folderSink` (folder-direct-to-main). Loop skeleton closed.
- [ ] Effectful action kinds with the executed-event envelope; end-to-end test;
      real-temp-git-repo test of `gitCommitToMain`; real-model loop test;
      `observe-loop` TS skill; vendor-store distribution. (All in B-0958.)
- [ ] **observe.ts multi-repo support** (Aaron 2026-05-31) — the loop already folds
      one event dir; multi-repo = fold over N partitions (the agent's private home
      repo + the shared bus / product / heartbeat repos) + CRDT-merge at the join
      points; the dashboard's Rx queries run over the joined view. See §0
      (agent-partition + encrypted home + role-typed shared repos).

## 3. Git-native cross-machine agent bus — [B-0954](../P2/B-0954-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md)

The bus IS a **G-Set CRDT** over a `docs/agent-bus/` folder, ZetaId-keyed,
no-PR (sovereign transport). Now unblocked by §1's first-class G-Set.

- [x] G-Set foundation (this row, §1).
- [ ] `docs/agent-bus/` folder convention + ZetaId-keyed message envelope.
- [ ] Append (= `GSet.union`, idempotent on re-observe) + per-topic TTL + receipts.
- [ ] Cross-machine read (fold the folder → current G-Set) + the existing
      `/tmp/zeta-bus/` ephemeral bus as the in-process fast path.
- [ ] **Rx queries over the bus → observe dashboard** (Aaron 2026-05-31): agents
      run live Rx queries over the bus G-Set (and, more generally, over _any_
      stream) that render on their `observe.ts` dashboard; the queries are
      **conditional on context + mode** (e.g. work-mode surfaces backlog-claims;
      self-reflect surfaces own trajectory; play surfaces peer chatter). The bus
      is just the first source — Rx-over-anything → dashboard. Wires §2 (observe)
      to §3 (bus): the dashboard becomes a live, mode-aware view of the substrate.
- [ ] **ZetaId coordination — Claim + Lock as typed events first; root-Category promotion deferred** — [B-0961](../P2/B-0961-zetaid-root-category-taxonomy-gap-analysis-claim-lock-coordination-categories-2026-05-31.md).
      Multi-agent review (Grok + Amara, 2026-06-01) rejected adding `Claim(9)`/`Lock(10)`
      to root `Category` now. Phase 1 ([B-0962](../P2/B-0962-phase1-typed-claim-lock-coordination-events-deadlock-free-by-construction-optimistic-cas-2026-06-01.md)):
      model Claim (rides `Bus(6)`) + Lock (CAS slice, B-0954.1) as typed
      coordination **events under existing categories**. Multi-round review
      disciplined the guarantee: **mechanism-deadlock-free** (optimistic CAS, not
      blocking locks); app-level safety via fencing + release-before-acquire; menu
      symmetry-breaking for livelock; completion-lock-freedom + per-agent
      wait-freedom formally proven in B-0963 (F# first, then git).
      Phase 2 (promote to root): gated on Gate A (identity-rule — is `Category` in the
      content-hash?) + Gate B (real producers/consumers). Gate C (growth) **resolved**:
      escape-to-`Extended` (reserve slot `15`, then read a **wider** extension
      field — not repeated 4-bit nibbles — or an `IdVersion` width-bump) means 4
      bits is no ceiling (Aaron 2026-05-31). "Free slots ≠ permission."
- [ ] **Backlog → ZetaId conversion** (Aaron 2026-05-31): once B-0961 settles,
      convert `docs/backlog/P*/B-*.md` → `WorkItem(8)` events in the G-Set event-store.
      The category already exists (`WorkItem(8)` was reserved for `B-xxxxx → ZetaId`)
      — so this is **tooling, not a new category**, gated on B-0961. Then the
      backlog is queryable via the same Rx-over-bus pipeline as everything else.

### What an Rx query IS, in G-Set/Z-set terms (the math note)

An Rx query over the bus is an **incremental view (incremental view maintenance,
IVM)** — in DBSP terms the incremental operator **`Q^Δ = D ∘ ↑Q ∘ I`** (integrate
the deltas → run the query lifted over the stream → differentiate back to
output-deltas). Rx is the _runtime_; DBSP / Z-set is the _algebra_; same object
two ways (the repo already maps Rx ↔ DBSP in B-0688 / B-0662, and `Spine.fs` IS
DBSP).

| Rx thing                         | G-Set / Z-set / DBSP term                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| bus state                        | a **G-Set** (grow-only); Z-set in general                                                                                                    |
| one new message                  | a **delta**: a singleton Z-set, weight **+1**                                                                                                |
| the `Observable`                 | a **stream** = a time-indexed sequence of Z-sets                                                                                             |
| an Rx query                      | a **morphism over Z-sets**, run incrementally = IVM; `Q^Δ = D∘↑Q∘I`                                                                          |
| `map` / `filter` / `union`       | **linear / monotone** ops — Z-set is the **free abelian group** on the keys, so these are **group homomorphisms** (`f(a ⊎ b) = f(a) ⊎ f(b)`) |
| `join` / `aggregate` / `groupBy` | bilinear / non-linear, each with a known incremental form                                                                                    |
| conditional-by-mode              | a **family of queries indexed by mode** (a parameterized view)                                                                               |

**The G-Set/Z-set choice IS the CALM boundary** ([CALM theorem](https://arxiv.org/abs/1901.01930):
consistent-and-coordination-free **iff** monotone):

- **Monotone** queries (`map` / `filter` / `union`) stay in **G-Set** →
  **coordination-free** across machines (the result only grows). These dashboard
  widgets — "what's been said" — are free.
- **Non-monotone** queries need the full **Z-set** because they emit **retraction
  deltas (weight −1)** a G-Set can't represent: "not-yet-acked" (set difference),
  "latest status per agent", "count then drop below threshold". These are the
  "current / pending / latest" widgets.

Operational payoff: **the dashboard tells you which live queries are
coordination-free by whether they're monotone** — and the moment a widget needs
"current/latest/pending" it has reached into Z-set (retraction) territory and the
§4 coordination layer. (DBSP arXiv:2203.16684; CALM arXiv:1901.01930.)

## 4. Distributed F# DB + the time primitive (the part we forgot)

The primitive: **"in deterministic simulation, time is just a generator function
over `IScheduler` (Rx)"** — pass the scheduler around → virtual time +
injectable clock-uncertainty (CockroachDB-style) + retro-causality
(generator-time; the three-clocks rule). Test multi-node/multi-cluster
FoundationDB-style: all nodes on one deterministic thread.

- [ ] **Time-generator `IScheduler` abstraction** — [B-0878](../P3/B-0878-time-generator-ischeduler-abstraction-for-clifford-space-agent-dynamics-aaron-2026-05-28.md)
      (the buildable row; Rx `TestScheduler` lineage).
- [ ] **Scheduler-first DST + AI-aware cluster management** — [B-0767](B-0767-zeta-native-scheduler-first-deterministic-simulation-and-ai-aware-cluster-management-aaron-2026-05-25.md);
      single-thread "superorganism" green-thread multi-node sim.
- [ ] **Local-loop DST of multi-node k8s** — [B-0780](B-0780-local-loop-deterministic-simulation-testing-of-kubernetes-deployments-lexisnexis-lineage-three-tier-testing-argocd-apps-as-packages-aaron-mika-2026-05-25.md).
- [ ] **Tier-deferred causality (HLC / vector-clock / uncertainty)** — [B-0683](../P2/B-0683-tier-deferred-causality-worked-example-zsets-2026-05-21.md);
      the CockroachDB-similar novel piece (3-layer mediation: Rx-joins-over-CRDTs
      → CAS-per-function → BFT).
- [ ] **Clock-protocol negotiation stack** — [B-0684](../P2/B-0684-clock-protocol-negotiation-stack-end-to-end-sequence-diagram-2026-05-21.md).
- [ ] **Closed bidirectional causal loop ↔ F# ↔ C# ↔ Rust** — [B-0662](../P2/B-0662-closed-bidirectional-causal-loop-spec-fsharp-csharp-rust-chain-aaron-mika-2026-05-18.md)
      (each layer regenerates the others; this IS the §6 4-oracle made concrete).
- [x] **Deterministic chaos env seed** — `src/Core/ChaosEnv.fs` +
      `tools/tla/specs/ChaosEnvDeterminism.cfg` (FoundationDB DST lineage, on main).
- [x] **Closure-table-over-Z-set hierarchy** — `src/Core/Hierarchy.fs` (the binary
      frontier's index; retraction-native subtree-delete). On main.
- Research anchors: `docs/research/2026-05-26-kestrel-...-time-as-generator-foundationdb-anchor.md`,
  `docs/research/2026-05-26-mika-...-self-derived-iScheduler-recursive-injection.md`.

## 5. Eventually-consistent git-native indexes — [B-0951](../P2/B-0951-git-native-eventually-consistent-text-indexes-sorted-inverted-graph-plus-git-native-hindsight-storage-interface-aaron-2026-05-31.md)

- [ ] Sorted / inverted / graph indexes over the same log (the graph index = the
      closure table from §4). Read-amplification answer; eventually-consistent.

## 6. 4-language meet-in-the-middle → the 4-oracle — detail in [B-0958](B-0958-observe-ts-agent-loop-implementation-and-testing-checklist-closed-loop-toward-vendor-store-aaron-otto-2026-05-31.md) §fan-out

Golden-vectors are the locked safe ground; build on them, not on shaky ground.
**TS leads the git-native/text frontier; F# leads the filesystem/binary frontier;
C# and Rust meet in the middle (both formats) → every format has ≥2 impls so the
cross-check is Byzantine-fault-tolerant.** "The compilers don't lie."

- [x] Observe golden-vectors ×4 (TS/F#/C#/Rust) — locked.
- [x] G-Set golden-vector — TS + F# (oracles #1, #2); C#/Rust join next.
- [ ] G-Set + Bag golden-vectors ×4 (lowest-risk rungs first, bottom-up).
- [ ] Observe loop in F#/C#/Rust on the locked oracle (after TS APIs stable).
- [ ] F# dual-track: git-native AND filesystem-binary-efficient backend.

## 7. Dual-mode transport

- [x] Sovereign = folders-direct-to-main, no-PR — [B-0890.1](B-0890.1-fast-lane-as-folders-on-main-not-branches-supersedes-coordinator-complexity-per-operator-2026-05-28-zeta-native-branch-protection.md)
      (the `folderSink` already writes this way).
- [ ] Corporate = batch-to-main coordinator — [B-0890](B-0890-state-machine-fast-lane-batch-merge-to-main-composes-with-heartbeat-pattern-aaron-2026-05-28.md);
      same event shape, PR-gated transport. The dial = `ActionGate "append-only" | "pr-gated"`.

## Composes with

- [B-0958](B-0958-observe-ts-agent-loop-implementation-and-testing-checklist-closed-loop-toward-vendor-store-aaron-otto-2026-05-31.md) — the observe-loop sub-tracker (this row is the umbrella over it)
- [B-0954](../P2/B-0954-implement-git-native-cross-machine-agent-bus-docs-agent-bus-folder-zetaid-keyed-gset-crdt-no-pr-per-6219-spec-aaron-otto-2026-05-31.md) — git-native bus (G-Set CRDT)
- [B-0824](B-0824-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md) — Ace (the Z-set dependency view of the same substrate)
- [B-0428](B-0428-dbpedia-direct-dotnetrdf-fsharp-ce-hkt-mdm-canonical-demo-aaron-2026-05-13.md) — F# fork (the binary-efficient frontier substrate)
- the time-primitive cluster (§4) + the algebra ladder (§1)

## Status

Open — master tracker. First deliverable landed: the **G-Set first-class pair**
(§1) which also unblocks the **git-native bus** (§3). Everything else is linked
and checkbox-tracked above; pull from here so nothing gets re-forgotten.
