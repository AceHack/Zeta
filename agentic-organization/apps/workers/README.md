# Agentic Organization Workers App

`apps/workers` is the first runtime-host contract shell for Agentic
Organization. It is intentionally small and NodeNext-first so the
process boundary can be tested before a long-running executable host,
NestJS, Kubernetes manifests, or process supervisors are introduced. It
now has the first durable
Cockroach composition seam plus the app-local NATS connection seam, but
the actual Cockroach and NATS vendor clients remain outer process
adapter concerns.

Dependencies are installed from the repository root with Bun. The
`agentic-organization/package.json` file carries only local Node test
scripts for this subsystem; dependency versions live in the root
`package.json` and `bun.lock` so CI and local development exercise one
lock source.

## Responsibility

The app composes existing packages. It does not own business rules.

Current duties:

- parse typed runtime configuration from process environment values that
  Kubernetes can later provide through ConfigMaps and Secrets;
- compose the runtime through a single app-level factory so concrete
  adapters stay outside domain and package code;
- compose the durable Cockroach adapter set through one generic SQL
  executor;
- run Cockroach core migrations through an app-local bootstrapper before
  the worker runtime is allowed to start;
- check Cockroach and NATS readiness through typed dependency probes
  before consuming runtime capacity;
- connect a process-provided NATS transport factory into generic
  publisher, pull-consumer, dead-letter, readiness, and shutdown ports;
  the factory receives the validated server list, stream, durable
  consumer, environment, and organization scope;
- run the package-level Organization worker cycle;
- run the NATS JetStream consumer adapter cycle;
- run the process lifecycle repeatedly through a port-first loop wrapper
  when the future executable host needs continuous operation;
- bind the process lifecycle loop to app-local signal, delay, observer,
  and exit-intent ports without calling process globals directly;
- pass configured NATS batch size, stream name, and durable consumer
  name into the adapter boundary;
- run the reaction-plan executor lane through a generic action executor
  port so durable reaction plans become self-fulfilling work attempts;
- emit worker-cycle and NATS-consumer batch telemetry records;
- return a healthy/degraded runtime result that makes failures visible
  without starving the other loop.
- aggregate shutdown across process adapter ports without hiding which
  dependencies closed successfully.

## Boundary

`apps/workers` may bind adapter packages and process configuration.
Packages must not import this app.

The app currently receives ports that tests can fake:

- `OrganizationWorkerHost`;
- `NatsJetStreamEventConsumer`;
- `WorkerRuntimeTelemetrySink`.

`composeDurableWorkerRuntimePorts` is the first durable app seam. It
binds a generic Cockroach executor into the reusable
`state-cockroach` adapter factory, then wires Cockroach-backed outbox,
event-ingestion, and reaction-plan work-queue stores into the
package-level worker host. The reaction action executor is injected as a
port so concrete supervisor-triage, assignment, review-gate, and future
Organization actions can evolve without making Cockroach or NATS types
visible to application packages. Future concrete process wiring can bind
the same ports to a real Cockroach connection pool, NATS, OTLP/logging,
health checks, readiness checks, and graceful shutdown without changing
runtime rule evaluation.
`createWorkerProcess` is the first process lifecycle entrypoint
contract, not a long-running executable host yet. It applies
bootstrappers such as Cockroach migrations once per process, checks
readiness before each runtime cycle, runs one worker runtime cycle only
when dependencies are ready, and aggregates graceful shutdown results
across generic shutdown ports.
`createWorkerProcessLoop` is the next app-local wrapper around that
process lifecycle. It repeatedly calls `runOnce()` until a stop signal or
bounded test cycle limit is reached, waits through an injected delay
port, records each iteration through an observer port, captures thrown
iteration, observer, delay, and shutdown failures as loop evidence, and
always attempts process shutdown. It is still not a concrete binary or
NestJS host; it is the testable continuous-run contract the binary will
use.
`createWorkerProcessEntrypoint` is the app-local executable-boundary
contract above the loop. It subscribes to injected stop signals such as
`SIGINT` and `SIGTERM`, delegates waiting to an injected sleeper, returns
success/degraded exit intent, disposes signal subscriptions after the
loop shuts down, and keeps the real Node process, NestJS host, or
Kubernetes supervisor outside the reusable worker packages.

## Environment

The worker app owns process configuration. Packages receive typed
config and ports; they do not read environment variables.

Required runtime values:

