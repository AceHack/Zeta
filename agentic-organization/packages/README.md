# Agentic Organization Packages

These packages are the first executable slice of Agentic Organization.
They are intentionally small and run as a NodeNext TypeScript island
before any NestJS host, live NATS connection, Temporal worker, Dapr actor
host, or Kubernetes deployment is introduced.

## Package Boundary

| Package           | Current responsibility                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `domain`          | typed command names, event names, aggregate names, work item state machine, event envelope, shared records                 |
| `application`     | command pipeline, handler registry, idempotency handling, state-store ports, first supervisor-chain signal command handler |
| `state`           | generic state-store and outbox-source ports plus the in-memory Organization state-store factory fake                       |
| `state-cockroach` | first replaceable durable SQL adapter for the state-store/outbox-source ports, backed by CockroachDB                       |
| `messaging`       | NATS subject contract, outbox publisher port, event publisher port, and domain resolver without a live NATS dependency     |
| `messaging-nats`  | NATS JetStream event publisher adapter contract with canonical JSON payloads, headers, and message IDs                     |
| `observability`   | LGTM/OpenTelemetry attribute projection from Agentic event envelopes                                                       |
| `runtime`         | first event-to-automation reaction rule                                                                                    |
| `governance`      | package dependency-boundary checks that keep core packages SOLID and adapter-free                                          |

## Slice Rule

The first slice proves this path:

```text
supervisor-chain signal command
  -> idempotency check
  -> chain communication record
  -> audit event
  -> outbox event
  -> outbox publisher
  -> NATS JetStream event publisher adapter
  -> NATS subject / telemetry contract
  -> automation reaction plan
```

CockroachDB, JetStream publishing, Temporal, Dapr, Hermes, Hindsight,
and the hat-system CRDs come next as adapters behind these contracts.
They should not redefine command names, event names, state names,
correlation fields, or policy authority. CockroachDB is the first
durable state adapter because it exists in `full-ai-cluster`; application
and messaging code must remain database-agnostic so a later durable
store can replace it behind the same ports.

The application package must not construct concrete state adapters.
Runtime hosts and tests provide a `CommandStateStoreFactory`; the state
package implements the current in-memory factory. Command routing uses a
handler registry so new commands add handlers instead of editing a
central `switch` or `if` dispatcher.

`CommandStateStore` and `OutboxEventSource` are async even when backed
by in-memory fakes. Durable adapters must not be squeezed into a
synchronous toy shape.

The outbox publisher owns the generic publish loop: claim unpublished
outbox rows from the generic state port, resolve a typed Organization
domain, publish through an `EventPublisher` port, and mark the outbox
row published only after the publish returns successfully. The NATS
package implements that publisher port and is the only package in this
slice that knows about NATS headers, message IDs, and JSON transport
payloads. State adapters must not import messaging adapters.

## Validation

Run the package tests from `agentic-organization/`:

```powershell
npm test
```

The test command uses Node's built-in test runner and TypeScript type
stripping:

```text
node --experimental-strip-types --test packages/**/*.test.ts
```

This is a deliberate NodeNext starting point so the package contracts
can run without requiring Bun to be installed on a cluster maintainer's
shell.
