# Dev cluster -- local Kubernetes/ArgoCD parity with prod

The bare-metal AI cluster (`nixos/hosts/*`) and the dev cluster
here run the **same workloads from the same git ref** via
ArgoCD. The substrate of the cluster is the same; only the
shape differs.

## Why this works

ArgoCD reads `full-ai-cluster/k8s/applications/` as an App-of-Apps,
recursively. The dev cluster runs ArgoCD configured against the
same path. The parity lane proves the shared App-of-Apps wiring and
the workloads whose substrate exists in dev/CI. Workloads that require
bare-metal-only substrate stay visible in the same manifest tree but are
not claimed as healthy in dev/CI until that substrate is installed or
aliased.

What differs between dev and prod:

- **Substrate** - k3d and kind run container-backed nodes; prod runs
  physical machines.
- **Node count** - k3d defaults to 1 server plus 2 agents, kind CI
  defaults to 1 control-plane, and prod supports 1+ control-plane nodes
  plus workers.
- **CNI** - k3d runs Cilium as a kube-proxy replacement, kind CI uses
  kindnet unless a CNI test opts in, and prod runs Cilium.
- **Storage** - dev/CI use local ephemeral storage behind
  `rancher.io/local-path`. Prod uses Longhorn multi-disk storage. The
  two are reconciled by NAME, not by changing the manifests: bring-up
  applies alias StorageClasses called `zeta-local-path` AND `longhorn`
  (`manifests/*.yaml`), both pointing at the local-path provisioner, so
  a chart asking for `storageClass: longhorn` binds unmodified.
- **GPU** - dev/CI have none by default. Prod can use NVIDIA, AMD, or
  Intel GPUs.
- **Identity** - SPIRE is present in the shared manifest tree, but its
  Vault upstream-CA wiring is not ready in dev/CI, so health assertions
  exclude it. (This is no longer a storage reason.)
- **Secrets** - Vault is present in the shared manifest tree and now
  syncs in dev/CI, but it comes up SEALED by design and readiness needs
  the gated operator-init ceremony CI must never run, so health
  assertions exclude it.
- **Network MTU** - dev/CI use the runtime default. Prod uses the real
  NIC MTU.
- **Persistence** - dev/CI data is removed by `k3d-down` or
  `kind-down`. Prod data survives reboots.

Apps that don't make sense in dev are excluded by the root
App-of-Apps `exclude:` glob in `apply-root-app.ts`:

- `longhorn/**` - no second NVMe to back it; local-path-provisioner
  handles PVCs in dev
- `ollama/**`, `vllm/**`, `deepseek-coder/**`, `qwen-coder/**` - no
  GPU. Remove from the exclude list if you have an Apple Silicon
  Mac + a model server that runs on MPS (vLLM nightly does).

### The `longhorn` alias, and why the exclusion is conditional rather than gone

The 081KSXN940008QG0R000SCP2H1 health harness used to exclude EVERY
Application whose YAML tree mentioned `storageClass: longhorn`. That rule
was circular: the apps were excluded because Longhorn was excluded, and
Longhorn was excluded because a kind node has no second disk. It cost eleven
Applications' worth of assertion — most of the stateful core — and the
included proof covered 19 of 45.

`manifests/longhorn.yaml` cuts the circle at the cheapest possible point.
A StorageClass is a NAME bound to a provisioner, and the workloads only
ever name it, so dev binds `longhorn` to `rancher.io/local-path` and the
same unmodified manifests bind on a kind node. Nothing production
requests changes; that file lives under `dev-cluster/`, which ArgoCD
never reads, and on bare metal the Longhorn chart creates the real class
over `driver.longhorn.io`.

The exclusion is **conditional, not deleted** (081M0JXF6MS087G0R001HC34TM),
because an unbindable PVC does not fail — it sits `Pending` until the
harness times out, and a timeout prints no verdict at all. So:

- If `manifests/longhorn.yaml` is absent or does not declare a
  StorageClass named `longhorn`, the old blanket exclusion applies in
  full. `devLonghornStorageClassAliasDeclared()` fails closed.
- `ReadWriteMany` claims stay excluded even with the alias present:
  local-path is node-local and RWO-only, so an RWX claim never binds.
  That is read off the access mode, not off a hand-kept list.
- Before an included-scope run waits on anything, it checks the class is
  really in the cluster and fails in seconds if not, rather than
  discovering it at the 2400s cap.

### What it bought, measured

Run `32519516070` is the first in which the eleven were asserted at all.
**Six reach Synced+Healthy and are asserted from now on**: `headscale`,
`mimir`, `nats`, `oz` (openziti-controller), `redis`, `tempo`. The proof
went from **19 of 45 to 25 of 45**.

