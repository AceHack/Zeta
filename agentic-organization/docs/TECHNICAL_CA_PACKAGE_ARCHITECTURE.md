---
title: Technical CA: Package-First Agentic Organization Architecture
canonical_name: Agentic Organization
status: design
---

# Technical CA: Package-First Agentic Organization Architecture

## Status

Proposal for review.

The first implementation slice starts as a NodeNext TypeScript package
island under `agentic-organization/packages`. NestJS remains the planned
composition host, but the first executable contracts intentionally run
without a Nest process so command, event, state, telemetry, and runtime
automation rules can be tested before adapters are introduced.

## Purpose

This CA proposes the first implementation architecture for Agentic
Organization as a TypeScript/NestJS modular monolith made of reusable
packages. The Organization OS composes those packages into runnable
processes, but the packages own the actual capability contracts.

The goal is to build a generic, extensible, event-driven Organization
runtime where every meaningful action is traceable, replay-aware,
policy-checked, and safe to move from in-process execution to a separate
service later.

## Architecture Decision

Build Agentic Organization as one product with many packages and a small
set of runtime hosts:

```text
apps/api
apps/web
apps/workers
apps/temporal-worker
apps/dapr-actors
apps/mcp-gateway

packages/*
```

Packages are the real service boundaries. NestJS apps are composition
hosts. They wire dependency injection, transports, lifecycle hooks,
health checks, process concerns, and adapters.

The Organization owns:

- business model;
- commands;
- state transitions;
- policies;
- audit;
- trace contracts;
- event contracts;
- package boundaries.

The cluster provides:

- CockroachDB as the first durable SQL adapter for authoritative
  Organization state;
- NATS JetStream for event transport, fanout, inboxes, replay, and DLQ;
- Temporal TS for durable long-running workflows;
- Dapr Actors for hot entity-local coordination;
- Hermes for agent reasoning and tool use;
- Hindsight for memory;
- hat-system CRDs for cluster hat enforcement and projection;
- Cilium, SPIRE, Vault, Trust Manager, and External Secrets for network,
  identity, trust, and secret delivery;
- ArgoCD for physical GitOps reconciliation.

None of those cluster runtimes should become a parallel business model.

## Core Shape

```text
Runtime host
  API controller / worker / MCP handler / Temporal activity / Dapr actor
    -> application command service
      -> command handler registry
      -> policy check
      -> domain state transition
      -> durable state transaction through the state adapter
        -> authoritative state
        -> audit event
        -> outbox event
        -> idempotency record
      -> NATS publish through outbox worker
      -> OpenTelemetry spans and logs
```

The same command service should be callable from every runtime host. No
adapter should mutate authoritative tables directly.

## Dependency Direction

Dependencies point inward.

```text
apps/*
  -> @agentic-org/nest-composition
    -> @agentic-org/application
      -> @agentic-org/domain
      -> ports/interfaces
    -> adapter packages
      -> external runtimes
```

Rules:

- `@agentic-org/domain` depends on no infrastructure package.
- Domain packages do not import NestJS, Temporal, Dapr, NATS,
  Hindsight, Hermes, Kubernetes, OpenZiti, Drizzle, or OpenTelemetry.
- Application packages depend on domain and ports.
- Adapter packages implement ports and may depend on runtime clients.
- Runtime hosts depend on packages; packages do not depend on runtime
  hosts.
- Cross-package imports use public exports only.
- No controller, worker entrypoint, Temporal workflow, Dapr actor, or MCP
  route contains business rules.
- Production source and test source are separated. Package
  implementation code lives in `packages/<name>/src`; package tests live
  in `packages/<name>/test`. Governance checks should reject `*.test.ts`
  files inside production source trees.

## Package Layers

### Layer 0: Domain Kernel

| Package                  | Owns                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `@agentic-org/domain`    | entity IDs, value objects, typed enums, state machines, domain events, command names, event names, aggregate contracts |
| `@agentic-org/contracts` | shared DTOs, public schemas, versioned API/event contracts, generated clients when needed                              |

The domain kernel should be small and strict. It defines language and
legal transitions. It does not execute side effects.

### Layer 1: Application and Policy

| Package                      | Owns                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@agentic-org/application`   | command handlers, handler registry, use cases, transaction orchestration, ports, command result contracts                   |
| `@agentic-org/policy`        | RBAC, hat authority checks, OPA/Rego adapter boundary, policy decisions, denial reasons, observation store and reader ports |
| `@agentic-org/observability` | correlation envelope, OpenTelemetry helpers, workflow visibility, required span attributes, trace propagation               |

The application layer is the Organization OS command layer. It is where
the runtime asks the Organization to do something.

### Layer 2: Capability Packages

| Package                        | Owns                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `@agentic-org/work-os`         | projects, initiatives, work items, dependencies, blockers, assignments, releases, work signals |
| `@agentic-org/requirements`    | ambiguous requirement intake, clarification, BRD lifecycle, maturity state                     |
| `@agentic-org/documents`       | BRDs, CAs, ADRs, design docs, reports, document scope, document approval state                 |
| `@agentic-org/gates`           | readiness, code, QA, security, architecture, memory, release, and outcome gates                |
| `@agentic-org/hats`            | hat graph, supply, assignment, JWT issuance/refresh/revocation, succession, cooldown, warmup   |
| `@agentic-org/assignments`     | staffing, agent-to-hat fit, work assignment, reassignment, capacity checks                     |
| `@agentic-org/prompt-flows`    | deterministic prompt-flow definitions, phases, phase gates, reusable procedures                |
| `@agentic-org/action-grammar`  | universal action grammar, reversibility, observation contracts, action-mode classification     |
| `@agentic-org/knowledge-graph` | graph nodes, edges, context packs, retrieval envelopes, provenance and access envelopes        |
| `@agentic-org/runtime`         | triggers, rules, reaction plans, leases, schedulers, reconcilers, self-healing loops           |
| `@agentic-org/ui-projections`  | read models for boards, timelines, run views, evidence, reviews, observability, org map        |

Capability packages should be independently testable. They can expose
interfaces and services, but they should not know which process is
calling them.

### Layer 3: State, Messaging, and Runtime Adapters

| Package                                  | Owns                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@agentic-org/state`                     | generic state-store, outbox-source, inbox, idempotency, transaction, and lease ports                                      |
| `@agentic-org/state-cockroach`           | first replaceable durable SQL implementation of state-store, outbox-source, event-ingestion, and policy-observation ports |
| `@agentic-org/messaging`                 | NATS envelope builder, subject builder, JetStream publisher, consumer, DLQ, replay contracts                              |
| `@agentic-org/messaging-nats`            | NATS JetStream implementation of publisher and consumer ports, canonical JSON, headers, ack/nack, and DLQ                 |
| `@agentic-org/workers`                   | small worker process boundary that composes outbox publishing, inbound ingestion, and schedulers through ports            |
| `@agentic-org/workflows-temporal`        | Temporal workflow and activity contracts, task queues, workflow clients                                                   |
| `@agentic-org/actors-dapr`               | Dapr actor interfaces, actor implementations, reminders, actor state projection                                           |
| `@agentic-org/mcp`                       | MCP schemas, tool registry, preflight checks, policy-checked tool handlers                                                |
| `@agentic-org/hermes`                    | Hermes session adapter, run adapter, callback contract, run context builder                                               |
| `@agentic-org/memory`                    | Hindsight adapter, hat-scoped recall/retain/reflect, memory attribution, memory health                                    |
| `@agentic-org/k8s-hats`                  | generated or checked Hat, HatBinding, HatSwap, HatPolicy types, informers, projection decoding                            |
| `@agentic-org/openziti`                  | OpenZiti transport adapter, identity/config access, connectivity checks                                                   |
| `@agentic-org/credential-proxy`          | credential request adapter, scoped credential use, audit hooks                                                            |
| `@agentic-org/adapters-agentic-services` | temporary wrappers around reused `agentic-services` primitives                                                            |

