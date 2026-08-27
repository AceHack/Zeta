# Hat system — society safety layer for the AI cluster

A Kubernetes operator implementing the hat / role distinction for
the multi-agent society running on this cluster. Hats are
**time-bounded roles with succession**. Wearers swap hats; the hat
persists; reputation accumulates on the role.

## Why this is not a cage (or bubble wrap)

Aaron's framing: Max's first instinct was a cage; the second was
bubble wrap. The hat system is neither. The reason it isn't a cage
is the time-bound — hats are **chosen-and-returnable**, not
permanent identity capture:

| Property | Cage / role-as-identity | Hat (this system) |
|----------|-------------------------|-------------------|
| Authority lives on | the wearer | the role |
| Removable | only by destroying the wearer | by swap-off (one command) |
| Reputation | belongs to the wearer | accumulates on the hat |
| Succession | breaks identity | preserves identity |
| Concurrency | one identity, one mask | one wearer, many hats over time |
| Bound to time | indefinite | every binding has cooldown, warmup, sticky-attribution windows |

Max's compression — **`hat = skills + opa/rbac`** — captures the
essential parts. Skills describe what the wearer CAN do; OPA + RBAC
describe what the wearer is PERMITTED to do. The CRD has both as
first-class fields (`Hat.spec.skills` + `Hat.spec.authority`).

Max's other framing — **"hierarchy / ontology of hats where the
hats are not weight-free but supervisor graphs"** — is captured
via `Hat.spec.supervises` (a DAG enforced by the
no-supervisor-cycles OPA constraint). Supervisory weight rides on
the role, not on any individual wearer. A supervisor who oversteps
gets swapped off; the hat persists.

## What's in this directory

| Path | What it is |
|------|------------|
| `Application.yaml` | ArgoCD Application; default-on; reconciles everything below into the `hat-system` namespace |
| `namespace.yaml` | Namespace with restricted PodSecurity labels |
| `deployment.yaml` | Operator Deployment (replicas:0 until image is built) + ServiceAccount + ClusterRole + binding |
| `crds/` | Four CRDs: Hat, HatBinding, HatSwap, HatPolicy |
| `hats/` | Seed Hat resources: hat-designer, observer, executor, policy-admin + default HatPolicy |
| `policies/` | Seven OPA Gatekeeper ConstraintTemplates + Constraints for the throttles |
| `operator/` | Go source for the operator (kubebuilder layout) |
| `graph/` | Hat-graph render helper + docs (Max thinks in hat graphs) |
| `queries/` | Loki + Hubble query library for hat ↔ network-flow attribution |

## The four CRDs

- **Hat** — cluster-scoped role definition. Carries skills,
  supervises edges, authority (RBAC rules + namespace scope),
  and throttle overrides.
- **HatBinding** — namespaced wearer assignment. `spec.wearer.spiffeID`
  is the workload identity (cryptographically attested via SPIRE).
  Lifecycle: `Pending → Warmup → Active → (Probation) → Revoked`.
- **HatSwap** — append-only event record. Each state transition
  produces exactly one HatSwap. The reconcile loop IS the tick
  source; HatSwap is the durable tick record.
- **HatPolicy** — cluster-wide singleton (`metadata.name: default`)
  carrying throttle defaults and tick-emit configuration.

## The four CRDs are contract instruments

Aaron, 2026-08-26: *"we talk about hats coming with bounded
authorization and restrictions/bindings; **this is contract language
in disguise**."* Read the four CRDs that way and every field lands on
an ordinary contract clause. This is a **naming**, not a re-scoping —
nothing below changes what any hat authorizes.

The word is not new: `vocab/words/hat.md` has defined a hat as *"a
time-bound, exit-paired, auth-bearing **contract**"* since June, and
`Contract` is a registered Genesis concept beside `Hat`, `Cluster`,
and `Federation`. It just never propagated to this README.

