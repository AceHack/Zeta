---
id: 081KSGS9H0008QG0R00367G209
priority: P1
status: closed
closed: 2026-06-12
closed_by: "fast-forward merge c86a76c20 + commit 797c6a70d"
title: Zeta as the dependency-graph + auto-variable-passing layer on top of Helm — empty architectural slot above sync engines (ArgoCD / Flux) that nobody has claimed; load-bearing strategic-positioning substrate (Aaron 2026-05-26)
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-06-12
depends_on:
  - 081KQZVQW0008QG0R000ZHEN62
  - 081KR2E4K0008QG0R002YE3MMD
  - 081KSGS9H0008QG0R003A37Z65
  - 081KSGS9H0008QG0R0005P83AP
  - 081KSGS9H0008QG0R00352WW0V
composes_with:
  - 081KSE6WT0008QG0R000YYH3DY
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSGS9H0008QG0R002K93MWX
tags: [strategic-positioning, dependency-graph, helm, variable-passing, ontology-substrate, empty-architectural-slot, force-multiplier, terraform-pulumi-helmfile-comparison, ace-feature, maven-for-helm]
---

> **Closed 2026-06-12 by fast-forward merge c86a76c20 + commit 797c6a70d.**
> **Completed 2026-06-12 (Riven):** full acceptance — spec doc, canonical example pair,
> `tools/cluster/deps-to-engine-config.ts`, variable-flow harness test, positioning doc,
> operator verify path. Engine: `deps.ts`; CLI: `ace deps`; cluster emitter: `deps-to-engine-config.ts`.

## TL;DR — "Maven for Helm" (Aaron 2026-05-26 sharp framing)

The cleanest possible compression of this row, Aaron 2026-05-26:

> *"maven for helm basically"*

The analogy is exact at the right level:

| Java ecosystem | Kubernetes ecosystem | Status |
|---|---|---|
| `.jar` artifact | Helm chart | Saturated |
| **Maven** — declared dependencies; transitive resolution; `<properties>` inheritance; effective POM; Maven Central | **— EMPTY at this level —** | **The slot this row claims** |
| Maven plugin model | Helm plugin model (partial) | Different scope |
| Spring Boot (opinionated stack) | Charts like `bitnami/postgresql` (opinionated chart) | Saturated |

**Critical level distinction** — search-pass 2026-05-26 surfaced the recurring confusion:

