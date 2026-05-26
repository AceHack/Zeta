# Agentic Organization Workers App

`apps/workers` is the first runtime-host shell for Agentic
Organization. It is intentionally small and NodeNext-first so the
process boundary can be tested before NestJS, real NATS clients,
CockroachDB connection pools, Kubernetes manifests, or process
supervisors are introduced.

## Responsibility

The app composes existing packages. It does not own business rules.

Current duties:

- parse typed runtime configuration from process environment values that
  Kubernetes can later provide through ConfigMaps and Secrets;
- compose the runtime through a single app-level factory so concrete
  adapters stay outside domain and package code;
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

Future concrete process wiring can bind these ports to CockroachDB,
NATS, OTLP/logging, health checks, readiness checks, and graceful
shutdown without changing runtime rule evaluation.

## Environment

The worker app owns process configuration. Packages receive typed
config and ports; they do not read environment variables.

Required runtime values:

- `AGENTIC_ORG_ENV`;
- `AGENTIC_ORG_ID`;
- `NATS_STREAM`;
- `NATS_DURABLE`;
- `NATS_INBOUND_BATCH_SIZE`.

URLs, credentials, and other sensitive adapter settings belong in later
adapter config bound by the composition root. They should come from
Kubernetes Secrets or ExternalSecrets in the full AI cluster, not from
domain packages.

## Composition Root

`composeWorkerRuntime` is the app-level seam where already-constructed
ports are connected to the runtime. Today tests provide fake ports. The
next production slice should construct real CockroachDB, NATS, and
telemetry adapters here while preserving the same package contracts.
