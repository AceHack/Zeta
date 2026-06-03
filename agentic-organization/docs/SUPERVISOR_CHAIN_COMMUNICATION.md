---
title: Supervisor-Chain Communication
canonical_name: Agentic Organization
status: design
---

# Supervisor-Chain Communication

## Status

Implementation concept and first executable package contract.

## Purpose

Agents should never have to guess how to talk upward in the
Organization. Their active hat should explain:

- what duty they are performing;
- who supervises that duty;
- which upward tools are available;
- when each tool should be used;
- what evidence is required;
- what the Organization will do after the signal is sent.

This is the clean primitive underneath blockers, questions, requests,
capability gaps, resource needs, security asks, and escalation.

The north star is a generic lifecycle, not a hardcoded list of forever
tools. The starter tool families below are the minimum vocabulary needed
to make early coordination clear. They are not meant to freeze how the
Organization communicates. Agents and their supervisors must be able to
propose better communication tools, prompt flows, routing rules, review
gates, and lifecycle states as they discover repeated friction.

Non-negotiable duty: build the Organization so agents can expand their
own coordination substrate through governed lifecycle work. The platform
should make expansion reviewable, traceable, scoped, and safe; it should
not make the first tool list a cage.

## Chain

The chain is role/hat based, not agent-worth based.

```text
team member hat
  -> manager hat
  -> director hat
  -> C-suite hat
  -> executive board hat
```

Examples:

- Developer hat reports a blocker to Engineering Manager.
- Engineering Manager requests staffing or escalation from Director.
- Director requests priority or budget decision from C-suite.
- C-suite asks Executive Board for standards, succession, or
  organization-level approval.

## Tool Families

Hats expose upward communication tools as typed tools, not as a generic
chat box.

| Tool type             | Use when                                                           |
| --------------------- | ------------------------------------------------------------------ |
| `ask_question`        | The hat needs clarification before continuing scoped work          |
| `report_blocker`      | Work cannot move without supervisor triage or routing              |
| `request_decision`    | Multiple valid paths exist and authority sits above the hat        |
| `request_resource`    | The team needs hats, time, budget, infrastructure, or access       |
| `request_review`      | A supervisor/reviewer decision is needed before lifecycle progress |
| `report_risk`         | A risk could affect scope, schedule, quality, security, or cost    |
| `suggest_improvement` | The hat sees a process, memory, prompt-flow, tool, or workflow gap |
| `request_escalation`  | The current supervisor level cannot resolve the issue alone        |

These are starter families. A hat may later gain additional
communication tools through the same Organization lifecycle used for
any other internal capability: signal upward, supervisor triage,
director or security routing when needed, implementation, review,
activation, and outcome review.

## Runtime Contract

`send_supervisor_signal` creates a durable signal. It does not
automatically create a task or approve new capability.

The command records:

- source agent and active hat assignment;
- source chain level;
- target chain level;
- target supervisor hat assignment;
- organization, project, team, and work item;
- typed tool used;
- title and message;
- command trace, correlation, causation, and idempotency.

The outbox event is `supervisor_signal.sent`. The runtime reacts by
creating a supervisor triage plan for the target level.

## Hat Communication Brief

Each active hat should receive a communication brief in its context
pack. The brief should be generated from the hat graph and Organization
policy.

Implementation note: `createDeterministicContextPackBuilder(...)` now asks a
`ContextPackHatCommunicationBriefPort` for this brief before document retrieval
results are handed to ephemeral synthesis. The default provider emits a required
`hat_communication_brief` item sourced from the active `HatDefinition`,
`buildHatCommunicationBrief(...)`, and the supervisor-signal tool policy, with
graph pointers to the current hat and target supervisor hat. That keeps the
generic communication lifecycle visible to Hermes before it decides whether to
work, ask, report, request, escalate, or suggest an improvement.

The brief includes:

- `hatId`;
- duty statement;
- source chain level;
- supervisor target level and target hat;
- available upward tools;
- when to use each tool;
- evidence required for each tool.

Hermes should see this brief before executing work so it can choose the
lowest-friction communication path instead of inventing one.

### Brief Template

The Gastown role templates are useful because they make each role's
protocol explicit. Agentic Organization should use the same clarity,
but generate it from hats, policy, and work scope instead of static
role files.

Every hat communication brief should answer:

| Field | Meaning |
|---|---|
| Duty | What this hat is responsible for in the current scope |
| Work source | Which queues, work items, meetings, or schedules this hat should watch |
| Authority | What the hat may decide, transition, approve, spawn, or request |
| Prohibited actions | What the hat must not do even if it has general tool access |
| Upward tools | Which supervisor-signal tool families are available |
| Evidence | What must be attached for each tool family |
| Completion protocol | How the hat reports done, blocked, deferred, or handed off |
| Escalation examples | Concrete examples of when to route to manager, director, C-suite, or executive board |
| Schedule behavior | When to answer inbox items immediately and when to reserve a work block |
| Expansion path | How to suggest a new prompt flow, tool, memory policy, or lifecycle rule |

This keeps agent communication efficient without hardcoding one-off
tools. If a developer hat needs a new MCP tool, it should know how to
tell its manager what is missing, with evidence and a work anchor. The
manager then decides whether to answer, route to a director, schedule a
meeting, open internal platform work, or ask security to review the
need.

## Routing Semantics

The target supervisor decides what happens next:

- answer directly;
- open or link a work item;
- route to another department;
- request security review;
- schedule a one-on-one or team discussion;
- escalate to the next supervisor level;
- route to internal platform teams for implementation.

This keeps the lifecycle generic. A missing tool, missing workflow,
missing memory, unclear requirement, security access problem, blocked
task, or staffing issue all start as communication through the same
substrate, then become specialized work only after the responsible hat
triages it.

## Expansion Rule

Do not add one-off command handlers for every new thing an agent wants
to say. Prefer:

```text
hat communication brief
  -> generic supervisor signal
  -> target supervisor triage
  -> specialized lifecycle only if triage requires it
  -> governed expansion of tools or flows when repeated need appears
```

If agents repeatedly need a more specific tool, the Organization should
capture that as evidence that the hat communication brief, prompt-flow
library, or routing policy needs to evolve.
