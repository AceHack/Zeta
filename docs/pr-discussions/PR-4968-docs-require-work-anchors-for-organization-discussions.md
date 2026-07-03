---
pr_number: 4968
title: "docs: require work anchors for organization discussions"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-25T18:12:51Z"
merged_at: "2026-05-25T18:15:44Z"
closed_at: "2026-05-25T18:15:44Z"
head_ref: "codex/discussion-work-anchors"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4968: docs: require work anchors for organization discussions

## PR description

## Summary

- Adds the Agent-Native Knowledge Graph and Retrieval doc as the agent-first context layer for tasks, discussions, decisions, meetings, docs, artifacts, runs, memories, and evidence.
- Makes discussion anchoring a hard Organization invariant: meetings, one-on-ones, team chats, TPM/executive meetings, broadcasts, votes, reports, and review comments must reference a work item or scoped organizational artifact before opening.
- Propagates `validate_discussion_anchor`, `discussion_anchors`, and anchor-aware behavior through MCP tools, the Work OS, UI, actors, scheduled jobs, readiness checks, and runtime architecture docs.

## Validation

- `git diff --check HEAD~1 HEAD`
- `rg -n "AGENT_NATIVE_KNOWLEDGE_GRAPH|Discussion Anchor|validate_discussion_anchor|No discussion may be unanchored" agentic-organization/docs`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T18:15:47Z)

## Pull request overview

This PR strengthens the “discussion anchoring” invariant across the Agentic Organization design docs and introduces a new Agent-Native Knowledge Graph/Retrieval document as the context layer tying work items to discussions, decisions, evidence, and runs.

**Changes:**

- Adds `AGENT_NATIVE_KNOWLEDGE_GRAPH.md` describing a typed graph schema, retrieval contracts, context packs, and `validate_discussion_anchor`.
- Propagates “no unanchored discussions” requirements through OS, UI/observability, runtime architecture, build plan, and readiness checklist docs.
- Updates tool bundles and actor/runtime descriptions to include discussion anchor validation and tracking.

### Reviewed changes

Copilot reviewed 13 out of 13 changed files in this pull request and generated 4 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| agentic-organization/docs/WORK_AND_RELEASE_MANAGEMENT_OS.md | Adds anchor validation into the signal model and guardrails. |
| agentic-organization/docs/UI_AND_OBSERVABILITY_CONCEPTS.md | Requires an anchor selector before opening discussions; records anchor in meeting UI metadata. |
| agentic-organization/docs/RUNTIME_TECH_AND_PACKAGE_STRATEGY.md | Extends actor responsibilities to include anchor state and adds anchor to runtime context. |
| agentic-organization/docs/README.md | Adds the new Knowledge Graph/Retrieval doc to the canonical doc list. |
| agentic-organization/docs/ORGANIZATION_RUNTIME_ARCHITECTURE.md | Introduces an explicit Discussion Anchor Policy and updates meeting/chat requirements. |
| agentic-organization/docs/ORGANIZATION_LAYER_BUILD_PLAN.md | Adds “discussion anchors” as a first-class schema/service concern and as workspace context. |
| agentic-organization/docs/IMPLEMENTATION_READINESS_CHECKLIST.md | Adds discussion anchors + Knowledge Graph/Retrieval V0 decisions and preflight tools. |
| agentic-organization/docs/IMPLEMENTATION_CONCEPTS.md | Adds anchor enforcement requirements to meeting concepts and open preflight steps. |
| agentic-organization/docs/DEPARTMENT_HAT_TOOL_INVENTORY.md | Adds `validate_discussion_anchor` into tool bundles. |
| agentic-organization/docs/ANTI_STALL_PRIORITY_RUNTIME.md | Requires anchors for prioritization meetings and votes. |
| agentic-organization/docs/AMBIGUOUS_REQUIREMENT_LIFECYCLE.md | Anchors customer interview threads to intake/work items. |
| agentic-organization/docs/ALWAYS_ON_ORCHESTRATION_RUNTIME.md | Requires scheduled jobs to supply discussion anchors when opening comms artifacts. |
| agentic-organization/docs/AGENT_NATIVE_KNOWLEDGE_GRAPH.md | New: defines graph node/edge schema, retrieval/context-pack contracts, and anchoring/tooling expectations. |
</details>

## Review threads

### Thread 1: agentic-organization/docs/AGENT_NATIVE_KNOWLEDGE_GRAPH.md:191 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T18:15:46Z):

The example edge directions here conflict with the `discussed_in` contract just above (which says `discussed_in` is "subject -> conversation"). If `Meeting` is the conversation node, the source/target should be flipped (e.g., `Initiative`/`Task` -> `discussed_in` -> `Meeting`) or the edge kind renamed to match the intended direction.

### Thread 2: agentic-organization/docs/AGENT_NATIVE_KNOWLEDGE_GRAPH.md:195 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T18:15:46Z):

This example uses edge labels (`produced`, `cited`, `recorded_by`) that are not present in the declared `EdgeKind` union (which has `produced_by` and `cites`, and no `recorded_by`). To avoid schema drift, align the example with the enumerated edge kinds (or update `EdgeKind`/the edge table to include the missing kinds).

### Thread 3: agentic-organization/docs/AGENT_NATIVE_KNOWLEDGE_GRAPH.md:216 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T18:15:46Z):

This section is titled "Discussion Anchor Invariant" and defines a `DiscussionAnchor` type, but the prose uses the term "work anchor". Consider standardizing on one term (or explicitly defining "work anchor" as an alias of "discussion anchor") so the docs, types, and tool names (`validate_discussion_anchor`) stay consistent.

### Thread 4: agentic-organization/docs/ORGANIZATION_RUNTIME_ARCHITECTURE.md:1738 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T18:15:47Z):

In this section the list uses both "context gap" (no hyphen) and "context-gap" (hyphenated). Please standardize the spelling to one form to keep anchor types/search terms consistent across the docs (especially since the type uses `context_gap`).

## General comments

### @chatgpt-codex-connector (2026-05-25T18:12:56Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @maximdolphin (2026-05-25T18:56:10Z)

Follow-up added in `059f57bff`: documented the agent work rhythm model. Hats now carry schedule templates, prompt-flow availability, review/red-team blocks, reflection/memory-maintenance blocks, and bounded free time. The docs also add a prompt-flow registry model with reusable phases, deterministic MCP-driven execution, reviewer gates, graph ingestion, capability-expansion lifecycle, UI surfaces, schedule/prompt-flow signals, and v0 readiness contracts.
