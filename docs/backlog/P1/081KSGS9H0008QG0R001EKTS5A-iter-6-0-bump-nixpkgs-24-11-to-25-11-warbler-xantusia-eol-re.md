---
id: 081KSGS9H0008QG0R001EKTS5A
priority: P1
status: open
title: iter-6.0 — bump nixpkgs pin from `nixos-24.11` (EOL'd Jun 2025) to `nixos-25.11` Xantusia (current stable; EOL Jun 2026) — full-ai-cluster substrate is currently on an EOL channel; latest-deps-from-the-beginning principle violated; URGENT
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KSGS9H0008QG0R002T6J6FS
  - 081KSGS9H0008QG0R003GM7TYN
  - 081KSGS9H0008QG0R00280HHA7
  - 081KSGS9H0008QG0R0034ZYYR8
tags: [iter-6, nixos, distro-upgrade, nixpkgs, eol-recovery, latest-deps-principle, urgent, full-ai-cluster, supply-chain-security]
---

## Problem

The maintainer 2026-05-26: *"is there a 25 we should go ahead and distro upgrade we don't want to be behind search for latest we like to be on latest deps and don't start behind from the beginning."*

Empirical state per WebSearch 2026-05-26:

- **NixOS 25.11 "Xantusia"** — released 2025-11-30; current stable; EOL 2026-06-30
- **NixOS 25.05 "Warbler"** — released May 2025; EOL 2025-12-31 (already past EOL)
- **NixOS 24.11** (our current pin) — released Nov 2024; EOL 2025-06-30 (already past EOL **as of this filing**)

`full-ai-cluster/flake.nix` line 22:

```nix
nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
```

We are on an EOL channel as the very-first cluster substrate. Latest-deps-from-the-beginning principle violated; supply-chain security exposure: 24.11 receives no further security backports.

## Target

Bump pin to `nixos-25.11` in `full-ai-cluster/flake.nix`. Update `stateVersion = "24.11"` to `"25.11"` if appropriate per upgrade-safety guidance. Test build on x86_64-linux + aarch64-darwin systems before merge. Document any breaking changes encountered.

## Sub-targets

### Sub-target 1 — Bump nixpkgs.url + flake.lock

Edit `full-ai-cluster/flake.nix`:

```diff
-    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
+    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
```

Then `cd full-ai-cluster && nix flake update`.

Also bump matching `nix-darwin` channel:

```diff
     nix-darwin = {
-      url = "github:nix-darwin/nix-darwin/nix-darwin-24.11";
+      url = "github:nix-darwin/nix-darwin/nix-darwin-25.11";
       inputs.nixpkgs.follows = "nixpkgs";
     };
```

### Sub-target 2 — Decide on `stateVersion` bump

`stateVersion = "24.11"` in flake.nix is intentionally sticky — it controls migration-sensitive defaults (e.g., postgres major version, k3s defaults). NixOS guidance: leave `stateVersion` at the version a host was first installed under, do NOT bump on distro upgrade unless you've explicitly handled all migration-affected services. For a fresh-install cluster (PC1 hasn't run any persistent K8s workloads yet), bumping is safe; for any host with state, leave it.

Check current cluster state. PC1 has not yet run workloads → safe to bump `stateVersion`. Document the decision in the PR.

### Sub-target 3 — Build canary on aarch64-darwin (Aaron's Mac)

Before any rebuild on PC1:

```bash
cd full-ai-cluster
nix flake check --no-build --show-trace
nix build .#installer-iso --print-build-logs
```

Verify ISO builds cleanly + workflow CI greens.

### Sub-target 4 — Document breaking changes encountered

NixOS 24.11 → 25.05 → 25.11 has had two breaking-change cycles. Likely surfaces:

- Python 3.x default version bump
- Go default version bump
- K3s major version (potentially)
- systemd unit format changes
- OpenSSH config defaults
- Possible `services.*` module deprecations / renames

Run `nix flake check` + inspect output for warnings. File any required fixes as sibling rows.

### Sub-target 5 — Update workflow CI substrate to match

`build-ai-cluster-iso.yml` doesn't pin nixpkgs version explicitly (it uses the flake's pin); no workflow change needed.

The audit-installer-substrate.ts source-substrate audit checks for specific files but not for version strings; no change needed.

## Acceptance

- [ ] `full-ai-cluster/flake.nix` `nixpkgs.url` = `github:NixOS/nixpkgs/nixos-25.11`
- [ ] `full-ai-cluster/flake.nix` `nix-darwin.url` = matching `nix-darwin-25.11`
- [ ] `full-ai-cluster/flake.lock` regenerated
- [ ] `nix flake check --no-build` clean on Aaron's Mac
- [ ] CI ISO build greens on the bump PR
- [ ] PR body documents `stateVersion` decision + any breaking changes encountered
- [ ] Sibling B-NNNN rows filed for any required follow-up migrations

## Out of scope

- Rolling the bump out to PC1 (separate ops action; depends on iter-5.x validation first)
- Automating future bumps (covered by [081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) + [081KSGS9H0008QG0R00280HHA7](081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md))
- Distro-upgrade automation runbook (covered by [081KSGS9H0008QG0R0034ZYYR8](081KSGS9H0008QG0R0034ZYYR8-iter-6-4-distro-upgrade-automation-runbook-canary-rollout-coordinated-cluster-bump-aaron-2026-05-26.md))

## Composes with

- [081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) — system.autoUpgrade will continuously bump WITHIN a channel (24.11 → fresh 24.11 commits) but NOT cross-channel; this row is the cross-channel jump
- [081KSGS9H0008QG0R003GM7TYN](081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md) — kured handles reboot orchestration; relevant for any rebuild that flips reboot-required
- [081KSGS9H0008QG0R00280HHA7](081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md) — deploy-rs is the eventual GitOps shape for this
- [081KSGS9H0008QG0R0034ZYYR8](081KSGS9H0008QG0R0034ZYYR8-iter-6-4-distro-upgrade-automation-runbook-canary-rollout-coordinated-cluster-bump-aaron-2026-05-26.md) — distro-upgrade runbook + automation

## Sources

- [NixOS 25.11 released](https://nixos.org/blog/announcements/2025/nixos-2511/) (2025-11-30 release announcement)
- [NixOS Status](https://status.nixos.org/) (current channel health)
- [NixOS 25.11 — Release schedule (Issue #443568)](https://github.com/NixOS/nixpkgs/issues/443568)
- [NixOS Discourse — 25.11 released](https://discourse.nixos.org/t/nixos-25-11-released/72711)
