# North Star Alignment Checkpoint

## Status

Current checkpoint after the first executable TypeScript slices and
subagent review.

## Verdict

Agentic Organization is directionally aligned with the north star:

- the primary executable primitive is `send_supervisor_signal`;
- hats are modeled as time-bounded authority, skill, policy, and
  communication roles rather than agent identity;
- Organization DB owns business intent, while cluster substrates enforce
  or project runtime state;
- work, discussions, decisions, runs, evidence, and memory must stay
  anchored to project, initiative, task, gate, incident, release, policy,
  or context-gap work;
- agent time is an Organization resource: meetings, implementation,
  review, verification work performed by QA Reviewer hats, free time,
  reflection, memory maintenance, runtime sessions, credentials, and
  worktrees must be scheduled, allocated, paused, resumed, and reviewed
  rather than treated as ambient chat or unbounded execution;
- the runtime is event-driven through durable state, outbox, NATS
  publication, inbox dedupe, reaction plans, workers, and telemetry;
- the design keeps agents able to expand tools, prompt flows, workflows,
  and lifecycles through governed organizational work instead of a fixed
  list of one-off commands.

The main risk is convergence. The doc set is broad enough that older
sections still describe future products as if they are current V0
entrypoints. V0 must remain smaller and sharper.

## Canonical V0 Product Contract

The current V0 contract is:

```text
hat communication brief
  -> send_supervisor_signal
  -> supervisor triage plan
  -> anchored work item and context
  -> gate decision
  -> hat assignment and scoped runtime authority
  -> scheduled prompt-flow run
  -> Hermes run binding
  -> evidence submission
  -> reviewer decision
  -> outcome review
  -> follow-up work when gaps are found
```

Capability requests, credential requests, missing-tool reports,
workflow gaps, security asks, memory gaps, blockers, questions, and
process-improvement ideas are not separate first primitives. They enter
through supervisor-chain communication, then become specialized work only
after the responsible hat triages them.

## Alignment Confirmed

### Supervisor Chain

`SUPERVISOR_CHAIN_COMMUNICATION.md`, `FIRST_IMPLEMENTATION_SLICE.md`,
`V0_SCHEMA_AND_COMMANDS.md`, and OpenSpec all point at
`send_supervisor_signal` as the generic coordination primitive.

### Hat Model

`CLUSTER_NATIVE_HAT_SYSTEM.md`, `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`,
and `V0_SCHEMA_AND_COMMANDS.md` preserve hats as scoped, time-bounded
roles with authority, skills, RBAC/policy, succession, and supervisor
graph position.

### Work Anchors

`AGENT_NATIVE_KNOWLEDGE_GRAPH.md`, `WORK_AND_RELEASE_MANAGEMENT_OS.md`,
and `UI_AND_OBSERVABILITY_CONCEPTS.md` reject unanchored discussions.
Meetings, one-on-ones, broadcasts, votes, review comments, reports, and
team threads must reference work before they can affect state.

First implementation progress: the domain now has a minimal typed work
item lifecycle (`created`, `intake`, `triage`, `ready`, `in_progress`,
`blocked`, `review`, `done`) plus V0 defect guards for creation,
readiness, assignment, and scheduling. Work item type is required on the
domain record, and transition records carry evidence, assignment, and
schedule references so later UI/graph/agent review can explain why a
transition was legal. The Cockroach schema now has an additive
`0003_agentic_org_work_anchor_kernel` migration for projects,
initiatives, work anchor targets, work item state history, and upgraded
work item trace/type/version columns. V1 remains legacy instead of being
rewritten, generated SQL is checked against migration files, and DB
constraints derive from domain enum values. Migration backfill defaults
are dropped after legacy rows are patched so future writes still require
real command provenance, legacy `updated_at` is preserved from
`created_at`, and state-history sequence constraints protect replay
order. The first generic `WorkAnchorStateStore` port is now in place for
project, initiative, work item, anchor target, and state-transition
tests; it preserves provenance metadata, expected-version advancement,
scope consistency, lifecycle evidence for domain transition validation,
and reference isolation so command tests do not depend on Cockroach
directly. The durable Cockroach adapter now implements that same port and
is exposed through the durable state adapter composition, with an
additive V4 migration for transition metadata on existing databases.
The command outcome port now accepts application-level work-anchor
effects and commits them through the same atomic outcome boundary as
idempotency, audit, and outbox effects in both the in-memory and
Cockroach adapters. `send_supervisor_signal` now accepts a generic
work-anchor reader through the command pipeline execution context, so
durable runtime paths can reject missing or wrong-scope work anchors
before emitting supervisor-signal effects. The first concrete
work-anchor command, `create_work_item`, now creates a work item in
`created` state by returning work-anchor, audit, and outbox effects
through that same command outcome boundary. When the runtime supplies a
work-anchor reader, it rejects missing projects or wrong-scope
initiatives before emitting effects, preserving the graph/retrieval
principle that consequential work stays anchored. The remaining gap is
concrete project, initiative, anchor, and transition command handlers.

