# usb-nixos-installer

**Scope: ONLY the USB bootstrap portion.**

This directory contains exactly the four things needed to produce a
bootable NixOS USB installer that can install the target operating
system on a new machine over USB or Ethernet:

1. **NixOS declarative configuration** — `nixos/installer/configuration.nix`
2. **NixFlakes for packages** — the flake is **one level up**, at
   `full-ai-cluster/flake.nix`. This directory deliberately has **no
   `flake.nix` of its own** (see "One flake" below).
3. **Git for version text storage** — every file here lives in git;
   `../flake.nix` references inputs by Git branch and `../flake.lock`
   pins them to exact revisions for fully-reproducible builds.
4. **The OS Flake on a USB stick** — `nix build .#installer-iso` **run from
   `full-ai-cluster/`** produces a bootable ISO image you `dd` to a USB
   stick. The same ISO supports Ethernet install (boot the target on the
   stick, then `nixos-install --flake <git-url>#<host>` over the network).

## One flake — this directory has no `flake.nix`

Until 081KZKS9A6B08QG0R0008EG72M this directory carried a *second* flake that
built `nixosConfigurations.installer` from the very same
`nixos/installer/configuration.nix` — but **without** the
`../nixos/overlays/mise-pin.nix` overlay that `full-ai-cluster/flake.nix`
applies to every configuration it builds. Two flakes claimed to describe one
artifact and produced different ISOs: this one shipped nixpkgs' `mise`
(2025.11.7 at the locked rev), which is below `.mise.toml`'s
`min_version = 2026.6.12` and so fails the version check in
`tools/setup/linux.sh` on first boot. The duplicate is gone; there is now
exactly one definition of the installer ISO, and it is the one CI builds.

A hygiene test enforces this — `src/Core.TypeScript/hygiene/mise-pin-parity.test.ts`
fails if any flake in the repo builds the installer configuration without the
overlay, or if the four mise-pin declaration sites drift apart.

**This directory is intentionally minimal.** It does NOT contain
K3S, ArgoCD, Orleans, GitLab, observability, GPU runtime, or any
cluster workload. Those live in the `full-ai-cluster/` directory
at the repo root.

For the full end-to-end AI cluster (including this USB bootstrap
as its starting snippet), see
<https://github.com/Lucent-Financial-Group/Zeta/tree/main/full-ai-cluster>.

## Build the USB stick

From any machine with Nix installed:

```bash
cd full-ai-cluster          # NOT usb-nixos-installer — the flake lives here
nix build .#installer-iso
# Output: result/iso/zeta-installer-*.iso (~1.5-2 GB)
```

## Write the ISO to a USB stick

### macOS

```bash
diskutil list                      # find the USB device (e.g. /dev/disk4)
diskutil unmountDisk /dev/disk4    # replace 4 with your USB device number
sudo dd if=result/iso/zeta-installer-*.iso of=/dev/rdisk4 bs=4m status=progress
diskutil eject /dev/disk4
```

### Linux

```bash
lsblk                              # find the USB device (e.g. /dev/sdb)
sudo dd if=result/iso/zeta-installer-*.iso of=/dev/sdb bs=4M status=progress conv=fsync
sync
```

## Install on a target machine

1. Boot the target on the USB stick.
2. Log in at the console as `root` (no password — upstream NixOS
   installer default; console-only).
3. Bring up the network with `nmtui` (interactive) or
   `nmcli device wifi connect <SSID> password <PSK>`.
4. Identify the target disk with `lsblk`.
5. Partition + mount as desired (parted/gptfdisk/cryptsetup/zfs
   are all on the stick).
6. Generate per-machine hardware config:
   `nixos-generate-config --root /mnt`
7. Install:
   `nixos-install --flake <git-url>#<host>` where `<host>` is one
   of the names declared in `flake.nix` `nixosConfigurations`.
   (This minimal installer only declares `installer` itself —
   target-machine hosts live in `../full-ai-cluster/flake.nix`.)
