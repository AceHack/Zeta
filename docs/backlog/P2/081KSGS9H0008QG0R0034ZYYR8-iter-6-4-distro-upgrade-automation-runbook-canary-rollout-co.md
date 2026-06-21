---
id: 081KSGS9H0008QG0R0034ZYYR8
priority: P2
status: open
title: iter-6.4 — distro-upgrade automation runbook + scripted canary-rollout — cross-channel jumps (e.g., 25.11 → 26.05) need coordinated cluster-wide canary-test + drain-aware rollout that autoUpgrade (081KSGS9H0008QG0R002T6J6FS) doesn't cover; "if we reformat every time it's handled by the cluster not a manual operator" per the maintainer 2026-05-26
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R002T6J6FS
  - 081KSGS9H0008QG0R003GM7TYN
composes_with:
  - 081KSGS9H0008QG0R001EKTS5A
  - 081KSGS9H0008QG0R002T6J6FS
  - 081KSGS9H0008QG0R003GM7TYN
  - 081KSGS9H0008QG0R00280HHA7
  - 081KSGS9H0008QG0R002BC2ZR7
tags: [iter-6, distro-upgrade, runbook, canary-rollout, automation, cross-channel, nixos, full-ai-cluster, no-manual-operator]
---

## Problem

The maintainer 2026-05-26: *"lets backlog all that we need to be able to upgrade without having to reformat every time or if we reformat everytime it's handled by the cluster not a manual operator."*

[081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) `system.autoUpgrade` handles within-channel bumps (e.g., `nixos-25.11` channel commits over time). It does NOT handle cross-channel jumps like `nixos-25.11` → `nixos-26.05` because those usually have breaking changes that need:

1. Pre-jump canary build + smoke-test on one node
2. Coordinated cluster-wide drain (workloads need to handle the rolling reboot serially)
3. Per-node rollback if anything goes sideways
4. `stateVersion` decision per host (whether to bump or leave for migration-safety)
5. Module-deprecation fix-ups (renamed services, removed options)

Today this would be a fully-manual operator dance per node. Aaron's principle says no — it should be cluster-handled (or scripted to the point that the operator just kicks off one command).

## Target

Two artifacts:

### Artifact 1 — `full-ai-cluster/DISTRO-UPGRADE.md` runbook

Markdown doc covering the cross-channel upgrade process:

- Pre-flight checks (read upstream release notes; check `nix flake check` for warnings about deprecated modules)
- Canary node selection (default: PC1)
- Build-only step on canary (`nixos-rebuild build --flake .#pc1` — doesn't activate)
- Test ISO build (`nix build .#installer-iso` for any node that boots from ISO)
- Activate on canary + 24h soak
- Rolling activate to fleet (via deploy-rs canary-then-fleet OR per-node via kured-drained reboots)
- Rollback decision tree if any node fails

### Artifact 2 — `tools/cluster/distro-upgrade.ts` orchestrator

Bun script that automates the runbook:

```typescript
// Usage:
//   bun tools/cluster/distro-upgrade.ts --from nixos-25.11 --to nixos-26.05 --canary pc1 [--dry-run]
//
// Steps:
//   1. git checkout -b otto/distro-upgrade-25.11-to-26.05
//   2. edit full-ai-cluster/flake.nix (nixpkgs.url + nix-darwin.url)
//   3. nix flake update + commit
//   4. nix build .#installer-iso (verify ISO builds)
//   5. open PR with body listing breaking changes detected via diff of release notes
//   6. wait for PR merge (operator approves)
//   7. (post-merge) trigger canary deploy via deploy-rs OR ssh + nixos-rebuild
//   8. health-check canary for N minutes
//   9. if healthy + operator-confirms: roll to fleet sequentially
```

### Sub-targets

#### Sub-target 1 — Runbook documents the process

Including: how to read NixOS release notes for breaking changes; the canary discipline; rollback procedure; `stateVersion` decision rule.

#### Sub-target 2 — Orchestrator script

TS + Bun per Rule 0. Idempotent + dry-run-default + clear progress output. Composes with deploy-rs (081KSGS9H0008QG0R00280HHA7) if that's the chosen update-shape; falls back to SSH + nixos-rebuild if autoUpgrade (081KSGS9H0008QG0R002T6J6FS) is the chosen shape.

#### Sub-target 3 — Cluster-state precondition checks

Before kicking off:

- All nodes report Ready
- No PodDisruptionBudget violations expected
- Backup of cluster state taken (etcd snapshot for control-plane; PV snapshots for stateful workloads)
- No in-flight ArgoCD syncs

If any precondition fails, abort with a clear operator-actionable message.

#### Sub-target 4 — Post-upgrade verification

After cluster-wide rollout:

- All nodes back to Ready
- All ArgoCD apps reach Healthy/Synced
- Smoke-test workload (e.g., a known endpoint returns 200)
- Final canary stays on new channel for N days before declaring success

## Acceptance

- [ ] `full-ai-cluster/DISTRO-UPGRADE.md` runbook published
- [ ] `tools/cluster/distro-upgrade.ts` exists + dry-run-tests cleanly for a hypothetical 25.11 → 26.05 jump
- [ ] Orchestrator detects + handles the chosen update-shape (autoUpgrade OR deploy-rs)
- [ ] Precondition checks block on cluster-not-healthy
- [ ] Post-upgrade smoke-test wired
- [ ] Tested first time on the actual 25.11 → 26.05 jump when that channel ships (late May 2026)

## Out of scope

- Multi-cluster federation
- Rolling back across `stateVersion` boundaries (different problem class; usually requires data-migration support per service)
- Automating the upstream-release-notes parsing (relies on human review)

## Composes with

- [081KSGS9H0008QG0R001EKTS5A](../P1/081KSGS9H0008QG0R001EKTS5A-iter-6-0-bump-nixpkgs-24-11-to-25-11-warbler-xantusia-eol-recovery-aaron-2026-05-26.md) — the FIRST cross-channel jump (24.11 → 25.11) is the empirical anchor for the runbook
- [081KSGS9H0008QG0R002T6J6FS](081KSGS9H0008QG0R002T6J6FS-iter-6-1-system-autoupgrade-nixos-modules-common-weekly-schedule-no-auto-reboot-aaron-2026-05-26.md) — autoUpgrade handles within-channel; this row handles cross-channel
- [081KSGS9H0008QG0R003GM7TYN](081KSGS9H0008QG0R003GM7TYN-iter-6-2-kured-argocd-app-kubernetes-aware-drain-reboot-aaron-2026-05-26.md) — kured handles per-node drain+reboot inside the rolling rollout
- [081KSGS9H0008QG0R00280HHA7](081KSGS9H0008QG0R00280HHA7-iter-6-3-deploy-rs-from-ci-gitops-flake-lock-pull-with-auto-rollback-aaron-2026-05-26.md) — deploy-rs is one of the rollout backends the orchestrator targets
- [081KSGS9H0008QG0R002BC2ZR7](../P1/081KSGS9H0008QG0R002BC2ZR7-iter-6-5-all-deps-current-version-audit-nix-flake-argocd-helm-charts-otto-training-data-stale-defaults-must-search-first-aaron-2026-05-26.md) — audit surfaces when a cross-channel jump is overdue
