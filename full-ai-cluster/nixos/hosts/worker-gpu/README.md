# worker-gpu

K3S worker template + NVIDIA GPU + container toolkit + K8s device
plugin + VFIO passthrough (optional).

## What it runs

- K3S agent joining `https://control-plane.zeta.local:6443`
- NVIDIA proprietary driver + `nvidia-container-toolkit` (so K3S
  pods can request `nvidia.com/gpu` resources)
- NVIDIA Kubernetes device plugin DaemonSet (advertises GPUs)
- Docker (for non-K8s container workloads on this host)
- Local-path storage class

## Optional: GPU passthrough for VM workloads

If this host hosts VMs that need a dedicated GPU (e.g. running
a Windows VM with passthrough alongside K8s workloads on the
remaining GPUs), enable VFIO in `configuration.nix`:

```nix
zeta.gpu-passthrough = {
  enable = true;
  pciIds = [ "10de:2204" "10de:1aef" ];   # find via `lspci -nn`
};
```

## Mixed-vendor hosts

If this worker has AMD or Intel GPUs alongside NVIDIA, edit the
`zeta.gpu-device-plugin.vendors` list:

```nix
zeta.gpu-device-plugin = {
  enable = true;
  vendors = [ "nvidia" "amd" "intel" ];
};
```

Each enabled vendor gets its own DaemonSet advertising the
appropriate resource name to K8s.

## Per-physical-worker scaling

This file is a **template**. For each additional GPU worker:

1. Copy `worker-gpu/` to `worker-gpu-NN/`
2. Update `networking.hostName` in the new copy
3. Drop the per-host `hardware-configuration.nix` from
   `nixos-generate-config`
4. Add `nixosConfigurations.worker-gpu-NN = ...` entry to
   `../../flake.nix`
5. Install: `nixos-install --flake /mnt/etc/zeta/full-ai-cluster#worker-gpu-NN`

## Install

See parent [`../../README.md`](../../README.md) bootstrap flow.
Important: write the K3S cluster token (from the control-plane)
to `/var/lib/rancher/k3s/agent/token` BEFORE running
`nixos-install`. K3S refuses to start without it.
