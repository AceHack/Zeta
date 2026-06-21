---
pr_number: 5355
title: "fix(postmerge-5352): Copilot 5 findings \u2014 schema (roles/registration.maintainer/hardware.storage) + MAC parsing + subshell error handling + comment-name redaction"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:32:23Z"
merged_at: "2026-05-26T23:34:54Z"
closed_at: "2026-05-26T23:34:54Z"
head_ref: "otto/fix-pr-5352-copilot-5-findings-schema-mac-subshell-error-handling-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:25Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5355: fix(postmerge-5352): Copilot 5 findings — schema (roles/registration.maintainer/hardware.storage) + MAC parsing + subshell error handling + comment-name redaction

## PR description

## Summary

Fixes 5 legitimate Copilot findings on merged PR #5352 (iter-5.4.1 self-registration). All 5 are real bugs that would block end-to-end self-registration.

## 5 fixes

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | **CRITICAL** | Subshell + \`set -euo pipefail\` could kill installer on any git/gh failure | subshell-local \`set +e\` + outer \`\|\| true\` + explicit success/fail handling |
| 2 | P1 | MAC parsing wrong (\`$(NF-2)\` = \`brd\` not MAC) | parse field after \`link/ether\` correctly |
| 3 | P1 | Schema: \`spec.role\` should be \`spec.roles[]\` (array) per 081KSGS9H0008QG0R002K93MWX | nested array syntax |
| 4 | P1 | Schema: \`spec.maintainer\` should be \`spec.registration.maintainer\` per 081KSGS9H0008QG0R002QQNA79 | nested under \`spec.registration:\` with timestamp + flake-commit + flake-host siblings; also added metadata label |
| 5 | P1 | Schema: \`spec.storage\` should be \`spec.hardware.storage\` per 081KSGS9H0008QG0R002K93MWX | indented under hardware block (storage + network) |
| 6 | P2 | Name attribution \`maintainers/aaron/\` in comment | replaced with placeholder \`<operator>\` |

## Why CRITICAL #1 matters

Per the operator's CORE REQUIREMENT (081KSGS9H0008QG0R00120EEHM): post-boot fully-operational chain without operator login. If Step 6.9 aborts the installer (because of a transient gh-API failure OR scope issue), nixos-install NEVER RUNS and the install fails completely. Step 6.9 is documented warning-only/skippable; the subshell hazard made that documentation a lie.

## Schema source

- 081KSGS9H0008QG0R002K93MWX (iter-5.4.2 ArgoCD reconciliation) defines the CRD schema
- 081KSGS9H0008QG0R002QQNA79 (register-node.ts companion tool) explicitly places maintainer under \`spec.registration\` (K8s ObjectMeta has fixed shape; arbitrary spec fields silently dropped by API server)

## Test plan

- [x] Bash syntax OK (\`bash -n\` passes)
- [x] Subshell can no longer kill installer (set +e + || true defense-in-depth)
- [x] MAC extraction tested mentally: `link/ether aa:bb:cc:dd:ee:ff brd ff:ff:ff:ff:ff:ff` → `aa:bb:cc:dd:ee:ff` ✓
- [x] Schema matches 081KSGS9H0008QG0R002K93MWX + 081KSGS9H0008QG0R002QQNA79 (spec.roles[], spec.registration.maintainer, spec.hardware.{storage,network})
- [x] Maintainer label added to metadata for kubectl grouping
- [x] No name attribution in code

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T23:32:29Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
