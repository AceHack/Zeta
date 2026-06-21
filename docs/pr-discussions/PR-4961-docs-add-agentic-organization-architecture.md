---
pr_number: 4961
title: "docs: add agentic organization architecture"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-25T17:24:04Z"
merged_at: "2026-05-25T17:46:22Z"
closed_at: "2026-05-25T17:46:22Z"
head_ref: "codex/agentic-organization-docs"
base_ref: "main"
archived_at: "2026-05-27T19:50:02Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4961: docs: add agentic organization architecture

## PR description

## Summary

- Add the `docs/agentic-organization/` architecture set for the Agentic Organization platform.
- Define the organization runtime, always-on orchestration model, department/hat/tool inventory, UI and observability concepts, and TypeScript package strategy.
- Cross-link the shipped `full-ai-cluster/k8s/applications/hat-system/` operator and clarify the Agentic Organization deltas above it.
- Canonicalize naming to **Agentic Organization** and clarify that Hermes is the agent runtime/component.
- Clarify NestJS composition with Orleans through explicit adapters instead of replacing Orleans.
- Add scope discipline, a v0 vertical slice, placement guardrails, and alignment-floor links.

## Validation

- `git diff --check`
- Confirmed linked hat-system/alignment/rule paths exist locally.
- Swept `docs/agentic-organization/` for prior personal-name/age attribution and old Hermes Organization naming.

## Local blockers

- Full repo build/test could not run locally because `bun` is not installed.
- `.NET SDK 10.0.203` is required by `global.json`, but no .NET SDK is installed locally.

Co-Authored-By: Codex <noreply@openai.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T17:27:32Z)

## Pull request overview

Adds a new architecture/documentation set under `docs/agentic-organization/` describing the “Agentic Organization” platform (runtime/orchestration model, hats/departments/tools, UI + observability concepts, and TS package strategy), and links it from `docs/README.md` for discoverability.

**Changes:**
- Introduces the Agentic Organization design document set (runtime layers, Work OS/release flow, always-on orchestration, UI/observability, cluster substrate, and build plan).
- Documents integration boundaries across Oz (run orchestration), OpenZiti (transport), NATS, Temporal TS, Dapr Actors, Orleans, Hindsight, and an MCP gateway/policy layer.
- Adds a new “Agentic Organization builder” entry to the docs audience index.

### Reviewed changes

Copilot reviewed 17 out of 17 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/README.md | Adds an audience link to the Agentic Organization doc set. |
| docs/agentic-organization/README.md | Entry point and naming/placement guidance for the doc set. |
| docs/agentic-organization/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md | Shared vocabulary/context and alignment-floor links. |
| docs/agentic-organization/ORGANIZATION_RUNTIME_ARCHITECTURE.md | High-level conceptual architecture + lifecycles. |
| docs/agentic-organization/IMPLEMENTATION_CONCEPTS.md | Implementation-oriented bounded contexts, flows, and contracts. |
| docs/agentic-organization/ALWAYS_ON_ORCHESTRATION_RUNTIME.md | Always-on workers, triggers, leases, reconciliation, and ops model. |
| docs/agentic-organization/WORK_AND_RELEASE_MANAGEMENT_OS.md | Work/backlog/release domain model, state machines, and signals. |
| docs/agentic-organization/UI_AND_OBSERVABILITY_CONCEPTS.md | UI surfaces and observability/evidence navigation model. |
| docs/agentic-organization/RUNTIME_TECH_AND_PACKAGE_STRATEGY.md | Runtime “rail” choices and proposed TS package layout. |
| docs/agentic-organization/ORGANIZATION_LAYER_BUILD_PLAN.md | Proposed TS monorepo stack + phased MVP build sequence. |
| docs/agentic-organization/IMPLEMENTATION_READINESS_CHECKLIST.md | Pre-implementation decisions/contracts checklist. |
| docs/agentic-organization/DEPARTMENT_HAT_TOOL_INVENTORY.md | Department/hat/tool bundle catalog and lifecycle ownership mapping. |
| docs/agentic-organization/AMBIGUOUS_REQUIREMENT_LIFECYCLE.md | Discovery → BRD → CA → implementation readiness lifecycle. |
| docs/agentic-organization/ANTI_STALL_PRIORITY_RUNTIME.md | Anti-stall operating model, blocker taxonomy, and cadences. |
| docs/agentic-organization/CLUSTER_NATIVE_HAT_SYSTEM.md | K8s CRD/OPA hat-system model + linkage to shipped operator. |
| docs/agentic-organization/CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md | Cluster execution boundaries (sandbox, mesh, credential proxy, memory). |
| docs/agentic-organization/AI_CLUSTER_SCAFFOLD_CONTEXT.md | Concrete repo/scaffold alignment notes and naming clarifications. |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T17:43:10Z)

## Pull request overview

