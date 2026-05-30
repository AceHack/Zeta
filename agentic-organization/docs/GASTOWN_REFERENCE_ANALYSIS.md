---
title: Gastown Reference Analysis
canonical_name: Agentic Organization
status: design
---

# Gastown Reference Analysis

> **Follow-up:** this was a **docs-only** read done before our system was built. The
> **code-level, full-impl-vs-full-impl, maturity-honest** comparison — including the
> prioritized list of shipped-by-them / design-only-for-us capabilities worth building
> (merge queue, model-eval harness, persistent agent pool, layered config, escalation
> ladder, emergency stop, durable/ephemeral comms split) — lives in
> [`GASTOWN_FULL_IMPL_COMPARISON.md`](GASTOWN_FULL_IMPL_COMPARISON.md).

## Purpose

This document records the technical lessons from
`gastownhall/gastown`, inspected as an external reference for Agentic
Organization. Gastown is similar enough to be useful inspiration, but
its premise is different: it is a local workspace manager around Git,
Dolt, beads, tmux sessions, and CLI-driven agents. Agentic
Organization is a cluster-native Organization OS with durable
CockroachDB state, NATS events, hat authority, policy, schedules,
Hermes agents, and work-item anchored orchestration.

The goal is therefore not to copy Gastown. The goal is to keep the
parts that prove useful and deliberately improve the parts that are
too local, too implicit, or too dependent on agents voluntarily
following workflow text.

## Source Snapshot

Reference checkout:

```text
C:\Users\Max.Chadaev\OneDrive - Toshiba TEC\Desktop\Work\_reference_gastown
```

Upstream: `https://github.com/gastownhall/gastown.git`

Inspected commit: `241a72c642975b43f094c8096b3ed1430dd4adc9`

Inspection date: `2026-05-29`

Primary files inspected:

- `README.md`
- `docs/design/architecture.md`
- `docs/concepts/molecules.md`
- `docs/design/scheduler.md`
- `docs/design/escalation.md`
- `docs/design/mail-protocol.md`
- `docs/design/convoy/spec.md`
- `docs/design/witness-at-team-lead.md`
- `internal/scheduler/capacity/pipeline.go`
- `internal/events/events.go`
- `internal/mail/types.go`
- `internal/refinery/manager.go`

## What Works

Gastown has several strong ideas we should keep conceptually.

### Persistent Identity, Ephemeral Sessions

Gastown separates persistent agent identity from ephemeral sessions.
Polecats can disappear, resume, or be replaced while the work record
persists. Agentic Organization should keep this distinction:

```text
agent identity
  != active Hermes session
  != hat assignment
  != schedule block
  != work item ownership
```

This maps cleanly to our hat assignment TTLs, schedule blocks,
Hindsight memories, and Oz/Hermes run bindings.

### Two-Level Coordination Ledger

Gastown separates town-level coordination from rig-level project work.
That shape is useful, but our version should be more general:

```text
organization
  -> department
  -> project
  -> initiative
  -> team
  -> work item
```

The lesson is that cross-project coordination and project execution
should not be forced into one flat backlog. Agentic Organization should
keep executive, C-suite, director, manager, TPM, and team activity
scoped in the graph so each layer can inspect and act at its natural
level.

### Context Records Separate From Work Records

Gastown's scheduler stores dispatch metadata in separate "sling
context" beads instead of mutating the work bead. This is a good
principle. In Agentic Organization, schedule blocks, run bindings,
meeting reservations, reviewer reservations, and prompt-flow runs
should be separate records linked to the work item. The work item is
the anchor, not a junk drawer for every runtime concern.

### Event-Driven Completion With Recovery Scans

Gastown's convoy manager uses an event-driven observer for issue-close
events and a periodic stranded scan as a recovery net. This is one of
the strongest practical patterns in the repo.

Agentic Organization should use the same shape:

```text
domain event
  -> inbox dedupe
  -> reaction plan
  -> reaction execution
  -> recovery scan catches missed or stale reactions
```

The first code-level adoption is now present in V0: a work item entering
`ready` requests implementation assignment, and a work item entering
`review` requests a reviewer gate. Future phases should generalize that
into configurable organization, department, project, initiative, team,
and hat rules.

### Health Supervisors Are Necessary

Gastown's Witness, Deacon, Dogs, Boot, and daemon checks are valuable
because autonomous agents do stall, disappear, duplicate work, leave
dirty worktrees, or fail to land finished work. Agentic Organization
needs the equivalent, but with less mascot-specific naming:

- team manager observers;
- department health reconcilers;
- run and pod watchdogs;
- dead-letter classifiers;
- stale schedule scanners;
- abandoned worktree recovery;
- blocked-work and silent-agent escalation.