Adapters are replaceable. The Organization should be able to run a V0
slice with in-process fakes, then swap in Temporal, Dapr, Hermes,
Hindsight, Kubernetes, and NATS adapters behind the same ports.

### Layer 4: Runtime Hosts

| Runtime host           | Responsibility                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `apps/api`             | REST/OpenAPI, internal APIs, command dispatch, read queries, auth guards           |
| `apps/web`             | human operations console, boards, timelines, org map, observability, review center |
| `apps/workers`         | outbox publisher, schedulers, NATS consumers, reconcilers, projection builders     |
| `apps/temporal-worker` | Temporal workers and activities that call Organization commands                    |
| `apps/dapr-actors`     | Dapr actor host for hot state and reminders                                        |
| `apps/mcp-gateway`     | MCP gateway, agent context resolution, preflight checks, tool execution            |

Runtime hosts are allowed to be deployed separately. They are not
separate business services yet.

## NestJS Composition

NestJS should compose packages into modules:

```text
OrganizationModule
  IdentityModule
  PolicyModule
  WorkOsModule
  RequirementsModule
  DocumentsModule
  GatesModule
  HatsModule
  AssignmentsModule
  PromptFlowModule
  ActionGrammarModule
  KnowledgeGraphModule
  RuntimeModule
  MessagingModule
  McpGatewayModule
  HermesModule
  MemoryModule
  K8sHatsModule
  ObservabilityModule
  UiProjectionModule
```

Module providers should bind ports to implementations:

```text
HatAssignmentRepository -> DrizzleHatAssignmentRepository
EventPublisher -> OutboxEventPublisher
HermesRunPort -> HermesRunAdapter or FakeHermesRunAdapter
MemoryPort -> HindsightMemoryAdapter or FakeMemoryAdapter
HatSystemPort -> KubernetesHatSystemAdapter or ReadOnlyFakeHatSystemAdapter
```

Business services should depend on ports, not concrete adapters.
Every vendor-specific implementation must sit behind a generic
Organization interface exported by a non-vendor package. For example,
application code sees `CommandStateStore`, runtime code sees
`EventIngestionStore`, messaging code sees `EventPublisher`, and command
code sees `CommandAuthorizationPort`; it must not see CockroachDB,
NATS, OpenZiti, Hindsight, Hermes, Temporal, Dapr, Kubernetes, OPA, or
provider-specific clients directly. Vendor packages may define private
executor seams for their own composition, but those seams are not
application contracts.

The command pipeline must also depend on a handler registry and a
state-store factory supplied by the composition layer. It must also
receive a command authorization port before any API, MCP, Hermes,
worker, Temporal, or Dapr entrypoint can execute Organization commands.
It must not instantiate the in-memory store or branch on every command
type. New commands should register a handler; new persistence backends
should implement the same store-factory port.

The command pipeline is now generic over Organization command contracts.
The shared command base owns only the policy/idempotency/trace fields:
command ID, command type, request hash, idempotency key, actor,
organization/project scope, correlation, causation, trace ID, and an
optional generic `policyContext`. Command-specific payload stays with
the handler. Supervisor-chain details, work-item scope, and tool scope
are policy context, not pipeline payload assumptions. A second
registered command type can execute through the same pipeline without
adding a pipeline switch, which keeps future work-anchor, discussion,
schedule, meeting, review, and Hermes-run commands open for extension.

Policy remains a generic Organization package. The first implementation
maps a `CommandAuthorizationRequest` to a `HatAuthorityPort` decision:
active hat authority allows the command, while expired, missing,
revoked, scope-denied, or tool-denied authority rejects the command with
a typed policy decision before idempotency lookup, handler dispatch, or
state persistence. Denied decisions are sent to a generic
`PolicyDecisionObservationPort`; allowed decisions are projected onto
audit and outbox effects before command outcome persistence. OPA
bundles, Kubernetes hat CRD watches, JWT validation, Organization DB
assignment lookups, credential-proxy checks, and durable policy
observation stores are adapter implementations behind that policy
boundary. The first durable observation implementation is the Cockroach
adapter, but the command pipeline still depends only on the generic
`PolicyDecisionObservationPort`.

State-store ports are async at the application boundary. In-memory
adapters may resolve immediately, but durable SQL, transactional outbox,
inbox, and lease adapters must be able to perform real I/O without
changing command-handler contracts. CockroachDB is the first durable SQL
adapter in the cluster, not an application-layer dependency.