Copilot reviewed 14 out of 18 changed files in this pull request and generated no new comments.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**agentic-organization/docs/AI_CLUSTER_SCAFFOLD_CONTEXT.md:42**
* P1 (xref): This table calls `full-ai-cluster/k8s/applications/hat-system/operator-ts/` an "Important concrete" directory, but that path does not exist in the repo today (the hat-system tree currently has `operator/` only). Either remove it from the concrete-directory list or reword it as a planned/future location so readers don’t go looking for a non-existent path.
**agentic-organization/docs/IMPLEMENTATION_READINESS_CHECKLIST.md:68**
* P1 (xref): This mentions placing the app under `agentic-team/packages`, but there is no `agentic-team/` directory in this repository. If this is only a hypothetical option, consider rewording to “a new workspace under <path to be created>” or referencing an existing root location to avoid sending implementers to a nonexistent path.
</details>

## General comments

### @chatgpt-codex-connector (2026-05-25T17:24:08Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @maximdolphin (2026-05-25T17:26:24Z)

Updated in `cf431278a713981d9710143af549449e6048728a`: moved the docs from `docs/agentic-organization/` to `agentic-organization/docs/` so `agentic-organization/` is the subsystem root. Also updated the repo docs index and the affected internal placement/alignment references for the new path.

Validation: staged rename status showed the docs as renames, `git diff --cached --check` passed before commit, and the critical moved links resolve locally.

### @maximdolphin (2026-05-25T17:32:27Z)

@copilot resolve the merge conflicts in this pull request

### @copilot-swe-agent (2026-05-25T17:39:04Z)


> @copilot resolve the merge conflicts in this pull request

Done in commit 2a025b3b: I merged latest `origin/main`, resolved the `docs/README.md` conflict, and kept the Agentic Organization link pointing to `../agentic-organization/docs/README.md`. No UI changes were made, so there is no screenshot to provide.

### @maximdolphin (2026-05-25T17:39:47Z)

Updated in `be6baa330298b65d690cc7ae224a15b2120d6170` after reviewing PR #4960 with two focused subagent passes.

What changed:
- Made TypeScript a first-class consumer of the hat-system CRD substrate through shared typed CRD clients, watches, HatSwap codecs, and projection clients.
- Added the polyglot operator contract: CRD YAML is canonical; Go remains the reference/reliability baseline; a future `operator-ts` is additive and must use the same CRDs.
- Added the correctness guardrail: Go and TypeScript operators must share the same leader-election Lease or have an ADR-backed disjoint ownership partition. Two active writers on the same `HatBinding` lifecycle are a bug, not redundancy.
- Normalized the docs to the shipped CRD lifecycle/event names (`Pending | Warmup | Active | Probation | Revoked`, `SwapOn | SwapOff | WarmupBegin | WarmupEnd | Probation | QuorumGrant | Throttled`).
- Added readiness tests for CRD schema parity, HatSwap payload parity, controller ownership/Lease behavior, and read-only TS projection idempotency.
- Updated 081KSE6WT0008QG0R00195RG48’s stale path/naming note now that this branch has merged the backlog PR content.

Validation: `git diff --check` passed and the stale path/name/lifecycle sweeps are clean except for unrelated generic state-transition wording.

### @AceHack (2026-05-25T17:42:44Z)

I have resolved the merge conflicts in this PR in #4964.

### @maximdolphin (2026-05-25T17:42:48Z)

Updated in `d7f7e5886`: renamed the accidental `@hermes-org/*` package namespace to `@agentic-org/*` across the Agentic Organization docs. I also removed the stale `docs/agentic-organization/` duplicate that came back from the merged base so the docs live only at `agentic-organization/docs/`.

Validation: `git grep` finds no remaining `hermes-org` / `@hermes-org`; `docs/agentic-organization/` no longer exists; `agentic-organization/docs/README.md` is present.

### @maximdolphin (2026-05-25T17:52:59Z)

Updated in `7d6bbe015098472085c50cf1665b00430394e1e9`: added a canonical `agentic-organization/docs/AGENT_NATIVE_KNOWLEDGE_GRAPH.md` spec and wired it through the Organization docs.

What this adds:
- Graph/retrieval layer over task management, discussions, one-on-ones, team chats, meetings, decisions, docs, artifacts, runs, traces, skills, and memories.
- Typed graph schema: `GraphNode`, `GraphEdge`, node/edge kinds, provenance/access/source/indexing envelopes.
- Retrieval and context-pack contracts, including omissions, citations, policy basis, freshness, confidence, and graph query recipes.
- Handoff briefs for reassignment, blocked work, bounced review/QA, run termination, and agent replacement.
- Decision memory lifecycle and contradiction lifecycle, with high-severity contradictions blocking `ready`, `review_approved`, and `release_ready`.
- Agent attention queue and preflight validators so graph context becomes a runtime gate, not just search.
- `@agentic-org/knowledge-graph` package direction.

Validation: `git diff --check` passed, no stale `hermes-org` / `@hermes-org` / `docs/agentic-organization` refs in tracked files, and the remote branch now points at this commit.

### @maximdolphin (2026-05-25T18:00:04Z)

Follow-up added in `b95653d87`: tightened discussions into a hard work-anchor invariant. Meetings, one-on-ones, team chats, TPM meetings, executive meetings, broadcasts, votes, reports, and review comments now require a validated project/initiative/task/defect/review/gate/incident/release/policy/capability/context-gap anchor before opening. Also propagated the contract into MCP tools, DB tables, UI, runtime actors, scheduled jobs, and readiness checks.
