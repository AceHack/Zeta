---
pr_number: 5382
title: "fix(postmerge #5379): qemu-full-install-test 4 Copilot P1 fixes \u2014 iter-5.1 marker (was pre-install) + artifact upload + trigger paths + early-exit race"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:13:09Z"
merged_at: "2026-05-27T02:17:02Z"
closed_at: "2026-05-27T02:17:02Z"
head_ref: "fix-postmerge-5379-qemu-full-install-test-iter-51-marker-artifact-upload-trigger-path-early-exit-race-otto-cli-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:47Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5382: fix(postmerge #5379): qemu-full-install-test 4 Copilot P1 fixes — iter-5.1 marker (was pre-install) + artifact upload + trigger paths + early-exit race

## PR description

## What

4 substantive Copilot findings on freshly-merged PR #5379. All P1; all legit substrate-engineering corrections.

## Fixes

### 1. SUCCESS_MARKER iter-5.3 → iter-5.1

Copilot was right: \`[iter-5.3]\` (zeta-install.sh:372) fires BEFORE the actual \`sudo nixos-install\` invocation (line 980). Test could pass without proving install completed.

\`[iter-5.1]\` (Step 6.7 wifi persistence at line 527) correctly comes AFTER:
- nixos-install
- iter-4.2 SSH pubkey
- iter-5.3 password (skipped gracefully in CI on empty stdin)
- iter-5.2 hostname injection

AND BEFORE:
- iter-5.4.0 gh auth prompt (which would hang in CI without 081KSGS9H0008QG0R003JNSVR5 mock device-code endpoint)

### 2. Workspace-relative serial log path

\`SERIAL_LOG_OUT_PATH\` env var lets workflow point log to \`\${{ github.workspace }}/qemu-full-install-serial.log\` so it survives test step.

### 3. Artifact upload step

\`actions/upload-artifact@v4.6.2\` (SHA-pinned) with \`if: always()\` so log survives even when test fails. 7-day retention.

### 4. Workflow trigger paths

Added missing trigger paths so PRs changing ONLY these helpers actually run the workflow:
- \`tools/ci/qemu-boot-test.ts\`
- \`tools/ci/qemu-full-install-test.ts\`
- \`tools/ci/test-iter-54-install-flow.test.ts\`

### 5. QEMU early-exit race (5th fix; same scope)

\`Promise.race\` between marker-wait and QEMU child-exit. If QEMU exits early (bad args / KVM failure / disk error), test fails immediately instead of waiting full 30min timeout.

## Security

\`github.workspace\` in \`env:\` block — GitHub-controlled value (expands to workspace path); no attacker-controllable interpolation in \`run:\` commands.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:14:20Z)

## Pull request overview

Addresses 5 P1 Copilot findings from freshly-merged PR #5379 for the QEMU full-install CI test: corrects the success marker to one that actually fires after `nixos-install`, ensures serial logs survive for artifact upload, expands workflow trigger paths, and adds a QEMU early-exit race to avoid the 30-min timeout when QEMU dies before the marker can appear.

**Changes:**
- Switch `SUCCESS_MARKER` from `[iter-5.3]` (pre-install) to `[iter-5.1]` (post-install, before gh auth prompt that would hang in CI).
- Make serial log path env-overridable (`SERIAL_LOG_OUT_PATH`) so the workflow can point it inside the workspace, and add an `actions/upload-artifact@v4.6.2` step (SHA-pinned, `if: always()`) plus extra trigger paths for the qemu helpers.
- Race the marker-wait against QEMU's `exit` event so early QEMU termination produces an immediate, descriptive failure instead of timing out.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| tools/ci/qemu-full-install-test.ts | Updates success marker comment+value, env-overrides serial log path, and adds Promise.race against QEMU early exit. |
| .github/workflows/build-ai-cluster-iso.yml | Adds qemu helper trigger paths to both pull_request and push filters, sets SERIAL_LOG_OUT_PATH env, and adds artifact-upload step. |

## General comments

### @chatgpt-codex-connector (2026-05-27T02:13:15Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
