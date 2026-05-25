# control-plane

Zeta cluster control-plane node — runs K3S server + embedded etcd +
auto-bootstraps ArgoCD on first boot.

## Install

```bash
# From the live USB installer (built from this same flake):
git clone https://github.com/Lucent-Financial-Group/Zeta /mnt/etc/zeta

# Partition + mount /mnt as desired, then:
nixos-generate-config --root /mnt
cp /mnt/etc/nixos/hardware-configuration.nix \
   /mnt/etc/zeta/infra/nixos/hosts/control-plane/hardware-configuration.nix

# Install:
nixos-install --flake /mnt/etc/zeta#control-plane

# Reboot. K3S starts, applies bootstrap manifests, ArgoCD installs,
# root-application reconciles every other workload from this repo.
```

## Post-install verification

```bash
ssh zeta@control-plane
sudo kubectl get nodes
sudo kubectl -n argocd get pods
sudo kubectl -n argocd get applications
```

## What it runs

- K3S server with embedded etcd (`clusterInit = true`)
- ArgoCD (auto-applied on first boot via `services.k3s.manifests`)
- Root Application of Applications (reconciles `infra/k8s/applications/`)

## What it does NOT run

No AI workloads. Heavy compute lives on `worker-gpu-*` nodes. The
control-plane is intentionally small so a single-node failure doesn't
take down both the cluster API and the work.

## Multi-control-plane HA (future)

The current config uses `clusterInit = true` on a single server. To
add additional control-plane nodes for HA:

1. Drop `clusterInit = true` on the second + third nodes.
2. Set `serverAddr = "https://control-plane.zeta.local:6443"` on them.
3. Share the K3S token across all three (sops-nix or agenix).

## Hardware config

The `hardware-configuration.nix` in this directory ships as a
minimal placeholder (DHCP + ext4 by-label root + EFI boot) so
the flake evaluates in CI before the host is provisioned.

On real install, replace it with generator output from the
target machine:

```bash
nixos-generate-config --root /mnt
cp /mnt/etc/nixos/hardware-configuration.nix \
   /mnt/etc/zeta/infra/nixos/hosts/control-plane/hardware-configuration.nix
```

Then commit the real hardware-configuration.nix so future rebuilds
of this host reproduce the same boot environment.
