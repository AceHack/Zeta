---
pr_number: 5365
title: "ci(081KSGS9H0008QG0R0011BC7T2 layer-1): extend audit-installer-substrate with iter-5.4 sentinels"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T00:41:12Z"
merged_at: "2026-05-27T00:59:02Z"
closed_at: "2026-05-27T00:59:02Z"
head_ref: "ci-layer1-iter54-sentinels-audit-installer-substrate-otto-cli-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:59Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5365: ci(081KSGS9H0008QG0R0011BC7T2 layer-1): extend audit-installer-substrate with iter-5.4 sentinels

## PR description

## Layer 1 of 4-layer CI testing approach for iter-5.4 substrate

Aaron asked: *"yeah push forward a bit maybe create some more ci tests how do you want to test the gh login flow?"*

The 4-layer plan:

| Layer | Approach | Cost | Catches |
|---|---|---|---|
| **Layer 1 (THIS PR)** | Source-level sentinel audit | Seconds | Substrate regression (text-level) |
| Layer 2 (next PR) | Behavioral test with mock \`gh\` shim on PATH | ~1s | Conditional-logic regression |
| Layer 3 ([081KSGS9H0008QG0R003JNSVR5](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/backlog/P1/081KSGS9H0008QG0R003JNSVR5-installer-interactive-login-vs-baked-in-keys-ci-test-tension-resolve-without-shipping-credentials-aaron-2026-05-26.md) Approach A) | Mock GH device-code endpoint | ~10s | Real interactive-login flow without humans |
| Layer 4 ([081KSGS9H0008QG0R0011BC7T2](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/backlog/P1/081KSGS9H0008QG0R0011BC7T2-ci-cascade-6-full-install-plus-cluster-auto-join-eliminate-routine-human-physical-usb-test-aaron-2026-05-26.md) cascade #6) | QEMU full-install + cluster auto-join | Minutes | End-to-end including reboot + ArgoCD |

## What this PR adds

Extends \`REQUIRED_SENTINELS\` for \`full-ai-cluster/usb-nixos-installer/zeta-install.sh\` with 14 new substrings:

### (a) iter-5.4 flow anchors

- \`Step 6.8: iter-5.4.0 homelab gh-auth + operator pubkey copy\`
- \`Step 6.9: iter-5.4.1 self-registration commit+push\`
- \`gh auth login\`
- \`gh ssh-key list\`
- \`gh repo clone Lucent-Financial-Group/Zeta\`

### (b) Bug 2a + 2b fix-regression catches (PR #5364)

- \`gh auth setup-git\` — Bug 2a fix
- \`SSH_KEY_ERR_FILE\` — Bug 2b stderr capture
- \`admin:public_key\` — Bug 2b scope-recovery guidance

### (c) ClusterNode YAML schema sentinels (PR #5352 Copilot findings)

- \`apiVersion: zeta.lucent-financial-group.com/v1\`
- \`kind: ClusterNode\`
- \`  roles:\` — spec.roles is ARRAY (was scalar spec.role)
- \`  registration:\` — spec.registration block (was spec.maintainer flat)
- \`  hardware:\` — spec.hardware block (storage was sibling)

### (d) Hardware-probe sentinels (MAC parsing regression catch)

- \`/proc/cpuinfo\` — CPU_MODEL extraction
- \`link/ether\` — MAC parses field AFTER link/ether

### (e) Self-reg branch shape

- \`register-\${NODE_HOSTNAME}-\` — iter-5.4.1 branch name pattern

## Verified

\`\`\`
\$ bun tools/ci/audit-installer-substrate.ts
audit-installer-substrate: PASS — 10 required files + 5 sentinel-file assertions OK
\`\`\`

Runs in the existing \`build-ai-cluster-iso.yml\` workflow on every PR touching the installer surface.

## Composes with

- PR #5364 (Bug 2a + 2b fixes — this audit catches removal)
- PR #5352 (iter-5.4.1 Copilot YAML schema findings — this audit catches regression)
- 081KSGS9H0008QG0R0011BC7T2 (cascade #6 full-install QEMU; this is layer 1)
- 081KSGS9H0008QG0R003JNSVR5 (interactive-login vs baked-in-keys; layer 3 of cascade)

## Substrate-honest framing

Layer 1 doesn't test BEHAVIOR — only that the substrate is PRESENT. A future Aaron-edit that accidentally removes \`gh auth setup-git\` would be caught by this layer; an edit that changes \`gh auth setup-git\` to \`gh auth setup-git --hostname github.com\` would still pass (substring match). Layer 2 (mock-gh shim) catches behavioral regressions; this layer is the cheapest first line of defense.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T00:43:07Z)

## Pull request overview

Extends the source-level CI sentinel audit for the AI-cluster installer substrate to cover the iter-5.4.0/5.4.1 GitHub auth + self-registration flows, so text-level regressions (dropped commands / dropped YAML schema anchors) are caught quickly in CI.

**Changes:**

- Added iter-5.4 sentinel substrings for `zeta-install.sh` covering gh auth, ssh-key retrieval, repo clone, and registration-branch shape.
- Added schema/hardware-probe sentinels to catch regressions in ClusterNode YAML composition and MAC parsing.
- Updated the sentinel rationale string to reflect the newly-audited substrate.

## Review threads

### Thread 1: tools/ci/audit-installer-substrate.ts:100 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:43:07Z):

The comment starting "iter-5.4.1 YAML schema sentinels" is missing a closing ")" on the first line, which makes the sentence read as unfinished. Please close the parenthesis and/or reflow the comment so it’s a complete sentence.

## General comments

### @chatgpt-codex-connector (2026-05-27T00:41:17Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
