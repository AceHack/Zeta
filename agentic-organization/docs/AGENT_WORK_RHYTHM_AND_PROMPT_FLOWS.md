---
title: Agent Work Rhythm and Prompt Flows
canonical_name: Agentic Organization
status: design
---

# Agent Work Rhythm and Prompt Flows

## Purpose

Hermes agents should not be treated as stateless workers waiting for tasks. The Organization should give each active hat a rhythm: scheduled work blocks, review obligations, learning time, memory reflection, and deterministic prompt-flow automation.

The goal is to make agents better over time while keeping execution governed, reviewable, and tied to work.

## Core Principle

Every active hat assignment should answer:

- what the agent is responsible for now;
- when the agent should do prioritized work;
- when the agent should review or red-team others;
- when the agent should reflect, manage memories, and improve;
- what deterministic prompt flows the hat may execute;
- which reviewer hats approve each phase;
- what evidence is produced.

This schedule is not just calendar metadata. It is part of runtime authority.

## Work Schedule Model

Each agent should have a work schedule while wearing a hat. The schedule is determined by the supervising hat or department policy, with adjustments based on performance reviews, capacity, queue pressure, budget, and current initiative needs.

Schedules should be heavily tied to hats:

```text

Hat definition
  -> default schedule template
  -> allowed prompt flows
  -> required review/reflection blocks
  -> memory management expectations
  -> escalation paths

Hat assignment
  -> concrete schedule instance
  -> current project/initiative/task scope
  -> manager-approved adjustments
  -> runtime execution windows
```

Recommended schedule block types:

| Block type | Purpose |
|---|---|
| Prioritized work | Execute assigned tasks, defects, reviews, QA, planning, or architecture work |
| Prompt-flow execution | Run a deterministic MCP-driven flow available to the active hat |
| Review/red-team | Review work from lower, peer, or adjacent hats using the right gate criteria |
| Reflection | Review recent outcomes, mistakes, delays, and memory quality |
| Memory maintenance | Stabilize useful memories, deprecate stale memories, correct invalid memories, scope memories by hat/project/task |
| Free time | Catch up, inspect repos, learn context, ask anchored questions, build culture, and discover improvement opportunities |
| Office-hours / questions | Open anchored one-on-one or team discussions to resolve ambiguity |
| Reporting | Produce manager/director/executive reports tied to work items |

Free time is not idle time. It is bounded exploration. It still produces traces, optional memories, questions, reports, or capability requests when something useful is found.

## Schedule Ownership

Schedules should follow the hierarchy:

| Hat layer | Schedule responsibility |
|---|---|
| Executive Board / C-suite | Sets organization rhythm, review cadence, standards, and budget/capacity posture |
| Directors | Set department schedules, department review cadence, and initiative staffing rhythm |
| TPMs | Coordinate initiative task cadence, meetings, dependencies, and delivery checkpoints |
| Engineering Managers / equivalent managers | Set team schedules, individual hat schedule adjustments, review/reflection cadence, and memory improvement work |
| Team leads / mission control | Coordinate active team rooms, handoffs, and short-cycle work sequencing |
| Individual hats | Execute schedule blocks, request adjustments, report blockers, and perform reflection honestly |

Schedule changes should be auditable. A supervising hat can adjust a schedule, but the agent should be able to report that the schedule is causing slowdowns, context gaps, poor quality, or excessive review lag.

The first executable schedule primitive is `schedule_work_block`. It creates a
work-item-scoped, `scheduled` block for an assigned agent and hat, optionally
linked to a discussion anchor. Persistence rejects overlapping scheduled or
active blocks for the same hat assignment, so the schedule can become runtime
authority for future meetings, prompt-flow starts, review slots, free time,
reflection, and memory maintenance.

## Hierarchical Review and Red-Team Rhythm

Each hierarchical layer should review the layer below it and also receive structured feedback from below.

Examples:

- executives review director portfolio decisions, standards, budget usage, and department outcomes;
- directors review TPMs, managers, department throughput, initiative health, and recurring blockers;
- TPMs review task plans, dependency handling, meeting quality, and initiative evidence;
- engineering managers review team outcomes, readiness quality, memory/context quality, prompt-flow fit, and whether agents are reaching goals;
- reviewers red-team implementation, QA, security, architecture, and release evidence;
- implementers can submit anchored reports when process, docs, memories, tools, or prompt flows slow them down.

This should not become blame flow. Reviews are evidence-producing loops that create work:

```text
review finding
  -> no-action decision
  -> memory adaptation request
  -> prompt-flow improvement request
  -> skill/doc improvement request
  -> capability request
  -> backlog task
  -> initiative
```