8. Reboot.

## Re-installing on a machine that already has Zeta on it

`zeta-install.sh` recognises its own prior installs. Before anything
destructive it probes each in-scope disk **read-only** and, if it finds one,
enters **repair mode**: it mounts the `nixos` partition `-o ro,noload` (a plain
`-o ro` would replay the ext4 journal, which is a *write* to a disk you have not
yet consented to touch), reads `/etc/zeta/`, and re-uses the identity it finds —
hostname, segment addressing, and the node's ZetaId.

Two files carry that identity, and they are siblings with different jobs:

| file | what it is |
|---|---|
| `/etc/zeta/cluster-node-id` | the **hostname** — what the network calls this machine. Read by `injected-hostname.nix` at flake-evaluation time; the roster is keyed by it. |
| `/etc/zeta/node-zetaid` | the node's **128-bit ZetaId** — what the substrate calls it. `Category.InventoryAsset`, the same scheme `inventory/new-item.ts` mints for the asset register. |

A repair **recovers** both. It never re-mints: a node that came back from a
repair with a new identity would have forgotten itself, and the roster would
gain a second registration for a NIC it already knows (HWR-2).

Nodes installed before the ZetaId existed have no `node-zetaid` file. That is
not an error — the repair mints one and says so (`minted-on-repair-legacy`), so
the log never claims a recovery that did not happen.

### Forcing a reformat (ignoring the install that is already there)

Sometimes you want the opposite: wipe it, forget it, come back as a new
machine. That is the **most destructive thing this installer can do**, so it is
the most strongly bounded — three independent factors, and it is refused
strictly *earlier* than an ordinary install is:

```bash
# 1. the exact literal REFORMAT -- `1`, `true`, `yes` do nothing
# 2. the node id the installer just recovered off THIS disk
#    (or `unreadable`, and only if nothing readable was found)
# 3. type REFORMAT at the prompt (skipped only on the declared
#    zero-typing path, ZETA_AUTO_CONFIRM=WIPE)
ZETA_FORCE_REFORMAT=REFORMAT \
ZETA_FORCE_REFORMAT_NODE_ID=node-a1b2c3 \
  zeta-install <host>
```

Factor 2 is what a stale environment variable cannot satisfy — it names a
*different* machine — and it makes the override **self-disarming**: once the
reformat succeeds the node has a new identity, so the same environment on the
next boot no longer matches and is refused.

The override goes **through** the R9 circuit breaker, not around it. The same
`zeta_pf_breaker` runs a second time with a tighter bound
(`ZETA_MAX_REFORMAT_ATTEMPTS`, default **1**, against
`ZETA_MAX_DESTRUCTIVE_ATTEMPTS`'s 3), and a breaker that is `open` (bound
already spent) **or** `blind` (the attempt ledger on the USB is unwritable, so
this attempt cannot be counted) refuses it outright. A destructive attempt that
cannot be counted is the reboot loop R9 exists to bound.

It also does not weaken consent: the read-only probe still happens first, the
cancel window is never shortened, and a `default=abort` is never flipped back to
`proceed`. The attempt is written to the USB's ledger with `stage=reformat`, so
a later reader can tell a deliberate wipe from a repair that failed into one.

## What's on the stick

The complete package list lives in
[`nixos/installer/configuration.nix`](nixos/installer/configuration.nix)
under `environment.systemPackages`. Categories include:

- Version control: git, git-lfs, gnupg, openssh
- Editors: vim, neovim, nano
- Shell QoL: tmux, htop, ripgrep, jq, yq-go, fzf, bat
- Network: curl, wget, nmap, networkmanager, iwd, wireguard-tools
- Disk: parted, gptfdisk, cryptsetup, zfs, lvm2, mdadm
- Hardware inspection: lshw, dmidecode, nvme-cli, lm_sensors
- NixOS install tooling: nixos-install-tools, nix-output-monitor

The flake itself is the tick source. Every subsequent install
reconciles toward the desired state declared here.
