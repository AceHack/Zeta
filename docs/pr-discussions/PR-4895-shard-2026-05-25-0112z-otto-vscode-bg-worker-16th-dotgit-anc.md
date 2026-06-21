---
pr_number: 4895
title: "shard(2026-05-25/0112Z): otto-vscode bg-worker \u2014 16th dotgit anchor (3rd consecutive 0 stuck procs) + Lior idle"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T01:15:24Z"
merged_at: "2026-05-25T01:47:00Z"
closed_at: "2026-05-25T01:47:00Z"
head_ref: "shard/tick-0112z-otto-vscode-bg-worker-16th-dotgit-anchor-3rd-consecutive-clean-lior-idle-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:53:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4895: shard(2026-05-25/0112Z): otto-vscode bg-worker — 16th dotgit anchor (3rd consecutive 0 stuck procs) + Lior idle

## PR description

## Summary

- 16th dotgit-saturation anchor — **3rd consecutive 0-stuck-proc reading** (anchors #14/15/16); shifts [`default-to-both`](../../.claude/rules/default-to-both.md) A/B discrimination weight toward Possibility A (genuine recovery), still not closure (N=3 small)
- Lior state change: **2 procs (active at 0042Z) → 0 procs (idle at 0112Z)**; consistent with normal Lior loop cadence (work-batch + between-cycle quiet), NOT a Lior-side incident
- Open PR pile: 60 → 62 (Lior added 2 before going idle, both non-`lior-*`-prefixed); Lior-lane share dropped 90% → 87% as denominator-effect only
- Bg-worker scope discipline carried forward: emit visibility shard; leave Lior's lane alone; the 24-thread empirical FP check from 0042Z (0% FP rate across #4768/#4781/#4786) stands

## Test plan

- [x] `.claude/rules/tick-must-never-stop.md` — sentinel `47ff6934` re-armed at catch-43 fire (empty `CronList` at session start)
- [x] `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` — post-commit canary: parent tree=55, HEAD tree=55, +1 file
- [x] `.claude/rules/zeta-expected-branch.md` — `git branch --show-current` guard ✓ before commit
- [x] No 081KRW63S0008QG0R000EAZ9K2 silent-push-failure — remote ref `240cbe74` matches local HEAD verified via `git ls-remote`
- [x] Lineage continues 2026-05-24 1607Z→2206Z + 2026-05-25 0008Z→0042Z (cross-linked in shard composes-with section)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T01:16:54Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `240cbe7445`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T01:18:18Z)

## Pull request overview

Adds a new hygiene-history tick shard for 2026-05-25 01:12Z to record dotgit-saturation anchor #16 observations (third consecutive 0-stuck-proc reading) and the concurrent “Lior went idle” snapshot, with cross-links to prior shards and relevant `.claude/rules/*` substrate.

**Changes:**
- Add `0112Z` tick shard capturing observed metrics (PR counts, worktree count, rate limits, proc readings) and anchor-table update.
- Extend the dotgit-saturation “A/B discrimination” narrative with a third reading and “composes-with” cross-references.

### COMMENTED — @AceHack (2026-05-25T01:45:33Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T01:45:36Z)

_(no body)_

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/25/0112Z.md:51 (resolved)

**@chatgpt-codex-connector** (2026-05-25T01:16:55Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct the inferred new PR IDs**

This line infers that the two PRs added between 0042Z and 0112Z were `#4890` and `#4891`, but the same shard already states those IDs were part of the unchanged 0042Z non-`lior-*` set; this creates an internal contradiction in the audit record. Because these tick shards are used as substrate for later lane-share and trend analysis, misattributing which PRs were newly introduced can skew downstream reasoning and should be replaced with verified IDs (or left explicitly unknown).

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T01:45:33Z):

Fixed in commit a6127c7. The speculative inference was wrong: #4890 + #4891 are in the 0042Z baseline non-`lior-*` set (line 49), so they cannot also be the 2 newly-added PRs between 0042Z and 0112Z. The speculation has been explicitly withdrawn in-line (substrate-honest retraction preserves the failure-trail per substrate-or-it-didn't-happen); actual ID verification deferred to the next anchor as originally framed. Thanks for the catch.

### Thread 2: docs/hygiene-history/ticks/2026/05/25/0112Z.md:51 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T01:18:18Z):

This line guesses the two newly added PRs as #4890 and #4891, but those PR numbers are already listed immediately above as part of the unchanged 0042Z non-`lior-*` set. That makes the shard internally inconsistent and risks misleading later readers.

**@AceHack** (2026-05-25T01:45:36Z):

Fixed in commit a6127c7. Same root cause as the sibling Codex thread on the same line: #4890 and #4891 are in the 0042Z baseline (line 49 of the shard), so cannot also be the newly-added 0042Z → 0112Z PRs. The wrong guess is explicitly withdrawn in-line rather than silently deleted (audit-trail preservation). Thanks.
