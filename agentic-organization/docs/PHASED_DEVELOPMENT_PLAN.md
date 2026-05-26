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
  Cockroach composition seam.

The next implementation slice is real process adapter binding below
`apps/workers`: Cockroach client pool, concrete NATS pull/publish
client construction, and a telemetry sink that can feed the
full-ai-cluster LGTM stack.

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

## Phase 0: Keep The Roadmap Current

### Goal

Make this document the canonical next-step source.

### Tasks

1. Link this plan from `agentic-organization/docs/README.md`.
2. When a phase is completed, update its status.
3. When implementation teaches us a better order, change the plan.
4. Do not preserve stale roadmap items for sentiment. Mark them done,
   split them, or delete them.

### Exit Criteria

- The docs index points here.
- The "Immediate Next PR Sequence" section reflects the next realistic
  work.

## Phase 1: Real Worker Process Adapters

### Goal

Turn the current `apps/workers` durable composition seam into a runnable
process boundary with real CockroachDB, real NATS JetStream, and a first
structured telemetry sink, while keeping reusable packages vendor-free.

### Why This Is Next

The Organization already has ports and fake-backed worker cycles. The
first real runtime risk is whether process adapter wiring preserves
transaction, outbox, inbox, and telemetry contracts against real
infrastructure.

### Code Steps

1. Add a process-local Cockroach client package or app adapter under
   `apps/workers/src/adapters` or an adapter package if reuse is clear.
2. Implement a Cockroach client that satisfies
   `CockroachSqlClient`.
3. Prove `transaction()` uses real `BEGIN`, `COMMIT`, `ROLLBACK`, and
   connection release semantics.
4. Add a migration bootstrap path that runs the existing core migration
   runner before worker cycles when enabled.
5. Add a NATS JetStream connection factory that builds the publisher and
   pull-consumer ports required by the existing adapters.
6. Add a telemetry sink that emits structured JSON logs first, with
   stable fields matching `@agentic-org/observability`.
7. Keep process env parsing typed and app-local. Packages should receive
   already-created ports.
8. Add graceful shutdown boundaries for database and NATS clients.
9. Add readiness result objects for Cockroach, NATS, and telemetry sink
   health.
10. Add a process entrypoint only after factories are contract-tested.

### Tests First

Write tests before implementation for:

- Cockroach transaction commit;
- Cockroach transaction rollback on operation failure;
- Cockroach connection release on success and failure;
- migration runner invoked before cycles when enabled;
- NATS connection factory passes publish and consumer dependencies into
  existing adapters;
- telemetry sink records runtime status without swallowing worker
  results;
- invalid adapter config fails before clients are created;
- app composition still accepts fake adapters for unit tests.

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
   - handler.
2. Refactor the existing `send_supervisor_signal` registration into the
   generic registry.
3. Normalize command outcome into:
   - status;
   - command ID;
   - idempotency status;
   - policy decision;
   - emitted events;
   - audit records;
   - domain artifacts;
   - failure reason.
4. Keep command handlers returning effects, not writing concrete state.
5. Add typed command error codes for validation, policy denial,
   idempotency conflict, persistence conflict, and transient adapter
   failure.
6. Add command metadata that can feed MCP tools, UI forms, and prompt
   flow phase definitions later.

### Tests First

Write tests for:

- registering multiple commands without changing pipeline code;
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

## Phase 3: Discussion Anchors And Work-Scoped Communication

### Goal

Implement the first durable communication graph primitive: no meaningful
discussion, meeting, one-on-one, broadcast, vote, or decision can affect
state unless anchored to work.

### Code Steps

1. Add domain records for:
   - discussion anchor;
   - discussion participant;
   - discussion mode;
   - decision record;
   - meeting request;
   - meeting state;
   - vote state.
2. Add legal anchor targets:
   - project;
   - initiative;
   - work item;
   - gate;
   - incident;
   - release;
   - policy decision;
   - memory review;
   - runtime health issue.
3. Add commands:
   - `create_discussion_anchor`;
   - `request_meeting`;
   - `record_decision`;
   - `open_vote`;
   - `cast_vote`;
   - `close_vote`.
4. Keep `send_supervisor_signal` able to create or reference a
   discussion anchor through normal command effects.
5. Add events:
   - `discussion_anchor.created`;
   - `meeting.requested`;
   - `meeting.started`;
   - `decision.recorded`;
   - `vote.opened`;
   - `vote.closed`.
6. Add first graph projection records tying discussions to work.

### Tests First

Write tests for:

- unanchored discussion rejected;
- anchor target must exist or be created through a valid command path;
- supervisor signal creates/references anchor;
- decision must include participants, evidence, and scope;
- vote mode enforces eligible hat scopes;
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

## Phase 4: Supervisor Triage Lifecycle

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

## Phase 5: Work OS V0 State Model

### Goal

Build the first real Organization-owned task and release management core.

### Code Steps

1. Reconcile work item states across docs and implementation.
2. Add domain state machines for:
   - project;
   - initiative;
   - work item;
   - gate;
   - assignment;
   - release.
