---
pr_number: 3783
title: "feat(081KRQ1AB0008QG0R003DYANMC slice 1): add --check flag to audit-backlog-status-drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T06:42:07Z"
merged_at: "2026-05-16T06:44:35Z"
closed_at: "2026-05-16T06:44:35Z"
head_ref: "feat/b0557-slice-check-mode-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T07:00:57Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3783: feat(081KRQ1AB0008QG0R003DYANMC slice 1): add --check flag to audit-backlog-status-drift

## PR description

## Summary

- Adds `--check` flag to the audit-backlog-status-drift tool (smallest of [081KRQ1AB0008QG0R003DYANMC](docs/backlog/P3/081KRQ1AB0008QG0R003DYANMC-audit-backlog-status-drift-quality-improvements-2026-05-16.md)'s 4 follow-up slices).
- When `--check` is set and drift candidates exist, exits with code 65 — allows CI/cron jobs to fail the build on detected drift.
- Default behaviour unchanged (always exit 0 in detect-only mode).

## Test plan

- [x] Manual: `bun tools/hygiene/audit-backlog-status-drift.ts --check` exits non-zero when candidates present
- [x] Manual: without `--check`, behaviour identical to prior
- [x] Help text + `KNOWN_FLAGS` set updated
- [ ] CI wire-up (separate slice — adds a GitHub Action that runs `--check`)

## Composes with

- [081KRQ1AB0008QG0R003DYANMC](docs/backlog/P3/081KRQ1AB0008QG0R003DYANMC-audit-backlog-status-drift-quality-improvements-2026-05-16.md) — parent row (4 follow-up slices)
- [081KRQ1AB0008QG0R000QYJFZE](docs/backlog/P3/081KRQ1AB0008QG0R000QYJFZE-audit-backlog-status-drift-detection-2026-05-16.md) — the audit-tool spec
- [PR #3758](https://github.com/Lucent-Financial-Group/Zeta/pull/3758) — original tool impl

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T06:46:02Z)

## Pull request overview

Adds a CI-oriented `--check` mode to the backlog status-drift auditor and records a related hygiene tick shard.

**Changes:**
- Adds `--check` flag validation, help text, and exit code 65 when drift candidates exist.
- Adds a 2026-05-16 hygiene-history tick shard documenting first real-world use of the auditor.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| `tools/hygiene/audit-backlog-status-drift.ts` | Adds `--check` CLI handling and CI failure exit behavior. |
| `docs/hygiene-history/ticks/2026/05/16/0638Z.md` | Adds a tick-history shard describing audit-tool usage and follow-up workflow. |


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**docs/hygiene-history/ticks/2026/05/16/0638Z.md:32**
* This workflow step says the 081KRHWGX0008QG0R0029WA0HQ row was closed and BACKLOG regenerated, but those changes are not present in this PR: 081KRHWGX0008QG0R0029WA0HQ remains open in its row file and in `docs/BACKLOG.md`. The shard should either include/land after the close-row update or avoid recording the close as completed.
```
5. **Close**: status: open → closed + Resolution section + BACKLOG.md regen
6. **Open PR**: [PR #3781](https://github.com/Lucent-Financial-Group/Zeta/pull/3781) + arm auto-merge
```
**docs/hygiene-history/ticks/2026/05/16/0638Z.md:53**
* This visibility signal repeats that 081KRHWGX0008QG0R0029WA0HQ was closed, but the reviewed tree still has 081KRHWGX0008QG0R0029WA0HQ open. That makes the new history shard inconsistent with the repository state unless the close-row PR is merged first.
```
- 081KRHWGX0008QG0R0029WA0HQ closed via PR #3781 (first real-world use of new audit tool; pure-drift confirmed)
```
</details>

## Review threads

### Thread 1: tools/hygiene/audit-backlog-status-drift.ts:284 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:46:01Z):

The new `--check` exit path is only manually tested. This tool already has `tools/hygiene/audit-backlog-status-drift.test.ts`, but it does not exercise CLI parsing or the 65/0 behavior for `--check`, so the CI-facing contract can regress without an automated failure.

### Thread 2: tools/hygiene/audit-backlog-status-drift.ts:267 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:46:01Z):

The script header still documents only `--json` usage and exit codes 0/64. With this added `--check` mode, the file-level invocation/exit-code documentation is now stale and omits the 65 CI failure contract.

### Thread 3: docs/hygiene-history/ticks/2026/05/16/0638Z.md:1 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:46:02Z):

This new tick shard starts with an H1, but the canonical shard schema requires the first line to be the single-row pipe record (`docs/hygiene-history/ticks/README.md:51-57`), and `tools/hygiene/check-tick-history-shard-schema.ts:52-104` validates that first non-empty line. Add the pipe-row header before the rich H1 body so new shards do not add to the known schema/practice drift tracked in 081KRMEXM0008QG0R002HBY56V.

### Thread 4: docs/hygiene-history/ticks/2026/05/16/0638Z.md:8 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:46:02Z):

This records 081KRHWGX0008QG0R0029WA0HQ as already closed via PR #3781, but in the reviewed tree 081KRHWGX0008QG0R0029WA0HQ is still `status: open` and `docs/BACKLOG.md` still lists it as open. If the close-row PR is a separate branch, this shard should not land before that PR or it will introduce historical/status drift.

This issue also appears in the following locations of the same file:
- line 31
- line 53

### Thread 5: tools/hygiene/audit-backlog-status-drift.ts:255 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T06:46:02Z):

The unknown-argument usage string omits the supported help flags even though `--help` and `-h` are accepted. Keeping the error usage in sync with the full help text avoids hiding the way to discover valid options after a typo.
