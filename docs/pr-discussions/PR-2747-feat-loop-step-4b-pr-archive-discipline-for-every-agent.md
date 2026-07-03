---
pr_number: 2747
title: "feat(loop): step 4b \u2014 PR archive discipline for every agent"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-11T20:19:32Z"
merged_at: "2026-05-11T20:30:19Z"
closed_at: "2026-05-11T20:30:20Z"
head_ref: "feat/pr-archive-in-loop-pattern-2026-05-11"
base_ref: "main"
archived_at: "2026-05-11T21:19:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #2747: feat(loop): step 4b — PR archive discipline for every agent

## PR description

## Summary

- Adds step 4b to the autonomous loop checklist: archive newly merged PRs after committing tick work
- Every PR-creating agent runs the archive — BFT-redundant with Lior's Maji Watch backstop (PR #2745)
- Captures external tick sources (Copilot reviews, bot annotations, contributor comments) as git-native substrate
- Pattern: create → merge → archive → commit archive

## Test plan

- [ ] Verify step 4b doesn't conflict with existing steps 4 and 5
- [ ] Confirm `bun tools/pr-preservation/archive-pr.ts` still works standalone
- [ ] Lior's Maji Watch (PR #2745) is the companion implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-11T20:21:05Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `d20040a72b`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:23:21Z)

## Pull request overview

Adds a new “step 4b” to the autonomous loop checklist to ensure merged PR discussion threads are archived into the repo after tick work is committed, using the existing `tools/pr-preservation/archive-pr.ts` flow.

**Changes:**

- Document a new post-commit step to scan recent merged PRs and archive unarchived PR discussions.
- Add a suggested `gh pr list` + `bun tools/pr-preservation/archive-pr.ts` snippet to automate the check.
- Explain why PR discussion archives are treated as durable, git-native substrate.

## Review threads

### Thread 1: docs/AUTONOMOUS-LOOP.md:398 (resolved)

**@chatgpt-codex-connector** (2026-05-11T20:21:06Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Remove fixed 10-PR cap from archive sweep**

The new loop command hard-caps discovery to `gh pr list --state merged --limit 10`, so any unarchived merged PRs outside the newest 10 are never considered by this step. The `gh pr list` manual defines `--limit` as the maximum number of items fetched, which means a merge burst or a longer offline window can permanently skip older PR discussion archives and violate the stated preservation goal. Please paginate (or otherwise continue until no unarchived matches remain) instead of using a fixed top-10 window.

Useful? React with 👍 / 👎.

### Thread 2: docs/AUTONOMOUS-LOOP.md:394 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:23:20Z):

P1 (codebase convention): This section introduces persona-name attribution ("Lior") in a current-state operational doc. Per `.github/copilot-instructions.md:305-346`, non-history docs should use role-refs instead (e.g., “the Maji Watch background loop”) rather than persona names.

### Thread 3: docs/AUTONOMOUS-LOOP.md:409 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:23:20Z):

P1 (documentation/behavior mismatch): The prose says each agent archives “their own” PRs, but the command as written scans the latest merged PRs repo-wide and will archive any missing PR (including ones authored by other people/agents). Either adjust the wording, or filter the list (e.g., `gh pr list --author '@me' ...`) to match the stated responsibility model.

### Thread 4: docs/AUTONOMOUS-LOOP.md:428 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:23:21Z):

P1 (codebase convention): More persona-name attribution (“Lior”, “Otto”) is introduced here. Since `docs/AUTONOMOUS-LOOP.md` is not a history surface, replace these with role-refs per `.github/copilot-instructions.md:305-346` (e.g., “the Maji Watch loop” / “this loop checklist”).

### Thread 5: docs/AUTONOMOUS-LOOP.md:426 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:23:21Z):

P2 (workflow clarity): Step 4b is positioned “after committing tick work (step 4)”, but the pattern later says “archive → commit archive”. Consider explicitly stating that if new `docs/pr-discussions/PR-*.md` files are created, they should be committed as an additional (separate) commit before proceeding to step 5, or move 4b before step 4 so there’s a single commit step.
