# V0 Schema and Commands

## Purpose

This document defines the first TypeScript-facing schema and command
contract for Agentic Organization. It is not a full DDL. It is the shape
the domain model, Drizzle migrations, command handlers, MCP tools,
workers, and tests should agree on before implementation starts.

The durable state adapter is the authoritative store for
Organization-owned state. CockroachDB is the first implementation
because it exists in `full-ai-cluster`, but application code must depend
on generic state ports so another database can replace it later.
Temporal history, Dapr actor state, NATS streams, Hindsight memory, and
hat-system CRDs are runtime surfaces or projections. They do not replace
the Organization database boundary.

## Global Columns

Every authoritative table should include:

| Column                         | Purpose                                                   |
| ------------------------------ | --------------------------------------------------------- |
| `id`                           | stable unique ID                                          |
| `organization_id`              | future multi-org partition key, even if V0 uses one org   |
| `created_at`                   | creation time                                             |
| `updated_at`                   | last mutation time                                        |
| `version`                      | optimistic concurrency and projection safety              |
| `created_by_agent_id`          | agent that caused the write, when applicable              |
| `created_by_hat_assignment_id` | hat authority that caused the write, when applicable      |
| `correlation_id`               | end-to-end request/run correlation                        |
| `causation_id`                 | direct parent command, event, tool call, or workflow step |
| `trace_id`                     | observability trace link                                  |

Append-only records should also carry `sequence` when replay order
matters.

## Schema Groups

### Identity and Hats

| Table                    | V0 responsibility                                                           |
| ------------------------ | --------------------------------------------------------------------------- |
| `agents`                 | known Hermes-capable agents and their stable identity                       |
| `agent_sessions`         | live or historical Hermes sessions bound to an agent                        |
| `departments`            | first department containers for ownership and review routing                |
| `hat_definitions`        | Organization-owned hat catalog                                              |
| `hat_authority_rules`    | typed permissions, scopes, and policy metadata for a hat                    |
| `hat_skill_bindings`     | skills and prompt-flow availability attached to a hat                       |
| `hat_supply_policies`    | max concurrency, TTL, cooldown, warmup, and assignment rules                |
| `hat_assignments`        | time-bounded wearer assignment for a specific agent/session                 |
| `hat_tokens`             | short-lived JWT issuance, refresh, revocation, and expiry state             |
| `hat_system_projections` | last observed Hat, HatBinding, HatSwap, and HatPolicy state from Kubernetes |

### Work Management

| Table                     | V0 responsibility                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `projects`                | top-level work containers                                                              |
| `initiatives`             | project-scoped bodies of work                                                          |
| `work_items`              | supervisor-chain signals, capability requests, tasks, defects, reviews, and follow-ups |
| `work_item_state_history` | append-only state transitions                                                          |
| `work_item_dependencies`  | blocking or informational dependencies                                                 |
| `blockers`                | active impediments with owner, severity, and resolution path                           |
| `assignments`             | work item to agent/hat/session assignment records                                      |
| `gates`                   | required review points for readiness, code, QA, memory, or security                    |
| `gate_decisions`          | approve, reject, needs-changes, or defer decisions                                     |
| `quality_gate_evaluations` | typed V0 business, architecture, runtime, final business, and release readiness gate evaluations with BRD business-rule evidence |
| `releases`                | release groupings once release management enters the slice                             |

The first Cockroach-backed Work Anchor Kernel migration is
`0003_agentic_org_work_anchor_kernel`. It is additive over the legacy
`0001_agentic_org_core_state` table shape: V1 remains the historical
bootstrap migration, while V3 creates projects, initiatives, work anchor
targets, and state history, then upgrades `work_items` with
`initiative_id`, required `work_item_type`, `updated_at`, `version`,
`correlation_id`, `causation_id`, and `trace_id`. The V3 migration
keeps a visible `migration-backfill` value for legacy trace columns so
old rows remain queryable without pretending they came from a real
agent command. Those migration defaults are dropped before the migration
sets the columns `NOT NULL`, so new command handlers must still provide
real trace fields through the command contract. `updated_at` is added
without a default and backfilled from `created_at` so legacy work items
preserve their original timestamp. `work_item_state_history` is
append-only with positive per-work-item sequence numbers so replay order
cannot be duplicated or zero-filled.

