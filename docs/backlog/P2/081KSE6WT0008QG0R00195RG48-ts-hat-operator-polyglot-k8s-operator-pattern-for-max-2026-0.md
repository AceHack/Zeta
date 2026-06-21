---
id: 081KSE6WT0008QG0R00195RG48
priority: P2
status: open
title: "TS hat-system operator — second polyglot implementation alongside the Go scaffold; proves the polyglot-operator pattern for the cluster"
created: 2026-05-25
last_updated: 2026-05-25
classification: buildable-now
decomposition: atomic
type: operator-substrate
discovered_by: aaron
owners: [aaron, max]
composes_with:
  - full-ai-cluster/k8s/applications/hat-system/
  - full-ai-cluster/k8s/applications/hat-system/crds/
  - full-ai-cluster/k8s/applications/hat-system/operator/
  - agentic-organization/docs/CLUSTER_NATIVE_HAT_SYSTEM.md
  # 081KSE6WT0008QG0R002RFEC0S ref pending PR #4954 merge
---

# 081KSE6WT0008QG0R00195RG48 — TS hat-system operator (second polyglot implementation; proves the polyglot-operator pattern)

## Carved blade

> Two operators against the same CRDs prove the schema works as polyglot contract. Max owns the TS implementation; the Go scaffold stays as reference + reliability baseline. Future operators in Rust / Python / Kotlin land via the same pattern. The CRDs are the canonical surface; language is the wearer.

## Origin

Aaron 2026-05-25, in the wake of Max's first PR (#4958, the agentic-organization design set):

> *"yes lets combine he will like kubernets operators but he does not have experience maybe we write a ts operator insteadd of go he likes ts"*

Then immediately broadened to architectural principle:

> *"we want polyglot operator support for k8s anyways so we are not rigid about go"*

Reframes the TS rewrite from "Max's preference accommodation" into "first deliberate proof of the polyglot-operator pattern the cluster commits to anyway." Two implementations against the same CRD shape forces the schema to be the canonical contract — no language-specific quirks bleeding through.

## The pattern

Multiple language implementations of the same operator, all watching the same CRDs, deployed selectively (leader-election picks one at a time; or different operators handle different CR subsets).

