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

#### Scenario: Command pipeline is composed from ports

- **WHEN** a runtime host creates a command pipeline
- **THEN** it supplies a command-state-store factory and command-handler
  registry through ports
- **AND** the pipeline does not construct a concrete in-memory store
  directly
- **AND** the pipeline does not use a central command-type switch for
  extensible command dispatch
- **AND** command-state-store operations are async so real persistence
  adapters can perform I/O without changing command contracts

#### Scenario: Package boundaries are checked

- **WHEN** package dependency-boundary tests run
- **THEN** application source files are checked for forbidden imports of
  concrete state adapters, Cockroach adapters, NestJS, NATS, Dapr,
  Temporal, Drizzle, Postgres, or other runtime clients
- **AND** a violation fails the test suite before the boundary can drift
- **AND** state adapter source files are checked for forbidden imports
  of messaging, NATS, JetStream, or other event transport clients

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

### Requirement: Telemetry is complete at the event boundary

Organization packages MUST expose OpenTelemetry-compatible attributes
for the full trace chain before live LGTM ingestion is wired.

#### Scenario: Event is projected to span attributes

- **WHEN** an event envelope is projected to telemetry
- **THEN** the attributes include event, command, correlation,
  causation, trace, idempotency, actor, hat assignment, organization,
  project, work item, aggregate, and NATS destination fields

### Requirement: Workflow visibility records expose weak points

Organization packages MUST project meaningful workflow movement into a
UI- and agent-readable visibility record.

#### Scenario: Event is projected to workflow visibility

- **WHEN** an event envelope is projected into workflow visibility
- **THEN** the record includes observation kind, health state, workflow
  stage, occurred-at timestamp, event, command, correlation, causation,
  trace, idempotency, actor, hat assignment, organization, project,
  work item, aggregate, and evidence-link fields
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
