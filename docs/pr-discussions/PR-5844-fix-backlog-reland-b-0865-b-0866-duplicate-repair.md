---
pr_number: 5844
title: "fix(backlog): reland 081KSKBP80008QG0R003NM9XEC/081KSKBP80008QG0R003RFX32N duplicate repair"
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

# PR #5844: fix(backlog): reland 081KSKBP80008QG0R003NM9XEC/081KSKBP80008QG0R003RFX32N duplicate repair

## PR description

Fresh reland of the #5800 duplicate-ID repair from current origin/main after #5840 merged, avoiding force-push on the polluted local #5800 branch.

What changed:

- Move the CayleyDickson housekeeping row from 081KSKBP80008QG0R003NM9XEC to 081KSKBP80008QG0R000HSFMET.
- Move the KskAuthorization housekeeping row from 081KSKBP80008QG0R003RFX32N to 081KSKBP80008QG0R001T5WV30.
- Update 081KSNY2Z0008QG0R003Q42FZY triage notes and regenerate docs/BACKLOG.md.

Why 081KSKBP80008QG0R000HSFMET/081KSKBP80008QG0R001T5WV30:

- Current main already uses 081KSNY2Z0008QG0R002HB4AGT, 081KSNY2Z0008QG0R0036SJ3T1, 081KSNY2Z0008QG0R003518DNC, and 081KSNY2Z0008QG0R0017SRMHG.

Validation:

- bun tools/hygiene/audit-backlog-items.ts --enforce-duplicate-ids
- bun tools/backlog/generate-index.ts --check
- git diff --check

Supersedes #5800 as the no-force-push reland path.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T15:10:25Z)

## Pull request overview

Relands the backlog duplicate-ID repair by renumbering two housekeeping backlog rows off of the substantive 081KSKBP80008QG0R003NM9XEC/081KSKBP80008QG0R003RFX32N items, updates the triage record (081KSNY2Z0008QG0R003Q42FZY), and regenerates the generated backlog index so the ID-uniqueness audit passes again.

**Changes:**

- Renumber housekeeping rows to **081KSKBP80008QG0R000HSFMET** (CayleyDickson) and **081KSKBP80008QG0R001T5WV30** (KskAuthorization), preserving substantive **081KSKBP80008QG0R003NM9XEC/081KSKBP80008QG0R003RFX32N** IDs.
- Update **081KSNY2Z0008QG0R003Q42FZY** triage notes to record the executed repair and new destinations.
- Regenerate `docs/BACKLOG.md` to remove the duplicate entries and include 081KSKBP80008QG0R000HSFMET/081KSKBP80008QG0R001T5WV30.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P3/081KSNY2Z0008QG0R003Q42FZY-dup-id-triage-b0865-b0866-pre-existing-duplicates-on-origin-main-non-required-lint-failure-aaron-otto-2026-05-28.md | Records the executed renumber plan and post-repair destinations for the formerly-colliding rows. |
| docs/backlog/P2/081KSKBP80008QG0R000HSFMET-integrate-or-remove-unreferenced-cayleydickson.md | Updates the CayleyDickson housekeeping row’s `id`/header/metadata to the new unique ID. |
| docs/backlog/P2/081KSKBP80008QG0R001T5WV30-integrate-or-remove-unreferenced-kskauthorization.md | Updates the KskAuthorization housekeeping row’s `id`/header/metadata to the new unique ID. |
| docs/BACKLOG.md | Regenerated index removing the duplicate 081KSKBP80008QG0R003NM9XEC/081KSKBP80008QG0R003RFX32N housekeeping entries and adding 081KSKBP80008QG0R000HSFMET/081KSKBP80008QG0R001T5WV30. |

## General comments

### @chatgpt-codex-connector (2026-05-28T15:08:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
