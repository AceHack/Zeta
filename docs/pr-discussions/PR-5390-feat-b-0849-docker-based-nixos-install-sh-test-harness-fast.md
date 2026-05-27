---
pr_number: 5390
title: "feat(B-0849): docker-based NixOS install.sh test harness \u2014 fast iteration (~30 sec) complementing B-0831 QEMU full-install (~15 min); 'easy dockerfile' (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:51:21Z"
merged_at: "2026-05-27T02:53:30Z"
closed_at: "2026-05-27T02:53:30Z"
head_ref: "feat-b0849-docker-nixos-install-sh-test-harness-fast-iteration-2026-05-26-2356z"
base_ref: "main"
archived_at: "2026-05-27T19:27:15Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5390: feat(B-0849): docker-based NixOS install.sh test harness — fast iteration (~30 sec) complementing B-0831 QEMU full-install (~15 min); 'easy dockerfile' (Aaron 2026-05-27)

## PR description

## Summary

Operator (verbatim):

> *\"we should add docker based nixos install.sh testing so we can iterate quick that's an easy dockerfile\"*

Direct response after PR #5389 (iter-5.5.1 alignment fix-fwd) — operator named the iteration-cost problem: every install.sh / linux.sh / mise.sh change today requires full ISO build + USB flash + physical install (~30 min cycle). Docker testing of just the script on NixOS userspace gives seconds-per-iteration.

## Empirical case

iter-5.4 cascade produced **8 distinct bugs** (Bug 1-8) ALL caught only after operator USB flash. Docker harness would have caught Bug 5 (gh not in systemPackages), Bug 7 (NetBIOS conflict with smbd), Bug 8 (credential persistence gap) **at write time**.

## 3-phase plan

| Phase | Scope | Cycle time |
|---|---|---|
| 1 | \`tools/ci/dockerfiles/nixos-install-sh-test/Dockerfile\` + TS wrapper | ~30-60 sec local |
| 2 | GitHub Actions integration with path-filter | per-PR auto |
| 3 | Docker-vs-QEMU coverage matrix doc | composes with B-0831 |

## Composes with

[B-0831](docs/backlog/P2/B-0831-...) (QEMU full-install — complementary) · [B-0835](docs/backlog/P1/B-0835-...) (install bug cluster) · [B-0848](docs/backlog/P2/B-0848-...) (node-local Claude) · [B-0824](docs/backlog/P1/B-0824-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md) (Ace) · GOVERNANCE §24 (three-way parity extended to NixOS-via-Docker)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T02:51:25Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
