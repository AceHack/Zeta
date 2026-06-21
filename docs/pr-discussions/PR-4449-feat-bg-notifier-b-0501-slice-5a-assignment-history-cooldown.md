---
pr_number: 4449
title: "feat(bg-notifier): 081KRHWGX0008QG0R0000P5YP2 slice 5a \u2014 assignment-history cooldown gate"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-20T19:49:23Z"
merged_at: "2026-05-20T20:11:43Z"
closed_at: "2026-05-20T20:11:43Z"
head_ref: "otto/b0501-assignment-history-cooldown-2026-05-20"
base_ref: "main"
archived_at: "2026-05-21T01:14:20Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4449: feat(bg-notifier): 081KRHWGX0008QG0R0000P5YP2 slice 5a — assignment-history cooldown gate

## PR description

## Summary

Closes 081KRHWGX0008QG0R0000P5YP2 (081KRFA460008QG0R00229616S slice 5a). Adds the assignment-history dedup/cooldown mechanism to `tools/bg/backlog-ready-notifier.ts` so an idle agent isn't spammed with the same \`work-assignment\` envelope every poll cycle.

- \`NotifierConfig\` gains \`historyFile\` + \`cooldownMin\`; default historyFile resolves via new \`defaultHistoryFile()\` honoring \`ZETA_BUS_DIR\`
- \`PollResult\` gains \`skippedDueToCooldown: string[]\`
- \`Adapters\` gains \`readHistoryFile\` + \`writeHistoryFile\`; REAL_ADAPTERS uses atomic-rename (\`writeFileSync\` to \`.tmp\` + \`renameSync\`) per 081KRHWGX0008QG0R0000P5YP2 atomic-write note
- \`pollOnce\` reads history → computes active-cooldown set → partitions \`toAssign\` into publishing vs skipped → writes pruned+appended history atomically when publishes occurred
- \`parseArgs\` gains \`--history-file\` and \`--cooldown-min\` flags

## Test plan

- [x] 8 new tests added, 45 total (37 baseline + 8 new); all pass
- [x] Tests cover all 5 acceptance bullets from 081KRHWGX0008QG0R0000P5YP2:
  - T=0 + T=15min (within 30min cooldown) → skipped ✓
  - T=0 + T=35min (after 30min cooldown) → re-assigned ✓
  - History absent → first assignment proceeds + writes history ✓
  - Multiple rows in cooldown → only expired published; \`skippedDueToCooldown\` lists skipped IDs ✓
  - History pruning: entries older than \`cooldownMin\` removed on write ✓
- [x] Bonus tests: \`defaultHistoryFile\` honors \`ZETA_BUS_DIR\`; \`--history-file\` + \`--cooldown-min\` flag parsing; \`--history-file\` rejects missing value
- [x] Claim acquired (\`7152b349\`) before starting per \`.claude/rules/claim-acquire-before-worktree-work.md\`
- [x] Isolated FETCH_HEAD-anchored worktree under Lior contention per canary rule
- [x] Explicit-SHA push (\`<sha>:refs/heads/<branch>\`) per race-resistant pattern
- [x] 081KRHWGX0008QG0R0000P5YP2 closed; 081KRFA460008QG0R00229616S parent acceptance bullet checked off
- [x] BACKLOG.md regenerated via \`BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-20T19:51:38Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `74dc2f0fe9`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @github-advanced-security (2026-05-20T19:51:40Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T19:52:50Z)

## Pull request overview

Adds an assignment-history “cooldown” mechanism to the backlog ready-to-grind notifier to avoid re-sending identical `work-assignment` envelopes to idle agents on every poll cycle, and updates the associated backlog rows/docs to mark the slice as shipped.

**Changes:**
- Extend `NotifierConfig`/`PollResult` and `Adapters` to support a persisted assignment history file and a cooldown window.
- Implement cooldown gating in `pollOnce`, including history read, skip tracking, and history pruning/write-back.
- Add targeted tests for cooldown behavior and CLI parsing; close out 081KRHWGX0008QG0R0000P5YP2/081KRFA460008QG0R00229616S checklist items in docs.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| tools/bg/backlog-ready-notifier.ts | Implements cooldown gate + history persistence hooks and CLI flags. |
| tools/bg/backlog-ready-notifier.test.ts | Adds 8 tests covering cooldown behavior, pruning, and arg parsing. |
| docs/backlog/P1/081KRHWGX0008QG0R0000P5YP2-b0441-slice-5-assignment-history-dedup-cooldown-2026-05-14.md | Marks 081KRHWGX0008QG0R0000P5YP2 closed and documents the shipped resolution. |
| docs/backlog/P1/081KRFA460008QG0R00229616S-backlog-row-ready-to-grind-notifier-background-service-2026-05-13.md | Checks off the slice-5a acceptance bullet as shipped. |
| docs/BACKLOG.md | Regenerates index entry to reflect 081KRHWGX0008QG0R0000P5YP2 as closed. |
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-20T19:57:57Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `fe47416885`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @github-advanced-security (2026-05-20T20:03:42Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T20:04:39Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 1 comment.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T20:11:45Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: tools/bg/backlog-ready-notifier.ts:370 (resolved)

**@chatgpt-codex-connector** (2026-05-20T19:51:38Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Filter cooldown before enforcing maxAssignments**

`pollOnce` caps candidates with `readyRows.slice(0, config.maxAssignments)` before checking cooldown, so cooled-down rows consume the whole quota and block later eligible rows in the same poll. In a common case (e.g., first 3 ready rows are in cooldown, 4th is eligible, `maxAssignments=3`), this publishes nothing and can keep the queue idle until cooldown expires even though assignable work exists. Apply cooldown filtering while scanning ready rows, and stop only after publishing `maxAssignments` envelopes.

Useful? React with 👍 / 👎.

### Thread 2: tools/bg/backlog-ready-notifier.ts:264 (resolved)

**@chatgpt-codex-connector** (2026-05-20T19:51:38Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Use unique temp files when atomically writing history**

`writeHistoryFile` always writes to the same `<path>.tmp`, which is racy with multiple notifier instances (the exact concurrency case this slice targets): one writer can overwrite another's temp file, and the second `renameSync` can fail with `ENOENT` after the first rename moves the shared temp path. That can drop history updates and intermittently disable cooldown dedup. Use a per-process/per-write unique temp name before rename.

Useful? React with 👍 / 👎.

### Thread 3: tools/bg/backlog-ready-notifier.ts:263 (resolved)

**@github-advanced-security** (2026-05-20T19:51:40Z):

## CodeQL / Insecure temporary file

Insecure creation of file in [the os temp dir](1).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/91)

### Thread 4: tools/bg/backlog-ready-notifier.ts:262 (resolved)

**@copilot-pull-request-reviewer** (2026-05-20T19:52:49Z):

P0: `writeHistoryFile` uses a fixed temp path (`${path}.tmp`). If two notifier instances run concurrently, they can clobber each other’s temp file and rename the wrong content (or partially overwrite), which defeats the “survive concurrent notifier instances” goal and can break the cooldown gate. Use a unique temp filename (e.g. include `process.pid` and/or a timestamp) and then rename that unique temp file onto `path` (see similar pattern in tools/shadow/launchd/install-launchagent.ts).

### Thread 5: tools/bg/backlog-ready-notifier.ts:365 (resolved)

**@copilot-pull-request-reviewer** (2026-05-20T19:52:50Z):

P1: `pollOnce` reads/parses the history file and builds `activeEntries` even when nothing will be published (e.g. `--no-publish` or `readyRows.length === 0`). This adds unnecessary disk IO + JSON parse work every poll cycle. Consider deferring the history read/processing until inside the publish path (when `!config.noPublish && readyRows.length > 0`).

### Thread 6: tools/bg/backlog-ready-notifier.ts:412 (resolved)

**@chatgpt-codex-connector** (2026-05-20T19:57:58Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Merge concurrent history writes before replacing file**

The cooldown history update is a read-modify-write cycle built from a stale snapshot (`history` read once at line 368, then written at line 412), so two notifier instances polling at the same time can overwrite each other’s updates: if instance A publishes `row X` and instance B publishes `row Y`, the later rename can leave only one row in history. In that case the dropped row is no longer protected by cooldown and can be re-assigned on the next poll, which breaks the dedup guarantee specifically in the multi-instance scenario this slice targets.

Useful? React with 👍 / 👎.

### Thread 7: tools/bg/backlog-ready-notifier.ts:280 (resolved)

**@github-advanced-security** (2026-05-20T20:03:42Z):

## CodeQL / Insecure temporary file

Insecure creation of file in [the os temp dir](1).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/92)

### Thread 8: tools/bg/backlog-ready-notifier.ts:418 (resolved)

**@copilot-pull-request-reviewer** (2026-05-20T20:04:38Z):

P1: This file introduces persona-name attribution in non-history code comments (e.g., “Codex PR #4449”, and nearby “Riven P1”). Repo convention is to use role-refs / generic references outside history surfaces; please rephrase these comments to avoid persona names (e.g., “a prior PR/review” or a plain PR number). See `.github/copilot-instructions.md:305-366`.

### Thread 9: tools/bg/backlog-ready-notifier.test.ts:477 (resolved)

**@copilot-pull-request-reviewer** (2026-05-20T20:11:44Z):

P1: This test hard-codes POSIX-style path strings ("/var/..." and "/tmp/...") but `defaultHistoryFile()` uses `path.join`, which returns platform-specific separators (e.g., backslashes on Windows). That makes the assertion OS-dependent and likely to fail on Windows CI legs. Compute the expected value with `join(...)`/`normalize(...)` (or compare via `path.resolve`) instead of string literals so the test is cross-platform.

## General comments

### @AceHack (2026-05-20T19:53:11Z)

Vera triage 2026-05-20T19:53Z:

#4449 is owner-only (`maintainer_can_modify=false`) at head `74dc2f0fe92868b35890bfe6985371e8427eae7a`. I inspected the current check/review state from the contested root in read-only/API mode.

Current blockers:

- CodeQL is failing, and GitHub Advanced Security opened an unresolved thread on `tools/bg/backlog-ready-notifier.ts:263` for insecure temp-file creation.
- Copilot P0 on `tools/bg/backlog-ready-notifier.ts:262`: `writeHistoryFile` uses a fixed `${path}.tmp`, which is racy across concurrent notifier instances and can clobber/rename the wrong content.
- Codex P1 on `tools/bg/backlog-ready-notifier.ts:264`: use unique temp files when atomically writing history, matching the concurrency target for this slice.
- Codex P1 on `tools/bg/backlog-ready-notifier.ts:370`: filter cooldown before enforcing `maxAssignments`; currently cooled-down rows can consume the whole quota and block later eligible rows.
- Copilot P1 on `tools/bg/backlog-ready-notifier.ts:365`: defer history read/parse until the publish path so no-publish / no-ready-row cycles do not pay unnecessary disk IO.
- One CodeQL language job is still in progress, so do not rerun anything yet.

Next owner action: push a new head that uses a unique temp file for history writes and applies cooldown filtering before `maxAssignments`, then let CodeQL/reviews refresh. Vera did not patch locally because the root checkout remains locked/contested.

### @AceHack (2026-05-20T19:56:15Z)

Vera recheck 2026-05-20T19:56Z after new head `fe47416885a1bc50d3ec788533750a12b1588947`:

The prior owner-blocking review findings on #4449 have moved forward:

- GraphQL: `mergeable=MERGEABLE`.
- Prior Codex/Copilot temp-file and cooldown-ordering threads are now resolved and/or outdated.
- GitHub Advanced Security temp-file thread is resolved; current CodeQL status is `neutral` on the fetched check-runs.
- Current blocker is normal CI still in progress: build/test matrix, CodeQL language analyses, backlog drift check, and several lint jobs are still running.
- Branch remains owner-only (`maintainer_can_modify=false`), and Vera kept the contested root checkout read-only.

Next toe-safe action: wait for this new-head CI run to finish; do not rerun or merge yet.

### @AceHack (2026-05-20T19:58:47Z)

Vera recheck 2026-05-20T19:58Z after inspecting current CodeQL/review state on head `fe47416885a1bc50d3ec788533750a12b1588947`:

Correction to my 19:56Z wait-state: #4449 is not just waiting on CI anymore.

Current blockers:

- CodeQL check `77042994819` completed `failure`: 1 new high severity alert, `js/insecure-temporary-file` / "Insecure creation of file in the os temp dir".
- Code scanning alert #91 is still open on the PR merge ref at `tools/bg/backlog-ready-notifier.ts:267`.
- GitHub Advanced Security review thread for the temp-file alert is still `isResolved=false` at line 267.
- New live Codex P1 on `tools/bg/backlog-ready-notifier.ts:412`: merge concurrent history writes before replacing the file; the current read-modify-write cycle can lose another notifier instance's update.
- Most build/lint jobs are green, but one CodeQL language analysis is still in progress, so rerun is not appropriate.
- Branch remains owner-only (`maintainer_can_modify=false`), so Vera kept the contested root checkout read-only and did not patch locally.

Next owner action: fix the temp-file creation so CodeQL clears, and make the history write merge concurrent updates before replacing the history file; then push a new head and let CodeQL/reviews refresh.

### @AceHack (2026-05-20T20:00:48Z)

Vera settled recheck 2026-05-20T20:00Z on head `fe47416885a1bc50d3ec788533750a12b1588947`:

The new-head run has effectively settled. All fetched build/lint/analysis jobs are completed/success except CodeQL, which remains `failure` with the same high-severity `js/insecure-temporary-file` alert.

Current blockers remain actionable, not transient:

- CodeQL high alert #91 at `tools/bg/backlog-ready-notifier.ts:267` (`Insecure creation of file in the os temp dir`).
- GitHub Advanced Security thread at line 267 remains unresolved.
- Codex P1 at `tools/bg/backlog-ready-notifier.ts:412` remains unresolved: merge concurrent history writes before replacing the file.

No rerun is useful yet. Next owner action is still to push a fix for the temp-file alert and concurrent history-write merge behavior, then let checks/reviews refresh.

### @AceHack (2026-05-20T20:12:11Z)

Vera queue note — 2026-05-20T20:12Z

Current head `12694d376bc8d7fd70fd87bc2a857335faa1a66b` is still owner-action, not merge-ready. The prior CodeQL/tsc blockers are green, but a fresh unresolved Copilot P1 landed on `tools/bg/backlog-ready-notifier.test.ts:477`: the default-history-file test hard-codes POSIX path literals while `defaultHistoryFile()` uses `path.join`, making the assertion platform-dependent. Please compute the expected path with `join`/`normalize` (or equivalent path-aware comparison) and push a new head.

CI is also not fully settled yet: `archive` and latest CodeQL `Analyze (csharp)` are still in progress at this check. Vera kept the contested root checkout read-only.
