## Purpose

Agentic Organization defines the command, event, state, idempotency,
telemetry, and automation substrate for an agent-run Organization Work
OS. It is the business runtime above the full-ai-cluster substrate.

## Requirements

### Requirement: Lifecycle primitives are generic and expandable

Agentic Organization MUST prefer generic lifecycle primitives over
hardcoded one-off request tools.

#### Scenario: Agent discovers a repeated coordination need

- **WHEN** an agent discovers that its current hat tools are not enough
  for repeated work
- **THEN** the agent uses supervisor-chain communication to surface the
  need
- **AND** the target supervisor triages whether it should become a new
  tool, prompt flow, routing rule, review gate, or specialized
  lifecycle
- **AND** any new tool or flow is activated only after the required
  review, security, implementation, and outcome-review gates

### Requirement: Commands are the only business authority

Organization runtime hosts and adapters MUST change authoritative
Organization state only by calling Organization commands.

#### Scenario: Hat sends a supervisor signal

- **WHEN** a runtime host sends a supervisor-chain signal on behalf of
  a hat wearer
- **THEN** the request is handled by the Organization command pipeline
- **AND** the command creates supervisor-signal state, audit, outbox,
  and idempotency records together
- **AND** the adapter does not mutate authoritative state directly

#### Scenario: Command handler returns effects instead of writing state

- **WHEN** a command handler accepts a valid command
- **THEN** it returns the command result plus typed command effects
- **AND** the handler does not call state append operations directly
- **AND** the command pipeline records the result and effects through a
  single command outcome port

#### Scenario: Command pipeline is composed from ports

- **WHEN** a runtime host creates a command pipeline
- **THEN** it supplies a command-state-store factory and command-handler
  registry through ports
- **AND** it supplies a command-authorization port through ports
- **AND** the pipeline does not construct a concrete in-memory store
  directly
- **AND** the pipeline does not use a central command-type switch for
  extensible command dispatch
- **AND** command-state-store operations are async so real persistence
  adapters can perform I/O without changing command contracts

#### Scenario: Command policy runs before command effects

- **WHEN** any API, MCP, Hermes, worker, Temporal, or Dapr entrypoint
  submits an Organization command
- **THEN** the command pipeline authorizes the command through a generic
  command-authorization port before idempotency lookup, handler dispatch,
  or state persistence
- **AND** active hat authority allows the command to continue
- **AND** expired, missing, revoked, scope-denied, or tool-denied hat
  authority rejects the command with a typed policy-denied error
- **AND** the denied decision is observed through a policy decision
  observation port
- **AND** no supervisor-signal, business audit, outbox, or idempotency
  state is recorded for the denied command

#### Scenario: Allowed policy decisions are attached to command effects

- **WHEN** a command is allowed and produces audit and outbox effects
- **THEN** the command pipeline attaches the policy decision ID and
  policy version to audit events and outbox event envelopes before
  command outcome persistence
- **AND** durable state adapters persist policy decision evidence without
  exposing database-specific fields to application code

#### Scenario: Denial observation failure stays rejected

- **WHEN** a command is denied by policy
- **AND** the policy decision observation port fails
- **THEN** the command is rejected with a typed policy-observation-failed
  error
- **AND** the command handler is not executed
- **AND** idempotency lookup and command outcome persistence are not run

#### Scenario: Package boundaries are checked

- **WHEN** package dependency-boundary tests run
- **THEN** application source files are checked for forbidden imports of
  concrete state adapters, Cockroach adapters, NestJS, NATS, Dapr,
  Temporal, Drizzle, Postgres, or other runtime clients
- **AND** a violation fails the test suite before the boundary can drift
- **AND** state adapter source files are checked for forbidden imports
  of runtime implementation packages, messaging, NATS, JetStream, or
  other event transport clients
- **AND** policy source files are checked for forbidden imports of
  application, runtime, state adapter, messaging adapter, NestJS, NATS,
  Dapr, Temporal, Drizzle, Postgres, OPA, or other vendor clients

#### Scenario: Tests are kept out of production source trees

