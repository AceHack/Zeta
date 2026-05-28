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

### Discussion Anchor Gap

The docs say V0 work should include discussion anchors and graph nodes.
The current implementation only writes the supervisor signal, audit
event, outbox event, idempotency record, inbox receipts, and reaction
plans. The next V0 command slice must either implement discussion-anchor
creation or explicitly stage it as the next command after
`send_supervisor_signal`.

### Transaction Boundary Progress

The command pipeline now persists supervisor signal state, audit events,
outbox events, and idempotency records through one
`recordCommandOutcome` port. Command handlers return typed effects
instead of writing piecemeal state.

The event ingestion path already used a single
`recordEventProcessingOutcome` port and now treats unfinished receipts
as recoverable rather than duplicate. Cockroach command and
event-ingestion adapters now expose transaction-batch executor seams so
the app/runtime layers remain database-generic while durable adapters
can commit outcome batches atomically.

The remaining gap is integration-level proof against a real CockroachDB
transaction. The current tests prove the batch boundary and runtime
recovery behavior; a future local/dev-cluster integration test should
prove actual rollback behavior with the real adapter binding.

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
telemetry sink. It still needs a real Cockroach-backed integration run,
real NATS integration run, a long-running executable worker host, and
cluster OTEL export wiring.

### Command Surface Closure

The command pipeline and command result are still shaped around the
first command. Before adding `triage_supervisor_signal`,
`reserve_hat`, or `decide_gate`, make the pipeline generic over
registered command/result contracts or return a generic command outcome
with typed artifacts and events.

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
4. Add `triage_supervisor_signal` as the next real command slice.
5. Add discussion-anchor enforcement and graph retrieval OpenSpec
   scenarios, then implement the minimal anchor command.
6. Add real CockroachDB transaction integration coverage for command
   outcomes and event-ingestion outcomes once a dev connection is
   available.
7. Define UAG v0 as a typed package contract before adding prompt-flow
   execution.
8. Build one substrate integration at a time, starting with hat-system
   projection because identity, authority, CRDs, NATS subjects, and
   policy meet there.
9. Implement the schedule/RMO lifecycle before real meeting-heavy,
   review-heavy, or verification-heavy autonomous work so agents
   consume time, worktrees, credentials, and runtime capacity through
   explicit allocation rather than ambient availability.
