---
pr_number: 5007
title: "feat(agentic-org): replay NATS outbox follow-up"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T22:13:25Z"
merged_at: "2026-05-25T22:46:02Z"
closed_at: "2026-05-25T22:46:02Z"
head_ref: "claim/task-pr-4990-nats-outbox-replay"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5007: feat(agentic-org): replay NATS outbox follow-up

## PR description

## Summary

- replays the post-#4990 NATS outbox publisher and replaceable state-adapter commits onto current main
- keeps stale-base governance/backlog deletions out of the branch
- includes claim and release commits for task-pr-4990-nats-outbox-replay per the git-native claim protocol

## Validation

- npm --prefix agentic-organization test
- npm --prefix agentic-organization run typecheck

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T22:17:56Z)

## Pull request overview

Replays and extends the Agentic Organization “outbox → publisher → NATS adapter” slice by introducing generic outbox publishing ports, a Cockroach-backed outbox event source, and a JetStream event publisher adapter, while updating OpenSpec + docs to reinforce replaceable durable-adapter boundaries.

**Changes:**

- Add `OutboxEventSource` port (state) plus a Cockroach-backed implementation for reading/publishing outbox rows.
- Add a generic outbox publisher (messaging) and a JetStream `EventPublisher` adapter (messaging-nats).
- Expand governance dependency-boundary checks and update OpenSpec/docs to reflect durable-adapter replaceability and outbox publication semantics.

### Reviewed changes

Copilot reviewed 19 out of 19 changed files in this pull request and generated 5 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| openspec/specs/agentic-organization/spec.md | Updates spec to include durable-adapter replaceability and outbox publisher requirements. |
| agentic-organization/packages/state/src/outbox-event-source.ts | Introduces `OutboxEventSource` port for claiming and marking outbox events published. |
| agentic-organization/packages/state/src/index.ts | Re-exports new outbox source port types. |
| agentic-organization/packages/state-cockroach/src/index.ts | Exposes Cockroach outbox event source factory/types. |
| agentic-organization/packages/state-cockroach/src/cockroach-outbox-event-source.ts | Adds Cockroach implementation of the outbox event source. |
| agentic-organization/packages/state-cockroach/src/cockroach-outbox-event-source.test.ts | Adds unit coverage for the Cockroach outbox event source. |
| agentic-organization/packages/README.md | Updates package boundary documentation to include outbox publisher and NATS adapter. |
| agentic-organization/packages/messaging/src/outbox-publisher.ts | Adds generic outbox publisher + domain resolver + publisher port. |
| agentic-organization/packages/messaging/src/outbox-publisher.test.ts | Adds unit coverage for outbox publishing loop. |
| agentic-organization/packages/messaging/src/index.ts | Re-exports outbox publisher/public interfaces. |
| agentic-organization/packages/messaging-nats/src/nats-jetstream-event-publisher.ts | Adds JetStream adapter implementing `EventPublisher` with headers/message ID. |
| agentic-organization/packages/messaging-nats/src/nats-jetstream-event-publisher.test.ts | Adds unit coverage for JetStream adapter serialization/headers/message ID. |
| agentic-organization/packages/messaging-nats/src/index.ts | Exposes JetStream adapter entrypoints/types. |
| agentic-organization/packages/governance/src/package-dependency-boundaries.ts | Extends boundary rule enum to include messaging + state-adapter rules. |
| agentic-organization/packages/governance/src/package-dependency-boundaries.test.ts | Adds new boundary rules for messaging and Cockroach state adapter imports. |
| agentic-organization/docs/V0_SCHEMA_AND_COMMANDS.md | Updates schema prose to emphasize durable adapter boundary (Cockroach as first impl). |
| agentic-organization/docs/V0_EXECUTABLE_CONTRACT.md | Updates executable contract to reflect Cockroach as first durable adapter. |
| agentic-organization/docs/TECHNICAL_CA_PACKAGE_ARCHITECTURE.md | Updates package architecture docs to include outbox publisher + messaging-nats adapter. |
| agentic-organization/docs/FIRST_IMPLEMENTATION_SLICE.md | Updates slice narrative to include outbox publisher + NATS adapter and boundary rules. |
</details>

## Review threads

### Thread 1: agentic-organization/packages/state-cockroach/src/cockroach-outbox-event-source.ts:68 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:17:55Z):

P0: `claimUnpublishedOutboxEvents` isn’t an actual claim—this query is a plain `SELECT ... WHERE published_at IS NULL LIMIT $1`, so multiple publishers can read (and publish) the same rows concurrently. To make the outbox publisher truly idempotent under concurrency, switch to an atomic claim pattern (e.g., `UPDATE ... SET claimed_at/claimed_by ... WHERE published_at IS NULL ... RETURNING ...`, or `SELECT ... FOR UPDATE SKIP LOCKED` + lease columns) or rename the method to reflect non-exclusive listing semantics.

### Thread 2: agentic-organization/packages/state-cockroach/src/cockroach-outbox-event-source.ts:95 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:17:55Z):

