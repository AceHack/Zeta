---
id: 081KSE6WT0008QG0R00049EFBD
priority: P1
status: open
title: Slow-replace all dependencies (and Kubernetes itself) with binary-compatible Zeta-native F#/C#/Rust implementations — CNI, CSI, CRI, operators
effort: XL
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R00063R6HB
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KSE6WT0008QG0R002CC6314
  - 081KSE6WT0008QG0R003D199HE
  - 081KSE6WT0008QG0R002E6P098
  - 081KSE6WT0008QG0R001RG4FXD
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R003FG3E8R
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0009YYNP4
tags: [strategy, k8s, cni, csi, cri, fsharp, csharp, rust, binary-compatibility, long-game, ownership]
---

## Problem

Aaron 2026-05-25 mid-iteration-2-wait, naming the long-game
endgame after 081KSE6WT0008QG0R00063R6HB (ServiceTitan route — adopt existing
standards now): *"we slowly replace all our dependencies and
kubernetes itself this way with our own f# implimentation or c#
or rust replacable and binary compatable even cni csi all the
k8s interfaces over time and operators."*

The two-phase strategy:

**Phase 1 (today + near-term)** — 081KSE6WT0008QG0R00063R6HB ServiceTitan route:
adopt existing standards (k8s, CNI, CSI, OAM, Crossplane,
KEDA, DAPR, etc.) for adoption velocity + ecosystem reach.
Don't compete with the standards layer.

**Phase 2 (slow + incremental)** — this row: replace each
adopted dependency with a Zeta-native F#/C#/Rust
implementation that is **binary-compatible** with the original
interface contract. Operator swaps Zeta-native implementation
for upstream OR vice versa without changing any operator-facing
config or workload manifest.

The result over time: Zeta operators run a cluster where every
layer is Zeta-native + reproducible + DST-verifiable +
algebra-grounded, but operators using only k8s tooling can
swap in upstream implementations at any layer without
disruption. Best of both: ownership + interoperability.

## Target

Per-layer binary-compatible replacement roadmap:

| k8s interface | Upstream impls (today) | Zeta-native replacement target | Language |
|---|---|---|---|
| **CRI** (Container Runtime Interface) | containerd / cri-o / docker | `Zeta.K8s.CRI` — image pull + container lifecycle + cgroups v2 | Rust (kernel-adjacent perf) |
| **CNI** (Container Network Interface) | Cilium / Calico / Flannel / Weave | `Zeta.K8s.CNI` — eBPF-based; algebra-grounded routing | Rust (eBPF + kernel) |
| **CSI** (Container Storage Interface) | Longhorn / Ceph-CSI / Rook | `Zeta.K8s.CSI` — algebra-grounded snapshots + replication | F# / Rust hybrid |
| **Device Plugin API** | nvidia-device-plugin / amd / intel | `Zeta.K8s.DevicePlugin` — hardware-topology-aware (lstopo) | F# |
| **Scheduler Extender** | kube-scheduler default | `Zeta.K8s.Scheduler` — DBSP-driven multi-criteria scheduling (081KRFA460008QG0R0018SN61J etc.) | F# |
| **Admission Webhook** | OPA Gatekeeper / Kyverno | `Zeta.K8s.Admission` — F# DSL policy engine | F# |
| **Operator SDK** | kubebuilder / operator-framework | `Zeta.K8s.Operator` — F# computation-expression-based reconcile loops | F# |
| **API Server** (long-tail) | kube-apiserver | `Zeta.K8s.APIServer` — algebra-grounded; OpenAPI v3 binary-compatible | F# / Rust hybrid |
| **etcd-replacement** | etcd (k3s embedded) | `Zeta.K8s.ConsensusStore` — DBSP + raft, retraction-native | F# / Rust |
| **kubectl** | kubectl | `Zeta.K8s.CLI` — drop-in compatible | F# |
| **Helm** | Helm 3 + OCI | `Zeta.K8s.PackageManager` — Ace-based (081KQZVQW0008QG0R000ZHEN62/081KR2E4K0008QG0R0033WVCXE/081KR2E4K0008QG0R002YE3MMD); Helm-chart compatible | F# |

