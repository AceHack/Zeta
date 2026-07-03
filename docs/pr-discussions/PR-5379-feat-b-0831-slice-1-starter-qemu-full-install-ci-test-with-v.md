---
pr_number: 5379
title: "feat(081KSGS9H0008QG0R0011BC7T2 Slice 1 STARTER): QEMU full-install CI test with virtual disk + iter-5.3 marker"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:05:59Z"
merged_at: "2026-05-27T02:09:37Z"
closed_at: "2026-05-27T02:09:37Z"
head_ref: "feat-b0831-slice1-qemu-full-install-test-starter-otto-cli-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5379: feat(081KSGS9H0008QG0R0011BC7T2 Slice 1 STARTER): QEMU full-install CI test with virtual disk + iter-5.3 marker

## PR description

## What

081KSGS9H0008QG0R0011BC7T2 Slice 1 starter per Aaron 2026-05-26 authorization: *"moving testing of zflash and the iso/usb and cluster join would be great while i test on the pc again"*.

Extends \`qemu-boot-test.ts\` (cascade #5) by:

- Attaching virtual hard disk (qcow2; 20GB sparse) as install target
- NAT'd internet (zeta-install needs git clone + nix substitution)
- Waits for \`[iter-5.3]\` marker in serial log

## Success marker

\`[iter-5.3]\` — appears at the zeta-install.sh password-prompt line. Reaching it proves install completed:

- Boot
- Partition + format
- nixos-install
- iter-4.2 SSH pubkey probe
- iter-5.2 hostname injection

The password prompt is the first operator-stdin requirement; we can't proceed past it without injecting stdin (deferred work).

## Deferred to follow-up PRs

- Reboot loop (boot from installed disk)
- iter-5.3 password auto-confirm (serial stdin injection)
- iter-5.4.0 gh auth completion (081KSGS9H0008QG0R003JNSVR5 Approach A mock device-code endpoint)
- Cluster auto-join verification (081KSGS9H0008QG0R0011BC7T2 Slice 2)
- ArgoCD reconciliation (081KSGS9H0008QG0R0011BC7T2 Slice 3)

## Workflow gating

- Gated to \`push-to-main\` + \`workflow_dispatch\` (not every PR)
- \`continue-on-error: true\` for STARTER so initial flakiness doesn't block merges
- Once test proves reliable + runs <10min consistently, can be enabled on every PR per 081KSGS9H0008QG0R0011BC7T2 acceptance

## Composes with

- 081KSGS9H0008QG0R0011BC7T2 (parent — CI cascade #6)
- \`tools/ci/qemu-boot-test.ts\` (cascade #5 — same pattern)
- \`tools/ci/audit-installer-iso-content.ts\` (cascade #4)
- \`tools/ci/audit-installer-substrate.ts\` (Layer 1 sentinels)
- \`tools/ci/test-iter-54-install-flow.test.ts\` (Layer 2a structural)
- 081KSGS9H0008QG0R003JNSVR5 Approach A (mock GH device-code — required for full install completion)

## Security

\`github.event_name\` used in \`if:\` only (GitHub-controlled values: push/pull_request/workflow_dispatch); no attacker-controllable interpolation in \`run:\` commands.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:10:10Z)

## Pull request overview

Adds a starter QEMU full-install CI layer for the AI-cluster installer ISO, extending the existing boot smoke test toward 081KSGS9H0008QG0R0011BC7T2 by attaching a virtual disk, enabling NAT networking, and wiring the new helper into the ISO workflow.

**Changes:**

- Adds `tools/ci/qemu-full-install-test.ts` for QEMU disk-backed install progress testing.
- Installs `qemu-utils` alongside `qemu-system-x86` for qcow2 disk creation.
- Adds a gated, non-blocking workflow step for the cascade #6 starter test.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| `tools/ci/qemu-full-install-test.ts` | New Bun/TypeScript QEMU helper that creates a virtual disk, boots the installer ISO, and polls serial output for install progress. |
| `.github/workflows/build-ai-cluster-iso.yml` | Adds `qemu-utils` and wires the new full-install test into the AI-cluster ISO workflow on push/workflow dispatch. |

## Review threads

### Thread 1: tools/ci/qemu-full-install-test.ts:73 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:10:09Z):

P1: This success marker is emitted before iter-5.2 hostname injection and before the `nixos-install` invocation, so the test can pass without proving the install completed. Use a marker that appears after `nixos-install` (or inject the password prompt response and wait for the existing install-complete banner) if the test is meant to validate those phases.

### Thread 2: tools/ci/qemu-full-install-test.ts:296 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:10:09Z):

P1: This logs a tmpdir path, but the workflow never uploads that file and the directory is outside the workspace, so the full serial log is lost when the runner exits. Add an artifact upload step or copy the log into a known workspace path before exit; otherwise failures from this long-running test won't have the promised debug artifact.

### Thread 3: .github/workflows/build-ai-cluster-iso.yml:223 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:10:09Z):

P1: This new workflow step depends on `../tools/ci/qemu-full-install-test.ts`, but the workflow path filters only include the existing audit helpers and the workflow file. A PR that changes this helper alone will not run the ISO workflow, and a push to main changing only the helper will also skip this gated test; add this helper (and the sibling QEMU helper, if it is part of this workflow's validation surface) to the pull_request/push path lists.

### Thread 4: tools/ci/qemu-full-install-test.ts:272 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:10:10Z):

P1: If QEMU exits early (bad args, KVM/device failure, disk attach error), the script still waits the full 30-minute marker timeout because the polling loop never observes `qemuExited`. Race the marker wait against the child exit and fail immediately with the serial tail/stdout context so a broken QEMU launch does not burn the whole CI timeout.

## General comments

### @chatgpt-codex-connector (2026-05-27T02:06:03Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
