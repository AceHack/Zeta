---
pr_number: 5343
title: "docs(backlog): 081KSGS9H0008QG0R0011BC7T2 \u2014 CI cascade #6 full-install + cluster-auto-join (eliminate routine human physical USB test)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T22:53:48Z"
merged_at: "2026-05-26T22:58:58Z"
closed_at: "2026-05-26T22:58:58Z"
head_ref: "otto/b-0831-ci-cascade-6-full-install-cluster-auto-join-no-human-test-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5343: docs(backlog): 081KSGS9H0008QG0R0011BC7T2 — CI cascade #6 full-install + cluster-auto-join (eliminate routine human physical USB test)

## PR description

## Summary

Files 081KSGS9H0008QG0R0011BC7T2 as P1 substrate-engineering target capturing operator direction 2026-05-26: \"zflash is the thing plus cluster auto joining after boot from iso use we want that in ci not needing human to test everytime.\"

## 3-slice decomposition

| Slice | Scope | Latency cost |
|---|---|---|
| 1 | Full-install-in-QEMU: boot installer ISO → first-boot service fires → greedy N-disk install → reboot → verify login banner | +5-10 min PR-build |
| 2 | Cluster-auto-join verification via mock cluster control-plane (capture + verify 081KSGS9H0008QG0R0037H3W4T self-registration payload) | +<1 min |
| 3 | ArgoCD reconciliation verification (most coupled to live cluster state; deferrable to push-to-main only) | TBD; possibly push-only |

Each slice ships independently. Overall acceptance: human physical-USB-test is no longer the routine gate for substrate landings.

## What remains valuable for physical test

- Real-hardware quirks (BIOS/UEFI variants; motherboard NICs; SAS controllers) that QEMU doesn't emulate
- Periodic sanity-checks the maintainer chooses to do
- First-time-on-new-hardware validation

## Test plan

- [x] markdownlint clean (081KSGS9H0008QG0R0011BC7T2 row + BACKLOG.md regenerated)
- [x] No code changes (backlog row only)
- [x] Composes_with cross-refs to all relevant rows + skills + workflow files
- [x] Substrate-honest scope assessment (L effort; phased; latency trade-off named)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T22:56:09Z)

## Pull request overview

Adds a new P1 backlog row (081KSGS9H0008QG0R0011BC7T2) capturing the planned CI “cascade #6” work to validate a full installer run in QEMU plus post-boot cluster auto-join, with the goal of eliminating routine physical USB testing as the substrate gate.

**Changes:**

- Adds new backlog row **081KSGS9H0008QG0R0011BC7T2** describing a 3-slice CI verification plan (full install, mock join verification, optional ArgoCD reconciliation verification).
- Updates `docs/BACKLOG.md` index to include **081KSGS9H0008QG0R0011BC7T2**.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-routine-human-physical-usb-test-aaron-2026-05-26.md | New backlog row defining the problem statement, slices, acceptance criteria, and cross-references for CI cascade #6. |
| docs/BACKLOG.md | Adds 081KSGS9H0008QG0R0011BC7T2 to the P1 backlog index list. |

## Review threads

### Thread 1: docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-routine-human-physical-usb-test-aaron-2026-05-26.md:71 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:56:08Z):

The cluster registration path is inconsistent with the established per-maintainer shape (e.g., `maintainers/<operator>/cluster-nodes/<hostname>/...` in 081KSGS9H0008QG0R0037H3W4T/081KSGS9H0008QG0R0027HJZYH). `maintainers/cluster-nodes/` suggests a top-level directory that doesn't exist and would mislead future implementation/testing work.

### Thread 2: docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-routine-human-physical-usb-test-aaron-2026-05-26.md:86 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:56:08Z):

This reference to ArgoCD watching `maintainers/cluster-nodes/` should match the globbed path used elsewhere (`maintainers/*/cluster-nodes/**` per 081KSGS9H0008QG0R002K93MWX). As written, it implies a different tree shape than the rest of the cluster-node registration substrate.

### Thread 3: docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-routine-human-physical-usb-test-aaron-2026-05-26.md:102 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:56:08Z):

Markdown continuation line starts with `+` inside a `-` bullet, which triggers markdownlint list-style parsing issues in this repo. Also, `<10` is easy to misread as an HTML tag in Markdown renderers; wording it as "under" avoids that ambiguity.

### Thread 4: docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-routine-human-physical-usb-test-aaron-2026-05-26.md:174 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:56:09Z):

`(<1 min ...)` can be misinterpreted as an HTML tag in Markdown renderers; using "under 1 min" keeps the meaning while avoiding rendering ambiguity.

## General comments

### @chatgpt-codex-connector (2026-05-26T22:53:54Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
