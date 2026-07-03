---
pr_number: 5424
title: "docs(081KSKBP80008QG0R002J03WGA): Turn 4/5/6 framing \u2014 install.sh \u2248 Ace + homelab-to-enterprise spectrum + attack-surface tempered (Aaron 2026-05-27 follow-up to #5423)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T07:59:18Z"
merged_at: "2026-05-27T08:01:50Z"
closed_at: "2026-05-27T08:01:51Z"
head_ref: "backlog/b-0857-turn-4-5-6-framing-extensions-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:25:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5424: docs(081KSKBP80008QG0R002J03WGA): Turn 4/5/6 framing — install.sh ≈ Ace + homelab-to-enterprise spectrum + attack-surface tempered (Aaron 2026-05-27 follow-up to #5423)

## PR description

## Summary

Three operator-framing extensions to 081KSKBP80008QG0R002J03WGA row body, follow-up to merged PR #5423 (which carried Turns 1/2/3):

- **Turn 4**: install.sh ≈ Ace; they're entangled — same substrate at different naming scopes (081KSKBP80008QG0R002J03WGA imperative-bash scope = 081KSKBP80008QG0R002VRN56K declarative-Ace scope)
- **Turn 5**: build-is-prod operates on a homelab-edge → enterprise-restrictive SPECTRUM; start MAXIMALLY UNIFIED first, scale back for enterprise later
- **Turn 6**: largest attack-surface concern (more deps on every node) is tempered by internal-access precondition (network + box); threat operates at post-perimeter-breach scope, not perimeter-breach scope

## Why follow-up PR

PR #5423 merged at \`7f6900a48\` carrying Turns 1/2/3 + operational scope. These three additional turns came in operator framing AFTER the merge. This PR captures them on the now-merged row body.

## Substrate-honest framing

No implementation work; framing extensions only. 081KSKBP80008QG0R002J03WGA remains P2 deferred per the separation-of-concerns discipline operator named 2026-05-27 (\"deferring of working on backlog is a seperate conerns of recording backlog item exist\").

## Test plan

- [x] Single-file documentation row update
- [x] No code changes
- [x] ls-tree count canary clean (61 = 61)
- [x] Per .claude/rules/agent-worktree-hygiene-never-hold-main-...: isolated worktree at /private/tmp/zeta-b0857-turn456-0810z; never touched operator's primary checkout
- [x] Per .claude/rules/non-coercion-invariant.md HC-8: operator authority over substrate-engineering trajectory; Turns 4/5/6 preserved verbatim
- [x] Per .claude/rules/methodology-hard-limits.md: Turn 6 threat-model preserved without inventing scope; clinical/security floor stays operative

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T08:01:16Z)

## Pull request overview

Updates backlog row **081KSKBP80008QG0R002J03WGA** with additional operator-framing “Turns 4/5/6” to clarify the relationship between `install.sh` and Ace, articulate a homelab→enterprise posture spectrum for “build-is-prod,” and scope the primary security concern (attack surface) as post-perimeter-breach.

**Changes:**

- Add **Turn 4** framing: `install.sh` and Ace as the same substrate at different naming scopes.
- Add **Turn 5** framing: “build-is-prod” as a spectrum; start maximally unified and scale restrictions later.
- Add **Turn 6** framing: temper attack-surface concerns by explicitly bounding the threat model to internal-access preconditions.

## General comments

### @chatgpt-codex-connector (2026-05-27T07:59:23Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