- **WHEN** package source-layout governance tests run
- **THEN** production source directories are scanned for `*.test.ts`
  files
- **AND** every package keeps implementation code under
  `packages/<name>/src`
- **AND** every package keeps tests under `packages/<name>/test`
- **AND** a test file inside a production source tree fails the suite

### Requirement: Commands are idempotent

Organization commands MUST use deterministic idempotency keys at the
command boundary.

#### Scenario: Durable core state schema exists

- **WHEN** the first durable state migration contract is loaded
- **THEN** it declares work item, supervisor signal, audit event,
  outbox event, and idempotency record tables
- **AND** outbox rows include trace ID, correlation ID, and canonical
  envelope JSON fields for later NATS publication and workflow
  visibility

#### Scenario: Durable state adapter is replaceable

- **WHEN** application or messaging package source is inspected
- **THEN** it does not import CockroachDB, Drizzle, Postgres, or
  database-client packages
- **AND** it depends on generic state and outbox-source ports instead
- **AND** CockroachDB is treated as the first replaceable durable adapter
  for the cluster, not as the application model

#### Scenario: Vendor-specific adapters stay behind generic ports

- **WHEN** application, runtime, worker, or messaging package source is
  inspected
- **THEN** it does not import vendor-specific adapter packages or vendor
  clients directly
- **AND** vendor packages implement generic Organization ports exposed by
  non-vendor packages
- **AND** vendor-specific executor or transaction seams are not used as
  application contracts

#### Scenario: Matching replay

- **WHEN** a command is submitted twice with the same idempotency key
  and request hash
- **THEN** the second execution returns the stored result
- **AND** no duplicate supervisor signal, audit event, or outbox event is
  created

#### Scenario: Conflicting replay

- **WHEN** a command is submitted with an idempotency key that already
  exists for a different request hash
- **THEN** the command is rejected with a typed idempotency conflict
- **AND** no new authoritative state is created

#### Scenario: Command outcome persistence fails

- **WHEN** a new command produces supervisor-signal, audit, and outbox
  effects
- **AND** the command outcome store cannot persist the full outcome
- **THEN** no piecemeal command writes are performed by the application
  layer
- **AND** durable adapters are responsible for committing or rolling
  back the full command outcome atomically

### Requirement: Events carry traceable envelopes

Organization domain events MUST carry a canonical envelope with command,
actor, hat, scope, aggregate, replay, and trace fields.

#### Scenario: Supervisor signal event is created

- **WHEN** a supervisor signal event is written to the outbox
- **THEN** the event includes event ID, event type, schema version,
  occurred-at timestamp, actor agent ID, hat assignment ID,
  organization ID, project ID, team ID, work item ID, aggregate ID,
  aggregate type, aggregate version, command ID, correlation ID,
  causation ID, trace ID, and idempotency key
- **AND** the event is replay-aware

### Requirement: Hats expose clear communication lines

Hats MUST expose a communication brief that tells the wearer their
duty, supervisor line, available upward tools, when to use each tool,
and required evidence.

#### Scenario: Hat receives its communication brief

- **WHEN** a hat context is prepared for an agent
- **THEN** the context includes the hat duty statement
- **AND** the context identifies the next supervisor level and target
  supervisor hat
- **AND** the context lists typed upward tools such as ask question,
  report blocker, request decision, request resource, request review,
  report risk, suggest improvement, and request escalation
- **AND** every tool explains when to use it and what evidence to
  include
- **AND** the tool list is treated as an evolvable hat capability, not a
  closed taxonomy

### Requirement: Work state transitions are typed

Work item state transitions MUST be represented by typed states and
validated by a state machine.

#### Scenario: Illegal transition

- **WHEN** a work item attempts to transition directly from `new` to
  `approved`
- **THEN** the transition is rejected

### Requirement: Messaging subjects are stable

Organization NATS subjects MUST use a stable organization-scoped shape.

#### Scenario: Work event subject is built

- **WHEN** a work event is prepared for NATS publication
- **THEN** the subject shape is
  `agentic-org.<environment>.<organization>.<domain>.<event-type>`

