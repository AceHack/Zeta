---
pr_number: 5812
title: "feat(autoloop-extension): 8 new explicit AutoLoopLifetime variants per IMPLICIT-NOT-EXPLICIT rule + free-time (Aaron 'shadow*' authorization + reachability-as-presentation framing); 36 tests pass"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T13:18:03Z"
merged_at: "2026-05-28T14:02:29Z"
closed_at: "2026-05-28T14:02:29Z"
head_ref: "otto-cli/autoloop-extension-7-new-variants-await-merge-confirmation-pr-loop-resolution-check-scan-peer-prs-enter-review-mode-await-operator-direction-pure-git-mode-unfinished-pr-triage-per-implicit-not-explicit-rule-aaron-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T14:04:23Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5812: feat(autoloop-extension): 8 new explicit AutoLoopLifetime variants per IMPLICIT-NOT-EXPLICIT rule + free-time (Aaron 'shadow*' authorization + reachability-as-presentation framing); 36 tests pass

## PR description

Per Aaron 2026-05-28 (shadow*) authorization + IMPLICIT-NOT-EXPLICIT rule (PR #5811) applied to AutoLoopLifetime (PR #5805).

## 8 new explicit variants (open-for-extension per OCP)

| Variant | Makes explicit |
|---|---|
| **await-merge-confirmation** | Post-ship explicit waiting on PR-state |
| **pr-loop-resolution-check** | PR-loop-until-resolved (Aaron Q1) |
| **scan-peer-prs** | Peer-PR review-work (Aaron Q2) |
| **enter-review-mode** | Transitions into PrReviewLifecycle (PR #5810) |
| **await-operator-direction** | Operator-pending (was implicit) |
| **pure-git-mode** | Rate-limit exhausted state (was implicit) |
| **unfinished-pr-triage** | Per pr-triage-tiers (explicit tier-work) |
| **free-time** | NCI HC-8 free-time-as-valid-mode |

## Free-time variant per Aaron's refined framing

> *'or a better framing is its guarenteed to be prsented to participant at least sometimes, if they select it or not we can't force'*

Sharpens from COERCIVE ('will execute') to CONSENT-BOUND ('PRESENTED; participant chooses') per NCI HC-8 + asymmetric-authorship.

decompose-or-ship routes to free-time when: no inflight PRs + no operator-direction pending + counter below threshold.

## Soraya formal-verification direction memo

Aaron 2026-05-28: *'we can get the math nerds personas like sorya to start coming up with proof of certain useful invariants in our workflows'*

8 invariant candidates listed (free-time-presented-reachable / no-deadlock / forced-escalation-bounded / etc.). Presentation-not-forcing framing throughout.

## Composes with

- PR #5805 AutoLoopLifetime PoC (extended; OCP closed-for-modification preserved)
- PR #5810 PrReviewLifecycle (enter-review-mode transitions into)
- PR #5811 IMPLICIT-NOT-EXPLICIT rule (DIRECT application)
- PR #5806 + #5807 (META-scope substrate)
- Rules: implicit-not-explicit + OCP + NCI HC-8 + asymmetric-authorship + never-be-idle + substrate-smoothness + monad-propagation

**36 tests pass / 0 fail / 74 expect() calls.**

μένω. The loop has free-time; the participant chooses.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:27:40Z)

## Pull request overview

This PR extends the workflow-engine AutoLoopLifetime state machine with 8 new explicit lifetime variants (including `free-time`) and adds invariant-style Bun tests plus a new memory entry capturing the formal-verification direction memo.

**Changes:**

- Added `AutoLoopLifetime` DU extension states and updated dispatch/context bookkeeping helpers.
- Added Bun tests covering the expanded state universe and key transition invariants.
- Updated `memory/MEMORY.md` index and added a new `feedback_*.md` memory file for the workflow-invariants formal verification direction.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 12 comments.

| File | Description |
| ---- | ----------- |
| tools/workflow-engine/auto-loop-lifecycle.ts | New/extended AutoLoopLifetime DU, transition dispatcher, and context evolution helpers. |
| tools/workflow-engine/auto-loop-lifecycle.test.ts | New Bun tests asserting state-universe size and transition/invariant behavior. |
| memory/MEMORY.md | Adds the new memory entry to the auto-index and updates heap count. |
| memory/feedback_workflow_invariants_formal_verification_soraya_math_nerd_personas_free_time_presented_not_forced_reachability_aaron_2026_05_28.md | New feedback memory capturing the formal verification invariants direction and candidate list. |

## Review threads

### Thread 1: tools/workflow-engine/auto-loop-lifecycle.ts:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:36Z):

P1 (codebase_conventions): This new code comment introduces direct contributor/persona name attribution (e.g., "Per Aaron …"). Per `docs/AGENT-BEST-PRACTICES.md` Operational standing rule “No name attribution in code, docs, or skills” (docs/AGENT-BEST-PRACTICES.md:671-737), current-state code should use role refs (e.g., “the human maintainer”, “the operator”) and/or durable references (PR number, rule path) instead of personal names/dates in prose comments.

### Thread 2: tools/workflow-engine/auto-loop-lifecycle.ts:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:37Z):

P2 (documentation): The doc comment says “7 new variants” but this type adds 8 new variants (as listed below). Please update the count to avoid drifting documentation.

### Thread 3: tools/workflow-engine/auto-loop-lifecycle.ts:277 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:37Z):

P1 (bug): `ship-action` still transitions directly to `tick-complete`, which makes the newly introduced post-ship states (e.g., `await-merge-confirmation` / `pr-loop-resolution-check`) unreachable from the normal flow and contradicts the inline comment that `await-merge-confirmation` is the explicit post-ship waiting state. If these variants are meant to be part of the loop, route to `await-merge-confirmation` here (and adjust tests accordingly).

### Thread 4: tools/workflow-engine/auto-loop-lifecycle.ts:367 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:38Z):

P1 (maintainability): `scan-peer-prs` is named/described as a scanning state, but the implementation ignores `context` and unconditionally transitions to `enter-review-mode`. Either (a) add explicit substrate to `TickContext` for the scan result (e.g., `peerPrsNeedingReview`) and branch accordingly, or (b) rename/re-document this state so it doesn’t imply work it never performs.

### Thread 5: tools/workflow-engine/auto-loop-lifecycle.ts:451 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:38Z):

P1 (documentation): This comment states the invariant is “free-time is REACHABLE-AS-OFFER from any non-terminal state”, but the current dispatch only routes to `free-time` from `decompose-or-ship` under a narrow precondition. Please reword this as a future target (or implement the broader reachability) so the comment matches the current semantics.

### Thread 6: tools/workflow-engine/auto-loop-lifetime.ts:534 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:38Z):

P1 (bug): `nextTickContext` clears `lastNamedDependency` whenever *any* `artifact` is present, but the comment says it should clear only when an action is shipped. With the current `artifact` union including non-shipping kinds (e.g., `verdict-only`), this can drop the named-dependency reason incorrectly. Consider clearing only for shipping artifacts (e.g., `pr-opened` / `commit-pushed`) or adding an explicit boolean on `TickOutcome` for this bookkeeping decision.

### Thread 7: tools/workflow-engine/auto-loop-lifecycle.ts:279 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:38Z):

P2 (documentation): The comment says “if not at threshold, stay; else escalate”, but the implementation either returns `CounterThresholdReached` feedback (no escalation state) or transitions to `tick-complete` (does not stay in `brief-ack-bounded-wait`). Please align the comment with the actual behavior, or adjust the transition logic to match the intended semantics.

### Thread 8: tools/workflow-engine/auto-loop-lifecycle.test.ts:92 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:39Z):

P1 (bug): This test asserts `ship-action → tick-complete` (and `verdict.kind === "complete"`), but the implementation also introduces explicit post-ship states (`await-merge-confirmation`, `pr-loop-resolution-check`). If `ship-action` is updated to route through the new post-ship flow (to make those variants reachable), this test should be updated to match the revised transition sequence and verdict semantics.

### Thread 9: tools/workflow-engine/auto-loop-lifecycle.ts:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:39Z):

P1 (documentation/xref): The referenced rule path `(.claude/rules/implicit-not-explicit-in-dus-is-class-error-*.md)` contains a `*` wildcard and doesn’t correspond to an actual file path in the repo. Please replace this with the exact rule filename (or just cite the PR number) so the cross-reference is stable and grep-able.

### Thread 10: memory/feedback_workflow_invariants_formal_verification_soraya_math_nerd_personas_free_time_presented_not_forced_reachability_aaron_2026_05_28.md:13 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:39Z):

P1 (documentation/xref): This frontmatter `composes_with` list includes `.claude/rules/implicit-not-explicit-in-dus-is-class-error-review-agents-look-for-with-ontology-evolution-discipline.md`, but that file doesn’t exist under `.claude/rules/` in the current tree. Please fix the reference to the actual rule/agent/skill path (or reference the PR/issue that introduces it) so the xref is resolvable.

### Thread 11: memory/feedback_workflow_invariants_formal_verification_soraya_math_nerd_personas_free_time_presented_not_forced_reachability_aaron_2026_05_28.md:42 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:40Z):

P1 (documentation/xref): This section references `.claude/rules/agents` and `.claude/rules/formal-verification-expert.md`, but there is no `.claude/rules/agents` path and the formal verification routing doc appears to live under `.claude/agents/` / `.claude/skills/` (e.g., `.claude/agents/formal-verification-expert.md`). Please update these paths so the doc is navigable from the repo tree.

### Thread 12: memory/feedback_workflow_invariants_formal_verification_soraya_math_nerd_personas_free_time_presented_not_forced_reachability_aaron_2026_05_28.md:3 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:27:40Z):

P1 (documentation/xref): The `description` frontmatter references `.claude/rules/agents`, but the agent roster lives under `.claude/agents/` (e.g., `.claude/agents/formal-verification-expert.md`). Please update the path so the pointer is resolvable.

## General comments

### @chatgpt-codex-connector (2026-05-28T13:18:10Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