3. Add Cockroach schema for those state groups.
4. Add commands:
   - `create_project`;
   - `create_initiative`;
   - `create_work_item`;
   - `transition_work_item`;
   - `add_acceptance_criteria`;
   - `open_gate`;
   - `decide_gate`;
   - `link_artifact`;
   - `create_release`;
   - `mark_release_ready`.
5. Add read models for boards and queues.
6. Emit durable events for every transition.
7. Ensure every command can carry discussion-anchor and evidence
   context.

### Tests First

Write tests for:

- legal and illegal state transitions;
- gate requirements block readiness;
- QA reproducible defect bounces work correctly;
- release cannot merge without required gates;
- initiative branch state gates merge to main;
- all transitions emit expected events;
- board projections update from events, not direct writes.

### Docs

Update:

- `WORK_AND_RELEASE_MANAGEMENT_OS.md`;
- `V0_SCHEMA_AND_COMMANDS.md`;
- `UI_AND_OBSERVABILITY_CONCEPTS.md`;
- OpenSpec work lifecycle scenarios.

### Exit Criteria

- The Organization has its own minimal Linear-like core for agents.
- Every task, gate, release, and discussion is traceable.

## Phase 6: Hat Assignment, Authority, And Schedule Core

### Goal

Make hats operational as scoped, time-bounded authority with supply,
assignment, JWT/token lifecycle, work schedules, and prompt-flow access.

### Code Steps

1. Add Organization DB state for:
   - hat definitions;
   - hat supply policy;
   - hat assignment;
   - hat token;
   - hat schedule template;
   - agent work schedule;
   - schedule blocks.
2. Add commands:
   - `reserve_hat_assignment`;
   - `issue_hat_token`;
   - `refresh_hat_token`;
   - `release_hat_assignment`;
   - `revoke_hat_assignment`;
   - `create_schedule_template`;
   - `assign_work_schedule`;
   - `start_schedule_block`;
   - `complete_schedule_block`.
3. Add authority checks for:
   - active assignment;
   - supervisor graph;
   - tool scope;
   - project/work scope;
   - token TTL;
   - schedule allowance where needed.
4. Add first hat communication briefs from hat definitions.
5. Add schedule block types:
   - prioritized work;
   - review;
   - reflection;
   - memory maintenance;
   - free time;
   - meeting;
   - prompt-flow run;
   - incident response.
6. Add events for assignment and schedule transitions.

### Tests First

Write tests for:

- hat supply reservation prevents overbooking;
- expired token denies command;
- revoked assignment denies command;
- supervisor can assign hats under their scope;
- director can assign TPM and manager hats under their department;
- schedule block emits visible start/complete events;
- free-time block can create memories/questions but must still anchor
  consequential decisions to work.

### Docs

Update:

- `CLUSTER_NATIVE_HAT_SYSTEM.md`;
- `DEPARTMENT_HAT_TOOL_INVENTORY.md`;
- `AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`;
- `V0_POLICY_AND_RUNTIME_BOUNDARIES.md`;
- OpenSpec hat assignment scenarios.

### Exit Criteria

- Commands can be authorized by real Organization hat assignments.
- The system can explain what hat an agent is wearing, what tools it has,
  who supervises it, when it expires, and what it should be doing now.

## Phase 7: Hat-System CRD Bridge

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

## Phase 8: Reaction Executor And Anti-Stall Runtime

### Goal

Move from planning reactions to executing safe Organization commands
from reaction plans.

### Code Steps

1. Define reaction executor port.
2. Add reaction lease/claim model to prevent duplicate execution.
3. Add reaction handlers for:
   - supervisor signal triage task creation;
   - stale blocker escalation;
   - review queue saturation;
   - missing evidence reminder;
   - assignment silence;
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
- Every automated action is traceable and reviewable.

## Phase 9: MCP Gateway And Agent Context

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
   - read anchored context pack;
   - submit evidence;
   - request meeting through anchor;
   - record decision through anchor.
5. Run policy checks before command execution.
6. Emit MCP call telemetry.
7. Add credential-proxy preflight hook but keep credential access
   disabled until security lifecycle is implemented.

### Tests First

Write tests for:

- missing hat context denies tool;
- expired token denies tool;
- allowed hat can send supervisor signal;
- MCP tool maps to command without bypassing command pipeline;
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

## Phase 10: Hermes Run Binding

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
   - memory scope.
5. Ensure all Hermes interactions emit traceable events.
6. Keep OpenZiti/OZ transport details behind adapter ports.
7. Add sandbox/session health observations.

### Tests First

Write tests for:

- work assignment launches run with correct hat context;
- missing assignment blocks run;
- run event maps to evidence or status update;
- failed run creates visible incident/supervisor signal;
- cancel path releases or suspends hat assignment correctly;
- context pack includes only scoped docs/memory.

### Docs

Update:

- `CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`;
- `TECHNICAL_CA_PACKAGE_ARCHITECTURE.md`;
- `OBSERVABILITY_AND_SELF_HEALING.md`;
- OpenSpec Hermes run scenarios.

