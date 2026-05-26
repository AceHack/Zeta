# Cluster hardware inventory

Two composing pieces give the cluster precise, queryable hardware
inventory:

| Component | Where it runs | Surface |
|-----------|---------------|---------|
| Node Feature Discovery (NFD) | every node, DaemonSet | `kubectl get nodes --show-labels` |
| `hwloc` / `lstopo` | every node, baked into `common.nix` | XML / SVG diagrams |
| `capture.ts` | maintainer laptop, on demand | `docs/cluster-hardware/<node>/` |

## What you get from NFD (zero effort, automatic)

NFD's worker DaemonSet labels every node with detailed hardware
features. Query examples:

```bash
# Every NFD label on a node
kubectl get node worker-gpu-01 --show-labels \
  | tr , '\n' | grep feature.node.kubernetes.io

# Find nodes with NVIDIA PCI vendor present
kubectl get nodes -l feature.node.kubernetes.io/pci-10de.present=true

# Find nodes with AVX-512
kubectl get nodes -l feature.node.kubernetes.io/cpu-cpuid.AVX512F=true

# Find nodes with non-rotational storage (SSD/NVMe)
kubectl get nodes -l feature.node.kubernetes.io/storage-nonrotationaldisk=true
```

Then use these in workload nodeAffinity instead of hand-maintaining
labels per host.

## What you get from lstopo (visual + diffable)

`lstopo` ships in `common.nix`, so every node has it. From any node:

```bash
lstopo                              # interactive curses view
lstopo --of svg > /tmp/topo.svg     # diagram
lstopo --of xml > /tmp/topo.xml     # canonical machine-readable
```

The XML is byte-stable for unchanged hardware — perfect for `git diff`
to catch silent hardware changes (BIOS updates, GPU driver changes,
disk replacements).

## Capture inventory across all nodes

Run from the maintainer machine when you want a point-in-time
snapshot of every node:

```bash
bun full-ai-cluster/tools/cluster-inventory/capture.ts
# or specific nodes:
bun full-ai-cluster/tools/cluster-inventory/capture.ts worker-gpu-01 worker-gpu-02
```

Produces `full-ai-cluster/docs/cluster-hardware/<node>/`:

- `nfd-labels.txt` — every NFD label on the node
- `topology.xml` — `lstopo` XML output (the diff-stable canonical form)
- `topology.svg` — same data rendered as a diagram (commit alongside)
- `summary.md` — short human-readable header (CPU / RAM / PCI / network)

Commit the directory to track hardware drift over time. Re-running
the capture and committing the diff makes silent hardware changes
visible in PR review.

## How this composes with the rest of the cluster

- **Hat system** can constrain hats by hardware: `hat.spec.authority`
  could reference NFD labels via OPA constraints
  (`feature.node.kubernetes.io/pci-10de.present` → "this hat needs a
   GPU node")
- **Longhorn** already uses our `zeta.io/longhorn-disks=N` label; NFD
  adds the disk-type and capacity dimensions
- **Disko shape** picks disk by `/dev/disk/by-id`; cluster-inventory
  catches if a board's PCIe re-enumeration changes those mappings
- **GPU operator** (when added) extends NFD's PCI labels with the
  full GPU model + VRAM + CUDA driver + MIG capability set

## Cross-platform rescue substrate (Paragon FS drivers)

The maintainer's workstation fleet has Paragon's filesystem
drivers installed end-to-end:

| Host OS | Paragon driver | Reads + writes |
|---------|----------------|----------------|
| macOS | extFS for Mac + NTFS for Mac | ext2/3/4, NTFS |
| Windows | ExtFS for Windows | ext2/3/4, btrfs (selected) |
| Linux | (Paragon for Linux + native ntfs3) | NTFS |

Net effect: any disk pulled from any cluster node mounts read+write
on any maintainer machine, regardless of which OS the disk came
from. No "wrong-host-OS, can't access" bottleneck — rescue flows
in every direction.

Use cases that change because of this:

- **Failed node, healthy disk** — pull NVMe, mount on Mac, copy
  off `/var/lib/longhorn-disk*` Longhorn replica data, ship to a
  replacement node directly into the same mount point. Faster
  than waiting for Longhorn cross-node re-replication on slow
  networks.
- **Forensic inspection** — mount the OS partition, grep
  `/var/log` and `/etc/nixos/` without needing the node to be
  bootable.
- **Pre-stage material** — drop files onto the data partition
  before first boot of a new box. Rare in normal operation
  (External Secrets Operator handles secrets from Vault), but
  the option exists for special cases.

Caveats:

- Paragon's driver writes through; don't mount a Longhorn replica
  read-write while the source node is still alive and serving the
  volume — split-brain risk. Mount read-only unless the source
  node is confirmed offline.
- The OS partition has `nix.settings.auto-optimise-store = true`
  → many reflinked / hardlinked files in `/nix/store`. Paragon
  honors hard links; use `rsync -aH` (not just `-a`) when copying.

## Cadence

No fixed cadence required — the artifacts are stable. Recommended:

- Capture once after initial cluster bootstrap
- Re-capture after any hardware change (drive replaced, GPU added,
  RAM upgrade)
- Re-capture quarterly to catch silent BIOS / firmware drift