### Schedules, Prompt Flows, and Actions

| Table                           | V0 responsibility                                                  |
| ------------------------------- | ------------------------------------------------------------------ |
| `hat_schedule_templates`        | default work rhythm by hat                                         |
| `work_schedules`                | concrete schedule assigned to an agent/hat context                 |
| `work_schedule_blocks`          | work-item-scoped schedule authority blocks with assigned agent/hat, type, state, window, optional discussion anchor, trace, and anti-overlap capacity guard |
| `hat_assignment_authorities`    | durable projection of active/revoked/expired/released/suspended hat assignment authority for command-time resource checks |
| `prompt_flow_definitions`       | named deterministic work protocols                                 |
| `prompt_flow_versions`          | immutable versioned prompt-flow contract                           |
| `prompt_flow_phases`            | ordered reusable phases                                            |
| `hat_prompt_flow_bindings`      | which hats can run which prompt flows                              |
| `prompt_flow_runs`              | one execution of a prompt-flow version                             |
| `prompt_flow_phase_runs`        | state and evidence for each phase execution                        |
| `prompt_flow_gate_decisions`    | reviewer decisions at phase boundaries                             |
| `universal_action_definitions`  | typed action grammar catalog                                       |
| `universal_action_records`      | action intent emitted by an agent or workflow                      |
| `universal_action_observations` | observed result, evidence, and side effects for an action          |

### Communication, Graph, Documents, and Context

| Table                  | V0 responsibility                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `supervisor_signals`   | supervisor-chain and capability-request intake records before or during work-item routing |
| `discussion_anchors`   | required typed work anchor for any discussion; V0 persists work-item-scoped anchors with team/project provenance |
| `conversation_threads` | one-on-one, team, department, executive, or broadcast thread                              |
| `messages`             | immutable message log with actor and hat attribution                                      |
| `meetings`             | structured meeting sessions with mode and anchor                                          |
| `decision_records`     | explicit decisions linked to work, discussion anchors, rationale, alternatives, and follow-up work |
| `quality_gate_evaluations` | business quality gate outcomes linked to work, discussion anchors, artifacts, business-rule results, and release readiness |
| `documents`            | BRDs, CAs, ADRs, reports, test cases, runbooks, and memory reviews                        |
| `artifact_links`       | logs, screenshots, traces, code refs, PRs, builds, and uploads                            |
| `graph_nodes`          | agent-readable graph node registry                                                        |
| `graph_edges`          | typed relationships between work, docs, messages, decisions, runs, and memories           |
| `context_packs`        | deterministic context bundles assembled for an agent run or review                        |

### Runtime, Memory, Security, and Audit

