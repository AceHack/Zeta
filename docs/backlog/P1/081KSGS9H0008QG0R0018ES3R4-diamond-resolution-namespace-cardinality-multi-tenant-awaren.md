---
id: 081KSGS9H0008QG0R0018ES3R4
priority: P1
status: open
title: diamond-resolution namespace + cardinality + multi-tenant-awareness — three orthogonal properties on shared charts that determine whether the Maven-for-Helm graph deploys ONE shared instance or N per-consumer instances; substrate-engineering target for Ace package manager's chart-graph resolver (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R00367G209
composes_with:
  - 081KQZVQW0008QG0R000ZHEN62
  - 081KR2E4K0008QG0R002YE3MMD
  - 081KSE6WT0008QG0R000YYH3DY
  - 081KSGS9H0008QG0R003A37Z65
  - 081KSGS9H0008QG0R00352WW0V
tags: [ace-feature, dependency-graph, helm, diamond-resolution, namespace-policy, cardinality, multi-tenant, cluster-singleton, maven-for-helm]
---

## Problem

[081KSGS9H0008QG0R00367G209](081KSGS9H0008QG0R00367G209-zeta-as-dependency-graph-and-variable-passing-layer-on-top-of-helm-empty-architectural-slot-claim-aaron-2026-05-26.md) names the C++ diamond / multiple-inheritance problem for Helm umbrella charts + cites Maven's `<dependencyManagement>` + Linux package managers' `Provides:` as prior art for the resolution-primitive layer. Aaron 2026-05-26 sharpened with the third dimension:

> *"many charts declare their dependencies but then what do you do when two charts have the same dependency, do you deploy one or two versions of the dependency and it's project dependent on if the dependency uses namespaces for multi use or it's built in a single namespace (most of the time)"*

The deploy-one-or-N-instances decision IS NOT determined by Maven-style version-resolution alone. It depends on **four orthogonal properties of the shared chart** (Aaron 2026-05-26 sharpening separated multi-tenant from multi-use; original three-property framing conflated them):

1. **Cardinality property** — how many instances CAN exist per cluster? (cluster-singleton vs N-allowed)
2. **Namespace policy** — does the chart install cluster-scoped resources (CRDs, ClusterRole, validating webhook) that PRECLUDE multiple instances? (cluster-scoped vs namespace-scoped)
3. **Multi-TENANT awareness** (cross-tenant axis) — does ONE instance support N TENANTS (different users / organizations / customers) via tenant-level logical isolation (per-tenant database / schema / namespace partition)? (multi-tenant-aware vs single-tenant)
4. **Multi-USE awareness** (intra-tenant axis) — within a SINGLE tenant, does ONE instance support N DIFFERENT USES across that tenant's microservices (cache + pubsub + session-store from one redis)? Or do separate microservices need separate instances even when same tenant? (multi-use-aware vs single-use-per-instance)

### Why multi-tenant ≠ multi-use (the conflation Aaron 2026-05-26 caught)

The maintainer's framing:

> *"it's worse than multi tenant you are right but even within tenant you might need two redisis for different microservices so that's why i said multi use instead of multi tenant but maybe it's two dimensions and i'm conflating one."*

The two dimensions ARE genuinely separate:

| Scenario | Tenant axis | Use axis | Resolution |
|---|---|---|---|
| One SaaS company; one redis for cache; multiple microservices CAN share keyspaces | single-tenant | multi-use-aware | 1 instance; namespace prefix per use |
| One SaaS company; redis for cache (low latency) + redis for pubsub (durability config) + redis for session store (different TTL policies) — same tenant but configs incompatible | single-tenant | single-use-per-instance | N instances per tenant; one per use |
| Multi-customer SaaS; cache shared via keyspace-per-customer; one redis | multi-tenant-aware | multi-use-aware | 1 instance; dual partition (tenant + use) |
| Multi-customer SaaS; per-customer redis instances mandated for isolation/compliance | multi-tenant-aware (in posture) but per-customer-deployed | depends per-instance | N instances per tenant |
| Per-microservice DBs (e.g., postgres for orders-service + postgres for inventory-service); same company; configs/schemas radically different | single-tenant | single-use-per-instance | N instances; one per microservice |

The redis-with-3-different-configs case is the canonical example: SAME tenant; THREE microservices; each microservice's redis needs a DIFFERENT config (maxmemory-policy / persistence-mode / replica-count). Even if redis IS multi-tenant-aware at the keyspace level, it's NOT multi-use-aware at the config level — you can't run one redis with three incompatible configurations.

### Decoupling the two axes — chart property declaration

Charts can be characterized on both axes independently:

```yaml
# zeta-chart-outputs.yaml
zeta:
  multi-tenant:                # cross-tenant axis (different users)
    supported: true            # bitnami/postgres: yes (per-database isolation)
    tenant-axis: "database"    # how tenants are partitioned
    tenant-isolation: "logical"

  multi-use:                   # intra-tenant axis (different microservices)
    supported: false           # postgres typically deployed per-microservice
    use-axis: null             # no shared-use mechanism for postgres
    note: "Even within one tenant, separate microservices want separate postgres instances for schema isolation + independent backup policies + version upgrades"
```

Example characterizations for common shared charts:

| Chart | multi-tenant-aware | multi-use-aware | Typical deploy pattern |
|---|---|---|---|
| postgres / mysql / mongo (per-app DB shape) | yes (databases) | NO (each microservice gets own pod) | per-microservice instance |
| redis (cache) | yes (keyspaces) | usually NO (different configs per use) | per-use instance per tenant |
| kafka | yes (topics) | yes (topics serve multiple producers/consumers) | one cluster; many topics |
| cert-manager | n/a (cluster-singleton) | n/a (single-use by definition) | 1 per cluster |
| elasticsearch | partially (indices) | partially (heavy-write vs heavy-read need different node configs) | often N for write-heavy + read-heavy split |
| vault | yes (namespaces) | yes (secret-engines) | 1 cluster; many engines |
| ingress-nginx | n/a (cluster-singleton; multi-class for use-split) | uses class for multi-use | 1 controller; N IngressClasses |

These four properties combine into archetypes that drive different diamond-resolution policies.

## The 4 archetypes of shared chart dependencies

| Archetype | Properties | Diamond resolution | Examples |
|---|---|---|---|
| **Cluster-singleton + cluster-scoped** | cardinality=1; install cluster-scoped CRDs / ClusterRole / webhooks; can't coexist | ONE shared instance; cluster-owner designation; consumers MUST consume the designated instance | cert-manager, ingress-nginx, argocd, prometheus-operator, kube-state-metrics, vault, istio |
| **Multi-tenant-aware + namespace-scoped** | cardinality=N; one instance serves M consumers via logical isolation (databases / schemas / topics / keyspaces / tenants) | ONE shared instance; consumers consume by tenant-id (DB name, topic prefix, etc.); shared infra cost | postgres with N databases, kafka with N topics, redis with N keyspaces, mysql multi-DB, mongodb multi-DB |
| **Single-tenant + namespace-isolated** | cardinality=N; each instance lives in one namespace; no shared state across consumers | MULTIPLE instances, one per consumer namespace; isolation > efficiency | per-app postgres (each app gets own DB pod), per-app redis, per-app rabbitmq, per-app elasticsearch |
| **Single-tenant + cluster-scoped (cost-bound)** | cardinality=1 by cost, not by technical capability; could be N but expensive | ONE shared via explicit ownership-designation; consumers reference; cost-driven | one large prometheus per cluster, one shared opensearch, GPU-pool charts, expensive observability stacks |

