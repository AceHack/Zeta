---
pr_number: 5071
title: "Build Agentic Organization package architecture slice"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-26T02:41:02Z"
merged_at: "2026-05-26T02:58:03Z"
closed_at: "2026-05-26T02:58:03Z"
head_ref: "codex/agentic-org-package-ca-clean"
base_ref: "main"
archived_at: "2026-05-27T19:46:31Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5071: Build Agentic Organization package architecture slice

## PR description

## Summary

- Adds the package-first Agentic Organization implementation slice on the Node/Nest-compatible TypeScript stack.
- Wires command outcome persistence through generic ports with Cockroach as a replaceable adapter, including idempotency race handling.
- Adds worker/event ingestion, NATS/Cockroach boundaries, observability contracts, OpenSpec scenarios, and docs aligned to the Agentic Organization north star.
- Adds the first `@agentic-org/policy` package and gates command execution through generic `CommandAuthorizationPort` / `HatAuthorityPort` checks before idempotency lookup, handler dispatch, or persistence.
- Documents remaining policy-visibility work: durable denial observation and allowed policy-decision projection into audit/outbox envelopes before real API/MCP/Hermes/Temporal/Dapr entrypoints are exposed.

## Validation

- npm test
- npm run typecheck
- git diff --check
- subagent review: architecture/SOLID/vendor boundaries passed
- subagent review: correctness/TDD/policy gate behavior passed
- subagent review: mission/docs/north-star alignment passed

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:44:43Z)

## Pull request overview

This PR expands the Agentic Organization TypeScript “package-first” slice by adding inbound event ingestion (with inbox dedupe + reaction plan persistence), a worker host/app runtime composition layer, and governance/observability contracts to keep adapters behind ports and keep tests out of production source trees.

**Changes:**

- Adds event ingestion processor + stores (in-memory + Cockroach adapter) to support inbox receipts, payload-conflict detection, and reaction plan persistence behind generic ports.
- Adds `@agentic-org/workers` run-once worker host and an `apps/workers` runtime shell that composes worker + NATS consumer loops and records telemetry.
- Extends governance checks (dependency boundaries + source layout), observability helpers (worker cycle + NATS consumer batch attributes), and updates OpenSpec/docs to match the new slice contracts.

### Reviewed changes

