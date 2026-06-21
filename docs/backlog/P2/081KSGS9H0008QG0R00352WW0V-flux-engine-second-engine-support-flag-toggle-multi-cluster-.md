---
id: 081KSGS9H0008QG0R00352WW0V
priority: P2
status: open
title: Flux as second sync-engine — flag-toggle between ArgoCD (default) and Flux; eventually support BOTH long-term for multi-cluster engine A/B experimentation; composes with 081KSGS9H0008QG0R003A37Z65 Helm-as-convergence-point + 081KSGS9H0008QG0R0005P83AP ontology-based AI-runbook substrate (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R003A37Z65
composes_with:
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R002K93MWX
  - 081KSGS9H0008QG0R0005P83AP
tags: [argocd, flux, multi-engine, flag-toggle, helm-chart-convergence, multi-cluster-experimentation, dependsOn, weave-gitops]
---

## Problem

[081KSGS9H0008QG0R003A37Z65](../P1/081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md) established ArgoCD as the default sync engine per the LexisNexis + GitHub + Zeta empirical lineage, AND landed the substrate-engineering implication that Helm is the convergence point between engines (Flux and ArgoCD both consume the same Helm charts with different wrappers).

The maintainer's 2026-05-26 follow-up directive:

> *"backlog flux over argocd so we can have a flag and support both eventually"*

The substrate target: file the work to add Flux as a SECOND supported sync-engine — flag-toggle between ArgoCD (default) and Flux at cluster-substrate authoring time, eventually supporting BOTH (different clusters; different teams; different engine choices per Helm chart) for direct A/B engine-comparison on production-shape workloads.

This composes with 081KSGS9H0008QG0R003A37Z65's "Multi-cluster IS experimentation substrate" point (Aaron 2026-05-26): the reason multi-cluster matters extends beyond cross-cloud-portability to direct engine-comparison on real workloads.

## Target

Substrate-engineering work to land:

### Sub-target 1 — engine flag in cluster-substrate authoring

Cluster nodes register with an `engine` field (default `argocd`; can be `flux`); cluster-substrate (apps + charts) are authored once + wrapped twice (per-engine).

Suggested registration schema extension (per 081KSGS9H0008QG0R002K93MWX ClusterNode CRD):

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

### Sub-target 2 — Helm-charts-first directory layout (per 081KSGS9H0008QG0R003A37Z65 Helm-as-convergence-point substrate)

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

Aaron 2026-05-26 explicit endorsement of Flux's `dependsOn` ("clean as fuck") + the sharper architectural framing:

> *"but depends on is the only reason i'm giving flux a chance cause they sync waves are derivable"*

**Derivability asymmetry — load-bearing architectural finding (Aaron 2026-05-26)**:

| Direction | Possible? | Why |
|---|---|---|
| `dependsOn` graph → sync-wave numbers | YES | Topological sort + assign wave per topo-level → numeric wave annotations |
| sync-wave numbers → `dependsOn` graph | NO (trivially) | Numbers don't carry the WHY of ordering; can't recover named-dependency semantics |

This means the SOURCE-OF-TRUTH SHOULD BE `dependsOn`-shaped; sync-waves are a DERIVED PROJECTION. The substrate-engineering pattern:

1. **Operator authors** named-dependency graph (regardless of target engine)
2. **For Flux**: emit `dependsOn: [name1, name2]` directly (1:1 mapping)
3. **For ArgoCD**: topo-sort the graph + emit `argocd.argoproj.io/sync-wave: "N"` annotations (derived)

Aaron's "shit" insight (2026-05-26): *"oh shit maybe we should calculate this for our argo too eventually somehow with some helm chart tricks"* — the derivation can live IN the Helm chart itself, so ArgoCD users get `dependsOn`-shaped UX without thinking about wave numbers. Two candidate derivation surfaces:

**Approach A — Helm template-level derivation (Helm tricks)**:

- Convention: charts declare dependencies via `values.yaml` field (e.g., `zeta.dependsOn: [name1, name2]`)
- Helm helper template (`_helpers.tpl`) implements topo-sort + emits the matching `argocd.argoproj.io/sync-wave` annotation on rendered manifests
- Pros: derivation happens at chart-render time; no out-of-band tooling needed; ArgoCD sees pre-computed annotations
- Cons: Helm's templating language is not great for graph algorithms; topo-sort in Sprig/Helm-template-functions is awkward (possible via `range` + lookups, but verbose)

**Approach B — Build-time TS tool (`tools/cluster/deps-to-engine-config.ts`)**:

- Operator authors a canonical dependency-graph spec (TS / YAML / Helm values)
- TS tool consumes the spec at chart-build time + emits BOTH:
  - Flux: `dependsOn` arrays
  - ArgoCD: sync-wave annotations (after topo-sort)
- Pros: graph algorithms in TS are trivial; testable; F# crystallization-candidate later per `.claude/rules/zeta-ships-with-skills-immediate-value.md`
- Cons: build-time step; operators must remember to run it

Recommended: **start with Approach B (TS tool)** for the substrate-engineering simplicity; evaluate Approach A (Helm-template derivation) as a follow-on when the substrate is settled. Either way, the SOURCE-OF-TRUTH is `dependsOn`-shaped; sync-waves are DERIVED.

This is the same pattern as 081KSGS9H0008QG0R003A37Z65's Helm-as-convergence-point: push to the convergence point (here: named-dependency graph); wrap thinly per environment (here: Flux gets `dependsOn` directly; ArgoCD gets derived sync-waves). The architectural privilege of `dependsOn`-as-source-of-truth IS the load-bearing reason giving Flux a chance — derivability is asymmetric, and the asymmetric direction picks the source-of-truth shape regardless of which engine ends up shipping.

Side benefit: this makes the Helm-charts-first directory layout (Sub-target 2) even cleaner — the `chart/` directory can carry the named-dependency declaration; both `argocd/` and `flux/` wrappers consume it.

### Sub-target 5 — UI considerations (Aaron 2026-05-26 question)

ArgoCD ships with a polished OSS UI (graph view + sync status + manifest diff + sync-wave visualization + rollback). Flux's OSS UI options are thinner:

| Flux UI option | Status |
|---|---|
| **Weave GitOps OSS** | Closest ArgoCD-UI analog; less polished; Weaveworks shut down 2024; OSS continues community-maintained |
| **Capacitor** | Community-built lightweight Flux UI; runs as Flux extension |
| **Headlamp + Flux plugin** | Generic K8s UI with Flux integration |
| **k9s + Flux plugin** | TUI not GUI |

The "conversation is the new UI" framing per Aaron 2026-05-26 ties to [081KSGS9H0008QG0R0005P83AP](../P1/081KSGS9H0008QG0R0005P83AP-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md): once the AI-runbook substrate ships, the GUI matters less — operators describe ontology shapes; agents materialize state; status surfaces via conversational query rather than dashboard polling. UI parity between engines is a near-term concern; long-term the AI-runbook layer is the actual operator surface.

For the near term: document the UI difference as one tradeoff axis when operators pick `engine`; Flux's thinner UI is offset by `dependsOn` legibility + simpler config + Aaron's curiosity about whether "Flux is simpler" claim holds in practice.

### Sub-target 6 — multi-cluster A/B experimentation runbook

Operator-facing runbook for standing up two clusters (one ArgoCD, one Flux) with the SAME Helm charts + workloads. Measure:

- Time-to-first-deployment per engine
- Sync-fail recovery behavior (selfHeal vs Flux's reconcile)
- Operator cognitive cost (what surfaces to inspect; how to debug; how to roll back)
- UI usability for the team's tasks (per Sub-target 5 axis)
- Progressive-delivery story (ArgoCD + Argo Rollouts vs Flux + Flagger vs Flux + Argo Rollouts per 081KSGS9H0008QG0R003A37Z65 compose nuance)

Empirical data feeds future engine-evaluation decisions; bandwidth-served work per `.claude/rules/bandwidth-served-falsifier.md`.

## Acceptance

- [ ] `engine` field added to ClusterNode CRD schema (depends on 081KSGS9H0008QG0R002K93MWX)
- [ ] Helm-charts-first directory layout established + documented
- [ ] At least one app shipped with BOTH `argocd/application.yaml` AND `flux/helmrelease.yaml` wrappers
- [ ] Flux installable on a cluster via the chosen install path (`flux bootstrap github` OR Helm-chart install)
- [ ] `tools/cluster/deps-to-engine-config.ts` ships (single-source-of-truth dependency graph → engine-specific output)
- [ ] Multi-cluster A/B runbook documented per Sub-target 6
- [ ] Empirical comparison data captured on at least one workload across both engines

## Composes with

- **[081KSGS9H0008QG0R003A37Z65](../P1/081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — Helm-as-convergence-point + multi-engine substrate framing (this row IS the concrete Flux-second-engine implementation of that architectural principle)
- **[081KSGS9H0008QG0R0027HJZYH](../P1/081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — parent cluster-bring-up substrate (gets the `engine` field via ClusterNode CRD extension)
- **[081KSGS9H0008QG0R002K93MWX](../P1/081KSGS9H0008QG0R002K93MWX-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md)** — ArgoCD reconciler; the ClusterNode schema this row extends with `engine` field
- **[081KSGS9H0008QG0R0005P83AP](../P1/081KSGS9H0008QG0R0005P83AP-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md)** — AI-runbook substrate; conversation-as-UI framing makes engine-UI-parity less load-bearing long-term

## Out of scope

- Replacing ArgoCD as default (081KSGS9H0008QG0R003A37Z65 explicitly preserves ArgoCD as default per LN+GH+Zeta lineage; this row ADDS Flux as flag-toggleable second engine, NOT supplants the default)
- Engine-agnostic abstraction layer (no plan to wrap both engines behind a Zeta-specific abstraction; per 081KSGS9H0008QG0R003A37Z65's "push to the convergence point; wrap thinly per environment" discipline, the convergence point is Helm; the engine wrappers stay engine-specific)
- Production migration of existing ArgoCD-deployed workloads to Flux (this row is for greenfield workloads + multi-cluster experimentation; existing workloads stay on their engine until evidence supports migration)

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `rg "flux\\b" docs/ memory/ .claude/` → existing references in 081KSGS9H0008QG0R003A37Z65 (Helm-as-convergence-point); no prior Flux-second-engine row
- `gh pr list --state all --search "081KSGS9H0008QG0R00352WW0V"` → no in-flight collision
- `gh pr list --state all --search "flux engine"` → no in-flight collision
- ID 081KSGS9H0008QG0R00352WW0V next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R002QQNA79; 081KSGS9H0008QG0R00033DT02 in flight via #5226; 081KSGS9H0008QG0R0005P83AP in flight via #5225)

## Origin

Aaron 2026-05-26 in conversation about ServiceTitan-uses-Flux + Helm-as-convergence-point: *"backlog flux over argocd so we can have a flag and support both eventually"*. Composes with 081KSGS9H0008QG0R003A37Z65's Helm-as-convergence-point + multi-engine-experimentation framing landed in #5225.

Filed as P2 because:

1. ArgoCD default (per 081KSGS9H0008QG0R003A37Z65) is operationally settled; Flux-as-second-engine is additive enhancement not blocker
2. Multi-cluster A/B experimentation requires multi-cluster substrate (081KSGS9H0008QG0R0027HJZYH family) to be operational first
3. Substrate authoring discipline (Helm-charts-first + engine-thin-wrappers) can land independently of full Flux deployment
4. Empirical engine-comparison data is the value here; the substrate-engineering work scaffolds the data collection
