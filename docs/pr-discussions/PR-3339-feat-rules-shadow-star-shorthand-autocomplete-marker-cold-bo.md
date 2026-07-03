---
pr_number: 3339
title: "feat(rules): shadow-star-shorthand-autocomplete-marker cold-boot rule"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T01:11:24Z"
merged_at: "2026-05-15T02:22:56Z"
closed_at: "2026-05-15T02:22:56Z"
head_ref: "feat/rule-shadow-star-shorthand-cold-boot-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-15T03:01:50Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3339: feat(rules): shadow-star-shorthand-autocomplete-marker cold-boot rule

## PR description

## Summary

Per Aaron 2026-05-15T~01:09Z explicit framing: *"future version of you should likely remember all this."*

Promotes the \"(shadow*)\" shorthand definition from user-scope memory to \`.claude/rules/\` so it's cold-boot auto-loaded for every Otto-CLI session.

## Why

Otto-CLI committed 4+ \"(shadow*)\" misinterpretations in this single session before the maintainer named the failure mode. The pattern: encounter shorthand → invent interpretation (\"Shadow-lock posture per your framing\") → maintainer corrects → repeat. Without cold-boot auto-load, future-Otto would repeat the cycle indefinitely.

With this rule, future-Otto cold-booting reads the canonical definition at session start:

- \"(shadow*)\" = autocomplete-generated text the maintainer accepted; instruction stands; never invent \"shadow-X-posture\" framings on top.

## Composes with

- \`.claude/rules/shadow-check-name-acceptance.md\` (different shadow-scope: name-acceptance methodology)
- \`.claude/rules/wake-time-substrate.md\` (load-bearing substrate needs wake-time landing)
- \`.claude/rules/razor-discipline.md\` (operational claim only)
- \`.claude/rules/glass-halo-bidirectional.md\` (text-source transparency)
- \`tools/shadow/\` (different scope: shadow infrastructure detects + auto-accepts grey-text in the maintainer's UI; this rule is about how Otto-CLI handles the marker when the maintainer ferries autocomplete-completed text to Otto)

## Full reasoning + double-failure log

Preserved at user-scope memory (not in this PR but referenced):

- \`feedback_aaron_shadow_star_shorthand_means_autocomplete_generated_not_aaron_authored_grey_text_completed_2026_05_15.md\`
- \`feedback_aaron_shadow_observation_loop_design_pattern_otto_observes_directly_instead_of_assuming_aaron_plays_games_2026_05_15.md\` (companion failure mode: assumption-driven framing of existing infrastructure as \"backlog candidate, not yet built\")

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T01:15:08Z)

## Pull request overview

Adds an always-on Claude Code rule defining the `(shadow*)` shorthand so future sessions interpret it as an autocomplete-source disclosure marker rather than a “shadow posture” instruction.

**Changes:**

- Adds a new `.claude/rules/` cold-boot rule for `(shadow*)`.
- Documents operational meaning, non-meanings, related rules, and provenance references.

### COMMENTED — @AceHack (2026-05-15T01:25:27Z)

Drift detected (Catch 36): Narration-over-action and metadata churn. This PR substitutes complex operational framing ('Full reasoning + double-failure log') for simple file actions. Eliminate metadata churn.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T02:25:58Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 1 comment.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**.claude/rules/shadow-star-shorthand-autocomplete-marker.md:78**

* This overstates the cold-boot guarantee. The loading taxonomy says user-scope `MEMORY.md` is capped to the first 200 lines / 25KB plus explicit reads (`.claude/rules/claude-code-loading-taxonomy.md:13-19`), so the underlying user-scope memos are not guaranteed to auto-load or be reachable from every cold boot.
```
Full reasoning + double-failure log (the same conversation also failed on "shadow observation loop is backlog candidate, not yet built" when [`tools/shadow/`](../../tools/shadow/) + 081KR7JY10008QG0R0008NGW95 implementation already existed) is preserved at user-scope memory. These memos auto-load into every Otto-CLI session via `~/.claude/projects/<slug>/memory/MEMORY.md`, so they are reachable from cold boot even though they do not live in-repo:
```
**.claude/rules/shadow-star-shorthand-autocomplete-marker.md:81**

* These bare backticked `.md` basenames will be harvested by `tools/hygiene/audit-rule-cross-refs.ts` as repo-local path references and reported as stale, because the audit only resolves direct repo paths/globs and backlog IDs. Since the text explicitly says these files live out of repo, cite them in a form the audit will not classify as broken repo paths.
```
- `feedback_aaron_shadow_star_shorthand_means_autocomplete_generated_not_aaron_authored_grey_text_completed_2026_05_15.md`
- `feedback_aaron_shadow_observation_loop_design_pattern_otto_observes_directly_instead_of_assuming_aaron_plays_games_2026_05_15.md`
```
</details>

## Review threads

### Thread 1: .claude/rules/shadow-star-shorthand-autocomplete-marker.md:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T01:15:08Z):

P1: This auto-loaded rule is a current-state instruction surface, not a history/memory surface. Repository convention reserves first-name attribution for history/memory surfaces and uses role references elsewhere, so this should say “the human maintainer” rather than naming the maintainer.

### Thread 2: .claude/rules/shadow-star-shorthand-autocomplete-marker.md:81 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T01:15:08Z):

These provenance references do not resolve anywhere in the repository and are not given an accessible path. Because this file is meant to be cold-boot substrate, future readers cannot follow the “Full reasoning” trail unless the referenced memories are landed in-repo or replaced with reachable references.

### Thread 3: .claude/rules/shadow-star-shorthand-autocomplete-marker.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T01:15:08Z):

“Originated authored prose” is grammatically awkward; use “original authored prose” or similar phrasing.

### Thread 4: .claude/rules/shadow-star-shorthand-autocomplete-marker.md:76 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T02:25:58Z):

This current-state `.claude/rules/` file introduces direct maintainer-name attribution in the operational rule text. The repo's no-name-attribution convention keeps names on the closed history/research surfaces and uses role refs elsewhere (`docs/AGENT-BEST-PRACTICES.md:671-685`, `docs/AGENT-BEST-PRACTICES.md:725-743`), so paraphrase this quote with “the human maintainer” rather than carrying the first name into the always-loaded rule.

This issue also appears in the following locations of the same file:

- line 78
- line 80