| Table                 | V0 responsibility                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hermes_runs`         | Organization binding to a Hermes execution session                                                                                                       |
| `mcp_tool_calls`      | governed tool call attempts and results                                                                                                                  |
| `memory_events`       | Hindsight recall, retain, reflect, and review attribution                                                                                                |
| `credential_requests` | requests to expand credential proxy or external tool scope                                                                                               |
| `signals`             | durable internal signals consumed by workers and UI read models                                                                                          |
| `audit_events`        | append-only policy and state-change audit trail with policy decision evidence when allowed                                                               |
| `outbox_events`       | transactional event publication source for NATS                                                                                                          |
| `policy_observations` | durable, queryable denied policy decision observations for UI, agents, and audit projections; allowed decisions are projected onto audit/outbox evidence |
| `runtime_leases`      | scheduler, reconciler, and worker leases                                                                                                                 |
| `idempotency_keys`    | command deduplication records                                                                                                                            |

## V0 Enums

Use typed enums in TypeScript and database constraints. Do not rely on
magic strings in command handlers.

### `work_item_state`

```text
created
intake
triage
ready
in_progress
blocked
review
done
```

The first implemented TypeScript enum is intentionally narrower than the
full future workflow matrix. `created` is the mechanical creation state;
`intake` is where the Organization classifies the work before triage;
`triage` is where required fields and evidence are gathered; `ready`
means the item can be scheduled/assigned; `in_progress`, `blocked`,
`review`, and `done` cover the first execution loop. Richer states such
as business approval, architecture approval, QA signoff, merge, release,
and outcome review should be layered as gates or type-specific lifecycle
records before they are promoted into the shared base enum.

Defect work items have V0 lifecycle guards:

- defects must start in `created`;
- defects cannot move from `triage` to `ready` until triage fields and
  required evidence exist;
- defects cannot move from `ready` to `in_progress` until an engineer hat
  assignment and scheduled work block exist.

`work_item_type` is required on the domain record so type-specific
lifecycle policy cannot be bypassed by omission. Work state transition
records must keep the evidence artifact IDs, assigned engineer hat
assignment, and scheduled work block references that justified the
transition.

### `hat_assignment_state`

```text
requested
reserved
warmup
active
expired
revoked
released
denied
```

### `hat_token_state`

```text
issued
refresh_required
refreshed
expired
revoked
denied
```

### `gate_state`

```text
not_required
waiting
in_review
approved
rejected
changes_requested
deferred
```

### `prompt_flow_run_state`

```text
queued
running
waiting_for_gate
waiting_for_input
succeeded
failed
canceled
expired
```

### `schedule_block_state`

```text
scheduled
active
paused
completed
missed
canceled
```

### `hermes_run_state`

```text
requested
starting
running
heartbeat_late
succeeded
failed
canceled
lost
reconciled
```

### `discussion_anchor_type`

```text
project
initiative
work_item
gate
release
incident
memory_review
supervisor_signal
capability_request
```

Implementation note: the first executable slice supports `create_discussion_anchor`
only when the command references an existing `work_item_id` in the same
organization and project. This matches the current event envelope, where
`workItemId` is required for traceable NATS events and Cockroach outbox
records. The V0 durable store and `0005_agentic_org_discussion_anchor_kernel`
also constrain persisted discussion anchors to `work_item` so future broader
anchors cannot sneak in through lower-level command effects. Project-only and
initiative-only anchors remain valid design targets, but they should widen the
event scope contract explicitly instead of faking a work item.

`record_decision` is implemented on the same V0 work-item scope. A decision
record must reference an existing discussion anchor in the same organization,
project, optional team, and work item, and that anchor must have been opened
with `decision` in `expectedOutputs`. This keeps decisions from becoming
orphaned conclusions and gives agents a deterministic traversal path from work
item -> discussion anchor -> decision record -> follow-up work.
Any follow-up work IDs named by a decision must also resolve to existing work
items in the same organization and project before the decision is accepted.

`record_quality_gate_evaluation` is implemented on the same V0 work-item scope.
A quality gate evaluation must reference an existing discussion anchor in the
same organization, project, optional team, and work item, and that anchor must
have been opened with `gate_result` in `expectedOutputs`. This makes RFP review,
BRD approval, architecture approval, implementation review, runtime validation,
final business validation, and release readiness a generic gate lifecycle
instead of one-off tooling. Every gate evaluation must carry at least one
evaluated artifact ID so an approval cannot exist as a summary-only assertion.
An approved `final_business_validation` gate requires every business rule result
to be `satisfied`, `not_applicable`, or `changed_by_decision`;
`partially_satisfied` and `not_satisfied` force a non-approval outcome so the
Organization can route corrective work.
Approved later gates also pass the company Work OS gate-chain policy before any
effects are emitted. The application reads prior quality gate evidence through a
generic `QualityGateEvaluationStateReaderPort`; in-memory and Cockroach adapters
implement that port. A later gate approval is rejected unless every required
earlier gate is already `approved` or `waived`, so release readiness cannot be
recorded before final business validation.

`schedule_work_block` is implemented as the first V0 schedule/RMO primitive.
It creates a `scheduled` `work_schedule_block` for one assigned agent and hat
against an existing work item. The command validates the work item, strict ISO
instant window, optional work-item discussion anchor scope, and assigned hat
authority through generic reader ports before it emits effects. V0 requires
the assigned hat assignment to exist, be `active`, belong to the assigned
agent, and match the organization/project/team scope; later hat supply and
lease services can replace the reader adapter without changing the command
handler. The handler then writes audit/outbox effects with
`work_schedule_block.scheduled`. The in-memory store and
Cockroach command outcome adapter reject overlapping `scheduled` or `active`
blocks for the same hat assignment before committing so schedule authority is
not a best-effort convention. That conflict is returned through the generic
command outcome port as an `effect_conflict`; the command pipeline converts it
to a typed `precondition_failed` command result instead of letting adapter
exceptions leak into API, MCP, Hermes, or worker callers.

Durable adapters preserve idempotency precedence over effect validation:
replays and idempotency conflicts are resolved before unsupported or conflicting
effects are evaluated. Durable JSON fields are also shape-checked on read; for
example, a malformed scalar `expected_outputs` value is treated as an invalid
discussion anchor snapshot instead of being allowed to satisfy a decision gate.
Unsupported durable effect conflicts throw inside the transaction and are mapped
back to typed `effect_conflict` results so an idempotency claim cannot commit
without the corresponding business/audit/outbox effects.

Hat assignment authority is now available to application code through a generic
reader port and a Cockroach projection adapter. `schedule_work_block` uses that
port to validate the assigned hat before creating schedule effects, while the
command authorization request also carries resource context
(`assignedAgentId`, `assignedHatAssignmentId`, block type, start, end) so policy
can decide whether the scheduler may reserve that exact allocation.

### `signal_type`

```text
work_item.changed
decision.recorded
quality_gate.evaluated
gate_requested
gate_decided
hat_assignment_changed
hat_token_changed
schedule_block_changed
work_schedule_block.scheduled
prompt_flow_changed
hermes_run_changed
memory_event_recorded
credential_request_changed
blocker_changed
outcome_review_completed
hat_system_tick_observed
```

## Command Contract

Every side-effecting command must include:

- `commandId`;
- `idempotencyKey`;
- `actor.agentId`;
- `actor.hatAssignmentId`, when the actor is wearing a hat;
- `organizationId`;
- `projectId` or explicit reason none is available;
- `correlationId`;
- `causationId`;
- `traceId`;
- `expectedVersion`, when mutating an existing aggregate;
- enough authorization context to derive a policy request, currently
  `actor: { agentId, hatAssignmentId }`, scope, tool type,
  supervisor-chain target, and trace fields.

Every command handler must:

1. load authoritative state through the state-store port;
2. receive commands only after the command pipeline validates actor
   context and hat authority through the policy port;
3. validate lifecycle transition;
4. write state, audit event, and outbox event in one transaction;
5. return the authoritative post-state;
6. be idempotent under retry.

Accepted command audit and outbox effects should carry the policy
decision that allowed the command. Denied commands should not create
business audit, outbox, or idempotency state; they should be observed
through the policy decision observation port and persisted by a dedicated
durable adapter.

Policy observations are keyed by policy decision ID and include command,
actor, hat assignment, organization, project, optional team/work item,
tool type, supervisor-chain source/target levels, trace IDs, policy
version, idempotency key, denial reason, a canonical observation hash,
and the canonical observation JSON. Replays with the same policy
decision ID and hash are idempotent; replays with the same policy
decision ID and different evidence are conflicts and must not be hidden
as safe duplicates. Readers must support scoped queries for agent/UI
review without exposing CockroachDB types to application code.

## V0 Commands

| Command                     | Actor scope                                                                                | Writes                                                                                                   | Emits                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `create_work_item`          | manager, TPM, director, or authorized work-routing automation                              | `work_items`, `audit_events`, `outbox_events`                                                            | `work_item.changed`                                                |
| `send_supervisor_signal`    | any authorized hat with supervisor line; capability request inputs enter through this path | `supervisor_signals`, `audit_events`, `outbox_events`; reaction execution owns any follow-up work/discussion records | `supervisor_signal.sent`                                           |
| `triage_supervisor_signal`  | target supervisor hat, director, or engineering manager                                    | V0 `open_work_item` path validates the supervisor signal and emits a follow-up `work_item.changed`; later triage actions add signal status, assignments, gates, and context packs | `work_item.changed` |
| `create_discussion_anchor`  | any authorized hat with validated work anchor                                              | `discussion_anchors`, `audit_events`, `outbox_events`; graph edge projection follows                     | `discussion_anchor.created`                                       |
| `record_decision`           | any authorized hat with a validated decision-capable discussion anchor                     | `decision_records`, `audit_events`, `outbox_events`; graph edge projection follows                       | `decision.recorded`                                               |
| `record_quality_gate_evaluation` | authorized reviewer/business/product/architecture/delivery hat with a validated gate-result discussion anchor | `quality_gate_evaluations`, `audit_events`, `outbox_events`; graph edge projection follows | `quality_gate.evaluated` |
| `create_context_pack`       | manager, reviewer, implementer for assigned work                                           | `context_packs`, `graph_edges`, `audit_events`                                                           | `work_item.changed`                                                |
| `mark_work_ready`           | manager or reviewer                                                                        | `work_items`, `work_item_state_history`, `gates`                                                         | `work_item.changed`, `gate_requested`                              |
| `reserve_hat`               | manager, director, platform operator                                                       | `hat_assignments`, `hat_tokens`, `audit_events`                                                          | `hat_assignment_changed`                                           |
| `issue_hat_token`           | hat service, after policy allow                                                            | `hat_tokens`, `audit_events`                                                                             | `hat_token_changed`                                                |
| `refresh_hat_token`         | active assigned agent/session                                                              | `hat_tokens`, `audit_events`                                                                             | `hat_token_changed`                                                |
| `revoke_hat_assignment`     | manager, director, security, policy automation                                             | `hat_assignments`, `hat_tokens`, `audit_events`                                                          | `hat_assignment_changed`, `hat_token_changed`                      |
| `schedule_work_block`       | manager, TPM, scheduler, or authorized work-routing automation with validated work anchor   | `work_schedule_blocks`, `audit_events`, `outbox_events`; later graph edge projection follows              | `work_schedule_block.scheduled`                                    |
| `start_schedule_block`      | assigned agent/session or scheduler                                                        | `work_schedule_blocks`, `agent_sessions`                                                                 | `schedule_block_changed`                                           |
| `start_prompt_flow`         | assigned agent/session                                                                     | `prompt_flow_runs`, `prompt_flow_phase_runs`                                                             | `prompt_flow_changed`                                              |
| `record_universal_action`   | assigned agent/session, workflow activity, adapter                                         | `universal_action_records`, `mcp_tool_calls`, `audit_events`                                             | `prompt_flow_changed`                                              |
| `record_action_observation` | adapter, worker, reviewer, assigned agent                                                  | `universal_action_observations`, `artifact_links`                                                        | `prompt_flow_changed`                                              |
| `launch_hermes_run`         | runtime service or Temporal activity                                                       | `hermes_runs`, `agent_sessions`, `audit_events`                                                          | `hermes_run_changed`                                               |
| `record_hermes_run_status`  | Hermes/OZ callback, reconciler, platform operator                                          | `hermes_runs`, `artifact_links`                                                                          | `hermes_run_changed`                                               |
| `submit_evidence`           | implementer, QA, reviewer, adapter                                                         | `artifact_links`, `graph_edges`, `audit_events`                                                          | `work_item.changed`                                                |
| `request_gate_review`       | implementer, manager, workflow                                                             | `gates`, `work_items`                                                                                    | `gate_requested`, `work_item.changed`                              |
| `decide_gate`               | reviewer hat, not same active implementer assignment                                       | `gate_decisions`, `gates`, `work_items`, `audit_events`                                                  | `gate_decided`, `work_item.changed`                                |
| `record_memory_event`       | memory adapter, assigned agent/session, memory curator                                     | `memory_events`, `graph_edges`, `audit_events`                                                           | `memory_event_recorded`                                            |
| `submit_credential_request` | any authorized hat with anchored work                                                      | `credential_requests`, `work_items`, `discussion_anchors`                                                | `credential_request_changed`                                       |
| `complete_outcome_review`   | manager, memory curator, reviewer                                                          | `work_items`, `decisions`, optional follow-up `work_items`                                               | `outcome_review_completed`                                         |

## Idempotency

Use deterministic idempotency keys at command boundaries:

```text
<command-name>:<scope-id>:<external-id-or-command-id>
```

Examples:

```text
launch_hermes_run:work_item_123:prompt_flow_run_456
record_hermes_run_status:hermes_run_789:callback_abc
decide_gate:gate_123:reviewer_assignment_456
```

The idempotency record should store:

- request hash;
- command result reference;
- first-seen timestamp;
- last-seen timestamp;
- status;
- error class for terminal failures.

If the same key appears with a different request hash, reject it as an
idempotency conflict.

## Outbox and NATS

Durable state transactions should write domain state and `outbox_events`
together. The first durable adapter uses CockroachDB, but the command
model only depends on generic state ports. A worker publishes outbox
rows to NATS JetStream and marks them published.

The first Cockroach adapter set is composed through a generic SQL
executor and durable adapter factory. The same executor shape backs
command state, outbox publishing, event ingestion, policy observations,
and the core migration runner. Generated migration SQL and checked-in
`packages/state-cockroach/migrations/*.sql` files are tested for exact
synchronization so app bootstrappers and file-based migration consumers
observe the same schema. App hosts may bind that executor to a real
Cockroach client, but domain, application, runtime, policy, messaging,
and worker packages must not depend on the concrete client or connection
pool.

Work-anchor commands should return application-level work-anchor command
effects rather than writing concrete state directly. Those effects cover
projects, initiatives, work items, work anchor targets, and work-item
transitions, and the command outcome port persists them atomically with
idempotency, audit, and outbox effects. The command-facing effect types
carry the same command provenance metadata required by Cockroach
(`updated_at`, `version`, `correlation_id`, `causation_id`, `trace_id`)
so vendor adapters do not invent trace values. The state adapters still
expose one atomic `transitionWorkItem` operation that checks expected version,
requires the next work item version to advance exactly once, requires
the transition work item, organization, project, initiative, type, and
from/to states to match the updated work item, validates the transition
against the domain state machine, accepts explicit lifecycle evidence
such as defect triage-field completion, and enforces positive
per-work-item sequence numbers before mutating state.
The in-memory test adapter clones records across its read/write boundary
so command tests cannot mutate persistence state by object reference in a
way the Cockroach adapter would not permit.
Cockroach is implemented as a vendor-specific implementation of that
same port and is exposed through durable state adapter composition;
application code must not call `state-cockroach` schema helpers directly.
Application package code also must not import the `state` package; it
uses its own structural command effect and reader contracts so concrete
state packages remain adapters. The command pipeline can provide that
reader contract to handlers, allowing commands such as
`send_supervisor_signal` to reject missing or wrong-scope related work
before they emit state, audit, or outbox effects. The in-memory command
outcome adapter must apply the same duplicate-record and transition
validation semantics as the standalone work-anchor store so tests do not
accept a command effect that Cockroach would reject.
State-history metadata is protected by an additive V4 migration so
databases that already applied the V3 work-anchor kernel still receive
the transition `updated_at` and `version` columns the port requires.

The first concrete work-anchor command is `create_work_item`. It creates
only the work item record in `created` state, emits `work_item.changed`,
and records audit/outbox effects through the same command outcome
boundary. It may run without a reader in pure unit/bootstrap paths, but
when a work-anchor reader is supplied it must validate that the referenced
project exists and that any referenced initiative belongs to the same
organization and project before emitting effects. Reference failures are
retryable preconditions, so the pipeline does not idempotency-cache them;
a later retry can succeed after the missing project or initiative exists.

Subject shape:

```text
agentic-org.<environment>.<domain>.<event>
```

Examples:

```text
agentic-org.dev.work.work_item.changed
agentic-org.dev.hats.hat_assignment_changed
agentic-org.dev.runtime.hermes_run_changed
agentic-org.dev.memory.memory_event_recorded
agentic-org.dev.cluster.hat_system_tick_observed
```

Consumers must be idempotent. Replays are normal.

## Hat-System Projection

The TypeScript app should consume hat-system CRDs through
`@agentic-org/k8s-hats`.

V0 should project:

- `Hat` into `hat_system_projections`;
- `HatBinding` into runtime assignment status;
- `HatSwap` into `signals`, `audit_events`, and graph edges;
- `HatPolicy` into read-only policy diagnostics.

The projection must be replayable from CRDs and NATS without
double-counting. Organization DB assignments remain authoritative until
an ADR explicitly promotes CRD writeback to live enforcement.

## Migration and Test Expectations

Current executable migration contract:

- `0001_agentic_org_core_state` is the legacy core schema and should not
  be rewritten to include later work-anchor concepts;
- `0002_agentic_org_outbox_claim_fence` is the additive outbox claim ID
  migration;
- `0003_agentic_org_work_anchor_kernel` is the additive Work Anchor
  Kernel migration;
- `0004_agentic_org_work_item_state_history_metadata` is the additive
  state-history provenance migration for databases that already applied
  the V3 kernel;
- `0005_agentic_org_discussion_anchor_kernel` is the additive discussion
  anchor kernel for work-item anchored conversations, meetings, and gates;
- `0006_agentic_org_decision_record_kernel` is the additive decision record
  kernel for explicit decisions linked to discussion anchors and work;
- `0007_agentic_org_work_schedule_block_kernel` is the additive schedule
  block kernel that lets command authority enforce allocated agent time;
- `0008_agentic_org_hat_assignment_authority_projection` is the additive
  hat assignment authority projection used by scheduling and policy readers;
- `0009_agentic_org_reaction_plan_execution_lifecycle` is the additive
  durable reaction-plan execution lifecycle for autonomous worker actions;
- `0010_agentic_org_quality_gate_evaluation_kernel` is the additive business
  quality gate evaluation kernel for RFP, BRD, architecture, runtime,
  final business validation, and release readiness gates;
- generated SQL must match the checked-in migration files exactly;
- database constraints for work item state, work item type, project
  status, initiative status, discussion anchor type, schedule block state,
  schedule block type, hat authority state, supervisor signal state, quality
  gate kind, and quality gate outcome must be generated from TypeScript domain
  enums rather than repeated as hand-typed magic strings.

Before the first implementation PR lands, define tests for:

- enum values and legal transitions;
- policy denials and approvals;
- self-approval denial;
- hat token expiry and refresh;
- idempotent command replay;
- outbox publish retry;
- duplicate Hermes callback handling;
- duplicate HatSwap projection handling;
- context pack generation for an anchored work item;
- prompt-flow phase gate behavior.

Bug fixes must follow the local TDD rule: red test first, then the fix.