### Requirement: Outbox publisher is idempotent and adapter-backed

Organization outbox publication MUST be driven by a generic publisher
and a concrete event-publisher adapter.

#### Scenario: Outbox event is published

- **WHEN** unpublished outbox events are claimed
- **THEN** the publisher resolves the typed Organization messaging
  domain and builds the stable NATS subject
- **AND** the publisher sends the event through an `EventPublisher` port
- **AND** the outbox row is marked published only after the publish
  succeeds

#### Scenario: NATS adapter publishes event

- **WHEN** the NATS JetStream adapter publishes an event publication
- **THEN** it sends the canonical event envelope as JSON
- **AND** it uses the event ID as the message ID
- **AND** it includes typed headers for event ID, event type,
  correlation ID, causation ID, trace ID, idempotency key, and outbox
  event ID

#### Scenario: NATS adapter consumes a valid event

- **WHEN** the NATS JetStream consumer adapter fetches a message with a
  canonical event envelope
- **THEN** it decodes the envelope and sends it to the event ingestion
  processor
- **AND** a processed event is acknowledged
- **AND** a duplicate event is acknowledged without treating it as a
  transport failure

#### Scenario: NATS adapter handles invalid or conflicting events

- **WHEN** the NATS JetStream consumer adapter receives an invalid
  envelope
- **THEN** runtime ingestion is not called
- **AND** the message is terminated and published to the dead-letter
  port with an invalid-envelope reason
- **WHEN** runtime ingestion reports a payload conflict
- **THEN** the message is terminated and published to the dead-letter
  port with a payload-conflict reason

#### Scenario: NATS adapter retries transient ingestion failures

- **WHEN** the event ingestion processor throws while handling a valid
  envelope
- **THEN** the NATS JetStream consumer adapter negative-acknowledges the
  message for retry
- **AND** the runtime rule processor does not know about NATS ack, nack,
  termination, backoff, or DLQ mechanics

#### Scenario: NATS adapter falls back when dead-letter handling fails

- **WHEN** the NATS JetStream consumer adapter receives an invalid
  envelope or payload-conflict result
- **AND** publishing to the dead-letter port or terminating the source
  message fails
- **THEN** the adapter records the failure and negative-acknowledges the
  source message for retry
- **AND** later messages in the fetched batch can still be processed

### Requirement: Inbound events are deduped before automation

Organization event consumers MUST record inbox receipts before
automation side effects and MUST persist reaction plans instead of
executing privileged work directly.

#### Scenario: New event is ingested by an automation consumer

- **WHEN** a decoded canonical event envelope reaches the runtime event
  ingestion processor
- **THEN** the processor checks for an inbox receipt by event ID and
  consumer name
- **AND** a missing receipt allows rule evaluation
- **AND** the processor records the inbox receipt and generated reaction
  plans through one store operation
- **AND** the reaction plans preserve the triggering event ID, target
  scope, required hat, action type, and reason

#### Scenario: Duplicate event is ingested by an automation consumer

- **WHEN** the same event ID reaches the same consumer again after the
  original receipt has a completed result
- **THEN** the processor returns a duplicate outcome
- **AND** no automation rules are re-evaluated
- **AND** no duplicate reaction plans are created

#### Scenario: Unprocessed receipt is retried by an automation consumer

- **WHEN** the same event ID and payload hash reaches the same consumer
  but the existing receipt has no completed result
- **THEN** the processor treats the receipt as recoverable pending work
- **AND** automation rules are re-evaluated
- **AND** the receipt and generated reaction plans are recorded through
  the normal event-processing outcome port

#### Scenario: Conflicting event payload is ingested by an automation consumer

- **WHEN** the same event ID reaches the same consumer with a different
  payload hash
- **THEN** the processor returns a payload-conflict outcome
- **AND** no automation rules are re-evaluated
- **AND** no duplicate reaction plans are created

#### Scenario: Durable state schema supports inbound event dedupe

- **WHEN** the durable state migration contract is loaded
- **THEN** it declares inbox receipt storage keyed by event ID and
  consumer name
- **AND** it declares reaction plan storage for generated automation
  plans
