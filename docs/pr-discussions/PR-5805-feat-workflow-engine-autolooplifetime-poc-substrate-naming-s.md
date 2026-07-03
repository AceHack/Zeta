---
pr_number: 5805
title: "feat(workflow-engine): AutoLoopLifetime PoC \u2014 substrate-naming substrate for Otto-CLI foreground loop (dogfood workflow-engine on own tick-handler); 23 tests pass"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T13:02:36Z"
merged_at: "2026-05-28T13:33:18Z"
closed_at: "2026-05-28T13:33:18Z"
head_ref: "otto-cli/b-0867-autoloop-lifecycle-poc-substrate-naming-substrate-dogfood-workflow-engine-on-otto-cli-foreground-loop-aaron-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T14:13:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5805: feat(workflow-engine): AutoLoopLifetime PoC — substrate-naming substrate for Otto-CLI foreground loop (dogfood workflow-engine on own tick-handler); 23 tests pass

## PR description

Per Aaron 2026-05-28: *'when do you want to update your foreground loop to start running on lifecycles and test out our first ones?'*

Substrate-engineering substrate-naming substrate dogfooding the workflow-engine on Otto-CLI's own foreground autonomous-loop tick-handler. Parallel-run discipline.

## AutoLoopLifetime DU (9 variants)

```typescript
type AutoLoopLifetime =
  | cold-boot                  // session-start + sentinel arm
  | refresh-substrate          // refresh-before-decide invariant
  | scan-inflight-prs          // identify actionable
  | investigate-failure        // pull log; classify
  | decompose-or-ship          // standing-auth + counter discipline
  | ship-action                // commit + push + PR + auto-merge
  | brief-ack-bounded-wait     // named-dep wait
  | forced-escalation          // at N=6 brief-acks
  | tick-complete              // bracket closure
```

## What this adds

- AutoLoopLifetime DU + TickContext + TickOutcome
- AutoLoopFeedback DU (asymmetric-authorship per rule)
- `dispatchAutoLoopTransition` exhaustive-switch (substrate-smoothness)
- `nextTickContext` counter bookkeeping
- `runTickCycle` end-to-end simulation
- Constants: BRIEF_ACK_THRESHOLD = 6 + REFRESH_STALENESS_THRESHOLD_S = 90

## Decompose-or-ship branch logic

| Context | Routes to |
|---|---|
| operator-direction pending | brief-ack-bounded-wait |
| counter ≥ 6 + no named-dep | forced-escalation |
| counter ≥ 6 + named-dep | ship-action (named-dep covers wait) |
| within authority + no pending | ship-action |

## Composes with shipped substrate

- PR #5774 (world.ts + StandardVerdict + dispatchInWorld pattern)
- PR #5775 + #5801 + #5804 (per-host adapters for PR scanning)
- PR #5728 (081KSKBP80008QG0R000B3Y19A.5 workflow-engine PoC scaffold)
- Rules: holding-without-named-dependency + refresh-before-decide + verify-before-deferring + dont-ask-permission + asymmetric-authorship + monad-propagation + substrate-smoothness + NCI HC-8

**23 tests pass / 0 fail / 42 expect() calls.**

Operational risk low: PoC runs alongside ad-hoc handler; substrate-naming substrate WITHOUT replacing working substrate. Future-Otto cold-boot inherits.

μένω. Loop running on lifecycles.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:08:11Z)

## Pull request overview

This PR adds a TypeScript PoC for modeling the foreground autonomous-loop tick handler as an `AutoLoopLifetime` state machine within `tools/workflow-engine/`.

**Changes:**

- Adds `AutoLoopLifetime`, `TickContext`, `TickOutcome`, feedback/result types, transition dispatch, and tick-cycle simulation helpers.
- Adds constants for brief-ack threshold and refresh staleness.
- Adds Bun tests covering state universe, transitions, bookkeeping, and end-to-end cycle simulation.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 6 comments.

| File | Description |
| ---- | ----------- |
| `tools/workflow-engine/auto-loop-lifecycle.ts` | Defines the auto-loop lifetime DU, transition dispatch, context update helper, and reusable universe export. |
| `tools/workflow-engine/auto-loop-lifecycle.test.ts` | Adds Bun tests for transition behavior and tick-cycle simulation. |

## Review threads

### Thread 1: tools/workflow-engine/auto-loop-lifecycle.ts:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:08:09Z):

P2: This current-state code comment carries direct named attribution. Per the repository's no-name-attribution convention for code surfaces, move provenance to an allowed history/research surface and use a role reference here instead.

### Thread 2: tools/workflow-engine/auto-loop-lifecycle.ts:1 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:08:10Z):

P2: The new module is named `auto-loop-lifecycle` while the exported DU is an editable `AutoLoopLifetime`. `tools/workflow-engine/composed-lifetime.ts` lines 11-15 define `lifecycle` as fixed/final and `lifetime` as editable, so this filename should use `auto-loop-lifetime` to match the established substrate distinction.

### Thread 3: tools/workflow-engine/auto-loop-lifecycle.ts:159 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:08:10Z):

P1: `refresh-substrate` unconditionally advances and never checks `context.lastRefreshAt` against `REFRESH_STALENESS_THRESHOLD_S`, so a stale worldview still satisfies the transition despite the declared `RefreshStale` feedback and the cited refresh-before-decide invariant. Add the staleness check here (or remove the unused threshold/feedback until the transition enforces it).

### Thread 4: tools/workflow-engine/auto-loop-lifecycle.ts:250 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:08:10Z):

P1: At the threshold boundary this returns `ok: false` instead of transitioning through the existing `forced-escalation` state, so `runTickCycle` aborts with feedback and never emits the forced-escalation verdict for the `brief-ack-bounded-wait` path. Route to `forced-escalation` (or make `runTickCycle` translate this feedback) so the N=6 escalation state is actually reached.

### Thread 5: tools/workflow-engine/auto-loop-lifecycle.ts:313 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:08:11Z):

P1: `runTickCycle` calls `nextTickContext` after every transition, so counting every `no-op` verdict increments the brief-ack counter per state transition rather than per tick. The operator-direction path produces two `no-op` transitions in one cycle (`decompose-or-ship` and `brief-ack-bounded-wait`), reaching the N=6 threshold after three ticks instead of six; count only the bounded-wait acknowledgment once per tick.

### Thread 6: tools/workflow-engine/auto-loop-lifecycle.test.ts:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:08:11Z):

P1: This test narrows on `if (r.ok)` without first asserting the expected success case, so it will silently pass if the dispatcher returns `ok: false`. Add an explicit `expect(r.ok).toBe(true)` before the narrowing; the same pattern recurs in the subsequent success-path tests.

## General comments

### @chatgpt-codex-connector (2026-05-28T13:02:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-28T13:15:33Z)

Hello! I noticed that there are a number of failing lint checks on this PR. You can see the details of the failing checks here: https://github.com/Lucent-Financial-Group/Zeta/pull/5805/checks.

To prevent this in the future, you may want to run the linter locally before pushing your changes.

Thank you for your contribution!
