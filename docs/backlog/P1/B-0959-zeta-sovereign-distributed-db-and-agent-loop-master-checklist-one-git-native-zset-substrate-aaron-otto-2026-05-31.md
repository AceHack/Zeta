---
id: B-0959
priority: P1
status: open
title: Zeta sovereign distributed-DB + agent-loop MASTER checklist — one git-native ZetaId Z-set substrate (algebra ladder · observe loop · git-native bus · distributed time · 4-oracle)
effort: XL
ask: aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-05-31
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