**Binary compatibility means**: an operator deploying a Pod
manifest doesn't care whether the cluster runs containerd or
`Zeta.K8s.CRI`; the kubelet → CRI gRPC API is identical. The
operator's `kubectl apply -f pod.yaml` works identically. A
NetworkPolicy works identically whether Cilium or `Zeta.K8s.CNI`
implements it. The CSI volume mount works identically whether
Longhorn-CSI or `Zeta.K8s.CSI` provisioned it.

## Why F# + C# + Rust (not just one)

| Language | Where it wins for this scope | Examples |
|---|---|---|
| **F#** | Type-safe algebraic primitives; computation expressions for reconciliation loops; HKT for operator generics; refinement types via F\*-influenced extensions | `Zeta.K8s.Operator`, `Zeta.K8s.Admission`, `Zeta.K8s.Scheduler`, most CRD handlers |
| **C#** | Ecosystem reach for operators using Microsoft stack; Roslyn analyzers for compile-time validation; better library surface for some k8s gRPC paths | C# facade for F# core (per existing Zeta.Core.CSharp pattern); operator tooling, IDE integrations |
| **Rust** | Kernel-adjacent perf (eBPF, syscalls), zero-cost abstractions for CNI/CSI hot paths, safe systems programming where .NET runtime overhead is unacceptable | `Zeta.K8s.CNI`, `Zeta.K8s.CRI`, `Zeta.K8s.CSI` hot paths, eBPF programs |

The language choice per layer is driven by the layer's
constraints (perf, kernel-adjacency, ecosystem expectation),
not by language preference. F# is primary for Zeta substrate
(matches existing `Zeta.Core` substrate); C# for facade/interop;
Rust for systems-adjacent layers where .NET runtime overhead is
operationally unacceptable.

## Why binary-compatible (not parallel substrate)

The substrate-honest argument: **binary compatibility preserves
operator optionality at every layer simultaneously**. Operator
running Zeta cluster can:

- Replace `Zeta.K8s.CNI` with upstream Cilium any time → cluster
  keeps working
- Run vanilla k8s components alongside `Zeta.K8s.*` components
  in mixed mode for incremental migration / validation
- Use upstream `kubectl` to operate Zeta cluster; use Zeta CLI
  for advanced ops
- Audit Zeta implementation against upstream reference impl by
  running both in parallel + comparing behavior

This composes perfectly with 081KSE6WT0008QG0R00063R6HB ServiceTitan route: we
adopted the standards' interfaces for velocity (Phase 1); we
now own the implementations within those interfaces (Phase 2);
operator can swap either direction without disruption.

Without binary compatibility, Zeta-native impls would be a
parallel ecosystem operators have to bet on. With binary
compatibility, operators get optionality + Zeta gets the
ownership + quality benefits.

## Acceptance (this row is the master plan; each layer = sub-row)

- [ ] Master roadmap document at `docs/k8s-replacement-roadmap.md`
      capturing per-layer target language + binary-compatibility
      contract + sequencing + dependencies
- [ ] Per-layer sub-rows (081KSE6WT0008QG0R0016CEE2Z onwards): one row per k8s
      interface; each row carries the binary-compatibility test
      suite + initial implementation scope
- [ ] First Zeta-native layer shipped:
      `Zeta.K8s.Admission` (lowest blast radius — admission
      webhooks are stateless; can be swapped in without cluster
      downtime; F# DSL is a natural fit; immediate substrate
      payoff via Zeta-algebra-grounded policy)
- [ ] Binary-compatibility conformance suite: per-layer test
      suite that verifies Zeta-native impl behaves identically
      to upstream reference impl on every interface call;
      passing = swappable
- [ ] Mixed-mode deployment story: documented patterns for
      running upstream impl + Zeta-native impl side-by-side
      in same cluster (canary scope; incremental migration)
- [ ] Operator UX: operator declares "use Zeta-native CNI"
      via a single k8s manifest field; cluster reconciles
- [ ] AI-trainable substrate: every Zeta-native impl publishes
      decision rationale + algebra grounding + DBSP composition
      as substrate; per 081KSE6WT0008QG0R0015ZF2G6 (AI training data) AI systems
      can learn from the impl + the binary-compat conformance
      suite