Command handlers must return typed effects, not write state directly.
The command pipeline owns idempotency lookup and calls one command
outcome port that records the business state, audit events, outbox
events, and idempotency record together. In V0, concrete business
effects are supervisor signals and work-anchor effects. Work-anchor
effects are application-level structural contracts for projects,
initiatives, work items, anchor targets, and work-item transitions; they
do not import `state` or `state-cockroach`. This keeps the application
layer closed to concrete database transactions while still giving durable
adapters one atomic commit boundary for a command result.
When a command needs to validate existing work before emitting effects,
the pipeline passes a generic work-anchor reader through the execution
context. The first use is `send_supervisor_signal`: with a reader
configured, it rejects missing or wrong-scope related work items before
it creates supervisor-signal, audit, or outbox effects. The next use is
`create_work_item`: with a reader configured, it validates the referenced
project and optional initiative scope before creating work-item, audit,
and outbox effects. Without a reader, pure unit/bootstrap use stays
possible for handlers that are not yet bound to the durable work-anchor
substrate.
Durable command adapters should reserve the idempotency record before
effect rows inside that transaction so an idempotency race aborts before
supervisor signal, work-anchor, audit, or outbox state becomes visible.
The command outcome port returns generic committed, replayed, or
idempotency-conflict results. A vendor adapter may use SQL constraints,
transaction callbacks, CTEs, or other local mechanics to detect races,
but application code only receives the generic outcome.

Command outcomes are also generic enough for UI, MCP, and agents to
consume without knowing every command-specific record. The common result
surface carries status, command ID, idempotency state, policy evidence,
artifact summaries, committed emitted-event summaries, committed audit
event IDs, and typed failure information. The pipeline derives committed
event/audit metadata from the effects it sends to the outcome port, so
the result cannot describe different effects than the command attempted
to persist. Compatibility fields such as `supervisorSignal` can remain
while the first V0 screens and tests migrate, but new commands should
expose their durable effects through the artifact and event metadata
first.

The first worker boundary follows the same rule. `@agentic-org/workers`
does not create NATS clients, Cockroach clients, Nest modules, Temporal
workers, or Dapr actors. It receives an outbox publisher, an inbound
event source, and an event-ingestion processor through ports, runs one
bounded cycle, and returns an idle/worked/degraded summary. A failure in
one lane is captured as typed cycle data while the other lane still gets
a chance to run. `apps/workers` will later bind those ports to real
cluster adapters and attach process concerns such as health checks,
metrics, structured logs, readiness, and graceful shutdown.

`apps/workers` now exists as the first NodeNext runtime-host contract
shell. It does not introduce NestJS yet, and it is not the final
long-running executable worker host. It composes the package-level
worker host and the NATS consumer adapter, parses typed process
environment values into runtime config, records telemetry through a sink
port, and reports healthy/degraded status. Its durable composition seam
receives a generic Cockroach SQL executor, creates the Cockroach-backed
command state, outbox, event-ingestion, and policy-observation adapter
set, and wires the outbox/event-ingestion/reaction-plan work-queue
ports into the worker host. Reaction-plan execution is still port-first:
the worker lane receives a generic action executor instead of knowing
about supervisor-triage, assignment, or review-gate implementation
details directly.
Its current required environment contract is `AGENTIC_ORG_ENV`,
`AGENTIC_ORG_ID`, `COCKROACH_DATABASE_URL`, `NATS_SERVERS`,
`NATS_STREAM`, `NATS_DURABLE`, `NATS_INBOUND_BATCH_SIZE`,
`WORKER_INBOUND_BATCH_SIZE`, `WORKER_OUTBOX_BATCH_SIZE`,
`WORKER_REACTION_PLAN_BATCH_SIZE`, and
`WORKER_REACTION_PLAN_LEASE_MS`. The first
app-local process adapters now cover the Cockroach worker client, NATS
worker connection seam, and JSON telemetry sink:

- `apps/workers/src/adapters/cockroach-worker-client.ts` adapts a
  process-provided pool/client to `CockroachSqlClient`, including
  explicit `BEGIN`, `COMMIT`, `ROLLBACK`, connection release,
  SQLSTATE-based retry, ambiguous-commit preservation semantics, and a
  generic shutdown adapter for process pools that expose `end()`;
- `apps/workers/src/adapters/pg-cockroach-worker-pool.ts` is the first
  optional live-driver binding for the Cockroach worker pool contract.
  It dynamically loads a `pg`-compatible module at the app boundary,
  validates that it exports `Pool`, and adapts `Pool.connect()`,
  `client.query()`, `client.release()`, and `Pool.end()` to
  `CockroachWorkerPool` plus `CockroachWorkerShutdownPool`. This keeps
  the driver out of reusable packages while giving the worker app a real
  Cockroach/Postgres-compatible path for integration proof;
- `apps/workers/src/adapters/nats-worker-connection.ts` adapts a
  process-provided NATS transport connection factory to generic
  `EventPublisher`, `NatsJetStreamPullConsumer`,
  `NatsDeadLetterPublisher`, readiness, and shutdown ports. The
  transport factory receives the validated server list, stream, durable
  consumer, environment, and organization scope so it does not need
  out-of-band process config. Dead-letter subjects use the shared
  Organization subject builder and remain environment/organization
  scoped. Distinct dead-letter message IDs are supplied by an injected
  factory so poison messages do not collapse behind one transport dedupe
  key. The reusable messaging packages still see only the generic
  JetStream contracts, not a concrete NATS client library;
- `apps/workers/src/adapters/nats-js-transport-connection.ts` is the
  first concrete NATS client-library binding behind the transport
  factory seam. It uses `@nats-io/transport-node` for the process
  connection and `@nats-io/jetstream` for publishing, durable
  pull-consumer fetch, consumer readiness, and shutdown. The adapter is
  fake-tested through a library facade, so reusable packages still do
  not import vendor clients and live JetStream behavior remains a later
  integration proof;
- `apps/workers/src/adapters/json-worker-telemetry-sink.ts` implements
  `WorkerRuntimeTelemetrySink` with stable structured JSON records that
  preserve the worker/NATS attribute contract.
- `apps/workers/src/adapters/cockroach-migration-bootstrapper.ts` wraps
  the generic Cockroach migration runner as a process bootstrapper,
  applying the ordered core migrations before the worker runtime is
  allowed to start.
- `apps/workers/src/adapters/cockroach-readiness.ts` provides a
  Cockroach readiness probe over the generic SQL client. It keeps the
  dependency check app-local and driver-free for reusable packages.

The first process lifecycle entrypoint contract now exists in
`apps/workers/src/worker-process.ts`. It applies bootstrappers once per
process, checks typed dependency readiness before runtime execution,
skips runtime execution when bootstrap or readiness fails, runs one
runtime cycle when dependencies are ready, and aggregates shutdown
across adapter ports. It is a lifecycle contract, not a complete
long-running executable host. Future loops, Kubernetes probes, and
process supervisors can wrap this contract without changing domain,
application, runtime, or worker packages.

