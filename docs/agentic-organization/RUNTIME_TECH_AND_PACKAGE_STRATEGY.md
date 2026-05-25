# Runtime Technology and Package Strategy

## Purpose

This document decides how Dapr Actors, Temporal TypeScript, Dapr Workflow, NATS, Oz/Warp run orchestration, OpenZiti transport, Hermes, and existing `agentic-services` primitives should fit into the new Hermes-native Organization platform.

The Organization is new. It should not be a dev-portal rewrite and it should not be TPM with a different name.

Dev-portal and TPM are inspiration only. We should mine reusable infrastructure ideas and small primitives, then build a new Organization runtime around Hermes agents, hats, rules, projects, initiatives, tasks, durable state, and always-on orchestration.

## Guiding Decision

Use each runtime for one job:

```text
Organization DB
  source of truth for organization state

Temporal TS
  durable long-running process orchestration

Dapr Actors
  entity-local concurrency, live mailbox/stateful actor identity, reminders

Orleans
  optional cluster-resident .NET virtual actor/silo capability; do not use as the default Organization primitive unless a specific grain-based use case wins

NATS / JetStream
  event transport, inbox/outbox, live updates, fanout, integration streams

Oz / Warp Run Orchestrator
  distributed Hermes session/container execution

OpenZiti
  secure private transport/connectivity for Hermes sessions and protected service paths

Hermes Agent
  reasoning, planning, tool use, review, QA, and organizational labor

Organization MCP Gateway
  governed agent action surface

Hindsight
  long-term memory with Organization-controlled attribution
```

Do not make Temporal, Dapr, Oz/Warp, or OpenZiti the product model. They are infrastructure adapters behind Organization-owned concepts.

The cluster execution and memory assumptions are detailed in [Cluster Execution and Memory Substrate](./CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md). The scaffold-level component direction is captured in [AI Cluster Scaffold Context](./AI_CLUSTER_SCAFFOLD_CONTEXT.md). In particular, Hindsight should be treated as real Hermes memory infrastructure: the current cluster direction uses the `vectorize-io/hindsight` OCI Helm chart, Hermes points at the in-cluster Hindsight service, and Organization policy still needs to enforce hat-scoped recall/write attribution.

## Temporal TS Fit

Temporal is strongest for durable workflows that must survive process crashes, restarts, timeouts, retries, and long waits.

Use Temporal for:

- initiative lifecycle workflows;
- task lifecycle workflows;
- review gate workflows;
- QA verification workflows;
- customer interview and BRD approval workflows;
- architecture CA/ADR approval workflows;
- credential approval workflows;
- incident response workflows;
- self-healing remediation workflows;
- scheduled organizational reviews;
- escalation timers;
- long-running multi-step processes with human or agent waits.

Temporal workflows should be deterministic and thin.

Workflow code should:

- coordinate steps;
- wait for signals;
- start child workflows;
- schedule activities;
- enforce timers;
- record durable process history;
- call activities for all side effects.

Workflow code should not:

- call LLMs directly;
- call the run orchestrator directly;
- query databases directly;
- call credential proxy directly;
- run arbitrary Hermes reasoning;
- inspect non-deterministic environment state.

All side effects should live in Temporal Activities:

```text
Workflow
  -> Activity: create Organization task
  -> Activity: reserve hat
  -> Activity: launch Oz run
  -> Activity: send NATS event
  -> Activity: call Organization MCP/internal API
  -> Activity: fetch Hindsight context
```

Temporal should not replace the Organization DB. Temporal owns workflow execution history. The Organization DB owns business state.

## Dapr Actors Fit

Dapr Actors are useful for virtual actor identity and single-threaded access to entity-local state.

Use Dapr Actors for live, entity-local coordination:

- `AgentSessionActor`: one live context actor per Hermes session.
- `AgentMailboxActor`: one mailbox per Hermes agent/session.
- `HatSupplyActor`: one allocator per hat/project/department scope.
- `TeamRoomActor`: live team chat, broadcast, and turn-taking state.
- `MeetingActor`: active meeting agenda, speaker order, votes, and transcript pointer.
- `TaskActor`: hot task coordination, lock/heartbeat, and current assignment state.
- `ProjectRuntimeActor`: project-local runtime status and aggregate health.
- `IncidentActor`: live incident command state.
- `RunActor`: Oz run heartbeat, current status, and cancellation coordination.

