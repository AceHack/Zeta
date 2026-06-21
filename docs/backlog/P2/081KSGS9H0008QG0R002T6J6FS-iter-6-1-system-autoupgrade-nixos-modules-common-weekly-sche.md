---
id: 081KSGS9H0008QG0R002T6J6FS
priority: P2
status: open
title: iter-6.1 — enable `system.autoUpgrade` in `full-ai-cluster/nixos/modules/common.nix` (weekly schedule; no auto-reboot; pulls flake.lock + rebuilds) — cluster nodes self-update without manual operator action; pairs with kured (081KSGS9H0008QG0R003GM7TYN) for K8s-aware reboot
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R001EKTS5A
composes_with:
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R003GM7TYN
  - 081KSGS9H0008QG0R00280HHA7
  - 081KSGS9H0008QG0R0034ZYYR8
  - 081KSGS9H0008QG0R002BC2ZR7
tags: [iter-6, nixos, system-autoupgrade, cluster-self-update, no-manual-operator, full-ai-cluster, weekly-cadence]
---

## Problem

The maintainer 2026-05-26: *"lets backlog all that we need to be able to upgrade without having to reformat every time or if we reformat everytime it's handled by the cluster not a manual operator."*

Today cluster nodes (PC1, future Beelinks) never auto-update. PC1 stays on whatever ISO version it was installed with until a manual `nixos-rebuild switch --flake .#<host>`. That violates the "cluster handles it, not manual operator" principle the maintainer just named.

NixOS ships `system.autoUpgrade` — a built-in NixOS module that runs `nix flake update + nixos-rebuild switch` on a systemd timer schedule. Combined with `allowReboot = false` (so reboots are delegated to [081KSGS9H0008QG0R003GM7TYN](081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md) kured for K8s-aware drain), the cluster self-updates within-channel weekly.

## Target

Enable `system.autoUpgrade` in `full-ai-cluster/nixos/modules/common.nix` for every cluster node:

```nix
system.autoUpgrade = {
  enable = true;
  flake = "github:Lucent-Financial-Group/Zeta?dir=full-ai-cluster#${config.networking.hostName}";
  flags = [
    "--update-input" "nixpkgs"
    "--no-write-lock-file"  # transient in-memory lock; don't persist
  ];
  dates = "Sun 03:00";  # weekly off-peak
  randomizedDelaySec = "45min";
  allowReboot = false;  # delegate reboot to kured (081KSGS9H0008QG0R003GM7TYN)
  rebootWindow = {
    lower = "03:00";
    upper = "05:00";
  };
};
```

Note: dropped `--commit-lock-file` (Copilot finding on #5123 — it would
contradict `--no-write-lock-file`: the latter tells `nix flake update`
not to write `flake.lock` at all, so committing it is incoherent). The
autoUpgrade unit doesn't have repo write credentials anyway; lock
updates ship from CI/deploy-rs (081KSGS9H0008QG0R00280HHA7), and the cluster only needs an
in-memory lock-update for the current rebuild. If we want the cluster
to also pin its rebuild against a specific lock for replayability, the
clean path is to drop `--no-write-lock-file` AND pin via `--override-input`
flags here; out of scope for the initial enablement.

## Sub-targets

### Sub-target 1 — Add `system.autoUpgrade` block to common.nix

Edit `full-ai-cluster/nixos/modules/common.nix`. Schedule weekly Sunday 03:00 + 45min jitter so all cluster nodes don't update simultaneously.

### Sub-target 2 — Configure flake URL to point at this repo

The `flake = "github:..."` URL must resolve to the live flake. For public repo (currently Lucent-Financial-Group/Zeta is public) this works without auth. If repo goes private, switch to a self-hosted git mirror OR use deploy-rs (081KSGS9H0008QG0R00280HHA7) push-based pattern.

### Sub-target 3 — Document in PROVISIONING.md

Add a section explaining that nodes self-update weekly + how to disable for one-off maintenance (`systemctl stop nixos-upgrade.timer`).

### Sub-target 4 — Test on canary node first

PC1 is the canary. After landing this module change + rebuilding PC1, verify:

- `systemctl status nixos-upgrade.timer` shows the timer is active
- `journalctl -u nixos-upgrade.service` after first scheduled run shows clean execution

## Acceptance

- [ ] `system.autoUpgrade` block in `full-ai-cluster/nixos/modules/common.nix`
- [ ] `nix flake check` clean
- [ ] PROVISIONING.md section added
- [ ] PC1 canary verified after first scheduled run
- [ ] `allowReboot = false` (delegated to 081KSGS9H0008QG0R003GM7TYN kured)

## Out of scope

- K8s-aware drain+reboot (081KSGS9H0008QG0R003GM7TYN — kured)
- Push-from-CI alternative (081KSGS9H0008QG0R00280HHA7 — deploy-rs)
- Cross-channel distro upgrades (081KSGS9H0008QG0R0034ZYYR8 — separate process; autoUpgrade only does within-channel)
- Initial 24.11 → 25.11 jump (081KSGS9H0008QG0R001EKTS5A — must land before this row activates)

## Composes with

- [081KSGS9H0008QG0R001EKTS5A](../P1/081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — bump nixpkgs first; THEN autoUpgrade tracks the new channel forward
- [081KSGS9H0008QG0R003GM7TYN](081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md) — kured handles the K8s-aware reboot when autoUpgrade flips reboot-required
- [081KSGS9H0008QG0R00280HHA7](081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md) — deploy-rs is the alt-shape (push from CI); pick autoUpgrade XOR deploy-rs (not both)
- [081KSGS9H0008QG0R0034ZYYR8](081KSGS9H0008QG0R0034ZYYR8-iter-6-4-distro-upgrade-automation-runbook-canary-rollout-coordinated-cluster-bump-aaron-2026-05-26.md) — runbook for the cross-channel jumps autoUpgrade can't do
- [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) — audit tool surfaces what bumps are needed

## Sources

- [NixOS Manual — system.autoUpgrade](https://nixos.org/manual/nixos/stable/options#opt-system.autoUpgrade.enable)