| Component | Language | Owner | Purpose |
|-----------|----------|-------|---------|
| Hat / HatBinding / HatSwap / HatPolicy CRDs | YAML (canonical contract) | shared | Single source of truth for schema; both operators consume this |
| Go operator scaffold | Go | starter; minimize over time | Reference implementation; reliability baseline; shipped first because the K8s ecosystem is Go-native |
| TS operator (this row) | TypeScript (`@kubernetes/client-node` + NestJS optional) | Max | Max's strength; second implementation that runs same CRDs; proves polyglot |
| C# / F# operator (future) | C# / F# via [KubeOps.NET](https://buehler.github.io/dotnet-operator-sdk/) | Aaron + Max common ground | C# is the team's overlap (Max loves TS+C#; Aaron loves F#+C#); KubeOps.NET provides a kubebuilder-class operator framework on .NET — removes Go from the operator-authoring path entirely for this class of work |
| Future Rust operator | Rust ([kube-rs](https://kube.rs/)) | both like Rust for the right job | Lock-free high-throughput reconcile loops; perf-critical paths |
| Future Python operator | Python ([kopf](https://kopf.readthedocs.io/)) | both like Python for the right job | Fast prototyping; ML-adjacent CRDs where Python ecosystem is already there |

**Team language-affinity context** (Aaron 2026-05-25): *"max love ts and cs i love fs and cs we both like rust and python for where they make sense"* + *"we understand go is necessary in some places for k8s but we would like to limit its necessity"*.

So: Go stays where the ecosystem truly forces it (some CRD tooling, kubebuilder itself, controller-tools), but operator authoring should move to TS / C# / F# / Rust / Python over time. The hat-system Go scaffold is the bootstrap; the TS rewrite (this row) is move #1; a KubeOps.NET implementation is the obvious move #2 because it lands BOTH Aaron and Max in their strong-language zone simultaneously.

## Why polyglot matters at cluster scope

- **CRD-as-canonical-contract enforcement** — if two operators agree on what `Hat.spec.skills` means, the spec is honest; if only one operator works, the schema has hidden Go-isms
- **Failure-domain isolation** — Go-runtime bug doesn't take down TS operator and vice versa (composes with the multi-kubelet pattern in 081KSE6WT0008QG0R002CQS1HR once that row lands; PR #4955)
- **Talent / contribution flexibility** — Max contributes TS; Aaron contributes Go; future contributors pick their language
- **Ecosystem coverage** — Rust for perf-critical hot loops; Python for fast iteration; Go for production solidity; TS for full-stack-team alignment
- **Service mesh + observability validation** — Cilium + NFD + Loki + Hubble must speak to operators regardless of impl language

## TS operator stack (Max's preferred choices)

| Layer | Library / pattern | Why |
|-------|-------------------|-----|
| Kubernetes client | `@kubernetes/client-node` (official) | Official; well-maintained; informer/watcher primitives |
| CRD types | Generated from OpenAPI schema via `kubernetes-models` or hand-authored TS interfaces matching crds/*.yaml | Same shape as Go `api/v1alpha1/types.go` |
| Reconcile pattern | controller-runtime-equivalent: informer → workqueue → reconciler | Mirror Go operator's structure for parity |
| NestJS shell (optional) | NestJS for HTTP / metrics / health endpoints | Composes with the rest of Max's agentic-organization stack |
| Webhook (validating + mutating) | `fastify` or NestJS controller serving admission webhook responses | Same OPA-pre-evaluation pattern as the Go webhook |
| Tick emit | NATS via `nats.js`, Loki via slog-equivalent (`pino` JSON), HatSwap CR via the K8s client | Same fan-out shape as Go's `internal/tick/emitter.go` |
| Leader election | `coordination.k8s.io/v1` Lease (same as Go uses controller-runtime for) | Standard K8s pattern; ensures only one operator instance reconciles at a time |

## Acceptance

- [ ] `full-ai-cluster/k8s/applications/hat-system/operator-ts/` directory exists with NestJS / TS scaffold
- [ ] TS implementation watches the SAME 4 CRDs already defined under `crds/` (no schema changes; reuse the YAML)
- [ ] Reconciles `HatBinding` lifecycle: `Pending → Warmup → Active → Probation → Revoked`
- [ ] Emits the same 4 sinks per state transition: HatSwap CR + k8s Event + JSON log (Loki) + NATS publish
- [ ] Validating webhook enforces the 7 OPA throttle constraints at admission time (alternative to or composing with Gatekeeper)
- [ ] Container image builds + deploys via the existing Application.yaml pattern (separate Deployment from the Go operator; shared Lease identity or explicit disjoint ownership partition ensures only one lifecycle reconciler writes a given `HatBinding`)
- [ ] Tests written in `vitest` or `jest`; the same envtest-style harness pattern Go uses
- [ ] Both operators verifiable side-by-side in a local k3d / kind dev cluster (PR #4953 was the dev-cluster substrate attempt; closed pending redesign — once the redesign lands, verify there)

## Composition with shipped substrate

- **PR #4930** (hat-system Go operator) — TS operator runs ALONGSIDE; both use the same CRDs at `full-ai-cluster/k8s/applications/hat-system/crds/`. The Go scaffold becomes the reference / reliability baseline; the TS operator is Max's primary surface
- **PR #4961** (agentic-organization docs) — `agentic-organization/docs/CLUSTER_NATIVE_HAT_SYSTEM.md` describes the Organization-facing CRD/operator contract; this row makes the TypeScript implementation path concrete
- **081KSE6WT0008QG0R002RFEC0S** (CI ephemeral cluster smoke; PR #4954 pending merge) — smoke test will eventually assert BOTH operators reconcile the same CRDs identically (polyglot validation gate)
- **081KSE6WT0008QG0R002CQS1HR** (multi-kubelet per machine; PR #4955 pending merge) — polyglot operators × multi-cluster-per-machine = high redundancy; a bug in Go-operator on cluster-A is isolated from TS-operator on cluster-B

## Why P2 not P1

The Go scaffold already exists + is functional as the operator-of-record. A TS implementation IS valuable but isn't blocking any current work. Becomes P1 if:

- Max is blocked from contributing because the only operator is in a language he doesn't own
- A specific bug requires comparing Go vs TS behavior to diagnose
- The cluster reaches multi-instance scale where polyglot redundancy adds real availability

## Learning curve — K8s operator pattern is new to Max + initial resistance is expected

Aaron 2026-05-25, on Max's experience level:

> *"max needs to learn the operator pattern in k8s he does not know k8s really at all he is backend/frontend over paas so he has no much devops"*

And on the typical adoption arc:

> *"he will be resistant probably like most devs at first until he internlizes is worth"*

This is normal and expected. Backend/frontend developers coming from PaaS abstractions often see K8s as ceremony overhead; the operator pattern specifically has its own jargon (informer, workqueue, reconcile loop, finalizer, CRD, admission controller, status subresource, server-side apply) that takes a week or two to internalize. The "aha" usually arrives when Max sees a 200-line CRD + 50-line reconciler do what would be 500+ lines of imperative state-management code in a traditional backend service.

The framing for Max:

- The operator pattern is **declarative state convergence** at K8s scope. Same shape as a React render loop or a database trigger — describe the desired state, the system continuously reconciles toward it. You already think this way for frontend; this is the backend / cluster equivalent.
- The CRD is **a typed API endpoint** that K8s gives you for free, with auth + auditing + watch streams + RBAC + persistence baked in. The operator is the service that hosts that endpoint's behavior.
- The reconcile loop is **idempotent + retry-safe by design**. Crash mid-operation? The next reconcile starts fresh from observed state. No transactional bookkeeping required.
- Polyglot operators alongside the Go reference means Max never has to write Go OR learn alien K8s tooling — he writes TypeScript against the standard `@kubernetes/client-node` client + watches structured behavior happen via `kubectl`. Same loop, his language.

The resistance is usually about ceremony cost; the worth lands when the ceremony pays back tenfold in things-that-just-keep-working.

This row's PRIMARY VALUE for Max is the learning, not the deliverable. The Go scaffold (PR #4930) becomes a TEACHING TOOL:

1. **Read the Go operator first** at `full-ai-cluster/k8s/applications/hat-system/operator/` — every concept (CRD, reconciler, informer, workqueue, leader election, status subresource, finalizer, admission webhook) is named explicitly. The Go file structure mirrors the standard kubebuilder layout the K8s community uses everywhere.
2. **Run a local k3d / kind cluster** (the dev-cluster substrate attempt was PR #4953 — closed; redesign pending. Use raw `k3d cluster create` until that lands) and watch the Go operator reconcile — `kubectl get hats`, `kubectl describe hatbinding`, `kubectl get hatswaps`, `kubectl logs -n hat-system deploy/hat-system-operator -f`. See the events stream as state transitions fire. The CRD + operator IS the structured tick source Addison's framework describes.
3. **THEN mirror the structure in TS**, one piece at a time. Suggested order:
   - (a) Hand-author TS interfaces for the 4 CRDs (mirror `operator/api/v1alpha1/types.go`); compile-only first, no behavior
   - (b) Connect to the K8s API via `@kubernetes/client-node`; just `kubectl get hats`-equivalent listing
   - (c) Add an informer that watches `Hat` resources + logs every event
   - (d) Add the workqueue + reconcile loop for `HatBinding` only (simplest lifecycle)
   - (e) Add the tick emit (HatSwap CR write only first; layer in Event/Loki/NATS later)
   - (f) Add the validating webhook
   - (g) Add the other reconcilers (Hat, HatPolicy)

Each step lands as a separate PR. The Go scaffold answers "what does this code DO at runtime" for every concept; the TS port answers "how do I express that pattern in MY language."

### Resources for first-time K8s operator developers

- **kubernetes.io concepts** (start here): https://kubernetes.io/docs/concepts/
  - Controllers: https://kubernetes.io/docs/concepts/architecture/controller/
  - Operator pattern: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
  - Custom Resources: https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/
- **kubebuilder book** (the standard go-operator reference; concepts transfer to TS): https://book.kubebuilder.io/
- **client-go reconciler pattern explained** (language-agnostic article): https://maelvls.dev/k8s-token-watch/
- **@kubernetes/client-node README + examples**: https://github.com/kubernetes-client/javascript
- **A TS operator that already exists in the wild** (reference structure): https://github.com/dot-i/k8s-operator-node (older but illustrative)
- **Cluster API's controller-runtime explainer**: https://cluster-api.sigs.k8s.io/developer/architecture/controllers.html

### Pair-programming pattern (recommended)

For each step (a)-(g) above:

1. Max writes the TS draft
2. Run it against a local k3d / kind cluster (the dev-cluster `./up.sh` wrapper from PR #4953 was closed; spin up raw `k3d cluster create zeta-dev-test` until the redesign lands)
3. Compare behavior to the Go operator running the same workload (both can run side-by-side; leader election means only one reconciles at a time, but watch logs from both)
4. If divergence shows up, the GO behavior is the reference truth (it shipped first + has the framework's review)
5. Iterate until parity

This row owns the substrate-engineering arc; specific PRs land each step.

## Naming question

The subsystem name is **Agentic Organization**. Use `hat-system` as the Kubernetes operator/CRD name, and use Hermes only for the agent runtime/component.

For this row: use `hat-system` as the operator name (matches the YAML directory + PR #4930). The operator name does not need to mirror the broader subsystem name.

## Estimated scope

- ~1-2 weeks of Max's time at his preferred pace
- ~1500-2500 lines of TS (operator core + webhook + tests)
- One PR to scaffold the directory + leader-election infrastructure; subsequent PRs to add each reconciler (Hat / HatBinding / HatSwap / HatPolicy) and webhook

## References

- `full-ai-cluster/k8s/applications/hat-system/operator/api/v1alpha1/types.go` — Go type definitions to mirror in TS interfaces
- `full-ai-cluster/k8s/applications/hat-system/operator/internal/controller/hatbinding_controller.go` — reconciler pattern to mirror
- `full-ai-cluster/k8s/applications/hat-system/operator/internal/tick/emitter.go` — tick fan-out pattern to mirror
- `@kubernetes/client-node` — official TS K8s client
- NestJS docs — if Max chooses NestJS for the HTTP / metrics / webhook surface
- `kube-rs` (future Rust impl reference) — https://kube.rs/
- `kopf` (future Python impl reference) — https://kopf.readthedocs.io/

## Not in scope (yet)

- Rust / Python implementations (future polyglot extensions; separate rows when needed)
- Cross-operator coordination beyond leader-election (e.g., one operator handles Hat reconciles, the other handles HatBinding) — possible future pattern but adds complexity not needed yet
- Schema-generation tooling (generating TS interfaces from CRD YAML via OpenAPI) — nice-to-have but hand-authored interfaces are fine for v1
- Replacing the Go operator — both stay; this is additive, not substitutive