Actor state should be treated as hot operational state or a projection. It must not become the only source of truth for authoritative Organization records.

Actor reminders can back local durable callbacks such as:

- mailbox digest;
- meeting timeout;
- stale heartbeat check;
- hat reservation expiration;
- task assignment timeout;
- incident communication cadence.

Use actor timers only for lightweight active-session behavior that can disappear on deactivation. Use actor reminders for callbacks that must survive deactivation/failover.

## Actor-Backed MCP Context

MCP tools should remain stateless at the network edge, but every tool call should be executed with actor-resolved session context.

Flow:

```text
Hermes agent
  -> Organization MCP Gateway
      -> validate hat JWT
      -> resolve AgentSessionActor(sessionId)
      -> actor returns current runtime context
      -> gateway builds ToolExecutionContext
      -> policy engine evaluates hat, scope, mode, task, and tool
      -> tool handler calls Organization domain service
      -> state/event/audit/trace persisted
      -> AgentSessionActor records tool activity
```

`AgentSessionActor` should expose:

```text
getRuntimeContext()
recordHeartbeat()
recordToolCallStarted()
recordToolCallCompleted()
setCurrentTask()
setCurrentTeam()
setCurrentMeeting()
setMode()
markRoleless()
```

Runtime context should include:

- agent ID;
- session ID;
- active hat assignment ID;
- current task ID;
- current team ID;
- current meeting ID;
- current Oz run ID;
- current project ID;
- current initiative ID;
- memory scopes;
- credential scopes;
- allowed tool scopes;
- policy version;
- last heartbeat;
- current mode.

The MCP Gateway treats request-provided IDs as lookup hints, not authority. The actor and Organization DB verify current authority before the tool executes.

For some tools, the Gateway should also query narrower actors:

```text
submit_task_evidence
  -> AgentSessionActor for current agent/hat/session context
  -> TaskActor for assignment and hot task state
  -> HatSupplyActor for active hat reservation
  -> Organization DB for authoritative task/gate state
  -> policy engine for final allow/deny
```

Actors provide ambient runtime context and serialized hot state. They do not replace Organization DB truth.

## Dapr Workflow Fit

Dapr Workflow overlaps with Temporal.

Do not use both Temporal and Dapr Workflow for the same category of process.

Default recommendation:

- use Temporal TS for durable organizational workflows;
- use Dapr Actors for virtual entity identity and hot coordination;
- skip Dapr Workflow initially.

Use Dapr Workflow only if we decide we want a simpler Dapr-only runtime and are willing to give up Temporal's mature workflow ecosystem, visibility, worker model, and replay discipline.

## Temporal and Dapr Together

The clean integration pattern:

```text
Temporal workflow
  -> Activity
      -> Organization service
          -> Dapr actor call when entity-local serialized state is needed
          -> Organization DB write
          -> NATS event
          -> Oz run request when Hermes execution is needed
```

Examples:

```text
TaskLifecycleWorkflow
  -> reserve implementer hat via HatSupplyActor
  -> create Oz run request
  -> wait for Hermes completion signal
  -> start ReviewGateWorkflow
  -> start QAVerificationWorkflow
```

```text
IncidentWorkflow
  -> create IncidentActor
  -> assign Incident Commander hat
  -> schedule communication cadence
  -> launch diagnosis Hermes run through Oz
  -> wait for mitigation evidence
  -> require postmortem and follow-up backlog items
```

Temporal owns durable sequence. Dapr Actors own hot per-entity coordination. Organization DB owns truth.

## What Dapr Actors Should Not Do

Avoid putting broad organizational intelligence in actors.

Do not use actors for:

- global rule evaluation;
- full project/initiative lifecycle truth;
- long-running cross-entity workflows;
- durable process history;
- LLM reasoning;
- credential policy decisions;
- final task/gate approval authority.