- `AGENTIC_ORG_ENV`;
- `AGENTIC_ORG_ID`;
- `COCKROACH_DATABASE_URL`;
- `NATS_SERVERS`;
- `NATS_STREAM`;
- `NATS_DURABLE`;
- `NATS_INBOUND_BATCH_SIZE`;
- `WORKER_INBOUND_BATCH_SIZE`;
- `WORKER_OUTBOX_BATCH_SIZE`;
- `WORKER_REACTION_PLAN_BATCH_SIZE`;
- `WORKER_REACTION_PLAN_LEASE_MS`.

URLs, credentials, and other sensitive adapter settings are process
configuration owned by this app boundary. In the full AI cluster,
`NATS_SERVERS` can be supplied from service discovery or ConfigMap when
it is not sensitive. NATS credentials, Cockroach URLs, and other secret
inputs must come from Kubernetes Secrets or ExternalSecrets, not from
domain packages.

## Composition Root

`composeWorkerRuntime` is the app-level seam where already-constructed
ports are connected to the runtime. `composeDurableWorkerRuntimePorts`
is the app-level seam where Cockroach-backed state adapters are built
from a generic SQL executor and connected to the worker host.
`createCockroachMigrationBootstrapper` wraps the existing Cockroach core
migration runner as a process bootstrapper, and
`createCockroachReadinessProbe` checks durable-state availability
through the generic SQL client before the runtime runs. The Cockroach
worker client also exposes a pool shutdown adapter when the
process-provided pool supports `end()`.
`createPgCockroachWorkerPool` is the first optional live-driver binding
for that pool contract. It dynamically loads a `pg`-compatible driver at
the app boundary, adapts `Pool.connect()`, `client.query()`,
`client.release()`, and `Pool.end()` to the generic worker pool
interfaces, and keeps the reusable state packages free of driver
imports.
`connectNatsWorkerAdapters` is the app-level seam where a process
transport factory becomes the generic NATS publisher, pull-consumer,
dead-letter publisher, readiness probe, and shutdown port. Dead-letter
subjects use the shared Organization subject builder, scoped by
environment and organization, and dead-letter message IDs come from an
injected factory so distinct poison messages do not collapse behind one
transport dedupe key. `createNatsJsTransportConnectionFactory` is the
first concrete NATS client-library binding behind that seam. It uses
`@nats-io/transport-node` for the Node connection and
`@nats-io/jetstream` for publish, durable pull-consumer fetch,
readiness, and shutdown. The normal tests still use fake clients, while
the env-gated NATS integration proof exercises a real server, stream,
durable consumer, publish path, pull path, ack, invalid-envelope DLQ
handling, readiness, and shutdown.

## Integration Tests

The normal test suite is fake-driven and does not require live cluster
services. Live proofs are skipped unless their environment variables are
present.

The Cockroach integration proof is env-gated:

- set `AGENTIC_ORG_COCKROACH_INTEGRATION_DATABASE_URL` to a
  CockroachDB/PostgreSQL-compatible connection URL;
- use the root dependency graph, which declares the `pg` driver used by
  the default app-local pool adapter;
- run the regular `npm test` command from `agentic-organization/`.

The NATS integration proof is env-gated:

- set `AGENTIC_ORG_NATS_INTEGRATION_SERVERS` to one or more comma-
  separated NATS server URLs with JetStream enabled;
- ensure the test process can create and delete per-run streams and
  durable consumers prefixed by `AGENTIC_ORG_INTEGRATION_EVENTS` and
  `agentic-org-integration-worker`;
- run the regular `npm test` command from `agentic-organization/`.

When the Cockroach env var is present, the test applies Organization
migrations, checks readiness, proves commit and rollback behavior
through the generic SQL executor, and verifies graceful pool shutdown
through the generic process shutdown port. When the NATS env var is
present, the test recreates a small per-run integration stream and
durable consumer, publishes a canonical event through the worker
adapter, consumes it through the generic ingestion port, acknowledges
it, smoke-tests invalid-envelope DLQ handling, and closes the generic
NATS shutdown port.
The Cockroach proof also uses a per-run probe table prefixed by
`agentic_org_integration_probe` and drops it before pool shutdown so a
shared dev database is not polluted by successful runs.

The combined durable worker proof is gated by both env vars. When both
are present, it applies migrations, persists a
`send_supervisor_signal` command outcome through the Cockroach-backed
state-store factory, recreates a per-run NATS stream and durable
consumer, runs one worker process cycle, publishes the outbox event,
consumes it back through the NATS consumer, records the inbox receipt
and supervisor-triage reaction plan in Cockroach, records worker/NATS
telemetry through the sink port, cleans up the per-run rows and stream,
and closes NATS plus Cockroach through generic shutdown ports.
