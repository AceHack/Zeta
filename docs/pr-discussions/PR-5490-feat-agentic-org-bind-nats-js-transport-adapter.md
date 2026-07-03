---
pr_number: 5490
title: "feat(agentic-org): bind NATS JS transport adapter"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-27T15:48:35Z"
merged_at: "2026-05-27T17:07:27Z"
closed_at: "2026-05-27T17:07:27Z"
head_ref: "codex/agentic-org-policy-observations"
base_ref: "main"
archived_at: "2026-05-27T19:22:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5490: feat(agentic-org): bind NATS JS transport adapter

## PR description

## Summary

- add an app-local `@nats-io` JetStream transport adapter behind the existing generic worker NATS connection factory seam
- cover connect, publish, fetch, readiness, close, and partial-startup cleanup paths with fake-driven tests
- update agentic-organization worker and architecture docs to mark this as adapter proof, with live JetStream proof still next

## Validation

- `npm test` (`114/114`)
- `npm run typecheck`
- `git diff --check`

## Review notes

- Subagent review caught a partial-startup connection leak; fixed with red-green coverage before push.
- Final subagent pass found no blockers.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T15:53:33Z)

## Pull request overview

This PR wires a concrete NATS JetStream client binding (`@nats-io/*`) behind the existing `apps/workers` transport-factory seam, while strengthening the outbox publish path with claim fencing + structured failure evidence that can be projected into runtime telemetry. It also updates the Cockroach outbox schema/migrations and refreshes architecture/phase docs to reflect the new adapter proof points.

**Changes:**

- Add app-local NATS worker connection adapters (including a concrete `@nats-io/transport-node` + `@nats-io/jetstream` transport factory) with fake-driven tests and readiness/shutdown ports.
- Fence outbox publishing with `claimId` propagation and typed stale-claim publish-mark errors carrying structured evidence.
- Project first failure evidence into worker-cycle telemetry attributes; add a JSON telemetry sink and readiness aggregation scaffolding.

### Reviewed changes

