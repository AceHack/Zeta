---
pr_number: 3307
title: "docs(rules): add worktree force-remove guard to claim-acquire rule"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T23:53:55Z"
merged_at: "2026-05-14T23:55:43Z"
closed_at: "2026-05-14T23:55:43Z"
head_ref: "otto-claim-rule-worktree-force-remove-guard-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T23:58:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3307: docs(rules): add worktree force-remove guard to claim-acquire rule

## PR description

## Summary

Extends [.claude/rules/claim-acquire-before-worktree-work.md](/.claude/rules/claim-acquire-before-worktree-work.md) with a new \"Worktree force-remove guard\" section covering an empirical failure mode that the existing rule didn't anticipate.

## Empirical anchor

[docs/hygiene-history/ticks/2026/05/14/1813Z.md](/docs/hygiene-history/ticks/2026/05/14/1813Z.md) (Otto-CLI's tick shard) documents:

- Otto-CLI tried to checkout Otto-Desktop's PR #3153 branch to investigate a Codex thread
- Got \`fatal: already used by worktree at /private/tmp/zeta-otto-id-alloc\`
- Force-removed the worktree to take over
- Found Otto-Desktop had already authored the fix (\`1636908\`); just resolved the thread

The legitimate intent (review-thread resolution) was covered by the existing DOES-NOT-APPLY clause. The mechanism (force-remove) wasn't. This PR adds the missing guard.

## Three operational alternatives

| Approach | When | Cost |
|---|---|---|
| 1. New worktree at distinct path | Default — almost always works | ~30s worktree create + 4400 file checkout |
| 2. \`gh api\` / GraphQL for branch-state ops | Thread resolution, comment posting, PR metadata | Zero — no checkout needed |
| 3. Bus-mediated worktree handoff | Rare must-checkout cases | Coordination cost; bus advisory envelope |

## Composition

- Composes with the existing \"When this rule applies\" / \"DOES NOT APPLY\" framing
- Tightens the rule without invalidating any prior application
- Empirically grounded — not speculative

## Test plan

- [ ] CI passes (markdownlint + memory frontmatter checks)
- [ ] Future Otto cold-boots read the new section at session start
- [ ] Next cross-Otto branch-coordination event exercises the discipline

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T23:57:44Z)

## Pull request overview

Extends the claim-acquire rule with guidance for avoiding destructive takeover of another worktree when Git reports a branch is already in use.

**Changes:**

- Adds a “Worktree force-remove guard” section.
- Recommends alternate worktree/API/bus-handoff approaches.
- Links the guidance to a 2026-05-14 hygiene-history tick shard.

## Review threads

### Thread 1: .claude/rules/claim-acquire-before-worktree-work.md:65 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:57:43Z):

This fallback is not actionable for the exact failure described above. Git refuses to check out the same branch in a second worktree regardless of the new path, so `git worktree add <different-path> <branch>` will hit the same branch-in-use error unless the instruction specifies a detached checkout, a new local branch, or stale-worktree pruning.

### Thread 2: .claude/rules/claim-acquire-before-worktree-work.md:74 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:57:44Z):

`worktree-handoff` is not a supported bus topic/envelope in the current tooling: the bus `Topic` union and TTL map do not include it, and `bus.ts publish` rejects unknown topics. Agents following this rule cannot post the requested envelope until the schema/tooling is added or this is rewritten to use an existing topic and payload.

### Thread 3: .claude/rules/claim-acquire-before-worktree-work.md:83 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:57:44Z):

The cited tick shard does not identify this as Otto-Desktop's worktree; it describes a stale `/private/tmp/zeta-otto-id-alloc` entry and attributes the already-pushed fix to another agent/Aaron+Co-Authored-Claude. Reword the empirical anchor to match the cited source, or add a citation that supports the Otto-Desktop ownership claim.

### Thread 4: .claude/rules/claim-acquire-before-worktree-work.md:71 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:57:44Z):

Use the verb phrase “check out” here; “checkout” is the noun/adjective form for the Git command or target state.
