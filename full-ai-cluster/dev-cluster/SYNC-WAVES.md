# ArgoCD sync waves — App-of-Apps dependency ordering

> **THE GRAPH IN THIS FILE IS NO LONGER MAINTAINED BY HAND.**
>
> Bring-up order is DERIVED from
> [`full-ai-cluster/k8s/sync-wave-dependency-graph.yaml`](../k8s/sync-wave-dependency-graph.yaml)
> by `ace`'s own dependency engine (`resolveGraph` in
> `src/Core.TypeScript/ace/deps.ts`), and the derivation is checked against the
> live `argocd.argoproj.io/sync-wave` annotations on every run of
> `src/Core.TypeScript/cluster/derive-sync-waves.ts`.
>
> ```bash
> bun src/Core.TypeScript/cluster/derive-sync-waves.ts   # prints the derived order + every disagreement
> ```
>
> **Why the change.** This document used to be the only statement of order, and
> on 2026-08-21 it named **34** components while **46** `kind: Application`
> manifests shipped — twelve (`agent-memory`, `arc-controller`,
> `arc-runner-set`, `cdi`, `cilium-lb-ipam`, `gmod`, `headlamp`, `headscale`,
> `kubevirt`, `minio`, `platform`, `seaweedfs`) appeared in its graph nowhere at
> all. That was read as stale documentation. It was not: a hand-maintained
> artifact was standing where a derived one was intended (Aaron, 2026-08-21:
> *"for our sync waves, we are supposed to use our ace package manager to
> calculate the sync waves so the order of the helm charts can be derived where
> there are dependencies"*). Correcting the twelve would have made this file
> accurate until the next Application landed. Deriving the order makes the
> omission **impossible**: an Application missing from the declaration is a
> refusal, not an invisible gap.
>
> **What is still true below.** The *rationale* prose ("Why this order", "What
> ArgoCD actually does with waves", the hat-system internal waves) is the
> narrative the declaration's citations point back to, and it is kept. The
> per-app wave table that used to live here is deleted rather than corrected —
> reproducing the roster by hand in a second place is the defect, not the fix.
>
> **Eight disagreements are open.** The derivation currently contradicts the
> live annotations in eight places, all registered with a reason in
> `ORDER_ADJUDICATION_PENDING` and printed on every run. They are reported, not
> repaired: wave order sequences bring-up on a real cluster and a wrong reorder
> is a broken bootstrap.

ArgoCD reconciles all Applications under the root App-of-Apps
in parallel by default. That breaks for apps with cross-app
dependencies (e.g., a workload needs Vault before it can pull
its secret, or needs the hat-system CRDs before its HatBindings
can be created).

Solution: per-app `argocd.argoproj.io/sync-wave` annotation on
each `Application.yaml`. Lower waves reconcile first.

## The dependency graph

Declared in [`full-ai-cluster/k8s/sync-wave-dependency-graph.yaml`](../k8s/sync-wave-dependency-graph.yaml)
— one node per shipped Application, every `dependsOn` edge carrying a citation
to the artifact that grounds it (a `storageClassName: longhorn` PVC, a
`cert-manager.io/v1` resource, an `endpoint:` pointing at another app's
Service). `ace` topologically sorts it and assigns DAG heights; run the checker
above to print them.

The bootstrap chain that precedes ArgoCD is unchanged and is the head of that
graph:

```
Bootstrap (K3S manifests, BEFORE ArgoCD takes over):
  Cilium → cert-manager → Vault → SPIRE CRDs → SPIRE → Trust Manager → ESO → ArgoCD
```

The `SPIRE CRDs` step was always in `k8s/bootstrap/spire-install.yaml` (a
`spire-crds` HelmChart ahead of the `spire` one) and was missing from this line.
It is stated now because it is a REAL edge, not a formality: the spire chart
renders three `ClusterSPIFFEID` resources and ships no CRDs for them, so a lane
without that step gets `one or more synchronization tasks are not valid` and
zero pods — which is exactly what the ArgoCD/kind lane got until 2026-08-22,
when `k8s/applications/spire-crds/Application.yaml` gave that lane the same
source the metal one always had.

Note what the derived heights are **not**: they are not the wave numbers. ace's
heights run `0..N`; the live annotations run `-90..50`. Requiring the two to be
equal would be a coincidence of counts, not a check. What is checked is that the
hand-written assignment is a **linear extension** of the derived partial order —
every cited dependency reconciles strictly before its dependent.

## Why this order

- **Self-management first**: a broken ArgoCD upgrade fails fast,
  before downstream apps get half-reconciled by a degraded ArgoCD.
- **Foundation second** (CNI, cert-manager, Vault, SPIRE, Trust
  Manager, ESO): everything else depends on these. They were
  already installed by the K3S bootstrap manifests; the App-of-Apps
  ADOPTS them (chart-managed from here forward).
- **Gatekeeper before workloads**: OPA constraints applied to a
  resource that landed BEFORE the constraint do nothing. Land
  policies first, then workloads.
- **Hat-system CRDs early**: any future workload may want to declare
  HatBindings or be subject to Hat-related policies. CRDs need to
  exist when the workload reconciles.
- **Data planes before consumers**: CockroachDB / NATS / Redis /
  Weaviate / PostgreSQL must be Ready before apps that connect.
  *Checked, not assumed:* the `temporal → cockroachdb` and
  `hindsight → cockroachdb` edges are in the declaration but their wiring is
  still commented out in the manifests, and the `orleans → cockroachdb` /
  `orleans → nats` edges this document used to assert are **not declared**,
  because `applications/orleans/configmap.yaml` configures
  `"clustering": { "provider": "kubernetes" }` and no NATS endpoint appears in
  the Application, ConfigMap, or StatefulSet. Declaring an edge the tree does
  not carry would be the same defect in the other direction.
- **Apps with secret dependencies late**: agent-runtime workloads
  pull LLM API keys from Vault via ESO. ESO must have synced the
  secret to a k8s Secret object before pods start. Sync wave gives
  ESO a head start.
- **Source-of-truth services last**: GitLab + Forgejo (mutually
  exclusive, only one default-on) should come up after everything
  observability / storage / runtime is ready, so first-boot
  health-checks succeed.
- **GPU model servers manually**: `automated:` removed from the
  Application specs for Ollama / vLLM / deepseek-coder / qwen-coder.
  Sync wave applies if a maintainer enables automated sync per-host
  but the default is OFF — these need explicit `argocd app sync`.

## What about cycles

There are no cycles in this graph (verified by walking the edges
above). If one shows up — e.g., a workload claims to depend on
something that depends back — that's a design bug. Resolve by
either:

1. Splitting the workload into two (the part that doesn't depend
   on the back-edge lands earlier)
2. Adding a stub / mock for the back-edge that lets bootstrap
   complete, then promoting it to the real thing in a later wave

## How to add a new app

**Two edits, and the second is not optional.** The checker fails on an
Application that has a wave but no node in the declaration — that is exactly how
twelve apps went missing.

1. Annotate the `Application.yaml`:

   ```yaml
   metadata:
     annotations:
       argocd.argoproj.io/sync-wave: "0"
   ```

2. Add a node to
   [`full-ai-cluster/k8s/sync-wave-dependency-graph.yaml`](../k8s/sync-wave-dependency-graph.yaml):

   ```yaml
       - chart: my-app
         dependsOn: [longhorn]
         citations:
           longhorn: >-
             .../my-app/statefulset.yaml:NN renders `storageClassName: longhorn`.
   ```

   `dependsOn: []` is a real and common answer, meaning "no dependency edge is
   grounded in the tree". Every non-empty edge needs a citation — the checker
   refuses an uncited one, because a wave with no cited dependency is the defect
   this whole mechanism exists to remove.

3. Run `bun src/Core.TypeScript/cluster/derive-sync-waves.ts`. If it reports an
   ORDER disagreement, either the wave is wrong or the edge is not real. Fix
   whichever is actually wrong; do not silence it.

**Where to look for edges.** The classes that have grounded a real edge in this
tree so far: a `storageClassName: longhorn` PVC (→ `longhorn`), a CRD from
another app's chart (→ that app: `cilium` for `Cilium*` types,
`open-policy-agent` for `templates.gatekeeper.sh`, `arc-controller` for
`AutoscalingRunnerSet`, `cert-manager` for `cert-manager.io/v1`), an `endpoint:`
or `url:` naming another app's Service (→ that app), and the documented
bootstrap chain.

Rough wave bands, kept as orientation only — the declaration and the checker are
what decide:

- Pure standalone (no other-app deps) → wave 0
- Adds CRDs other apps use → wave -10 to -20
- Consumes Vault secrets via ESO → wave 10
- Consumes another in-cluster service that itself has wave 0 → wave 10
- Bootstrap-foundation adopting an already-running thing → wave -50 to -90
- Source-of-truth (GitLab/Forgejo class) → wave 30
- GPU model server → wave 50 + manual sync only

## What ArgoCD actually does with waves

Within a single Application's resources, sync-waves order CRDs /
namespaces / RBAC before workloads. ACROSS Applications under an
App-of-Apps, the SAME annotation on each child Application
orders the children. Lower wave reconciles first; higher waves
wait until the prior wave's resources are Healthy.

A wave that contains an unhealthy resource blocks all higher
waves until it recovers or the operator manually intervenes
(`argocd app sync <name>` with `--retry-limit 0`).

This is what makes dev/prod parity reliable: same Applications,
same waves, same reconciliation order on both substrates.

## hat-system internal waves (Gatekeeper)

Within the `hat-system` Application directory (not the App-of-Apps
wave `-10` on `Application.yaml` itself):

| Wave | Resources |
|------|-----------|
| 0 | society.zeta.io CRDs, namespace, seed hats, operator Deployment |
| 1 | ConstraintTemplates (`templates.gatekeeper.sh`) |
| 2 | Sync hook Job `wait-gatekeeper-hat-constraint-crds` — polls until Gatekeeper registers constraint CRDs |
| 3 | Constraints (`constraints.gatekeeper.sh`) |

ArgoCD sync-waves alone are insufficient on a cold cluster: Gatekeeper
registers constraint CRDs asynchronously after ConstraintTemplates land.
The wave-2 hook closes that gap so kind/CI included proofs can ship
`policies/**` without manual resync.