- **AND** reaction plans include a persisted status

#### Scenario: Durable event-ingestion adapter uses one transaction boundary

- **WHEN** a durable event-ingestion adapter records an event-processing
  outcome
- **THEN** the inbox receipt, generated reaction plans, and processed
  marker are submitted inside one transaction boundary
- **AND** the processed marker must return the claimed receipt before the
  adapter reports the outcome as processed
- **AND** runtime rule processors do not receive database transaction
  objects

#### Scenario: Durable event-ingestion adapter loses receipt claim race

- **WHEN** a durable event-ingestion adapter attempts to record reaction
  plans after another consumer has already completed the same receipt
- **THEN** the adapter returns a duplicate event-processing outcome
  through the generic event-ingestion port
- **AND** it does not insert reaction plans
- **AND** it does not mark the completed receipt again

#### Scenario: Durable event-ingestion adapter loses completion race

- **WHEN** a durable event-ingestion adapter claims a pending receipt but
  the final processed marker no longer matches a pending receipt
- **THEN** the adapter rolls back generated reaction plans
- **AND** it returns a duplicate event-processing outcome through the
  generic event-ingestion port
- **AND** runtime code does not receive database transaction objects or
  vendor-specific update-count errors

#### Scenario: Durable command adapter uses one transaction boundary

- **WHEN** a durable command adapter records a command outcome
- **THEN** the idempotency record, command state, audit events, and
  outbox events are submitted inside one transaction boundary
- **AND** the idempotency record is reserved before effect rows are
  submitted inside that boundary
- **AND** application handlers do not receive database transaction
  objects

#### Scenario: Durable command adapter loses idempotency claim race

- **WHEN** a durable command adapter attempts to record a command
  outcome after another transaction has already claimed the same
  idempotency key
- **THEN** it returns a generic replay or idempotency-conflict result
  through the command outcome port
- **AND** it does not insert duplicate supervisor signal, audit event, or
  outbox rows
- **AND** application code does not receive vendor-specific duplicate
  key errors or transaction objects

### Requirement: Worker process boundary composes event loops through ports

Organization worker code MUST remain a small composition boundary until
live infrastructure adapters are bound by a runtime host.

#### Scenario: Worker runs one bounded cycle

- **WHEN** the worker host is asked to run once
- **THEN** it publishes at most one bounded outbox batch through an
  outbox publisher port
- **AND** it pulls at most one bounded inbound batch through an inbound
  event source port
- **AND** it sends each decoded event envelope through the event
  ingestion processor
- **AND** it returns a cycle summary with outbox status, inbound pulled
  count, processed count, duplicate count, payload-conflict count,
  failed count, reaction-plan count, and failure details
- **AND** it reports idle only when no outbox events are published and
  no inbound events are pulled

#### Scenario: Worker reports degraded lanes without starving other lanes

- **WHEN** the outbox lane fails during a worker cycle
- **THEN** the worker still attempts the inbound ingestion lane
- **AND** the cycle result reports a degraded status with the outbox
  failure message
- **AND** inbound processing counts remain visible
- **WHEN** one inbound event fails during ingestion
- **THEN** later inbound events in the same batch are still attempted
- **AND** the cycle result reports failed inbound count and failure
  details

#### Scenario: Worker source remains adapter-free

- **WHEN** package dependency-boundary tests inspect worker source
- **THEN** worker source is checked for forbidden imports of the
  Cockroach adapter, NATS adapter, NestJS, NATS, Dapr, Temporal,
  Drizzle, Postgres, or other concrete runtime clients
- **AND** concrete process concerns are left for `apps/workers` or
  adapter packages

#### Scenario: Workers app composes process loops

- **WHEN** the `apps/workers` runtime host is asked to run once
- **THEN** it runs the package-level Organization worker cycle
- **AND** it runs the NATS consumer adapter cycle with the configured
  inbound batch size
- **AND** it records worker-cycle telemetry and NATS-consumer batch
  telemetry through a telemetry sink port
- **AND** it reports healthy only when both loops complete without
  degraded worker status, NATS failures, or dead letters

