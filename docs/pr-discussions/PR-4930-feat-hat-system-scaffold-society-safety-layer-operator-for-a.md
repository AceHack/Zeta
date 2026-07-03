---
pr_number: 4930
title: "feat(hat-system): scaffold society safety-layer operator for AI cluster"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T13:31:30Z"
merged_at: "2026-05-25T13:34:48Z"
closed_at: "2026-05-25T13:34:49Z"
head_ref: "feat/hat-system-operator-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:51:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4930: feat(hat-system): scaffold society safety-layer operator for AI cluster

## PR description

## Summary

Scaffolds `full-ai-cluster/k8s/applications/hat-system/` — a Kubernetes operator + CRDs + OPA policies implementing the hat / role distinction for the multi-agent society Max + Addison are building. 29 files; nothing else in the cluster changes.

**Hats are time-bounded roles with succession.** Wearers swap hats; the hat persists; reputation accumulates on the role. Cooldown + warmup + sticky-attribution + quorum on every binding — that's what keeps this hat-as-chosen-and-returnable instead of role-as-cage.

Compositions captured from the design conversation:

- **Max's mental model: `hat = skills + opa/rbac`.** Both first-class on `Hat.spec` (`skills` + `authority`).
- **Max's hierarchy framing: "hats not weight-free but supervisor graphs."** Captured via `Hat.spec.supervises` (DAG enforced by the `no-supervisor-cycles` OPA constraint).
- **Max's policy-authoring style: "talks in hat graphs."** `graph/render.go` emits Graphviz DOT of the live cluster's hat graph; README maps each throttle to its graph statement.
- **Aaron's reframe from cage → hat: time-boundedness is the difference.** README spells out the cage / hat property table.
- **CRD + operator = structured tick source.** Every state transition emits exactly one HatSwap (durable) + k8s Event + slog → Loki + NATS publish via `internal/tick/emitter.go`.

**Bootstrap-bottleneck answer:** `hat-designer` is itself a hat (quorum-gated, quorumSize 3, cooldown 1800s, conflictsWith `executor`). Multiple wearers can hold it; nobody is the SPOF.

## What's in the directory

| Path | What |
|------|------|
| `Application.yaml` | ArgoCD Application; reconciles everything below |
| `crds/` | Hat, HatBinding, HatSwap, HatPolicy (4 CRDs) |
| `hats/` | Seed: hat-designer, observer, executor, policy-admin + default HatPolicy |
| `policies/` | 7 OPA Gatekeeper ConstraintTemplates (cooldown, max-bindings, COI, quorum, warmup, max-new-hats, no-supervisor-cycles) |
| `operator/` | Go operator scaffold (kubebuilder layout — needs `kubebuilder init`) |
| `graph/` | Hat-graph DOT renderer + docs |
| `queries/` | Loki + Hubble query library for hat ↔ network-flow attribution |
| `deployment.yaml` | Operator Deployment (replicas:0 until image built) + RBAC |

## Sync gating

Deployment ships at `replicas: 0` so ArgoCD reports healthy while the operator image doesn't exist yet. CRDs, OPA policies, and seed hats are all live — `kubectl get hats` returns the catalog as soon as ArgoCD syncs. The build path for the operator image is documented in the top-level README.

## Test plan

- [ ] ArgoCD picks up `hat-system/Application.yaml` and reconciles
- [ ] All 4 CRDs install cleanly (`kubectl get crd | grep society.zeta.io` → 4 lines)
- [ ] All 7 OPA ConstraintTemplates install and Constraints become enforcing (Gatekeeper must be running first — it's already in the bootstrap manifests)
- [ ] Seed hats land and are listable (`kubectl get hats` → 4 lines: hat-designer, observer, executor, policy-admin)
- [ ] HatPolicy default singleton lands (`kubectl get hatpolicy default`)
- [ ] Deployment lands at 0/0 ready (expected until image built)
- [ ] `go run graph/render.go --out /tmp/h.dot` produces a parseable DOT file with the 4 seed hats as nodes
- [ ] Future PR: complete `kubebuilder init` + build image + bump replicas

## Intentional gaps (each = one follow-up PR)

- Validating webhook for HatBinding admission
- HatReconciler (reputation accumulation on swap-off)
- HatPolicyReconciler (status rollup)
- Finalizer flow for guaranteed SwapOff emission
- Mutating webhook for RequestedAt defaulting
- envtest harness
- CI image build + push

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T13:36:41Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `59e88cb8e3`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: full-ai-cluster/k8s/applications/hat-system/operator/internal/tick/emitter.go:65 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T13:36:41Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Sanitize HatSwap GenerateName to lowercase DNS-1123**

`GenerateName` is built from `t.Event`, but the event constants are CamelCase (e.g. `SwapOn`, `WarmupBegin`), so names like `observer-SwapOn-` include uppercase letters and are rejected by Kubernetes name validation. That causes HatSwap creation to fail for normal transitions, which breaks the durable tick stream and any policy/query logic that depends on HatSwap records.

Useful? React with 👍 / 👎.

### Thread 2: full-ai-cluster/k8s/applications/hat-system/operator/internal/controller/hatbinding_controller.go:84 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T13:36:41Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Fail reconcile when tick.Emit cannot persist the HatSwap CR**

The reconciler discards `tick.Emit` errors, so reconciliation still reports success when the durable HatSwap write fails. In those cases no retry is scheduled and transitions become untracked, which directly violates the “one tick per transition” contract and can silently desynchronize cooldown/quorum logic that reads swap history.

Useful? React with 👍 / 👎.

### Thread 3: full-ai-cluster/k8s/applications/hat-system/operator/api/v1alpha1/types.go:290 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T13:36:41Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Implement DeepCopyObject instead of returning the same pointer**

These `DeepCopyObject` stubs return the original object pointer instead of an actual copy. Kubernetes runtime/scheme callers assume `DeepCopyObject` produces an independent object; returning aliases can leak in-place mutations across cache/reconcile paths and lead to subtle state corruption.

Useful? React with 👍 / 👎.

### Thread 4: full-ai-cluster/k8s/applications/hat-system/operator/cmd/main.go:60 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T13:36:41Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Pass a duration unit to nats.PingInterval**

`nats.PingInterval` expects a `time.Duration`, but passing the bare literal `30` configures a 30ns interval rather than 30 seconds. This can cause excessive ping traffic/reconnect churn and unnecessary load whenever NATS is enabled.

Useful? React with 👍 / 👎.