### Scheduled Agent Time

`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`,
`ANTI_STALL_PRIORITY_RUNTIME.md`, and
`PHASED_DEVELOPMENT_PLAN.md` now treat agent time, reviewer time,
meeting time, verification windows for QA Reviewer hats, worktrees,
credentials, runtime sessions, and prompt-flow blocks as schedulable
resources. A meeting request, review request, verification request,
implementation task, reflection block, or free-time block must become a
schedule block or allocation hold before it consumes agent/runtime
capacity. If work does not finish inside the block, the agent records a
pause checkpoint and resumes in the next allotted block or the work is
reassigned by the appropriate manager.

The schedule/RMO plan now treats inbox access as schedulable attention,
not ambient chat. Agents need personal, hat, team, department, work-item,
and prioritized inbox views, but those views are governed by active hat,
work anchor, priority, SLA, and interruptibility policy. Schedule blocks
also need expected activity profiles so automation can observe whether
the agent is actually doing the intended work, issue recovery guidance on
drift, and escalate repeated inefficiency through the management chain.

### Gated Work Ownership

Work item transitions are commands with hat authority, not field edits.
Implementers submit assigned work for review, reviewers approve or
request rework, QA Reviewer hats verify reproducibility and sign off
done, and manager/TPM/director/security/product hats handle the
transitions they own. Work items must show implementer, reviewer, QA
Reviewer, architect, manager, TPM, product/BA, security, director,
watchers, comments, mentions, evidence, and traceability so agents
understand the hierarchy and coordination state without side channels.

### Cluster Substrate Position

`AI_CLUSTER_SCAFFOLD_CONTEXT.md`, `CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`,
`TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`, and `V0_EXECUTABLE_CONTRACT.md`
correctly place Agentic Organization as a TypeScript consumer workload
on `full-ai-cluster`, not a parallel substrate.

### Implementation Direction

The current packages prove the right spine:

- command handler registry;
- idempotency check and atomic command-outcome persistence port;
- supervisor signal handler;
- audit/outbox envelope;
- NATS subject and publisher/consumer adapters;
- inbox dedupe, orphan-receipt recovery, and reaction plans;
- worker host and app composition shell;
- app-local Cockroach pooled-client adapter, SQLSTATE retry handling,
  ambiguous-commit preservation, and JSON worker telemetry sink;
- outbox claim fencing with claim IDs, stale-claim evidence, and an
  additive Cockroach migration for existing databases;
- telemetry attributes and workflow visibility records;
- package-boundary governance.

## Drift To Correct

### Capability Request Language

Some older docs still describe agents as directly submitting capability
requests. Those sections must be normalized to:

```text
agent observes gap
  -> send_supervisor_signal
  -> supervisor triage
  -> optional CapabilityRequest work item
  -> department/security/architecture routing
  -> implementation/review/activation/outcome review
```

Capability request remains a valid work item type. It is not the first
communication primitive.

### State Name Divergence

Work item states are named differently across Work OS, V0 schema, UI
concepts, and implementation. Before adding more commands, create one
state reconciliation table that maps:

- conceptual Work OS state;
- V0 enum;
- UI column;
- event name;
- owner package;
- work-item-type lifecycle rule;
- allowed transitions;
- gate owner.

The reconciliation must also distinguish generic state transitions from
type-specific rules. For example, a defect can use the common work item
state machine, but it cannot skip the created/intake record, cannot move
to ready until triage evidence exists, and cannot move to in-progress
until an engineer is assigned and scheduled.

