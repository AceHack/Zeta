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
| `policy`          | generic command authorization port, hat-authority port, decision observation port, and typed denial reasons                |
| `state`           | generic state-store and outbox-source ports plus the in-memory Organization state-store factory fake                       |
| `state-cockroach` | first replaceable durable SQL adapter for the state-store/outbox-source ports, backed by CockroachDB                       |
| `messaging`       | NATS subject contract, outbox publisher port, event publisher port, and domain resolver without a live NATS dependency     |
| `messaging-nats`  | NATS JetStream publisher and consumer adapter contracts with canonical JSON, headers, ack/nack, and DLQ policy             |
| `observability`   | LGTM/OpenTelemetry attribute projection from Agentic event envelopes and NATS consumer batch summaries                     |
| `runtime`         | first event-to-automation reaction rule                                                                                    |
| `workers`         | process-boundary worker host that composes outbox publishing and inbound ingestion through ports only                      |
| `governance`      | package dependency-boundary checks that keep core packages SOLID and adapter-free                                          |

## Slice Rule

The first slice proves this path:

```text
supervisor-chain signal command
  -> command authorization policy
  -> active hat-authority check
  -> denied policy decision observation, when denied
  -> idempotency check
  -> chain communication record
  -> audit event
  -> outbox event
  -> outbox publisher
  -> NATS JetStream event publisher adapter
  -> NATS JetStream event consumer adapter
  -> NATS subject / telemetry contract
  -> event ingestion processor
  -> inbox receipt / consumer dedupe
  -> persisted reaction plans
  -> worker host run-once cycle
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

The application package also receives a `CommandAuthorizationPort` and a
`PolicyDecisionObservationPort`. Every command is authorized before
idempotency lookup or handler dispatch. The first policy implementation
delegates to a generic `HatAuthorityPort`; active authority allows the
command, while expired, missing, revoked, scope-denied, or tool-denied
authority returns a typed `policy_denied` result without writing
business command state. Denied decisions are observed through the policy
observation port, and allowed decisions are projected onto audit and
outbox effects before durable command persistence. Future OPA,
hat-system, JWT, Organization DB, or policy-observation adapters must
implement these ports instead of leaking vendor clients into command
code.

Production source and test source are separated by package. Application
code lives under `packages/<name>/src`; tests live under
`packages/<name>/test`. The governance package enforces that `*.test.ts`
files do not land in production `src` trees.

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

The NATS consumer adapter owns live transport policy. It fetches a
bounded batch from a pull-consumer port, decodes canonical event
envelopes, calls the runtime event-ingestion processor, and then chooses
the transport action. Processed and duplicate messages are acknowledged.
Invalid envelopes and same-event payload conflicts are terminated and
published to a dead-letter port. Transient ingestion failures are
negative-acknowledged for retry. Runtime rule evaluation does not know
about ack, nack, termination, backoff, or DLQ mechanics.

The event ingestion processor owns the generic consume loop after a
transport adapter has decoded a canonical event envelope. It checks an
inbox receipt before evaluating rules, records the receipt and generated
reaction plans through one store operation, and returns duplicate
without re-running rules when the same event reaches the same consumer
again. If the same event ID reaches the same consumer with a different
payload hash, the processor returns a payload-conflict outcome instead
of hiding the drift. Live NATS consumers will bind to this processor
later.

The worker host composes the outbox publisher and inbound event
ingestion processor behind a small run-once boundary. It does not know
about live NATS clients, CockroachDB clients, NestJS modules, Temporal,
or Dapr. Future runtime processes should provide concrete ports from the
composition layer and use the returned idle/worked/degraded cycle
summary for logs, metrics, health checks, and UI-visible workflow
telemetry. A failed outbox or inbound lane is reported as degraded
instead of hiding the failure or starving the other lane.

`InboundEventSource` is intentionally only a replayable pull port in
this package. Live NATS ack, nack, checkpoint, backoff, and DLQ behavior
belongs in the NATS consumer adapter so transport policy does not leak
into runtime rule evaluation.

## Validation

Run the package tests from `agentic-organization/`:

```powershell
npm test
```

The test command uses Node's built-in test runner and TypeScript type
stripping:

```text
node --experimental-strip-types --test packages/*/test/**/*.test.ts apps/*/test/**/*.test.ts
```

This is a deliberate NodeNext starting point so the package contracts
can run without requiring Bun to be installed on a cluster maintainer's
shell.