The decision is **chart-author property** + **operator-deployment-policy** + **cluster-resource-economics**. The same chart can be deployed under different archetypes by different operators based on cluster economics (one Aaron's prod-cluster prometheus shared at archetype #4; another operator's dev-cluster prometheus per-app at archetype #3).

## How the chart-graph resolver decides

The Ace dependency-graph resolver (per 081KSGS9H0008QG0R00367G209) needs to know each shared chart's archetype to compute the right diamond-resolution policy. Three inputs:

### Input 1 — chart-declared property (the chart author's claim)

Charts declare their archetype via the typed-output substrate (081KSGS9H0008QG0R00367G209 Sub-target 3). Recommended via `zeta-chart-outputs.yaml`:

```yaml
# alongside Chart.yaml for upstream charts (Zeta-side wrapper file);
# OR embedded in Chart.yaml `annotations` for charts we author
zeta:
  archetype: cluster-singleton  # or multi-tenant-aware / namespace-isolated / cost-bound-shared
  cardinality:
    max: 1                       # cluster-singleton: 1; namespace-isolated: unbounded
    constraint: cluster-scope    # cluster-scope / namespace-scope / no-constraint
  multi-tenant:
    supported: false             # true for postgres-with-N-databases shape
    tenant-axis: null            # "database" / "schema" / "topic" / "keyspace" / etc.
    tenant-isolation-level: null # "logical" / "physical" / "no-isolation"
  installs-cluster-scoped-resources: [crd, clusterrole, validatingwebhookconfig]
```

### Input 2 — operator policy (the cluster operator's choice)

Operators declare per-cluster policy for archetypes where the chart supports multiple modes:

```yaml
# cluster-policy/postgres.yaml (or in AppDependencyGraph spec)
postgres:
  mode: multi-tenant-shared  # multi-tenant-shared / per-namespace / cost-bound-shared
  shared-instance:
    namespace: shared-data
    name: postgres-cluster
    superuser-secret: postgres-superuser-creds
  per-tenant:
    database-name: "{{ app.name }}-db"
    username: "{{ app.name }}-user"
    password-secret: "{{ app.name }}-postgres-password"  # generated per-tenant
```

For cluster-singletons, the policy degenerates to "use THE designated instance" — no choice.

### Input 3 — graph-resolution algorithm (Ace's job)

When two umbrella charts depend on the SAME shared chart, Ace's resolver:

1. **Reads each chart's declared archetype** (Input 1)
2. **Reads operator policy** for that chart in this cluster (Input 2)
3. **Resolves to per-archetype policy**:
   - **Cluster-singleton**: pick THE owner; rewrite both umbrellas' consumption to reference owner; fail if neither umbrella designated as owner (operator MUST designate)
   - **Multi-tenant-aware + shared mode**: pick THE owner; rewrite both umbrellas to consume by tenant-id; generate per-tenant credentials/configs/topics; wire connection strings via variable-passing (081KSGS9H0008QG0R00367G209)
   - **Single-tenant + namespace-isolated + per-namespace mode**: keep both instances; each in own namespace; no cross-rewriting
   - **Cost-bound-shared mode**: same as multi-tenant-aware but operator explicitly opts into cost-sharing tradeoff

The resolver's output IS the engine-specific config (081KSGS9H0008QG0R00352WW0V derivability-asymmetry): for ArgoCD, sync-wave-annotated Applications with the right ownership references; for Flux, `dependsOn` + `valuesFrom` arrays pointing at the right shared resources.

## Composes with 081KSGS9H0008QG0R00367G209 sub-targets — what changes / adds

081KSGS9H0008QG0R00367G209 Sub-target 1 (named-dependency-graph spec) extends with archetype declaration per Input 1 above.

081KSGS9H0008QG0R00367G209 Sub-target 2 (graph → engine-specific config emitter) extends with per-archetype diamond-resolution per Input 3 above.

081KSGS9H0008QG0R00367G209 Sub-target 3 (typed output resolution) extends to include tenant-id outputs (e.g., postgres shared-instance emits `database-name` + `connection-url` + `password-secret-ref` per consumer) — variable-passing flows tenant-scoped values, not just chart-scoped.

NEW sub-targets specific to this row:

### Sub-target 081KSGS9H0008QG0R0018ES3R4.1 — archetype detection from upstream charts

Most upstream charts (Bitnami, ArtifactHub, Argo, etc.) don't ship `zeta-chart-outputs.yaml`. Ace needs:

- A way to declare archetypes for upstream charts in our wrapper substrate (`maintainers/<op>/cluster-apps/<chart>/zeta-chart-outputs.yaml`)
- Heuristics to detect archetype from chart contents (CRDs declared → likely cluster-singleton; helm values include `tenants:` array → likely multi-tenant-aware; etc.)
- Manual override for operator-known specifics

### Sub-target 081KSGS9H0008QG0R0018ES3R4.2 — namespace-policy enforcement

Diamond-resolution decisions affect which namespace each instance lives in:

- Cluster-singleton: operator-designated namespace (often `system-X` like `cert-manager` namespace)
- Multi-tenant-aware shared: operator-designated namespace (often `shared-data` or `infra-platform`)
- Per-namespace mode: same namespace as the consumer

Resolver emits the per-instance namespace into engine-specific config; namespace conflicts surface as validation errors before deploy.

### Sub-target 081KSGS9H0008QG0R0018ES3R4.3 — secret + connection-string flow per tenant

When N consumers share a multi-tenant-aware chart, each tenant needs:

- Its own database/schema/topic/keyspace name
- Its own credentials (username + generated password)
- Its own connection string (composed from shared-instance endpoint + tenant-id)

Ace must generate these per consumer + wire them via the variable-passing substrate. Today this is operator-manual; the resolver formalizes it.

### Sub-target 081KSGS9H0008QG0R0018ES3R4.4 — diamond-conflict surfacing UX

When the diamond can't be resolved (both umbrellas declared owner; archetype mismatch; cardinality violation), surface conflict via `ace deps validate <app>` with explicit conflict messages + suggested resolutions. Operator-facing DX, not just engine output.

### Sub-target 081KSGS9H0008QG0R0018ES3R4.5 — multi-cluster cardinality scope

Cluster-singleton at SINGLE-cluster scope becomes "1 per cluster, N across clusters" at multi-cluster scope. The resolver's cardinality logic extends to multi-cluster awareness when [081KSGS9H0008QG0R00352WW0V](../P2/081KSGS9H0008QG0R00352WW0V-flux-engine-second-engine-support-flag-toggle-multi-cluster-experimentation-aaron-2026-05-26.md) Sub-target 5 (multi-cluster variable flow) lands.

## Acceptance

- [ ] 4 archetypes formally documented + operator-facing docs explain when to use which
- [ ] `zeta-chart-outputs.yaml` schema extended with archetype + cardinality + multi-tenant fields
- [ ] Ace resolver implements the 4-archetype diamond-resolution policy
- [ ] At least one example pair shipped: two app umbrellas sharing postgres in multi-tenant-aware mode + variable-passing generates per-app credentials/configs
- [ ] At least one example pair shipped: two app umbrellas sharing cert-manager in cluster-singleton mode + both consume the designated instance
- [ ] `ace deps validate <app>` surfaces diamond conflicts explicitly with suggested resolutions
- [ ] Heuristic archetype-detection works for top 20 Bitnami charts (postgres, mysql, redis, kafka, mongodb, etc.) + cluster-singletons (cert-manager, ingress-nginx, prometheus-operator, argocd)

## Composes with

- **[081KSGS9H0008QG0R00367G209](081KSGS9H0008QG0R00367G209-zeta-as-dependency-graph-and-variable-passing-layer-on-top-of-helm-empty-architectural-slot-claim-aaron-2026-05-26.md)** — parent dependency-graph substrate; THIS row extends the diamond-resolution layer with the namespace+cardinality+multi-tenant dimension
- **[081KQZVQW0008QG0R000ZHEN62](081KQZVQW0008QG0R000ZHEN62-ace-dlc-content-packs-kernel-extensions-package-manager-2026-05-07.md)** + **[081KR2E4K0008QG0R002YE3MMD](081KR2E4K0008QG0R002YE3MMD-ace-dlc-package-manager-cli-2026-05-08.md)** + **[081KSE6WT0008QG0R000YYH3DY](../P2/081KSE6WT0008QG0R000YYH3DY-reference-k8s-local-stack-as-aces-distributable-poc-hats-as-negotiated-fork-structure-on-top-deterministic-declarative-gitops-ai-native-human-native-aaron-2026-05-25.md)** — Ace package manager (implementation home per 081KSGS9H0008QG0R00367G209)
- **[081KSGS9H0008QG0R003A37Z65](081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — Helm-as-convergence-point; the diamond-resolution operates ON the Helm chart layer
- **[081KSGS9H0008QG0R00352WW0V](../P2/081KSGS9H0008QG0R00352WW0V-flux-engine-second-engine-support-flag-toggle-multi-cluster-experimentation-aaron-2026-05-26.md)** — derivability-asymmetry + multi-cluster scope (Sub-target 081KSGS9H0008QG0R0018ES3R4.5 extends to multi-cluster cardinality)

## Out of scope (this row)

- Implementation of any specific shared chart's multi-tenant setup (each chart's tenant model differs — postgres has databases, kafka has topics; deferred to per-chart sub-rows when substrate matures)
- Multi-cluster cardinality scope (081KSGS9H0008QG0R0018ES3R4.5 names it; reserved for follow-on per 081KSGS9H0008QG0R00352WW0V Sub-target 5 dependency)
- Auto-migration of existing operator-manual shared-chart setups to the resolver-managed model

## Origin

Aaron 2026-05-26 sharpening of the C++ diamond framing from 081KSGS9H0008QG0R00367G209:

> *"many charts declare their dependencies but then what do you do when two charts have the same dependency, do you deploy one or two versions of the dependency and it's project dependent on if the dependency uses namespaces for multi use or it's built in a single namespace (most of the time)"*

The namespace + cardinality + multi-tenant-awareness dimension is what the Maven-for-Helm substrate needs in addition to the Maven-prior-art resolution mechanisms (`<dependencyManagement>` / `Provides:` / `<exclusions>` / nearest-wins) — because K8s namespaces are an extra isolation axis Java/jar-land doesn't have.

Filed as P1 because:

1. Without diamond-resolution policies per archetype, the dependency-graph layer can't make the operator's most common decision (one vs N instances)
2. Real-world Helm operators hit this every cluster bring-up (shared postgres? shared redis? per-app or platform?); high-leverage substrate
3. Composes with 081KSGS9H0008QG0R00367G209 — the Maven-for-Helm slot isn't fillable without this dimension
4. Ace-as-implementation-home (per 081KSGS9H0008QG0R00367G209 directive) makes this another Ace feature; consistent with the Ace-as-Zeta-package-manager strategic positioning

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `rg "multi-tenant\|cluster-singleton\|namespace-isolated" docs/backlog/` → no prior row on this specific dimension
- `gh pr list --state all --search "081KSGS9H0008QG0R0018ES3R4"` → no in-flight collision
- ID 081KSGS9H0008QG0R0018ES3R4 next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R00367G209 from #5230 merged 3daa5624c)
- Composes with 081KSGS9H0008QG0R00367G209 (parent); not parallel-shape
