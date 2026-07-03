---
pr_number: 5214
title: "fix(postmerge-5210): 5 Copilot findings \u2014 prompt copy + comment accuracy + path + banner-password truth + sk-* FIDO key support"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:26:34Z"
merged_at: "2026-05-26T16:29:19Z"
closed_at: "2026-05-26T16:29:19Z"
head_ref: "otto-cli/postmerge-5210-fixfwd-5-copilot-findings-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:21Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5214: fix(postmerge-5210): 5 Copilot findings — prompt copy + comment accuracy + path + banner-password truth + sk-* FIDO key support

## PR description

## Summary

Addresses all 5 Copilot post-merge findings on #5210 (iter-5.4.0 just landed at e30b567e6). All 5 substantive; all real:

| # | Pri | Finding | Fix |
|---|---|---|---|
| 1 | P0 | Prompt copy "Press Enter to skip" but default is Y → Enter runs gh-auth | Rewrote copy to match `[Y/n]` default-Y behavior |
| 2 | P1 | Comment claims "NOT skippable if iter-4.2 also failed" but impl always allows skip | Rewrote comment to reflect reality (always-skippable + warning) |
| 3 | P2 | Warning references `usb-nixos-installer/...` missing `full-ai-cluster/` prefix | Path corrected |
| 4 | P1 | Banner always prints `password: zeta-change-me` but iter-5.3 lets operator customize | Conditional banner: reads /mnt/etc/zeta/initial-hashedpassword existence |
| 5 | P1 | `isKeyLine` only accepts ssh- + ecdsa-, silently drops sk-* FIDO/U2F keys GitHub stores | Refactored to validPrefixes list including `sk-ssh-` + `sk-ecdsa-` per existing operator-ssh-keys.nix parity |

## Substrate-honest note

Findings #5 (sk-* FIDO) is operationally load-bearing — operators with security-key-only GitHub setups would have had ALL their keys silently dropped. The existing operator-ssh-keys.nix module explicitly documents sk-* support; verifying that BEFORE authoring this fix (per the verify-existing-substrate-before-authoring rule landed today via #5131) caught the parity gap.

Auto-merge armed; threads resolved on #5210.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:29:26Z)

## Pull request overview

This PR addresses the post-merge findings from #5210 by aligning installer UX copy with actual default behavior, fixing a referenced path in warnings, making the install-complete credential banner reflect the iter-5.3 password outcome, and ensuring operator key ingestion supports `sk-*` (FIDO/U2F) SSH key types.

**Changes:**

- Update `zeta-install.sh` prompts/comments to match `[Y/n]` default-YES behavior and correct the referenced configuration path.
- Make the install-complete banner conditional on whether an operator-provided initial password hash was written.
- Expand key-prefix filtering in the operator key ingestion module to include `sk-ssh-` and `sk-ecdsa-`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Fixes gh-auth prompt/copy behavior and updates install banner to reflect actual password injection state. |
| full-ai-cluster/nixos/modules/operator-authorized-keys.nix | Extends supported SSH key prefixes to include `sk-*` security-key-backed keys. |

## General comments

### @chatgpt-codex-connector (2026-05-26T16:26:40Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
