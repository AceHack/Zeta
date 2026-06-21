---
id: 081KSE6WT0008QG0R0016CEE2Z
priority: P1
status: open
title: Zeta-native scheduler first (Wave 1 of 081KSE6WT0008QG0R00049EFBD) — deterministic simulation + AI-aware cluster management
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R00049EFBD
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KSE6WT0008QG0R002CC6314
  - 081KSE6WT0008QG0R003D199HE
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R003FG3E8R
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0009YYNP4
  - 081KSE6WT0008QG0R00063R6HB
tags: [cluster, scheduler, k8s, dst, ai-aware, gpu, fsharp, binary-compatibility]
---

## Problem

Aaron 2026-05-25 mid-iteration-2-wait, sequencing call on
081KSE6WT0008QG0R00049EFBD wave order: *"schedulre we should do sooner rather than
later for determistic simulation reasons and better cluster ai
aware management."*

081KSE6WT0008QG0R00049EFBD master roadmap suggested the scheduler in Wave 2
("operator surface"). Aaron's sharpening: scheduler is
load-bearing enough on two dimensions that it should be Wave 1
(or even Wave 0):

1. **Deterministic Simulation (DST)** — Zeta's substrate is
   DST-grounded (deterministic-simulation-theory-expert skill,
   ISimulationEnvironment patterns per Zeta.Core). If the
   scheduler is non-Zeta-native (Go-based kube-scheduler with
   its own RNG sources + per-iteration timing variance), the
   cluster's behavior CANNOT be replayed deterministically.
   Every higher-level Zeta-native impl (admission, operator
   SDK, CSI, CNI) loses DST grounding because the scheduler's
   non-determinism contaminates the cluster's execution
   timeline.

2. **AI-aware cluster management** — kube-scheduler's default
   doesn't know about GPU topology (PCIe lanes, NVLink
   topology, NUMA affinity for GPU+CPU+memory), model
   locality (warm caches per model on per-node GPU), AI-
   workload affinity (training jobs vs inference vs batch
   vs interactive), energy-cost awareness (compute-cost
   tier per workload), retraction-native deltas (081KSE6WT0008QG0R003FG3E8R
   telemetry feedback → scheduling adjustments), or any of
   Zeta's existing algebra-grounded substrate.

The scheduler is the **load-bearing pivot** between cluster
state and workload placement. Owning it native unlocks
everything else.

## Target

`Zeta.K8s.Scheduler` — a binary-compatible custom k8s scheduler
in F# (with C# facade for k8s client / gRPC) that:

- Operators opt into via `Pod.spec.schedulerName: zeta-scheduler`
  (per 081KSE6WT0008QG0R00063R6HB ServiceTitan route — use the existing k8s standard
  interface; don't replace kube-scheduler, run alongside it)
- Default kube-scheduler keeps scheduling pods without
  `schedulerName` set — operators choose per-workload, can
  migrate incrementally
- Implements DST: every scheduling decision is replayable
  given a seed + observable cluster state at decision time
- AI-aware: scheduler plugins for GPU topology, NUMA affinity,
  model locality, workload-class fitness, energy-cost
  optimization
- Algebra-grounded: scheduling decisions emit DBSP retraction-
  native deltas (081KSE6WT0008QG0R003FG3E8R telemetry can replay them; Bayesian
  inference per Zeta.Bayesian can update scheduling priors)
- Binary-compatible: passes the k8s scheduler conformance suite
  on all standard workload types; swappable with kube-scheduler
  at any time

## Why scheduler-first unlocks the rest

Per Aaron's two-dimensional argument:

### Dimension 1: DST grounding for the whole cluster

If scheduler is Zeta-native + DST-replayable, then:

- Every Wave-1 follow-up (admission, operator SDK, CSI, CNI)
  inherits DST grounding because the scheduler's decisions are
  deterministic given the same inputs
- Cluster-level simulation becomes possible: replay a 24-hour
  cluster run from telemetry; verify Zeta-native impls match
  their conformance suite under the same load patterns
- AI-systems-training-on-cluster-substrate (081KSE6WT0008QG0R0015ZF2G6) gets DST
  replay as a benchmark feature — "given this cluster state +
  workload mix, can AI X produce the same scheduling decisions
  as the reference Zeta scheduler?"
- Debugging becomes deterministic: a misschedule observed in
  prod can be replayed locally with the exact same inputs

If scheduler is NOT Zeta-native, no amount of downstream
Zeta-native impls recover DST at cluster scope. The scheduler
is the determinism gate.

### Dimension 2: AI-aware scheduling unlocks AI-cluster value

K8s default scheduler treats Pods as opaque resource-request
boxes. For AI workloads specifically, that loses information:

| Workload property | Default scheduler | Zeta-native scheduler |
|---|---|---|
| GPU topology (PCIe / NVLink / NUMA) | Treats GPUs as countable resources | Aware of GPU-to-GPU bandwidth; co-locates multi-GPU workloads on NVLink-connected GPUs |
| Model locality (warm caches) | Schedules anywhere with GPU capacity | Prefers nodes that already have the model weights cached on local NVMe / GPU memory |
| Workload class (training vs inference vs batch) | All equal except resource requests | Trains scheduled on dedicated bursty nodes; inference on stable-warm nodes; batch on spot/preemptible |
| Retraction-native deltas | No feedback loop | Telemetry (081KSE6WT0008QG0R003FG3E8R) → DBSP retraction stream → scheduler updates priors → next decision better |
| Energy-cost tier | No awareness | Multi-objective: balance fitness + energy cost + cluster-state-coherence |
| Bayesian priors | None | Zeta.Bayesian-driven workload-fitness predictions per node |

For an **AI-native cluster** (per 081KSE6WT0008QG0R0015ZF2G6 reference architecture),
the scheduler is THE place where AI-substrate composes with
infrastructure substrate. K8s default scheduler is wrong for
this domain in a way that no Wave-2-and-later replacement can
compensate for.

## Acceptance

- [ ] `Zeta.K8s.Scheduler` F# project + C# k8s-client facade
      + Rust hot-path components (only where .NET overhead
      measurable per 081KSE6WT0008QG0R000WVYAJ2 vendor-swap perf budget)
- [ ] Custom scheduler deployment via `schedulerName:
      zeta-scheduler` opt-in; co-exists with default
      kube-scheduler in same cluster
- [ ] DST conformance suite: given a recorded cluster state +
      workload sequence + RNG seed, scheduler produces
      identical placement decisions on every replay
- [ ] k8s scheduler conformance suite passing: all standard
      Pod spec fields (resources, nodeSelector, affinity,
      tolerations, topologySpreadConstraints, priority classes,
      preemption) work identically to kube-scheduler
- [ ] First AI-aware plugin: GPU topology awareness
      (lstopo-based; reads hwloc inventory per 081KSGS9H0008QG0R002T3BJ2R substrate
      already on installer ISO) — multi-GPU workloads
      co-located on NVLink-connected GPUs
- [ ] Second AI-aware plugin: model-locality awareness
      (Pod annotation `zeta.io/model: <model-id>` → prefer
      nodes with model weights cached)
- [ ] Third AI-aware plugin: workload-class fitness
      (training / inference / batch / interactive)
- [ ] DBSP integration: scheduler emits decision deltas to
      Zeta's algebra substrate; Bayesian inference updates
      priors based on observed outcomes vs predictions
- [ ] Telemetry hook (per 081KSE6WT0008QG0R003FG3E8R): scheduler decision
      outcomes (latency, throughput, GPU utilization,
      pod-eviction events) auto-flow to telemetry envelope
      when operator opts in
- [ ] Reference deployment: AI-cluster reference (081KSE6WT0008QG0R0015ZF2G6)
      defaults to zeta-scheduler for AI-class workloads;
      benchmarks vs default kube-scheduler published as
      first ARC-AGI scenario for scheduler quality
- [ ] Migration story: operator deploys zeta-scheduler
      alongside kube-scheduler via a single Helm chart /
      ArgoCD Application (per 081KSE6WT0008QG0R00063R6HB ServiceTitan route);
      adds `schedulerName` to AI-class workloads; non-AI
      workloads unaffected; can roll back by removing
      `schedulerName` field
- [ ] AI-training data: scheduler decision logs + reasoning
      + outcomes published per 081KSE6WT0008QG0R0015ZF2G6 (open reference) so
      AI systems competing on scheduler benchmark have
      complete training substrate

## Sequencing within scheduler scope

Per 081KSE6WT0008QG0R00049EFBD wave-1 (lowest blast radius) principle, ship in
sub-waves:

| Sub-wave | Scope | Why this sub-wave |
|---|---|---|
| **A** | Baseline custom scheduler (no AI-awareness yet): k8s scheduler conformance + DST replay | Proves the binary-compat + DST grounding without depending on plugin complexity |
| **B** | GPU topology plugin | Lowest-hanging AI-aware win; reads existing hwloc inventory |
| **C** | Model locality + workload-class plugins | Composes with telemetry flywheel (081KSE6WT0008QG0R003FG3E8R) |
| **D** | DBSP + Bayesian integration | Algebra-grounded; substrate-engineering depth |
| **E** | Multi-objective optimization (fitness + energy + coherence) | Operator-facing tunable; reference deployment uses |

Each sub-wave ships as its own PR + benchmark scenario.

## Implementation language strategy

| Component | Language | Why |
|---|---|---|
| Core scheduling loop + plugin framework | F# | Algebra-grounded; HKT for plugin generics; computation expressions for plugin composition |
| K8s client (watch, list, patch) | C# (existing KubernetesClient lib via .NET interop) | Avoid reinventing; mature substrate |
| gRPC server (for scheduler-extender path during transition) | F# (Grpc.AspNetCore) | F# native, fast enough |
| Hot-path decision math (only if profiling shows .NET overhead) | Rust via FFI | Per 081KSE6WT0008QG0R000WVYAJ2 vendor-swap perf principle; measure first |

F# is primary; C# for k8s-client interop; Rust only where
profiling demands it.

## Composes with

- 081KRFA460008QG0R0018SN61J — F# fork for AI safety (the substrate base)
- 081KSE6WT0008QG0R002CC6314 — ontology negotiation (scheduler hints carry across
  ontologies; e.g., OpenAI's "model_id" vs Anthropic's
  "model_name" both fit the model-locality plugin)
- 081KSE6WT0008QG0R003D199HE — git-native per-machine state (scheduler can read
  per-machine declared state to inform placement)
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (the install path includes
  zeta-scheduler in the AI-cluster reference once it ships)
- 081KSE6WT0008QG0R0015ZF2G6 — open reference architecture (scheduler is the first
  ARC-AGI benchmark scenario)
- 081KSE6WT0008QG0R003FG3E8R — auto-submit-back telemetry (in-the-wild scheduler
  decision outcomes feed Bayesian priors + LLM-PR improvements)
- 081KSE6WT0008QG0R000WVYAJ2 — cloud-native plugins fit Zeta interfaces (the
  scheduler's plugin contract is the existing k8s scheduler
  framework plugin API per 081KSE6WT0008QG0R00063R6HB ServiceTitan filter)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF force multipliers (compose with KEDA event-
  driven scaling — KEDA tells the scheduler "more pods
  coming"; Zeta scheduler pre-places + warms model caches)
- 081KSE6WT0008QG0R00063R6HB — ServiceTitan route (this row IS adoption-via-
  existing-standard: schedulerName field is k8s standard;
  custom-scheduler-co-existing-with-default is k8s pattern)
- 081KSE6WT0008QG0R00049EFBD — slow-replace master plan (this row is Wave 1)
- `Zeta.Bayesian` substrate (existing; per Zeta.Bayesian
  namespace + skills) — directly composes for prior updates
- `algebra-owner` skill — for DBSP retraction-native delta
  emission
- `deterministic-simulation-theory-expert` skill — for DST
  conformance design

## Why P1 priority

- Two-dimensional value (DST + AI-awareness) makes scheduler
  the load-bearing pivot for downstream Zeta-native impls
- Sequencing call from operator (Aaron) carries weight; he
  explicitly named scheduler-first
- Composes with already-shipped F# substrate (Zeta.Core,
  Zeta.Bayesian) without needing kernel-adjacent Rust work
- Concrete benchmark scope (081KSE6WT0008QG0R0015ZF2G6 ARC-AGI scenario) gives
  immediate forcing function
- Reference deployment payoff is immediate: every AI workload
  in the reference architecture benefits

## Out of scope

- Replacing kube-scheduler itself (this row ships a custom
  scheduler ALONGSIDE; replacement is 081KSE6WT0008QG0R00049EFBD control-plane
  Wave 4 territory)
- Multi-cluster scheduling (federation, virtual kubelet) —
  separate row
- Spot-instance / cloud-burst scheduling — composes with this
  row's energy-cost plugin (sub-wave E) but the spot-specific
  logic is separate
- Cost-attribution / chargeback — separate observability scope

## Origin

Aaron 2026-05-25, mid-iteration-2 wait, sequencing call:
scheduler is load-bearing enough on DST + AI-awareness that
081KSE6WT0008QG0R00049EFBD's Wave 2 placement was wrong. Scheduler-first unlocks
DST grounding for every downstream Zeta-native impl + delivers
the AI-cluster-substrate value prop the reference architecture
(081KSE6WT0008QG0R0015ZF2G6) is meant to demonstrate.
