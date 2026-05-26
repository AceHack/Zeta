# First Implementation Slice

## Status

Implemented as a small NodeNext TypeScript package slice.

## Purpose

This slice turns the first Agentic Organization runtime contract from
architecture prose into executable TypeScript.

It does not introduce NestJS, live NATS connections, Temporal, Dapr,
Hermes, Hindsight, or Kubernetes deployment manifests yet. Those remain
adapter layers. The goal is to prove the Organization command and event
publication shape before adding distributed infrastructure.

The slice is intentionally generic. `send_supervisor_signal` is the
coordination primitive; specific downstream outcomes are lifecycle
decisions made by the target supervisor chain. The goal is not to
hardcode every future request tool. The goal is to make agent
coordination traceable and expandable so agents can propose new tools,
flows, and routing patterns as the Organization learns.

## Implemented Flow

```text
send_supervisor_signal
  -> command authorization policy
  -> active hat-authority check
  -> denied policy decision observation, when denied
  -> idempotency record check
  -> chain-of-command signal
  -> audit event
  -> outbox event with canonical event envelope
  -> command outcome persisted through one state-store operation
  -> outbox publisher
  -> NATS JetStream event publisher adapter
  -> NATS JetStream event consumer adapter
  -> NATS subject contract
  -> event ingestion processor
  -> inbox receipt / consumer dedupe
  -> event-processing outcome persisted through one store operation
  -> persisted reaction plans
  -> worker host cycle summary
  -> apps/workers runtime summary
  -> LGTM span attributes
  -> supervisor triage reaction plan
```

## Checkpoint Boundary

The implemented slice does not yet create discussion anchors, graph
nodes, hat assignments, hat tokens, policy decisions, prompt-flow runs,
Hermes runs, or reviewer gates. Those remain V0 follow-on commands.

Capability-request-shaped inputs should continue to enter through
`send_supervisor_signal`. The target supervisor triage step decides
whether to create a `CapabilityRequest` work item, route to security,
open a discussion, assign implementation work, answer directly, or
escalate.

## Packages

| Package                        | Implemented first                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@agentic-org/domain`          | event envelope, command/event constants, aggregate constants, supervisor-chain communication types, hat communication briefs, work item state machine, shared records |
| `@agentic-org/application`     | command pipeline, command-handler registry, state-store ports, idempotency conflict handling, supervisor signal handler                                               |
| `@agentic-org/policy`          | command authorization port, hat-authority port, policy-decision observation port, active/expired/revoked/scope/tool denial decisions, typed policy denial reasons     |
| `@agentic-org/state`           | generic state-store/outbox-source ports plus the in-memory Organization state-store factory fake                                                                      |
| `@agentic-org/state-cockroach` | first replaceable durable SQL implementation of the state-store/outbox-source ports, backed by CockroachDB                                                            |
| `@agentic-org/messaging`       | stable `agentic-org.<env>.<org>.<domain>.<event>` subject builder, outbox publisher, event publisher port, and typed domain resolver                                  |
| `@agentic-org/messaging-nats`  | NATS JetStream publisher and consumer adapter contracts with canonical JSON payloads, headers, message IDs, ack/nack, termination, and DLQ policy                     |
| `@agentic-org/observability`   | OpenTelemetry/LGTM span attribute projection for event envelopes and NATS consumer batch summaries                                                                    |
| `@agentic-org/runtime`         | first rule that plans triage for the target supervisor when a chain signal is sent                                                                                    |
| `@agentic-org/workers`         | process-boundary run-once worker host that composes outbox publishing and inbound event ingestion through ports                                                       |
| `@agentic-org/governance`      | package dependency-boundary checks that prevent application code from importing concrete state/runtime adapters                                                       |

## Apps

| App            | Implemented first                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/workers` | NodeNext runtime-host shell that parses process config, composes worker ports, runs the package worker cycle, runs the NATS consumer cycle, emits telemetry records, and reports healthy/degraded state |

## NodeNext Runtime Decision

Agentic Organization now has a local `package.json` and
`tsconfig.json` under `agentic-organization/`.

The first executable slice uses:

- Node 22 or newer;
- `type: module`;
- TypeScript `module: NodeNext`;
- explicit `.ts` imports;
- `node:test`;
- `node:assert/strict`;
- Node TypeScript stripping for test execution.

This keeps the first package contracts independent from the root repo's
Bun tooling while still letting the future NestJS hosts consume the same
package code.

## Telemetry Contract