## Prompt Flow Model

Prompt flows are reusable deterministic pipelines that hats can execute. They are similar in spirit to existing prompt flows, but Organization-native.

They should also be the first practical host for the repo's universal-action-space work. The repo does not yet contain one canonical Universal Action Grammar specification, but it has adjacent prior art:

- `docs/backlog/P3/081KQTPYE0008QG0R0009F20NN-fsharp-codeact-bridge-engineering-aaron-2026-05-05.md` frames CodeAct as executable Python in a unified action space, while preserving Zeta's stronger F# DSL for DST-safe, retraction-native, scale-free, DBSP-native work.
- `docs/backlog/P3/081KQTPYE0008QG0R00209Q9RT-coconut-universal-action-space-research-lane-aaron-2026-05-05.md` keeps the broader universal-action-space research lane alive across CodeAct, Coconut, GibberLink, and LAPA.
- `docs/SAFE-AUTONOMOUS-ACTIONS.md` defines a bounded, reversible action set with explicit preconditions, undo paths, logging, and one-action-per-tick discipline.
- `docs/research/2026-04-26-action-mode-classification-correction-and-self-provenance-accountability-framing.md` defines action-mode classification and provenance/accountability framing.

The Organization should reuse those ideas instead of inventing another unrelated action language. Prompt flows become the hat-scoped, review-gated operational layer; the Universal Action Grammar becomes the shared action representation inside phases.

## Universal Action Grammar Fit

For Agentic Organization, a Universal Action Grammar should describe an action as a typed, reversible, observable unit:

```ts
type UniversalAction = {
  verb: string;
  target: {
    kind: "work_item" | "document" | "repo" | "tool" | "memory" | "meeting" | "run" | "credential" | "policy";
    id: string;
  };
  actor: {
    agentId: string;
    hatAssignmentId: string;
    actionMode: "supervised" | "autonomous_fail_open" | "human_directed";
  };
  preconditions: string[];
  inputs: Record<string, unknown>;
  expectedOutputs: string[];
  observationContract: string[];
  reversibility: "read_only" | "reversible" | "compensating_action" | "irreversible_requires_approval";
  undoPath?: string;
  evidenceRequired: string[];
  policyRefs: string[];
};
```

This is not a replacement for MCP tools, Temporal workflows, F# DSLs, or CodeAct-style Python. It is the grammar that lets the Organization describe what an agent is doing across all of them.

Mapping:

| Existing prior art | Organization use |
|---|---|
| CodeAct executable actions | A prompt-flow phase may emit executable code actions when ecosystem reach is useful |
| F# DSL / Zeta operator algebra | Hodl-required actions stay in typed, DST/retraction-safe substrate surfaces |
| Safe autonomous actions | Every action needs tier, precondition, reversibility, undo path, and audit |
| Action-mode classification | Every action records whether it was supervised, autonomous fail-open, or human-directed |
| Prompt-flow phases | Each phase is a bounded action bundle with gates and reviewer hats |

Universal actions should be small enough to review and replay. Prompt flows compose them into useful work.

A prompt flow should define:

- name and version;
- owning department;
- allowed hats;
- required scope and discussion/work anchor;
- phases;
- universal actions allowed per phase;
- MCP tools available per phase;
- required inputs and outputs;
- gates between phases;
- reviewer hats for each gate;
- memory read/write policy;
- artifacts and evidence requirements;
- timeout, retry, and escalation policy;
- ingestion metadata for graph/retrieval.

Prompt flows should be composed of reusable phases:

```text
Reusable phase
  -> universal action grammar contract
  -> input contract
  -> MCP tool contract
  -> output artifact
  -> gate criteria
  -> reviewer hat
  -> memory behavior
```

Example phases:

- gather context;
- inspect repo;
- ask clarification questions;
- draft BRD;
- draft CA;
- write red tests;
- implement;
- run tests;
- perform code review;
- perform QA browser review;
- capture screenshots/traces;
- summarize evidence;
- reflect on memory quality.

## Deterministic Flow Execution

When a hat starts a prompt flow, the agent should be locked into the flow until it completes, pauses, fails, or escalates.

```text
agent wearing hat
  -> select allowed prompt flow
  -> validate work anchor and scope
  -> resolve context pack
  -> execute phase 1 with allowed MCP tools
  -> persist output and evidence
  -> gate review by required reviewer hat
  -> continue / revise / pause / fail / escalate
  -> ingest transcript, artifacts, decisions, and memory events
```

Agents can still reason creatively inside a phase, but the phase boundary, tools, required outputs, and gates are deterministic.