The first continuous-run wrapper now exists in
`apps/workers/src/worker-process-loop.ts`. It receives a `WorkerProcess`,
delay port, observer port, and stop signal, then repeatedly invokes the
process lifecycle without owning infrastructure clients. The loop
captures thrown iteration failures, observer failures, delay failures,
degraded process results, and shutdown failures as typed loop evidence
while preserving completed iteration results. This gives the future
worker binary a small, testable always-on control loop without turning
the app host into business logic.

The first executable-boundary entrypoint contract now exists in
`apps/workers/src/worker-process-entrypoint.ts`. It sits above the
continuous loop and owns only executable concerns: subscribing to typed
stop signals, delegating wait policy to a sleeper port, returning
success/degraded exit intent, preserving received signal evidence, and
disposing subscriptions after shutdown. It deliberately does not call
`process.exit`, construct timers directly, or reach into Node process
globals; a future Node or NestJS host can adapt real `process.on`,
`setTimeout`, Kubernetes lifecycle hooks, and pod termination behavior
behind the same ports.

The `apps/workers` composition root receives typed config plus
already-constructed ports. This is the only place the worker process
should know which concrete adapter implementation is being used. Domain,
application, runtime, worker, and observability packages must stay free
of process environment, Kubernetes Secret, ExternalSecret, connection
pool, and client-construction details.

The `state-cockroach` package now owns a generic SQL executor adapter and
migration runner. The executor adapts a process-provided Cockroach client
interface to the narrower statement executor contracts used by command
state, outbox, event ingestion, and policy observations. This keeps the
real database client and connection pool outside package code while
still giving `apps/workers` one durable factory to compose.

The app-local Cockroach worker client is intentionally not a new durable
state abstraction. It is the outer process adapter that can later be
backed by `pg`, another PostgreSQL-compatible client, or a test pool
without changing `@agentic-org/state-cockroach` or application code.
Ambiguous transaction outcomes must stay visible to the worker host and
operators; the process adapter may attempt rollback cleanup after an
ambiguous commit, but it must preserve the original ambiguity instead of
masking it as a rollback failure.

The live Cockroach proof is env-gated rather than always-on. When
`AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` is absent, the normal
test suite skips the live check. When it is present and a
`pg`-compatible driver is available from the root dependency graph, the
test applies the Organization migrations, checks readiness through
`SELECT 1`, creates a per-run probe table, commits a probe row, rolls
back a failed probe transaction, drops the per-run table, and closes the
pool through the generic process shutdown port. This gives us real
substrate evidence without making local development or reusable package
tests depend on a cluster.

The live NATS proof follows the same rule. When
`AGENTIC_ORG_NATS_INTEGRATION_SERVERS` is absent, the normal suite skips
the live check. When it is present, the test creates a small per-run
JetStream stream plus durable consumer, binds the app-local `@nats-io`
transport factory through `connectNatsWorkerAdapters`, checks durable
readiness, publishes one canonical event, consumes it through the
generic event-ingestion port, acknowledges it, proves the
invalid-envelope consumer DLQ path, and closes the connection through
the generic NATS shutdown port. The reusable packages continue to see
only publisher, pull-consumer, dead-letter, readiness, and shutdown
interfaces.

The combined durable worker proof is also env-gated and runs only when
both live substrate variables are present. It applies Cockroach
migrations through the app bootstrapper, writes a real
`send_supervisor_signal` command outcome through the generic command
pipeline and Cockroach state-store factory, connects a per-run NATS
stream/durable consumer through the app-local NATS seam, runs the worker
process through the loop for two cycles, publishes the outbox event,
consumes it back through the NATS consumer, records the inbox receipt
and supervisor-triage reaction plan in Cockroach, claims and completes
that reaction plan through the reaction executor lane, proves the second
cycle does not duplicate durable side effects, emits worker/NATS
telemetry records through the sink port, and guards both Cockroach and
NATS cleanup when setup fails. This is the first live proof that the
durable command, outbox, NATS, inbox, reaction-plan execution,
readiness, telemetry, loop, and cleanup seams compose without letting
vendor clients leak into reusable packages.

## SOLID Rules

### Single Responsibility

Each package owns one capability family. If a package needs to know too
much about another package's internals, the boundary is wrong.

### Open/Closed

New hats, prompt flows, workflow types, MCP tools, memory strategies, and
runtime adapters should be added through registries and package exports,
not by editing central switch statements.

### Liskov Substitution

Fake adapters, local adapters, and cluster adapters must satisfy the same
ports. If V0 runs with a fake Hermes adapter, the real Hermes adapter
must be swappable without changing command handlers.

### Interface Segregation

Ports should be narrow:

- `ReserveHatPort`, not `HatEverythingService`;
- `PublishOutboxEventPort`, not `MessagingService`;
- `RecallMemoryPort`, not `MemoryPlatform`;
- `LaunchHermesRunPort`, not `RuntimeManager`.

### Dependency Inversion

Application services define what they need. Infrastructure packages
implement it. Runtime hosts bind implementations.

## Event-Driven Contract

All state transitions are event-producing commands.

The durable state adapter stores authoritative state, audit,
idempotency, and outbox. In `full-ai-cluster`, the first implementation
is CockroachDB. NATS JetStream carries event distribution, inboxes, live
UI updates, replayable integration streams, and DLQs. Logs, traces, and
metrics are evidence. They are not business truth.

### Canonical Event Envelope

All events published through NATS should use one envelope:

```ts
type AgenticEventEnvelope<TPayload> = {
  eventId: string;
  eventType: AgenticEventType;
  schemaVersion: string;
  occurredAt: string;
  source: {
    service: string;
    instanceId?: string;
    workloadSpiffeId?: string;
  };
  scope: {
    organizationId: string;
    projectId?: string;
    initiativeId?: string;
    workItemId: string;
    workItemId?: string;
    runId?: string;
  };
  actor: {
    agentId?: string;
    hatAssignmentId?: string;
    serviceId?: string;
  };
  aggregate: {
    type: string;
    id: string;
    version: number;
  };
  trace: {
    traceparent: string;
    traceId: string;
    spanId?: string;
    correlationId: string;
    causationId?: string;
    commandId?: string;
    idempotencyKey: string;
  };
  policy?: {
    policyVersion?: string;
    decisionId?: string;
  };
  replay?: {
    isReplay: boolean;
    originalEventId?: string;
    replayRequestId?: string;
  };
  payload: TPayload;
};
```

The current command-authorization slice records denied decisions through
a generic policy observation port, persists those observations through a
replaceable `PolicyDecisionObservationStore`, and attaches allowed policy
decisions to audit/outbox effects. The first Cockroach policy-observation
adapter stores a canonical observation hash so matching replays are
idempotent while conflicting governance evidence is rejected. Its
UI/agent-readable weak-point projection is now in place before real API,
MCP, Hermes, Temporal, or Dapr entrypoints are exposed.

