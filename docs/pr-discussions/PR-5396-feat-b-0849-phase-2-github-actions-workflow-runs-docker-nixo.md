---
pr_number: 5396
title: "feat(081KSKBP80008QG0R000E3RKPK Phase 2): GitHub Actions workflow runs Docker NixOS install.sh test on PRs touching install substrate"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T04:02:36Z"
merged_at: "2026-05-27T04:05:15Z"
closed_at: "2026-05-27T04:05:15Z"
head_ref: "feat-b0849-2-docker-nixos-install-sh-test-github-actions-integration-2026-05-27-0440z"
base_ref: "main"
archived_at: "2026-05-27T19:27:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5396: feat(081KSKBP80008QG0R000E3RKPK Phase 2): GitHub Actions workflow runs Docker NixOS install.sh test on PRs touching install substrate

## PR description

## Summary

Wires the Docker harness from 081KSKBP80008QG0R000E3RKPK Phase 1 ([PR #5393](https://github.com/Lucent-Financial-Group/Zeta/pull/5393)) into CI so install.sh / linux.sh / mise.sh bugs are caught at PR time vs reboot time.

## Path triggers

- `tools/setup/**` — install dispatcher + per-OS scripts
- `.mise.toml` — pinned runtime versions
- `full-ai-cluster/nixos/modules/common.nix` — systemd + bun PATH
- `tools/ci/dockerfiles/nixos-install-sh-test/**` — Dockerfile
- `tools/ci/docker-nixos-install-sh-test.ts` — TS wrapper
- `.dockerignore` — affects all docker builds
- `package.json` + `bun.lock` — TS wrapper deps
- This workflow file

## Discipline (mirrors build-ai-cluster-iso.yml)

- Runner pinned `ubuntu-24.04` (NOT `-latest`)
- All third-party actions SHA-pinned with `vX.Y.Z` comments
- `permissions: contents: read` at workflow level
- Concurrency: workflow-scoped, cancel-in-progress for PRs
- Zero `github.event.*` interpolation in `run:` lines (security-guidance compliant)
- 15-min job timeout; 900s DOCKER_BUILD_TIMEOUT_SEC for cold-cache headroom
- Upload-artifact (always) preserves log for 7 days

## Composes with

[PR #5393](https://github.com/Lucent-Financial-Group/Zeta/pull/5393) (081KSKBP80008QG0R000E3RKPK Phase 1 — the Dockerfile + TS wrapper) · 081KSGS9H0008QG0R0011BC7T2 cascade #5 QEMU complementary · iter-5.5.0 substrate · [081KSGS9H0008QG0R00120EEHM](docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-...) install bug cluster

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T04:02:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
