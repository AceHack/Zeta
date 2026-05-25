# control-plane

K3S server + Cilium CNI bootstrap + ArgoCD reconciler. No GPU.

## What it runs

- K3S server with embedded etcd, flannel + kube-proxy disabled
  (Cilium takes over)
- Cilium CNI (Helm install via ArgoCD's first reconcile)
- ArgoCD itself (auto-applied from `k8s/bootstrap/` via
  `services.k3s.manifests` in `k3s-server.nix`)
- Local-path storage class for stateless workloads
- Docker (for any non-K8s container tooling)

## What it does NOT run

- No GPU workloads (those go on `worker-gpu` hosts)
- No big AI models locally (LLMs serve from worker-gpu via Ollama/vLLM)

## Install

See the parent [`../../README.md`](../../README.md) bootstrap flow.
This host's `<host>` name when installing is `control-plane`:

```bash
nixos-install --flake /mnt/etc/zeta/full-ai-cluster#control-plane
```

## Post-install verification

```bash
ssh zeta@control-plane.zeta.local
sudo kubectl get nodes
sudo kubectl -n kube-system get pods                    # cilium pods
sudo kubectl -n argocd get pods
sudo kubectl -n argocd get applications
sudo cilium status
sudo cilium hubble enable --ui
```

## Hardware config

`hardware-configuration.nix` ships as a placeholder. Replace at
install time per the parent README.