Copilot reviewed 67 out of 67 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| openspec/specs/agentic-organization/spec.md | Adds scenarios for effect-returning command handlers, vendor boundaries, source layout governance, event ingestion/NATS consumer behavior, and worker/runtime expectations. |
| agentic-organization/tsconfig.json | Includes `apps/**/*.ts` in typechecking. |
| agentic-organization/packages/workers/test/worker-host.test.ts | Adds worker-host tests covering bounded cycles, idle, degraded lanes, and per-event failure handling. |
| agentic-organization/packages/workers/src/worker-host.ts | Introduces run-once worker host composing outbox publishing + inbound ingestion via ports. |
| agentic-organization/packages/workers/src/index.ts | Exports worker host types/constructors. |
| agentic-organization/packages/state/src/index.ts | Re-exports event-ingestion store types and in-memory store factory. |
| agentic-organization/packages/state/src/in-memory-organization-store.ts | Switches to single `recordCommandOutcome` persistence port (idempotency + effects). |
| agentic-organization/packages/state/src/event-ingestion-store.ts | Adds generic event-ingestion store port + in-memory implementation for receipts/reaction plans. |
| agentic-organization/packages/state-cockroach/test/cockroach-schema.test.ts | Updates schema test to include inbox receipts + reaction plan tables. |
| agentic-organization/packages/state-cockroach/test/cockroach-outbox-event-source.test.ts | Fixes test import path to use `../src/...`. |
| agentic-organization/packages/state-cockroach/test/cockroach-event-ingestion-store.test.ts | Adds Cockroach event-ingestion store tests for claim/transaction batching + null normalization. |
| agentic-organization/packages/state-cockroach/test/cockroach-command-state-store.test.ts | Adds Cockroach command outcome transaction batching + replay/conflict behavior tests. |
| agentic-organization/packages/state-cockroach/src/index.ts | Exports Cockroach event-ingestion store adapter. |
| agentic-organization/packages/state-cockroach/src/cockroach-schema.ts | Adds inbox receipts and reaction plans tables to Cockroach schema generation. |
| agentic-organization/packages/state-cockroach/src/cockroach-event-ingestion-store.ts | Implements Cockroach-backed inbox receipt + reaction plan persistence behind SQL executor seam. |
| agentic-organization/packages/state-cockroach/src/cockroach-command-state-store.ts | Refactors command persistence to `recordCommandOutcome` with transaction boundary + claim semantics. |
| agentic-organization/packages/state-cockroach/src/cockroach-command-state-store.test.ts | Removes old in-src test (migrated to `test/`). |
| agentic-organization/packages/state-cockroach/migrations/0001_agentic_org_core_state.sql | Extends migration with inbox receipts + reaction plans tables. |
| agentic-organization/packages/runtime/test/event-ingestion.test.ts | Adds tests for inbox dedupe, payload conflicts, and pending-receipt retry behavior. |
| agentic-organization/packages/runtime/test/event-automation.test.ts | Fixes test import path to use `../src/...`. |
| agentic-organization/packages/runtime/src/reaction-plan.ts | Re-exports reaction plan types from domain instead of defining duplicates. |
| agentic-organization/packages/runtime/src/index.ts | Exports event-ingestion processor public API. |
| agentic-organization/packages/runtime/src/event-ingestion.ts | Adds runtime event ingestion processor: inbox check → rule eval → record outcome via store port. |
| agentic-organization/packages/README.md | Updates package list, slice flow, and validation commands to include workers + inbound ingestion. |
| agentic-organization/packages/observability/test/workflow-visibility.test.ts | Fixes test import path to use `../src/...`. |
| agentic-organization/packages/observability/test/span-attributes.test.ts | Fixes test import path to use `../src/...`. |
| agentic-organization/packages/observability/test/nats-consumer-attributes.test.ts | Adds tests for NATS consumer batch attribute projection. |
| agentic-organization/packages/observability/src/worker-cycle-attributes.ts | Adds worker-cycle attribute projection helper. |
| agentic-organization/packages/observability/src/nats-consumer-attributes.ts | Adds NATS consumer batch attribute projection helper. |
| agentic-organization/packages/observability/src/index.ts | Exports new observability helpers. |
| agentic-organization/packages/messaging/test/subject-builder.test.ts | Fixes test import path to use `../src/...`. |
| agentic-organization/packages/messaging/test/outbox-publisher.test.ts | Updates expected messaging domain + subject shape; fixes import path. |
| agentic-organization/packages/messaging/src/outbox-publisher.ts | Splits messaging domains (supervisor signal vs work item) and updates resolver. |
| agentic-organization/packages/messaging-nats/test/nats-jetstream-event-publisher.test.ts | Fixes test import path; updates subject expectation. |
| agentic-organization/packages/messaging-nats/test/nats-jetstream-event-consumer.test.ts | Adds tests for NATS consumer ack/terminate/DLQ/nack behavior and counters. |
| agentic-organization/packages/messaging-nats/src/nats-jetstream-event-consumer.ts | Adds NATS JetStream consumer adapter: decode → ingest → ack/nack/terminate + DLQ policy. |
| agentic-organization/packages/messaging-nats/src/index.ts | Exports new consumer adapter API. |
| agentic-organization/packages/governance/test/package-dependency-boundaries.test.ts | Adds governance tests for dependency boundaries + source layout + app boundary. |
| agentic-organization/packages/governance/src/package-dependency-boundaries.ts | Adds source layout validation and expands boundary rule taxonomy. |
| agentic-organization/packages/governance/src/package-dependency-boundaries.test.ts | Removes old in-src test (migrated to `test/`). |
| agentic-organization/packages/governance/src/index.ts | Exports new governance APIs/types. |
| agentic-organization/packages/domain/test/work-item-state-machine.test.ts | Fixes test import path to use `../src/...`. |
| agentic-organization/packages/domain/test/hat-communication-brief.test.ts | Fixes test import paths to use `../src/...`. |
| agentic-organization/packages/domain/test/event-envelope.test.ts | Fixes test import path to use `../src/...`. |
| agentic-organization/packages/domain/src/reaction-plan.ts | Introduces domain-owned reaction plan types/enums. |
| agentic-organization/packages/domain/src/index.ts | Exports reaction plan types/enums. |
| agentic-organization/packages/application/test/send-supervisor-signal.test.ts | Updates test to assert effect-returning handler outcome (no direct state writes). |
| agentic-organization/packages/application/test/command-pipeline.test.ts | Adds pipeline tests for outcome-port persistence, replay/conflict outcomes, and failure behavior. |
| agentic-organization/packages/application/src/ports.ts | Introduces `recordCommandOutcome` port and `CommandEffects` contract. |
| agentic-organization/packages/application/src/index.ts | Exports new handler outcome/ports/types. |
| agentic-organization/packages/application/src/handlers/send-supervisor-signal.ts | Refactors handler to return `{ result, effects }` instead of writing state. |
| agentic-organization/packages/application/src/command-pipeline.ts | Refactors pipeline to persist via `recordCommandOutcome` and handle replay/conflict outcomes. |
| agentic-organization/packages/application/src/command-pipeline.test.ts | Removes old in-src test (migrated to `test/`). |
| agentic-organization/packages/application/src/command-handler-registry.ts | Updates handler contract to return typed outcome (result + effects). |
| agentic-organization/package.json | Updates test script glob to new `test/` layout and includes app tests. |
| agentic-organization/docs/V0_EXECUTABLE_CONTRACT.md | Refines V0 contract language to route capability inputs through supervisor signals/triage. |
| agentic-organization/docs/TECHNICAL_CA_PACKAGE_ARCHITECTURE.md | Documents new vendor-port boundaries, ingestion/worker runtime behavior, and env contract. |
| agentic-organization/docs/README.md | Adds North Star alignment checkpoint doc to docs index. |
| agentic-organization/docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md | Adds alignment checkpoint doc capturing drift list and priorities. |
| agentic-organization/docs/FIRST_IMPLEMENTATION_SLICE.md | Updates slice description to include outcome persistence, ingestion, workers app shell, and telemetry. |
| agentic-organization/apps/workers/test/worker-runtime.test.ts | Adds tests for worker runtime loop orchestration + telemetry + degraded conditions. |
| agentic-organization/apps/workers/test/worker-config.test.ts | Adds tests for typed env parsing + validation errors. |
| agentic-organization/apps/workers/test/worker-composition.test.ts | Adds tests for composition root factory wiring. |
| agentic-organization/apps/workers/src/worker-runtime.ts | Adds workers runtime host: runs loops, records telemetry, returns healthy/degraded with failures. |
| agentic-organization/apps/workers/src/index.ts | Exports app runtime/config/composition APIs. |
| agentic-organization/apps/workers/src/config.ts | Implements typed env parsing for worker runtime config. |
| agentic-organization/apps/workers/src/composition.ts | Adds composition root that binds config + ports to runtime. |
| agentic-organization/apps/workers/README.md | Documents responsibilities/boundaries/config contract for `apps/workers`. |
</details>

## Review threads

### Thread 1: agentic-organization/packages/messaging-nats/src/nats-jetstream-event-consumer.ts:201 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:44:43Z):

P0: `terminateWithDeadLetter` (and its callers) don’t handle failures from `deadLetterPublisher.publish(...)` or `message.terminate()`. If either throws, the batch aborts and the message is left neither acked/nacked/terminated, which can stall delivery and starve later messages. Consider wrapping DLQ+terminate in a try/catch and falling back to `negativeAcknowledge()` (and counter updates) when dead-lettering/termination fails.

### Thread 2: agentic-organization/packages/state-cockroach/src/cockroach-event-ingestion-store.ts:105 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:44:43Z):

P0: After inserting reaction plans, the code always returns `Processed` without verifying that `MarkInboxReceiptProcessed` actually marked the receipt (the UPDATE can no-op if another transaction completed the receipt first). That can lead to reaction plans being inserted even though the receipt wasn’t successfully claimed/completed by this transaction. Consider making the UPDATE return a row (e.g., `RETURNING event_id`) and treating a missing row as a duplicate/claim-loss outcome (and ensuring the transaction rolls back in that case).

## General comments

### @chatgpt-codex-connector (2026-05-26T02:41:07Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.