No app should publish raw NATS payloads directly. Publishing should go
through `@agentic-org/messaging`.

The generic outbox publisher should claim unpublished outbox events from
an `OutboxEventSource`, resolve the typed Organization messaging
domain, publish through an `EventPublisher` port, and mark the outbox
row published only after the publish succeeds. The NATS adapter is an
implementation of that port; it owns transport-specific concerns such as
headers, message IDs, and JSON serialization. This keeps the
Organization event loop extensible and testable without coupling the
publisher to the NATS client.

Outbox claims must be fenced. The publisher creates a claim ID for each
batch; the source returns claimed events carrying that same claim ID; the
publish mark must include the claim ID and durable adapters must reject
stale, missing, already-published, or differently claimed rows. This is
the minimum protection before multiple worker replicas publish from the
same outbox table.
The first Cockroach implementation ships both the updated core table
shape and an additive `0002_agentic_org_outbox_claim_fence` migration so
existing dev or cluster databases that already created the outbox table
receive the `claim_id` column. Stale publish-mark failures are typed
errors with claim/outbox/event/trace evidence, which the worker host can
carry into telemetry without importing the Cockroach adapter.
The cross-package failure evidence keys are defined in the domain kernel
as a neutral contract. Adapter packages may populate those keys, worker
packages may carry them, and observability packages may project them,
but no package should invent parallel string keys for the same evidence.

### Event-to-Automation Contract

Agentic Organization should behave like an event-driven operating system.
State changes do not merely update boards. They wake up the Organization.

The required runtime path is:

```text
command accepted
  -> state transition persisted
  -> domain event written to outbox
  -> outbox publishes canonical NATS event
  -> rule evaluation consumes event
  -> reaction plan is created
  -> reaction executor validates policy, leases, budget, and hat supply
  -> follow-up commands create reviews, QA work, assignments, runs, reports,
     meetings, escalations, release tasks, or no-op decisions
```

Rules never mutate state directly. They propose a `ReactionPlan`. The
reaction executor turns that plan into normal Organization commands, so
automation follows the same policy, audit, idempotency, and trace path as
human or agent actions.

Minimum event automations:

| Event                          | Rule result                                | Follow-up command examples                                              |
| ------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------- |
| `work_item.ready`              | work needs execution or review assignment  | `reserve_hat`, `assign_work`, `start_schedule_block`                    |
| `work_item.review_requested`   | reviewer hat must be staffed               | `reserve_hat`, `request_gate_review`, `send_inbox_signal`               |
| `gate.code.approved`           | work can move to QA if QA is required      | `create_qa_work_item`, `reserve_hat`, `request_gate_review`             |
| `gate.qa.approved`             | work can move toward delivery/release      | `create_release_task`, `request_delivery_review`                        |
| `gate.changes_requested`       | implementer needs a bounded rework loop    | `assign_rework`, `start_prompt_flow`, `send_inbox_signal`               |
| `work_item.blocked`            | blocker owner and escalation path required | `create_blocker`, `notify_manager`, `schedule_blocker_review`           |
| `hermes_run.heartbeat_late`    | runtime health needs reconciliation        | `create_platform_incident`, `reconcile_run`, `notify_platform_operator` |
| `memory.gap_detected`          | memory/process improvement enters backlog  | `send_supervisor_signal`, `request_memory_review`                       |
| `credential_request.submitted` | security review is mandatory               | `request_security_gate`, `send_inbox_signal`                            |
| `release.ready`                | delivery gate and evidence check required  | `request_delivery_review`, `verify_release_evidence`                    |

The first V0 rule catalog should include:

- ready work assignment;
- review staffing;
- QA staffing after code approval;
- delivery review after QA signoff;
- blocked work escalation;
- stale review escalation;
- late Hermes heartbeat incident creation;
- memory gap follow-up;
- credential expansion security review.

Every automation must record:

- triggering event ID;
- matched rule IDs and versions;
- reaction plan ID;
- policy decision ID;
- commands executed;
- commands skipped and why;
- idempotency keys;
- resulting event IDs;
- trace ID and correlation ID.

This makes automation inspectable from the affected project, initiative,
work item, gate, agent, hat assignment, run, and UI timeline.

### Subject Convention

Use one Organization subject family:

```text
agentic-org.<env>.<orgId>.<domain>.<eventType>
agentic-org.<env>.<orgId>.inbox.agent.<agentId>
agentic-org.<env>.<orgId>.inbox.hat.<hatAssignmentId>
agentic-org.<env>.<orgId>.ui.<projection>
agentic-org.<env>.<orgId>.dlq.<domain>
agentic-org.<env>.<orgId>.cluster.hats.<eventType>
```

The existing hat-system NATS subjects can be consumed by a bridge
consumer and republished into the Organization subject family with the
canonical envelope. Do not require the Go hat-system operator to change
before V0 can consume it.

### Transactional Outbox and Inbox

Every command writes these in one transaction:

```text
authoritative state
audit_events
outbox_events
idempotency_keys
```

Every NATS consumer writes an inbox receipt before side effects:

```text
event_id
consumer_name
aggregate_type
aggregate_id
aggregate_version
payload_hash
first_seen_at
processed_at
result
```

Consumers dedupe by `eventId + consumerName`. Commands dedupe by
deterministic `idempotencyKey`. External side effects must either be
natively idempotent or wrapped by a command that stores the external
request/result.

The first executable runtime slice implements this as an event ingestion
processor before a live NATS consumer exists. A transport adapter decodes
the canonical envelope, calls the processor, and the processor checks
the inbox receipt, evaluates rules, and persists the receipt plus
reaction plans through one store operation. Durable adapters should
implement that operation transactionally so a saved receipt cannot
silently suppress a reaction plan that failed to persist. The processor
also compares payload hashes for repeated `eventId + consumerName`
pairs; conflicting payloads are not treated as normal duplicates.

The processor treats only completed inbox receipts as duplicates. A
receipt with a matching payload hash but without completion fields is a
recoverable pending/orphan state: the rule processor may re-evaluate the
event and call the same outcome store operation to complete the receipt
and persist reaction plans. Durable adapters should still make this rare
by committing receipt, reaction plans, and processed marker in one
transaction.