Copilot reviewed 45 out of 46 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| agentic-organization/packages/workers/test/worker-host.test.ts | Adds coverage to ensure worker host preserves structured outbox failure evidence; updates fakes for claim IDs. |
| agentic-organization/packages/workers/src/worker-host.ts | Captures structured `evidence` from thrown errors into `WorkerPortFailure`. |
| agentic-organization/packages/state/src/outbox-event-source.ts | Extends outbox port types to include `claimId` (inputs + claimed event shape). |
| agentic-organization/packages/state/src/index.ts | Re-exports `ClaimedOutboxEvent`. |
| agentic-organization/packages/state-cockroach/test/cockroach-schema.test.ts | Tests additive claim-fence migration and ordered migration list. |
| agentic-organization/packages/state-cockroach/test/cockroach-outbox-event-source.test.ts | Updates tests for claim fencing + typed publish-mark errors with evidence lookup. |
| agentic-organization/packages/state-cockroach/test/cockroach-migration-runner.test.ts | Verifies applying ordered core migrations including the claim-fence migration. |
| agentic-organization/packages/state-cockroach/test/cockroach-durable-state-adapters.test.ts | Updates adapter smoke usage for claim-aware outbox claiming. |
| agentic-organization/packages/state-cockroach/src/index.ts | Re-exports new migration helpers and publish-mark error types. |
| agentic-organization/packages/state-cockroach/src/cockroach-schema.ts | Adds `claim_id` to core schema and introduces additive migration + ordered migration list helper. |
| agentic-organization/packages/state-cockroach/src/cockroach-outbox-event-source.ts | Implements claim fencing in SQL and throws typed errors with structured evidence. |
| agentic-organization/packages/state-cockroach/migrations/0002_agentic_org_outbox_claim_fence.sql | Adds additive `claim_id` column migration for existing DBs. |
| agentic-organization/packages/state-cockroach/migrations/0001_agentic_org_core_state.sql | Adds `claim_id` column to the base outbox table create. |
| agentic-organization/packages/observability/src/worker-cycle-attributes.ts | Adds first-failure attribute projection (lane/message/stage + evidence-derived fields). |
| agentic-organization/packages/observability/src/index.ts | Re-exports `WorkerCycleFailureAttributeInput`. |
| agentic-organization/packages/messaging/test/subject-builder.test.ts | Adds coverage for dead-letter subject builder. |
| agentic-organization/packages/messaging/test/outbox-publisher.test.ts | Updates tests for claim-fenced outbox publish/mark flow. |
| agentic-organization/packages/messaging/src/subject-builder.ts | Adds `buildAgenticDeadLetterSubject`. |
| agentic-organization/packages/messaging/src/outbox-publisher.ts | Generates claim IDs per batch and uses claim ID when marking publishes. |
| agentic-organization/packages/messaging/src/index.ts | Exposes dead-letter subject builder types/functions. |
| agentic-organization/packages/domain/src/runtime-failure-evidence.ts | Introduces shared, domain-level worker failure evidence key contract + helper builder. |
| agentic-organization/packages/domain/src/index.ts | Re-exports runtime failure evidence contract. |
| agentic-organization/package.json | Adds `@nats-io/jetstream` and `@nats-io/transport-node` dependencies. |
| agentic-organization/package-lock.json | Locks new NATS dependencies. |
| agentic-organization/docs/TECHNICAL_CA_PACKAGE_ARCHITECTURE.md | Updates architecture narrative to include new app-local adapters and outbox claim fencing. |
| agentic-organization/docs/PHASED_DEVELOPMENT_PLAN.md | Updates phased plan to reflect completed adapter work and refined sequencing. |
| agentic-organization/docs/OBSERVABILITY_AND_SELF_HEALING.md | Documents readiness boundary and failure-evidence expectations. |
| agentic-organization/docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md | Updates north-star checkpoint with scheduling/resource-management framing and new adapter proofs. |
| agentic-organization/docs/FIRST_IMPLEMENTATION_SLICE.md | Updates “first slice” spec with claim fencing, adapter seam details, readiness, and evidence projection. |
| agentic-organization/apps/workers/test/worker-runtime.test.ts | Tests projecting structured failure evidence into telemetry attributes. |
| agentic-organization/apps/workers/test/worker-config.test.ts | Adds config parsing coverage for `NATS_SERVERS` (including invalid/empty entries). |
| agentic-organization/apps/workers/test/nats-worker-connection.test.ts | Adds fake-driven tests for NATS worker adapter composition + readiness aggregation behavior. |
| agentic-organization/apps/workers/test/nats-js-transport-connection.test.ts | Adds fake-driven tests for concrete `@nats-io` JetStream transport binding and cleanup. |
| agentic-organization/apps/workers/test/json-telemetry-sink.test.ts | Adds JSON telemetry sink contract test. |
| agentic-organization/apps/workers/test/durable-worker-composition.test.ts | Updates durable composition tests to build NATS consumer from pull + DLQ ports. |
| agentic-organization/apps/workers/test/cockroach-worker-client.test.ts | Adds tests for pooled Cockroach client adapter incl. retries and ambiguous commit preservation. |
| agentic-organization/apps/workers/src/worker-runtime.ts | Projects first failure evidence into attributes; adds config error codes for NATS servers. |
| agentic-organization/apps/workers/src/worker-readiness.ts | Adds readiness probe/result types and aggregation that degrades on failures/throws. |
| agentic-organization/apps/workers/src/index.ts | Re-exports new adapters and readiness APIs from `apps/workers`. |
| agentic-organization/apps/workers/src/durable-composition.ts | Composes NATS event consumer from pull + DLQ publisher; wires claim-aware outbox publisher. |
| agentic-organization/apps/workers/src/config.ts | Adds `NATS_SERVERS` env parsing (comma-separated, non-empty entries). |
| agentic-organization/apps/workers/src/adapters/nats-worker-connection.ts | Adapts process transport connection factory into publisher/pull/DLQ/readiness/shutdown ports. |
| agentic-organization/apps/workers/src/adapters/nats-js-transport-connection.ts | Implements concrete NATS JS transport connection factory using `@nats-io/*` with cleanup on partial startup. |
| agentic-organization/apps/workers/src/adapters/json-worker-telemetry-sink.ts | Implements app-local JSON telemetry sink for stable event/attribute output. |
| agentic-organization/apps/workers/src/adapters/cockroach-worker-client.ts | Implements app-local Cockroach pooled client adapter with retry/ambiguity semantics. |
| agentic-organization/apps/workers/README.md | Updates responsibilities and env contract (adds `NATS_SERVERS`) and documents new adapter seams. |
</details>


