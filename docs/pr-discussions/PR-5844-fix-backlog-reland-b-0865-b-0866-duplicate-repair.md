---
pr_number: 5844
title: "fix(backlog): reland B-0865/B-0866 duplicate repair"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T15:08:04Z"
merged_at: "2026-05-28T15:11:47Z"
closed_at: "2026-05-28T15:11:47Z"
head_ref: "claim/task-backlog-id-collision-b0865-b0866-reland-20260528"
base_ref: "main"
archived_at: "2026-05-28T15:46:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5844: fix(backlog): reland B-0865/B-0866 duplicate repair

## PR description

Fresh reland of the #5800 duplicate-ID repair from current origin/main after #5840 merged, avoiding force-push on the polluted local #5800 branch.

What changed:
- Move the CayleyDickson housekeeping row from B-0865 to B-0921.
- Move the KskAuthorization housekeeping row from B-0866 to B-0922.
- Update B-0913 triage notes and regenerate docs/BACKLOG.md.

Why B-0921/B-0922:
- Current main already uses B-0917, B-0918, B-0919, and B-0920.

Validation:
- bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids
- bun tools/backlog/generate-index.ts --check
- git diff --check

Supersedes #5800 as the no-force-push reland path.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T15:10:25Z)

## Pull request overview

Relands the backlog duplicate-ID repair by renumbering two housekeeping backlog rows off of the substantive B-0865/B-0866 items, updates the triage record (B-0913), and regenerates the generated backlog index so the ID-uniqueness audit passes again.

**Changes:**
- Renumber housekeeping rows to **B-0921** (CayleyDickson) and **B-0922** (KskAuthorization), preserving substantive **B-0865/B-0866** IDs.
- Update **B-0913** triage notes to record the executed repair and new destinations.
- Regenerate `docs/BACKLOG.md` to remove the duplicate entries and include B-0921/B-0922.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P3/B-0913-dup-id-triage-b0865-b0866-pre-existing-duplicates-on-origin-main-non-required-lint-failure-aaron-otto-2026-05-28.md | Records the executed renumber plan and post-repair destinations for the formerly-colliding rows. |
| docs/backlog/P2/B-0921-integrate-or-remove-unreferenced-cayleydickson.md | Updates the CayleyDickson housekeeping row’s `id`/header/metadata to the new unique ID. |
| docs/backlog/P2/B-0922-integrate-or-remove-unreferenced-kskauthorization.md | Updates the KskAuthorization housekeeping row’s `id`/header/metadata to the new unique ID. |
| docs/BACKLOG.md | Regenerated index removing the duplicate B-0865/B-0866 housekeeping entries and adding B-0921/B-0922. |

## General comments

### @chatgpt-codex-connector (2026-05-28T15:08:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
