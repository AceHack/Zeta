---
pr_number: 3716
title: "feat(hygiene): bundled pre-push self-check helper for tick shards"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T03:44:52Z"
merged_at: "2026-05-16T03:52:45Z"
closed_at: "2026-05-16T03:52:45Z"
head_ref: "feat/check-shard-before-push-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T03:59:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3716: feat(hygiene): bundled pre-push self-check helper for tick shards

## PR description

## What

`tools/hygiene/check-shard-before-push.ts` bundles three per-tick self-checks into one command:

1. **MD032** paragraph-immediately-followed-by-bullet (the awk-style scan I've been running per-tick)
2. **`markdownlint-cli2`** for the broad markdown lint surface (MD038 no-space-in-code + others)
3. **`audit-tick-shard-relative-paths`** detect-only mode on the input file

## Why

Today's tick 13 self-bite: an MD038 violation shipped to PR #3707 because I didn't run markdownlint before push. The required CI check failed and blocked merge for 70+ min (the markdownlint failure on the prior 0240Z fix, surfaced via tick 13). A bundled helper shortens the local-feedback loop from "push + wait for CI" to "single command + immediate output."

## Usage

```bash
bun tools/hygiene/check-shard-before-push.ts <shard-path>...
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed on all inputs |
| 1 | One or more checks failed (specific findings printed) |
| 64 | Argument error (missing file, non-file, no args) |

## Local verify

| Test | Result |
|------|--------|
| Clean shard (0334Z.md) | exit 0; all 3 checks ok |
| Bad shard (synthetic MD032 + MD038) | exit 1; specific findings printed |
| Missing file | exit 64 with `input not found` |
| No args | exit 64 with usage |
| `tsc --noEmit` | exit 0 |
| markdownlint on the helper itself | exit 0 |

## Scope

**DX helper, not a CI gate.** CI gates remain authoritative. This script just shortens the local-feedback loop.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T03:46:07Z)

## Pull request overview

> [!NOTE]
> Copilot was unable to run its full agentic suite in this review.

Adds a bundled pre-push self-check helper that runs MD032 scanning, markdownlint-cli2, and the relative-path audit on tick shard files to shorten the local feedback loop.

**Changes:**

- New TS tool `check-shard-before-push.ts` running three per-tick checks
- Validates input files exist and are regular files; exits 64 on arg errors
- Returns aggregated pass/fail status across all files

### COMMENTED — @chatgpt-codex-connector (2026-05-16T03:46:26Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `9151d6cef1`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-16T03:53:19Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `38c4b58f8c`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: tools/hygiene/check-shard-before-push.ts:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:46:06Z):

Relying on a substring match of stdout to determine success is fragile and can produce false positives or negatives. If the audit script's output format changes (e.g. wording tweak, color codes, prefix), this check silently breaks. Additionally, this ignores `r.status` entirely — a non-zero exit (e.g. crash, argument error, or future enforcement mode) where stdout doesn't contain that exact phrase will be reported as a generic "FAIL: relative-path audit" with no context. Prefer checking `r.status === 0` as the primary signal, and always echo stdout/stderr when failing so the user sees the underlying findings or error.

### Thread 2: tools/hygiene/check-shard-before-push.ts:95 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:46:06Z):

The MD032 trigger only fires on bullets starting with `- ` (line 72), but the structural-marker exclusion on line 74 treats lines starting with `*`, `-`, `|`, or `` ` `` as "structural" and skips them. This means a paragraph immediately followed by `- bullet` whose previous line is a table row (`|...`) or fenced code (` ``` `) is silently skipped — fine for code fences but a previous-line that's an unrelated `*` or `-` list item is also skipped, which is the correct behavior. However, `prev` being `|...` (table) and immediately followed by a `- bullet` is in fact an MD032 violation worth flagging. Consider documenting which markers are intentionally excluded and why, or narrowing the exclusion to actual list/heading/quote/code markers (e.g. require a space after `-`/`*` to treat as a list item).

### Thread 3: tools/hygiene/check-shard-before-push.ts:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:46:07Z):

The MD032 scan does not account for being inside a fenced code block. A `- ` line inside a ``` fence preceded by a non-blank line will be reported as an MD032 violation even though markdownlint correctly ignores it. This produces false positives on shards containing code samples. Track a `inFence` toggle on lines matching `^```` and skip detection while inside.

### Thread 4: tools/hygiene/check-shard-before-push.ts:124 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:46:07Z):

`parseArgs` calls `process.exit(64)` directly when argv is empty, which bypasses the declared return type and makes `main` non-testable for the no-args case. Since `main` already returns a typed exit code, prefer returning `64` from `parseArgs` (or throwing a typed error) and letting `main` decide whether to exit. This also matters because `main` is exported, suggesting it's intended to be callable from tests.

### Thread 5: tools/hygiene/check-shard-before-push.ts:107 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T03:46:07Z):

Both `runMarkdownlint` and `runRelativePathAudit` spawn `bun` once per file in a loop. For multi-file invocations this is N spawns each (2N total subprocess startups). `markdownlint-cli2` accepts multiple file arguments natively, and the audit script's `--files` flag likely does too — batching would significantly reduce wall-clock for multi-shard runs. Optional given this is a DX helper, but worth considering if multi-shard usage is expected.

### Thread 6: tools/hygiene/check-shard-before-push.ts:96 (resolved)

**@chatgpt-codex-connector** (2026-05-16T03:46:26Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Skip fenced code blocks in MD032 pre-check**

The custom `checkMd032` scan treats every line that starts with `- ` as a list item, but it does not track fenced code regions. In a shard that contains a code block like ```` ```\ntext\n- item\n``` ```` this helper reports `FAIL: MD032` even though `markdownlint-cli2` correctly ignores code fences. Because `main` fails when any sub-check fails, this creates false blocking results for valid files and undermines the script’s purpose as a reliable pre-push signal.

Useful? React with 👍 / 👎.

### Thread 7: tools/hygiene/check-shard-before-push.ts:95 (unresolved)

**@chatgpt-codex-connector** (2026-05-16T03:53:19Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Skip intra-list continuations in MD032 scan**

The custom `checkMd032` heuristic flags any `- ` line whose previous line is non-blank/non-structural, but that also matches valid multi-line list items (e.g., `- first` + indented continuation + `- second`). In that case `markdownlint-cli2` passes, yet this helper sets `anyFailed = true` and exits 1, creating false blocking results for normal shard formatting. Because this script is intended as a reliable pre-push signal, it should track whether the current bullet is a continuation of an existing list context before reporting MD032.

Useful? React with 👍 / 👎.