- [ ] Migration tooling: per-layer migration scripts for
      operators wanting to fully replace upstream impl with
      Zeta-native (or vice versa)
- [ ] Documented invariant: at no point can operator's
      workloads stop working because of a Zeta-native swap;
      conformance suite + canary deployment + automatic
      rollback are load-bearing

## Strategic + ARC-AGI composition

This row + 081KSE6WT0008QG0R0015ZF2G6 (open reference) + 081KSE6WT0008QG0R003FG3E8R (telemetry flywheel) +
081KSE6WT0008QG0R000WVYAJ2 (cloud-native plugins) + 081KSE6WT0008QG0R0009YYNP4 (CNCF force multipliers) +
081KSE6WT0008QG0R00063R6HB (ServiceTitan route) compose into the full
**adopt-then-own-incrementally** strategy:

- **Adopt** for velocity (081KSE6WT0008QG0R00063R6HB): use existing standards;
  spread fast
- **Compose coherently** (081KSE6WT0008QG0R0009YYNP4): make CNCF + cloud-native
  ecosystem work well together via Zeta's coherent install +
  reference + telemetry
- **Own implementations incrementally** (THIS ROW): replace
  each upstream impl with Zeta-native binary-compatible impl
  over time; operator inherits ownership benefits without
  disruption
- **Open reference** (081KSE6WT0008QG0R0015ZF2G6): everything Zeta builds is open;
  AI can train on it
- **Self-improving** (081KSE6WT0008QG0R003FG3E8R): in-the-wild installs surface
  bugs + improvements; LLM-generated PRs close the loop

The ARC-AGI parallel sharpens: every Zeta-native impl ships
WITH its binary-compatibility conformance suite. AI systems
competing on the cluster-infrastructure benchmark can be scored
on: can AI X produce a binary-compatible CNI faster / better /
more correctly than AI Y? The benchmark is concrete + verifiable +
has a forcing function (real workloads run on the impl).

## Cluster benchmark / ARC-AGI scenario expansion (081KSE6WT0008QG0R0015ZF2G6)

Each binary-compatibility replacement becomes a benchmark
scenario in 081KSE6WT0008QG0R0015ZF2G6's ARC-AGI-style competition:

- **Scenario**: "Given upstream containerd's CRI gRPC spec +
  Zeta-native scaffolding, implement a CRI that passes the
  conformance suite + handles 10K-pod scale + has zero
  unintended behavior changes"
- **Scoring**: conformance pass rate + scale benchmark +
  semantic-diff against upstream behavior + bug count over
  90 days
- **Reference impl**: Zeta's first-cut F#/Rust implementation
- **Public leaderboard**: AI systems compete to produce better
  implementations against the same conformance suite

This turns the slow-replace strategy INTO the benchmark
catalog. Every replacement layer = one benchmark scenario.

## Composes with

- 081KRFA460008QG0R0018SN61J — DBpedia + F# fork for AI safety (the F# substrate
  base this row's implementations build on)
- 081KSE6WT0008QG0R002CC6314 — ontology negotiation (the cross-interface
  translation substrate; Zeta-native impls preserve the
  semantic contract per ontology)
- 081KSE6WT0008QG0R003D199HE — git-native per-machine state + GitOps reconciliation
  (the substrate Zeta-native operators reconcile against)
- 081KSE6WT0008QG0R002E6P098 — kro/Crossplane/Koreo (the existing CRD-substitution
  substrate Zeta-native operators plug into)
- 081KSE6WT0008QG0R001RG4FXD — KubeVela/OAM (Zeta-native operators can fulfill OAM
  Components without operator-facing changes)
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (the install path bundles
  the chosen impl per layer; operator can swap at install time
  or runtime)
- 081KSE6WT0008QG0R0015ZF2G6 — open reference architecture (each replacement layer
  IS a benchmark scenario)
- 081KSE6WT0008QG0R003FG3E8R — AI auto-submit-back telemetry (in-the-wild bug
  reports drive per-layer impl improvements)
- 081KSE6WT0008QG0R000WVYAJ2 — cloud-native plugins fit Zeta interfaces (sharpened
  by this row: the "Zeta interface" is the EXISTING standard
  interface per 081KSE6WT0008QG0R00063R6HB; Zeta-native impls are alternative
  binary-compatible providers)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF force multipliers (the projects we adopt today
  become the implementations we replace over time)