> `oz` left that set for a few hours on 2026-08-22 and came back, which is
> worth recording rather than smoothing over. It had been Healthy in run
> `32519516070` only because its `targetRevision` named a version no registry
> serves, so ArgoCD had never rendered it; #13471 corrected the pin, the app
> synced for the first time, and two real blockers appeared — a trust-manager
> `Bundle` whose source Secret lived in a namespace trust-manager was not
> pointed at, and a missing admin Secret with the same shape as Grafana's.
> Both are fixed at their source (trust namespace `openziti`;
> `DEV_ZITI_ADMIN_SECRET` minted at bring-up), so the row above is true again —
> for a different reason than it was the first time.

The alias worked for the other five as well, in the sense that matters:
their PVCs **bound** and their pods run. Each then failed for a defect
that has nothing to do with storage — and each of those defects was
**invisible before this change**, because the storage rule excluded the
Application carrying it:

| Application | observed | storage? |
| --- | --- | --- |
| `cockroachdb` | 3/3 pods Running on bound PVCs, readiness 503 for 38m — a 3-replica cluster nobody ran `cockroach init` on | no |
| `hindsight` | `hindsight-postgresql-0` FailedScheduling, `Insufficient cpu` on the 1-node runner; api + control-plane CrashLoop waiting on it | no — capacity |
| `kube-prometheus-stack` | prometheus + alertmanager bound and Running 2/2; grafana `CreateContainerConfigError`, secret `grafana-admin-credentials` not found | no — missing secret |
| `weaviate` | `weaviate-0` 1/1 Running on a bound 100Gi PVC; Application re-syncs every ~3m and never converges | no — sync convergence |
| `arc-runner-set` | `ReadWriteMany` 100Gi claim local-path cannot serve, plus a GitHub App credential CI has no secret for | partly — RWX |

Those five are deferred with the measured evidence in
`APPLIED_BUT_UNASSERTED_REASONS`, alongside the pre-existing
`forgejo`, `spire` (Vault upstream CA wiring) and `vault` (sealed by
design). A deferral there is not a waiver: `auditAppliedButUnasserted`
goes red the moment one goes stale.

## Bring it up

CLI entrypoints live under `src/Core.TypeScript/cluster/dev-cluster/` and orchestrate
through vendor-neutral ports in `src/Core.TypeScript/cluster/ports.ts` (container host,
local cluster driver, control plane, package driver, app catalog). Adapters under
`cluster/adapters/` are the only layer that names kind/k3d/kubectl/helm today.

```bash
# Pre-requirements (one-time):
bash tools/setup/install.sh
# + Docker Desktop, Colima, or Podman for the container runtime
#
# install.sh/mise installs the cluster tools pinned in .mise.toml:
# k3d, kind, kubectl, and helm.

bun src/Core.TypeScript/cluster/dev-cluster/k3d-up.ts
bun src/Core.TypeScript/cluster/dev-cluster/k3d-up.ts feat/my-pr-2026-05-25
bun src/Core.TypeScript/cluster/dev-cluster/k3d-up.ts --config full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml --git-ref feat/my-pr-2026-05-25
                              # single-node CI-sized profile

# Watch reconciliation
kubectl -n argocd get applications -w

# Open the UI
# k3d-config.yaml already publishes the cluster's load-balancer on
# host port 8443 -> 443. The LoadBalancer Service ArgoCD's chart
# requests gets picked up by k3d's bundled klipper-LB and surfaces
# through that mapping -- no kubectl port-forward needed.
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d ; echo
open https://localhost:8443
```

## Tear down

```bash
bun src/Core.TypeScript/cluster/dev-cluster/k3d-down.ts
bun src/Core.TypeScript/cluster/dev-cluster/k3d-down.ts --config full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml
bun src/Core.TypeScript/cluster/dev-cluster/kind-down.ts --cluster-name zeta-ci
ZETA_CONTAINER_RUNTIME=podman bun src/Core.TypeScript/cluster/dev-cluster/kind-down.ts --cluster-name zeta-ci-podman
```

Removes the cluster, any matching registry, and clears the kubectl context.
Idempotent -- safe to re-run.

## Multiple dev clusters at once

Docker Desktop's multi-cluster support means you can run multiple
k3d clusters in parallel. Adjust `metadata.name` and the
`hostPort` for the registry + load-balancer ports in
`k3d-config.yaml`, then `k3d-up.ts` against a copy of the config.
Pattern: per-PR dev clusters for parallel dev-testing.

## Automated health harness

081KSXN940008QG0R000SCP2H1 wires a TypeScript-first harness around this same substrate:

```bash
bun src/Core.TypeScript/cluster/argocd-health-test.ts --dry-run
bun src/Core.TypeScript/cluster/argocd-health-test.ts \
  --run \
  --provider kind \
  --scope smoke \
  --runtime docker \
  --config full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml \
  --cluster-name zeta-ci \
  --git-ref main

ZETA_CONTAINER_RUNTIME=podman bun src/Core.TypeScript/cluster/argocd-health-test.ts \
  --run \
  --provider kind \
  --scope smoke \
  --config full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml \
  --cluster-name zeta-ci-podman \
  --git-ref main

bun src/Core.TypeScript/cluster/argocd-health-test.ts \
  --run \
  --provider k3d \
  --scope full \
  --runtime docker \
  --config full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml \
  --git-ref main
```

The harness names missing dependencies (`docker` or `podman`, provider CLI,
`kubectl`, and `helm`), waits for ArgoCD readiness, and asserts expected Application
sync/health, and keeps this Kubernetes/ArgoCD proof separate from the USB/ISO
zflash retention lane.

**Scopes:**

| Scope | Proof |
|-------|-------|
| `smoke` | Root + argocd + cert-manager healthy; ≥20 child Applications exist |
| `included` | Every non-excluded dev Application **Synced + Healthy** (17 charts today) |
| `full` | Same as `included` on k3d (Cilium-parity lane) |

```bash
bun src/Core.TypeScript/cluster/argocd-health-test.ts \
  --run \
  --provider kind \
  --scope included \
  --runtime docker \
  --config full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml \
  --cluster-name zeta-ci-included \
  --git-ref main \
  --timeout-sec 2400
```

`ZETA_CONTAINER_RUNTIME` is the repo-wide OCI runtime switch used by the
effectful work substrate. The older `CONTAINER_RUNTIME` spelling is not
accepted; stale callers fail fast instead of silently selecting the wrong
runtime. `--runtime` remains available for one-off explicit harness runs.

The current conservative CI path is kind-on-Docker smoke. k3d remains the
closer Cilium-parity lane. The k3d configs pin `rancher/k3s:v1.36.1-k3s1`,
matching the repo's pinned `kubectl 1.36.1`; a k3d control-plane failure before
kubeconfig exists is a substrate/runtime failure, not an ArgoCD chart failure.
The single-node k3d CI profile also uses embedded etcd and trims impossible
single-node Cilium targets (`operator.replicas=1`, no Hubble relay/UI). Podman
is supported through kind; give the Podman VM enough memory before asking it to
reconcile the full ArgoCD graph.

Smoke is only the first rung. The default ISO/USB install target is a full
Kubernetes cluster with the complete ArgoCD-managed stack. Prove the full graph
here first, including chart dependencies, sync waves, and parameter flow; then
promote that same proof into the installer acceptance lane.

## Pushing dev images

The k3d cluster comes with a local Docker registry at
`localhost:5000` (in-cluster: `k3d-zeta-dev-registry:5000`).
Auto-trusted by K3S. Workflow for a dev iteration of any in-repo
image:

```bash
docker build -t k3d-zeta-dev-registry:5000/my-app:dev .
docker push k3d-zeta-dev-registry:5000/my-app:dev

# Reference in your Application:
image: k3d-zeta-dev-registry:5000/my-app:dev
```

## What this composes with

- **`zeta-install` on the bare-metal install path** - same
  workloads on both substrates means the same `Application.yaml`
  files end up reconciling on both. Dev-test a chart change
  here, then ship; prod ArgoCD picks it up automatically.
- **NFD + lstopo (PR #4951)** - runs identically in dev. NFD
  labels are still present; lstopo on dev nodes shows the
  k3d container's view of the underlying Mac topology.
- **disko cookie-cutter (PR #4950)** - bare-metal-only by
  design. Dev cluster bypasses disko (containers don't have
  block devices to partition).
- **hat-system operator (PR #4930)** - runs in dev exactly as
  in prod. Use the dev cluster to dev-test hat / hat-binding
  CRDs and OPA throttle constraints before they hit prod.

## Multi-cluster ArgoCD pattern (future)

When the bare-metal cluster comes up, register it as a second
destination on the same ArgoCD (or run ArgoCD on the bare-metal
cluster and have dev's ArgoCD federate). The directory layout
already supports it via ApplicationSets:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
spec:
  generators:
    - clusters: {}
  template:
    spec:
      source:
        path: full-ai-cluster/k8s/applications
      destination:
        server: "{{server}}"
        # ...
```

Same git ref, multiple destinations. The dev/prod parity stays
clean because the spec carries no environment-specific bits;
overlays handle that.
