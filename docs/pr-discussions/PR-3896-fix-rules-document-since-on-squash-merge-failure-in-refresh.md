---
pr_number: 3896
title: "fix(rules): document --since-on-squash-merge failure in refresh-world-model rule"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T15:24:24Z"
merged_at: "2026-05-16T15:26:25Z"
closed_at: "2026-05-16T15:26:25Z"
head_ref: "otto-cli-rule-since-squash-merge-2026-05-16-1517z"
base_ref: "main"
archived_at: "2026-05-16T16:20:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3896: fix(rules): document --since-on-squash-merge failure in refresh-world-model rule

## PR description

Substantive rule extension capturing today's 15:14Z empirical observation: \`git log origin/main --since=\"N min ago\"\` is the wrong query for recent merges.

## Empirical anchor

PR #3894 merged at 15:11Z. At 15:14Z:
- \`git log origin/main --since=\"20 min ago\"\` → EMPTY (PR invisible)
- \`git log origin/main --since=\"30 min ago\"\` → EMPTY (PR invisible)
- \`git log origin/main | head -3\` → shows #3894 at top ✓

## Root cause

Squash-merge collapses N commits authored hours/days ago into one commit. The squashed commit's **committer-date** matches the merge time, but its **author-date** (the field \`--since\` filters on) is preserved from the original authoring time. PRs squashed from older branches drop out of recent \`--since\` windows even though they just landed on main.

## Mitigation

Prefer \`git log origin/main | head -N\` for recent-merge queries. The \`head\` form sorts by topological / log order which IS merge-recency-correct. If a date filter is required, use \`--committer-date-order\` paired with explicit committer-date filtering.

## Composes with

The local-ref-staleness pattern (\`unable to update local ref\` wedge) documented elsewhere in the rule. Both fail in the same direction — make recent activity invisible to naive queries. Verification: \`git ls-remote origin main\` returns ground-truth SHA regardless of local ref state.

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-16T15:26:34Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `39dd02f394`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T15:27:31Z)

## Pull request overview

This PR updates the `refresh-world-model-poll-pr-gate` rule to document an observed failure mode where `git log origin/main --since="N min ago"` can miss recently squash-merged PRs, and to recommend safer “recent activity” queries during world-model refresh.

**Changes:**
- Adds a new rule section explaining why `git log --since=...` can hide recent squash merges.
- Recommends using `git log origin/main | head -N` (and related verification cues) for recent-merge checks.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**.claude/rules/refresh-world-model-poll-pr-gate.md:43**
* P1: The explanation mixes terms in a way that’s internally inconsistent: it says `--since` filters on “commit date” and then later says `--since` uses `author-date`. In Git, “commit date” is often interpreted as the committer timestamp (CommitDate), so this wording can mislead readers. Suggest rewording to consistently use “author date” vs “committer date” (and optionally point to `git log --pretty=fuller` fields) to make the claim unambiguous.
```
Empirical anchor 2026-05-16T15:14Z: a squash-merged PR (e.g., #3894 merged at 15:11Z) was invisible to `git log origin/main --since="20 min ago"` even though `git log origin/main | head -3` correctly showed it at the top. Root cause: `--since` filters on **commit date** (preserved from original authoring), not **merge date**. A squash-merge collapses N commits authored hours/days ago into one commit whose `committer-date` may match the merge but whose `author-date` (used by `--since`) is the original authoring time. PRs squashed from older branches drop out of "recent" `--since` windows even though they just landed.

```
**.claude/rules/refresh-world-model-poll-pr-gate.md:44**
* P1: The mitigation suggests using `--committer-date-order` “paired with explicit author/committer date selection,” but `--committer-date-order` only affects ordering, not which timestamp `--since`/`--until` filters on. Please clarify what exact approach should be used when a time window is required (e.g., whether to filter by committer date explicitly and how), or drop this sentence to avoid prescribing a non-working/unclear command pattern.
```
**Mitigation**: prefer `git log origin/main | head -N` over `git log origin/main --since="N min ago"` when checking recent merges. The `head` form sorts by topological / log order which IS merge-recency-correct. If a date filter is required, use `--committer-date-order` paired with explicit author/committer date selection.
```
</details>

## Review threads

### Thread 1: .claude/rules/refresh-world-model-poll-pr-gate.md:42 (unresolved)

**@chatgpt-codex-connector** (2026-05-16T15:26:34Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct incorrect `git log --since` semantics**

This section documents a false root cause: it says `--since` uses author date, but `git rev-list`/`git log` commit limiting is based on commit timestamp, and `--author-date-order` vs `--date-order` only changes ordering, not which commits pass the filter. In practice, a commit with an old author date but recent committer date is still returned by `--since`, so this guidance can mislead triage by blaming squash merges instead of the actual stale-ref/fetch issue and cause operators to distrust valid date-window queries.

Useful? React with 👍 / 👎.

### Thread 2: .claude/rules/refresh-world-model-poll-pr-gate.md:44 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T15:27:30Z):

P1: This new guidance conflicts with existing documentation that recommends `git log origin/main --since="<last-refresh-timestamp>"` as a “concrete query” for recent merges (docs/backlog/P1/081KQGDBJ0008QG0R003H0G5YQ-refresh-github-worldview-cross-cutting-claudeai-2026-05-01.md:381-385). To avoid truth-drift, either scope this warning more narrowly (e.g., only unreliable under squash-merge + old author dates) and/or add a note/link indicating the other doc should be updated to the safer query pattern.

This issue also appears in the following locations of the same file:
- line 42
- line 44
