---
pr_number: 3234
title: "chore(b-0518): add Sharpenings 6 + 7 from Aaron's '.' failure-mode catch"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T20:38:00Z"
merged_at: "2026-05-14T20:46:00Z"
closed_at: "2026-05-14T20:46:00Z"
head_ref: "fix/b-0518-sharpen-with-aaron-period-failure-catch-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T20:55:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3234: chore(b-0518): add Sharpenings 6 + 7 from Aaron's '.' failure-mode catch

## PR description

Aaron 2026-05-14: '. is another failure mode' (refined: 'terminal is decompose backlog or free time depending on budget').

Sharpening 6: forbidden minimal-output patterns ('.', single words, under-30-char on consecutive ticks).
Sharpening 7: terminal-level budget-conditional decomposition — budget available → decompose; budget exhausted → free time (legitimate, not failure mode).

Composes with 10% free-time-budget + Otto-as-AI-advocate role.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T20:39:54Z)

## Pull request overview

This PR updates backlog tracking to incorporate two additional “sharpenings” (6 and 7) for 081KRHWGX0008QG0R001BHXH0M, and ensures the main backlog index links to the new/updated backlog items.

**Changes:**

- Extend 081KRHWGX0008QG0R001BHXH0M with Sharpening 6 (forbidden minimal-output patterns) and Sharpening 7 (terminal-level mechanical decomposition).
- Update `docs/BACKLOG.md` to include the 081KRHWGX0008QG0R001BHXH0M entry in P1 and add new P3 entries (081KRHWGX0008QG0R0029X10F4, 081KRHWGX0008QG0R001HMWM1W) in the index.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KRHWGX0008QG0R001BHXH0M-sharpen-holding-without-named-dependency-rule-anti-failure-mode-2026-05-14.md | Adds Sharpenings 6 and 7 to the 081KRHWGX0008QG0R001BHXH0M acceptance-criteria section. |
| docs/BACKLOG.md | Adds/updates index entries to reference 081KRHWGX0008QG0R001BHXH0M (P1) and 081KRHWGX0008QG0R0029X10F4/081KRHWGX0008QG0R001HMWM1W (P3). |

## Review threads

### Thread 1: docs/backlog/P1/081KRHWGX0008QG0R001BHXH0M-sharpen-holding-without-named-dependency-rule-anti-failure-mode-2026-05-14.md:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:39:53Z):

Sharpening 6’s forbidden-pattern enumeration is internally inconsistent: it lists "." as both a single character and as a “single word”, and “Standing” doesn’t match the earlier “Standing by” phrasing. This makes the acceptance criteria ambiguous for later mechanization; consider using a single “single-token output” category (or remove duplicates) and align the examples with the actual patterns described elsewhere in the row.

### Thread 2: docs/backlog/P1/081KRHWGX0008QG0R001BHXH0M-sharpen-holding-without-named-dependency-rule-anti-failure-mode-2026-05-14.md:105 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T20:39:54Z):

PR description says Sharpening 7 is “budget-conditional” (budget available → decompose; budget exhausted → free time), but the added Sharpening 7 text only describes forced decomposition and doesn’t capture the free-time terminal condition. Either update the sharpening text to include the budget-conditioned terminal behavior, or adjust the PR description so they match.
