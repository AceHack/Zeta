---
pr_number: 4054
title: "substrate(otto-cli): B-0611 followup memos + 2 tick shards from autonomous-loop 0808Z-0904Z"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T09:11:59Z"
merged_at: "2026-05-17T09:14:16Z"
closed_at: "2026-05-17T09:14:16Z"
head_ref: "otto-cli/b0611-followup-substrate-catalog-drift-shell-glob-shards-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T09:20:37Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4054: substrate(otto-cli): B-0611 followup memos + 2 tick shards from autonomous-loop 0808Z-0904Z

## PR description

Follow-up to PR #4046 (B-0611 audit-prep substrate batch) and PR #4048 (isolated-worktree workflow worked example). Ships 5 filesystem-only artifacts that accumulated during autonomous-loop session 0808Z → 0904Z.

## Artifacts (5 files, ~700 lines)

1. **`memory/feedback_otto_cli_dangling_refs_file_line_catalog_47_pairs_6_surfaces_2026_05_17.md`** (362 lines) — catalog memo from 0430Z prior session; the better audit form peer-Otto flagged on PR #4041 (file:line pairs vs sort-u dedup)
2. **`memory/feedback_otto_cli_b0611_dangling_refs_count_drift_47_to_49_over_3_5_hours_audit_tool_in_ci_is_durability_mechanism_2026_05_17.md`** (110 lines) — drift signal at 0820Z: 47 → 49 edges over 3.5h; argues for audit-tool CI-wiring (B-0611 acceptance bullet already in place)
3. **`memory/feedback_otto_cli_shell_glob_in_quotes_silent_failure_authoring_lesson_from_pr_4048_reviewer_iteration_2026_05_17.md`** (95 lines) — authoring lesson from PR #4048 reviewer-iteration: literal filenames over globs-in-quotes
4. **`docs/hygiene-history/ticks/2026/05/17/0808Z.md`** (53 lines) — session cold-boot shard
5. **`docs/hygiene-history/ticks/2026/05/17/0825Z.md`** (80 lines) — arc-summary for 0808Z-0824Z; 2 pre-empt-at-#5 cycles

## Composes with

- PR #4042 (audit tool mechanization)
- PR #4046 (B-0611 row + 4 slice recipes + session memos + 3 tick shards)
- PR #4048 (isolated-worktree workflow worked example — applied here)
- PR #4050 (sustained-Lior-with-pre-empt-success empirical anchor — this PR is fresh evidence)

## Worked-example: isolated-worktree under Lior contention

Branch authored from isolated worktree `/private/tmp/zeta-otto-cli-0904z-followup` at 0904Z forced-#6 escalation point. Lior was active (3 procs) during creation. Worktree-add succeeded; canary `ls-tree origin/main = ls-tree HEAD = 53` (no corruption). Branch guard verified at add-time and commit-time per `.claude/rules/zeta-expected-branch.md`. Empirical refinement: worktree-add CAN succeed during Lior contention if Lior is in a low-pack-contention phase.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T09:17:59Z)

## Pull request overview

Adds a small follow-up batch of substrate artifacts for B-0611 audit prep and autonomous-loop hygiene history: three new `memory/feedback_*.md` memos (catalog + drift signal + shell authoring lesson) plus two new tick shards documenting the 0808Z–0825Z session arc.

**Changes:**
- Adds a dangling memory-ref catalog memo with file:line pairs for multi-surface audit addressability.
- Adds a drift memo capturing a same-day change in dangling-ref counts and arguing for CI wiring as the durability mechanism.
- Adds two tick-history shards capturing a cold-boot snapshot and an arc summary for the autonomous-loop session.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 6 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| memory/feedback_otto_cli_shell_glob_in_quotes_silent_failure_authoring_lesson_from_pr_4048_reviewer_iteration_2026_05_17.md | New memo capturing a shell authoring pitfall and recommended reproducible command style |
| memory/feedback_otto_cli_dangling_refs_file_line_catalog_47_pairs_6_surfaces_2026_05_17.md | New memo cataloging dangling refs as file:line pairs across surfaces, plus FP taxonomy notes |
| memory/feedback_otto_cli_b0611_dangling_refs_count_drift_47_to_49_over_3_5_hours_audit_tool_in_ci_is_durability_mechanism_2026_05_17.md | New memo recording count drift and motivating CI integration |
| docs/hygiene-history/ticks/2026/05/17/0808Z.md | New tick shard for session cold-boot snapshot |
| docs/hygiene-history/ticks/2026/05/17/0825Z.md | New tick shard summarizing the 0808Z–0824Z arc and next safe-window prescription |
</details>


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**memory/feedback_otto_cli_b0611_dangling_refs_count_drift_47_to_49_over_3_5_hours_audit_tool_in_ci_is_durability_mechanism_2026_05_17.md:55**
* tools/hygiene/validate-memory-schema.ts expects `project` (and `feedback`) memory files to include the literal body markers `Why:` and `How to apply:`. This memo uses headings like “Why the drift matters” / “Implication…” but doesn’t contain those marker strings, so it will be reported as missing required markers. Add explicit `Why:` and `How to apply:` sections (can be brief) to satisfy the schema.
```
## Why the drift matters

The 0430Z catalog → 0817Z audit drift confirms a structural property
of the dangling-refs problem: **new in-repo references to user-scope
memory files accumulate naturally with each rule update, each new
memo, each PR description**. The pattern is generative, not
incidental.

A one-shot B-0611 cleanup that resolves 35 refs at point-in-time T
will, by the same generative process, accumulate new dangling refs
between T and T+N. Without a durability mechanism, the count drifts
right back up.

## Implication for B-0611 cleanup strategy

The B-0611 row's "Proposed mechanization" already includes an
audit-tool CI-integration acceptance bullet. This data point
strengthens the case: the audit tool from PR #4042 should ship as a
**non-required CI check** that:
```
**memory/feedback_otto_cli_dangling_refs_file_line_catalog_47_pairs_6_surfaces_2026_05_17.md:24**
* tools/hygiene/validate-memory-schema.ts expects `project` (and `feedback`) memory files to include the literal body markers `Why:` and `How to apply:`. This catalog memo is mostly data, but it currently has neither marker string, so it will be flagged as missing required markers. Add short `Why:` and `How to apply:` sections (e.g., explaining what the catalog is for and how to use it) to match the standard format.
```
> sites get hidden."*

## Methodology

Bash one-liner using `grep -rn` (line-preserving) instead of `grep -rh`
(line-stripping) + filter-by-filesystem-existence:

```
</details>