Cockroach-specific transaction mechanics stay inside
`@agentic-org/state-cockroach`. Application and runtime packages see
outcome ports. The Cockroach adapter receives transaction-batch SQL
executor seams for command outcomes and event-ingestion outcomes, and a
real process adapter must bind those seams to an actual CockroachDB
transaction before production traffic uses the adapter.
The event-ingestion Cockroach adapter must normalize SQL `NULL`
completion fields to omitted receipt fields and claim the pending
receipt at the start of the transaction. Reaction-plan inserts and the
processed marker must be conditional on that claim. If another consumer
already completed the receipt, the adapter returns a duplicate outcome
through the generic `EventIngestionStore` result without inserting
reaction plans.

The processed marker must also prove the claim was still held by
returning the marked receipt. If the final mark no longer matches a
pending receipt after reaction plans were prepared, the adapter must
abort the transaction so those reaction plans roll back, then return a
generic duplicate outcome. Runtime code must not receive Cockroach
update-count details or transaction objects.

A worker host composes that ingestion processor with the outbox
publisher but stays below the NestJS process layer. This creates a
testable boundary where replayable inbound sources and live transport
consumers can both feed the same rule processor without changing rule
evaluation or reaction-plan persistence. The worker-host source port is
replayable pull only; live NATS ack, nack, checkpoint, backoff, and DLQ
behavior remains owned by the transport adapter and `apps/workers`
process host.

The first NATS consumer adapter is now the transport-policy boundary. It
decodes canonical JSON envelopes and calls the runtime ingestion
processor, but it owns JetStream-style decisions: ack processed and
duplicate messages, terminate plus dead-letter invalid envelopes and
payload conflicts, and negative-acknowledge transient ingestion
failures. If dead-letter publishing fails, it records the failure,
negative-acknowledges the source message for retry, and continues the
fetched batch. If dead-letter publishing succeeds but source-message
termination fails, it records the failure and acknowledges the
already-dead-lettered source message so a poison message is not
redelivered after the DLQ side effect. This keeps runtime rules
deterministic and transport-neutral while still making live NATS behavior
testable before a Nest worker process exists.

### Stream and Consumer Manifests

Every stream and durable consumer should declare:

- owner package;
- subject pattern;
- durable name;
- retention policy;
- ordering key;
- ack wait;
- max deliveries;
- backoff;
- replay authorization;
- DLQ subject;
- schema versions accepted;
- compatibility rule;
- SLO for consumer lag.

This can start as generated config from `@agentic-org/messaging` and
later become Kubernetes manifests.

## Traceability Contract

Every command, event, adapter call, and artifact must carry a correlation
chain.

Required trace fields:

```text
traceparent
trace_id
span_id
correlation_id
causation_id
command_id
idempotency_key
event_id
agent_id
hat_assignment_id
project_id
initiative_id
work_item_id
run_id
policy_decision_id
```

Required OpenTelemetry span attributes:

```text
agentic.event.id
agentic.event.type
agentic.command.id
agentic.correlation.id
agentic.causation.id
agentic.idempotency.key
agentic.agent.id
agentic.hat.assignment.id
agentic.project.id
agentic.initiative.id
agentic.work_item.id
agentic.run.id
agentic.policy.decision_id
nats.subject
nats.stream
nats.consumer
k8s.namespace.name
k8s.pod.name
```

`@agentic-org/observability` should provide helpers that make these
fields easy to attach and hard to skip.

## Audit, Event Store, and Replay

Use clear language:

- `audit_events` are compliance and evidence records.
- `outbox_events` are integration events waiting to publish.
- `event_store` is the append-only domain history if we decide to keep
  one beyond audit/outbox.
- NATS streams are transport and replay surfaces, not the source of
  truth.

Replay should:

1. create a `ReplayRequested` event;
2. require approval for side-effecting domains;
3. preserve original event IDs inside the replay envelope;
4. mark replay spans and events;
5. write replay outcomes to audit;
6. never silently perform external side effects twice.

## Cluster Deployment Boundary

Agentic Organization should deploy as a `full-ai-cluster` consumer
workload:

```text
full-ai-cluster/k8s/applications/agentic-organization/
  Application.yaml
  namespace.yaml
  api
  web
  workers
  temporal-worker
  dapr-actors
  mcp-gateway
  ExternalSecret refs
  CiliumNetworkPolicy
  ServiceAccount/RBAC
```

### Native `full-ai-cluster` Binding

The application should treat `full-ai-cluster` as its native runtime
environment. Local fakes are useful for tests, but the real adapter
contracts should point at the services that already exist in the cluster
tree.

| Adapter package                   | Cluster dependency                               | Expected in-cluster target                                            |
| --------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `@agentic-org/state-cockroach`    | CockroachDB ArgoCD app                           | `cockroachdb-public.cockroachdb.svc.cluster.local:26257`              |
| `@agentic-org/messaging`          | NATS ArgoCD app with JetStream enabled           | `nats.nats.svc.cluster.local:4222`                                    |
| `@agentic-org/workflows-temporal` | Temporal ArgoCD app                              | `temporal-frontend.temporal.svc.cluster.local:7233`                   |
| `@agentic-org/actors-dapr`        | Dapr control plane                               | Dapr sidecar plus `dapr-system` placement service                     |
| `@agentic-org/memory`             | Hindsight OCI Helm chart                         | `http://hindsight-api.hindsight.svc.cluster.local`                    |
| `@agentic-org/hermes`             | Hermes deployment/service                        | `http://hermes.hermes.svc.cluster.local` once replicas are enabled    |
| `@agentic-org/openziti`           | OZ/OpenZiti controller app                       | `https://ziti-controller.openziti.svc.cluster.local:443`              |
| `@agentic-org/k8s-hats`           | hat-system CRDs and operator                     | Kubernetes API watches plus `zeta.society.hats.>` bridge input        |
| `@agentic-org/observability`      | Alloy, Tempo, Loki, Mimir, kube-prometheus-stack | OTLP traces to Alloy/Tempo, logs to Loki, metrics to Prometheus/Mimir |
| `@agentic-org/policy`             | OPA Gatekeeper and Organization policy package   | in-process policy first, OPA bundle/constraint adapters later         |

Adapter configuration should use environment variables and Kubernetes
Secrets/ExternalSecrets, but the domain package should never see those
values. The Nest composition layer binds configuration into adapter
ports.

The current `apps/workers` NodeNext host applies this rule before NestJS
is introduced: non-secret operational values are parsed from typed env
names, while URLs, credentials, and client construction remain reserved
for process adapter factories supplied by the composition root.

Current `apps/workers` process environment contract:

```text
AGENTIC_ORG_ENV
AGENTIC_ORG_ID
COCKROACH_DATABASE_URL
NATS_SERVERS
NATS_STREAM
NATS_DURABLE
NATS_INBOUND_BATCH_SIZE
WORKER_INBOUND_BATCH_SIZE
WORKER_OUTBOX_BATCH_SIZE
WORKER_REACTION_PLAN_BATCH_SIZE
WORKER_REACTION_PLAN_LEASE_MS
```

`COCKROACH_DATABASE_URL` is a secret-backed process adapter input. In
the cluster it must be sourced from a Kubernetes Secret populated by
External Secrets from Vault, not from a plain manifest or reusable
package default. `NATS_SERVERS` is the service-discovery input for the
NATS adapter and can be non-secret when it contains only cluster service
addresses such as `nats.nats.svc.cluster.local:4222`; NATS credentials,
tokens, or certificates remain secret-backed process inputs.
`NATS_STREAM` and `NATS_DURABLE` are non-secret operational bindings
that the process factory must pass into the real pull-consumer
construction path.

Future full deployment adapter environment will add service-specific
values as their process adapters become real:

```text
TEMPORAL_ADDRESS
HINDSIGHT_URL
HERMES_URL
OZ_CONTROLLER_URL
OTEL_EXPORTER_OTLP_ENDPOINT
HAT_SYSTEM_NAMESPACE
```

Adapter-specific URLs and secrets such as CockroachDB URLs, NATS URLs,
database credentials, NATS credentials, OpenZiti credentials, LLM
provider keys, and credential-proxy tokens must come from Vault through
External Secrets or another approved cluster secret path. They should
not live in plain Kubernetes manifests and should not be baked into the
Agentic Organization image.

### ArgoCD Sync Wave

Agentic Organization should not land before its substrates. The current
cluster ordering puts hat-system CRDs before data consumers, data planes
at wave `0`, Hindsight and Temporal at wave `10`, and Hermes at wave
`20`.

Recommended deployment split:

| Application                      |        Wave | Purpose                                                                                            |
| -------------------------------- | ----------: | -------------------------------------------------------------------------------------------------- |
| `agentic-organization-contracts` | `-5` or `0` | optional future CRDs, NATS stream definitions, schema/config resources that other apps may consume |
| `agentic-organization`           |        `30` | API, web, workers, Temporal worker, Dapr actor host, MCP gateway                                   |

If V0 ships no CRDs and only consumes existing services, one
`agentic-organization` app at wave `30` is enough. If it later adds CRDs
or cluster-wide policies, split those resources into the earlier
contracts app rather than forcing the main runtime app to reconcile
early.

### Kubernetes Workload Shape

The first ArgoCD app should deploy one namespace and several workloads
from the same image or image family:

| Workload        | Kubernetes shape                             | Notes                                                     |
| --------------- | -------------------------------------------- | --------------------------------------------------------- |
| API             | Deployment + ClusterIP Service               | REST/OpenAPI, internal command API, read API              |
| Web             | Deployment + ClusterIP Service/Gateway route | operations console                                        |
| Workers         | Deployment                                   | outbox publisher, reconcilers, schedulers, NATS consumers |
| Temporal worker | Deployment                                   | workflow and activity workers only                        |
| Dapr actor host | Deployment with Dapr annotations             | actor endpoints and reminders                             |
| MCP gateway     | Deployment + ClusterIP Service               | Hermes-facing governed tool surface                       |

All workloads need:

- service account scoped to only required Kubernetes reads/writes;
- CiliumNetworkPolicy egress only to required namespaces/services;
- OpenTelemetry instrumentation enabled by default;
- readiness checks that include dependency health for the adapter set
  the process actually uses;
- structured logs with the canonical trace envelope fields;
- pod labels for app, package host, version, and Organization
  environment.

The MCP gateway and worker processes are the highest-risk egress points.
They should get the narrowest network policy and credential scope first.

### Runtime Readiness Mapping

Current cluster readiness:

- CockroachDB exists as the first distributed SQL substrate. It is
  consumed only through the durable state adapter boundary.
- NATS exists with JetStream enabled and Longhorn-backed file storage.
- Temporal and Dapr are present, but their Organization-specific
  persistence/components still need wiring.
- Hindsight is wired as the Hermes memory system and currently uses
  bundled PostgreSQL until an external CockroachDB-backed deployment is
  proven.
- Hermes exists as a placeholder deployment with `replicas: 0` until the
  real image is available.
- hat-system CRDs and policies exist; the operator deployment is still a
  scaffold until the image is built and replicas are enabled.
- Cilium, SPIRE, Vault, Trust Manager, and External Secrets provide the
  security substrate.

The CA should not block V0 on every runtime being production-ready. It
should define ports and fakes first, then swap in cluster adapters as
each substrate becomes live.

### Bootstrap and Dev Parity

The same package architecture should run in three modes:

| Mode              | Purpose                                    | Runtime adapters                                                                                |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| unit/test         | package and command tests                  | in-memory/fake adapters                                                                         |
| local dev cluster | k3d/K3S parity with `full-ai-cluster` apps | real NATS/durable SQL when available, fake Hermes/hat-system if needed                          |
| full cluster      | production-like AI cluster                 | CockroachDB-backed state adapter, NATS, Hindsight, Hermes, OpenZiti, hat-system, Temporal, Dapr |

Do not create a Docker Compose architecture that diverges from
`full-ai-cluster`. Local development can use fakes or a dev cluster, but
the real deployment contract is ArgoCD on the cluster.

### Hat-System Integration Path

The TypeScript side should integrate with the existing hat-system in
three steps:

1. Read CRDs and consume `zeta.society.hats.>` ticks through
   `@agentic-org/k8s-hats`.
2. Bridge HatSwap ticks into canonical `agentic-org.*` events with
   trace fields, dedupe keys, and Organization scope when a matching
   assignment exists.
3. After the Organization assignment state machine is stable, allow
   approved Organization assignments to create HatBinding proposals.

The Organization DB remains the business source of truth. Hat-system
proves runtime enforcement and cluster-observed state.

### Observability Integration Path

`@agentic-org/observability` should produce OTLP traces and structured
logs that the current Alloy/Tempo/Loki/Mimir stack can ingest. The
package should standardize:

- trace propagation across HTTP, NATS, Temporal activities, Dapr actor
  calls, MCP tools, Hermes callbacks, Hindsight calls, and Kubernetes
  watches;
