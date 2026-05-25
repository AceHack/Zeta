# Provisioning a new node — cookie-cutter workflow

End-to-end: physical box arrives → boots into running cluster
member with replicated Longhorn capacity. Six values to change
per box, no hand-partitioning, no shell scripts.

## What you need

- A NixOS installer USB built from this repo (`nix build .#installer-iso`)
- The new box wired to the cluster network with internet access
- The maintainer's public SSH key
- A few minutes to read off two disk serial numbers

## Step 1: copy the template

```bash
HOST=worker-gpu-03    # pick the next free number
cp -r full-ai-cluster/nixos/hosts/worker-template \
      full-ai-cluster/nixos/hosts/$HOST
```

## Step 2: change the six placeholder values

Open `full-ai-cluster/nixos/hosts/$HOST/default.nix` and edit
each of the six clearly-marked PLACEHOLDER blocks:

| What | Where to get it |
|------|-----------------|
| `networking.hostName` | the name you chose above (`worker-gpu-03`) |
| `networking.hostId` | `head -c4 /dev/urandom \| od -A n -t x4 \| tr -d ' '` |
| `zeta.disko.nvme0` | On the live system: `ls -l /dev/disk/by-id/ \| grep nvme \| awk '{print $9, $11}'` — pick the disk you want to BE the boot disk (gets OS + first Longhorn data path) |
| `zeta.disko.nvme1` | Same listing, the other NVMe (becomes pure Longhorn data) |
| Network config | Static IP block if you don't use DHCP |
| `users.users.zeta.openssh.authorizedKeys` | Maintainer key |

## Step 3: wire into the flake

Open `full-ai-cluster/flake.nix`, add an entry mirroring
`worker-template`:

```nix
"worker-gpu-03" = mkSystem {
  modules = [
    ./nixos/hosts/worker-gpu-03/default.nix
  ];
};
```

Commit + push to main so the install reads from a real ref.

## Step 4: boot the box on the USB

UEFI boot order → USB first. Network up via `nmtui` if not DHCP.

```bash
# Clone Zeta to the live system's writable scratch
sudo git clone https://github.com/Lucent-Financial-Group/Zeta /mnt/etc/zeta
cd /mnt/etc/zeta/full-ai-cluster
```

## Step 5: disko + nixos-install (the actual cookie-cutter install)

```bash
# Step 5a — disko wipes + partitions + formats + mounts both disks
sudo disko --mode disko --flake .#worker-gpu-03

# Step 5b — install NixOS onto the mounted layout
sudo nixos-install --flake .#worker-gpu-03 --no-root-password

# Step 5c — reboot. Box joins cluster on first boot.
sudo reboot
```

That's it. Subsequent boxes: repeat steps 1-5 with new placeholder
values. Each provision is ~10 minutes wall-clock, ~6 lines of
human edits, zero hand-partitioning.

## What happens after first boot

1. systemd-boot → kernel → NixOS userland (~30s)
2. K3S agent service starts → contacts `control-plane.zeta.local:6443`
3. Cluster admits the node → kubelet reports both `/var/lib/longhorn-disk1`
   and `/var/lib/longhorn-disk2` as filesystem entries
4. Longhorn DaemonSet pod schedules → reads `/etc/longhorn/node-disks.yaml`
   → patches the Longhorn Node CR to add both data paths
5. Longhorn rebalancer notices the new capacity → starts placing
   replicas of existing volumes onto this node
6. ArgoCD reconciles any node-affinity workloads that target this
   node's labels

Check it landed:

```bash
kubectl get nodes -o wide
kubectl -n longhorn-system get nodes.longhorn.io worker-gpu-03 -o yaml | grep -A20 disks:
```

## Disk failure recovery

NVMe dies → Longhorn marks the data path Unavailable → the cluster's
other replicas (default replica count 3 means 2 healthy copies
remain) keep serving the volumes → no app-visible interruption.

Replace the dead drive, then either:

- **Hot path** (drive replaced with identical model + position):
  reboot, disko recreates the partition table on the fresh drive,
  Longhorn re-registers the data path, replicas rebuild from peers.
- **Slow path** (drive serial changed): update the `zeta.disko.nvme0`
  or `nvme1` by-id symlink in `nixos/hosts/<host>/default.nix`,
  `nixos-rebuild switch --flake .#<host> --target-host <host>` from
  any admin machine, then rebuild as above.

OS itself: the `/` partition lives on `nvme0` only, so a `nvme1`
failure leaves the node fully bootable + Longhorn capacity
degrades by half until repair. An `nvme0` failure takes the OS
down — reinstall via Step 5 onto the replacement disk; Longhorn
data on `nvme1` is re-imported when the rebuilt node rejoins.

## Multi-shape support

`disko-shapes/2nvme.nix` is the shape for the current hardware.
Adding a new hardware class (e.g. 4 NVMes, or NVMe + SATA SSD mix)
means:

1. Author `disko-shapes/<new-shape>.nix` matching the
   `zeta.disko` options pattern
2. Author a new host template under `hosts/<new-class>-template/`
   that imports it
3. Cookie-cutter from THAT template for boxes of the new class

The Longhorn module (`modules/longhorn-disks.nix`) is shape-
agnostic — it takes a list of mount paths and wires them, no
matter how many disks contributed those mounts.
