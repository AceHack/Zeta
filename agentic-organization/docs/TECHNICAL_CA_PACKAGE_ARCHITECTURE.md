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

## Package Layers

### Layer 0: Domain Kernel

| Package                  | Owns                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `@agentic-org/domain`    | entity IDs, value objects, typed enums, state machines, domain events, command names, event names, aggregate contracts |
| `@agentic-org/contracts` | shared DTOs, public schemas, versioned API/event contracts, generated clients when needed                              |

The domain kernel should be small and strict. It defines language and
legal transitions. It does not execute side effects.

### Layer 1: Application and Policy

| Package                      | Owns                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@agentic-org/application`   | command handlers, handler registry, use cases, transaction orchestration, ports, command result contracts |
| `@agentic-org/policy`        | RBAC, hat authority checks, OPA/Rego adapter boundary, policy decisions, denial reasons                   |
| `@agentic-org/observability` | correlation envelope, OpenTelemetry helpers, required span attributes, trace propagation                  |

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

| Package                                  | Owns                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@agentic-org/state`                     | generic state-store, outbox-source, inbox, idempotency, transaction, and lease ports            |
| `@agentic-org/state-cockroach`           | first replaceable durable SQL implementation of state-store and outbox-source ports             |
| `@agentic-org/messaging`                 | NATS envelope builder, subject builder, JetStream publisher, consumer, DLQ, replay contracts    |
| `@agentic-org/messaging-nats`            | NATS JetStream implementation of the event publisher port, canonical JSON, headers, message IDs |
| `@agentic-org/workflows-temporal`        | Temporal workflow and activity contracts, task queues, workflow clients                         |
| `@agentic-org/actors-dapr`               | Dapr actor interfaces, actor implementations, reminders, actor state projection                 |
| `@agentic-org/mcp`                       | MCP schemas, tool registry, preflight checks, policy-checked tool handlers                      |
| `@agentic-org/hermes`                    | Hermes session adapter, run adapter, callback contract, run context builder                     |
| `@agentic-org/memory`                    | Hindsight adapter, hat-scoped recall/retain/reflect, memory attribution, memory health          |
| `@agentic-org/k8s-hats`                  | generated or checked Hat, HatBinding, HatSwap, HatPolicy types, informers, projection decoding  |
| `@agentic-org/openziti`                  | OpenZiti transport adapter, identity/config access, connectivity checks                         |
| `@agentic-org/credential-proxy`          | credential request adapter, scoped credential use, audit hooks                                  |
| `@agentic-org/adapters-agentic-services` | temporary wrappers around reused `agentic-services` primitives                                  |

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

The command pipeline must also depend on a handler registry and a
state-store factory supplied by the composition layer. It must not
instantiate the in-memory store or branch on every command type. New
commands should register a handler; new persistence backends should
implement the same store-factory port.

State-store ports are async at the application boundary. In-memory
adapters may resolve immediately, but durable SQL, transactional outbox,
inbox, and lease adapters must be able to perform real I/O without
changing command-handler contracts. CockroachDB is the first durable SQL
adapter in the cluster, not an application-layer dependency.

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
| `@agentic-org/memory`             | Hindsight OCI Helm chart                         | `http://hindsight.hindsight.svc.cluster.local`                        |
| `@agentic-org/hermes`             | Hermes deployment/service                        | `http://hermes.hermes.svc.cluster.local` once replicas are enabled    |
| `@agentic-org/openziti`           | OZ/OpenZiti controller app                       | `https://ziti-controller.openziti.svc.cluster.local:443`              |
| `@agentic-org/k8s-hats`           | hat-system CRDs and operator                     | Kubernetes API watches plus `zeta.society.hats.>` bridge input        |
| `@agentic-org/observability`      | Alloy, Tempo, Loki, Mimir, kube-prometheus-stack | OTLP traces to Alloy/Tempo, logs to Loki, metrics to Prometheus/Mimir |
| `@agentic-org/policy`             | OPA Gatekeeper and Organization policy package   | in-process policy first, OPA bundle/constraint adapters later         |

Adapter configuration should use environment variables and Kubernetes
Secrets/ExternalSecrets, but the domain package should never see those
values. The Nest composition layer binds configuration into adapter
ports.

Minimum runtime environment contract:

```text
AGENTIC_ORG_ENV
AGENTIC_ORG_ID
COCKROACH_URL
NATS_URL
TEMPORAL_ADDRESS
HINDSIGHT_URL
HERMES_URL
OZ_CONTROLLER_URL
OTEL_EXPORTER_OTLP_ENDPOINT
HAT_SYSTEM_NAMESPACE
```

Secrets such as database credentials, NATS credentials, OpenZiti
credentials, LLM provider keys, and credential-proxy tokens must come
from Vault through External Secrets or another approved cluster secret
path. They should not live in plain Kubernetes manifests and should not
be baked into the Agentic Organization image.

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
- links from UI evidence records to trace IDs, log queries, run IDs,
  event IDs, and artifacts.
- workflow visibility records that project command/event context into
  UI- and agent-readable health, stage, trace, scope, aggregate, and
  weak-point indicator fields.

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
3. Implement the first durable SQL schema and migrations for the V0
   executable contract, using CockroachDB as the initial adapter.
4. Implement command handlers for:
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
5. Use fake adapters for Hermes, Hindsight, Dapr, Temporal, and
   hat-system.
6. Add NATS outbox publisher and one consumer after command tests pass.
7. Add inbox/consumer dedupe before any NATS-driven automation performs
   side effects.
8. Add the first rule catalog and reaction executor for ready work,
   review staffing, QA staffing, blocker escalation, and late run
   incidents.
9. Add the NestJS API and worker hosts.
10. Add UI projections for work board, review center, and evidence
    timeline.
11. Add real cluster adapters one at a time.

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
