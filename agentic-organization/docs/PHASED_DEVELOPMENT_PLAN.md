# Agentic Organization Phased Development Plan

## Purpose

This document is the working development roadmap for Agentic
Organization. It exists so the next step is always visible without
asking "what is next?"

The north star is unchanged:

- build a generic Organization OS, not a pile of bespoke request tools;
- keep supervisor-chain communication as the first coordination
  primitive;
- keep all work, discussions, meetings, decisions, evidence, runs,
  memories, and policy decisions anchored to work;
- keep every vendor-specific implementation behind a generic
  application-facing port;
- keep the runtime event-driven through durable state, outbox, NATS,
  inbox dedupe, reaction plans, workers, and telemetry;
- keep full traceability from human or agent intent through command,
  policy, state transition, event, worker reaction, run, evidence,
  review, and outcome;
- build small vertical slices that the Organization can later improve
  through its own work lifecycle.

This plan is intentionally phase-based. Each phase should normally land
as one or more narrow PRs. Do not collapse many phases into one large
change unless the contracts are inseparable.

## Current State

The current executable spine includes:

- NodeNext TypeScript workspace under `agentic-organization/`;
- package boundary governance tests;
- `@agentic-org/domain` event envelope, records, typed state, and
  supervisor-chain communication contracts;
- `@agentic-org/application` command pipeline, command registry,
  idempotency, command outcome state-store port, and first
  `send_supervisor_signal` handler;
- `@agentic-org/policy` authorization and policy-observation ports;
- `@agentic-org/state` generic state-store and outbox-source ports;
- `@agentic-org/state-cockroach` first Cockroach-backed schema,
  command state store, outbox source, event-ingestion store,
  policy-observation store, generic SQL executor seam, durable adapter
  factory, and migration runner;
- `@agentic-org/messaging` outbox publisher and canonical subject
  model;
- `@agentic-org/messaging-nats` NATS JetStream publisher/consumer
  adapter contracts with fake-driven tests;
- `@agentic-org/runtime` event-ingestion processor, inbox dedupe,
  orphan-receipt recovery, and first V0 automation rule;
- `@agentic-org/workers` package-level worker host that runs one
  bounded outbox lane and one bounded inbound-ingestion lane;
- `apps/workers` process shell that parses typed process config,
  composes worker/NATS cycles through ports, records telemetry through a
  sink, reports healthy/degraded runtime state, and has a durable
  Cockroach composition seam plus an app-local NATS connection seam;
- `apps/workers` process lifecycle contract that applies bootstrap
  steps once per process, gates runtime execution on readiness, and
  aggregates graceful shutdown results without hiding partial adapter
  failures.
- `apps/workers` process loop contract that repeatedly invokes the
  process lifecycle through injected delay, observer, and stop-signal
  ports, captures loop weak points, and always attempts shutdown.
- `apps/workers` executable-boundary entrypoint contract that subscribes
  to typed stop signals through an injected signal source, delegates wait
  policy to an injected sleeper, returns success/degraded exit intent,
  and disposes signal listeners after shutdown without using process
  globals in reusable packages.
- env-gated live substrate proofs for Cockroach, NATS, and the combined
  durable worker path that writes a command outcome to Cockroach,
  publishes the outbox through NATS, consumes it back, records durable
  inbox/reaction-plan state, emits telemetry, and shuts down generic
  process adapters.

The next implementation slice after the entrypoint contract is to
continue with the next generic command/work-anchor surfaces, then wrap
the same entrypoint with a concrete Node/NestJS host when process
globals and Kubernetes deployment concerns are ready. Keep the live
substrate checks gated by
environment until the team decides whether CI should provide Cockroach
and NATS services.

## Work Rules For Every Phase

Every implementation phase must follow these rules.

### TDD Rule

Write representative failing tests before the implementation. Tests must
prove the real contract, not just assert the implementation shape.

Minimum test set per phase:

- success path;
- policy or authority denial if the phase exposes a command/tool;
- duplicate/retry behavior if the phase writes state or publishes
  events;
- failure mode and recovery behavior;
- telemetry/visibility evidence for important outcomes;
- package-boundary or adapter-boundary test if the phase adds a new
  package or vendor implementation.

### SOLID Rule

Application code depends on generic ports and typed contracts.
Vendor-specific classes implement interfaces and stay in adapter
packages or app composition roots.

Do not let reusable packages import:

- process env;
- Kubernetes Secret or ExternalSecret details;
- CockroachDB clients;
- NATS clients;
- Temporal clients;
- Dapr clients;
- Hermes clients;
- Hindsight clients;
- OpenZiti clients;
- OPA clients;
- OpenTelemetry exporter/client implementations;
- NestJS framework types.

### Event Rule

Meaningful state changes emit durable events. Events should flow through:

```text
command or adapter observation
  -> policy check when needed
  -> transactional state/outbox write
  -> outbox publisher
  -> NATS subject
  -> inbox dedupe
  -> reaction plan
  -> worker execution
  -> telemetry and workflow visibility
```

### Documentation Rule

Any architectural or infrastructure change updates docs in the same PR.
Prefer updating existing docs before creating a new doc.

Likely doc homes:

- `PHASED_DEVELOPMENT_PLAN.md` for roadmap changes;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md` for package and runtime
  architecture;
- `V0_SCHEMA_AND_COMMANDS.md` for command/schema changes;
- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md` for authority and policy;
- `OBSERVABILITY_AND_SELF_HEALING.md` for telemetry and health;
- `WORK_AND_RELEASE_MANAGEMENT_OS.md` for lifecycle and product
  workflow;
- `AGENT_NATIVE_KNOWLEDGE_GRAPH.md` for retrieval and graph changes;
- `SUPERVISOR_CHAIN_COMMUNICATION.md` for communication semantics;
- `openspec/specs/agentic-organization/spec.md` for executable
  contract scenarios.

### Review Rule

Before closing a phase:

- run full local validation;
- run at least one architecture/SOLID review;
- run at least one correctness/TDD review;
- run at least one north-star/docs review;
- resolve blockers and rerun validation.

### Validation Baseline

At minimum, run:

```text
cd agentic-organization
npm test
npm run typecheck
cd ..
git diff --check
```

Later phases may add:

- Cockroach integration tests;
- NATS integration tests;
- worker smoke tests;
- API contract tests;
- MCP tool contract tests;
- Playwright UI tests;
- k3d/K3S cluster smoke tests;
- OpenTelemetry trace/log/metric assertions.

## AI Lifecycle Operating Model

This section defines how agents actually work inside the Organization.
The key rule is that work is not merely assigned. It is scheduled,
allocated, authorized, observed, paused, resumed, reviewed, and released.

Agent time is an Organization resource. Meetings, reviews, verification
work, coding, architecture, discovery, free time, reflection, memory
maintenance, incident response, and executive planning all compete for
scarce hat capacity and runtime capacity. QA is not a special work
mode; it is work performed by QA Reviewer hats with specific gate
authority. The Organization therefore treats time, worktrees, sessions,
credentials, prompt-flow slots, and reviewer attention as schedulable
resources.

### Lifecycle Spine

Every meaningful AI lifecycle follows this spine:

```text
work exists or signal arrives
  -> work anchor and discussion anchor are created or selected
  -> responsible hat triages the next lifecycle need
  -> required hats are identified
  -> schedule windows are proposed
  -> resource manager checks hat supply, budget, runtime, worktree,
     credential, and meeting constraints
  -> schedule blocks are reserved
  -> agents receive hat-scoped briefs and context packs
  -> work runs during allotted blocks
  -> unfinished work pauses with resumable state
  -> next schedule block resumes from the saved state
  -> required reviewer, QA Reviewer, or signoff hats are scheduled into
     work blocks
  -> gated state transition is performed only by an authorized hat
  -> outcome and weak points are recorded
```

No agent should assume that because a work item is assigned, it may
execute immediately. Execution requires an active hat assignment, an
allowed schedule block, the required context pack, and any required
runtime resources.

### Schedule Objects

The schedule model needs these records:

| Record | Purpose |
| --- | --- |
| Schedule Template | Default rhythm for a hat, department, or project. |
| Agent Work Schedule | Concrete calendar-like plan for an agent wearing a hat. |
| Schedule Block | A reserved time window for a specific work mode. |
| Allocation Hold | Temporary hold while the Organization finds a valid time/resource slot. |
| Meeting Slot | Multi-agent schedule block with participants, mode, agenda, anchor, and quorum. |
| Review Slot | Time reserved for code review, architecture review, verification review, security review, or outcome review. |
| Inbox Queue | Hat-scoped and agent-scoped queue of messages, mentions, requests, blockers, review asks, and manager signals. |
| Prioritized Inbox View | SLA/priority-ranked inbox view for the active hat, current team, current initiative, and escalation chain. |
| Runtime Slot | Container/session/pod allocation for Hermes or supporting tools. |
| Worktree Slot | Repo branch/worktree allocation tied to an initiative, task, or review. |
| Credential Slot | Time-bounded credential/tool grant needed for a scheduled block. |
| Pause Checkpoint | Resumable state when a block ends before the work completes. |

Schedule blocks must be explicit about:

- block ID;
- organization, project, initiative, work item, and discussion anchor;
- agent ID and active hat assignment;
- scheduled start and end;
- work mode;
- required context pack version;
- required runtime resources;
- required worktree or branch;
- required credential/tool grants;
- allowed inbox access policy;
- expected activity profile;
- expected outputs;
- pause/resume policy;
- reviewer or manager responsible for validating completion.

### Work Modes

The first work modes are:

| Mode | Meaning | Typical owner |
| --- | --- | --- |
| Prioritized Work | Main execution time for assigned work. | Implementer, BA, Architect, TPM, Manager |
| Review | Formal review of work, code, docs, plans, evidence, or gates. | Reviewer hats |
| Meeting | Synchronous or structured asynchronous discussion. | Inviting hat plus participants |
| Free Time | Exploration, learning, repo reading, culture building, and low-risk memory creation. | Any active hat if schedule allows |
| Reflection | Work review, self-evaluation, manager discussion, and improvement proposals. | Agent plus manager |
| Memory Maintenance | Stabilize, mark stale, or request review of memories. | Agent, Memory Curator, Manager |
| Incident Response | Runtime, pipeline, security, or production issue response. | Owning department hats |
| Prompt Flow | Deterministic phase execution with gates and reviewer checkpoints. | Hat with approved flow |
| Executive Planning | Project/standard/priority/budget decisions. | Executive and director hats |

Free time is not unbounded authority. It can produce notes, questions,
proposed memories, proposed work, or supervisor signals, but any
consequential decision still needs a work anchor and the proper command
path.

### Inboxes And Scheduled Attention

Agents need robust information access, but inboxes are still part of the
work system. Each active hat should have access to:

