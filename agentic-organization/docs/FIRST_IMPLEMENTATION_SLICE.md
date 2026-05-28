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
nodes, hat assignments, hat tokens, prompt-flow runs, Hermes runs, or
reviewer gates. Those remain V0 follow-on commands.

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
| `@agentic-org/policy`          | command authorization port, hat-authority port, policy-decision observation/store/reader ports, active/expired/revoked/scope/tool denial decisions, typed reasons     |
| `@agentic-org/state`           | generic state-store/outbox-source ports plus the in-memory Organization state-store factory fake                                                                      |
| `@agentic-org/state-cockroach` | first replaceable durable SQL implementation of state-store, outbox-source, event-ingestion, and policy-observation ports, backed by CockroachDB                      |
| `@agentic-org/messaging`       | stable `agentic-org.<env>.<org>.<domain>.<event>` subject builder, outbox publisher, event publisher port, and typed domain resolver                                  |
| `@agentic-org/messaging-nats`  | NATS JetStream publisher and consumer adapter contracts with canonical JSON payloads, headers, message IDs, ack/nack, termination, and DLQ policy                     |
| `@agentic-org/observability`   | OpenTelemetry/LGTM and workflow-visibility projections for event envelopes, NATS batches, worker cycles, and policy observations                                      |
| `@agentic-org/runtime`         | first rule that plans triage for the target supervisor when a chain signal is sent                                                                                    |
| `@agentic-org/workers`         | process-boundary run-once worker host that composes outbox publishing and inbound event ingestion through ports                                                       |
| `@agentic-org/governance`      | package dependency-boundary checks that prevent application code from importing concrete state/runtime adapters                                                       |

## Apps

