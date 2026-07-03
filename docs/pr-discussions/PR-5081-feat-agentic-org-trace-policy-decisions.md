---
pr_number: 5081
title: "feat(agentic-org): trace policy decisions"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-26T04:11:31Z"
merged_at: "2026-05-26T04:37:15Z"
closed_at: "2026-05-26T04:37:15Z"
head_ref: "codex/agentic-org-policy-gate"
base_ref: "main"
archived_at: "2026-05-27T19:44:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5081: feat(agentic-org): trace policy decisions

## PR description

## Summary

- Adds policy decision visibility to the agentic organization command pipeline: denied commands are observed through a generic `PolicyDecisionObservationPort` before any business effects, idempotency lookup, or persistence.
- Projects allowed policy decision evidence onto audit events and outbox event envelopes, then persists audit policy evidence through the Cockroach adapter without leaking database details into application code.
- Extends LGTM-friendly observability/workflow visibility with policy decision ID/version and updates package/docs/OpenSpec boundaries for the denied-observation vs allowed-evidence split.

## Validation

- TDD: added failing regression tests for denied policy observation context, observation failure behavior, allowed policy evidence projection, Cockroach audit policy persistence/null normalization, schema columns, and observability projections before implementing fixes.
- `npm test`
- `npm run typecheck`
- `git diff --check origin/main...HEAD`
- `npx --yes prettier@3.8.3 --check --ignore-unknown <changed ts/md files>`
- Subagent review: architecture/SOLID/vendor boundaries passed after fixes
- Subagent review: correctness/TDD/policy behavior passed
- Subagent review: north-star/docs/OpenSpec alignment passed

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:14:50Z)

## Pull request overview

Adds policy-decision traceability through the agentic-organization command path, separating denied-command observation from allowed-command evidence on persisted effects and observability projections.

**Changes:**

- Introduces `PolicyDecisionObservationPort` and denial observation in the command pipeline.
- Adds allowed policy evidence to audit events, outbox envelopes, Cockroach audit persistence, spans, and workflow visibility records.
- Updates OpenSpec and architecture/runtime docs to describe the denied-observation vs allowed-evidence split.

### Reviewed changes

Copilot reviewed 23 out of 23 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `openspec/specs/agentic-organization/spec.md` | Specifies denied observation and allowed policy evidence requirements. |
| `agentic-organization/packages/application/src/command-pipeline.ts` | Observes denied decisions and attaches allowed policy evidence to effects. |
| `agentic-organization/packages/application/src/command-result.ts` | Adds typed policy-observation failure error shape. |
| `agentic-organization/packages/application/test/command-pipeline.test.ts` | Covers denied observation, observation failure, and allowed evidence projection. |
| `agentic-organization/packages/policy/src/index.ts` | Adds policy decision observation types and port. |
| `agentic-organization/packages/domain/src/event-envelope.ts` | Adds optional policy evidence to event envelopes. |
| `agentic-organization/packages/domain/src/index.ts` | Re-exports policy evidence type. |
| `agentic-organization/packages/domain/src/records.ts` | Adds optional policy evidence to audit events. |
| `agentic-organization/packages/observability/src/span-attributes.ts` | Projects policy evidence into span attributes. |
| `agentic-organization/packages/observability/src/workflow-visibility.ts` | Projects policy evidence into visibility records. |
| `agentic-organization/packages/observability/test/span-attributes.test.ts` | Tests policy span attributes. |
| `agentic-organization/packages/observability/test/workflow-visibility.test.ts` | Tests policy visibility projection. |
| `agentic-organization/packages/state-cockroach/src/cockroach-schema.ts` | Adds audit policy columns to generated schema. |
| `agentic-organization/packages/state-cockroach/src/cockroach-command-state-store.ts` | Persists audit policy evidence with SQL null normalization. |
| `agentic-organization/packages/state-cockroach/migrations/0001_agentic_org_core_state.sql` | Adds audit policy columns to migration SQL. |
| `agentic-organization/packages/state-cockroach/test/cockroach-schema.test.ts` | Asserts policy columns exist in schema output. |
| `agentic-organization/packages/state-cockroach/test/cockroach-command-state-store.test.ts` | Tests Cockroach audit policy persistence/nulls. |
| `agentic-organization/packages/README.md` | Documents package boundary updates. |
| `agentic-organization/docs/V0_SCHEMA_AND_COMMANDS.md` | Updates V0 schema/command policy evidence guidance. |
| `agentic-organization/docs/V0_POLICY_AND_RUNTIME_BOUNDARIES.md` | Updates runtime boundary policy-observation requirements. |
| `agentic-organization/docs/TECHNICAL_CA_PACKAGE_ARCHITECTURE.md` | Updates architecture and observability policy traceability notes. |
| `agentic-organization/docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md` | Updates current alignment and remaining gaps. |
| `agentic-organization/docs/FIRST_IMPLEMENTATION_SLICE.md` | Updates first-slice flow, guarantees, and next-slice work. |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:32:58Z)

## Pull request overview

Copilot reviewed 23 out of 23 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: agentic-organization/packages/application/src/command-pipeline.ts:69 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:14:49Z):

P1: This copies the policy-observation adapter's raw exception message into the command result. Because command results are caller/agent-visible, a future durable observation adapter could leak internal sink details (SQL errors, hostnames, credentials embedded in driver messages) through `observationErrorMessage`. Return a stable sanitized failure reason here and keep adapter-specific diagnostics on an internal/logging surface instead.