### Discussion Anchor Progress

The implementation now includes the first durable
`create_discussion_anchor` and `record_decision` command slices. V0
intentionally supports only work-item-scoped anchors and decisions because the
current event envelope and NATS outbox require `workItemId`. The anchor handler
validates the referenced work item, rejects wrong-scope work items, rejects
non-work-item anchor targets until the scope contract is widened, writes
discussion-anchor command effects through the same idempotent
`recordCommandOutcome` port as supervisor and work effects, and emits
`discussion_anchor.created` through the Cockroach-backed outbox.

The decision handler validates the referenced discussion anchor, requires that
the anchor expected a decision output, records rationale, alternatives, and
follow-up work IDs, and emits `decision.recorded` through the Cockroach-backed
outbox. Remaining follow-on work: graph-node/edge projection, conversation
threads, meetings, votes, and wider project/initiative anchors after the event
scope and policy model explicitly support those targets.

### Transaction Boundary Progress

The command pipeline now persists supervisor signal state, discussion anchors,
decision records, work-anchor effects, audit events, outbox events, and idempotency records through one
`recordCommandOutcome` port. Command handlers return typed effects
instead of writing piecemeal state. Work-anchor effects are application
contracts rather than `state` or `state-cockroach` imports, and the
pipeline can pass a generic work-anchor reader into handlers for
pre-effect validation.

The event ingestion path already used a single
`recordEventProcessingOutcome` port and now treats unfinished receipts
as recoverable rather than duplicate. Cockroach command and
event-ingestion adapters now expose transaction-batch executor seams so
the app/runtime layers remain database-generic while durable adapters
can commit outcome batches atomically.

The remaining gap is making the live substrate proofs routine in CI or a
dev cluster. The current tests prove the batch boundary and runtime
recovery behavior. The env-gated Cockroach live test proves migrations,
readiness, per-run probe table cleanup, commit, rollback, and shutdown when
`AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` plus a `pg`-compatible
driver are available. The env-gated NATS live test proves JetStream
stream/durable setup, readiness, canonical event publish, generic
ingestion-port consume, ack, invalid-envelope DLQ handling, and
shutdown when `AGENTIC_ORG_NATS_INTEGRATION_SERVERS` is available.

### Policy And Hat Authority Checkpoint

`send_supervisor_signal` now enters through a command pipeline that
requires a `CommandAuthorizationPort` before idempotency lookup, handler
dispatch, or persistence. The first policy package maps that command
authorization request to a generic `HatAuthorityPort`; active authority
allows the command, while expired, missing, revoked, scope-denied, or
tool-denied authority returns a typed `policy_denied` result.

The pipeline now records denied decisions through a generic policy
decision observation port, rejects cleanly if that observation fails, and
projects allowed policy decisions onto audit and outbox effects before
command persistence. Denied observations now have a generic durable
store/reader contract, a first Cockroach implementation, and a
canonical-hash conflict guard so contradictory duplicate evidence is not
hidden as replay. The UI/agent-readable visibility projection marks
policy denials as weak points without pretending denied commands changed
business state.

The remaining gaps are richer authority semantics and cluster-backed
integration proof: tests still need unauthorized source hats, invalid
target supervisors, and missing assignments. The system now has a
durable worker composition seam below `apps/workers`, an app-local
Cockroach pooled-client adapter, Cockroach migration bootstrapper,
Cockroach readiness probe, NATS process-client construction, process
lifecycle entrypoint contract, generic shutdown ports, and JSON
telemetry sink. It now has an env-gated Cockroach integration harness
for real migrations, readiness, transactions, rollback, and shutdown,
plus an env-gated NATS integration harness for real JetStream publish,
consume, ack, invalid-envelope DLQ handling, readiness, and shutdown. It
now also has an env-gated combined Cockroach plus NATS durable worker
proof: the test writes a real command outcome to Cockroach, runs the
process through the worker loop for two cycles, publishes the outbox to
NATS, consumes it back, records inbox and reaction-plan state, verifies
the second cycle does not duplicate durable side effects, and guards
NATS cleanup even when Cockroach setup fails. It still needs those live
proofs wired into CI/dev-cluster execution, a concrete Node/NestJS
process host around the existing entrypoint contract, and cluster OTEL
export wiring.