## Review threads

### Thread 1: memory/feedback_otto_cli_dangling_refs_file_line_catalog_47_pairs_6_surfaces_2026_05_17.md:328 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T09:17:57Z):

The `Composes-with` link to tick `0421Z` appears to be broken: there is no `docs/hygiene-history/ticks/2026/05/17/0421Z.md` in-tree, and the link target is missing the `.md` extension and has an extra closing `)`. Update it to a real shard path (e.g., `0418Z.md` if that’s what was intended) and fix the markdown link syntax.

### Thread 2: memory/feedback_otto_cli_shell_glob_in_quotes_silent_failure_authoring_lesson_from_pr_4048_reviewer_iteration_2026_05_17.md:60 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T09:17:58Z):

Per tools/hygiene/validate-memory-schema.ts, `feedback` memory files are expected to include the literal body markers `Why:` and `How to apply:` (the validator warns if they’re missing). This memo has sections like “Why this matters…” and “Operational discipline” but not the required marker strings, so it will trip that lint. Add explicit `Why:` and `How to apply:` sections (can be short) to match the standard format.

### Thread 3: docs/hygiene-history/ticks/2026/05/17/0808Z.md:5 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T09:17:58Z):

Tick shard schema/tooling expects the first non-empty line to be a 6-column pipe-row (docs/hygiene-history/ticks/README.md; tools/hygiene/check-tick-history-shard-schema.ts). Starting the file with YAML frontmatter (`---`) means the shard won’t validate/parse if/when that checker is run (B-0591 notes it’s not yet wired into CI). Prefer the documented hybrid format: pipe-row first line, then the rich H1/body; put any YAML metadata below the pipe-row (not at file head).

### Thread 4: docs/hygiene-history/ticks/2026/05/17/0825Z.md:5 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T09:17:58Z):

Tick shard schema/tooling expects the first non-empty line to be a 6-column pipe-row (docs/hygiene-history/ticks/README.md; tools/hygiene/check-tick-history-shard-schema.ts). Starting the file with YAML frontmatter (`---`) means the shard won’t validate/parse if/when that checker is run (B-0591 notes it’s not yet wired into CI). Prefer the documented hybrid format: pipe-row first line, then the rich H1/body; put any YAML metadata below the pipe-row (not at file head).

### Thread 5: memory/feedback_otto_cli_dangling_refs_file_line_catalog_47_pairs_6_surfaces_2026_05_17.md:4 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T09:17:58Z):

The memory format standard requires `type:` to match the filename prefix (memory/project_memory_format_standard.md; also checked by tools/hygiene/validate-memory-schema.ts). This file is named `feedback_...` but frontmatter says `type: project`, so it will be reported as a prefix/type mismatch. Fix by either changing `type:` to `feedback` or renaming the file to the `project_` prefix (and updating any in-repo references accordingly).

This issue also appears on line 18 of the same file.

### Thread 6: memory/feedback_otto_cli_b0611_dangling_refs_count_drift_47_to_49_over_3_5_hours_audit_tool_in_ci_is_durability_mechanism_2026_05_17.md:4 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T09:17:59Z):

The memory format standard requires `type:` to match the filename prefix (memory/project_memory_format_standard.md; also checked by tools/hygiene/validate-memory-schema.ts). This file is named `feedback_...` but frontmatter says `type: project`, so it will be reported as a prefix/type mismatch. Fix by either changing `type:` to `feedback` or renaming the file to the `project_` prefix (and updating any in-repo references accordingly).

This issue also appears on line 37 of the same file.
