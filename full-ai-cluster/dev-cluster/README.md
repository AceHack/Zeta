# Dev cluster — local k3d parity with prod

The bare-metal AI cluster (`nixos/hosts/*`) and the dev cluster
here run the **same workloads from the same git ref** via
ArgoCD. The substrate of the cluster is the same; only the
shape differs.

## Why this works

ArgoCD reads `full-ai-cluster/k8s/applications/` as an App-of-Apps,
recursively. The dev cluster runs ArgoCD configured against the
same path. Every workload reconciles into both clusters
identically — Cilium, NFD, hat-system, OPA Gatekeeper, Vault,
SPIRE, cert-manager, Trust Manager, External Secrets, ArgoCD
itself if you bootstrap-in-place.

What differs between dev and prod:

| | Dev (k3d) | Prod (NixOS bare-metal) |
|--|-----------|-------------------------|
| Substrate | Docker containers as "nodes" | Physical machines |
| Node count | 1 server + 2 agents | 1+ control-plane + N workers |
| CNI | Cilium (kube-proxy replacement) | Cilium (same) |
| Storage | local-path-provisioner | Longhorn (multi-disk) |
| GPU | none | NVIDIA / AMD / Intel |
| Identity | SPIRE (same chart) | SPIRE (same chart) |
| Secrets | Vault (in-cluster dev mode) | Vault (HA + Sealed Secrets) |
| Network MTU | Docker default | Real NIC MTU |
| Persistence | Lost on `./down.sh` | Across reboots |

Apps that don't make sense in dev are excluded by the root
App-of-Apps `exclude:` glob in `up.sh`:

- `longhorn/**` — no second NVMe to back it; local-path-provisioner
  handles PVCs in dev
- `ollama/**`, `vllm/**`, `deepseek-coder/**`, `qwen-coder/**` — no
  GPU. Remove from the exclude list if you have an Apple Silicon
  Mac + a model server that runs on MPS (vLLM nightly does).

## Bring it up

```bash
# Pre-requirements (one-time):
bash tools/setup/install.sh
# + Docker Desktop or Colima

cd full-ai-cluster/dev-cluster
./up.sh                       # main branch
./up.sh feat/my-pr-2026-05-25 # dev-test a PR before merging

# Watch reconciliation
kubectl -n argocd get applications -w

# Open the UI
# k3d-config.yaml already publishes the cluster's load-balancer on
# host port 8443 → 443. The LoadBalancer Service ArgoCD's chart
# requests gets picked up by k3d's bundled klipper-LB and surfaces
# through that mapping — no kubectl port-forward needed.
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d ; echo
open https://localhost:8443
```

## Tear down

```bash
./down.sh
```

Removes the cluster, the registry, and clears the kubectl context.
Idempotent — safe to re-run.

## Multiple dev clusters at once

Docker Desktop's multi-cluster support means you can run multiple
k3d clusters in parallel. Adjust `metadata.name` and the
`hostPort` for the registry + load-balancer ports in
`k3d-config.yaml`, then `up.sh` against a copy of the config.
Pattern: per-PR dev clusters for parallel dev-testing.

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

- **`zeta-install` on the bare-metal install path** — same
  workloads on both substrates means the same `Application.yaml`
  files end up reconciling on both. Dev-test a chart change
  here, then ship; prod ArgoCD picks it up automatically.
- **NFD + lstopo (PR #4951)** — runs identically in dev. NFD
  labels are still present; lstopo on dev nodes shows the
  k3d container's view of the underlying Mac topology.
- **disko cookie-cutter (PR #4950)** — bare-metal-only by
  design. Dev cluster bypasses disko (containers don't have
  block devices to partition).
- **hat-system operator (PR #4930)** — runs in dev exactly as
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
        server: '{{server}}'
        # ...
```

Same git ref, multiple destinations. The dev/prod parity stays
clean because the spec carries no environment-specific bits;
overlays handle that.
