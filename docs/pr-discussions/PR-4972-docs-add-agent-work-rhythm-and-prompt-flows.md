---
pr_number: 4972
title: "docs: add agent work rhythm and prompt flows"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-25T18:57:13Z"
merged_at: "2026-05-25T19:08:13Z"
closed_at: "2026-05-25T19:08:13Z"
head_ref: "codex/agent-work-rhythm"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4972: docs: add agent work rhythm and prompt flows

## PR description

## Summary

- Adds `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md` to define hat-bound work schedules, free-time, review/red-team, reflection, and memory-maintenance blocks.
- Documents deterministic MCP-driven prompt flows with reusable phases, phase gates, reviewer hats, artifacts, memory behavior, and graph ingestion.
- Threads schedule and prompt-flow concepts through runtime architecture, implementation concepts, Work OS, build plan, UI, readiness checklist, Dapr actor context, and graph/retrieval docs.

## Validation

- `git diff --check HEAD~1 HEAD`
- `rg -n "Agent Work Rhythm|Work Rhythm and Prompt Flows|validate_prompt_flow_start|Prompt Flow Registry|free time" agentic-organization/docs`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T19:00:19Z)

## Pull request overview

Adds a new documentation surface describing hat-bound work schedules (“work rhythm”) and deterministic MCP-driven prompt flows, then threads those concepts through existing runtime, UI/observability, knowledge-graph, and implementation planning docs so the Organization layer treats time-blocks and flow execution as first-class governed artifacts.

**Changes:**

- Introduces `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md` defining schedule blocks, review/reflection/free-time expectations, and prompt-flow lifecycle/registry concepts.
- Extends multiple architecture/plan docs to include schedule blocks + prompt flows in signals, UI views, runtime context, services, schema, and readiness checks.
- Updates tool inventory and orchestration runtime notes to account for schedule/prompt-flow operations.

### Reviewed changes

Copilot reviewed 12 out of 12 changed files in this pull request and generated 3 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| agentic-organization/docs/WORK_AND_RELEASE_MANAGEMENT_OS.md | Adds Work Schedule + Prompt Flow as core objects and introduces related signal families and governance bullets. |
| agentic-organization/docs/UI_AND_OBSERVABILITY_CONCEPTS.md | Adds UI views for work rhythm and prompt-flow registry; extends graph node list. |
| agentic-organization/docs/RUNTIME_TECH_AND_PACKAGE_STRATEGY.md | Extends actor-backed runtime context to include schedule block + prompt-flow run/phase identifiers. |
| agentic-organization/docs/README.md | Links the new work-rhythm/prompt-flow doc from the docs index. |
| agentic-organization/docs/ORGANIZATION_RUNTIME_ARCHITECTURE.md | Adds a new section describing work rhythm + prompt-flow concepts in the runtime architecture narrative. |
| agentic-organization/docs/ORGANIZATION_LAYER_BUILD_PLAN.md | Adds services, workspace elements, and schema entities for schedules and prompt flows. |
| agentic-organization/docs/IMPLEMENTATION_READINESS_CHECKLIST.md | Extends readiness requirements and preflight validations for schedules + prompt flows. |
| agentic-organization/docs/IMPLEMENTATION_CONCEPTS.md | Adds entities/services and state-machine sketches for schedule blocks and prompt-flow runs; expands capability request requirements. |
| agentic-organization/docs/DEPARTMENT_HAT_TOOL_INVENTORY.md | Adds tool bundles for Work Rhythm + Prompt Flow; expands Memory tool bundle. |
| agentic-organization/docs/ALWAYS_ON_ORCHESTRATION_RUNTIME.md | Threads schedule block / prompt-flow linkage into scheduled job semantics. |
| agentic-organization/docs/AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md | New document defining the schedule model, prompt-flow phases/gates, and registry + reflection/free-time guardrails. |
| agentic-organization/docs/AGENT_NATIVE_KNOWLEDGE_GRAPH.md | Extends node/edge kinds and suggested tables for schedule blocks and prompt-flow artifacts/runs. |
</details>

### COMMENTED — @maximdolphin (2026-05-25T19:05:08Z)

_(no body)_

### COMMENTED — @maximdolphin (2026-05-25T19:05:19Z)

_(no body)_

### COMMENTED — @maximdolphin (2026-05-25T19:05:24Z)

_(no body)_

## Review threads

### Thread 1: agentic-organization/docs/AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md:227 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:00:18Z):

P1: The suggested prompt-flow registry table names drift from the authoritative names already used elsewhere in this doc set (e.g., `hat_prompt_flow_bindings`, `prompt_flow_phase_runs`). This will make cross-doc schema discussions ambiguous.

**@maximdolphin** (2026-05-25T19:05:08Z):

Fixed in `f37700e93` by aligning the registry entries to the authoritative schema names already used elsewhere: `hat_prompt_flow_bindings` and `prompt_flow_phase_runs`.

### Thread 2: agentic-organization/docs/AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md:228 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:00:19Z):

P1: For consistency with the rest of the docs (which use `prompt_flow_gate_decisions` for reviewer decisions between phases), this entry should use the same name instead of `prompt_flow_review_decisions`.

**@maximdolphin** (2026-05-25T19:05:19Z):

Fixed in `f37700e93` by replacing `prompt_flow_review_decisions` with the canonical `prompt_flow_gate_decisions`.

### Thread 3: agentic-organization/docs/RUNTIME_TECH_AND_PACKAGE_STRATEGY.md:174 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:00:19Z):

P2: This section adds a runtime context field for the current prompt-flow phase ID, but the preceding list of `AgentSessionActor` setters doesn’t include a way to update it. Adding an explicit setter keeps the interface description aligned with the fields you expect to track.

**@maximdolphin** (2026-05-25T19:05:24Z):

Fixed in `f37700e93` by adding `setCurrentPromptFlowPhase()` to the `AgentSessionActor` interface list so it matches the runtime context fields.

## General comments

### @chatgpt-codex-connector (2026-05-25T18:57:19Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @maximdolphin (2026-05-25T19:03:54Z)

Follow-up added in `fb59ae506`: researched the repo's existing universal-action-space/action-grammar prior art and folded it into the prompt-flow docs. The integration anchors to 081KQTPYE0008QG0R0009F20NN (F# <-> CodeAct bridge), 081KQTPYE0008QG0R00209Q9RT (universal-action-space research lane), `docs/SAFE-AUTONOMOUS-ACTIONS.md`, and the action-mode/provenance research doc. Prompt flows now host Universal Action Grammar atoms with typed actor/target/precondition/observation/reversibility/evidence fields, and the concept is threaded into graph nodes/edges, DB records, Work OS signals/guardrails, MCP tools, implementation services, and readiness preflights.
