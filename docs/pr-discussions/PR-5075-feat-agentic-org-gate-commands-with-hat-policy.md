---
pr_number: 5075
title: "feat(agentic-org): gate commands with hat policy"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-26T03:21:23Z"
merged_at: "2026-05-26T03:38:27Z"
closed_at: "2026-05-26T03:38:27Z"
head_ref: "codex/agentic-org-policy-gate"
base_ref: "main"
archived_at: "2026-05-27T19:46:28Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5075: feat(agentic-org): gate commands with hat policy

## PR description

## Summary

- Adds the first `@agentic-org/policy` package with generic `CommandAuthorizationPort` and `HatAuthorityPort` contracts.
- Gates the application command pipeline before idempotency lookup, handler dispatch, or persistence, returning typed `policy_denied` errors for inactive hat authority.
- Strengthens governance boundaries so policy code stays adapter/vendor-free, and updates Agentic Organization docs/OpenSpec to mark denial observation and allowed decision projection as the next visibility slice.

## Validation

- `npm test`
- `npm run typecheck`
- `git diff --check origin/main...HEAD`
- Subagent review: architecture/SOLID/vendor boundaries passed
- Subagent review: correctness/TDD/policy gate behavior passed
- Subagent review: north-star/docs alignment passed

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T03:25:41Z)

## Pull request overview

Introduces a first-cut policy boundary for Agentic Organization command execution by adding a dedicated `policy` package with authorization ports and enforcing a policy gate at the start of the application command pipeline (before idempotency, dispatch, or persistence). This aligns the implementation with governance goals to keep policy logic vendor/adapter-free while making policy denials typed and observable at the command boundary.

**Changes:**

- Added `@agentic-org/policy` contracts + a default `createCommandAuthorizationPort` implementation backed by `HatAuthorityPort`, with tests for allow/deny behavior.
- Updated the application command pipeline to require `CommandAuthorizationPort` and reject denied commands before any idempotency lookup, handler dispatch, or state persistence.
- Strengthened governance dependency-boundary checks (including policy package constraints) and updated OpenSpec + architecture docs to reflect the new policy gate slice.

### Reviewed changes

Copilot reviewed 14 out of 14 changed files in this pull request and generated 2 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| openspec/specs/agentic-organization/spec.md | Specifies that command authorization runs before any command effects and adds policy boundary assertions. |
| agentic-organization/packages/README.md | Updates package inventory and first-slice pipeline narrative to include policy gating. |
| agentic-organization/packages/policy/src/index.ts | Adds policy ports, decision types, and a default command authorization implementation. |
| agentic-organization/packages/policy/test/command-authorization.test.ts | Tests allow/deny mapping from hat authority decisions to policy decisions. |
| agentic-organization/packages/application/src/command-pipeline.ts | Gates command execution via policy authorization before idempotency/dispatch/persistence. |
| agentic-organization/packages/application/src/command-result.ts | Extends command errors with `policy_denied` and policy metadata fields. |
| agentic-organization/packages/application/test/command-pipeline.test.ts | Updates pipeline tests to provide authorization port and adds an early policy-denial test. |
| agentic-organization/packages/governance/src/package-dependency-boundaries.ts | Adds `Policy` boundary rule identifier. |
| agentic-organization/packages/governance/test/package-dependency-boundaries.test.ts | Enforces policy package import constraints and expands forbidden vendor/import fragments. |
| agentic-organization/docs/V0_SCHEMA_AND_COMMANDS.md | Updates command contract narrative to reflect policy-derived authorization context. |
| agentic-organization/docs/V0_POLICY_AND_RUNTIME_BOUNDARIES.md | Updates policy/runtime boundary doc to include command authorization gating and denial visibility notes. |
| agentic-organization/docs/TECHNICAL_CA_PACKAGE_ARCHITECTURE.md | Documents the new policy port boundary and the “deny before effects” execution rule. |
| agentic-organization/docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md | Moves policy/hat authority from “gap” to a checkpoint with remaining follow-ons. |
| agentic-organization/docs/FIRST_IMPLEMENTATION_SLICE.md | Updates slice plan to include policy gate and governance constraints for the new package. |
</details>

## Review threads

### Thread 1: agentic-organization/docs/V0_SCHEMA_AND_COMMANDS.md:262 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:25:40Z):

This new bullet refers to `actor` / hat assignment / scope, but the preceding bullets in this same section still describe actor identity as flattened `actorAgentId` / `actorHatAssignmentId`. Elsewhere in this repo the command contract is modeled as `actor: { agentId, hatAssignmentId }`; consider updating this section to use one consistent shape (or explicitly state when/where the flattened fields exist).

### Thread 2: agentic-organization/packages/application/test/command-pipeline.test.ts:208 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:25:41Z):

This test validates early rejection and the policy decision id, but it doesn’t assert that the pipeline plumbs through `policyVersion` and the typed denial `reason` onto the returned `CommandResult.error`. Adding assertions here would prevent regressions in the new error contract.

## General comments

### @chatgpt-codex-connector (2026-05-26T03:21:27Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.