- personal inbox;
- active-hat inbox;
- team inbox;
- department inbox when the hat has that scope;
- work-item inbox for assigned or watched work;
- prioritized inbox view ranked by urgency, SLA, authority chain,
  blocker status, and current schedule relevance.

Agents should have dedicated inbox/review windows in their schedule, but
they are also encouraged to glance at prioritized inbox context during
other work when the block policy allows it. That does not mean random
interruption. The scheduler should decide whether an inbox item is:

- immediately interruptible;
- visible but deferred;
- routed to the next inbox window;
- delegated;
- escalated to a manager or director;
- converted into a schedule request, meeting request, blocker, or normal
  work item.

Every inbox item must be anchored to work, a policy, an incident, a
gate, or an organizational review. The inbox is not a free-floating chat
feed; it is a prioritized access layer over work the agent may need to
act on.

### Schedule Enforcement And Compliance

Schedule blocks should be enforced by intelligent automation. The goal is
not to micromanage an agent's internal reasoning; it is to ensure scarce
hat, runtime, worktree, and credential capacity is used for the block's
intended purpose.

Each block should declare:

- expected work mode;
- allowed tools and MCP actions;
- allowed inbox access level;
- required context pack;
- required artifacts or evidence;
- expected heartbeat/checkpoint cadence;
- permitted side quests;
- interruptibility policy;
- completion validator.

The runtime should observe block execution through events, traces,
tool-call telemetry, worktree activity, inbox activity, artifact writes,
prompt-flow phase progress, and checkpoint updates. If observed activity
drifts away from the scheduled block, the system should create a typed
schedule-compliance event. Examples:

- agent is scheduled for implementation but only browses unrelated
  inboxes;
- agent is scheduled for review but never opens the relevant diff,
  evidence, or acceptance criteria;
- agent is scheduled for memory maintenance but creates unrelated
  implementation work;
- agent is in a non-interruptible block but accepts lower-priority
  meeting traffic;
- agent does no observable work during an active runtime/credential
  allocation.

Compliance events should first help the agent recover: refresh context,
surface the expected task, ask whether the block should be paused, or
create a blocker signal. Repeated or severe drift escalates to the
owning manager, then director if needed. This gives agents freedom to
work intelligently while still keeping the Organization honest about
time, cost, and focus.

### Scheduling Authority

Different hats have different scheduling powers:

| Hat family | Scheduling authority |
| --- | --- |
| Executive Board | Calls executive meetings, approves succession/election routines, sets global priority windows. |
| C-suite | Schedules director planning, standards reviews, budget/capacity reviews, and cross-department escalations. |
| Director | Schedules department initiatives, manager reviews, TPM planning, and department-level priority meetings. |
| TPM | Schedules initiative planning, requirement syncs, task grooming, dependency meetings, and delivery reviews. |
| Engineering Manager | Schedules team work blocks, review rotations, reflection, memory maintenance, verification follow-up, and blocker triage. |
| Product Owner / BA | Schedules customer interviews, BRD reviews, workflow clarification, and product signoff. |
| Architect | Schedules architecture review, CA/design review, ADR review, and technical decision meetings. |
| Implementer | Requests work blocks, clarification meetings, review slots, and blocker escalation through supervisor signal. |
| Code Reviewer | Schedules or accepts code review blocks and can request rework. |
| QA Reviewer | Schedules verification work, regression blocks, reproducibility checks, and evidence-backed bounce-back. |
| Security Reviewer | Schedules security review, credential/tool-grant review, and risk acceptance. |
| Memory Curator | Schedules memory review, memory cleanup, and context-pack quality audits. |
| Platform Operator | Schedules runtime repair, deployment checks, incident work, and infrastructure maintenance. |

An agent can request time, but the owning manager/director/TPM role
allocates scarce schedule and runtime capacity according to priority,
hat supply, deadlines, and resource constraints.

### Meetings

Meetings are not chat rooms. A meeting is scheduled work.

A meeting requires:

- work anchor;
- discussion anchor;
- purpose;
- agenda;
- participant hats;
- required quorum or attendance rule;
- conversation mode;
- scheduled time window;
- expected outputs;
- decision/evidence recording rule.

Meeting modes include:

- one-on-one;
- team discussion;
- broadcast review;
- round-robin;
- pass-the-stick;
- chair-led;
- vote;
- executive decision;
- clarification interview;
- incident bridge.

Meeting scheduling lifecycle:

```text
meeting need detected
  -> authorized hat requests meeting against work/discussion anchor
  -> scheduler finds participant availability and required hat supply
  -> allocation holds reserve candidate windows
  -> required participants accept, delegate, or decline with reason
  -> meeting block is committed
  -> context packs are generated for participants
  -> agents enter meeting mode during the block
  -> decisions, action items, unresolved questions, and dissent are recorded
  -> follow-up work items or signals are created
  -> meeting block completes or reschedules
```

If a meeting is called while an agent is busy, the Organization does not
blindly interrupt. It evaluates:

- urgency;
- caller authority;
- participant necessity;
- current block interruptibility;
- work item priority;
- deadline risk;
- runtime/session cost;
- whether an asynchronous comment or decision request is sufficient.

The result is one of:

- schedule at next common available time;
- interrupt current block and checkpoint work;
- delegate to another eligible hat wearer;
- ask for asynchronous input by deadline;
- reject or escalate the meeting request.

### Reviews And Verification Work

Reviews are schedule blocks with gate authority. QA is not a schedule
mode; QA is a hat family that performs verification work and owns
specific gate transitions. A QA Reviewer may receive a prioritized work
block for verification, a review block for signoff, or a regression
work block, depending on the lifecycle need.

Review lifecycle:

```text
work submitted for review
  -> required reviewer hats are identified
  -> review slot is scheduled
  -> reviewer receives context pack and evidence
  -> reviewer approves, requests rework, escalates, or blocks
  -> state transition occurs only if reviewer hat has authority
```

Verification lifecycle for QA Reviewer hats:

```text
verification or signoff requested
  -> work/review block is scheduled for a QA Reviewer hat
  -> QA Reviewer receives build/preview/test environment context
  -> QA Reviewer runs expected test cases and exploratory checks
  -> QA Reviewer records screenshots, traces, logs, reproduction steps,
     and result
  -> if issue is still reproducible, QA Reviewer bounces work back with
     evidence
  -> if issue is not reproducible and criteria pass, QA Reviewer signs
     off
```

QA failure wording matters: the Organization does not say "QA failed"
as if QA were a mode. A QA Reviewer reports whether the issue was
sufficiently fixed or remains reproducible, with evidence.

### Work Item Participants

A work item must show role ownership explicitly. At minimum:

- requester;
- current owner;
- implementer;
- reviewer;
- QA Reviewer;
- architect;
- product owner or BA when needed;
- TPM;
- engineering manager;
- director;
- security reviewer when needed;
- release owner when needed;
- watcher/subscriber list;
- mentioned agents/hats.

Work item comments are first-class records. They need:

- author agent ID;
- active hat assignment;
- timestamp;
- work anchor;
- optional parent comment;
- mentioned agents/hats;
- requested response type;
- required response by time;
- linked artifact/evidence;
- visibility scope;
- trace ID if created by an automated flow.

Tagging another agent or hat creates an inbox item or schedule request.
It does not automatically interrupt the target. The target's manager,
schedule policy, urgency, and current block determine when it is handled.

### Gated State Transition Authority

Work item transitions are commands. They are not arbitrary field edits.
The generic state machine is only the outer rail. Each work item type
can add stricter readiness rules, required roles, required evidence, and
allowed transition paths.

The first authority matrix should be:

| Transition | Authorized hats |
| --- | --- |
| intake -> triage | TPM, Engineering Manager, Product Owner, Director |
| triage -> ready | TPM after required context/gates exist |
| ready -> in_progress | TPM or Engineering Manager after assignment/schedule allocation |
| in_progress -> review | Implementer assigned to the work |
| review -> in_progress | Code Reviewer or Architecture Reviewer requesting rework |
| review -> verification | Code Reviewer or Architecture Reviewer approving the review |
| verification -> in_progress | QA Reviewer when issue remains reproducible or acceptance criteria fail |
| verification -> done | QA Reviewer after verification/signoff |
| any -> blocked | Current owner, TPM, Engineering Manager, QA Reviewer, or Reviewer with evidence |
| blocked -> triage | TPM or Engineering Manager after blocker classification |
| blocked -> in_progress | TPM or Engineering Manager after dependency is cleared |
| any -> cancelled | QA Reviewer for invalid/reproducibility-based closure, Product Owner for business cancellation, Director for priority cancellation, Security Reviewer for unsafe work |
| done -> outcome_review | TPM, Engineering Manager, QA Reviewer, or Release Manager |
| outcome_review -> done | Engineering Manager or TPM after outcome evidence is recorded |

Every transition requires:

- active hat assignment;
- authority check;
- valid source state;
- valid target state;
- reason;
- evidence when required;
- idempotency key;
- audit event;
- outbox event;
- graph projection.

### Work Item Type Rules

Work item type matters. A defect, feature, capability expansion,
internal platform improvement, incident, and documentation task can all
use the same command pipeline, but they must not share a single loose
definition of "ready" or "done." The Organization should model
type-specific lifecycle policy as data: required gates, required role
assignments, required evidence, and allowed transitions.

Defect work should start with this minimum lifecycle:

```text
defect opened
  -> created/intake record exists with reporter, reproduction context,
     observed behavior, expected behavior, affected project/repo, and
     severity
  -> triage classifies validity, priority, owner area, and whether more
     reproduction evidence is required
  -> ready only after required triage fields, acceptance criteria, and
     assignment constraints exist
  -> engineer assignment is required before in_progress
  -> in_progress produces a fix, tests, trace links, and evidence
  -> review validates code, tests, and scope
  -> verification work is scheduled for a QA Reviewer hat
  -> done only after verification/signoff evidence is recorded
```

Defect rules:

- a defect cannot be created directly in `ready`;
- `created/intake -> ready` is illegal unless triage gates are satisfied;
- `ready -> in_progress` requires an assigned engineer/implementer and a
  schedule allocation;
- `in_progress -> review` requires fix evidence, test evidence, and
  affected artifact links;
- `review -> verification` requires reviewer approval;
- `verification -> done` requires QA Reviewer signoff evidence;
- if verification finds the issue still reproducible, the work returns
  to `in_progress` with reproduction evidence attached;
- cancellation requires an authorized reason such as invalid defect,
  duplicate, business cancellation, unsafe work, or replaced-by link.

Other work item types should get the same policy shape rather than
special-case commands. For example, an ambiguous feature requires
business discovery and architecture context before ready; a credential
or tool-expansion request requires security review before implementation;
an incident requires severity, blast-radius, mitigation, and
post-incident review evidence. The invariant is the same: the type owns
the rules, the command pipeline enforces them, and every decision emits
durable events.

