---
pr_number: 3788
title: "feat(B-0557 slice 2): try/catch readFileSync + readdirSync in audit tool"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T06:49:38Z"
merged_at: "2026-05-16T07:18:48Z"
closed_at: "2026-05-16T07:18:48Z"
head_ref: "feat/b0557-slice-error-handling-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T08:10:17Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3788: feat(B-0557 slice 2): try/catch readFileSync + readdirSync in audit tool

## PR description

## Summary

- Addresses Copilot P1 finding from PR #3758: `enumerateOpenRows()` could throw and abort the whole audit on a single unreadable backlog file (permission denied, transient FS error, etc.).
- Fix: wrap both `readdirSync` and `readFileSync` in try/catch; warn to stderr; continue with remaining files.
- Bundles peer Otto-Desktop's tick shard `10fb6e5` (brief-ack extreme cost-aware tier substrate).

## Test plan

- [x] `bun test tools/hygiene/audit-backlog-status-drift.test.ts` → 16 pass / 0 fail / 28 expect calls (no regression)
- [x] `bun tools/hygiene/audit-backlog-status-drift.ts --json` still produces 33+ candidates from main
- [x] Stderr warnings clearly name the failed file(s) when triggered

## Composes with

- [B-0557](docs/backlog/P3/B-0557-audit-backlog-status-drift-quality-improvements-2026-05-16.md) — parent row (2 of 4 slices now in flight, plus PR #3783 for slice 1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T06:52:03Z)

## Pull request overview

Improves the resilience of the `audit-backlog-status-drift` hygiene tool by preventing filesystem read errors from aborting the entire audit run, and adds a new hygiene-history tick shard documenting related operational context.

**Changes:**
- Wraps `readdirSync` and `readFileSync` in `try/catch` inside `enumerateOpenRows()` to warn-and-continue on unreadable directories/files.
- Emits stderr warnings with the directory/file path and error message when reads fail.
- Adds a new `docs/hygiene-history/ticks/...` shard documenting the session tick.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/audit-backlog-status-drift.ts | Adds defensive error handling around directory and file reads to avoid aborting audits on a single unreadable entry. |
| docs/hygiene-history/ticks/2026/05/16/0644Z.md | Adds a new tick shard entry documenting the session state and related PR context. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/hygiene/audit-backlog-status-drift.ts:212**
* Same issue as above: casting `err as Error` risks losing information for non-`Error` throws. Use `err instanceof Error ? err.message : String(err)` for consistent, safe stderr output.
```
                process.stderr.write(
                    `audit-backlog-status-drift: unable to read ${path}: ${(err as Error).message}\n`,
                );
```
</details>

### COMMENTED — @AceHack (2026-05-16T07:01:48Z)

Lior Antigravity Check: Clean slice, good error boundaries. No blob detected.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T07:18:00Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: tools/hygiene/audit-backlog-status-drift.ts:198 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:52:02Z):

`err` is typed as `unknown` here, but the message formatting casts to `Error` (`(err as Error).message`). This can print `undefined` (or miss useful info) for non-`Error` throws. Prefer the repo’s existing pattern: `err instanceof Error ? err.message : String(err)` (optionally include `code` when present).

This issue also appears on line 210 of the same file.

### Thread 2: docs/hygiene-history/ticks/2026/05/16/0644Z.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:52:03Z):

This tick shard doesn’t follow the documented shard schema: `docs/hygiene-history/ticks/README.md` requires the first non-empty line to be a single-row `| <ISO timestamp> | ... |` table entry. Starting with an `# Tick ...` heading will fail existing shard validators/parsers that look at the first non-empty line. Consider adding the required pipe-row as the first line (and keep the prose below), or update the schema/tooling in the same PR if the format change is intentional.

## General comments

### @chatgpt-codex-connector (2026-05-16T06:49:42Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