Every event envelope carries:

- event ID and event type;
- command ID;
- correlation ID;
- causation ID;
- trace ID;
- idempotency key;
- agent ID;
- hat assignment ID;
- organization ID;
- project ID;
- work item ID;
- aggregate ID, type, and version.

`@agentic-org/observability` projects those fields into stable
`agentic.*` span attributes plus NATS messaging attributes. Later OTLP
instrumentation must use these keys so Alloy, Tempo, Loki, Mimir,
Prometheus, and Grafana can connect command execution, NATS fanout,
Hermes runs, MCP calls, and UI evidence.

## Guardrails Proven

- Hats can expose a communication brief that tells the wearer their duty,
  supervisor line, and efficient upward tools.
- Every command entering the pipeline is authorized through a generic
  `CommandAuthorizationPort` before idempotency lookup, handler dispatch,
  or persistence.
- The first policy adapter shape delegates to a generic
  `HatAuthorityPort`, so active hats allow commands and expired, missing,
  revoked, scope-denied, or tool-denied hats return a typed
  `policy_denied` result.
- Policy denial does not create supervisor-signal, business audit,
  outbox, or idempotency state. It records a policy decision observation
  through a dedicated generic port so denied attempts are visible without
  pretending a business state transition succeeded.
- If policy decision observation fails for a denied command, the command
  still rejects before handler dispatch, idempotency lookup, or business
  persistence with a typed `policy_observation_failed` error.
- Allowed policy decisions are projected onto audit events and outbox
  envelopes before command outcome persistence, so every accepted
  business transition carries the policy decision that allowed it.
- The command pipeline receives state-store factories and command
  handlers through ports instead of constructing in-memory adapters or
  branching on command types.
- Command handlers return typed effects; the command pipeline persists
  the supervisor signal, audit events, outbox events, and idempotency
  record through one `recordCommandOutcome` port. Handlers do not write
  piecemeal state.
- Command outcome persistence returns generic committed, replayed, or
  idempotency-conflict results. Durable adapters own idempotency race
  handling and return those generic outcomes without exposing duplicate
  key or vendor errors to application code.
- State-store and outbox-source ports are async from the beginning so
  durable SQL, NATS-backed workers, and other real adapters do not
  inherit a fake synchronous shape.
- A governance test enforces that application code does not import the
  state adapter, Cockroach adapter, NestJS, NATS, Dapr, Temporal,
  Drizzle, or Postgres clients.
- A governance test enforces that policy code does not import
  application, runtime, state adapters, messaging adapters, NestJS, NATS,
  Dapr, Temporal, Drizzle, Postgres, or vendor clients.
- A governance test enforces that the Cockroach state adapter does not
  import messaging, NATS, or JetStream. Durable state can be swapped
  without dragging transport concerns into the repository layer.
- A governance test enforces package source layout: production code
  lives under `packages/<name>/src`, tests live under
  `packages/<name>/test`, and `*.test.ts` files are rejected from
  production source trees.
- The outbox publisher claims unpublished events, publishes each event
  through an `EventPublisher` port, and marks rows published only after
  the publish succeeds.
- The NATS adapter publishes canonical JSON envelopes with typed headers
  and event IDs as message IDs for idempotent JetStream publication.
- The NATS consumer adapter decodes canonical JSON envelopes, preserves
  the traceable event boundary into the runtime ingestion processor,
  acknowledges processed and duplicate messages, terminates and
  dead-letters invalid envelopes or payload conflicts, and
  negative-acknowledges transient ingestion failures. If dead-letter
  publication or source-message termination fails, it records the
  failure, negative-acknowledges the source message, and continues the
  batch.
- The event ingestion processor accepts decoded canonical envelopes,
  dedupes them by event ID plus consumer name, evaluates automation
  rules once, rejects same-event payload hash conflicts, and persists
  reaction plans through a store boundary that durable adapters can make
  transactional.
- Event ingestion treats only completed receipts as duplicates. If a
  same-payload receipt exists without `processedAt` and `result`, the
  processor re-evaluates the event and records the full outcome so old
  orphan receipts do not suppress automation.
- The Cockroach adapter now declares inbox receipt and reaction plan
  tables plus a SQL-backed event-ingestion store. This is still behind a
  generic state port; live NATS consumers are not hardcoded into the
  adapter.
- The Cockroach command and event-ingestion adapters expose
  adapter-local transaction batch seams. Application and runtime code
  still see generic outcome ports; Cockroach-specific transaction
  mechanics stay in `@agentic-org/state-cockroach`.
