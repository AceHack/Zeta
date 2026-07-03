---
pr_number: 5035
title: "fix(agentic-org): split outbox messaging domains"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:47:14Z"
merged_at: "2026-05-26T00:20:02Z"
closed_at: "2026-05-26T00:20:02Z"
head_ref: "codex/pr4990-agentic-org-reconcile"
base_ref: "main"
archived_at: "2026-05-27T19:47:57Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5035: fix(agentic-org): split outbox messaging domains

## PR description

## Summary

- salvage the safe PR #4990 follow-up delta by splitting outbox messaging domains into supervisor-signal and work-item subjects
- keep the stale branch replay out of the PR because it conflicts with current main and would regress newer outbox locking/test layout
- include claim/release history for task-pr4990-agentic-org-reconcile

## Checks

- npm test -- --test-name-pattern=outbox publisher
- npm run typecheck

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:49:51Z)

## Pull request overview

This PR updates the Agentic Organization messaging outbox publisher to route events into more specific NATS subject domains, separating supervisor-signal traffic from work-item traffic.

**Changes:**

- Split `AgenticMessagingDomain` from a single `work` domain into `supervisor_signal` and `work_item`.
- Update `resolveAgenticMessagingDomain` to map supervisor-signal and work-item event types to their respective domains.
- Extend outbox publisher tests to validate the new domain resolution and updated published subject expectation.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| agentic-organization/packages/messaging/src/outbox-publisher.ts | Introduces new messaging domains and updates the event-type→domain resolver used for subject construction. |
| agentic-organization/packages/messaging/src/outbox-publisher.test.ts | Updates assertions for domain resolution and the emitted subject string from `publishNextBatch`. |

## Review threads

### Thread 1: agentic-organization/packages/messaging/src/outbox-publisher.ts:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:49:50Z):

P1: With domains now set to "supervisor_signal" / "work_item" while `AgenticEventType` values already start with the same prefix (e.g., `supervisor_signal.sent`), subjects produced by `buildAgenticEventSubject` become redundant (e.g., `<domain>.<eventType>` => `supervisor_signal.supervisor_signal.sent`). If the intent is `agentic-org.<env>.<org>.<domain>.<event>` with distinct segments, consider either (a) making event type identifiers domain-relative (e.g., `sent`, `changed`, `state_changed`) or (b) teaching the subject builder/outbox publisher to strip the `${domain}.` prefix from `eventType` when present.

### Thread 2: agentic-organization/packages/messaging/src/outbox-publisher.test.ts:65 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:49:51Z):

P1: This expectation locks in the duplicated subject shape (`...supervisor_signal.supervisor_signal.sent`). If the domain split is meant to avoid mixing supervisor signals and work items while keeping `<domain>.<event>` distinct, adjust the subject-building logic (or event type identifiers) so the published subject becomes `...supervisor_signal.sent` (or similar) rather than repeating the domain prefix.

### Thread 3: agentic-organization/packages/messaging/src/outbox-publisher.test.ts:33 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:49:51Z):

P2: The new `WorkItem` domain mapping is only validated via `resolveAgenticMessagingDomain`; there isn't a publish-path assertion that `publishNextBatch` emits the expected subject for a work-item event. Consider adding a second outbox event with `WorkItemChanged`/`WorkItemStateChanged` and asserting the published subject uses the correct domain to prevent regressions in subject composition.

## General comments

### @chatgpt-codex-connector (2026-05-25T23:47:18Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