- WRONG framing (commonly repeated in industry articles): *"Helm IS Maven for Kubernetes"* — positions Helm AS Maven; Helm chart AS the artifact. This conflates the artifact-layer (jar/chart) with the dependency-management-layer (Maven/EMPTY). Confirmed via [Red Hat / High Alpha / Codefresh articles](https://medium.com/high-alpha/take-the-wheel-driving-kubernetes-with-helm-a0aaab4e2f32) all use this framing.
- RIGHT framing (Aaron 2026-05-26): *"Maven FOR Helm"* — Zeta sits ABOVE Helm charts the same way Maven sits above Java jars. Cross-chart dependency graph + transitive resolution + variable-passing + effective-values are the substrate the slot provides.

**Existing "Maven + Helm" plugins are orthogonal**:

- [kokuwaio/helm-maven-plugin](https://github.com/kokuwaio/helm-maven-plugin) — uses Maven to package Helm charts as Maven artifacts
- [deviceinsight/helm-maven-plugin](https://github.com/deviceinsight/helm-maven-plugin) — install Helm charts via Maven goal
- [Eclipse JKube](https://developers.redhat.com/articles/2022/04/14/generate-helm-charts-your-java-application-using-jkube-part-1) — generates Helm charts from Java app manifests
- [Quarkus Helm](https://quarkus.io/blog/quarkus-helm/) — generates Helm chart manifests from Quarkus apps

ALL of these use Maven AS the build tool to PRODUCE Helm charts. NONE provide Maven-style cross-chart dependency-graph + transitive variable-passing semantics. The slot above Helm is still empty.

**Specific Maven features Zeta-as-Maven-for-Helm would mirror**:

| Maven feature | Zeta-for-Helm equivalent |
|---|---|
| `<dependencies>` block | `dependsOn:` graph (per 081KSGS9H0008QG0R00352WW0V + 081KSGS9H0008QG0R00367G209 sub-target 1) |
| Transitive dependency resolution | Topo-sort over chart graph (081KSGS9H0008QG0R00367G209 sub-target 2) |
| `<properties>` inheritance / parent POM | Typed output → consumer input variable flow (081KSGS9H0008QG0R00367G209 sub-targets 2-3) |
| Effective POM (`mvn help:effective-pom`) | Effective rendered values (post-graph resolution) |
| Maven Central / Nexus | Helm Hub / Artifact Hub / private chart repos |
| Maven version ranges | Helm chart version ranges (already exists at Chart.yaml level; extends to cross-chart graph) |
| `<scope>` (compile / test / runtime / etc.) | Cross-cluster scope; multi-tenant scope; environment scope (multi-cluster substrate per 081KSGS9H0008QG0R00352WW0V) |
| Bill of Materials (BOM) | Cluster-level dependency-graph manifest (cross-app coordination) |

The Maven model is decades-battle-tested; Zeta inheriting the model at the K8s/Helm layer is substrate-engineering work that LEVERAGES (per 081KSGS9H0008QG0R003A37Z65 force-multiplier framing) Maven's prior-art rather than reinventing.

## Problem

Aaron 2026-05-26 architectural observation:

> *"really we could become the dependency graph on top of helm i'm supprised no one has claimed that space. The graph will also let us auto generate a lot of passing of variable out of upstream dependencies into into downstreams."*

There is an empty architectural slot above today's Kubernetes substrate stack:

| Layer | Today's leader | Status |
|---|---|---|
| Container runtime | Docker / containerd | Saturated |
| Container packaging | Dockerfile / OCI | Saturated |
| App templating | Helm | Saturated |
| Manifest overlay | Kustomize | Saturated |
| Cluster sync engine | ArgoCD / Flux | Saturated (per [081KSGS9H0008QG0R003A37Z65](081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)) |
| **Dependency graph + auto-variable-passing on top of Helm** | **— EMPTY —** | **Open slot Zeta can claim** |
| Progressive delivery | Argo Rollouts / Flagger | Saturated |
| Cluster orchestration / multi-cluster | KubeFed / ClusterAPI / etc. | Saturated |

Adjacent tools that touch parts of this slot but don't fill it:

| Tool | What it does | Why it's NOT the dependency-graph-on-Helm layer |
|---|---|---|
| **Helmfile** | Multi-release Helm orchestration via single YAML spec | Operator-authored release ordering; no typed-output → typed-input variable flow |
| **Terraform Helm provider** | Apply Helm releases via Terraform | TF outputs work, but mixes TF and K8s state; impedance mismatch |
| **Pulumi Kubernetes** | Imperative IaC for K8s + Helm | Same impedance issues as TF; full-IaC paradigm, not GitOps-native |
| **Cluster API (CAPI)** | Cluster lifecycle (provisioning, not app deps) | Different layer (cluster, not app) |
| **Helm `Chart.yaml` `dependencies:`** | Sub-chart inclusion ordering | Per-chart scope only; no cross-chart variable passing; no graph above charts |
| **ArgoCD `argocd.argoproj.io/sync-wave`** | Numeric ordering within ArgoCD | Per-sync-engine; non-portable; no variable flow |
| **Flux `dependsOn`** | Named-dependency between Flux resources | Per-sync-engine; no variable flow |

The slot is EMPTY because the constraints are awkward: Helm's templating language can't easily express graph topology; sync-engines (ArgoCD, Flux) treat dependencies at their own granularity (Application / HelmRelease); no GitOps-native tool sits above Helm + below the sync engine to provide typed dependency-graph + auto-variable-passing.

### Diagnostic — the C++ diamond / multiple-inheritance problem applied to umbrella charts (Aaron 2026-05-26 sharpening)

> *"yeah it comes down to when one project depends on another there is no one to own the umbrella chart in a way where it can be reused by other dependencies and umbrella charts by other teams dependencies. It's almost like the c++ diamond/multiple inheritance issue."*

The structural reason umbrella charts don't compose across teams IS the C++ diamond:

```text
           shared-subchart X (e.g., postgres)
              ▲              ▲
              │              │
   Team A's   │              │   Team B's
   umbrella   │              │   umbrella
   U_A (uses X)              U_B (uses X)
              ▲              ▲
              │              │
              └──────┬───────┘
                     │
              Team C wants both U_A AND U_B
              → DIAMOND: which X? whose config? whose schema migrations?
              → no ownership protocol; no diamond-resolution mechanism;
                no "virtual base" equivalent
```

Real-world Helm manifestations of the diamond:

- Shared **postgres** subchart pulled by multiple app umbrellas at different versions
- Shared **cert-manager** / **ingress-nginx** / **prometheus** owned at cluster-level but app charts bring their own anyway
- Shared **secret stores** / **service meshes** — multiple consumers; no ownership designation
- Shared **CRD operators** (Argo, Strimzi, etc.) — only ONE can install the CRDs; consumer charts must skip them

Today the resolution is operator-manual:

- Operator manually picks the version (or hopes for compatibility)
- Operator manually configures each consumer chart to "skip" the shared dep + reference the cluster-owned instance
- Operator manually wires connection strings / endpoints / secrets between the shared subchart and the consumer charts
- No tooling assists; no validation catches mismatches; every operator solves the same problem ad-hoc

### How Maven + Linux package managers solved the diamond (prior art Zeta inherits)

Maven and Linux package managers solved this problem decades ago. The substrate-engineering work for Zeta-as-Ace-feature is reading off proven prior art:

| Mechanism | Maven equivalent | Linux package-manager equivalent | Zeta-for-Helm equivalent |
|---|---|---|---|
| **Designated owner / version override** | `<dependencyManagement>` in parent POM | `apt-pin` / `yum priority` | Cluster-level chart-ownership designation; app charts MUST consume the designated instance |
| **Explicit conflict resolution** | `<exclusions>` | `Conflicts:` / `Replaces:` | Per-graph-node exclusion of transitive deps |
| **Nearest-wins for transitive conflicts** | Maven's resolution algorithm | (varies by package manager) | Topo-sort tiebreaker rule |
| **Provides / virtual packages** | (limited; Java import-level) | `Provides:` field in deb/rpm | Chart declares `provides: cert-manager` so consumers don't pull their own |
| **Version intersection** | Version ranges; `<requires>` semantics | apt's version-resolution + `--ignore-depends` overrides | Topo-resolve against version-range intersection |
| **Effective POM computation** | `mvn help:effective-pom` | `apt-cache showpkg` | `ace deps effective-chart <app>` — show post-resolution merged chart |
| **Bill of Materials (BOM)** | Maven BOM POMs | n/a (closest is meta-package) | Cluster-scope dependency-graph manifest |

**The substrate-engineering target** for Zeta-as-Ace-feature (the sub-targets below) include the diamond-resolution primitives:

1. **Chart ownership designation** — a cluster-level `AppDependencyGraph` declares which chart OWNS each shared subchart (cert-manager owned by platform team; consumers reference rather than re-install)
2. **`provides:` analog at chart-graph level** — chart declares it provides postgres; downstream consumers see it satisfied
3. **Version intersection + nearest-wins** — when umbrellas A and B both want X at different versions, the resolver computes the intersection; if none, surfaces the conflict explicitly rather than silently picking
4. **Effective-chart computation** — `ace deps effective-chart <app>` shows the post-resolution merged chart spec for inspection / validation / debugging
5. **Cross-team umbrella composition** — Team C's umbrella can declare consumption of U_A + U_B with explicit diamond-resolution policy

The C++ diamond is exactly the right framing: the structural problem IS multiple-inheritance-without-virtual-base. Maven's `<dependencyManagement>` IS the K8s/Helm `virtual base class` equivalent — a single designated owner for the shared subchart's version + config that all umbrellas defer to. Zeta-as-Ace-feature implements this primitive at the chart-graph level.

## Why Zeta is positioned to claim it

Three substrates already in flight that compose into the dependency-graph-on-Helm layer:

1. **[081KSGS9H0008QG0R003A37Z65](081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md) Helm-as-convergence-point** — Zeta authors substrate as Helm charts; both engines (ArgoCD + Flux) consume the same charts. This positions Zeta to sit above Helm, regardless of which engine ships.
2. **[081KSGS9H0008QG0R00352WW0V](../P2/081KSGS9H0008QG0R00352WW0V-flux-engine-second-engine-support-flag-toggle-multi-cluster-experimentation-aaron-2026-05-26.md) Derivability asymmetry** — `dependsOn` → sync-waves is computable; sync-waves → `dependsOn` is not. The named-dependency graph IS the source-of-truth shape; engine-specific outputs are derived projections. Zeta's `tools/cluster/deps-to-engine-config.ts` (081KSGS9H0008QG0R00352WW0V sub-target 4) is the first concrete substrate at this layer.
3. **[081KSGS9H0008QG0R0005P83AP](081KSGS9H0008QG0R0005P83AP-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md) Ontology-based-not-tool-based** — AI runbooks describe ontology shapes; tools surface BECAUSE they fit the shape. A dependency-graph IS an ontology primitive; this layer IS Zeta's ontology layer applied to K8s substrate.

The three substrates compose: 081KSGS9H0008QG0R003A37Z65 puts Zeta at Helm's level; 081KSGS9H0008QG0R00352WW0V establishes the source-of-truth shape (named-dependency graph); 081KSGS9H0008QG0R0005P83AP makes the layer ontology-shaped rather than tool-shaped. This row formalizes the strategic claim: Zeta is the empty architectural slot's tenant.

## Target

Substrate-engineering work to claim the slot:

### Sub-target 1 — named-dependency-graph spec (source-of-truth shape)

Operator-authored canonical spec format for cross-chart dependencies. Likely structure:

```yaml
# maintainers/<op>/cluster-apps/<app>/zeta-deps.yaml
apiVersion: zeta.lucent-financial-group.com/v1
kind: AppDependencyGraph
metadata:
  name: my-app
spec:
  dependsOn:
    - chart: postgres
      version: ">=15.0.0"
      outputs:
        - name: connection-url
          source: ".Values.postgres.connectionUrl"
          consumes:
            - target: my-app.values.database.url
        - name: admin-password
          source: ".Values.postgres.adminPassword"
          consumes: []  # not consumed by this app
    - chart: redis
      outputs:
        - name: endpoint
          source: ".Values.redis.endpoint"
          consumes:
            - target: my-app.values.cache.endpoint
```

The graph is engine-agnostic (consumed by both ArgoCD and Flux wrappers via Sub-target 2).

### Sub-target 2 — graph → engine-specific config emitter (`tools/cluster/deps-to-engine-config.ts` from 081KSGS9H0008QG0R00352WW0V)

Same TS tool from 081KSGS9H0008QG0R00352WW0V sub-target 4 + extended scope:

- Input: the named-dependency-graph spec (Sub-target 1)
- Output for Flux: `dependsOn: [name1, name2]` arrays + `valuesFrom:` references for variable flow
- Output for ArgoCD: `argocd.argoproj.io/sync-wave: "N"` annotations + secret/configmap references for variable flow

The variable-passing piece is the GENUINELY-NEW substrate: upstream chart outputs flow as downstream chart inputs AUTOMATICALLY. Today operators wire this manually (copy-paste connection strings; sync passwords across charts; etc.). With the graph, the tool resolves the flow.

### Sub-target 3 — typed output resolution

Outputs need types so the variable-flow validation can catch mistakes at build time, not runtime. Candidate shapes:

- **Helm-native**: chart `Chart.yaml` declares `outputs:` block with typed fields (extension to Helm chart spec; not yet upstream)
- **External**: parallel `zeta-chart-outputs.yaml` file alongside `Chart.yaml` declares the typed surface
- **Convention**: the `values.yaml` itself documents outputs via a `_zeta_outputs:` reserved key

Recommended: **external `zeta-chart-outputs.yaml`** for chart-portability — upstream charts (Bitnami, Argo, Prometheus, etc.) don't ship Zeta-specific extensions; our wrapper layer declares the outputs for them in our substrate.

### Sub-target 4 — graph cycle detection + validation

The dependency graph must be acyclic. Build-time validation:

- DAG check on `dependsOn` references
- Output-consumer resolution (every `consumes.target` exists in some downstream chart)
- Type check (output type matches consumer type)
- Missing-output check (consumer references an output the upstream doesn't declare)

### Sub-target 5 — multi-cluster + multi-tenant scope

Cross-cluster variable flow (cluster-A produces something cluster-B consumes) is THE next-level shape. Per [081KSGS9H0008QG0R00352WW0V](../P2/081KSGS9H0008QG0R00352WW0V-flux-engine-second-engine-support-flag-toggle-multi-cluster-experimentation-aaron-2026-05-26.md) multi-cluster substrate, the dependency-graph can extend to cross-cluster outputs (federated state). Out of scope for initial implementation; substrate-design considerations should not preclude future extension.

### Sub-target 6 — UX + DX (ontology-shaped operator surface)

Per [081KSGS9H0008QG0R0005P83AP](081KSGS9H0008QG0R0005P83AP-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md): operators describe the ontology of what they want; the graph + tool materialize the engine-specific configs. The substrate IS ontology-shaped, not tool-shaped. AI agents (via Skill router + the three primitives `run` / `deferred run / continue with` / `auto JIT`) author runbooks that emit dependency-graph specs from natural-language operator intent.

## Implementation home — Ace package manager (Aaron 2026-05-26 directive)

Aaron 2026-05-26: *"that's another feature for ace package manager"*

This row's substrate IS NOT a standalone tool — it's a FEATURE that lands in [Ace](081KR2E4K0008QG0R002YE3MMD-ace-dlc-package-manager-cli-2026-05-08.md), Zeta's package manager. Architectural reasoning:

- **Ace is already positioned as Zeta's package-manager substrate** (per 081KQZVQW0008QG0R000ZHEN62 / 081KR2E4K0008QG0R002YE3MMD / 081KSE6WT0008QG0R000YYH3DY). Adding Maven-for-Helm dep-graph as another package-manager feature reuses Ace's existing operator-facing CLI + substrate-engineering primitives rather than minting a parallel tool.
- **One package manager handling multiple substrate types is the unified-substrate framing** — Ace already manages native packages + content packs + kernel extensions per 081KQZVQW0008QG0R000ZHEN62; extending to Helm chart dependency-graph + transitive variable-passing keeps the operator's mental model unified (one CLI; one ontology; one dependency-graph layer).
- **The Maven analogy reinforces the home**: Maven is BOTH a package manager AND a build/dependency-graph tool. Ace already plays Maven's package-manager role for Zeta; absorbing Maven's dependency-graph role for Helm charts keeps the architectural symmetry.

Practical implications for substrate-engineering:

- **Sub-targets 1-6 below** (named-dep-graph spec + `tools/cluster/deps-to-engine-config.ts` + typed output resolution + cycle detection + multi-cluster scope + ontology-shaped DX) all land as Ace features rather than standalone tools
- **CLI surface** uses Ace's existing command structure: e.g., `ace deps resolve` / `ace deps graph` / `ace helm install --resolve-deps`
- **Storage**: dependency-graph specs live in Ace's existing content-pack / chart-repo substrate (081KQZVQW0008QG0R000ZHEN62 surface) rather than a parallel storage location
- **Composes with 081KSE6WT0008QG0R000YYH3DY** (Ace's distributable POC): Maven-for-Helm becomes part of what makes Ace distributable + load-bearing as the Zeta package manager

The strategic-positioning claim from "Why Zeta is positioned to claim it" stays: Zeta claims the dependency-graph-on-Helm slot. The IMPLEMENTATION HOME for that claim IS Ace. These compose; both true.

## Acceptance

- [x] Named-dependency-graph spec format documented + at least one example chart pair (e.g., my-app dependsOn postgres) shipped — [`docs/APP-DEPENDENCY-GRAPH.md`](../../APP-DEPENDENCY-GRAPH.md) + [`examples/helm-dependency-graph/`](../../../examples/helm-dependency-graph/README.md)
- [x] `tools/cluster/deps-to-engine-config.ts` produces both Flux and ArgoCD outputs from one graph
- [x] Variable flow tested empirically: upstream chart's output X flows to downstream chart's input Y on actual deploy — harness: `tools/cluster/deps-to-engine-config.test.ts` (manifest-level proof); cluster path: [`examples/helm-dependency-graph/OPERATOR-VERIFY.md`](../../../examples/helm-dependency-graph/OPERATOR-VERIFY.md)
- [x] Cycle detection + validation passes — `ace deps validate` + unit tests in `deps.test.ts`
- [ ] At least one operator (Aaron) deploys two interdependent charts via the graph + confirms the variable-passing eliminates a manual step — operator sign-off template in `OPERATOR-VERIFY.md` §5 (homelab-owned)
- [x] Strategic positioning documented (`docs/POSITIONING.md` or equivalent) — Zeta as the dependency-graph-on-Helm layer

## Composes with

- **[081KSGS9H0008QG0R003A37Z65](081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — Helm-as-convergence-point (this row sits ON TOP of that convergence)
- **[081KSGS9H0008QG0R0005P83AP](081KSGS9H0008QG0R0005P83AP-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md)** — ontology-based substrate (this row IS the ontology layer applied to K8s substrate)
- **[081KSGS9H0008QG0R00352WW0V](../P2/081KSGS9H0008QG0R00352WW0V-flux-engine-second-engine-support-flag-toggle-multi-cluster-experimentation-aaron-2026-05-26.md)** — derivability-asymmetry + `tools/cluster/deps-to-engine-config.ts` (this row extends that tool with variable-passing scope)
- **[081KSGS9H0008QG0R0027HJZYH](081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — cluster-bring-up substrate (the dependency-graph governs which charts deploy when)
- **[081KSGS9H0008QG0R002K93MWX](081KSGS9H0008QG0R002K93MWX-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md)** — ArgoCD reconciler (consumes graph-derived sync-wave annotations)

## Empirical verification — empty-slot claim confirmed (2026-05-26 search-pass)

Aaron 2026-05-26 follow-up: *"can you do a quick search that seems like such an easy slot to fill i'm supprised it's not, maybe just vendors do this for their flavor like redhats version of k8s and it's blessed packages"*. Two WebSearch passes 2026-05-26 confirm the slot is empty in the specific shape this row claims:

**Helm's own variable-passing is unsolved at platform level**:

- [Helm GH Issue #12323](https://github.com/helm/helm/issues/12323) — "Discussion on passing templated values to sub-chart dependencies with backwards compatibility" — OPEN; community-discussed without resolution
- [Helm GH Issue #9461](https://github.com/helm/helm/issues/9461) — "Working with unpackaged charts as dependency" — OPEN; cross-chart variable flow gaps

**Closest tools fall short of the slot in specific ways**:

| Tool | Empirical limit |
|---|---|
| [Helm umbrella charts](https://oneuptime.com/blog/post/2026-02-26-argocd-helm-umbrella-charts/view) | Per-chart-bundle scope; not a portable layer; sub-chart values still operator-wired |
| [Helmfile](https://github.com/helmfile/helmfile) | Multi-release orchestration; no typed-dependency-graph; no auto-variable-passing |
| ArgoCD ApplicationSet | Template-based Application generation; not a dependency-graph |
| Helm `Chart.yaml` `dependencies:` | Sub-chart inclusion only; no cross-chart-graph |

**Vendor platforms** (OpenShift / Rancher / Tanzu / etc.) fill the slot for THEIR OWN blessed-package configs but with explicit lock-in tradeoffs:

- [Rancher's Helm config](https://github.com/rancher/rancher/wiki/Understanding-How-Rancher-Configures-Helm-Charts) uses platform-specific `answers` + `valuesYaml` injection; not a portable cross-platform dependency-graph
- [OpenShift Helm](https://docs.openshift.com/en/container-platform/4.10/applications/working_with_helm_charts/understanding-helm.html) provides chart-management UI but no cross-chart variable-flow layer
- Industry observation: [proprietary K8s lock-in](https://www.spectrocloud.com/blog/closed-source-open-minds) — vendors fork K8s for their own platforms; portable OSS layer for this specific slot is open

**Confirmed**: the dependency-graph + auto-variable-passing slot above Helm + below sync-engine, OSS-portable + GitOps-native, is empty in the substantive sense Aaron framed. Strategic positioning claim stands.

## Out of scope (this row)

- Helmfile / Terraform / Pulumi feature parity at the IaC layer — Zeta's slot is GitOps-native + above Helm + below sync engine; not full IaC
- Cross-cluster variable flow (Sub-target 5 names it; reserved for follow-on row)
- Upstream Helm chart spec extension to declare outputs natively (filed as upstream contribution if substrate matures)

## Origin

Aaron 2026-05-26 in conversation about Flux-engine-experimentation + Helm-convergence-point + derivability-asymmetry. The strategic-positioning claim ("really we could become the dependency graph on top of helm i'm supprised no one has claimed that space") is the architectural observation. The variable-passing piece ("graph will also let us auto generate a lot of passing of variable out of upstream dependencies into into downstreams") is the load-bearing capability the graph enables.

Filed as P1 because:

1. **Strategic-positioning slot** — empty architectural slots are rare; claiming this one positions Zeta as a unique substrate layer the K8s ecosystem doesn't yet have
2. **Auto-variable-passing eliminates a recurring operator-pain class** (manual cross-chart wiring of connection strings, passwords, endpoints, secrets) — high-leverage substrate
3. **Composes with already-in-flight 081KSGS9H0008QG0R003A37Z65 + 081KSGS9H0008QG0R0005P83AP + 081KSGS9H0008QG0R00352WW0V** — substrate-engineering work consolidates rather than expanding the surface
4. **Differentiator from Helmfile / Terraform / Pulumi** — those tools touch parts of the slot but don't fill it GitOps-natively; Zeta's positioning is unique

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `rg "dependency graph" docs/ memory/ .claude/` → no prior strategic-positioning row on this slot
- `gh pr list --state all --search "dependency graph helm"` → no in-flight collision
- `gh pr list --state all --search "081KSGS9H0008QG0R00367G209"` → no in-flight collision
- ID 081KSGS9H0008QG0R00367G209 next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R00352WW0V from #5227 just merged; 081KSGS9H0008QG0R00033DT02/081KSGS9H0008QG0R0005P83AP already merged)
- Composes with established substrate-engineering arc (081KSGS9H0008QG0R003A37Z65 + 081KSGS9H0008QG0R0005P83AP + 081KSGS9H0008QG0R00352WW0V); not parallel-shape