- 081KSE6WT0008QG0R00063R6HB — ServiceTitan route (this row IS Phase 2 of the
  ServiceTitan strategy)
- F# fork for AI safety substrate (PR #2928 / #2935 / #2936) —
  this row applies the same pattern (F#-native binary-
  compatible drop-in replacement) at k8s-ecosystem scope

## Sequencing (suggested; refine per sub-row)

| Wave | Layers | Why this wave |
|---|---|---|
| **1 (lowest blast radius)** | `Zeta.K8s.Admission`, `Zeta.K8s.PackageManager` (Helm-compat), `Zeta.K8s.CLI` (kubectl-compat) | Stateless / sidecar / client-side; can swap without cluster downtime; immediate F# substrate payoff |
| **2 (operator surface)** | `Zeta.K8s.Operator` SDK, `Zeta.K8s.DevicePlugin`, `Zeta.K8s.Scheduler` extender | Pluggable substrate; operators write CRDs that Zeta-native or upstream handles transparently |
| **3 (data plane)** | `Zeta.K8s.CSI`, `Zeta.K8s.CNI`, `Zeta.K8s.CRI` | Hot path; Rust where .NET overhead unacceptable; significant perf substrate work |
| **4 (control plane)** | `Zeta.K8s.APIServer`, `Zeta.K8s.ConsensusStore` (etcd-replace) | Long tail; benchmark scope; only after Wave 1-3 prove the binary-compat + conformance pattern works |

Each wave informed by telemetry from earlier waves (081KSE6WT0008QG0R003FG3E8R
flywheel) + AI-competition scoring from earlier waves (081KSE6WT0008QG0R0015ZF2G6).

## What this preserves

The 081KSE6WT0008QG0R00063R6HB ServiceTitan route stays the strategic FILTER. This
row doesn't say "abandon CNCF for Zeta-native"; it says "we
replace incrementally while keeping binary compatibility, so
operators always have optionality." Operators can:

- Stay on upstream impls forever — Zeta cluster works
- Migrate to Zeta-native impls layer-by-layer — at their pace
- Run mixed mode indefinitely — for canary / audit / fallback
- Roll back from Zeta-native to upstream at any point — no
  lock-in to Zeta's impl

Zeta's value-add: the coherent composition + the AI-native
substrate + the open reference + the telemetry flywheel — all
of which work whether the underlying impls are Zeta-native or
upstream.

## What this prevents

Failure modes without binary compatibility:

- Zeta-native CNI requires operators to abandon Cilium's
  ecosystem (operator-extensions, dashboards, etc.) → adoption
  ceiling
- Zeta-native CSI requires operator-side migration tooling
  every time → switching cost
- Zeta-native Operator SDK requires operators to rewrite their
  CRD handlers → adoption ceiling
- Each Zeta-native impl becomes "Zeta's parallel ecosystem"
  rather than "another binary-compatible implementation"

The binary-compatibility constraint is what prevents the
parallel-ecosystem failure mode + preserves the ServiceTitan
adoption pattern at Phase 2.

## Out of scope

- Replacing the Linux kernel itself — bridge too far; kernel
  stays upstream
- Replacing systemd — possibly Wave 5+; not now
- Building a fork of k8s itself — different shape than
  binary-compatible replacement of individual interfaces;
  separate row if ever
- Premature optimization of the wave sequencing — let
  telemetry + AI-competition scoring inform the actual order
- Standards-body participation (CNCF membership for Zeta-
  native impls) — defer; ship working substrate first

## Origin

Aaron 2026-05-25, mid-iteration-2 wait, naming the long-game
endgame substrate after 081KSE6WT0008QG0R00063R6HB ServiceTitan-route Phase 1 was
established. Composes with the existing F#-fork-for-AI-safety
substrate (081KRFA460008QG0R0018SN61J + PR cluster) — same pattern (F#-native
binary-compatible drop-in replacement) extended from "Python
ML ecosystem" to "k8s + CNCF ecosystem." Strategic endgame for
years 2-10 of Zeta substrate; P1 because it shapes every
near-term implementation decision.