- JSON log fields matching the canonical event envelope;
- Prometheus metrics for outbox lag, NATS consumer lag, DLQ count,
  command latency, policy denial count, adapter health, and projection
  staleness;
- policy decision span attributes for allowed events, including decision
  ID and policy version, so agents and humans can trace why a state
  transition was permitted;
- links from UI evidence records to trace IDs, log queries, run IDs,
  event IDs, and artifacts.
- workflow visibility records that project command/event context into
  UI- and agent-readable health, stage, trace, scope, aggregate, and
  weak-point indicator fields, including policy decision ID and policy
  version when present.
- policy-decision observation visibility records that project denied
  command, tool, supervisor-chain, actor, scope, decision ID/version, and
  denial reason into `policy_denied` weak-point indicators agents can
  use to find authority, scope, and tool-grant gaps.
- NATS consumer batch attributes for stream, durable consumer, received,
  processed, duplicate, payload-conflict, invalid, failed,
  acknowledged, negative-acknowledged, terminated, and dead-lettered
  counts.

Every runtime host should be inspectable from either direction:

```text
work item or initiative
  -> event timeline
  -> visibility record
  -> trace/log/metric links
  -> weak-point indicators
  -> supervisor-chain signal or follow-up work item
```

This is the foundation for agent self-monitoring. Agents should be able
to discover slow triage, repeated failures, missing evidence, missing
tools, policy denials, harness failures, and telemetry gaps, then route
fixes through the same command, review, and security lifecycle as any
other work.

The first `apps/workers` runtime projects both package worker-cycle
counts and NATS consumer batch counts through telemetry sink ports. The
runtime treats package degraded status, thrown loop failures, telemetry
sink failures, dead-lettered NATS messages, invalid NATS messages,
payload-conflict NATS messages, negative acknowledgements, terminated
messages, and failed NATS messages as degraded state so weak points can
surface before the process is connected to real cluster telemetry.
Telemetry failures must not erase successful worker or NATS cycle
results; they are captured as their own typed failure stage. Worker
failure evidence is validated against the domain-owned evidence-key set
before it reaches observability, and the first failure projection uses
the consistent `agentic.worker.failure.first_*` key family. The
composition root is therefore the future bridge from these records into
the full-ai-cluster LGTM stack: structured logs to Loki, traces to Tempo
through Alloy, metrics to Prometheus/Mimir, and dashboard projections in
Grafana.

## V0 Build Sequence

1. Create package skeletons for:
   - `@agentic-org/domain`;
   - `@agentic-org/application`;
   - `@agentic-org/state`;
   - `@agentic-org/state-cockroach`;
   - `@agentic-org/policy`;
   - `@agentic-org/messaging`;
   - `@agentic-org/messaging-nats`;
   - `@agentic-org/observability`;
   - `@agentic-org/work-os`;
   - `@agentic-org/hats`;
   - `@agentic-org/mcp`;
   - `@agentic-org/hermes`;
   - `@agentic-org/memory`;
   - `@agentic-org/ui-projections`.
2. Implement the canonical command context, event envelope, typed enums,
   and idempotency key builder.
3. Add command authorization and hat-authority ports so the command
   pipeline rejects expired, missing, revoked, scope-denied, or
   tool-denied hats before handler dispatch or state persistence.
4. Implement the first durable SQL schema and migrations for the V0
   executable contract, using CockroachDB as the initial adapter.
5. Implement command handlers for:
   - send supervisor signal;
   - triage supervisor signal;
   - capability request input through the supervisor signal path;
   - reserve hat;
   - issue hat token;
   - start prompt flow;
   - launch Hermes run;
   - submit evidence;
   - decide gate;
   - complete outcome review.
6. Use fake adapters for Hermes, Hindsight, Dapr, Temporal, and
   hat-system.
7. Add NATS outbox publisher and one consumer after command tests pass.
8. Add inbox/consumer dedupe before any NATS-driven automation performs
   side effects. The first package-level processor and Cockroach adapter
   now exist; the first package-level worker host composes the outbox and
   inbound-ingestion loops through ports, and the NATS consumer adapter
   owns live ack/nack/DLQ policy.
9. Add the first rule catalog and reaction executor for ready work,
   review staffing, QA staffing, blocker escalation, and late run
   incidents.
10. Add runtime hosts. The first NodeNext `apps/workers` host now parses
    typed process config, composes the worker and NATS consumer loops
    through ports, and has a durable Cockroach composition seam for
    outbox/event-ingestion-backed worker execution; NestJS API and real
    process client wiring are still pending.
11. Add UI projections for work board, review center, and evidence
    timeline.
12. Add real cluster adapters one at a time.

## Extraction Path

Do not split by domain first. Split only after package contracts are
stable and contract-tested.

Extraction pattern:

```text
package interface
  -> in-process provider
  -> remote adapter behind the same interface
  -> ArgoCD-managed service
```

The first extraction candidates are runtime hosts already implied by the
architecture:

- MCP gateway;
- Temporal worker;
- Dapr actor host;
- Hermes run adapter;
- memory adapter;
- k8s hat projection worker.

Keep Organization Kernel, Work OS, Hat Graph, Policy, and command
handling together until their contracts are proven.

## Contract Gates

Before a package can be consumed by the OS, it needs:

- public export review;
- dependency-boundary check;
- typed enum/state-machine tests;
- policy allow/deny tests where relevant;
- company Work OS policy tests where lifecycle order matters;
- command pipeline tests proving policy authorization runs before
  idempotency lookup, handler dispatch, and state persistence;
- event envelope tests;
- idempotency tests for side-effecting commands;
- rule evaluation tests that prove a state event creates the expected
  reaction plan without mutating state directly;
- reaction executor tests that prove automation uses normal commands,
  emits audit/outbox events, and dedupes retries;
- OpenTelemetry field coverage tests;
- outbox/inbox tests for event-producing commands;
- contract tests for every adapter port;
- README section documenting ownership, inputs, outputs, events, and
  failure modes.

## Open Questions

- Should `@agentic-org/contracts` be separate from `@agentic-org/domain`
  from day one, or split after the first generated client exists?
- Should event store be a dedicated table in V0, or are audit plus
  outbox enough until replay requirements harden?
- Should the hat-system bridge republish into the canonical
  `agentic-org.*` subject family, or should Organization consumers read
  both subject families directly?
- Should package dependency rules be enforced with Nx module boundaries,
  dependency-cruiser, or a custom lint rule?
- Which first fake adapter should be replaced with a real cluster
  adapter: NATS, Hindsight, Hermes, Dapr, Temporal, or k8s hats?