### Command Surface Progress

The command pipeline and command result are now generic over registered
command/result contracts and typed artifacts. `triage_supervisor_signal`
has started as a narrow V0 command: the target supervisor hat can turn a
validated supervisor signal into follow-up work through the same
work-anchor, audit, outbox, policy, and idempotency boundary. The
remaining command-surface gap is no longer the registry shape; it is the
next authority-heavy commands such as `reserve_hat`, `decide_gate`,
schedule start/complete, and richer triage actions.

### Raw Chat Tool Names

Tool inventory language still includes broad names such as
`send_message`, `open_thread`, and `open_team_chat`. These should be
defined as anchored wrappers, not raw chat authority. All communication
paths must validate or create a `discussion_anchor` before opening a
conversation.

### UAG Is Not Yet Canonical

Prompt flows correctly point toward Universal Action Grammar, but UAG v0
needs a typed registry: action names, target kinds, action modes,
reversibility, observation status, evidence requirements, and replay
semantics.

### Schedule/RMO Contract Is Not Yet Executable

The roadmap now defines the lifecycle for schedule blocks, meeting
slots, review slots, verification blocks for QA Reviewer hats, runtime
slots, worktree slots, credential slots, inbox attention windows,
allocation holds, schedule-compliance observations, and pause
checkpoints. The implementation still needs executable state machines
and commands for schedule proposal, reservation, commitment, inbox
routing, interruption, delegation, compliance variance, pause/resume, and
missed-slot escalation. Until that lands, the Organization can describe
agent work rhythm but cannot yet enforce time/resource allocation.

## Cluster Integration Gaps

### Hat-System Projection

Agentic Organization needs a `k8s-hats` package that can read Hat,
HatBinding, HatSwap, and HatPolicy CRDs, then project them into
Organization signals. The CRD subject model currently differs from
Agentic Organization NATS subjects, so a translator or dual-subject
contract is required.

### Identity Mapping

Organization events use `agentId` and `hatAssignmentId`; hat-system
bindings use SPIFFE wearer identity. V0 needs a canonical mapping from
Organization agent/session/hat assignment to SPIFFE identity.

### Hindsight Memory Attribution

Docs correctly separate Hindsight memory from Organization graph facts,
but no memory package exists yet. V0 needs a memory attribution contract
for agent ID, hat ID, project, initiative, task, prompt-flow run, and
outcome review.

### Hermes/OZ Runtime

`launch_hermes_run` is still a documented boundary, not an executable
adapter. V0 needs a narrow Hermes runtime port before real cloud/runtime
integration.

### LGTM Export

The observability helpers are useful but not fully wired to cluster
export. V0 needs concrete OTLP/log/metric adapter config, service
labels, dashboard ownership, and alertable degraded-worker signals.

## Checkpoint Priorities

1. Normalize capability-request language across docs so
   supervisor-chain communication is the only first primitive.
2. Add a V0 state reconciliation table before expanding command enums or
   UI boards.
3. Add policy/hat-authority checks before exposing command handlers to
   API, MCP, Hermes, or workers.
4. Expand `triage_supervisor_signal` beyond the V0 `open_work_item`
   path into signal status updates, escalation, security review,
   discussion scheduling, and internal-platform routing.
5. Add graph retrieval OpenSpec scenarios and implement graph projection over
   the new discussion-anchor records.
6. Decide whether the env-gated Cockroach integration proof should run
   in CI through a local service, a k3d profile, or an operator-triggered
   real-cluster job.
7. Define UAG v0 as a typed package contract before adding prompt-flow
   execution.
8. Build one substrate integration at a time, starting with hat-system
   projection because identity, authority, CRDs, NATS subjects, and
   policy meet there.
9. Continue the schedule/RMO lifecycle after the first
   `schedule_work_block` slice. V0 now persists a work-item-scoped,
   anti-overlap `scheduled` block for an assigned agent/hat and publishes
   `work_schedule_block.scheduled`, but meetings, start/complete,
   pause/resume, worktree/runtime/credential allocation, and compliance
   observation still need to land before meeting-heavy, review-heavy, or
   verification-heavy autonomous work consumes capacity.
