---
pr_number: 5251
title: "fix(postmerge-5235): 3 Copilot findings + ISO workflow path-trigger"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:37:56Z"
merged_at: "2026-05-26T17:45:00Z"
closed_at: "2026-05-26T17:45:00Z"
head_ref: "otto-cli/postmerge-5235-fixfwd-3-copilot-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:31Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5251: fix(postmerge-5235): 3 Copilot findings + ISO workflow path-trigger

## PR description

## Summary

Post-merge fix-fwd on #5235 addressing 3 substantive Copilot findings + a workflow path-trigger issue that prevented the original #5235 fix from actually re-triggering the ISO build.

1. **\`dumpIsoEntriesForDiagnostic()\` reuses \`lsIso()\`** — was open-coding duplicate \`spawnSync(\"7z\", ...)\` missing sonarjs/no-os-command-from-path suppression + \`maxBuffer\` + \`r.error\` handling. Would break CI lint + truncate on large ISOs. Now single source of truth.
2. **\`DIAG_DUMP_LIMIT\` constant** — was hard-coded \"first 80\" in header text drift-risk vs the function's \`limit\` param. Now derived from one constant.
3. **081KSGS9H0008QG0R003SWZF9J nixpkgs link pinned to \`nixos-25.11\` branch** — was \`blob/master\` which drifts.
4. **Workflow paths include \`tools/ci/audit-installer-iso-content.ts\`** — was missing; #5235's fix-fwd didn't actually trigger the ISO build because the workflow's path filter only included \`tools/ci/audit-installer-substrate.ts\` (source audit), not the post-build content-audit script. THIS PR's commit fires the workflow + the diagnostic dump surfaces the actual 25.11 kernel/initrd paths.

## Test plan

- [ ] build-ai-cluster-iso fires on this PR (the actual test of fix #4)
- [ ] If audit fails, diagnostic dump shows entries
- [ ] CI lint passes on the refactored audit script
- [ ] BACKLOG.md drift clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T17:39:55Z)

## Pull request overview

Post-merge follow-up to #5235 to make the AI-cluster ISO build/audit workflow reliably retrigger and to harden the ISO-content audit’s diagnostic output against CI lint/log truncation issues.

**Changes:**

- Refactors `dumpIsoEntriesForDiagnostic()` to reuse `lsIso()` and derives the diagnostic dump limit from a single constant.
- Pins the 081KSGS9H0008QG0R003SWZF9J nixpkgs source link to `nixos-25.11` to avoid `master` drift.
- Expands the `build-ai-cluster-iso` workflow `paths` filter to include the ISO content audit script so changes to it retrigger builds.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/ci/audit-installer-iso-content.ts | Reuses `lsIso()` for diagnostics and centralizes the diagnostic dump limit. |
| docs/backlog/P2/081KSGS9H0008QG0R003SWZF9J-investigate-nixpkgs-25-11-iso-kernel-initrd-path-layout-tighten-audit-after-discovery-aaron-2026-05-26.md | Pins upstream nixpkgs reference link to the relevant release branch. |
| .github/workflows/build-ai-cluster-iso.yml | Adds the ISO-content audit script to workflow path triggers for PRs/pushes. |

## Review threads

### Thread 1: tools/ci/audit-installer-iso-content.ts:350 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:39:55Z):

The diagnostic dump prints `lsIso()` entry paths verbatim, but `auditIsoContent()` normalizes paths by stripping leading `/` (see entryByPath normalization). If 7z outputs leading slashes on some versions, the dump may show `/boot/...` while failures report `boot/...`, making the dump harder to use. Consider applying the same normalization (strip leading `/`) here so diagnostic output matches the audit’s path expectations.

### Thread 2: tools/ci/audit-installer-iso-content.ts:343 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:39:55Z):

The comment mentions “non-PATH-pinned 7z”, but `lsIso()` deliberately relies on `7z` being on PATH (with a sonarjs suppression). That wording reads contradictory and may confuse future maintainers about how `7z` is resolved. Consider rephrasing to explicitly say it is PATH-resolved (not absolute-path pinned) and why that’s acceptable here.

## General comments

### @chatgpt-codex-connector (2026-05-26T17:38:02Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