### Worktrees And Runtime Allocation

Development work is organized by initiative branch and task worktree.

Allocation model:

```text
initiative branch
  -> task worktree
  -> scheduled implementer block
  -> Hermes/container/session allocation
  -> credential/tool grants
  -> checkpoint on block end
  -> reviewer block on same worktree or review snapshot
  -> verification work block for QA Reviewer hat against preview/build
     environment
  -> merge/release gate
```

Rules:

- an implementer cannot start coding without an allocated worktree or
  equivalent sandbox;
- a reviewer must know exactly which worktree/commit/artifact is being
  reviewed;
- QA Reviewer must know which build/preview environment maps to the
  worktree;
- concurrent agents on the same worktree need explicit ownership or
  file/module boundaries;
- if a schedule block ends, the agent checkpoints branch state, open
  tasks, failing tests, next actions, and confidence level;
- the next scheduled block resumes from that checkpoint instead of
  rediscovering context from scratch.

### Pause, Resume, And Missed Slots

Agents do not run forever inside one unbounded prompt.

If work is unfinished when a block ends:

1. The agent records a pause checkpoint.
2. The runtime stores current command/run IDs, worktree state, logs,
   tests, open questions, and next recommended action.
3. The work item moves to waiting-for-next-block or remains in progress
   with a next scheduled block.
4. The scheduler chooses whether to resume the same agent/hat, another
   eligible wearer, or escalate to the manager.

If an agent misses a scheduled block:

- first miss creates a manager-visible schedule variance;
- repeated misses create an anti-stall signal;
- critical misses can reassign work;
- missed meetings can request async response or delegation;
- missed review or verification blocks assigned to QA Reviewer hats can
  escalate to manager or director depending on SLA.

### Resource Management Office Function

The Organization needs an RMO-like function even if it is not called
that in product UI. Its responsibility is to manage scarce resources:

- hat supply;
- agent schedules;
- inbox queues and priority views;
- runtime sessions;
- pods/containers;
- worktrees;
- credential grants;
- review queues;
- verification environments;
- budget;
- model/API spend;
- GPU or local model capacity later.

The RMO function can be implemented as a service plus manager/director
tools. It should expose:

- availability queries;
- schedule proposal generation;
- prioritized inbox queries;
- inbox routing and defer/escalate decisions;
- allocation holds;
- conflict detection;
- schedule-compliance observation;
- priority-aware rescheduling;
- overbooking prevention;
- utilization metrics;
- cost/budget signals;
- queue-lag signals.
- focus/compliance variance signals.

This is how the Organization avoids stale moments: if one item is
waiting on a future block, the scheduler and managers route available
agents to the next best work instead of leaving them idle.

### Edge Cases

The lifecycle must handle:

- no eligible hat wearer available;
- required reviewer unavailable;
- meeting quorum cannot be reached;
- participant declines or times out;
- agent is already in a non-interruptible block;
- high-priority inbox item arrives during a lower-priority block;
- agent spends scheduled work time on deferred inbox traffic;
- worktree lock conflict;
- branch drift or merge conflict;
- credential grant expires mid-block;
- runtime container fails;
- NATS event is duplicated;
- scheduled block misses its start;
- scheduled block exceeds budget;
- scheduled block has no observable progress;
- observed activity does not match the scheduled block's expected
  activity profile;
- verification environment unavailable;
- reviewer requests rework after verification work was scheduled;
- executive priority preempts a lower-priority schedule;
- agent memory/context appears stale;
- agent changes hats between scheduling and execution;
- authority is revoked before the block starts.

Each edge case should become a typed event and, where useful, a
supervisor signal or work item.

## Phase 0: Keep The Roadmap Current

### Goal

Make this document the canonical next-step source.

### Tasks

1. Link this plan from `agentic-organization/docs/README.md`.
2. When a phase is completed, update its status.
3. When implementation teaches us a better order, change the plan.
4. Do not preserve stale roadmap items for sentiment. Mark them done,
   split them, or delete them.
5. Keep current-state docs honest. If a doc still describes a future
   adapter choice such as Drizzle, Temporal, Dapr, MCP, Hermes, or
   Hindsight as if it already exists, either reframe it as target state
   or update it to the current generic-port implementation.

### Exit Criteria

- The docs index points here.
- The "Immediate Next PR Sequence" section reflects the next realistic
  work.

## Phase 1: Real Worker Process Adapter Umbrella

### Goal

Turn the current `apps/workers` durable composition seam into a runnable
process boundary with real CockroachDB, real NATS JetStream, and a first
structured telemetry sink, while keeping reusable packages vendor-free.

This is an umbrella phase completed by the first three near-term PRs:

```text
process adapter interfaces
  -> Cockroach integration proof
  -> NATS integration proof
```

Do not hide all of that behind one giant PR. The phase is complete only
after all three pieces are proven.

### Why This Is Next

The Organization already has ports and fake-backed worker cycles. The
first real runtime risk is whether process adapter wiring preserves
transaction, outbox, inbox, and telemetry contracts against real
infrastructure.

### Code Steps

1. Add a process-local Cockroach client package or app adapter under
   `apps/workers/src/adapters` or an adapter package if reuse is clear;
   done.
2. Implement a Cockroach client that satisfies
   `CockroachSqlClient`; done.
3. Prove `transaction()` uses real `BEGIN`, `COMMIT`, `ROLLBACK`, and
   connection release semantics; done with fake-driven client tests,
   live proof remains PR 2.
4. Add a migration bootstrap path that runs the existing core migration
   runner before worker cycles when enabled; done.
5. Add a NATS JetStream connection factory that builds the publisher and
   pull-consumer ports required by the existing adapters; done with
   fake-driven client tests, live proof remains PR 3.
6. Add a telemetry sink that emits structured JSON logs first, with
   stable fields matching `@agentic-org/observability`; done.
7. Keep process env parsing typed and app-local. Packages should receive
   already-created ports; done.
8. Add graceful shutdown boundaries for database and NATS clients; done
   as a process lifecycle contract plus NATS shutdown port and a
   Cockroach pool shutdown adapter for process-provided pools that
   expose `end()`. Live pool construction remains a concrete
   outer-adapter responsibility.
9. Add readiness result objects for Cockroach, NATS, and telemetry sink
   health; Cockroach and NATS done. Telemetry readiness remains deferred
   until the sink has an external destination.
10. Add a process lifecycle entrypoint contract only after factories are
    contract-tested; done as `createWorkerProcess`.
11. Add a loop-bound executable entrypoint contract that binds signal,
    delay, observer, and exit-intent concerns through ports; done as
    `createWorkerProcessEntrypoint`. A concrete Node/NestJS process host
    remains a later adapter step.
12. Add an early full-ai-cluster contract checkpoint without deployment
    YAML:
    - required env names;
    - Secret/ExternalSecret names;
    - service account expectations;
    - Cilium egress targets;
    - readiness dependencies;
    - OTEL/LGTM destination shape.

### Tests First

Write tests before implementation for:

- Cockroach transaction commit;
- Cockroach transaction rollback on operation failure;
- Cockroach connection release on success and failure;
- migration runner invoked before cycles when enabled;
- migration failure blocks worker cycles and is reported as not-ready or
  degraded startup state;
- NATS connection factory passes publish and consumer dependencies into
  existing adapters;
- telemetry sink records runtime status without swallowing worker
  results;
- invalid adapter config fails before clients are created;
- app composition still accepts fake adapters for unit tests;
- cluster contract checkpoint contains no plaintext secrets and maps
  every required runtime value to a Secret, ExternalSecret, ConfigMap, or
  service discovery source.

### Docs

Update:

- `FIRST_IMPLEMENTATION_SLICE.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`;
- OpenSpec scenarios for process startup and adapter health.

### Exit Criteria

- Worker can run one bounded cycle with real adapter factories in a
  controlled local/dev environment.
- Unit tests prove adapter behavior without requiring a live cluster.
- Integration tests are staged or enabled when Cockroach/NATS are
  available.
- No reusable package imports concrete clients or process env.

## Phase 2: Generic Command Outcome Surface

### Goal

Make the command pipeline truly generic before adding more commands.

### Problem

The first command works, but the pipeline and result shape must be ready
for many Organization commands without becoming a switch statement or a
pile of bespoke result types.

### Code Steps

1. Define a generic command contract registry:
   - command type;
   - input schema;
   - result artifact schema;
   - emitted event types;
   - required authority/tool;
   - handler. First code slice started for command type, generic handler
     registration, explicit `policyContext`, result artifacts, emitted
     events, and policy/idempotency flow; explicit schema metadata is
     still pending, and durable business-effect categories remain
     intentionally narrow until the work-anchor kernel lands.
2. Refactor the existing `send_supervisor_signal` registration into the
   generic registry. Done for handler registration and generic pipeline
   execution.
3. Normalize command outcome into:
   - status;
   - command ID;
   - idempotency status;
   - policy decision;
   - emitted events derived from committed outbox effects;
   - audit records derived from committed audit effects;
   - domain artifacts;
   - failure reason. First code slice done with command ID, policy,
     emitted event summaries, audit event IDs, artifacts, idempotency,
     and typed error metadata.
4. Keep command handlers returning effects, not writing concrete state.
5. Generalize durable command effects beyond supervisor signals once
   the work-anchor kernel defines the next persistent business effect
   category.
6. Add typed command error codes for validation, policy denial,
   idempotency conflict, persistence conflict, and transient adapter
   failure.
7. Add command metadata that can feed MCP tools, UI forms, and prompt
   flow phase definitions later.

### Tests First

Write tests for:

- registering multiple commands without changing pipeline code;
  first executable test done;
- unknown command rejection;
- handler validation failure;
- allowed policy path;
- denied policy path;
- idempotent replay;
- idempotency conflict;
- command-specific artifacts preserved in generic outcome;
- emitted event metadata visible to outbox persistence.

### Docs

Update:

- `V0_SCHEMA_AND_COMMANDS.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `V0_EXECUTABLE_CONTRACT.md`;
- OpenSpec command scenarios.

### Exit Criteria

- Adding the next command requires registering a handler, not changing
  pipeline internals.
- Command outcomes are UI/MCP/agent-readable.
- Existing `send_supervisor_signal` behavior is unchanged.

## Phase 3: Work Anchor Kernel V0

### Goal

Create the smallest authoritative work anchor that discussion, triage,
graph retrieval, gates, runs, and UI projections can all depend on.

This phase exists because supervisor signals and discussions cannot be
truly work-anchored if the Organization has no minimal project,
initiative, work item, or anchor-target persistence yet.

### Code Steps

1. Reconcile the V0 work item states across docs and implementation,
   including how `created` maps to the current `intake` concept.
2. Add the minimal domain records for:
   - project;
   - initiative;
   - work item;
   - work anchor target;
   - work state transition.
3. Add Cockroach schema for minimal projects, initiatives, work items,
   and work anchor targets.
4. Add commands:
   - `create_project`;
   - `create_initiative`;
   - `create_work_item`;
   - `link_work_anchor`;
   - `transition_work_item`.
5. Keep the first state machine narrow:
   - created;
   - intake;
   - triage;
   - ready;
   - in_progress;
   - blocked;
   - review;
   - done.
6. Add the first type-specific lifecycle policy records for defects.
7. Emit audit and outbox events for every work state transition.
8. Add a minimal work-status query/read model for workers, agents, and
   future UI/API hosts.

### Tests First

Write tests for:

- work item state reconciliation uses one typed enum;
- legal and illegal transitions;
- defect cannot start in ready;
- defect cannot move to ready until triage fields and required evidence
  exist;
- defect cannot move from ready to in_progress until an engineer is
  assigned and scheduled;
- anchor target existence before linking;
- `send_supervisor_signal` can reference a valid work anchor;
- no orphan discussion or decision can be created without a valid anchor
  once Phase 4 consumes this kernel;
- duplicate create/transition requests replay or conflict through
  idempotency;
- work transition emits audit, outbox, and visibility records.

### Docs

Update:

- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `V0_SCHEMA_AND_COMMANDS.md`;
- `NORTH_STAR_ALIGNMENT_CHECKPOINT.md`;
- OpenSpec work-anchor scenarios.

### Exit Criteria

- Discussion and triage phases have a real work anchor to reference.
- The Organization has a minimal task/work substrate without pretending
  the full Work OS exists.

## Phase 4: Discussion Anchors And Work-Scoped Communication

### Goal

Implement the first durable communication graph primitive after the work
anchor kernel exists: no meaningful discussion, meeting, one-on-one,
broadcast, vote, or decision can affect state unless anchored to work.

Keep this phase intentionally narrow. Full meeting modes, voting, and
executive decision procedures can expand after the core anchor contract
is proven.

### Code Steps

1. Add domain records for:
   - discussion anchor;
   - discussion participant;
   - discussion mode;
   - decision record.
2. Add legal anchor targets:
   - project;
   - initiative;
   - work item;
   - policy decision;
   - runtime health issue.
3. Add commands:
   - `create_discussion_anchor`;
   - `record_decision`.
4. Keep `send_supervisor_signal` able to create or reference a
   discussion anchor through normal command effects.
5. Add events:
   - `discussion_anchor.created`;
   - `decision.recorded`.
6. Add first graph projection records tying discussions to work.
7. Stage meeting requests, meeting states, votes, and rich discussion
   modes for a later expansion after Work OS gates and hat authority are
   active.

### Tests First

Write tests for:

- unanchored discussion rejected;
- anchor target must exist or be created through a valid command path;
- supervisor signal creates/references anchor;
- decision must include participants, evidence, and scope;
- replay of a decision command is idempotent;
- graph projection includes work item, participants, decision, and
  trace ID.

### Docs

Update:

- `AGENT_NATIVE_KNOWLEDGE_GRAPH.md`;
- `SUPERVISOR_CHAIN_COMMUNICATION.md`;
- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- OpenSpec discussion scenarios.

### Exit Criteria

- Agents can ask "why did this task move?" and retrieve the anchored
  discussion, decision, evidence, and trace.
- No raw chat primitive bypasses work anchoring.

## Phase 5: Supervisor Triage Lifecycle

### Goal

Turn generic upward communication into actionable organizational work.

### Code Steps

1. Define triage categories:
   - blocker;
   - question;
   - missing context;
   - missing tool;
   - missing credential;
   - process gap;
   - memory gap;
   - quality issue;
   - security concern;
   - architecture concern;
   - work reassignment request.
2. Add `triage_supervisor_signal` command.
3. Add work item creation effects from triage.
4. Add routing rules by supervisor hat and department.
5. Add evidence requirements per triage category.
6. Add policy checks so only valid supervisor-chain hats can triage.
7. Add events:
   - `supervisor_signal.triaged`;
   - `work_item.created_from_signal`;
   - `signal.escalated`;
   - `signal.returned_for_clarification`.
8. Add reaction plans so new supervisor signals generate triage work for
   the target supervisor.

### Tests First

Write tests for:

- supervisor can triage a signal directed to them;
- non-supervisor cannot triage another hat's signal;
- blocker creates blocker work with owner and SLA;
- missing tool creates work item but not a direct tool activation;
- security concern routes to security review;
- insufficient evidence returns clarification request;
- triage emits audit, outbox, and graph projection.

### Docs

Update:

- `SUPERVISOR_CHAIN_COMMUNICATION.md`;
- `ANTI_STALL_PRIORITY_RUNTIME.md`;
- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- OpenSpec triage scenarios.

### Exit Criteria

- Agents have one clean way to tell their manager anything.
- Managers can turn signals into normal work without bespoke tools.
- The lifecycle remains generic and expandable.

## Phase 6: Thin Command And Query Host

### Goal

Expose the first usable vertical slice without waiting for the full
NestJS API, web UI, or MCP gateway.

The host should be tiny: one command path, one status/query path, one
policy context adapter, one traceable response shape. It exists so
humans and agents can drive and observe the early loop before the full
platform surface is built.

### Code Steps

1. Add a minimal app host or process-local command/query facade.
2. Expose `send_supervisor_signal` through the generic command registry.
3. Expose read-only status for:
   - command result;
   - supervisor signal;
   - anchored work item;
   - reaction plan;
   - policy denial.
4. Require idempotency input for side-effecting commands.
5. Return trace ID, command ID, event IDs, work anchor, and next
   suggested action.
6. Keep this host framework-thin. Full NestJS API remains a later phase.

### Tests First

Write tests for:

- missing idempotency input fails before command execution;
- allowed command returns traceable command result;
- policy denial returns structured reason and policy observation ID;
- query returns work/signal/reaction status from read models;
- host code calls application ports and does not import repositories;
- duplicate command input replays the stored result.

### Docs

Update:

- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `V0_EXECUTABLE_CONTRACT.md`;
- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- OpenSpec command/query host scenarios.

### Exit Criteria

- A human or agent can submit a supervisor signal and read the resulting
  status without directly calling package internals.
- The host is still a composition boundary, not a business-logic home.

## Phase 7: Graph Projection And Context Pack V0

### Goal

Make the early system agent-native by projecting work, signals,
decisions, policy observations, traces, and artifacts into retrievable
context packs before Hermes and MCP depend on them.

### Code Steps

1. Add graph node and edge projection contracts for:
   - work item;
   - supervisor signal;
   - discussion anchor;
   - decision;
   - artifact;
   - policy observation;
   - trace/run pointer.
2. Add provenance envelope:
   - source event ID;
   - source command ID;
   - source artifact ID;
   - actor/hat;
   - timestamp;
   - confidence/source type.
3. Add access envelope:
   - organization;
   - project;
   - initiative;
   - work item;
   - hat scope;
   - policy visibility.
4. Add `get_context_pack` query for a work anchor.
5. Add read-only context pack contract for later MCP/Hermes use.
6. Keep memory references optional. Hindsight-backed recall arrives in a
   later phase, but graph context must work without it.

### Tests First

Write tests for:

- event-fed graph projection creates nodes/edges idempotently;
- duplicate event replay does not duplicate graph edges;
- context pack includes work, signal, decision, policy observation, and
  trace references;
- access filtering hides out-of-scope nodes;
- provenance identifies source event and command;
- missing context pack returns a typed not-found result.

### Docs

Update:

- `AGENT_NATIVE_KNOWLEDGE_GRAPH.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- OpenSpec graph/context-pack scenarios.

### Exit Criteria

- Agents can retrieve why a work item exists, what was decided, what
  evidence exists, which policy decisions applied, and where to inspect
  traces.
- MCP and Hermes phases can depend on this context pack instead of
  inventing their own retrieval path.

## Phase 8: Hat Authority Minimum

### Goal

Make hats operational as scoped, time-bounded command authority before
building schedules, prompt-flow access, and rich rhythm management.

### Code Steps

1. Add Organization DB state for:
   - hat definitions;
   - hat supply policy;
   - hat assignment;
   - hat token.
2. Add commands:
   - `reserve_hat_assignment`;
   - `issue_hat_token`;
   - `refresh_hat_token`;
   - `release_hat_assignment`;
   - `revoke_hat_assignment`.
3. Add authority checks for:
   - active assignment;
   - supervisor graph;
   - tool scope;
   - project/work scope;
   - token TTL.
4. Add first hat communication briefs from hat definitions.
5. Add events for assignment and token transitions.

### Tests First

Write tests for:

- hat supply reservation prevents overbooking;
- expired token denies command;
- revoked assignment denies command;
- supervisor can assign hats under their scope;
- director can assign TPM and manager hats under their department;
- issued token carries scope, TTL, and hat assignment;
- command authorization uses real assignment state.

### Docs

Update:

- `CLUSTER_NATIVE_HAT_SYSTEM.md`;
- `DEPARTMENT_HAT_TOOL_INVENTORY.md`;
- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`;
- OpenSpec hat authority scenarios.

### Exit Criteria

- Commands can be authorized by real Organization hat assignments.
- The system can explain what hat an agent is wearing, what tools it has,
  who supervises it, and when authority expires.

## Phase 9: Hat Schedule And Work Rhythm Core

### Goal

Add hat-bound schedules, work rhythm, free time, reflection, and memory
maintenance after minimum authority exists.

This phase turns time into an explicit Organization resource. Agents do
not just receive work; they receive work in scheduled, resumable,
resource-checked blocks.

### Code Steps

1. Add Organization DB state for:
   - hat schedule template;
   - agent work schedule;
   - schedule block;
   - allocation hold;
   - inbox item;
   - prioritized inbox view;
   - inbox attention policy;
   - pause checkpoint;
   - runtime slot;
   - worktree slot;
   - credential slot.
2. Add commands:
   - `create_schedule_template`;
   - `assign_work_schedule`;
   - `start_schedule_block`;
   - `complete_schedule_block`.
3. Add schedule block types:
   - prioritized work;
   - review;
   - reflection;
   - memory maintenance;
   - free time;
   - meeting;
   - prompt-flow run;
   - incident response.
4. Add manager-controlled schedule assignment and review.
5. Add commands for:
   - request schedule block;
   - propose schedule window;
   - reserve allocation hold;
   - commit schedule block;
   - request meeting slot;
   - accept, decline, or delegate meeting attendance;
   - prioritize inbox;
   - acknowledge inbox item;
   - defer inbox item;
   - escalate inbox item;
   - report schedule compliance variance;
   - pause work block;
   - resume work block;
   - report missed block.
6. Add priority-aware scheduling rules that account for hat supply,
   current work mode, interruptibility, required participants, worktree
   availability, credential TTL, runtime capacity, budget, and SLA.
7. Add schedule-block compliance observation using expected activity
   profile, allowed inbox access, required artifacts, telemetry,
   heartbeat cadence, and completion validator.
8. Emit events for schedule transitions, allocation changes, inbox
   routing, compliance variance, missed blocks, pause checkpoints, and
   resumption.

### Tests First

Write tests for:

- manager can assign schedule under their scope;
- same hat cannot be double-booked for overlapping schedule blocks;
- same worktree cannot be allocated to conflicting implementation
  blocks unless ownership boundaries are explicit;
- same runtime slot cannot be double-booked;
- credential slot must exist and remain valid for blocks that require
  credentials;
- schedule block exposes the correct prioritized inbox for the active
  hat and work context;
- high-priority inbox item can interrupt only when policy allows;
- deferred inbox item is routed to the next attention window instead of
  interrupting blindly;
- idempotent retry of allocation-hold and schedule-block commit replays
  instead of double-booking resources;
- expired allocation hold cannot be committed;
- schedule block emits visible start/complete events;
- meeting request creates scheduled blocks for required participants
  instead of interrupting them blindly;
- non-interruptible block rejects or reschedules lower-priority meeting
  requests;
- review request creates a scheduled reviewer slot, not ambient work;
- verification request creates a scheduled work or review block for a QA
  Reviewer hat, not ambient work;
- unfinished work creates a pause checkpoint and resumes in the next
  allotted block;
- worktree slot is required before implementation work starts;
- credential expiration during a block creates a typed schedule/runtime
  issue;
- reflection block can create supervisor signal or memory review work;
- free-time block can create memories/questions but must still anchor
  consequential decisions to work;
- implementation block with unrelated inbox-only activity creates a
  compliance variance;
- review block with no relevant diff/evidence/context access creates a
  compliance variance;
- compliance variance first creates recovery guidance and only escalates
  after policy thresholds are met;
- stale schedule block creates anti-stall reaction input.

### Docs

Update:

- `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`;
- `DEPARTMENT_HAT_TOOL_INVENTORY.md`;
- `ANTI_STALL_PRIORITY_RUNTIME.md`;
- OpenSpec schedule scenarios.

### Exit Criteria

- The Organization can explain not only what authority an agent has, but
  what that hat is scheduled to do and how managers adjust that rhythm.
- Meetings, reviews, verification work performed by QA Reviewer hats,
  implementation, free time, reflection, and memory maintenance are all
  scheduled and resumable.
- Agents have prioritized, hat-aware inboxes with dedicated attention
  windows and policy-controlled interruption.
- Schedule blocks are actively observed for focus, progress, and
  expected behavior so managers can see and correct inefficiency without
  relying on guesswork.
- RMO-style resource checks prevent double-booked hats, unavailable
  worktrees, missing credentials, and unscheduled runtime work.

## Phase 10: Reaction Executor And Anti-Stall Runtime

### Goal

Move from planning reactions to executing safe Organization commands
from reaction plans after the Schedule/RMO core exists.

Reaction execution may create work, request schedule blocks, escalate
missed slots, and route weak points, but it must not bypass schedule,
hat, worktree, runtime, credential, or gate authority.

### Code Steps

1. Define reaction executor port.
2. Add reaction lease/claim model to prevent duplicate execution.
3. Add reaction handlers for:
   - supervisor signal triage task creation;
   - stale blocker escalation;
   - review queue saturation;
   - missing evidence reminder;
   - assignment silence;
   - missed schedule block escalation;
   - NATS DLQ incident creation;
   - policy denial weak-point review.
4. Ensure reaction handlers call normal commands.
5. Add retry and backoff rules.
6. Add dead-letter or failed-reaction state.
7. Add events and visibility records for reaction execution.

### Tests First

Write tests for:

- reaction claim prevents duplicate workers from executing the same plan;
- reaction executor emits normal command events;
- failed reaction records retryable state;
- max retry creates incident or supervisor signal;
- stale blocker escalation respects hierarchy;
- reaction that needs human/agent time creates schedule requests instead
  of ambient work;
- missed review or verification block assigned to a QA Reviewer hat
  creates an escalation or reschedule command;
- no reaction directly mutates business state.

### Docs

Update:

- `ALWAYS_ON_ORCHESTRATION_RUNTIME.md`;
- `ANTI_STALL_PRIORITY_RUNTIME.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- OpenSpec reaction execution scenarios.

### Exit Criteria

- The Organization can safely perform its first autonomous follow-up
  actions.
- Every automated action is traceable, scheduled when time is required,
  and reviewable.

## Phase 11: Hat-System CRD Bridge

### Goal

Integrate TypeScript Organization state with the existing
`full-ai-cluster/k8s/applications/hat-system` CRDs and operator model.

### Code Steps

1. Add `@agentic-org/k8s-hats` package.
2. Generate or hand-write TypeScript types for:
   - Hat;
   - HatBinding;
   - HatSwap;
   - HatPolicy.
3. Add read-only Kubernetes watcher adapter.
4. Translate HatSwap and HatBinding observations into canonical
   `agentic-org.*` events.
5. Map Organization hat assignment IDs to cluster HatBinding identity.
6. Add conflict detection when cluster state diverges from Organization
   DB desired state.
7. Add command path for approved Organization assignments to propose or
   create HatBinding resources later.
8. Keep Organization DB as business source of truth and hat-system as
   enforcement/runtime projection.

### Tests First

Write tests for:

- HatSwap event translates into canonical envelope;
- duplicate HatSwap does not create duplicate reactions;
- unknown HatBinding creates a drift observation;
- Organization assignment maps to HatBinding proposal;
- no-supervisor-cycle policy failures are visible as policy/drift
  evidence.

### Docs

Update:

- `CLUSTER_NATIVE_HAT_SYSTEM.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`;
- OpenSpec hat-system bridge scenarios.

### Exit Criteria

- TS is a first-class consumer of the cluster-native hat system.
- Cluster hat enforcement and Organization business state are connected
  but not collapsed into one layer.

## Phase 12: MCP Gateway And Agent Context

### Goal

Expose Organization capabilities to Hermes agents through MCP tools with
hat-aware context, policy checks, and traceability.

### Code Steps

1. Add `@agentic-org/mcp` package for schemas and tool definitions.
2. Add `apps/mcp-gateway` process host.
3. Resolve agent context:
   - agent ID;
   - session ID;
   - active hat assignment;
   - token state;
   - work scope;
   - memory scope;
   - allowed tools.
4. Expose first MCP tools:
   - send supervisor signal;
   - read my hat brief;
   - read my assigned work;
   - read anchored context pack from Phase 7;
   - record decision through anchor.
5. Run policy checks before command execution.
6. Emit MCP call telemetry.
7. Add credential-proxy preflight hook but keep credential access
   disabled until security lifecycle is implemented.
8. Defer `submit_evidence`, `request_meeting`, and richer meeting/vote
   tools until the evidence/artifact, gate, and meeting lifecycle
   commands exist.

### Tests First

Write tests for:

- missing hat context denies tool;
- expired token denies tool;
- allowed hat can send supervisor signal;
- MCP tool maps to command without bypassing command pipeline;
- duplicate MCP command input replays by idempotency key;
- tool response includes command result, trace ID, and next suggested
  action;
- failed policy decision creates observation.

### Docs

Update:

- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`;
- `SUPERVISOR_CHAIN_COMMUNICATION.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- OpenSpec MCP scenarios.

### Exit Criteria

- Hermes agents can use Organization tools through MCP.
- The system knows which agent and hat performed each action.

## Phase 13: Work OS Expansion And Gate Core

### Goal

Expand the minimal work anchor into the first practical
Organization-owned task, gate, release, and board model.

### Code Steps

1. Add domain state machines for:
   - gate;
   - assignment link;
   - artifact link;
   - work item comment;
   - mention/inbox item;
   - release skeleton;
   - initiative branch skeleton.
2. Add commands:
   - `add_acceptance_criteria`;
   - `open_gate`;
   - `decide_gate`;
   - `link_artifact`;
   - `add_work_item_comment`;
   - `mention_agent_or_hat`;
   - `create_release`;
   - `mark_release_ready`.
3. Add read models for:
   - work boards;
   - review queues;
   - gate queues;
   - release readiness.
4. Emit durable events for every transition.
5. Ensure every command can carry discussion-anchor and evidence
   context.
6. Add type-specific lifecycle policies for:
   - defect;
   - ambiguous feature;
   - internal platform improvement;
   - credential/tool expansion;
   - incident.
7. Add the first gated transition authority matrix:
   - implementer moves assigned work from in progress to review;
   - reviewer moves review to rework or verification;
   - QA Reviewer moves verification work to in progress when
     reproducible issues remain;
   - QA Reviewer moves verification work to done after verification;
   - cancellation requires QA Reviewer, Product Owner, Director, or Security
     authority depending on reason.
8. Work item read models must show requester, owner, implementer,
   reviewer, QA Reviewer, architect, product owner/BA, TPM, engineering
   manager, director, security reviewer, release owner, watchers, and
   mentioned agents/hats when present.
9. Comments and mentions create inbox items or schedule requests rather
   than direct interruption.
10. Keep feature-branch and verification lifecycle minimal here; the
   full release and branch management phase expands it later.

### Tests First

Write tests for:

- gate requirements block readiness;
- defect readiness requires triage, evidence, acceptance criteria, and
  owner-area classification;
- defect in-progress requires assigned engineer and schedule allocation;
- reviewer authority policy allows and denies gate decisions;
- implementer can submit in-progress work for review but cannot sign it
  off;
- reviewer can request rework or approve to verification but cannot
  mark verification done;
- QA Reviewer can bounce reproducible issues back or sign off done;
- unauthorized transition attempts are denied before state changes;
- QA Reviewer reproducibility finding bounces work correctly;
- release cannot move forward without required gates;
- initiative branch state gates merge readiness;
- comments retain author agent, active hat, mention targets, evidence,
  and visibility scope;
- mention command creates a traceable inbox item or schedule request
  instead of interrupting the mentioned agent directly;
- mention respects visibility scope and cannot leak restricted work
  context;
- duplicate mention command replays or conflicts by idempotency key;
- mentioning an agent in a non-interruptible block does not interrupt
  that block unless an authorized urgent escalation path says so;
- all transitions emit expected events;
- board projections update from events, not direct writes;
- duplicate gate decisions replay or conflict by idempotency key.

### Docs

Update:

- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `V0_SCHEMA_AND_COMMANDS.md`;
- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- OpenSpec work/gate lifecycle scenarios.

### Exit Criteria