P1: `mark_outbox_event_published` will overwrite `published_at` if called twice (e.g., due to concurrent publishers or retries), losing the original publish timestamp. Consider guarding the update with `AND published_at IS NULL` and returning/validating the affected row count (or using `RETURNING`) so double-publish attempts don’t mutate already-published rows silently.

### Thread 3: agentic-organization/packages/messaging/src/outbox-publisher.ts:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:17:56Z):

P1: `AgenticEventType` values already include a prefix (e.g. `supervisor_signal.sent`), and `buildAgenticEventSubject` concatenates `...<domain>.<eventType>`. Returning `domain: "supervisor_signal"` here produces subjects like `...supervisor_signal.supervisor_signal.sent`, which conflicts with the existing subject contract test (`domain: "work"` + `work_item.changed`). Either map `resolveDomain` to the broader domain segment (e.g. "work"), or adjust the event-type/domain split consistently (and update subject-builder tests/spec accordingly).

### Thread 4: agentic-organization/packages/messaging/src/outbox-publisher.test.ts:57 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:17:56Z):

P1: This test locks in a subject shape with a duplicated segment (`...supervisor_signal.supervisor_signal.sent`). Given the existing `subject-builder` contract test expects a broader domain segment (`...work.work_item.changed`), this likely should assert the non-duplicated shape (or the subject-builder contract should be updated in the same PR if the intended subject taxonomy changed).

### Thread 5: agentic-organization/packages/governance/src/package-dependency-boundaries.test.ts:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:17:56Z):

P1: The spec/docs in this PR emphasize that messaging packages must stay durable-adapter/database-client free, but the `Messaging` boundary rule here only forbids `messaging-nats` and `nats`. To keep the rule aligned with the replaceable-adapter requirement, consider adding the same DB-client fragments used for `Application` (e.g., `drizzle`, `pg`, `postgres`, etc.) to the `Messaging` forbidden list as well.

## General comments

### @chatgpt-codex-connector (2026-05-25T22:15:07Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-25T22:45:49Z)

## Thread sweep — all 5 Copilot review threads are stale-but-fixed at HEAD `779720f`

Per [`.claude/rules/blocked-green-ci-investigate-threads.md`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/.claude/rules/blocked-green-ci-investigate-threads.md) `verify-also-on-stale-but-fresh-looking findings` — verified each thread's claim against current branch state, resolving no-op:

| Thread | Reviewer claim | Status at HEAD |
|---|---|---|
| P0 atomic claim | `claimUnpublishedOutboxEvents` is plain `SELECT ... WHERE published_at IS NULL` | **FIXED** — uses `UPDATE ... FOR UPDATE SKIP LOCKED` with `claimed_at` + `claim_expires_at` (lines 71-86) |
| P1 mark-published guard | `mark_outbox_event_published` overwrites timestamp on retry | **FIXED** — guarded with `AND published_at IS NULL` + `RETURNING outbox_event_id` (lines 87-95) |
| P1 subject domain duplication | Returning `domain: "supervisor_signal"` produces `...supervisor_signal.supervisor_signal.sent` | **FIXED** — `outbox-publisher.ts` line 66 uses injected `resolveDomain` callback; impl returns broader `work` domain |
| P1 test locks duplicated shape | Test asserts `...supervisor_signal.supervisor_signal.sent` | **FIXED** — `outbox-publisher.test.ts` line 57 asserts `agentic-org.local.org-lfg.work.supervisor_signal.sent` (non-duplicated) |
| P1 Messaging boundary DB fragments | `Messaging` only forbids `messaging-nats` + `nats`; should also forbid DB clients | **FIXED** — `forbiddenImportFragments` includes `drizzle`, `pg`, `postgres` alongside `nats` |

Auto-merge stays armed; threads resolve no-op.

Co-Authored-By: Claude <noreply@anthropic.com>

### @AceHack (2026-05-25T22:46:13Z)

Resolved the five Copilot review threads after verifying current head `779720fb5934d3724d9bf3ac2fdf6cadfbfcc2e4`.

Evidence:

- `claimUnpublishedOutboxEvents` now uses an atomic `UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING` claim with lease columns.
- `markOutboxEventPublished` now guards `AND published_at IS NULL`, uses `RETURNING`, and rejects duplicate or stale publish marks.
- Supervisor-signal outbox subjects now use the broader `work` domain, avoiding duplicated subject segments.
- Messaging boundary tests now forbid durable DB-client fragments (`drizzle`, `pg`, `postgres`).
- Local checks passed in the claim worktree: `npm --prefix agentic-organization test` (22 tests) and `npm --prefix agentic-organization run typecheck`.
- `bun tools/github/poll-pr-gate.ts 5007` reports all required checks green, no failing checks, and auto-merge armed.

Resolved review threads: `PRRT_kwDOSF9kNM6EonDK`, `PRRT_kwDOSF9kNM6EonDT`, `PRRT_kwDOSF9kNM6EonDX`, `PRRT_kwDOSF9kNM6EonDg`, `PRRT_kwDOSF9kNM6EonDs`.

Headless-Origin: codex-launchd-loop
Headless-Surface: codex-background-service
Headless-Session: codex/launchd-loop
Codex-Loop-Run-Id: 20260525T224331Z