### Merge Queue As A First-Class Runtime

Gastown's Refinery is useful inspiration for release management. It
recognizes that "agent says done" is not enough. Work must go through
review, verification, merge, failure isolation, and redispatch.

Agentic Organization should build this as release and promotion
workflows attached to initiatives, not as a per-rig side tool.

### Communication Types Matter

Gastown's mail protocol distinguishes direct messages, queue messages,
broadcast/channel messages, handoffs, help, merge-ready, merge-failed,
and recovered-work messages. That aligns with our communication
model:

- supervisor signals;
- inbox items;
- meeting requests;
- one-on-one discussions;
- team discussions;
- team broadcasts;
- review requests;
- handoffs;
- escalation paths.

The key addition in our system is that every communication must be
anchored to work, project, initiative, or a valid organization-level
decision context.

## What Not To Copy

Gastown also shows failure modes we should avoid.

### Workflow Text Is Not Enforcement

Gastown molecules often render workflow steps inline for agents to
read. That is useful context, but it is not enough enforcement.
Agents can skip steps, misunderstand a checklist, or mark work done
without the right evidence.

Agentic Organization must make prompt flows executable:

```text
phase
  -> allowed tools
  -> preconditions
  -> required evidence
  -> reviewer gate
  -> state transition authority
  -> telemetry
```

The prompt text can explain the duty, but the runtime must enforce the
gates.

### Single Coordinator Bottlenecks

Gastown leans heavily on Mayor, Deacon, Witness, and Refinery roles.
Those are useful metaphors, but a single coordinator per level can
become a bottleneck or single point of failure.

Agentic Organization should keep hierarchy while avoiding singleton
dependence:

```text
executive board
  -> elects or provisions C-suite hats
  -> C-suite provisions directors
  -> directors provision TPMs and managers
  -> managers organize teams
  -> teams execute and review work
```

Each role is a hat with authority, TTL, succession, review, and
observable performance. The hat persists; the wearer can change.

### CLI And Local Files Are Not A Cluster Control Plane

Gastown relies on local CLI commands, tmux sessions, git worktrees,
file locks, local JSONL logs, and Dolt/beads. That is reasonable for a
developer workstation, but it does not satisfy our cluster runtime
needs.

Agentic Organization should keep the semantics while changing the
substrate:

| Gastown shape | Agentic Organization shape |
|---|---|
| beads work item | CockroachDB work item and graph edge |
| git/file event log | durable outbox, NATS, inbox receipt, telemetry |
| tmux session | Oz/Hermes run binding in k3s |
| Mayor | elected/provisioned C-suite or executive hats |
| Witness | manager/team health observer plus runtime watchdog |
| Deacon/Dogs | always-on workers and reconcilers |
| sling context bead | schedule block, run binding, prompt-flow run |
| molecule checklist | executable prompt-flow phases and gates |
| refinery | release/promotion workflow and review gates |

### Messaging Must Not Become Dispatchable Work

Gastown has a defensive filter that prevents message, handoff, and
merge-request beads from being dispatched as normal work. We should
preserve this distinction at the type-system level. Communications,
meetings, decisions, run bindings, and work items are related but not
interchangeable.

### Polling Alone Is A Weak Runtime

Gastown's own convoy design document says convoys could stall when
completion depended on a poll cycle. The fix was event-driven
completion plus stranded recovery. Our runtime should start from that
lesson:

- event-driven first;
- recovery scan second;
- dashboard and agent visibility always;
- no invisible waiting state.

## How Agentic Organization Builds Beyond Gastown

### Hierarchical Orchestration At Every Layer

Gastown has named agent roles, but Agentic Organization needs each
hierarchy layer to own a real orchestration job:

| Layer | Orchestration duty |
|---|---|
| Executive Board | constitution, succession, final conflict policy, C-suite provisioning |
| C-suite | standards, portfolio priorities, budget/capacity goals |
| Directors | project and initiative priority, department health, tool/process improvement |
| TPM hats | initiative decomposition, schedule/resource flow, blocker movement |
| Engineering Managers | team schedules, work quality, memory/tool gaps, performance reviews |
| Review hats | gate decisions with evidence and authority |
| Implementer hats | scheduled execution, TDD, evidence, handoff |

Each layer should have event subscriptions, queues, dashboards,
scheduled reviews, and authority-scoped tools. This is stronger than a
single Mayor creating work and hoping the workflow carries itself.

### Work-Item Anchored Communication

Gastown mail is useful, but Agentic Organization should require every
conversation to anchor to a valid object:

- project or initiative for executive and C-suite meetings;
- initiative for director or TPM meetings;
- work item for developer, reviewer, and manager discussions;
- incident or service request for operational escalations;
- organization governance item for constitution-level decisions.

No mindless discussion enters durable state. A message without an
anchor should be rejected or routed to a draft/private scratch surface
until anchored.

### Reaction Plans, Not Direct Side Effects

Gastown often calls CLI actions directly from daemon or command paths.
Our event flow should remain:

```text
event observed
  -> deterministic rule evaluation
  -> reaction plan persisted
  -> policy, lease, budget, and schedule checks
  -> execution
  -> observed outcome
```

This keeps retries, audits, UI projection, agent self-healing, and
human review understandable.

### Schedules Are First-Class

Gastown has capacity scheduling, but Agentic Organization needs
hat-aware time allocation. Meetings, review gates, implementation,
memory maintenance, free time, reflection, and department reviews must
reserve schedule blocks. When a meeting is called, it should be planned
into participant work schedules and visible in their inboxes. If an
agent misses the block, the runtime should produce stale schedule
evidence and reschedule/escalate according to policy.

### Capability Growth Through The Normal Lifecycle

Gastown has plugins and formulas. Agentic Organization should let
agents notice missing tools or workflows, communicate that to their
manager, and have the need move through director, security, product,
architecture, implementation, review, and activation as normal work.
The platform should not hard-code one "capability request" tool as the
main abstraction.

## Implementation Decisions For Our System

1. Keep `send_supervisor_signal` as the first generic communication
   primitive. Gastown's escalation and mail types support this direction.
2. Keep communication, scheduling, prompt-flow runs, and runtime
   bindings as separate records linked to work items. Do not overload
   work item descriptions.
3. Add event-driven reaction rules for meaningful work state changes.
   The current V0 now requests implementation assignment when a work
   item enters `ready` and requests a reviewer gate when a work item
   enters `review`.
4. Add recovery scanners in later phases for stale reaction plans,
   stranded scheduled work, silent agents, unreconciled run bindings,
   and abandoned worktrees.
5. Build prompt flows as executable phase/gate contracts, not only
   rendered instructions.
6. Build release management as an initiative-aware promotion workflow,
   not only a merge queue.
7. Keep all vendor-specific runtime code behind ports. Gastown is Go and
   CLI-heavy; Agentic Organization remains TypeScript, NodeNext,
   CockroachDB behind generic state ports, NATS behind messaging ports,
   and k3s/Oz/Hermes behind app-level adapters.

## Code Delta From This Review

The review produced a small set of executable improvements:

- `@agentic-org/runtime` now reacts only to transition-shaped
  `work_item.state_changed` events. Entering `ready` creates a
  `request_implementation_assignment` reaction plan for an Engineering
  Manager. Entering `review` creates a `request_review_gate` reaction
  plan for a Reviewer.
- Reaction-plan execution now uses stable action idempotency keys and
  refuses to run an action if the claimed lease is already expired
  before the action starts. This borrows Gastown's double-dispatch
  caution while using durable claim fencing instead of local file locks.
- Retryable reaction failures now return to `planned` only after a
  backoff window, increment attempt count, and become terminal when max
  attempts are exhausted. This keeps always-on automation from turning a
  temporary missing actor or schedule denial into a hot loop.
- Cockroach-backed reaction claims use database time for lease fencing
  and validate durable action JSON per action type before the runtime
  executor can see it.
- `@agentic-org/application` now has a generic reaction action executor
  that converts supervisor-triage, implementation-assignment, and
  review-gate reactions into normal `create_discussion_anchor` commands
  through the command pipeline. The action fails retryably if the
  accepted command result does not include the expected discussion
  anchor artifact. The reaction executor still owns leasing;
  application commands still own policy, idempotency, effects, audit,
  and outbox. Schedule authority gates the later consequential work,
  while V0 anchor creation remains schedule-exempt routing metadata.

This is intentionally small. It proves the pattern without copying
Gastown's local dispatcher model.

## Open Follow-Ups

- Define schedule-block records and event rules for meetings, review
  reservations, implementation blocks, reflection blocks, memory
  maintenance, and free-time blocks.
- Add stranded-reaction and stale-schedule scanners to the worker host.
- Add communication records and graph edges for one-on-one, team,
  broadcast, review, and meeting threads.
- Add release/promotion state and evidence records inspired by
  Refinery, but initiative-scoped and policy-gated.
- Add prompt-flow phase records with required evidence and reviewer
  authority.
- Add UI projections for active hierarchy health, work queues,
  meetings, decisions, blocked work, and reaction-plan backlog.