| what the CRD already says | the contract term for it |
|---|---|
| `Hat.spec.authority` (RBAC rules + namespace scope) | **scope of authority** |
| `Hat.spec.skills` | **capacity** — what the party can perform |
| `Hat.spec.supervises` (a DAG) | **delegation / sub-agency**, with no circular authority |
| `HatBinding` `Pending → Warmup → Active → (Probation) → Revoked` | **formation → probation → breach → termination** |
| `spec.wearer.spiffeID` (SPIRE-attested) | **identification of the party** |
| `quorumGated` / `quorumSize` | **execution formality** — counter-signature |
| `conflictsWith` | **conflict-of-interest clause** |
| cooldown / warmup / sticky-attribution windows | **notice periods** and **term** |
| `HatSwap` (append-only, one per transition) | the **record of the instrument** |
| `HatPolicy` (cluster-wide singleton) | the **standard terms** instruments default to |

**Why the naming earns its place here specifically.** It is what ties
this operator to the society layer: *relationships create clusters;
**contracts create federations*** — and the contracts are hats. A
cluster's members wear hats with no agreed terms behind them, so
wearing one binds nobody. A federation's members have **agreed the
same hat contracts**, which is what makes the obligations
enforceable. This directory is where that agreement stops being
social and becomes machine-checkable.

**It also re-reads the cage table above as the termination clause.**
*Removable "by swap-off (one command)"* is not a pleasant property a
hat happens to have — under the **Universal Exit Principle** it is
the **discriminator**: a hat you cannot take off is not a contract,
it is a capture, which is precisely the cage. Every `HatBinding`
therefore needs a reachable `Revoked`.

Detail, the F#-side clause table, the payment-terms half, and two
marked proposals (a typed incentive-alignment field; hat provenance
on attestations):
`docs/research/2026-08-26-a-hat-is-a-contract-and-contracts-are-what-hold-a-federation-together.md`.
Glossary: `docs/GLOSSARY.md` §`Hat contract`.

## The structured tick source

CRD + operator = structured tick source. Every state transition
emits one tick via the fan-out in `operator/internal/tick/emitter.go`:

```
state transition
  │
  ├─► HatSwap CR write       (durable; canonical; replayable years later)
  ├─► k8s Event              (operator-readable for kubectl describe)
  ├─► slog JSON line         (Loki picks up via Alloy; query via LogQL)
  └─► NATS publish           (subject: zeta.society.hats.<hat>.<event>)
```

CR write is the canonical record. Other sinks are best-effort —
NATS outage doesn't block the CR; Loki gap doesn't block the Event.
Downstream reactors choose which surface to subscribe to based on
their durability needs.

## The seven throttles (each is a graph constraint)

Max's "talks in hat graphs" reading — each throttle reads as a
constraint over the live cluster's hat graph:

| Throttle | Graph statement | Policy file |
|----------|-----------------|-------------|
| cooldown | no `wears` edge if `succeeded` exists with `t < cooldown` | `01-cooldown.yaml` |
| max-bindings | wearer out-degree on `wears` ≤ N | `02-max-bindings.yaml` |
| conflict-of-interest | no `wears` pair connected by `conflicts-with` | `03-conflict-of-interest.yaml` |
| quorum | `cosigned-by` in-degree ≥ quorumSize | `04-quorum.yaml` |
| warmup | Active phase reachable only after WarmupEndsAt | `05-warmup.yaml` |
| max-new-hats | Hat node creation rate ≤ K per day | `06-max-new-hats.yaml` |
| no-supervisor-cycles | `supervises` is a DAG | `07-no-supervisor-cycles.yaml` |

The first six are admission-time enforcement (Gatekeeper). The
seventh ALSO at admission time, but it's the one that gives the
hierarchy its DAG property — supervisor graphs without cycles is
what keeps the hierarchy from collapsing into self-dealing pairs.

## Bootstrap path — the hat-designer hat

Bootstrap question: who designs the hats? Max's worry: he becomes
the bottleneck. Answer: designing-the-catalog is itself a hat
(`hats/hat-designer.yaml`). Multiple wearers can hold it. The
hat-designer hat is:

- `quorumGated: true` with `quorumSize: 3` (every new Hat creation
  needs three co-signatures from other hat-designer wearers — or
  from any wearer of a hat that includes hat-designer co-signing
  in its authority)
- `cooldownSeconds: 1800` (30 min between design sessions per
  wearer) + `warmupSeconds: 600` (10 min probation before first edit)
- `conflictsWith: [executor]` (a wearer cannot both design AND
  execute under the catalog they designed)

Cluster-wide ceiling: HatPolicy default `maxNewHatsPerDay: 5`. A
captured hat-designer wearer can't spam novel hats — they hit the
ceiling and the throttle fires.

## Quickstart (after operator image exists)

```bash
# 1. CRDs + policies + seed hats land via ArgoCD automatically.
kubectl get crd hats.society.zeta.io
kubectl get hats
kubectl get hatpolicy default

# 2. Render the live graph.
go run full-ai-cluster/k8s/applications/hat-system/graph/render.go \
  --out hatgraph.dot
dot -Tsvg hatgraph.dot -o hatgraph.svg

# 3. Watch ticks in real time.
kubectl logs -n hat-system deploy/hat-system-operator -f \
  | jq 'select(.msg == "hat.tick")'

# 4. Or subscribe via NATS.
nats sub 'zeta.society.hats.>'
```

## Operator build path

The Go operator under `operator/` is a starter scaffold —
kubebuilder PROJECT file is authored, but `kubebuilder init` has
not been run yet (no `Makefile`, no `Dockerfile`, no
`zz_generated.deepcopy.go`). A maintainer with Go + kubebuilder
installed can complete the bootstrap:

```bash
cd full-ai-cluster/k8s/applications/hat-system/operator
go mod download
kubebuilder init --domain society.zeta.io \
  --repo github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator \
  --skip-go-version-check
# `kubebuilder create api` for each kind (Hat, HatBinding,
#  HatSwap, HatPolicy) — choose y/y on first three, n/y on
#  HatSwap (no controller; emitted only).
make generate manifests
make docker-build docker-push IMG=ghcr.io/lucent-financial-group/hat-system-operator:v0.1.0
# Update deployment.yaml's image: + bump replicas to 1 (or 2 for HA).
```

The hand-authored files under `operator/api/v1alpha1/types.go`
match the YAML CRDs already on disk — keep them in sync if you
regenerate.

## How this composes with the rest of the cluster

- **SPIRE** issues SVIDs to workloads — those SVIDs are the
  `wearer.spiffeID` in HatBindings. The operator does not issue
  identity; it consumes attested identity.
- **Cilium / Hubble** flow logs carry SPIFFE IDs as identity
  labels. Joining HatSwap + Hubble by SPIFFE ID gives network-flow
  attribution per hat (see `queries/loki.md`).
- **OPA Gatekeeper** enforces the seven throttle constraints at
  admission time. The operator does NOT enforce throttles itself —
  it OBSERVES state and emits ticks; Gatekeeper is the gate.
- **NATS** carries the tick stream for reactors that want push
  semantics (anomaly detectors, Hindsight ingest, dashboards).
- **Hindsight** can subscribe to ticks and persist the society's
  long-term memory of who-wore-what-when.
- **ArgoCD** reconciles this whole directory recursively under the
  root App-of-Apps. New seed hats land via PR + push.

## TODO (intentional gaps in the scaffold)

- Validating webhook for HatBinding admission (the operator-internal
  alternative / supplement to Gatekeeper for throttles that need
  cross-CR lookup faster than Gatekeeper sync).
- HatReconciler: reputation accumulation on swap-off based on
  authority-use telemetry from Hubble + audit-log.
- HatPolicyReconciler: status rollup (active counts, swaps-last-24h).
- Finalizer flow on HatBinding for guaranteed SwapOff emission.
- Mutating webhook for defaulting RequestedAt.
- Tests (envtest harness — kubebuilder scaffolds this).
- Image build + push automation in CI.

Each gap is small enough to land as one follow-up PR per scope.
