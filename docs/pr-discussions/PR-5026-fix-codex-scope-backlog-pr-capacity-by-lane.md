---
pr_number: 5026
title: "fix(codex): scope backlog PR capacity by lane"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:09:16Z"
merged_at: "2026-05-25T23:32:19Z"
closed_at: "2026-05-25T23:32:19Z"
head_ref: "codex/lane-aware-pr-capacity"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5026: fix(codex): scope backlog PR capacity by lane

## PR description

## Summary

- scope Codex backlog runner PR capacity to Codex branch prefixes by default
- preserve explicit global counting via `--capacity-head-prefixes all` / `CODEX_BACKLOG_RUNNER_CAPACITY_HEAD_PREFIXES=all`
- report total open PR count separately so queue pressure remains visible

## Verification

- `/opt/homebrew/bin/bun test tools/backlog/codex-backlog-runner.test.ts`
- `/opt/homebrew/bin/bun .codex/bin/codex-backlog-runner.ts --max-open-prs 3 --capacity-head-prefixes all`

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T23:11:40Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `5f9435e6be`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:12:32Z)

## Pull request overview

This PR updates the Codex backlog runner’s PR-capacity gate so that, by default, “open PR capacity” is counted only for Codex-owned lanes (branch prefixes like `codex/`), while still allowing an explicit opt-out to global counting (`--capacity-head-prefixes all` / `CODEX_BACKLOG_RUNNER_CAPACITY_HEAD_PREFIXES=all`). It also surfaces the overall open-PR pressure separately from the lane-scoped capacity count.

**Changes:**

- Add `--capacity-head-prefixes` (and env var support) to scope capacity counting by head branch prefix, defaulting to `codex/`.
- Introduce `capacityPrCount(...)` and return both capacity-scoped and total open PR counts in runner output.
- Extend tests to cover the new capacity-scoping behavior.

### Reviewed changes

Copilot reviewed 1 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/backlog/codex-backlog-runner.test.ts | Adds unit tests for `capacityPrCount` to verify lane-scoped vs global counting. |
| .codex/bin/codex-backlog-runner.ts | Implements capacity scoping via head-prefix filtering, adds CLI/env parsing, and reports both scoped + total open PR counts. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:27:59Z)

## Pull request overview

Copilot reviewed 1 out of 2 changed files in this pull request and generated 2 comments.

## Review threads

### Thread 1: .codex/bin/codex-backlog-runner.ts:159 (resolved)

**@chatgpt-codex-connector** (2026-05-25T23:11:40Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove 200-item cap from PR capacity counting**

`openPrList` now queries `gh pr list` with `--limit 200`, and `capacityPrCount` uses that truncated list for gate decisions. Per the `gh pr list` manual, `--limit` is the “Maximum number of items to fetch,” so repositories with more than 200 open PRs will be undercounted and the runner can incorrectly enter `ready` and open additional work even when capacity is already full. This regresses the previous `openPrCount` path (`tools/github/poll-pr-gate-batch.ts --all-open`), which was designed to enumerate all open PRs via pagination.

Useful? React with 👍 / 👎.

### Thread 2: .codex/bin/codex-backlog-runner.ts:163 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:12:31Z):

P1: `openPrList` is capped at `--limit 200`, but `totalOpenPrCount` is reported as `openPrs.length` and described as “total”. If the repo ever has >200 open PRs, this will under-report total queue pressure and may omit PR-derived active-claim blockers beyond the first 200. Consider either paginating (e.g. GraphQL `--paginate`) or raising the limit to the maximum supported, or rename the field to reflect truncation.

### Thread 3: .codex/bin/codex-backlog-runner.ts:92 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:12:32Z):

P2: `parseCapacityHeadPrefixes` treats the special value `all` case-insensitively (via `toLowerCase()`), but the returned prefixes are not normalized, and `capacityPrCount` does a case-sensitive `startsWith`. A user passing `CODEX/` (or mixed case) will silently match nothing. Consider normalizing prefixes + `headRefName` consistently, or documenting that prefix matching is case-sensitive.

### Thread 4: .codex/bin/codex-backlog-runner.ts:159 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:27:58Z):

`isRecord` returns true for arrays, so `parseOpenPrListOutput` would silently accept a decoded JSON array row (unexpected shape) instead of failing fast. Consider tightening the guard to exclude arrays (e.g., `!Array.isArray(value)`) so malformed `gh api` output is detected deterministically.

### Thread 5: tools/backlog/codex-backlog-runner.test.ts:27 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:27:58Z):

The test fixture uses a named-person lane prefix (`lior/...`) in code. Per `.github/copilot-instructions.md` “No name attribution in code” convention, prefer a neutral/role-based prefix for non-codex examples (or reuse existing non-name prefixes like `backlog/`).

## General comments

### @chatgpt-codex-connector (2026-05-25T23:24:40Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-25T23:29:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
