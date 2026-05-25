# usb-nixos-installer

**Scope: ONLY the USB bootstrap portion.**

This directory contains exactly the four things needed to produce a
bootable NixOS USB installer that can install the target operating
system on a new machine over USB or Ethernet:

1. **NixOS declarative configuration** — `nixos/installer/configuration.nix`
2. **NixFlakes for packages** — `flake.nix` at the directory root
3. **Git for version text storage** — every file here lives in git;
   `flake.nix` references inputs by Git branch. **Run
   `nix flake update` and commit the resulting `flake.lock`** to
   pin to specific revisions for fully-reproducible builds. The
   lock file isn't committed yet (no maintainer with Nix has run
   `nix flake update` on this branch yet); first maintainer to
   build the ISO should commit it.
4. **The OS Flake on a USB stick** — `nix build .#installer-iso`
   produces a bootable ISO image you `dd` to a USB stick. The same
   ISO supports Ethernet install (boot the target on the stick,
   then `nixos-install --flake <git-url>#<host>` over the network).

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
cd usb-nixos-installer
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