- The Organization has its own minimal Linear-like core for agents.
- Readiness, review, and QA Reviewer signoff approvals can block
  transitions.
- Every task, gate, release, and discussion is traceable.
- Work items expose the full role hierarchy and comment/mention history
  agents need to coordinate without side channels.

## Phase 14: Hermes Run Binding

### Goal

Bind assigned work and prompt-flow phases to Hermes agent sessions in
sandboxed cluster workloads.

### Code Steps

1. Add `@agentic-org/hermes` package.
2. Define Hermes run port:
   - start run;
   - send input;
   - receive output/event;
   - cancel run;
   - summarize run;
   - attach artifact.
3. Add run state:
   - requested;
   - scheduled;
   - session_allocated;
   - running;
   - waiting;
   - evidence_submitted;
   - failed;
   - cancelled;
   - completed.
4. Build run context pack:
   - assigned work;
   - hat brief;
   - allowed MCP tools;
   - project docs;
   - acceptance criteria;
   - discussion decisions;
   - optional memory scope placeholder.
5. Ensure all Hermes interactions emit traceable events.
6. Keep OpenZiti/OZ transport details behind adapter ports.
7. Add sandbox/session health observations.
8. Do not make Hermes depend on Hindsight before Phase 15. Until then,
   Hermes context packs use graph/work/document context plus an explicit
   "memory unavailable" or "memory not yet wired" field.
9. Require a committed schedule block and RMO allocation before starting
   any Hermes run. Development work also requires an applicable worktree
   slot; privileged tool use requires a valid credential slot.

### Tests First

Write tests for:

- work assignment launches run with correct hat context;
- missing assignment blocks run;
- missing committed schedule block blocks run launch;
- missing runtime slot blocks run launch;
- development work without required worktree slot blocks run launch;
- cancelled or expired allocation hold prevents session allocation;
- run start references the RMO allocation ID and schedule block ID;
- run event maps to evidence or status update;
- failed run creates visible incident/supervisor signal;
- cancel path releases or suspends hat assignment correctly;
- context pack includes only scoped docs and graph context before memory
  is wired;
- duplicate run callbacks replay or conflict by run event ID.

### Docs

Update:

- `CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- OpenSpec Hermes run scenarios.

### Exit Criteria

- A hat-assigned Hermes agent can receive work, run in a session, use
  MCP tools, and report evidence.

## Phase 15: Hindsight Memory Integration

### Goal

Make memory hat-scoped, attributable, retrievable, and reviewable.

### Code Steps

1. Add `@agentic-org/memory` package.
2. Define memory port:
   - recall;
   - retain;
   - reflect;
   - stabilize;
   - mark outdated;
   - query memory health.
3. Add attribution envelope:
   - agent ID;
   - hat ID;
   - hat assignment ID;
   - project;
   - initiative;
   - work item;
   - run;
   - source evidence;
   - validity window.
4. Add Hindsight adapter.
5. Add memory review work item type.
6. Add schedule-driven memory maintenance.
7. Add memory weak-point observations:
   - missing context;
   - outdated memory;
   - conflicting memory;
   - low-confidence recall;
   - repeated work failure linked to memory gap.

### Tests First

Write tests for:

- memory writes include hat assignment attribution;
- recall is scoped by project/work/hat;
- outdated memory cannot silently influence context packs;
- reflection creates proposed memory changes, not unreviewed truth;
- memory review creates work item through supervisor/manager lifecycle.

### Docs

Update:

- `CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`;
- `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- OpenSpec memory scenarios.

### Exit Criteria

- Agents can grow into hats through scoped memory without confusing
  agent identity, role authority, and project context.

## Phase 16: Prompt Flows And Universal Action Grammar

### Goal

Give hats deterministic reusable work procedures while keeping them
expandable through normal Organization work.

### Code Steps

1. Add `@agentic-org/prompt-flows`.
2. Add `@agentic-org/action-grammar`.
3. Define Universal Action Grammar V0:
   - action name;
   - actor requirement;
   - target kind;
   - preconditions;
   - inputs;
   - output observation;
   - evidence requirement;
   - reversibility;
   - allowed failure modes;
   - telemetry fields.
4. Define prompt-flow phase:
   - goal;
   - allowed actions;
   - gate;
   - reviewer;
   - required evidence;
   - memory behavior.
5. Add commands:
   - create prompt flow;
   - approve prompt flow;
   - start prompt-flow run;
   - complete phase;
   - decide phase gate.
6. Add internal team lifecycle for proposing new prompt flows from
   manager/director observations.

### Tests First

Write tests for:

- phase cannot run action outside allowed UAG set;
- reviewer gate blocks next phase;
- failed phase creates evidence and follow-up work;
- prompt-flow activation requires approval;
- schedule can start approved prompt flow for a hat.

### Docs

Update:

- `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`;
- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- OpenSpec prompt-flow scenarios.

### Exit Criteria

- Hats can execute deterministic MCP-driven procedures.
- New procedures are created through the Organization lifecycle.

## Phase 17: Ambiguous Requirement Lifecycle

### Goal

Turn vague goals into scoped, reviewed, buildable work through product,
business, architecture, and engineering flow.

### Code Steps

1. Add requirement maturity records and transitions.
2. Add commands:
   - classify requirement;
   - open discovery;
   - schedule customer interview;
   - record customer answer;
   - draft BRD;
   - review BRD;
   - approve BRD;
   - request architecture;
   - draft CA/design;
   - approve CA/design;
   - decompose initiative.
3. Add document/artifact scope:
   - project;
   - initiative;
   - work item;
   - repo;
   - decision.
4. Add graph links from docs to work and decisions.
5. Add gates that prevent implementation readiness until required
   business/architecture evidence exists.

### Tests First

Write tests for:

- ambiguous feature cannot become ready without maturity;
- BRD approval requires product/business authority;
- CA approval requires architecture authority;
- implementation task inherits context from BRD/CA;
- reviewer sees required docs and decisions.

### Docs

Update:

- `AMBIGUOUS_REQUIREMENT_LIFECYCLE.md`;
- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `AGENT_NATIVE_KNOWLEDGE_GRAPH.md`;
- OpenSpec requirement lifecycle scenarios.

### Exit Criteria

- The Organization can receive an ambiguous goal and create a curated,
  evidence-backed implementation plan.

## Phase 18: Security And Credential Expansion Lifecycle

### Goal

Let agents route missing access/tool/credential/API needs through a
generic organizational lifecycle, not a hardcoded capability request
shortcut.

### Code Steps

1. Model capability/security work as work item subtypes created through
   supervisor triage.
2. Add security review gates:
   - requested scope;
   - business reason;
   - data classification;
   - least privilege;
   - credential proxy endpoint impact;
   - audit requirement;
   - revocation plan.
3. Add commands:
   - request security review;
   - approve credential proxy endpoint design;
   - activate tool grant;
   - revoke tool grant.
4. Add credential-proxy adapter port.
5. Add policy observation for every denied or approved grant.
6. Add events for security lifecycle.

### Tests First

Write tests for:

- agent cannot directly activate a new tool;
- supervisor triage creates security work;
- security approval is required before credential-proxy expansion;
- denied security review produces retrievable reason;
- activated tool grant updates future hat authority.

### Docs

Update:

- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`;
- `SUPERVISOR_CHAIN_COMMUNICATION.md`;
- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- OpenSpec security lifecycle scenarios.

### Exit Criteria

- Tool and credential expansion is generic, governed, and traceable.

## Phase 19: Temporal Workflows

### Goal

Use Temporal TS for long-running, durable organizational workflows that
need timers, retries, compensation, and human/agent gates.

### Candidate Workflows

- ambiguous requirement discovery;
- BRD and CA approval;
- initiative branch lifecycle;
- release lifecycle;
- security review;
- prompt-flow activation;
- long-running Hermes run orchestration;
- scheduled department review;
- scheduled regression verification;
- incident remediation.

### Code Steps

1. Add `@agentic-org/workflows-temporal`.
2. Define workflow contracts without importing application internals.
3. Implement activities that call Organization commands through ports.
4. Ensure Temporal workflows emit and consume canonical events.
5. Add idempotency keys per workflow step.
6. Add compensation for cancelled or failed workflows.

### Tests First

Write tests for:

- workflow step calls command port;
- retry does not duplicate state transitions;
- cancellation emits release/assignment cleanup;
- timer expiration escalates through supervisor chain;
- workflow state is visible in UI projections.

### Docs

Update:

- `ALWAYS_ON_ORCHESTRATION_RUNTIME.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- OpenSpec Temporal scenarios.

### Exit Criteria

- Temporal owns durable timers and long-running orchestration, but
  Organization commands still own business state.

## Phase 20: Dapr Actors For Hot Entity Coordination

### Goal

Use Dapr Actors for entity-local coordination where actor semantics fit,
without replacing Cockroach as source of truth.

### Candidate Actors

- work item actor;
- hat assignment actor;
- agent session actor;
- meeting actor;
- prompt-flow run actor;
- release actor.

### Code Steps

1. Add `@agentic-org/actors-dapr`.
2. Define actor interfaces.
3. Keep actor state as cache/coordination state, not the only source of
   truth.
4. Use actors for reminders, hot locks, and local sequencing.
5. Persist authoritative transitions through Organization commands.

### Tests First

Write tests for:

- actor reminder triggers command;
- actor duplicate reminder is idempotent;
- actor state rebuilds from Cockroach/read model after loss;
- actor cannot bypass policy.

### Docs

Update:

- `RUNTIME_TECH_AND_PACKAGE_STRATEGY.md`;
- `ALWAYS_ON_ORCHESTRATION_RUNTIME.md`;
- OpenSpec Dapr actor scenarios.

### Exit Criteria

- Dapr is used where it helps hot coordination, not as a second business
  database.

## Phase 21: UI Operations Console

### Goal

Build the human and agent-visible console for seeing the Organization in
motion.

This is the rich operations console phase. Earlier phases already
provide thin command/query status and graph context packs so agents and
humans are not blind while the full UI waits.

### First Surfaces

- organization map;
- project/initiative/work boards;
- supervisor signal inbox;
- discussion/decision timeline;
- hat supply and assignment board;
- run/session board;
- review center;
- release board;
- observability weak-point dashboard;
- policy-denial dashboard;
- trace/event explorer.

### Code Steps

1. Add `apps/web`.
2. Add read-model/query package if needed.
3. Build backend query endpoints or server-side data loaders.
4. Render event-driven projections, not direct write forms first.
5. Add action affordances for commands after read views are trustworthy.
6. Link every UI record to trace ID, event ID, work item, and evidence.

### Tests First

Write tests for:

- board renders state from projection records;
- decision timeline links to work anchor;
- weak-point dashboard shows policy/runtime failures;
- action button calls command endpoint with idempotency key;
- responsive layout does not hide critical status.