`resolve context pack` is itself policy-driven work. The active hat and phase
select a document-focus profile before retrieval, so a director blocker flow,
implementer execution flow, reviewer gate, or manager reflection block receives
the document types that fit its duty without broadening access. The flow should
record which context refs it consulted and whether those refs helped, failed, or
were missing. That consult ledger becomes the later utility signal for document
ranking and the evidence trail for improving the prompt flow.

Prompt-flow execution should record each universal action, observation, correction, and reviewer decision. That gives the Organization a reusable action corpus: over time, Engineering Managers and prompt-flow designers can discover which action patterns work, which fail, and which should become new reusable phases.

## Flow Gates and Reviewers

Every important phase should have an explicit gate.

Gate examples:

| Flow phase | Reviewer |
|---|---|
| BRD drafted | Business Analyst Reviewer / Product Owner |
| CA drafted | Architecture Reviewer |
| Red tests written | Engineering Manager or Test Reviewer |
| Implementation complete | Code Reviewer |
| QA run complete | QA Reviewer |
| Security-sensitive change | Security Reviewer |
| Memory adaptation proposed | Memory Curator |
| Prompt flow changed | Flow Designer Reviewer / Architecture / Security as needed |

Reviewers should not merely approve text. They should verify evidence, trace links, work anchors, scope, and acceptance criteria.

## Flow Creation and Expansion

Prompt flows should be built by the Organization through the same lifecycle as other capabilities.

```text
manager/director detects repeated slowdown
  -> capability request: new or improved prompt flow
  -> business/product clarifies value and expected outcome
  -> architecture defines flow shape, state, MCP tools, gates, and data model impact
  -> security reviews tool/credential/memory risk
  -> internal capability team implements reusable phases and flow definition
  -> reviewers approve
  -> flow registry activates it for scoped hats
  -> outcome review checks whether the flow improved future work
```

The internal capability team should be able to create:

- new reusable phases;
- new prompt flows;
- flow revisions;
- phase templates;
- flow-specific MCP wrappers;
- validation rules;
- flow telemetry dashboards;
- flow quality reports.

## Flow Registry

The Organization needs a prompt-flow registry.

Suggested records:

- `prompt_flow_definitions`;
- `prompt_flow_versions`;
- `prompt_flow_phases`;
- `prompt_flow_phase_versions`;
- `hat_prompt_flow_bindings`;
- `prompt_flow_gate_policies`;
- `prompt_flow_runs`;
- `prompt_flow_phase_runs`;
- `prompt_flow_artifacts`;
- `prompt_flow_gate_decisions`;
- `prompt_flow_effectiveness_reviews`.

Flows should be ingested into the graph so agents can retrieve:

- which flows are available to a hat;
- which flows worked well for similar tasks;
- which phases often fail;
- which reviewers rejected flow outputs and why;
- which memories/docs/skills were used by a flow;
- whether a flow is deprecated or superseded.

## Memory Reflection Blocks

Memory work should be part of schedule, not an afterthought.

During reflection and memory maintenance, agents should:

- review work just completed;
- identify what helped or slowed them down;
- compare expected outcome to actual outcome;
- decide which memories should be retained, stabilized, updated, scoped, deprecated, or challenged;
- identify outdated or invalid memories;
- create memory adaptation requests when they lack authority to change memory directly;
- attach memory reflections to the relevant hat assignment, project, initiative, task, prompt-flow run, and outcome review.

Memory curators and engineering managers should review repeated memory problems and turn them into tasks, docs, skills, or flow improvements.

## Free Time Guardrails

Free time should support culture and learning, but it still belongs to the Organization runtime.

Allowed free-time activities:

- catch up on relevant inboxes, docs, decisions, and context packs;
- inspect repos or project areas within scope;
- learn a framework, package, codebase, or runtime component relevant to the hat;
- ask anchored questions from other agents;
- propose docs, skills, memories, prompt flows, tools, or backlog items;
- prepare for upcoming work;
- reflect on prior outcomes.

Guardrails:

- free-time discussion still requires a work anchor or context-gap item;
- tool use remains governed by the active hat;
- discoveries become reports, memories, docs, skills, or capability requests;
- free time should not bypass task priority, budget, or hat authority.

## MVP Slice

The first implementation should keep this small:

1. Add schedule templates to hat definitions.
2. Create concrete schedule blocks for active hat assignments.
3. Add one prompt flow with three phases: gather context, execute work, produce evidence.
4. Add one reviewer gate between execution and completion.
5. Add one reflection block that creates a memory adaptation request or no-action decision.

This gives the Organization a heartbeat without requiring every future department rhythm on day one.