- The Cockroach command adapter records the idempotency row before
  effect rows inside the command transaction batch, so a duplicate key
  aborts before supervisor signal, audit, or outbox rows are submitted.
- The Cockroach command adapter claims the idempotency key before
  inserting effects. If it loses the race, it returns replay or
  idempotency conflict through the generic `CommandStateStore` result
  and does not insert command effects.
- The Cockroach event-ingestion adapter normalizes SQL `NULL`
  completion fields to pending receipts and claims the pending receipt
  before inserting reaction plans. If the claim reports duplicate or
  payload conflict, the adapter returns that generic outcome without
  inserting reaction plans.
- The Cockroach event-ingestion adapter also requires the final
  processed-receipt update to return the claimed receipt. If that
  completion check fails after reaction plans were prepared, the
  transaction rolls back and the adapter returns a generic duplicate
  outcome.
- Governance now checks that runtime code, like application code, cannot
  import vendor adapters or vendor clients directly. Vendor packages must
  implement generic Organization ports consumed by application/runtime
  packages.
- The worker host now runs one bounded outbox cycle plus one bounded
  inbound-ingestion cycle through explicit ports, then returns an
  idle/worked/degraded summary suitable for future logs, metrics, and UI
  workflow visibility. If one lane fails, the other lane still runs and
  the failure is returned as typed cycle data.
- A governance test enforces that worker source does not import the
  Cockroach adapter, NATS adapter, NestJS, NATS, Dapr, Temporal,
  Drizzle, or Postgres clients. Worker code remains a process boundary,
  not a concrete infrastructure host.
- Duplicate commands with the same idempotency key and request hash
  replay the stored result.
- Duplicate commands with the same idempotency key and a different
  request hash are rejected with a typed error code.
- Work item transitions are typed and illegal direct transitions throw.
- Event envelopes reject missing command trace fields.
- The first automation rule produces a supervisor triage plan, not an
  unreviewed side effect.
- Observability now exposes NATS consumer batch attributes for received,
  processed, duplicate, payload-conflict, invalid, failed,
  acknowledged, negative-acknowledged, terminated, and dead-lettered
  counts.
- `apps/workers` now composes the package worker cycle and NATS consumer
  cycle behind process configuration and telemetry ports. If one cycle
  throws, the other still runs and the runtime result is degraded with a
  typed failure stage.
- `apps/workers` keeps successful worker/NATS cycle results visible even
  when telemetry recording fails. Telemetry sink failures degrade the
  runtime through a dedicated failure stage instead of erasing completed
  work.
- `apps/workers` validates required process config before any loop can
  start: environment, Organization ID, NATS stream, durable consumer,
  and positive NATS inbound batch size.
- `apps/workers` parses required runtime values from typed environment
  names: `AGENTIC_ORG_ENV`, `AGENTIC_ORG_ID`, `NATS_STREAM`,
  `NATS_DURABLE`, and `NATS_INBOUND_BATCH_SIZE`. String values are
  trimmed, and NATS inbound batch size must be a safe positive decimal
  integer.
- `apps/workers` treats any non-happy NATS consumer counter as degraded:
  failed, dead-lettered, invalid, payload-conflict,
  negative-acknowledged, or terminated messages.
- `apps/workers` exposes an app-level composition factory that receives
  typed config plus already-constructed ports. Future real CockroachDB,
  NATS, and telemetry adapters bind at this app seam instead of leaking
  process or secret concerns into reusable packages.
- Observability projections now include policy decision ID and policy
  version in event span attributes and workflow visibility records when
  an accepted command emits a policy-backed event envelope.

## Next Slice

The next slice should add the first real process adapter factories below
`apps/workers`: concrete NATS pull/publish client construction, durable
CockroachDB outbox/inbox adapter construction, and a telemetry sink that
can later send structured logs and metrics into the full-ai-cluster LGTM
stack. Keep URLs, credentials, and connection pools in app adapter config
fed by Kubernetes Secret or ExternalSecret values, never in domain
packages. Add a durable-state integration test using CockroachDB as the
first cluster-backed implementation once a local/dev connection is
available. After that, add a durable policy-decision observation adapter
behind `PolicyDecisionObservationPort` and project policy decision
observations into UI/agent-readable workflow visibility.

Do not make the next slice a pile of bespoke request commands. Build the
generic supervisor triage lifecycle first, then let specialized
lifecycles emerge behind triage.