### Docs

Update:

- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- OpenSpec UI visibility scenarios.

### Exit Criteria

- A human can open the console and understand what the Organization is
  doing, where work is stuck, who owns it, and why decisions were made.

## Phase 22: NestJS API Host

### Goal

Expose Organization commands and queries through a clean API host while
keeping package contracts framework-free.

### Code Steps

1. Add `apps/api`.
2. Use NestJS as composition and transport layer only.
3. Create modules that bind ports to implementations.
4. Add command endpoints:
   - supervisor signals;
   - work items;
   - gates;
   - discussions;
   - assignments;
   - runs;
   - evidence.
5. Add query endpoints for UI projections.
6. Add auth context adapter.
7. Add request tracing and idempotency headers.
8. Add OpenAPI or generated client contracts if useful.

### Tests First

Write tests for:

- controller calls application command service, not repositories;
- missing idempotency key fails for side-effecting command;
- policy denial returns structured response;
- trace ID is returned;
- API does not import concrete database client outside composition.

### Docs

Update:

- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`;
- OpenSpec API scenarios.

### Exit Criteria

- API is a replaceable host over the Organization command/query
  contracts, not the place business logic lives.

## Phase 23: Full Observability And Self-Healing Loop

### Goal

Make the system so visible that humans and agents can identify weak
points, open work, fix harness bugs, and prove improvement.

### Code Steps

1. Add OpenTelemetry exporter adapter.
2. Emit traces across:
   - API/MCP request;
   - command;
   - policy;
   - state transaction;
   - outbox publish;
   - NATS consume;
   - reaction execution;
   - Hermes run;
   - evidence submission;
   - review.
3. Add structured logs with canonical fields.
4. Add metrics:
   - command latency;
   - policy denial count;
   - outbox lag;
   - inbox lag;
   - DLQ count;
   - reaction failures;
   - hat supply exhaustion;
   - review queue age;
   - task stale age;
   - run failure rate.
5. Add weak-point detector rules.
6. Route weak points through supervisor-chain signals/work items.
7. Add dashboards for humans and context packs for agents.

### Tests First

Write tests for:

- span attributes cover required fields;
- failed command includes traceable denial/failure;
- weak-point detector creates supervisor signal or work item;
- telemetry sink failure degrades runtime but preserves work result.

### Docs

Update:

- `OBSERVABILITY_AND_SELF_HEALING.md`;
- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- OpenSpec observability scenarios.

### Exit Criteria

- Agents can inspect their own harness and propose improvements through
  normal Organization work.

## Phase 24: Cluster Deployment On full-ai-cluster

### Goal

Deploy Agentic Organization as a first-class workload on the existing
full-ai-cluster substrate.

### Code Steps

1. Add `full-ai-cluster/k8s/applications/agentic-organization/`.
2. Add ArgoCD Application.
3. Add Deployment(s) for:
   - workers;
   - API;
   - web;
   - MCP gateway;
   - Temporal worker;
   - Dapr actor host.
4. Add ConfigMaps for non-secret runtime config.
5. Add ExternalSecret mappings for Cockroach, NATS, OpenZiti, Hermes,
   Hindsight, and OTEL endpoints/secrets.
6. Add CiliumNetworkPolicy least-privilege egress.
7. Add service accounts and RBAC.
8. Add readiness/liveness probes.
9. Add OTEL collector/exporter wiring to Alloy.
10. Keep deployment manifests separate from package code.

### Tests First

Write tests/checks for:

- manifests render/apply in dry-run where possible;
- required env vars are present;
- no plaintext secrets;
- network policy only allows required egress;
- readiness checks cover dependencies;
- image tags and sync waves are explicit.

### Docs

Update:

- `AI_CLUSTER_SCAFFOLD_CONTEXT.md`;
- `CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- OpenSpec cluster deployment scenarios.

### Exit Criteria

- Agentic Organization runs as a consumer workload on full-ai-cluster.
- It does not create a parallel substrate.

## Phase 25: Department Reviews And Performance Improvement

### Goal

Let managers and directors run scheduled reviews that evaluate outcomes,
memories, tooling gaps, prompt-flow gaps, quality gaps, and staffing
gaps.

### Code Steps

1. Add department review schedule.
2. Add manager review workflow.
3. Add performance review artifact.
4. Add memory and prompt-flow review hooks.
5. Add improvement work item generation.
6. Add director prioritization queue.
7. Add C-suite/executive-board reporting projection.

### Tests First

Write tests for:

- scheduled review creates manager task;
- manager review evaluates work outcomes;
- poor outcome creates proposed improvement work;
- improvement work routes through normal backlog prioritization;
- review cannot directly mutate agent memory without memory workflow.

### Docs

Update:

- `ORGANIZATION_LAYER_BUILD_PLAN.md`;
- `DEPARTMENT_HAT_TOOL_INVENTORY.md`;
- `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`;
- OpenSpec review scenarios.

### Exit Criteria

- The Organization can improve its teams, tools, memories, and workflows
  through scheduled self-review.

## Phase 26: Internal Feature Factory

### Goal

Enable the Organization to build and improve its own platform features
through the same lifecycle it uses for product work.

### Code Steps

1. Add internal platform project.
2. Add work item templates for:
   - new MCP tool;
   - new prompt flow;
   - new workflow;
   - new adapter;
   - new UI projection;
   - new observability rule;
   - new memory review rule.
3. Add internal engineering team hats.
4. Add architecture/security/release gates for internal platform changes.
5. Require CI/CD and deployment automation artifacts for internal
   features.
6. Add outcome review that measures whether the platform feature helped.

### Tests First

Write tests for:

- internal feature follows BRD/CA/review/verification/release path when
  required;
- new workflow cannot activate without approval;
- new MCP tool cannot activate without security review;
- new prompt flow cannot activate without prompt-flow approval.

### Docs

Update:

- `ORGANIZATION_LAYER_BUILD_PLAN.md`;
- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`;
- OpenSpec internal feature scenarios.

### Exit Criteria

- Agents can improve the Organization OS through governed work, not
  side-channel changes.

## Phase 27: Release And Branch Management

### Goal

Implement feature-branch driven development and QA Reviewer signoff
gates for every initiative before merge to the system build branch.

### Code Steps

1. Add initiative branch state machine.
2. Add branch creation command.
3. Add CI/CD automation plan record.
4. Add verification environment readiness record.
5. Add merge readiness gate.
6. Add release verification record.
7. Add branch close/archive path.
8. Link Git provider events to Organization work items.

### Tests First

Write tests for:

- initiative cannot merge until QA Reviewer signoff is recorded;
- missing automation plan blocks development-ready state;
- failed system build creates defect or release blocker;
- branch events update release board;
- release signoff records evidence and trace.

### Docs

Update:

- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- OpenSpec release scenarios.

### Exit Criteria

- Feature work is isolated, verification-approved, and traceable before
  it reaches main.

## Phase 28: Advanced Organization Intelligence

### Goal

Add higher-order planning, prioritization, budgeting, staffing, and
executive-board decision support once the lower layers are reliable.

### Code Steps

1. Add project and initiative scoring.
2. Add budget and capacity model.
3. Add hat scarcity forecasting.
4. Add prioritization meetings and votes.
5. Add director and C-suite dashboards.
6. Add standard-change experiments:
   - old standard;
   - new standard;
   - measured output;
   - rollback decision.
7. Add long-term initiative planning.

### Tests First

Write tests for:

- priority changes require authority;
- budget threshold emits signal;
- hat scarcity changes assignment recommendations;
- standard experiment records before/after metrics;
- executive decisions are anchored and retrievable.

### Docs

Update:

- `ORGANIZATION_RUNTIME_ARCHITECTURE.md`;
- `ORGANIZATION_LAYER_BUILD_PLAN.md`;
- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- OpenSpec prioritization scenarios.

### Exit Criteria

- The Organization can reason about capacity, priority, standards, and
  improvement using its own trace data.

## Phase 29: Hardening, Scale, And Extraction

### Goal

Prepare the modular monolith for reliable long-running cluster operation
and selective service extraction.

### Code Steps

1. Add load and soak tests.
2. Add chaos-style adapter failure tests.
3. Add replay tests from NATS/inbox/outbox history.
4. Add database migration rollback plan.
5. Add data retention policies.
6. Add backup/restore runbooks.
7. Add package API compatibility checks.
8. Extract only stable runtime hosts:
   - MCP gateway;
   - Temporal worker;
   - Dapr actor host;
   - hat projection worker;
   - memory adapter worker.
9. Keep domain/application contracts central until extraction pressure is
   proven.

### Tests First

Write tests for:

- outbox replay does not duplicate work;
- migration applies to existing data;
- adapter outage degrades and recovers;
- worker restart resumes pending work;
- extracted service honors the same contract tests as in-process
  implementation.

### Docs

Update:

- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `ALWAYS_ON_ORCHESTRATION_RUNTIME.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- OpenSpec hardening scenarios.

### Exit Criteria

- The platform can run continuously, recover from failures, and scale
  without losing traceability or policy control.

## Immediate Next PR Sequence

This is the concrete near-term queue. Work through it in order unless a
review finding changes the dependency graph.

### PR 1: Worker Process Adapter Interfaces

Status: implemented for fake-driven process contracts. The app-local
Cockroach pooled-client adapter, Cockroach migration bootstrapper,
Cockroach readiness probe, app-local NATS connection seam, concrete
`@nats-io` transport factory, JSON telemetry sink, process lifecycle
entrypoint contract, generic NATS/Cockroach shutdown ports, outbox claim
fencing, additive Cockroach claim-fence migration, and readiness
aggregate now exist.

Build:

- app-local Cockroach client interface implementation; done;
- app-local NATS connection factory interface; done;
- concrete `@nats-io/transport-node` and `@nats-io/jetstream` factory
  behind the NATS connection seam; done with fake-driven tests, no live
  server required;
- telemetry sink interface and JSON sink fake; done;
- Cockroach migration bootstrapper over the generic migration runner;
  done;
- Cockroach readiness probe over the generic SQL client; done;
- process lifecycle entrypoint contract for bootstrap-once -> readiness
  -> one runtime cycle -> graceful shutdown; done;
- config validation for adapter-specific connection settings; partially
  done for `NATS_SERVERS`, batch sizes, and Cockroach URL presence;
- early full-ai-cluster contract checkpoint for env, secrets, egress,
  readiness, and OTEL destinations; partially done in docs.

Do not:

- add live deployment YAML;
- add NestJS;
- add more business commands.

Done when:

- tests prove process adapter construction and failure behavior;
- reusable packages still do not import vendor clients;
- no plaintext secret or cluster-only assumption leaks into reusable
  packages.