#### Scenario: Workers app parses process environment

- **WHEN** the `apps/workers` runtime host parses process environment
  values
- **THEN** it reads `AGENTIC_ORG_ENV`, `AGENTIC_ORG_ID`, `NATS_STREAM`,
  `NATS_DURABLE`, and `NATS_INBOUND_BATCH_SIZE` through typed env names
- **AND** it returns typed runtime configuration for the composition root
- **AND** packages do not read process environment values directly
- **AND** URLs, credentials, and connection pools remain process adapter
  concerns supplied through Kubernetes Secret or ExternalSecret backed
  configuration later

#### Scenario: Workers app composes adapter ports

- **WHEN** the `apps/workers` composition root is created
- **THEN** it receives typed runtime config plus already-constructed
  worker, NATS consumer, and telemetry ports
- **AND** the composition root returns a runnable worker runtime without
  leaking concrete adapter construction into package code

#### Scenario: Workers app rejects invalid process config

- **WHEN** the `apps/workers` runtime host is created with missing
  environment, missing Organization ID, missing NATS stream, missing
  durable consumer, or non-positive NATS inbound batch size
- **THEN** runtime creation fails with a typed configuration error before
  any worker loop can start

#### Scenario: Workers app keeps loops visible when one loop fails

- **WHEN** the package-level worker cycle throws
- **THEN** the `apps/workers` runtime host still attempts the NATS
  consumer cycle
- **AND** the runtime result reports degraded status with a typed
  organization-worker failure stage
- **WHEN** telemetry recording throws after a worker or NATS consumer
  cycle succeeds
- **THEN** the successful cycle result remains visible in the runtime
  result
- **AND** the runtime result reports degraded status with a typed
  telemetry failure stage
- **WHEN** the NATS consumer cycle reports failed or dead-lettered
  messages
- **THEN** the runtime result reports degraded status without hiding the
  batch counts
- **AND** invalid, payload-conflict, negative-acknowledged, or
  terminated NATS messages also make the runtime result degraded

### Requirement: Telemetry is complete at the event boundary

Organization packages MUST expose OpenTelemetry-compatible attributes
for the full trace chain before live LGTM ingestion is wired.

#### Scenario: Event is projected to span attributes

- **WHEN** an event envelope is projected to telemetry
- **THEN** the attributes include event, command, correlation,
  causation, trace, idempotency, actor, hat assignment, organization,
  project, work item, aggregate, policy decision ID, policy version,
  and NATS destination fields

#### Scenario: NATS consumer batch is projected to telemetry

- **WHEN** a NATS consumer batch result is projected to telemetry
- **THEN** the attributes include messaging system, stream, durable
  consumer, received count, processed count, duplicate count,
  payload-conflict count, invalid count, failed count, acknowledged
  count, negative-acknowledged count, terminated count, and
  dead-lettered count

### Requirement: Workflow visibility records expose weak points

Organization packages MUST project meaningful workflow movement into a
UI- and agent-readable visibility record.

#### Scenario: Event is projected to workflow visibility

- **WHEN** an event envelope is projected into workflow visibility
- **THEN** the record includes observation kind, health state, workflow
  stage, occurred-at timestamp, event, command, correlation, causation,
  trace, idempotency, actor, hat assignment, organization, project,
  work item, aggregate, policy decision ID, policy version, and
  evidence-link fields
- **AND** the record can include typed weak-point indicators such as
  blocked work, slow triage, repeated failure, missing evidence, missing
  tool, policy denial, harness failure, and telemetry gap
- **AND** the weak-point indicators route follow-up work through normal
  Organization commands and supervisor-chain communication

### Requirement: Automation rules create plans before side effects

V0 automation rules MUST produce explicit reaction plans instead of
performing privileged side effects directly.

#### Scenario: Supervisor signal is sent

- **WHEN** a supervisor signal is sent to a manager, director, C-suite
  hat, or executive-board hat
- **THEN** the runtime creates a reaction plan for the target
  supervisor level
- **AND** the plan references the triggering event, supervisor signal,
  target level, team, and work item
