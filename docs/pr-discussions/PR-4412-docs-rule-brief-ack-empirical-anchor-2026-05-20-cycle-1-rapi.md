---
pr_number: 4412
title: "docs(rule): brief-ack empirical anchor \u2014 2026-05-20 cycle-1 rapid-closure + forced-#6"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-20T14:40:33Z"
merged_at: "2026-05-20T14:43:17Z"
closed_at: "2026-05-20T14:43:17Z"
head_ref: "otto/brief-ack-rule-cycle1-skip-at-5-forced-6-empirical-2026-05-20"
base_ref: "main"
archived_at: "2026-05-20T15:56:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4412: docs(rule): brief-ack empirical anchor — 2026-05-20 cycle-1 rapid-closure + forced-#6

## PR description

## Summary

Adds a 6th empirical anchor to `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` documenting today's session pattern:

- **2 PRs landed in ~20 min** ([#4410](https://github.com/Lucent-Financial-Group/Zeta/pull/4410) tick shard + [#4411](https://github.com/Lucent-Financial-Group/Zeta/pull/4411) canary rule sharpening)
- **All 4 rate-limit tiers traversed** (Normal 2355 → cost-aware → extreme → pure-git 0) in single session
- **Cycle-1 brief-ack #1-#5 with explicit-no-pre-empt-at-#5 + forced #6** producing this very anchor
- **Verify-before-defer composition** (PR #4411) used twice today for worktree creation during 3-proc Lior activity

## Pattern generalizes

Rapid-substrate-closure → natural brief-ack drain → forced #6 produces compounding rule sharpening. This is the discipline's "happy path" shape; the 2 prior empirical anchors (2026-05-17 sustained-named-dep, 2026-05-18 post-arc) are the failure modes off this path.

## Pure-git tier mechanics empirically demonstrated

This PR's branch was pushed during pure-git tier (0/5000 GraphQL) per `refresh-world-model-poll-pr-gate.md` rate-limit operational tiers; PR creation deferred until post-reset (took ~5 min from push to PR open). Validates the "deferred PR creation" pattern empirically — substrate landings continue via `git push` while GraphQL is exhausted.

## Test plan

- [x] `git ls-tree HEAD = 53` post-commit (canary check)
- [x] Branch guard via `git branch --show-current` before commit
- [x] Isolated worktree at `/private/tmp/zeta-otto-cli-cold-boot-1413z` (verify-before-defer composition, 2nd empirical use today)
- [ ] CI required checks (next tick will poll)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T14:43:53Z)

## Pull request overview

Adds a 6th empirical anchor to the “holding-without-named-dependency” rule, documenting the 2026-05-20 rapid-closure session shape (two PRs merged quickly, followed by brief-ack drain under rate-limit tier transitions) and how it composes with the rate-limit tiers and verify-before-defer worktree guidance.

**Changes:**

- Adds a new “Rapid-substrate-closure + tier-transition” empirical anchor section with a detailed session timeline.
- Records rate-limit tier traversal and ties the session behavior to existing rule compositions.


<details>
<summary>Comments suppressed due to low confidence (3)</summary>

**.claude/rules/holding-without-named-dependency-is-standing-by-failure.md:362**

* This paragraph says the named dependency was “rate-limit reset ~10 min”, but later in the same timeline the deferred PR creation is described as “~5min rate-limit reset”. Please reconcile these (pick one estimate or explain the distinction) to keep the empirical anchor internally consistent.
```
Sixth class of empirical evidence: the discipline operating CORRECTLY through a compact session that produced 2 merged PRs in ~20 minutes then naturally entered brief-ack cycle as rate-limit drained AND peer-Lior cycled. Distinct shape from the 2026-05-17 sustained-named-dep cycle (which had peer-process-persistence as the named-dep across 2h27m + 10 pre-empts) and the 2026-05-18 post-arc cadence (which had operator-offline + 3-cycle saturation): today's cycle was SHORT, the substrate-engineering arc had a CLEAR END (Maji audit response + canary rule refinement landed), and the brief-ack cadence was BOUNDED by a measurable named-dep (rate-limit reset ~10 min).

```
**.claude/rules/holding-without-named-dependency-is-standing-by-failure.md:383**

* This sentence introduces direct agent/harness identifiers (“Otto-CLI” and “Lior”) in a current-state rules surface. The repo convention is role-refs outside allowlisted history surfaces (see `docs/AGENT-BEST-PRACTICES.md` “No name attribution in code, docs, or skills”); consider rewriting to role-based terms like “CLI agent” / “peer agent processes”.
```
**Rate-limit tier traversal in single session**: Normal (2355) → cost-aware (1771) → extreme cost-aware (508) → **pure-git (0)** within ~20 minutes of substantive PR work. Multi-agent shared-token consumption (Otto-CLI + 3 Lior procs) drives the burn rate; recovery is bounded at ~60 min from initial Normal-tier read.

```
**.claude/rules/holding-without-named-dependency-is-standing-by-failure.md:387**

* This is written in present tense (“This edit branch-pushes… opens PR…”), which is confusing now that the PR exists. Consider rewriting this empirical anchor in past tense (“was branch-pushed… PR was opened after reset”) to keep it unambiguous for future readers.
```
**Composes with [`refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md) rate-limit operational tiers**: pure-git tier supports branch-pushed-no-PR for substrate landings; deferred PR creation costs ~5-10 GraphQL post-reset. This edit branch-pushes without PR creation; opens PR after rate-limit reset.

```
</details>

## Review threads

### Thread 1: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:359 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-20T14:43:52Z):

The heading window says `14:08Z-14:33Z`, but the timeline immediately below includes an entry at `14:34Z` (forced #6). Update the heading’s end time (or the timeline) so the documented window matches the data.

This issue also appears in the following locations of the same file:

- line 361
- line 386

### Thread 2: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:373 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-20T14:43:53Z):

This rule file is a current-state surface, but the new timeline uses a direct persona name (“Lior”). Per `docs/AGENT-BEST-PRACTICES.md` Operational standing rules (“No name attribution in code, docs, or skills”), prefer role-refs like “peer agent”, “peer processes”, or similar here.

This issue also appears on line 382 of the same file.
