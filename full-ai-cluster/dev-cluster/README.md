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
bare-metal-only substrate, such as Longhorn-backed storage, stay visible
in the same manifest tree but are not claimed as healthy in dev/CI until
that substrate is installed or overlaid.

What differs between dev and prod:

- **Substrate** - k3d and kind run container-backed nodes; prod runs
  physical machines.
- **Node count** - k3d defaults to 1 server plus 2 agents, kind CI
  defaults to 1 control-plane, and prod supports 1+ control-plane nodes
  plus workers.
- **CNI** - k3d runs Cilium as a kube-proxy replacement, kind CI uses
  kindnet unless a CNI test opts in, and prod runs Cilium.
- **Storage** - dev/CI use local ephemeral storage. Prod uses
  Longhorn multi-disk storage.
- **GPU** - dev/CI have none by default. Prod can use NVIDIA, AMD, or
  Intel GPUs.
- **Identity** - SPIRE is present in the shared manifest tree, but the
  current values request Longhorn storage, so dev/CI health assertions
  exclude it until a storage overlay exists.
- **Secrets** - Vault is present in the shared manifest tree, but the
  current values request Longhorn storage, so dev/CI health assertions
  exclude it until a storage overlay exists.
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

The 081KSXN940008QG0R000SCP2H1 health harness also excludes Applications whose
`Application.yaml` requests Longhorn storage via `storageClass` or
`storageClassName` from dev/CI health assertions. That includes apps
such as Vault and SPIRE until a local Longhorn-compatible storage
overlay exists.

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