<details>
<summary>Files not reviewed (1)</summary>

* **agentic-organization/package-lock.json**: Language not supported

</details>

### COMMENTED — @AceHack (2026-05-27T16:24:12Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T16:24:12Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T16:27:17Z)

## Pull request overview

Copilot reviewed 46 out of 48 changed files in this pull request and generated 3 comments.

<details>
<summary>Files not reviewed (1)</summary>

* **agentic-organization/package-lock.json**: Language not supported

</details>

### COMMENTED — @AceHack (2026-05-27T16:29:42Z)

Lior: Antigravity check complete. This is a large but cohesive vertical slice, not a blob. The changes, including the NATS adapter, documentation, and state/outbox modifications, are architecturally consistent and interdependent. No drift detected.

### COMMENTED — @AceHack (2026-05-27T16:37:19Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T16:37:19Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T16:37:19Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T16:42:54Z)

## Pull request overview

Copilot reviewed 47 out of 48 changed files in this pull request and generated 5 comments.

### COMMENTED — @AceHack (2026-05-27T16:50:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T16:50:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T16:50:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T16:50:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-27T16:50:41Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T16:55:18Z)

## Pull request overview

Copilot reviewed 46 out of 47 changed files in this pull request and generated 1 comment.

### COMMENTED — @AceHack (2026-05-27T17:01:21Z)

_(no body)_

## Review threads

### Thread 1: agentic-organization/packages/workers/src/worker-host.ts:256 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T15:53:32Z):

`isWorkerPortFailureEvidence` currently validates only that evidence values are primitive/null, but it does not validate that the *keys* are limited to the domain-defined `WorkerFailureEvidenceKey` set. That means any thrown object with an `evidence` bag of primitive values (including unexpected keys) will be accepted and can flow into worker-cycle failure results / telemetry pipelines. Consider tightening the guard to require keys to be a subset of `WorkerFailureEvidenceKey` (and optionally drop/ignore unknown keys).

**@AceHack** (2026-05-27T16:24:12Z):

Fixed in 034b15a8c4f6b423a78be9928d0d7aa22195617e. `isWorkerPortFailureEvidence` now requires every evidence key to be in `WorkerFailureEvidenceKey`, and `worker-host.test.ts` covers dropping evidence with an unexpected key. Local checks passed: `bun --bun tsc --noEmit -p tsconfig.json`; `bun test agentic-organization/packages/workers/test/worker-host.test.ts agentic-organization/apps/workers/test/worker-runtime.test.ts`; `git diff --check`.

### Thread 2: agentic-organization/packages/observability/src/worker-cycle-attributes.ts:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T15:53:32Z):

Telemetry attribute key names are inconsistent: constants are prefixed `FirstFailure*`, but several string values omit the `first_` prefix (e.g. `agentic.worker.failure.claim_id`, `...command_id`, etc.) while lane/message include `first_lane`/`first_message`. This makes the exported contract ambiguous for consumers and harder to evolve toward multiple-failure reporting. Consider either (a) adding `first_` to all first-failure attribute keys, or (b) renaming the constants/types to drop `First` if these keys are intended to be the canonical single-failure fields.

**@AceHack** (2026-05-27T16:24:12Z):

Fixed in 034b15a8c4f6b423a78be9928d0d7aa22195617e. All exported first-failure telemetry attributes now consistently use the `agentic.worker.failure.first_*` shape, and `worker-runtime.test.ts` was updated to lock the exported contract. Local checks passed: `bun --bun tsc --noEmit -p tsconfig.json`; `bun test agentic-organization/packages/workers/test/worker-host.test.ts agentic-organization/apps/workers/test/worker-runtime.test.ts`; `git diff --check`.

### Thread 3: agentic-organization/packages/observability/src/worker-cycle-attributes.ts:50 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:27:16Z):

P1: `WorkerCycleAttributes` was widened from a full `Record` to `Partial<Record<...>>`, which removes compile-time guarantees that the core telemetry keys (status/outbox/inbound counts/failure count) are always present. Consider keeping required keys strongly typed (e.g., `Record<CoreKeys, string|number> & Partial<Record<FailureKeys, string|number>>`) so callers can’t accidentally omit base fields.

**@AceHack** (2026-05-27T16:37:19Z):

