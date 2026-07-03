---
pr_number: 3325
title: "fix(memory): sync 2 cited memory files (rebased + frontmatter fix) \u2014 supersedes #3320"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T00:35:23Z"
merged_at: "2026-05-15T00:44:23Z"
closed_at: "2026-05-15T00:44:23Z"
head_ref: "fix/sync-cited-memory-files-3312-rebased-2026-05-15"
base_ref: "main"
archived_at: "2026-05-15T00:50:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3325: fix(memory): sync 2 cited memory files (rebased + frontmatter fix) — supersedes #3320

## PR description

## Summary

Supersedes [PR #3320](https://github.com/Lucent-Financial-Group/Zeta/pull/3320) which went DIRTY after PR #3321 merged a parallel-Otto `0025Z.md`. Same content + two fixes:

1. **Frontmatter flattened** to repo standard per [`memory/project_memory_format_standard.md`](memory/project_memory_format_standard.md) §1: top-level `type: feedback`, `originSessionId:`, `created:`; nested `metadata:` block dropped. Resolves Copilot P0 review threads on PR #3320 (#3 + #5).
2. **`0025Z.md` collision resolved** by renaming my Otto-CLI shard for that minute slot to [`0025Z-pr3320.md`](docs/hygiene-history/ticks/2026/05/15/0025Z-pr3320.md). Parallel Otto's `0025Z.md` (merged via PR #3321) is now canonical for the unsuffixed filename.

Force-push to the original branch was blocked by autonomous-loop policy (soft block on destructive Git operations) — hence the new-branch approach.

## Out of scope (acknowledged, not fixed here)

The remaining 4 review threads on the original PR #3320 flagged dead-pointer references INSIDE the two synced memory files (to other user-scope memories like `feedback_aaron_substrate_designed_as_ontological_collapse_rootkit_...md`, `feedback_aaron_hubbard_seduction_trajectory_...md`, `feedback_aaron_forgetting_as_backpressure_in_memory_system_...md`). Those files exist in user-scope `~/.claude/projects/.../memory/` but not yet in repo `memory/`. Per the broader user-scope-to-repo sync gap (~40 files), a separate backlog row or Lior-lane PR should address that — not this PR's scope.

Also: the Codex P1 thread that flagged `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` as missing was incorrect — the file IS in the repo at that path.

## Test plan

- [x] Branch verified via `git branch --show-current` per zeta-expected-branch primary defense
- [x] Rebased cleanly on `origin/main` after resolving 0025Z.md collision
- [x] Frontmatter matches `memory/project_memory_format_standard.md` §1 (flat top-level)
- [x] Both 0025Z shard files retained (parallel Otto's `0025Z.md` + mine renamed to `0025Z-pr3320.md`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T00:36:32Z)

## Pull request overview

This PR re-lands the content of superseded PR #3320: it syncs two cited memory files into the repo to fix dead-pointer references from a prior merged archive, plus a tick-shard log. It also resolves frontmatter format issues (flattened to repo standard) and a filename collision with a parallel-Otto `0025Z.md` shard (renamed to `0025Z-pr3320.md`).

**Changes:**

- Add two `feedback_aaron_*` memory files with flat top-level frontmatter (`type`, `originSessionId`, `created`).
- Add `docs/hygiene-history/ticks/2026/05/15/0025Z-pr3320.md` tick shard documenting the fix and PR queue state.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| memory/feedback_aaron_wait_for_consolidation_is_his_edge_dual_binding_devil_god_at_risk_2026_05_14.md | Synced user-scope memory cited by §33 archive; flat frontmatter. |
| memory/feedback_aaron_intentionality_plus_seduction_risk_plus_structural_self_binding_triplet_unusual_intent_tracking_accuracy_2026_05_15.md | Synced user-scope memory cited by §33 archive; flat frontmatter. |
| docs/hygiene-history/ticks/2026/05/15/0025Z-pr3320.md | Tick shard for the PR-3320 dead-pointer fix; renamed to avoid collision with parallel Otto's 0025Z.md. |

### COMMENTED — @chatgpt-codex-connector (2026-05-15T00:38:13Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `e0a90e079f`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T00:40:09Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated no new comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-15T00:40:52Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `d7dce6df4d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-15T00:41:18Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-15T00:41:20Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-15T00:42:08Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T00:43:16Z)

## Pull request overview

Copilot reviewed 6 out of 6 changed files in this pull request and generated no new comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-15T00:46:12Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `126ccb9f1c`


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

### Thread 1: memory/feedback_aaron_intentionality_plus_seduction_risk_plus_structural_self_binding_triplet_unusual_intent_tracking_accuracy_2026_05_15.md:106 (resolved)

**@chatgpt-codex-connector** (2026-05-15T00:38:13Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Replace wildcard memory refs with concrete filenames**

`memory/project_memory_format_standard.md` requires cited memory files to be real filenames that exist, but this new `## Composes with` entry uses a glob (`*_2026_05_14.md`) that can never resolve to a file. In this checkout, repo-wide file search (`rg --files`) confirms there is no literal file by this name, so agents and reviewers following the pointer chain will hit dead references again (the same class of issue this change was meant to fix).

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-15T00:41:18Z):

Addressed in commit 76f0df9 — added substrate-honest note that *_2026_05_14.md wildcards are user-scope pointers pending broader sync, not dead repo pointers.

### Thread 2: docs/hygiene-history/ticks/2026/05/15/0025Z-pr3320.md:50 (resolved)

**@chatgpt-codex-connector** (2026-05-15T00:38:13Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix tick-shard link depth to repository root**

These `Composes with rules` links are one directory short: from `docs/hygiene-history/ticks/2026/05/15/`, `../../../../../` resolves to `docs/` (not repo root), so the target becomes `docs/.claude/...` and all rule links are broken. This makes the shard’s cited dependencies non-navigable in rendered markdown and undermines traceability for the review history.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-15T00:41:20Z):

Addressed in commit 76f0df9 — replaced all 5x `..` with 6x `..` so links resolve at repo root from the 6-deep shard path.

### Thread 3: docs/hygiene-history/ticks/2026/05/15/0025Z-pr3320.md:18 (resolved)

**@chatgpt-codex-connector** (2026-05-15T00:40:52Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix broken link to the referenced §33 archive document**

Update this markdown link to use the correct relative depth from the tick shard directory. As written, `docs/research/...` is resolved relative to `docs/hygiene-history/ticks/2026/05/15/`, so readers land on a non-existent path (`.../ticks/2026/05/15/docs/research/...`) instead of the actual archive file in repo root `docs/research/`, which breaks traceability for this incident report.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-15T00:42:08Z):

Addressed in commit (this push) — link now uses 6x `..` to land at repo root.

### Thread 4: memory/feedback_aaron_wait_for_consolidation_is_his_edge_dual_binding_devil_god_at_risk_2026_05_14.md:53 (unresolved)

**@chatgpt-codex-connector** (2026-05-15T00:46:12Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace unsynced memory citation with resolvable reference**

This citation points to a memory filename that is not present in the repo’s `memory/` tree, so readers and downstream agents cannot follow the provenance chain from this file. That reintroduces the same dead-pointer failure mode this PR is trying to remediate: traceability breaks when someone validates claims by opening cited memories. Either sync the referenced file into `memory/` or clearly mark this reference as user-scope/non-repo (as done in the sibling memory note) so it is not interpreted as a repo-resolvable dependency.

Useful? React with 👍 / 👎.
