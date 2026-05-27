# Agentic Organization Workers App

`apps/workers` is the first runtime-host shell for Agentic
Organization. It is intentionally small and NodeNext-first so the
process boundary can be tested before NestJS, Kubernetes manifests, or
process supervisors are introduced. It now has the first durable
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
- connect a process-provided NATS transport factory into generic
  publisher, pull-consumer, dead-letter, readiness, and shutdown ports;
  the factory receives the validated server list, stream, durable
  consumer, environment, and organization scope;
- run the package-level Organization worker cycle;
- run the NATS JetStream consumer adapter cycle;
- pass configured NATS batch size, stream name, and durable consumer
  name into the adapter boundary;
- emit worker-cycle and NATS-consumer batch telemetry records;
- return a healthy/degraded runtime result that makes failures visible
  without starving the other loop.

## Boundary

`apps/workers` may bind adapter packages and process configuration.
Packages must not import this app.

The app currently receives ports that tests can fake:

- `OrganizationWorkerHost`;
- `NatsJetStreamEventConsumer`;
- `WorkerRuntimeTelemetrySink`.

`composeDurableWorkerRuntimePorts` is the first durable app seam. It
binds a generic Cockroach executor into the reusable
`state-cockroach` adapter factory, then wires Cockroach-backed outbox and
event-ingestion stores into the package-level worker host. Future
concrete process wiring can bind the same ports to a real Cockroach
connection pool, NATS, OTLP/logging, health checks, readiness checks,
and graceful shutdown without changing runtime rule evaluation.

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
- `WORKER_OUTBOX_BATCH_SIZE`.

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
readiness, and shutdown. Today tests still use fake clients; the later
NATS integration proof must exercise a real server, stream, durable
consumer, credentials/TLS if enabled, and ack timing.
