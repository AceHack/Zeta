---
pr_number: 5116
title: "ci(installer-iso): source-substrate audit + broaden trigger paths \u2014 catches dropped iter-N modules before ~15min Nix build (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T06:51:28Z"
merged_at: "2026-05-26T06:54:25Z"
closed_at: "2026-05-26T06:54:25Z"
head_ref: "otto-cli/ci-installer-substrate-audit-broaden-trigger-paths-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:21Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5116: ci(installer-iso): source-substrate audit + broaden trigger paths — catches dropped iter-N modules before ~15min Nix build (Aaron 2026-05-26)

## PR description

Aaron 2026-05-26: 'start wroking on the ci stuff while we iterate so you can start iterating without me' + 'any parts we can test in siolate are candidates for more unit like tests instead of full integration tests'.

Ships **#1 of ascending test-substrate cascade** (audit/broaden-paths). Catches the empirical bug Aaron hit: build-ai-cluster-iso.yml trigger filter (`nixos/modules/disko-shapes/**` only) missed iter-5.2 + iter-5.2.2 module additions → CI didn't rebuild ISO → operator downloaded stale ISO via `gh run download`.

**Changes**:

- NEW `tools/ci/audit-installer-substrate.ts` (~250 LOC TS) — REQUIRED_FILES (10) + REQUIRED_SENTINELS (5) assertions; ~1s runtime; locally + in CI; exit codes 0/1/2 for pass/missing-file/missing-sentinel
- BROADENED workflow triggers: nixos/disko-shapes/** → all nixos/** + tools/** + the audit tool
- ADDED preflight audit step BEFORE the ~15min nix build (fail-fast)

**Empirical validation**: audit PASS on current main substrate (10 files + 5 sentinel-file assertions OK).

**Follow-on cascade** (separate PRs):

- #2 Unit tests for zflash.ts (Bun test runner; no I/O)
- #3 Docker-based zeta-install.sh test (mocked /dev devices)
- #4 ISO content audit (7z list of built ISO)
- #5 NixOS test framework (full QEMU VM boot + install round-trip)

## General comments

### @chatgpt-codex-connector (2026-05-26T06:51:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