### Exit Criteria

- A hat-assigned Hermes agent can receive work, run in a session, use
  MCP tools, and report evidence.

## Phase 11: Hindsight Memory Integration

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

## Phase 12: Prompt Flows And Universal Action Grammar

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

## Phase 13: Ambiguous Requirement Lifecycle

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

## Phase 14: Security And Credential Expansion Lifecycle

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

## Phase 15: Temporal Workflows

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
- scheduled QA regression;
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

## Phase 16: Dapr Actors For Hot Entity Coordination

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

## Phase 17: UI Operations Console

### Goal

Build the human and agent-visible console for seeing the Organization in
motion.

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

## Phase 18: NestJS API Host

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

## Phase 19: Full Observability And Self-Healing Loop

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

## Phase 20: Cluster Deployment On full-ai-cluster

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

## Phase 21: Department Reviews And Performance Improvement

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

## Phase 22: Internal Feature Factory

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

- internal feature follows BRD/CA/review/QA/release path when required;
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

## Phase 23: Release And Branch Management

### Goal

Implement feature-branch driven development and QA gates for every
initiative before merge to the system build branch.

### Code Steps

1. Add initiative branch state machine.
2. Add branch creation command.
3. Add CI/CD automation plan record.
4. Add QA environment readiness record.
5. Add merge readiness gate.
6. Add release verification record.
7. Add branch close/archive path.
8. Link Git provider events to Organization work items.

### Tests First

Write tests for:

- initiative cannot merge until QA signed off;
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

- Feature work is isolated, QA-approved, and traceable before it reaches
  main.

## Phase 24: Advanced Organization Intelligence

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

## Phase 25: Hardening, Scale, And Extraction

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

Build:

- app-local Cockroach client interface implementation;
- app-local NATS connection factory interface;
- telemetry sink interface and JSON sink fake;
- config validation for adapter-specific connection settings.

Do not:

- add live deployment YAML;
- add NestJS;
- add more business commands.

Done when:

- tests prove process adapter construction and failure behavior;
- reusable packages still do not import vendor clients.

### PR 2: Cockroach Integration Proof

Build:

- real Cockroach transaction adapter using the generic SQL executor;
- integration test harness gated by env;
- migration apply test;
- rollback test.

Done when:

- real transaction rollback is proven;
- migration runner is proven against Cockroach.

### PR 3: NATS Integration Proof

Build:

- real JetStream publisher construction;
- real pull consumer construction;
- local/dev integration tests gated by env;
- DLQ publish smoke test.

Done when:

- one outbox event publishes to NATS;
- one inbound NATS event is consumed, deduped, and acknowledged.

### PR 4: Generic Command Registry

Build:

- command contract registry;
- generic command outcome;
- refactor `send_supervisor_signal` into registry;
- OpenSpec command registry scenarios.

Done when:

- a second command can be added without changing pipeline internals.

### PR 5: Discussion Anchor V0

Build:

- discussion anchor schema;
- create anchor command;
- supervisor signal link to anchor;
- graph projection for work-discussion-decision.

Done when:

- unanchored consequential discussion is rejected.

### PR 6: Supervisor Triage Command

Build:

- `triage_supervisor_signal`;
- triage categories;
- work item creation from signal;
- routing by supervisor/department.

Done when:

- agents can tell their manager anything and managers can turn it into
  normal work.

### PR 7: Work Item Core

Build:

- reconciled work item state enum;
- work item schema;
- create/transition commands;
- board projection events.

Done when:

- Organization has its first real task board data model.

### PR 8: Gate Core

Build:

- gate schema;
- open/decide gate commands;
- evidence requirement checks;
- reviewer authority policy.

Done when:

- readiness, review, and QA-style approvals can block transitions.

### PR 9: Hat Assignment Core

Build:

- hat assignment state;
- supply reservation;
- token issue/refresh/revoke;
- policy authority backed by assignment state.

Done when:

- command authorization can use real Organization assignment records.

### PR 10: MCP Gateway First Tool

Build:

- MCP gateway shell;
- agent context resolver;
- `send_supervisor_signal` MCP tool;
- policy-checked command execution.

Done when:

- Hermes can call one Organization tool with hat-aware context.

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

1. Should PR 1 bind only Cockroach first, or Cockroach plus NATS plus
   telemetry in one process-adapter PR?
2. Do we want integration tests to use a local Cockroach service, a k3d
   profile, or only env-gated tests against the real cluster?
3. Should `apps/workers` get the first executable entrypoint before
   `apps/api`, or should the API host appear once process adapters exist?
4. Should discussion anchors land before supervisor triage, or should
   triage create the first anchor implicitly?
5. Should the first Work OS board be read-model-only, or should it ship
   with command actions in the UI?
6. Should the hat-system bridge consume CRDs read-only first, or should
   it create HatBinding proposals as soon as assignment core exists?
7. Which first Hermes flow should be the proof run: supervisor triage,
   implementation task, QA review, or memory reflection?
