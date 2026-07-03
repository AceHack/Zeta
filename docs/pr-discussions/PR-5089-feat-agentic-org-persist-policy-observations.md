---
pr_number: 5089
title: "feat(agentic-org): persist policy observations"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-26T04:47:46Z"
merged_at: "2026-05-26T05:22:13Z"
closed_at: "2026-05-26T05:22:14Z"
head_ref: "codex/agentic-org-policy-observations"
base_ref: "main"
archived_at: "2026-05-27T19:44:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5089: feat(agentic-org): persist policy observations

## PR description

## Summary

Adds the next Agentic Organization runtime slice after #5081:

- persists denied policy decision observations behind generic policy store/reader ports
- adds a CockroachDB policy-observation adapter with scoped query support and canonical observation-hash conflict detection
- projects policy-denial observations into UI/agent workflow visibility records with typed weak-point indicators
- propagates idempotency keys through policy authorization traces
- updates architecture docs and OpenSpec for durable/queryable policy observations and replay-vs-conflict behavior

## Review Notes

- TDD path included a red test for conflicting duplicate policy observations before adding the `observation_hash` guard.
- Subagent review passes covered architecture/SOLID, correctness/TDD, and north-star/docs alignment.
- Final subagent re-review reported no remaining blockers.

## Validation

- `npm test` from `agentic-organization` (77 tests / 26 suites)
- `npm run typecheck` from `agentic-organization`
- `git diff --check origin/main..HEAD`

generated with Codex

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:52:24Z)

## Pull request overview

Adds durable, queryable storage for denied policy decision observations in the Agentic Organization runtime, backed by a first CockroachDB adapter, and projects those observations into workflow visibility for UI/agent weak-point review. This extends the policy-decision tracing work introduced in #5081 by making denied observations persistent and queryable while keeping vendor details behind generic ports.

**Changes:**

- Introduces generic policy observation persistence/query contracts (`PolicyDecisionObservationStore`/`Reader`) and a CockroachDB adapter with duplicate-vs-conflict detection via an observation hash.
- Extends Cockroach schema/migration and adds tests covering policy observation storage and scoped queries.
- Projects policy-denial observations into workflow visibility records and propagates `idempotencyKey` through authorization/observation traces; updates architecture/OpenSpec/docs accordingly.

### Reviewed changes

Copilot reviewed 22 out of 23 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| openspec/specs/agentic-organization/spec.md | Specifies durability/query semantics for denied policy observations and visibility projection requirements. |
| agentic-organization/packages/test-node.d.ts | Adds minimal Node typings needed for new tests/implementation (`assert.rejects`, `crypto.createHash`). |
| agentic-organization/packages/state-cockroach/test/cockroach-schema.test.ts | Verifies policy observation table/columns are present in generated migration SQL. |
| agentic-organization/packages/state-cockroach/test/cockroach-policy-decision-observation-store.test.ts | Adds unit tests for recording, dedupe vs conflict detection, and scoped querying. |
| agentic-organization/packages/state-cockroach/src/index.ts | Exports the new Cockroach policy observation store adapter types/factory. |
| agentic-organization/packages/state-cockroach/src/cockroach-schema.ts | Adds `agentic_org_policy_observations` table to schema generation. |
| agentic-organization/packages/state-cockroach/src/cockroach-policy-decision-observation-store.ts | Implements Cockroach-backed persistence + query + conflict detection for observations. |
| agentic-organization/packages/state-cockroach/migrations/0001_agentic_org_core_state.sql | Adds the policy observations table to the initial migration. |
| agentic-organization/packages/README.md | Updates package boundary documentation to include observation store/reader and visibility projection. |
| agentic-organization/packages/policy/test/policy-decision-observation.test.ts | Tests the generic observation port behavior (record, duplicate, conflict). |
| agentic-organization/packages/policy/test/command-authorization.test.ts | Updates authorization trace test data to include `idempotencyKey`. |
| agentic-organization/packages/policy/src/index.ts | Adds persistence/query contracts, conflict error type, and `idempotencyKey` in traces. |
| agentic-organization/packages/observability/test/workflow-visibility.test.ts | Tests new policy-denial workflow visibility projection output. |
| agentic-organization/packages/observability/src/workflow-visibility.ts | Adds policy-decision observation visibility record builder and related types/enums. |
| agentic-organization/packages/observability/src/index.ts | Re-exports new workflow visibility builders/types. |
| agentic-organization/packages/application/test/command-pipeline.test.ts | Updates expected observed trace to include `idempotencyKey`. |
| agentic-organization/packages/application/src/command-pipeline.ts | Propagates `idempotencyKey` into authorization + observation traces. |
| agentic-organization/docs/V0_SCHEMA_AND_COMMANDS.md | Documents the durable/queryable policy observations table responsibilities and semantics. |
| agentic-organization/docs/V0_POLICY_AND_RUNTIME_BOUNDARIES.md | Updates boundary doc to include durable storage + UI/agent projection before exposing entrypoints. |
| agentic-organization/docs/TECHNICAL_CA_PACKAGE_ARCHITECTURE.md | Updates package ownership/boundaries to include observation store/reader + visibility. |
| agentic-organization/docs/OBSERVABILITY_AND_SELF_HEALING.md | Documents policy-denial visibility as a sibling projection to event visibility. |
| agentic-organization/docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md | Updates checkpoint narrative to reflect durable observation + visibility projection now present. |
| agentic-organization/docs/FIRST_IMPLEMENTATION_SLICE.md | Updates implemented slice + next-slice guidance to reflect the new durable policy observation capabilities. |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:05:41Z)