| App            | Implemented first                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/workers` | NodeNext runtime-host contract shell that parses process config, composes worker ports, exposes the bootstrap/readiness/shutdown lifecycle contract, runs worker/NATS cycles, emits telemetry, binds the loop to signal/delay ports, and reports status/shutdown evidence |

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
- Policy decision observations now have a generic durable store/reader
  contract. The first Cockroach adapter records observations
  idempotently by policy decision ID plus canonical observation hash,
  rejects conflicting evidence for the same policy decision ID, and
  supports scoped queries by organization, project, team, work item,
  actor, hat assignment, and decision status.
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
- The outbox claim path is fenced with a generated `claimId`. Durable
  adapters must return the claim with each event and reject publish
  marks whose claim is stale, missing, or already cleared, so a slow
  publisher cannot mark another worker's claimed event as complete.
- The Cockroach adapter includes an additive
  `0002_agentic_org_outbox_claim_fence` migration so databases that
  already ran the original core migration still receive the `claim_id`
  column required by fenced publishing.
- The NATS adapter publishes canonical JSON envelopes with typed headers
  and event IDs as message IDs for idempotent JetStream publication.
- The NATS consumer adapter decodes canonical JSON envelopes, preserves
  the traceable event boundary into the runtime ingestion processor,
  acknowledges processed and duplicate messages, terminates and
  dead-letters invalid envelopes or payload conflicts, and
  negative-acknowledges transient ingestion failures. If dead-letter
  publication fails, it records the failure, negative-acknowledges the
  source message, and continues the batch. If dead-letter publication
  succeeds but source-message termination fails, it records the failure
  and acknowledges the already-dead-lettered source message so a poison
  message is not redelivered after the DLQ side effect.
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
  CockroachDB URL, positive NATS inbound batch size, positive worker
  inbound batch size, and positive worker outbox batch size.
- `apps/workers` parses required runtime values from typed environment
  names: `AGENTIC_ORG_ENV`, `AGENTIC_ORG_ID`, `NATS_SERVERS`, `NATS_STREAM`,
  `NATS_DURABLE`, `NATS_INBOUND_BATCH_SIZE`, `COCKROACH_DATABASE_URL`,
  `WORKER_INBOUND_BATCH_SIZE`, and `WORKER_OUTBOX_BATCH_SIZE`. String
  values are trimmed, `NATS_SERVERS` is parsed as a comma-separated
  server list with no empty entries, and all batch sizes must be safe
  positive decimal integers.
- `apps/workers` treats any non-happy NATS consumer counter as degraded:
  failed, dead-lettered, invalid, payload-conflict,
  negative-acknowledged, or terminated messages.
- `apps/workers` exposes app-level composition factories that receive
  typed config plus already-constructed ports. The durable worker
  composition seam now binds a generic Cockroach executor into the
  `state-cockroach` adapter factory, then wires Cockroach-backed outbox
  and event-ingestion stores into the worker host. The first app-local
  Cockroach worker client now adapts a pooled process client to the
  generic `CockroachSqlClient` contract and proves direct query,
  transaction commit, rollback, rollback-after-commit-failure,
  SQLSTATE-based retry, ambiguous-commit preservation, and release
  semantics without importing a database driver into reusable packages.
- `apps/workers` has a first structured JSON telemetry sink. It writes
  stable runtime telemetry records with timestamp, event name, and the
  canonical worker/NATS attributes that the LGTM stack can later ingest
  through Alloy/Loki/Tempo/Mimir. The sink is app-local and still
  injected through the existing `WorkerRuntimeTelemetrySink` port.
- `apps/workers` has a first NATS process-connection seam. A
  process-provided NATS transport factory is adapted to generic
  publisher, pull-consumer, dead-letter publisher, readiness, and
  shutdown ports. The factory receives validated servers, stream,
  durable consumer, environment, and organization scope. Dead-letter
  subjects use the shared Organization subject builder, and dead-letter
  message IDs come from an injected factory so separate poison messages
  are not merged by transport dedupe. The durable composition root now
  builds the package-level NATS consumer from pull and dead-letter ports,
  so callers do not need to construct a consumer outside the app
  boundary.
- `apps/workers` has a first concrete NATS client-library factory behind
  that seam. `createNatsJsTransportConnectionFactory` uses
  `@nats-io/transport-node` and `@nats-io/jetstream` to connect, bind the
  configured stream and durable consumer, publish with message IDs and
  headers, fetch batches, adapt ack/nack/term operations, check durable
  consumer readiness, and close the process connection. The tests are
  fake-driven; live JetStream behavior remains a later integration proof.
- `apps/workers` has a first process readiness aggregate. Dependency
  probes return typed ready/not-ready checks, and the process readiness
  result becomes degraded when any dependency check is not ready or
  throws during readiness evaluation.
- `apps/workers` has a first process lifecycle entrypoint contract,
  not a long-running executable host yet. `createWorkerProcess` applies
  bootstrap steps once per process, checks readiness before runtime
  execution, skips runtime work on bootstrap/readiness failure, reuses
  the bootstrapped state across later cycles, and aggregates graceful
  shutdown results across process adapter ports.
- `apps/workers` has a first continuous-run loop wrapper for that
  process lifecycle. `createWorkerProcessLoop` repeatedly invokes the
  process through an injected delay port, observer port, and stop
  signal; captures iteration, observer, delay, degraded-result, and
  shutdown failures as loop evidence; and always attempts process
  shutdown. It is still a port-first app boundary, not a NestJS host or
  concrete binary.
- `apps/workers` has a first executable-boundary entrypoint contract
  above that loop. `createWorkerProcessEntrypoint` subscribes to typed
  stop signals through an injected signal source, delegates waiting to an
  injected sleeper, disposes signal subscriptions after shutdown, returns
  success or degraded exit intent instead of calling `process.exit`, and
  preserves the full loop result for telemetry, supervisor diagnosis, and
  future Kubernetes/NestJS process wrappers.
- `apps/workers` has an app-local Cockroach migration bootstrapper and
  Cockroach readiness probe. The bootstrapper reuses the generic
  Cockroach migration runner and ordered core migrations; the readiness
  probe checks durable-state availability through the generic SQL client
  without importing a database driver into reusable packages.
- `apps/workers` has a first optional `pg`-compatible live Cockroach
  pool adapter behind the existing generic worker pool contracts. The
  adapter is app-local, dynamically loaded, and fake-tested by default;
  the env-gated integration test uses it only when
  `AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` is present.
- `apps/workers` has the first env-gated live NATS proof. When
  `AGENTIC_ORG_NATS_INTEGRATION_SERVERS` is present, the test recreates
  a small per-run JetStream stream and durable consumer, publishes a
  canonical event through the worker adapter, consumes it through the
  generic ingestion port, acknowledges it, smoke-tests DLQ publishing,
  proves the invalid-envelope consumer DLQ path, checks readiness, and
  closes the generic NATS shutdown port.
- `apps/workers` has the first env-gated combined durable worker proof.
  When both `AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` and
  `AGENTIC_ORG_NATS_INTEGRATION_SERVERS` are present, the test writes a
  real `send_supervisor_signal` command outcome to Cockroach, runs the
  process worker loop for two cycles, publishes the durable outbox event
  to NATS, consumes it through the NATS consumer, records the inbox
  receipt and supervisor-triage reaction plan in Cockroach, captures
  worker/NATS telemetry records, proves the second cycle has no duplicate
  side effects, and shuts down both adapters through generic process
  shutdown ports or guarded cleanup.
- Worker-cycle failures can carry structured evidence. Stale outbox
  claim failures now preserve claim ID, current claim ID, outbox event
  ID, event ID, trace ID, and published-at evidence when the durable row
  can be found, and the worker runtime projects the first failure's
  evidence into telemetry attributes for diagnosis.
- The structured worker failure evidence keys live in the domain package
  as a neutral contract, so Cockroach adapters, worker hosts,
  observability projection, and tests share the same typed field names
  instead of re-declaring string keys package by package. Worker hosts
  only accept evidence bags whose keys are inside that domain contract,
  and worker-cycle telemetry uses a consistent
  `agentic.worker.failure.first_*` namespace for the first-failure
  projection.
- Observability projections now include policy decision ID and policy
  version in event span attributes and workflow visibility records when
  an accepted command emits a policy-backed event envelope.
- Policy-denial observations now project into UI- and agent-readable
  workflow visibility with `policy_denied` weak-point indicators,
  trace/log/metrics links, supervisor-chain context, and the denied
  command/tool/scope.

## Next Slice

The next slice is tracked in the canonical
[Phased Development Plan](./PHASED_DEVELOPMENT_PLAN.md). The fake-driven
process lifecycle contract now covers migration bootstrap, readiness
gating, and graceful shutdown at the port boundary. The Cockroach live
proof is env-gated: when a compatible URL and driver are present, the
same test command proves migrations, readiness, commit, rollback, and
shutdown against a real substrate. The NATS live proof is also
env-gated: when a JetStream server is supplied, the same test command
proves publish, consume, ack, invalid-envelope DLQ handling, readiness,
and shutdown through the app-local NATS seam. The combined durable
worker proof now ties both together when both env vars are present. The
first long-running worker loop wrapper and executable-boundary
entrypoint now exist as port-first contracts. Next is the next command
surface slice, then the concrete Node/NestJS host can wrap the same
entrypoint with real process globals. Keep URLs, credentials, and
connection pools in app adapter config fed by Kubernetes Secret or
ExternalSecret values, never in domain packages.

Do not make the next slice a pile of bespoke request commands. Build the
generic supervisor triage lifecycle first, then let specialized
lifecycles emerge behind triage.
