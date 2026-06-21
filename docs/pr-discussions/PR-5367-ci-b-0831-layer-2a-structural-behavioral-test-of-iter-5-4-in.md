---
pr_number: 5367
title: "ci(081KSGS9H0008QG0R0011BC7T2 layer-2a): structural-behavioral test of iter-5.4 install flow"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T00:44:20Z"
merged_at: "2026-05-27T00:46:38Z"
closed_at: "2026-05-27T00:46:39Z"
head_ref: "ci-layer2-mock-gh-shim-iter54-behavioral-test-otto-cli-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5367: ci(081KSGS9H0008QG0R0011BC7T2 layer-2a): structural-behavioral test of iter-5.4 install flow

## PR description

## Layer 2a of 4-layer CI testing approach

Per Aaron's *"yes lets push all of those forward i'll test again in like 30 minutes are so but this is perfect"* — shipping the layers in parallel during Aaron's 3rd USB re-flash window.

| Layer | Approach | Status |
|---|---|---|
| Layer 1 | Source-level sentinel audit | #5365 (armed) |
| **Layer 2a (THIS PR)** | Structural-behavioral test (logical relationships) | here |
| Layer 2b | True mock-gh shim execution | future PR (needs iter-5.4 refactored to sourceable function) |
| Layer 3 | Mock GH device-code endpoint | 081KSGS9H0008QG0R003JNSVR5 Approach A |
| Layer 4 | QEMU full-install + cluster auto-join | 081KSGS9H0008QG0R0011BC7T2 cascade #6 |

## What this catches that Layer 1 doesn't

1. \`gh auth setup-git\` is INSIDE the auth-success branch (placement, not just presence)
2. setup-git is called BEFORE ssh-key fetch (ordering)
3. \`SSH_KEY_ERR_FILE\` is wired AS the stderr redirect to \`gh ssh-key list\` (not just declared)
4. 3 distinct WARN paths exist with their substrate-honest recovery messages
5. \`GH_AUTH_OK=1\` is set EXACTLY ONCE (only in success branch)
6. iter-5.4.1 self-reg is gated on \`GH_AUTH_OK = 1\`
7. iter-5.4.1 subshell uses \`set +e\` + \`|| true\` (Copilot finding on #5352)
8. ClusterNode YAML schema correctness (3 Copilot findings on #5352)
9. MAC parsing extracts field AFTER \`link/ether\`
10. Self-reg branch name shape matches \`register-<HOSTNAME>-<UTCTS>\`

## How it works

Parses \`zeta-install.sh\` as text; extracts iter-5.4.0 and iter-5.4.1 blocks by step-header boundaries; asserts regex relationships within each block. 23 tests, 35 expect() calls, ~150ms runtime.

\`\`\`
\$ bun test tools/ci/test-iter-54-install-flow.test.ts
 23 pass
 0 fail
 35 expect() calls
\`\`\`

Wired into \`.github/workflows/build-ai-cluster-iso.yml\` as fast preflight BEFORE the ~15-min Nix build.

## Layer 2b deferred

True mock-gh shim execution requires refactoring iter-5.4.0 + iter-5.4.1 into a sourceable bash function so we can mock \`gh\` on PATH and assert behavior across 4 modes (success/scope-error/empty/pipe-broke). That's a bigger refactor — separate PR. Structural-behavioral catches the same failure modes at much lower cost as the inner-loop test.

## Composes with

- PR #5364 (Bug 2a + 2b fixes — this asserts STRUCTURE not just presence)
- PR #5352 (Copilot YAML schema findings — this asserts schema corrections held)
- PR #5365 (Layer 1 sentinels — same workflow runs both)
- 081KSGS9H0008QG0R0011BC7T2 (cascade #6 full-install QEMU — this is layer 2a)
- 081KSGS9H0008QG0R003JNSVR5 (interactive-login vs baked-in-keys tension — layer 3 of cascade)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T00:44:24Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
