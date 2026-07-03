---
pr_number: 5426
title: "docs(081KSKBP80008QG0R002EKF67B closed): audit verifies PR #5389 Step 6.95a install.sh invocation PRESENT (zeta-install.sh:1097) + corrects 081KSKBP80008QG0R002J03WGA row body authoring error"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T08:03:47Z"
merged_at: "2026-05-27T08:09:56Z"
closed_at: "2026-05-27T08:09:56Z"
head_ref: "backlog/b-0857-1-audit-pr-5389-step-6-95a-verified-present-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:23:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5426: docs(081KSKBP80008QG0R002EKF67B closed): audit verifies PR #5389 Step 6.95a install.sh invocation PRESENT (zeta-install.sh:1097) + corrects 081KSKBP80008QG0R002J03WGA row body authoring error

## PR description

## Summary

081KSKBP80008QG0R002EKF67B sub-row audit (per 081KSKBP80008QG0R002J03WGA implementation order step 1: "audit current state"). Result: **PR #5389's commit-message claim VERIFIED PRESENT** at \`full-ai-cluster/usb-nixos-installer/zeta-install.sh:1097-1099\` (Step 6.95a-bootstrap). No drift; no repair needed.

## What the audit found

zeta-install.sh:1090-1100 contains the invocation:

\`\`\`bash
sudo HOME=\"$ZETA_HOME\" -u \"#$ZETA_UID\" \\
  bash -c \"cd $ZETA_HOME/Zeta && tools/setup/install.sh\"
\`\`\`

Dispatch chain: install.sh → linux.sh (detects /etc/NIXOS) → common/mise.sh (reads .mise.toml).

Extends GOVERNANCE §24 three-way-parity (dev + CI + devcontainer) to NixOS cluster nodes via the canonical entry.

## 081KSKBP80008QG0R002J03WGA row body correction

The 081KSKBP80008QG0R002J03WGA row body (#5423) claimed \"grep of current zeta-install.sh finds NO actual invocation.\" This was an authoring error — the grep produces 9 matches; line 1097 is load-bearing. The authoring step skipped the verify-by-grep that this audit sub-row commits to.

Row body now reads: \"Audit verified (081KSKBP80008QG0R002EKF67B, 2026-05-27): integration IS present at full-ai-cluster/usb-nixos-installer/zeta-install.sh:1097-1099 inside Step 6.95a-bootstrap; no drift; no repair needed.\"

This is a substrate-drift catch at sub-row audit scope (the audit found the row's own framing was the drift, not the integration substrate). Correction is additive per retraction-native discipline.

## Status

Closed at landing. No implementation work needed; substrate is correct.

## Test plan

- [x] grep confirms invocation at line 1097-1099
- [x] Single-tick small PR; bounded scope
- [x] ls-tree count canary clean (61 = 61)
- [x] Per .claude/rules/agent-worktree-hygiene-never-hold-main-...: isolated worktree; never touched operator's primary checkout
- [x] Per .claude/rules/non-coercion-invariant.md HC-8: substrate-honesty preserved
- [x] Per .claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md: verify-before-asserting discipline applied to the audit

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T08:04:53Z)

## Pull request overview

Documentation-only PR that adds a new closed P2 backlog sub-row (081KSKBP80008QG0R002EKF67B) recording the audit of PR #5389's integration claim, and corrects the parent 081KSKBP80008QG0R002J03WGA row body to reflect the verified-present state of the `tools/setup/install.sh` invocation in `zeta-install.sh`.

**Changes:**

- Adds new backlog row file `081KSKBP80008QG0R002EKF67B` (status: closed) documenting the audit result with grep-verified line references.
- Updates the parent `081KSKBP80008QG0R002J03WGA` row body to replace the inaccurate "grep finds NO actual invocation" claim with the audit-verified finding.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSKBP80008QG0R002EKF67B-audit-pr-5389-...md | New closed audit sub-row documenting verified-present integration at zeta-install.sh:1097-1099. |
| docs/backlog/P2/081KSKBP80008QG0R002J03WGA-install-sh-universal-unix-entry-...md | Corrects row body to reflect audit finding; updates substrate-honest framing. |

## General comments

### @chatgpt-codex-connector (2026-05-27T08:03:52Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
