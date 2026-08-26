# infra/nix-darwin/

nix-darwin configuration for maintainer Macs (Apple Silicon).

The reason this directory exists is **one feature**: `nix.linux-builder`.
It spins up a tiny Linux VM via Apple's Virtualization.framework that
Nix dispatches Linux builds to — so the canonical installer ISO build
(`cd full-ai-cluster && nix build .#installer-iso`)
works locally on an M-series Mac without Parallels, Lima, Docker, or a
remote builder.

## Prerequisites

1. Apple Silicon Mac (M1/M2/M3/M4).
2. macOS 13 (Ventura) or newer — needs Virtualization.framework.
3. Nix installed (Determinate macOS package recommended):
   <https://dtr.mn/determinate-nix>
4. Rosetta 2 installed (`softwareupdate --install-rosetta --agree-to-license`).
   The Linux builder VM uses the Linux build of Rosetta to run
   x86_64 binaries at near-native speed.

## One-command setup

```bash
nix run nix-darwin/nix-darwin-26.05#darwin-rebuild -- switch \
  --flake /path/to/Zeta#zeta-mac
```

What it does:

- Installs the `nix-darwin` module system on this Mac
- Applies `configuration.nix` <!-- STALE-REF: configuration.nix --> which:
  - Enables `nix-command` + flakes globally
  - Trusts the `admin` group (macOS) for Nix operations via `trusted-users = @admin`
  - Configures the public Nix caches (cache.nixos.org, nix-community)
  - Enables `nix.linux-builder` with the aarch64-linux VM
  - Registers `x86_64-linux` as an `extra-platforms` (Rosetta-backed)
  - Installs a baseline package set: kubectl, helm, k9s, argocd, age,
    sops, jq, yq, ripgrep, fd, htop, gh, git, nix-output-monitor, etc.

## After setup — build the ISO

From the Zeta repo root:

```bash
# Canonical AI-cluster installer substrate (root-flake installer-iso
# package retired 2026-05-26 in USB cleanup PR 2):
cd full-ai-cluster && nix build .#installer-iso
# ↓ writes result/iso/zeta-installer-25.11.iso (~1.5-2 GB)
```

First build takes ~10-15 min (downloads dependencies, boots the
linux-builder VM, compiles the Linux closure). Subsequent builds
reuse the warm VM and the /nix/store cache — typically 1-3 min.

## When to update the linux-builder VM

Bump `nix-darwin` master periodically:

```bash
nix run nix-darwin/nix-darwin-26.05#darwin-rebuild -- switch \
  --flake /path/to/Zeta#zeta-mac --recreate-lock-file
```

That picks up newer linux-builder VM images + any nixpkgs bumps.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `error: builder for ... failed` on linux-builder dispatch | `sudo launchctl kickstart -k system/org.nixos.linux-builder` |
| Rosetta x86_64 binaries seg-fault inside the VM | Update macOS — older Rosetta builds had VM bugs |
| `permission denied` on /nix/store | You're not in the `admin` group (macOS), or `trusted-users = ["@admin"]` didn't apply. Re-run `darwin-rebuild switch` |
| VM uses all your RAM | Lower `memorySize` in `configuration.nix` <!-- STALE-REF: configuration.nix --> and re-apply |

## What this is NOT

- **NOT a NixOS host config.** Those live under [`../nixos/hosts/`](../nixos/hosts/) and run on the cluster machines themselves.
- **NOT required for cluster operation.** The cluster runs whether
  or not any maintainer has nix-darwin set up. This is purely a
  workstation convenience for building the ISO locally.
- **NOT a replacement for the CI build.** The
  `build-ai-cluster-iso.yml` <!-- STALE-REF: ../../.github/workflows/build-ai-cluster-iso.yml -->
  workflow stays the source of truth for "this PR's ISO" — local
  builds are for iteration, not for distribution.