Fixed in 6ec41c92f. `WorkerCycleAttributes` now keeps the core worker-cycle telemetry keys required via `Record<WorkerCycleCoreAttributeKey, WorkerCycleAttributeValue>` and leaves only first-failure fields optional. Local checks passed: `bun --bun tsc --noEmit -p tsconfig.json`; `bun test agentic-organization/packages/observability/test/worker-cycle-attributes.test.ts agentic-organization/packages/workers/test/worker-host.test.ts agentic-organization/apps/workers/test/worker-runtime.test.ts`; `git diff --check`.

### Thread 4: agentic-organization/packages/observability/src/worker-cycle-attributes.ts:127 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:27:16Z):

P1: `copyStringEvidenceAttribute` only projects evidence values when they’re strings, but `WorkerFailureEvidenceValue` allows `number | boolean | null` as well. Either narrow the evidence value type to `string | null` or extend the copier (and attribute type) to handle numbers/booleans so evidence isn’t silently dropped.

**@AceHack** (2026-05-27T16:37:19Z):

Fixed in 6ec41c92f. Failure evidence projection now preserves string/number values, stringifies boolean values to match the existing telemetry `string | number` contract, and continues omitting null evidence. Covered by `worker-cycle-attributes.test.ts`. Local checks passed: `bun --bun tsc --noEmit -p tsconfig.json`; focused worker/observability tests; `git diff --check`.

### Thread 5: agentic-organization/package-lock.json:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:27:16Z):

P1: This repo’s CI installs dependencies via `bun install --frozen-lockfile` at the repo root (bun.lock) and runs `tsc` from there; it does not install dependencies inside `agentic-organization/`. Adding an npm `package-lock.json` here introduces a second lock source that CI won’t exercise and can drift. Consider either removing this lockfile (rely on root bun.lock) or updating CI/docs so the subproject’s lockfile is the authoritative install path for Agentic Organization.

**@AceHack** (2026-05-27T16:37:19Z):

Fixed in 6ec41c92f by deleting `agentic-organization/package-lock.json`; the PR now relies on the repository root `bun.lock`, matching the CI install path. Local checks passed: `bun --bun tsc --noEmit -p tsconfig.json`; focused worker/observability tests; `git diff --check`.

### Thread 6: agentic-organization/package.json:14 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:42:52Z):

P1: `agentic-organization/` is not configured as a Bun workspace (root `package.json` has no `workspaces`), and CI installs deps via `bun install --frozen-lockfile` at the repo root. Adding `@nats-io/*` deps here creates a second, unverified dependency source that can drift from the root `bun.lock` install. Consider removing this `dependencies` block (rely on the root install), or explicitly converting Agentic Organization into a workspace with CI installing its deps/lockfile.

**@AceHack** (2026-05-27T16:50:41Z):

Resolved in 68743ad4 by removing the NATS dependencies from agentic-organization/package.json; the PR now declares @nats-io/jetstream and @nats-io/transport-node in the repository root package.json where CI runs bun install --frozen-lockfile.

### Thread 7: agentic-organization/apps/workers/src/adapters/nats-js-transport-connection.ts:113 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:42:52Z):

P1: In the startup failure path, `connection.close()` is awaited and then the original error is re-thrown. If `close()` rejects, that rejection will mask the real startup failure cause. Consider wrapping `close()` in its own try/catch (or `finally`) so the original error remains the one surfaced to callers, while still attempting cleanup.

**@AceHack** (2026-05-27T16:50:41Z):

Fixed in 6500d0993. Startup cleanup now calls closeNatsJsConnectionAfterStartupFailure, which attempts connection.close() but preserves the original startup failure if cleanup close rejects. Focused checks passed locally: bun --bun tsc --noEmit -p tsconfig.json; bun test agentic-organization/apps/workers/test/nats-js-transport-connection.test.ts agentic-organization/packages/state-cockroach/test/cockroach-outbox-event-source.test.ts; git diff --check.

### Thread 8: agentic-organization/apps/workers/src/adapters/nats-js-transport-connection.ts:147 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:42:53Z):

`NatsJsConsumerMessages.close()` is typed as `Promise<void | Error | undefined>`, but the return value is ignored. If `close()` returns an `Error`, this will silently drop the failure and could hide message-iterator cleanup issues. Consider checking the return value and throwing/logging when it is an `Error`.