The remaining hardening for PR 1 is live-environment proof, now tracked
by PR 2 and PR 3 instead of expanding the fake-driven process-contract
slice.

### PR 2: Cockroach Integration Proof

Status: implemented as an env-gated live proof harness. The normal suite
still runs fake-driven, but when
`AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` is present and a
`pg`-compatible driver is available from the root dependency graph, the
integration test exercises the live Cockroach/Postgres-compatible path
through the same app-local ports used by the worker lifecycle.

Build:

- app-local `pg`-compatible pool adapter behind
  `CockroachWorkerPool`/`CockroachWorkerShutdownPool`; done;
- real Cockroach transaction adapter using the generic SQL executor;
  done through the app-local pool adapter;
- integration test harness gated by env; done;
- migration apply test; done;
- readiness test; done;
- commit and rollback test; done;
- per-run probe table cleanup; done;
- graceful shutdown proof through the generic process shutdown port;
  done.

Done when:

- real transaction rollback is proven against a provided live
  Cockroach/Postgres-compatible URL;
- migration runner is proven against the same URL;
- integration execution is safe to skip when local/dev cluster
  dependencies are absent.

### PR 3: NATS Integration Proof

Status: implemented as an env-gated live proof harness. The normal
suite remains fake-driven, but when
`AGENTIC_ORG_NATS_INTEGRATION_SERVERS` is present, the integration test
recreates a small JetStream stream and durable consumer, then exercises
the same app-local NATS adapter used by the worker lifecycle.

Build:

- real JetStream publisher construction; done;
- real pull consumer construction; done;
- local/dev integration tests gated by env; done;
- readiness check through the durable consumer; done;
- canonical event publish and generic ingestion-port consume; done;
- ack proof through the inbound consumer; done;
- invalid-envelope consumer DLQ path proof; done;
- generic NATS shutdown port proof; done.

Done when:

- one outbox event publishes to NATS; done when a live JetStream server
  is supplied;
- one inbound NATS event is consumed, deduped, and acknowledged; the
  live proof covers consume and acknowledge. Durable event-ingestion
  dedupe remains proven by fake-driven state tests and is now exercised
  in the combined proof when both live URLs are supplied together.

### PR 3.5: Combined Durable Worker Proof

Status: implemented as an env-gated live proof harness. The normal suite
still skips this proof unless both
`AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` and
`AGENTIC_ORG_NATS_INTEGRATION_SERVERS` are present.

Build:

- apply Cockroach migrations through the app-local bootstrapper; done;
- write a real `send_supervisor_signal` command outcome through the
  generic command pipeline and Cockroach state-store factory; done;
- recreate a per-run NATS stream and durable consumer; done;
- compose the durable worker runtime from Cockroach executor, NATS
  publisher, NATS pull consumer, DLQ publisher, and telemetry sink ports;
  done;
- run the worker process through the process loop for two cycles,
  including bootstrap, readiness, runtime, loop summary, and shutdown
  evidence; done;
- prove outbox publication to NATS and durable `published_at` marking;
  done when both live substrates are supplied;
- prove NATS consumption, ack, Cockroach inbox receipt, and
  supervisor-triage reaction-plan persistence; done when both live
  substrates are supplied;
- clean up per-run Cockroach rows and NATS resources through guarded
  cleanup that still removes NATS resources if Cockroach setup fails;
  done.

Done when:

- one Organization command can cross the real durable path from command
  state to outbox, NATS, inbox, reaction plan, telemetry, readiness, and
  loop evidence without reusable packages importing vendor clients;
- local runs stay green without live services.

### PR 3.6: Worker Process Loop Wrapper

Status: implemented as a fake-driven app-local contract. It does not
construct Cockroach, NATS, NestJS, Kubernetes, or telemetry exporters.

Build:

- add `createWorkerProcessLoop` over the existing `WorkerProcess`; done;
- inject delay, observer, and stop-signal ports instead of using
  process globals directly; done;
- continue after thrown iteration failures so one bad cycle does not
  kill always-on work; done;
- stop cleanly when the stop signal is raised before the next cycle;
  done;
- avoid busy spinning when the delay port fails; done;
- preserve completed iteration results when observer recording fails;
  done;
- always attempt process shutdown and surface degraded shutdown evidence;
  done.

Done when:

- the future executable worker host can use one small loop contract for
  continuous operation;
- tests prove the loop remains observable, stoppable, and safe to
  shut down even when dependencies fail.

### PR 3.7: Worker Process Entrypoint Contract

Status: implemented as a fake-driven app-local contract. It still does
not construct Cockroach, NATS, NestJS, Kubernetes, or telemetry
exporters.

Build:

- add `createWorkerProcessEntrypoint` above `createWorkerProcessLoop`;
  done;
- subscribe to typed stop signals through an injected signal source;
  done for `SIGINT` and `SIGTERM`;
- delegate wait policy to an injected sleeper instead of using timers
  directly; done;
- map completed or stopped loop results to success exit intent and
  degraded loop results to degraded exit intent; done;
- always dispose signal subscriptions after loop shutdown; done;
- preserve received signals and the full loop result for telemetry,
  supervisor diagnosis, and future Kubernetes/NestJS wrappers; done.

Done when:

- a concrete Node or NestJS host can wrap the entrypoint without
  changing worker lifecycle, loop, or runtime packages;
- tests prove signal-driven stop, degraded exit mapping, delay failure
  evidence, and listener disposal.

### PR 4: Generic Command Registry

Build:

- command contract registry; started with generic command base plus
  handler registration, schema metadata pending;
- generic command outcome; started with artifacts, emitted event
  summaries, audit IDs, command ID, policy, idempotency, and errors;
- refactor `send_supervisor_signal` into registry; done for execution
  path while preserving compatibility fields;
- OpenSpec command registry scenarios.

Done when:

- a second command can be added without changing pipeline internals;
  satisfied by the first generic pipeline test.

### PR 5: Work Anchor Kernel V0

Build:

- reconciled work item state enum;
- minimal project/initiative/work item schema;
- create/link/transition work commands;
- work status read model;
- audit/outbox events for transitions.

Done when:

- supervisor signals and discussions have a real work anchor to
  reference.

### PR 6: Discussion Anchor V0

Build:

- discussion anchor schema;
- create anchor command;
- supervisor signal link to anchor;
- decision record command;
- graph projection for work-discussion-decision.

Done when:

- unanchored consequential discussion is rejected.

### PR 7: Supervisor Triage Command

Build:

- `triage_supervisor_signal`;
- triage categories;
- work item creation from signal;
- routing by supervisor/department.

Done when:

- agents can tell their manager anything and managers can turn it into
  normal work.

### PR 8: Thin Command/Query Host

Build:

- one command host path for `send_supervisor_signal`;
- one read/query path for signal/work/reaction status;
- idempotency input handling;
- traceable response shape.

Done when:

- a human or agent can submit and inspect the first vertical loop
  without calling package internals.

### PR 9: Graph Context Pack V0

Build:

- graph node/edge projection contract;
- provenance envelope;
- access envelope;
- `get_context_pack` query;
- context pack scenarios for work, signal, decision, policy, and trace.

Done when:

- agents can retrieve anchored context before MCP/Hermes depend on it.

### PR 10: Hat Authority Minimum

Build:

- hat definition, supply, assignment, and token state;
- reserve/issue/refresh/release/revoke commands;
- policy authority backed by assignment state;
- first hat communication brief.

Done when:

- command authorization can use real Organization assignment records.

### PR 11: Schedule/RMO Core

Build:

- schedule block, allocation hold, pause checkpoint, runtime slot,
  worktree slot, and credential slot state;
- request/propose/commit schedule block commands;
- meeting slot scheduling with accept/decline/delegate;
- pause/resume lifecycle;
- missed-block escalation events.

Done when:

- meetings, reviews, verification work performed by QA Reviewer hats,
  implementation, free time, and memory work are allocated into explicit
  time/resource blocks instead of ambient execution.

### PR 12: Reaction Executor Minimum

Build:

- reaction claim/lease model;
- executor for supervisor-signal triage work;
- retry/failure visibility;
- reaction execution events.

Done when:

- a planned supervisor-signal reaction can create normal work through a
  command and cannot execute twice.

### PR 13: Gate Core

Build:

- gate schema;
- open/decide gate commands;
- evidence requirement checks;
- reviewer authority policy.
- transition authority matrix for implementer, reviewer, QA Reviewer,
  manager, TPM, product, director, and security hats.

Done when:

- readiness, review, and QA Reviewer signoff approvals can block
  transitions.

### PR 14: MCP Gateway First Tool

Build:

- MCP gateway shell;
- agent context resolver;
- `send_supervisor_signal` MCP tool;
- `get_context_pack` read tool;
- policy-checked command execution.

Done when:

- Hermes can call one Organization tool with hat-aware context and read
  the context pack it needs to act.

### PR 15: Work OS Expansion

Build:

- richer Work OS state;
- acceptance criteria;
- artifact links;
- work item comments and mentions;
- explicit role fields for implementer, reviewer, QA Reviewer, architect,
  manager, TPM, product/BA, security, director, watchers, and release
  owner;
- board projections;
- release/branch skeleton.

Done when:

- Organization has the first practical agent-native task board model.

## Phase Completion Checklist

Use this checklist before marking any phase complete.

- TDD tests were written first or the PR explains why this was not
  applicable for docs-only work.
- All magic strings introduced by the phase are promoted to typed enums,
  constants, or schema values where appropriate.
- Vendor-specific classes implement generic interfaces.
- Reusable packages do not import app hosts or vendor clients.
- Commands are policy-checked before handler dispatch and persistence.
- Side effects use outbox/inbox/reaction patterns.
- Events carry trace, scope, actor, hat, work, and idempotency context.
- Telemetry records enough information for UI and agent self-diagnosis.
- Docs and OpenSpec were updated.
- Full validation passed.
- Subagent review found no unresolved blockers.

## Plan Review Questions

Use these questions when we talk through the plan:

1. Should the env-gated Cockroach and NATS live proofs become CI-backed
   through local services, a k3d profile, or remain operator-triggered
   against the real cluster for now?
2. Should the real long-running `apps/workers` executable host land
   before `apps/api`, or should both wrap the same lifecycle/policy
   contracts in parallel?
3. Should the combined Cockroach plus NATS durable worker proof use local
   containers, k3d, or only env-gated tests against the real cluster?
4. Should supervisor triage create discussion anchors implicitly when a
   signal has no anchor, or should it always require an explicit anchor
   created by the prior phase?
5. Should the first Work OS board be read-model-only, or should it ship
   with command actions in the UI?
6. Should the hat-system bridge consume CRDs read-only first, or should
   it create HatBinding proposals as soon as assignment core exists?
7. Which first Hermes flow should be the proof run: supervisor triage,
   implementation task, verification work, or memory reflection?
