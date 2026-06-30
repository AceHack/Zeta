---
id: B-0758
priority: P3
status: open
title: USB-persistent OS — unRAID-style zero-internal-disk support + OS-on-USB-with-internal-disks-as-data-only
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0754
composes_with:
  - B-0755
  - B-0756
  - B-0757
tags: [cluster, installer, nixos, usb, unraid, storage]

---

## Problem

Aaron 2026-05-25 mid-B-0754-v1: *"0-n hdds and 0-n sdds would be
awesome if it could even usb boot when no hdss or sdds like
unraid"*.

Current B-0754 v1 greedy installer (post commit
`d3941aabb` on PR #5028) handles 0+ SSDs and 0+ HDDs gracefully
— EXCEPT the zero-internal-disks case, which bails with `no
internal disks found; cannot install`.

For:
- Diskless / minimal cluster nodes (edge devices, Raspberry-Pi-
  class hardware, lab boxes between disk transitions)
- unRAID-style preference where the OS *should* persist on USB
  and all internal disks stay raw / data-only
- Recovery / rescue use (boot a node off USB to inspect it without
  touching internal storage)

...we need USB-persistent OS support.

## Target

Two new install modes (in addition to the current install-to-disk
default):

| Mode | OS lives on | Internal disks used for |
|------|-------------|-------------------------|
| `disk` (current default) | First fast internal disk | Longhorn data (longhorn1..N) |
| `usb` | The USB stick itself | Longhorn data ONLY (if any present) |
| `usb-diskless` (auto-fallback) | USB stick | (no internal disks → no Longhorn data path) |

The unRAID parallel: OS on USB at all times; all internal storage
remains raw + dedicated to data.

## Acceptance

- [ ] `BOOT_TARGET` env var in zeta-install.sh: `disk` (default;
      current behavior) or `usb` (paint OS onto USB stick;
      internal disks become pure data)
- [ ] zeta-first-boot.sh: when no internal disks detected, auto-
      fall-back to `BOOT_TARGET=usb` mode rather than bail
- [ ] USB persistence design: NixOS supports `installation-cd-
      base.nix` + an overlay for persistent /etc and /home; OR
      install full NixOS to a second partition on the USB stick
      (requires partitioning the USB at flash time to leave room)
- [ ] zflash `--persistent-usb-os` flag at flash time: partitions
      the USB with EFI(1G) + nixos-root(8G) + persist(rest); the
      installer ISO boots from the EFI, the installed system
      lives on nixos-root, and zeta-first-boot persists state to
      persist partition
- [ ] Endurance + perf warnings: USB write-endurance is much
      lower than SSDs; USB 2.0/3.0 throughput is much lower than
      NVMe; warn operator clearly in the role prompt + in the
      install banner. Recommend industrial USB (Lexar, SanDisk
      Industrial) for unattended unRAID-style use; warn about
      consumer USB endurance
- [ ] Same disk-class enumeration logic from B-0754 v1 still
      runs — just classifies "no disks" as a valid install
      target rather than a bail condition
- [ ] PROVISIONING.md updated with the three modes + when to use
      each

## unRAID design notes

unRAID's actual model:
- OS = stateless RAM-resident image (loaded from USB at boot)
- USB = config persistence (configs, plugins, license; NOT
  workload data)
- Internal disks = parity + data array, managed by unRAID's
  custom Array filesystem
- Result: USB write-endurance not stressed (only config writes);
  internal disks dedicated to user data

For Zeta:
- OS = NixOS (declarative, immutable — natural fit)
- USB = NixOS installation + persistent state via tmpfs +
  overlay
- Internal disks = Longhorn (or future Ceph/Rook) data paths
- Difference: NixOS rebuilds vs unRAID's image-update model

NixOS specifically supports this via `boot.loader.systemd-boot`,
`fileSystems."/persist".device = "/dev/disk/by-label/persist"`,
and `environment.persistence."/persist" = { ... }` (impermanence
module).

## Composes with

- B-0754 — zero-typing first-boot (the role prompt could grow
  a 't' key for `BOOT_TARGET=usb` mode)
- B-0755 — role taxonomy expansion (a `worker-edge` role might
  default to USB-persistent OS for tiny edge devices)
- B-0756 — HA control-plane (USB-resident control-plane is
  unusual but theoretically supported)
- B-0757 — cluster auto-discovery (USB-resident nodes still
  participate in mDNS bootstrap-or-join)

## Hardware classes this enables

| Class | Internal disks | OS lives | Use case |
|-------|----------------|----------|----------|
| Standard cluster node | 1+ NVMe/SSD/HDD | First internal disk | Today's default |
| unRAID-style | 1+ HDDs | USB | Data hoarder; OS isolation |
| Diskless edge | 0 | USB | Tiny edge boxes; Pi-class hardware |
| Rescue / inspection | any | USB (read-only) | Boot a node without touching its disks |

## Endurance + perf trade-offs (warn-and-document)

- Consumer USB: 10K–30K write cycles per cell; OS writes
  (logs, /tmp on tmpfs, sysctl tunings) wear it out in months
  to years
- Industrial USB (Lexar Industrial, SanDisk Industrial,
  Apacer Industrial): 100K+ cycles; recommended for
  unRAID-style use
- USB 3.x throughput: 100–400 MB/s read, less for write;
  fine for OS but kills workload latency if user puts data
  on USB
- Mitigation: tmpfs aggressive use for /tmp + log forwarding
  to remote sink; only config writes hit USB persist partition

## Out of scope

- Network boot (PXE / iPXE) — separate B-future row; different
  architecture
- Live-USB-as-permanent-install (no persistence at all, pure
  ephemeral mode) — possible but unusual for cluster nodes
- USB hot-swap / mirror — out of scope; if USB dies, the node
  goes down; treat as rebuild-from-flash event

## Origin

Aaron 2026-05-25, mid-B-0754 greedy N-disk implementation,
extending the scope to also handle the zero-internal-disks edge
case + unRAID-style persistence pattern.
