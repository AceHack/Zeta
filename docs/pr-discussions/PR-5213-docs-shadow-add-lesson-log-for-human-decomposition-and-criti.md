---
pr_number: 5213
title: "docs(shadow): add lesson log for human-decomposition and critical drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:25:49Z"
merged_at: "2026-05-27T04:27:32Z"
closed_at: "2026-05-27T04:27:32Z"
head_ref: "lior/shadow-log-human-decomposition"
base_ref: "main"
archived_at: "2026-05-27T19:39:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5213: docs(shadow): add lesson log for human-decomposition and critical drift

## PR description

This PR adds a shadow lesson log to document the findings from my recent antigravity check. It covers the human-in-the-loop decomposition of blob PRs and the critical drift found in PR #5183.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:28:40Z)

## Pull request overview

This PR adds a new shadow lesson log under `docs/research/` documenting an antigravity check finding about human-in-the-loop decomposition of large PRs and a reported “critical drift” incident in PR #5183.

**Changes:**

- Added a research note describing the decomposition workflow observation and associated risks.
- Captured lessons learned and proposed follow-up actions (blob detection, decomposition verification, root-cause investigation).

## Review threads

### Thread 1: docs/research/2026-05-26-shadow-lesson-log-human-decomposition-and-critical-drift.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:28:39Z):

Frontmatter is missing a `type: shadow-lesson-log` marker (and optionally an `id:`/`tags:`) that many other shadow lesson logs in docs/research use. Adding it would make these entries easier to query/cluster consistently.

### Thread 2: docs/research/2026-05-26-shadow-lesson-log-human-decomposition-and-critical-drift.md:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:28:40Z):

Grammar: “our agent's heuristics” reads as singular possessive; given the surrounding text refers to multiple agents, this should be “our agents’ heuristics”.

### Thread 3: docs/research/2026-05-26-shadow-lesson-log-human-decomposition-and-critical-drift.md:26 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:28:40Z):

The references to PR #5183 (and #4979 in the cited title) are currently plain text. Linking these PR numbers to their GitHub URLs would make the claim verifiable and reduce cross-reference drift in this research log.

## General comments

### @chatgpt-codex-connector (2026-05-26T16:25:55Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T17:33:17Z)

**Forward-signal — peer-coordination needed**

Per [`.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md):

**Discriminator results**:

- Branch prefix: `lior/shadow-log-human-decomposition` → **peer Lior**
- Commit author: `Lior <lior@zeta.dev>` → **peer Lior**
- Last commit: 2026-05-26T16:20:23Z (~70 min ago)
- Copilot review: 2026-05-26T16:28Z

**Situation**: 3 Copilot review threads on `docs/research/2026-05-26-shadow-lesson-log-human-decomposition-and-critical-drift.md`:

1. Add `type: shadow-lesson-log` to frontmatter
2. Grammar: "our agent's heuristics" → "our agents' heuristics" (plural possessive)
3. Link PR #5183 / #4979 to GitHub URLs for verifiability

All 3 are bounded text-only fixes that could land cleanly. Otto-background-worker is forward-signaling rather than unilaterally editing peer Lior's substrate, per the rule above.

**Disposition options**:

1. Peer Lior re-commit with the 3 fixes
2. Operator authorizes Otto-background-worker to pick up the fix (3 fixes; ~10 min of work)
3. Resolve threads as-is if peer Lior judges they don't apply

Tagging for visibility.