Actors should be narrow and boring: serialize a small scope, expose a clear command/query API, emit events, and persist snapshots back to Organization state when needed.

## What Temporal Should Not Do

Avoid making Temporal workflows giant agent brains.

Do not use Temporal workflows for:

- dynamic LLM reasoning loops;
- arbitrary tool selection;
- chat transcript storage;
- memory storage;
- full work item database state;
- direct UI state;
- real-time messaging fanout.

Temporal is the durable process rail. Hermes and Organization MCP tools are the agentic layer.

## Package Strategy

Create new Hermes Organization packages. Do not extend dev-portal or TPM directly.

The concrete TypeScript app stack and app/package layout are defined in [Organization Layer Build Plan](./ORGANIZATION_LAYER_BUILD_PLAN.md#typescript-application-stack). This runtime strategy owns why each infrastructure rail exists; the build plan owns how the app should be scaffolded.

Proposed packages:

```text
@hermes-org/domain
  typed entities, enums, events, commands, value objects, policy models

@hermes-org/state
  repositories, outbox, idempotency, leases, migrations, projections

@hermes-org/runtime
  scheduler, durable triggers, rules engine, reaction executor, reconcilers, workers

@hermes-org/workflows-temporal
  Temporal workflows, activities, task queues, workflow clients

@hermes-org/actors-dapr
  Dapr actor interfaces and implementations

@hermes-org/messaging
  NATS/JetStream event bus, inbox/outbox, DLQ contracts

@hermes-org/mcp
  Organization MCP gateway, tool registry, policy-checked tool handlers

@hermes-org/hermes
  Hermes session adapter, Oz launch adapter, run context builder

@hermes-org/hats
  hat graph, hat assignment, JWT issuance/refresh, hat supply policies

@hermes-org/memory
  Hindsight adapter, memory attribution, scoped recall, memory quality workflows

@hermes-org/docs-skills
  documentation context resolver, project skill ingestion, graph projection

@hermes-org/observability
  trace/log/metric helpers, health reports, SLOs, anomaly reports

@hermes-org/policy
  RBAC, OPA/Rego policy bundles, conflict policy, human override policy

@hermes-org/adapters-agentic-services
  compatibility wrappers for reused primitives from @tgcs/agentic-services
```

The `adapters-agentic-services` package should be temporary. Its job is to let us reuse proven primitives without inheriting TPM semantics.

Packages should be the reusable capability layer. NestJS apps should be orchestrators that compose those packages through dependency injection, transport adapters, lifecycle hooks, health checks, and process wiring. A package may be used by the API, worker, Temporal worker, Dapr actor host, and MCP gateway without copying business logic between them.

## Reusing Existing agentic-services

Useful primitives to pull or wrap:

- MCP tool interfaces and registry.
- Dev agent provider abstractions.
- execution environment utilities.
- message bus interface and session messaging concepts.
- retry utility and circuit breaker.
- OpenTelemetry tracing helpers.
- LLM providers and cost calculator.
- GitLab/Jira/Confluence/Jenkins/TestRail utilities.
- schema validation/generation helpers.
- prompt flow parsing concepts where useful.
- TPM persistence interface ideas for sessions, teams, tasks, and threads.
- artifact registry ideas.
- remote-control/status snapshot ideas.

Avoid carrying forward:

- `TPMAgent` as an Organization orchestrator;
- TPM prompt/persona assumptions;
- TPM task board as the source model;
- TPM team lifecycle as the Organization lifecycle;
- TPM slash-command semantics;
- dev-portal session assumptions;
- app-specific transport coupling.

Potential extraction approach:

```text
copy interface/concept
  -> rename into Organization language
  -> remove TPM/dev-portal assumptions
  -> add hats/policy/trace/correlation fields
  -> add tests around new Organization semantics
  -> deprecate adapter when native package is stable
```

## Likely Fork/Adapt Decisions

### MCP Registry

Adapt, do not fork heavily.

The current registry shape is useful, but Organization tools need:

- hat-token context;
- policy evaluation;
- trace/correlation metadata;
- idempotency key;
- audit event emission;
- project/initiative/task scope;
- tool visibility by hat and project skill.

Build `@hermes-org/mcp` as a new package and either wrap or copy the registry pattern.

### Message Bus

Adapt the interface, replace providers.

The current message bus abstraction already thinks in sessions, at-least-once delivery, ordering, correlation IDs, health, and orphan cleanup. That is useful.

But Organization messaging should standardize on NATS/JetStream first. Azure Service Bus and Redis can remain optional compatibility providers.

Build:

- `NatsOrganizationEventBus`;
- `NatsInboxBus`;
- `JetStreamOutboxPublisher`;
- `DeadLetterService`;
- `ConsumerLeaseService`.

### Event Bus

Do not use the in-process event bus as a distributed runtime.

It can inspire local module events and tests. The Organization runtime needs persisted events, outbox, NATS, idempotent consumers, and durable reactions.

### Tracing

Adapt and expand.

Existing LLM tracing helpers are a good starting point. We need broader span helpers:

- workflow span;
- actor span;
- MCP tool span;
- rule evaluation span;
- reaction execution span;
- Oz run span;
- hat assignment span;
- memory query span;
- documentation context span;
- credential proxy span.

### DevAgent Provider Interfaces

Adapt, but rename around Hermes.

Use the provider abstraction idea for Hermes execution providers:

- `HermesProvider`;
- `HermesSessionAdapter`;
- `HermesRunContext`;
- `HermesToolSurface`;
- `HermesEventStream`.

Do not expose `DevAgent` as the Organization product language.

### TPM Team/Task/Persistence

Mine for concepts only.

Useful ideas:

- team state persistence;
- member state;
- task board persistence;
- thread persistence;
- message persistence;
- remote status snapshots;
- artifact tracking.

New authoritative concepts should be Organization-native:

- `OrganizationTeam`;
- `Mission`;
- `WorkItem`;
- `Task`;
- `HatAssignment`;
- `Meeting`;
- `ReactionPlan`;
- `AgentSession`;
- `OzRunBinding`.

### Prompt Flows

Adapt carefully.

Prompt flows are useful as templates for structured agent work, but the Organization should call them:

- work protocols;
- runbooks;
- department procedures;
- project skills;
- gate workflows.

Do not let prompt flows own lifecycle state. Temporal/Organization state owns lifecycle; Hermes receives a protocol as context.

### LLM Providers and Cost

Reuse.

Provider abstraction, cost calculator, token counter, model metadata, and model refresh scheduling are useful as platform services. Add Organization scopes:

- project;
- initiative;
- hat;
- agent;
- session;
- budget policy;
- cost attribution.

## New Runtime Contracts

### Organization API Contract

All infrastructure adapters should call Organization services, not mutate state directly.

```text
Temporal Activity
Dapr Actor
NATS Consumer
Oz Callback
MCP Tool Handler
  -> Organization domain service
      -> policy check
      -> state transition
      -> event/outbox
      -> audit/trace
```

### Idempotency Contract

Every side-effecting command needs:

- command ID;
- idempotency key;
- causation ID;
- correlation ID;
- trace ID;
- actor/workflow/run identity when relevant.

Temporal retries Activities. Dapr reminders can retry. NATS redelivers. Oz callbacks can duplicate. The Organization must treat duplicates as normal.

### State Ownership Contract

```text
Organization DB
  authoritative state and audit

Temporal history
  durable workflow execution state

Dapr actor state
  entity-local hot state / projection

NATS
  transport and replay stream

Oz
  execution lifecycle for Hermes containers

Hindsight
  memory store
```

No adapter should become an unreviewed second source of truth.

## Concrete Build Plan

### Phase 1: Native Organization Core

Build without Temporal or Dapr first:

- domain models and enums;
- Organization DB schema;
- outbox;
- idempotency;
- rules engine;
- reaction plan executor;
- NATS event contracts;
- MCP gateway skeleton;
- Hermes/Oz adapter interface.

Use in-process fakes for workflow and actor boundaries.

### Phase 2: Temporal Adapter

Add Temporal for one workflow:

```text
TaskLifecycleWorkflow
  -> mark task ready
  -> reserve hat activity
  -> launch Hermes via Oz activity
  -> wait for completion signal
  -> request review activity
  -> wait for review signal
  -> request QA activity
```

All Activities call Organization services.

Also build the workflow registry and workflow capability request path:

- `WorkflowCapabilityRequest`;
- `WorkflowRegistry`;
- workflow version metadata;
- task queue ownership;
- allowed launch rules;
- deterministic workflow test contract;
- idempotent activity test contract;
- rollback/versioning plan.

Agents may propose new Temporal workflows, but workflows only become launchable after manager/director approval, architecture review, security review when needed, tests, observability, and registry activation.

### Phase 3: Dapr Actor Adapter

Add Dapr Actors for one narrow actor:

```text
HatSupplyActor(projectId, hatId)
  reserve
  release
  expireReservation
  getSupply
```

Use reminders for reservation expiry.

### Phase 4: NATS Production Messaging

Replace local event bus with:

- JetStream outbox publisher;
- durable consumers;
- DLQ workflow;
- replay policy;
- UI event stream.

### Phase 5: Hermes Runtime Integration

Implement:

- `HermesSessionAdapter`;
- `OzRunAdapter`;
- `CredentialProxyAdapter`;
- `HindsightMemoryAdapter`;
- Organization MCP tool surface.

### Phase 6: Package Extraction

Create `@hermes-org/*` packages. Copy/adapt the minimum from `@tgcs/agentic-services` with tests and new naming.

### Phase 7: Capability Expansion Runtime

Build the governed self-expansion loop:

```text
agent detects capability gap
  -> submit CapabilityRequest
  -> manager/director/security/architecture gates
  -> implementation task or initiative
  -> tests and observability
  -> registry update
  -> capability becomes available to approved hats
```

Registries to support:

- MCP tool registry;
- credential proxy endpoint registry;
- Temporal workflow registry;
- Dapr actor registry;
- durable trigger catalog;
- project skill graph;
- hat capability graph.

This is the point where the Organization can safely build new abilities for itself without letting an agent directly grant itself new power.

## Temporal vs Dapr Decision Matrix

| Need | Temporal TS | Dapr Actors | NATS | Organization DB |
|---|---:|---:|---:|---:|
| Long-running lifecycle | Best | Weak | No | State only |
| Durable timers and human waits | Best | Good for per-actor reminders | No | State only |
| Per-entity serialized commands | Possible but heavy | Best | No | Needs locks |
| Event fanout | No | No | Best | Outbox source |
| Durable truth | Workflow history only | Actor state only | No | Best |
| Agent container execution | No | No | No | Tracks only |
| LLM/Hermes reasoning | Activity can launch | Actor should not | No | No |
| UI live updates | Indirect | Indirect | Best | Query source |
| Failure/retry orchestration | Best | Good locally | Delivery retry | Idempotency |

## Recommended First Architecture

```text
NestJS Organization API
  -> CockroachDB
  -> NATS JetStream
  -> Temporal client
  -> Dapr client
  -> Oz adapter
  -> MCP gateway

Temporal workers
  -> Organization activities
  -> Oz launch activities
  -> NATS publish activities

Dapr actor service
  -> AgentSessionActor
  -> HatSupplyActor
  -> AgentMailboxActor
  -> TeamRoomActor

Hermes session containers
  -> Organization MCP gateway
  -> Credential proxy
  -> Hindsight adapter
  -> NATS inbox/events
```

Start with Temporal for durable process and Dapr Actors for one narrow hot-state allocator. Expand only after the boundaries are proven.

## Open Questions

- Should Temporal be mandatory from M1, or introduced after native state/rules are proven?
- Is Dapr already acceptable in the local k3s baseline, or should actors wait until after Oz/Hermes are running?
- Do we want one actor service for all actor types or separate services by domain?
- Should NATS remain the only external event stream even when Dapr pub/sub is available?
- Which existing `agentic-services` primitives should be copied versus wrapped as a dependency during early development?
- Do we rename all `DevAgent` concepts immediately, or maintain a compatibility adapter until Hermes-native interfaces settle?
