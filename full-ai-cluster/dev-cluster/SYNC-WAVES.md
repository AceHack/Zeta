# ArgoCD sync waves — App-of-Apps dependency ordering

ArgoCD reconciles all Applications under the root App-of-Apps
in parallel by default. That breaks for apps with cross-app
dependencies (e.g., a workload needs Vault before it can pull
its secret, or needs the hat-system CRDs before its HatBindings
can be created).

Solution: per-app `argocd.argoproj.io/sync-wave` annotation on
each `Application.yaml`. Lower waves reconcile first.

## The dependency graph

```
Bootstrap (K3S manifests, BEFORE ArgoCD takes over):
  Cilium → cert-manager → Vault → SPIRE → Trust Manager → ESO → ArgoCD

ArgoCD App-of-Apps (after ArgoCD is up):

  Wave -90  argocd                    self-management
  Wave -80  cilium                    adopt CNI (already running from bootstrap)
  Wave -70  cert-manager              adopt (already running from bootstrap)
  Wave -60  vault                     adopt (already running from bootstrap)
  Wave -50  spire                     adopt (already running from bootstrap)
  Wave -45  trust-manager             adopt (already running from bootstrap)
  Wave -40  external-secrets          adopt; ESO consumes Vault + cert-manager
  Wave -30  sealed-secrets            secrets layer co-equal with ESO
  Wave -25  open-policy-agent         OPA Gatekeeper — must precede any app with constraints
  Wave -20  node-feature-discovery    labels nodes; other apps can targetAffinity off NFD labels
  Wave -15  longhorn                  storage class — must precede any PVC user
  Wave -10  hat-system                CRDs must exist before any HatBinding-creating workload
  Wave   0  kube-prometheus-stack     observability core (default wave)
  Wave   0  loki / mimir / tempo / alloy   observability data planes
  Wave   0  argo-rollouts / argo-workflows
  Wave   0  nats / redis / cockroachdb / weaviate     data planes
  Wave   0  dapr                      runtime
  Wave   0  oz                        OpenZiti overlay
  Wave  10  hindsight                 needs PostgreSQL (bundled) + Vault secret for LLM key
  Wave  10  orleans                   needs CockroachDB + NATS up
  Wave  10  temporal                  needs CockroachDB up
  Wave  30  gitlab / forgejo          source-of-truth services; come up last so all dependent
                                       observability + storage is ready
  Wave  50  ollama / vllm / deepseek-coder / qwen-coder   GPU model servers; manual-sync-only
                                       in default config — these waves apply when enabled
```

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

In your new `Application.yaml`:

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"   # pick wave per the table above
```

Picking the wave:

- Pure standalone (no other-app deps) → wave 0
- Adds CRDs other apps use → wave -10 to -20
- Consumes Vault secrets via ESO → wave 10
- Consumes another in-cluster service that itself has wave 0 → wave 10
- Bootstrap-foundation adopting an already-running thing → wave -50 to -90
- Source-of-truth (GitLab/Forgejo class) → wave 30
- GPU model server → wave 50 + manual sync only

If unsure, default to 0 and adjust if reconciliation gets stuck.

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
