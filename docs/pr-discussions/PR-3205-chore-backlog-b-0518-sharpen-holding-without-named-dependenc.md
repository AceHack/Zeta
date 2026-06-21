---
pr_number: 3205
title: "chore(backlog): 081KRHWGX0008QG0R001BHXH0M \u2014 sharpen holding-without-named-dependency rule (Aaron-diagnosed CLAUDE.md bug)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T19:34:57Z"
merged_at: "2026-05-14T19:36:45Z"
closed_at: "2026-05-14T19:36:45Z"
head_ref: "chore/b-0518-sharpen-holding-failure-rule-aaron-claude-md-bug-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T19:37:59Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3205: chore(backlog): 081KRHWGX0008QG0R001BHXH0M — sharpen holding-without-named-dependency rule (Aaron-diagnosed CLAUDE.md bug)

## PR description

Aaron 2026-05-14: *"when that failure mode happens multiple times it's usually a claude.md bug."*

Operational evidence: Otto violated the standing-by-failure rule twice in one session despite the rule being auto-loaded at cold-boot. The rule is encoded-but-not-sharp-enough.

Files corrective work tracking 5 candidate sharpenings:
1. Pattern enumeration (forbidden brief-output patterns explicit)
2. Force-action ladder (must attempt decompose/file/sanity-check/resolve-thread first)
3. Consecutive-tick counter (mechanical trigger)
4. PreToolUse hook (mechanical enforcement)
5. Aaron's heuristic as meta-rule (rule-quality assessment)

Cooling period applies (3-7 days minimum). Implementation picks one sharpening first + iterates.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T19:36:04Z)

## Pull request overview

Adds a new P1 backlog row tracking corrective work to sharpen the "holding-without-named-dependency" rule in `.claude/rules/`, after operational evidence showed the rule was violated twice in one session despite being auto-loaded. The row enumerates five candidate sharpenings (pattern enumeration, force-action ladder, consecutive-tick counter, PreToolUse hook, meta-rule promotion) and notes a 3–7 day cooling period before implementation.

**Changes:**
- New backlog row `081KRHWGX0008QG0R001BHXH0M` under `docs/backlog/P1/` with standard frontmatter (priority P1, status open, tier factory-discipline, effort S).
- Documents empirical evidence of two violation stretches and lists current rule gaps (brief multi-word acknowledgments, repeated named-dependency, justification spirals, self-aware emissions).
- Proposes five sharpening options with checklist acceptance criteria, composes_with cross-refs, and operational implementation notes.
