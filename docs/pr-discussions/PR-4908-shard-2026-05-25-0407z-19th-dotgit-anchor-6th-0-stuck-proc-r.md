---
pr_number: 4908
title: "shard(2026-05-25/0407Z): 19th dotgit anchor \u2014 6th 0-stuck-proc reading + first >1h cadence gap"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T04:11:56Z"
merged_at: "2026-05-25T04:20:07Z"
closed_at: "2026-05-25T04:20:07Z"
head_ref: "otto-cli/0407z-shard-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:51:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4908: shard(2026-05-25/0407Z): 19th dotgit anchor — 6th 0-stuck-proc reading + first >1h cadence gap

## PR description

## Summary

19th dotgit-saturation anchor at 2026-05-25T04:07Z — **6th consecutive 0-stuck-proc reading** across three independent surfaces (otto-cli, otto-vscode bg-worker, otto-bg-worker). Extends the 0243Z anchor #18 by +1h24min — **first >1h cadence gap since the recovery arc began** at 0008Z (prior 4 anchors had ~30-57min gaps). Possibility A (genuine recovery) now operationally robust across both short and longer cadence.

Also names two additional observations:

- **Cold-boot-on-peer-branch failure mode** — 6th empirical anchor (this session landed on `lior-pr-preservation-rebased`); mitigated via isolated worktree off `origin/main` per [`refresh-world-model-poll-pr-gate.md`](.claude/rules/refresh-world-model-poll-pr-gate.md) and [`claim-acquire-before-worktree-work.md`](.claude/rules/claim-acquire-before-worktree-work.md).
- **ls-tree floor drift to 57** (was 53 in canonical canary-rule anchors); `infra/`, `.kiro/`, and other infra-PR additions account for the +4. The canary's `expected - 2` arithmetic remains correct against current main; just naming the drift.

## Test plan

- [x] post-creation freshness guard passed (ls-tree=57, status=0)
- [x] branch-guard verified immediately before commit
- [x] post-commit canary OK (parent=57, HEAD=57)
- [x] push succeeded (timeout-wrapped per 081KRW63S0008QG0R000EAZ9K2 discipline)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T04:13:43Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6b574293f7`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T04:14:09Z)

## Pull request overview

Adds a new hygiene-history tick shard documenting the 2026-05-25T04:07Z “dotgit-saturation” anchor (#19), including the 6th consecutive 0-stuck-proc reading across three surfaces and noting the first >1h cadence gap since the 0008Z arc began.

**Changes:**

- Add tick shard `0407Z.md` with current readings (stuck procs, peer procs, rate limits, origin/main HEAD, worktree freshness).
- Extend the anchor-series narrative to include the first >1h cadence gap and hypotheses for the gap.
- Record observations about the cold-boot-on-peer-branch failure mode and ls-tree floor drift.

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/25/0407Z.md:30 (resolved)

**@chatgpt-codex-connector** (2026-05-25T04:13:43Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct the rolling-window duration calculation**

The stated span `2026-05-23T10:18Z` to `2026-05-25T04:07Z` is **41h49m**, not `41h56min`; this introduces a factual error in the anchor summary and can mislead any downstream analysis that treats these shard durations as empirical evidence for cadence/recovery claims.

Useful? React with 👍 / 👎.

### Thread 2: docs/hygiene-history/ticks/2026/05/25/0407Z.md:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T04:14:08Z):

The markdown tables in this section have an extra leading pipe (`|| ...`) on each row, which creates an empty first column and renders inconsistently with the other tick shards (e.g., 0243Z uses single leading `|`). Remove the extra leading `|` so the table is `| Surface | Reading | ... |` / `|---|---|---|`.

### Thread 3: docs/hygiene-history/ticks/2026/05/25/0407Z.md:40 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T04:14:08Z):

This anchor-series table is formatted with double leading pipes (`||`) on each row, which adds a blank column and breaks consistency with the surrounding history shards. Use standard markdown table rows with a single leading `|` (and matching separator row).

### Thread 4: docs/hygiene-history/ticks/2026/05/25/0407Z.md:69 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T04:14:09Z):

The infra-cadence table also uses `||` at the start of each row; this renders as an extra empty column. Switch to standard markdown table formatting (`| SHA | PR | Author | Title |` etc.) to match other hygiene-history ticks.

### Thread 5: docs/hygiene-history/ticks/2026/05/25/0407Z.md:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T04:14:09Z):

This references “MEMORY.md” as if it were a file in the repo, but there is no repo-root `MEMORY.md` (the in-repo index is `memory/MEMORY.md`, and user-scope memory lives outside the repo). Consider disambiguating the reference (e.g., `memory/MEMORY.md` or explicitly “user-scope ~/.claude/.../memory/MEMORY.md”) so readers can actually locate the cited anchors.