## Pull request overview

Copilot reviewed 22 out of 23 changed files in this pull request and generated 1 comment.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:21:15Z)

## Pull request overview

Copilot reviewed 37 out of 38 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: agentic-organization/packages/state-cockroach/src/cockroach-policy-decision-observation-store.ts:146 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:52:23Z):

The observation hash is computed from the entire observation object, which includes `observedAt`. Since `observedAt` is generated from the clock at observation time, retries/replays of the same `policy_decision_id` will almost always produce a different hash and be classified as `Conflict` instead of `Duplicate`. Consider excluding non-deterministic fields like `observedAt` from the hashed payload (or deriving `observedAt` deterministically) so “safe replays” can actually be recognized as duplicates.

### Thread 2: agentic-organization/packages/state-cockroach/src/cockroach-policy-decision-observation-store.ts:186 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:52:24Z):

`stringifyCanonicalJson` doesn’t normalize `undefined` the way JSON persistence does: `JSON.stringify(undefined)` returns `undefined` and object properties with `undefined` values are usually omitted when serializing to JSON. Since observations are built with always-present optional fields (e.g. `toolType: command.toolType`), the hash can differ depending on whether callers omit a property vs set it to `undefined`, causing false `Conflict` classifications. Normalize by dropping `undefined` properties (and matching JSON.stringify’s array `undefined`→`null` behavior) before hashing.

### Thread 3: agentic-organization/packages/policy/src/index.ts:220 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:05:41Z):

`createPolicyDecisionObservationPort` throws `PolicyDecisionObservationConflictError` on conflict, but upstream callers need to be able to distinguish this from transient observation-store failures. In the current command pipeline, the denied-observation call site catches all errors and reports `policy_decision_observation_unavailable`, which would mask a real governance-evidence conflict and could trigger the wrong retry/ops behavior. Consider returning a conflict status to the caller (instead of throwing) or ensuring the error is propagated/handled distinctly end-to-end (e.g., mapping to a conflict-specific rejection code/reason).

## General comments

### @chatgpt-codex-connector (2026-05-26T04:47:52Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @maximdolphin (2026-05-26T05:15:14Z)

Durable worker composition slice is now pushed on top of the latest policy-observation fixes.

What changed:

- Added a generic Cockroach SQL executor seam plus durable state adapter factory in `@agentic-org/state-cockroach`.
- Added a migration runner contract behind the same generic executor.
- Added `apps/workers` durable composition that wires Cockroach-backed outbox/event-ingestion ports into the worker host without leaking DB/client construction into reusable packages.
- Expanded worker process env parsing for `COCKROACH_DATABASE_URL`, `WORKER_INBOUND_BATCH_SIZE`, and `WORKER_OUTBOX_BATCH_SIZE`.
- Updated package docs, runtime docs, full-ai-cluster integration notes, observability notes, and OpenSpec scenarios.

Review/validation:

- Subagent architecture/SOLID review: no blockers.
- Subagent correctness/TDD review: no blockers.
- Subagent north-star/docs review: caught untracked implementation files and env-contract doc drift; both fixed before push.
- `npm test` from `agentic-organization`: pass, 85 tests / 30 suites.
- `npm run typecheck` from `agentic-organization`: pass.
- `git diff --check`: pass.

Residual next slice: bind a real CockroachDB client pool, concrete NATS pull/publish client construction, and a telemetry sink at the app/process boundary.
