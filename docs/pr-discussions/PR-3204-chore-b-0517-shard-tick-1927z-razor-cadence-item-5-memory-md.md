---
pr_number: 3204
title: "chore(081KRHWGX0008QG0R0029X10F4) + shard(tick): 1927Z \u2014 razor-cadence item 5 (MEMORY.md bloat)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T19:32:58Z"
merged_at: "2026-05-14T19:34:38Z"
closed_at: "2026-05-14T19:34:39Z"
head_ref: "chore/b-0517-memory-md-index-bloat-audit-otto-cli-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T19:41:01Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3204: chore(081KRHWGX0008QG0R0029X10F4) + shard(tick): 1927Z — razor-cadence item 5 (MEMORY.md bloat)

## PR description

Razor-cadence item 5 investigation: user-scope MEMORY.md is 242 lines / 66KB / 237 entries. Cold-boot loads first 200 lines only — ~37 lines (15%) silently unreachable. ~130 entries exceed the 200-char guidance.

081KRHWGX0008QG0R0029X10F4 captures two-phase plan: (1) bulk cleanup of over-long entries; (2) mechanize via `tools/hygiene/audit-user-scope-memory-index.ts` (parallel to PR #3202).

(Renumbered from 081KRHWGX0008QG0R001BPYWTT → 081KRHWGX0008QG0R0029X10F4 due to multi-Otto ID-collision; substrate-honest disclosure in commit message.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T19:36:42Z)

## Pull request overview

This PR records a razor-cadence investigation into user-scope `MEMORY.md` index bloat and files 081KRHWGX0008QG0R0029X10F4 to track cleanup plus future mechanized auditing.

**Changes:**

- Adds a 1927Z hygiene tick shard documenting the investigation and findings.
- Adds backlog row 081KRHWGX0008QG0R0029X10F4 for cleanup and audit-tool follow-up.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `docs/hygiene-history/ticks/2026/05/14/1927Z.md` | Captures the tick’s MEMORY.md bloat investigation and next-step visibility notes. |
| `docs/backlog/P3/081KRHWGX0008QG0R0029X10F4-memory-md-index-bloat-cleanup-cadence-2026-05-14.md` | Defines the backlog item for one-time MEMORY.md cleanup and future enforcement tooling. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/backlog/P3/081KRHWGX0008QG0R0029X10F4-memory-md-index-bloat-cleanup-cadence-2026-05-14.md:62**

* P1 correctness: the proposed audit would miss the documented 25KB truncation mode if it only computes lines past 200. The existing loading-taxonomy memory says MEMORY.md loads the first 200 lines OR 25KB, whichever comes first, so the tool needs to report byte-cap risk as well as line-cap risk to avoid false negatives on large one-line entries.
```
- Computes truncation risk (lines past 200)
```
</details>

## Review threads

### Thread 1: docs/backlog/P3/081KRHWGX0008QG0R0029X10F4-memory-md-index-bloat-cleanup-cadence-2026-05-14.md:72 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T19:36:41Z):

P1 xref: this is a bare filename while the referenced rule lives at `.claude/rules/encoding-rules-without-mechanizing.md`. Other backlog rows spell the full path (for example `docs/backlog/P1/081KRFA460008QG0R001KC0VBH-standing-by-failure-mode-detector-background-service-2026-05-13.md:115` and `docs/backlog/P3/081KRHWGX0008QG0R002DPG02X-stale-worktree-prune-cadence-mechanization-2026-05-14.md:55`), and the bare form is not directly navigable/searchable as a concrete repo path.

### Thread 2: docs/backlog/P3/081KRHWGX0008QG0R0029X10F4-memory-md-index-bloat-cleanup-cadence-2026-05-14.md:23 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T19:36:42Z):

P1 accuracy: the documented cap is "first 200 lines OR 25KB (whichever first)" (`memory/feedback_claude_code_loading_taxonomy_rules_vs_skills_vs_claude_md_aaron_2026_05_01.md:139-141`). With this file measured at 66KB, the 25KB cap is hit before line 200, so the impact is larger than only the ~37 lines after line 200; this row underreports the fast-path loss.

This issue also appears on line 62 of the same file.

### Thread 3: docs/hygiene-history/ticks/2026/05/14/1927Z.md:26 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T19:36:42Z):

P1 accuracy: this metric ignores the 25KB half of the documented MEMORY.md fast-path cap (first 200 lines OR 25KB, whichever comes first). Since the measured file is 66KB, the byte cap is likely reached well before line 200, so reporting only ~37 unreachable lines undercounts the cold-boot loss.
