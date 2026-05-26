---
id: B-0820
priority: P2
status: open
title: Flux as second sync-engine — flag-toggle between ArgoCD (default) and Flux; eventually support BOTH long-term for multi-cluster engine A/B experimentation; composes with B-0816 Helm-as-convergence-point + B-0819 ontology-based AI-runbook substrate (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - B-0816
composes_with:
  - B-0794
  - B-0813
  - B-0819
tags: [argocd, flux, multi-engine, flag-toggle, helm-chart-convergence, multi-cluster-experimentation, dependsOn, weave-gitops]
---

## Problem

[B-0816](../P1/B-0816-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md) established ArgoCD as the default sync engine per the LexisNexis + GitHub + Zeta empirical lineage, AND landed the substrate-engineering implication that Helm is the convergence point between engines (Flux and ArgoCD both consume the same Helm charts with different wrappers).

The maintainer's 2026-05-26 follow-up directive:

> *"backlog flux over argocd so we can have a flag and support both eventually"*

The substrate target: file the work to add Flux as a SECOND supported sync-engine — flag-toggle between ArgoCD (default) and Flux at cluster-substrate authoring time, eventually supporting BOTH (different clusters; different teams; different engine choices per Helm chart) for direct A/B engine-comparison on production-shape workloads.

This composes with B-0816's "Multi-cluster IS experimentation substrate" point (Aaron 2026-05-26): the reason multi-cluster matters extends beyond cross-cloud-portability to direct engine-comparison on real workloads.

## Target

Substrate-engineering work to land:

### Sub-target 1 — engine flag in cluster-substrate authoring

Cluster nodes register with an `engine` field (default `argocd`; can be `flux`); cluster-substrate (apps + charts) are authored once + wrapped twice (per-engine).

Suggested registration schema extension (per B-0813 ClusterNode CRD):

```yaml
apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: pikachu
  labels:
    zeta.lucent-financial-group.com/sync-engine: argocd  # or "flux"
spec:
  hostname: pikachu
  roles: [control-plane, worker-gpu]
  engine: argocd  # or "flux"; default "argocd"
  ...
```

### Sub-target 2 — Helm-charts-first directory layout (per B-0816 Helm-as-convergence-point substrate)

Apps under `maintainers/<op>/cluster-apps/<app>/`:

```text
chart/                  # Helm chart (source of truth; engine-agnostic)
├── Chart.yaml
├── values.yaml
└── templates/
argocd/
└── application.yaml    # ArgoCD wrapper (default)
flux/                   # OPTIONAL — only when Flux substrate is in scope
└── helmrelease.yaml    # Flux wrapper
```

For workloads where only ArgoCD ships, `flux/` is absent (no maintenance burden). For workloads in multi-engine scope, both wrappers ship.

### Sub-target 3 — Flux installation on flux-engine clusters

When a cluster node's `engine: flux` is set, the cluster-bring-up substrate installs Flux instead of ArgoCD. Two install paths to evaluate:

- **`flux bootstrap github`** — the canonical Flux CLI install path; writes Flux's own manifests to git + reconciles them
- **Helm chart install** — install Flux via its own Helm chart from a fixed manifest set

Test both; pick the one with the cleanest declarative-from-git story (Flux's whole identity is GitOps-native; the bootstrap path is the idiomatic answer).

### Sub-target 4 — `dependsOn` ↔ sync-wave equivalence layer

Aaron 2026-05-26 explicit endorsement of Flux's `dependsOn` ("clean as fuck"). When the same Helm-chart-first directory layout supports both engines, the dependency-graph spec needs translation between models:

- **Flux**: per-Kustomization / per-HelmRelease `dependsOn: [name1, name2]` named-reference primitive
- **ArgoCD**: numeric `argocd.argoproj.io/sync-wave: "1"` annotation

A small TS substrate (`tools/cluster/deps-to-engine-config.ts`) takes a canonical dependency-graph spec (operator-authored once) and emits BOTH the Flux `dependsOn` field AND the ArgoCD sync-wave annotation. Single source of truth for dependency ordering; engine-specific output.

### Sub-target 5 — UI considerations (Aaron 2026-05-26 question)

ArgoCD ships with a polished OSS UI (graph view + sync status + manifest diff + sync-wave visualization + rollback). Flux's OSS UI options are thinner:

| Flux UI option | Status |
|---|---|
| **Weave GitOps OSS** | Closest ArgoCD-UI analog; less polished; Weaveworks shut down 2024; OSS continues community-maintained |
| **Capacitor** | Community-built lightweight Flux UI; runs as Flux extension |
| **Headlamp + Flux plugin** | Generic K8s UI with Flux integration |
| **k9s + Flux plugin** | TUI not GUI |

The "conversation is the new UI" framing per Aaron 2026-05-26 ties to [B-0819](../P1/B-0819-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md): once the AI-runbook substrate ships, the GUI matters less — operators describe ontology shapes; agents materialize state; status surfaces via conversational query rather than dashboard polling. UI parity between engines is a near-term concern; long-term the AI-runbook layer is the actual operator surface.

For the near term: document the UI difference as one tradeoff axis when operators pick `engine`; Flux's thinner UI is offset by `dependsOn` legibility + simpler config + Aaron's curiosity about whether "Flux is simpler" claim holds in practice.

### Sub-target 6 — multi-cluster A/B experimentation runbook

Operator-facing runbook for standing up two clusters (one ArgoCD, one Flux) with the SAME Helm charts + workloads. Measure:

- Time-to-first-deployment per engine
- Sync-fail recovery behavior (selfHeal vs Flux's reconcile)
- Operator cognitive cost (what surfaces to inspect; how to debug; how to roll back)
- UI usability for the team's tasks (per Sub-target 5 axis)
- Progressive-delivery story (ArgoCD + Argo Rollouts vs Flux + Flagger vs Flux + Argo Rollouts per B-0816 compose nuance)

Empirical data feeds future engine-evaluation decisions; bandwidth-served work per `.claude/rules/bandwidth-served-falsifier.md`.

## Acceptance

- [ ] `engine` field added to ClusterNode CRD schema (depends on B-0813)
- [ ] Helm-charts-first directory layout established + documented
- [ ] At least one app shipped with BOTH `argocd/application.yaml` AND `flux/helmrelease.yaml` wrappers
- [ ] Flux installable on a cluster via the chosen install path (`flux bootstrap github` OR Helm-chart install)
- [ ] `tools/cluster/deps-to-engine-config.ts` ships (single-source-of-truth dependency graph → engine-specific output)
- [ ] Multi-cluster A/B runbook documented per Sub-target 6
- [ ] Empirical comparison data captured on at least one workload across both engines

## Composes with

- **[B-0816](../P1/B-0816-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — Helm-as-convergence-point + multi-engine substrate framing (this row IS the concrete Flux-second-engine implementation of that architectural principle)
- **[B-0794](../P1/B-0794-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — parent cluster-bring-up substrate (gets the `engine` field via ClusterNode CRD extension)
- **[B-0813](../P1/B-0813-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md)** — ArgoCD reconciler; the ClusterNode schema this row extends with `engine` field
- **[B-0819](../P1/B-0819-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md)** — AI-runbook substrate; conversation-as-UI framing makes engine-UI-parity less load-bearing long-term

## Out of scope

- Replacing ArgoCD as default (B-0816 explicitly preserves ArgoCD as default per LN+GH+Zeta lineage; this row ADDS Flux as flag-toggleable second engine, NOT supplants the default)
- Engine-agnostic abstraction layer (no plan to wrap both engines behind a Zeta-specific abstraction; per B-0816's "push to the convergence point; wrap thinly per environment" discipline, the convergence point is Helm; the engine wrappers stay engine-specific)
- Production migration of existing ArgoCD-deployed workloads to Flux (this row is for greenfield workloads + multi-cluster experimentation; existing workloads stay on their engine until evidence supports migration)

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `rg "flux\\b" docs/ memory/ .claude/` → existing references in B-0816 (Helm-as-convergence-point); no prior Flux-second-engine row
- `gh pr list --state all --search "B-0820"` → no in-flight collision
- `gh pr list --state all --search "flux engine"` → no in-flight collision
- ID B-0820 next-free per `git ls-tree origin/main` (highest = B-0817; B-0818 in flight via #5226; B-0819 in flight via #5225)

## Origin

Aaron 2026-05-26 in conversation about ServiceTitan-uses-Flux + Helm-as-convergence-point: *"backlog flux over argocd so we can have a flag and support both eventually"*. Composes with B-0816's Helm-as-convergence-point + multi-engine-experimentation framing landed in #5225.

Filed as P2 because:

1. ArgoCD default (per B-0816) is operationally settled; Flux-as-second-engine is additive enhancement not blocker
2. Multi-cluster A/B experimentation requires multi-cluster substrate (B-0794 family) to be operational first
3. Substrate authoring discipline (Helm-charts-first + engine-thin-wrappers) can land independently of full Flux deployment
4. Empirical engine-comparison data is the value here; the substrate-engineering work scaffolds the data collection