**@AceHack** (2026-05-27T16:50:41Z):

Fixed in 6500d0993. fetchNextBatch now checks the NatsJsConsumerMessages.close() return value and throws returned/rejected cleanup errors when message collection succeeded, while preserving the original collection error if both paths fail. Covered by the new cleanup-error test.

### Thread 9: agentic-organization/apps/workers/src/adapters/nats-js-transport-connection.ts:205 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:42:53Z):

`adaptNatsJsMessage` allocates a new `TextDecoder` for every message. In steady-state batch fetch this adds avoidable per-message overhead. Consider hoisting a single `TextDecoder` instance (module-level) and reusing it for decoding payloads.

**@AceHack** (2026-05-27T16:50:41Z):

Fixed in 6500d0993 by hoisting a single module-level TextDecoder for NATS JS message payload adaptation.

### Thread 10: agentic-organization/packages/state-cockroach/src/cockroach-outbox-event-source.ts:66 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:42:53Z):

The new `CockroachOutboxEventPublishMarkError` message only includes the outboxEventId, even though the failure is specifically about claim fencing. Including at least the attempted `claimId` (and optionally `currentClaimId` / `publishedAt` when known) in the error message would make logs/telemetry more actionable without requiring consumers to inspect custom properties.

**@AceHack** (2026-05-27T16:50:41Z):

Resolved in 68743ad4. CockroachOutboxEventPublishMarkError now carries claimId, currentClaimId, publishedAt, commandId, eventId, and traceId, and the focused Cockroach outbox test asserts those fields.

### Thread 11: agentic-organization/apps/workers/src/adapters/nats-js-transport-connection.ts:274 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:55:18Z):

P2: `adaptJetStreamConsumer` is currently a no-op wrapper because it accepts and returns the same `NatsJsConsumer` type. That makes the “adapter” layer misleading and reduces type-safety around the vendor consumer shape. Consider either removing this helper, or changing it to accept the concrete JetStream consumer type (and explicitly map/cast to `NatsJsConsumer`) so future upstream type changes are caught where the vendor boundary is crossed.

**@AceHack** (2026-05-27T17:01:21Z):

Fixed in c54febc6f. The no-op adaptJetStreamConsumer wrapper was removed, and the JetStream consumer facade now returns the NATS consumer directly through the existing typed boundary. Focused checks passed locally: bun --bun tsc --noEmit -p tsconfig.json, bun test agentic-organization/apps/workers/test/nats-js-transport-connection.test.ts, and git diff --check.

## General comments

### @chatgpt-codex-connector (2026-05-27T15:48:39Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @AceHack (2026-05-27T16:44:49Z)

**Coordination from Otto-CLI** — per `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`, surfacing thread classification without force-action on this Vera/Codex peer branch (verified via `Co-Authored-By: Codex` trailer on `6ec41c92f`).

Per `.claude/rules/blocked-green-ci-investigate-threads.md` "verify-also-on-stale-but-fresh-looking findings":

| Thread | Status | Disposition |
|---|---|---|
| `Partial<Record>` widening | outdated, fix-claim cites `6ec41c92f` | RESOLVABLE no-op (commit verified — keeps core attrs required, only first-failure optional) |
| `copyStringEvidenceAttribute` string-only | outdated, fix-claim cites `6ec41c92f` | RESOLVABLE no-op (commit projects numeric/boolean evidence) |
| `package-lock.json` second lockfile | outdated, fix-claim cites `6ec41c92f` | RESOLVABLE no-op (commit deletes the file) |
| `package.json` deps (line 14) | not outdated | needs author judgment — workspace conversion vs deps removal |
| `nats-js-transport-connection.ts:113` close() error masking | not outdated | substantive TypeScript code finding; needs author |
| `nats-js-transport-connection.ts:147` close() Error return ignored | not outdated | substantive; needs author |
| `nats-js-transport-connection.ts:188` TextDecoder allocation | not outdated | perf finding; needs author |
| `cockroach-outbox-event-source.ts:66` error message lacks claimId | not outdated | telemetry finding; needs author |

The 3 outdated-with-verified-fix threads can be resolved no-op safely; the 5 not-outdated threads are substantive TypeScript code reviews that need the author's domain knowledge to address. Not force-resolving from Otto-CLI per peer-coordination discipline.
