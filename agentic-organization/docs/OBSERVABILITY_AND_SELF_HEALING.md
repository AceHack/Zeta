# Observability and Self-Healing

## Status

Implementation contract for the first visibility slice.

## Purpose

Agentic Organization must be observable by construction. A human or
agent should be able to plug into the system, see what is happening
across work, agents, hats, commands, events, runs, gates, and reactions,
and identify weak points without reconstructing state from scattered
logs.

The long-term goal is agent self-monitoring: agents can inspect their
own workflows, detect harness failures or process gaps, create the right
supervisor-chain communication, and route fixes through normal
Organization work.

## Core Rule

Every meaningful workflow movement emits or produces a workflow
visibility record.

Required movements include:

- command accepted or rejected;
- denied policy decision observed;
- domain event written;
- outbox publication;
- NATS consumer handling;
- reaction plan created;
- Temporal workflow or activity step;
- Dapr actor reminder or callback;
- MCP tool preflight and execution;
- Hermes run lifecycle event;
- Hindsight recall, retain, or reflect operation;
- review, QA, security, architecture, delivery, or outcome gate;
- schedule block start, pause, resume, or finish;
- runtime health incident or reconciliation.

The Organization DB, audit rows, outbox rows, and domain events remain
the source of truth. Logs, traces, metrics, and visibility records are
queryable evidence and diagnosis surfaces.

## Workflow Visibility Record

`@agentic-org/observability` owns the first typed record builders. Event
visibility projects a canonical event envelope into the fields a UI,
monitor, or agent reviewer needs:

- observation kind;
- health state;
- workflow stage;
- occurred-at timestamp;
- event ID and event type;
- command, correlation, causation, trace, and idempotency IDs;
- organization, project, initiative, team, and work item scope;
- agent and active hat assignment;
- aggregate ID, type, and version;
- Grafana links for traces, logs, and metrics;
- typed weak-point indicators.

This is intentionally generic. It is not a QA-only, capability-request,
or platform-incident-only tool. It is the common visibility shape that
all packages can extend and all runtime hosts can emit.

Policy-denial visibility is a sibling projection. It does not synthesize
a fake event for a denied command. Instead it projects the durable policy
decision observation directly into:

- command, correlation, causation, trace, and idempotency IDs;
- organization, project, optional team, and optional work item scope;
- agent and hat assignment;
- attempted tool type;
- supervisor-chain source and target levels;
- policy decision ID, policy version, and denial reason;
- Grafana links for traces, logs, and metrics;
- a `policy_denied` weak-point indicator.

Agents should use those records to understand whether a denial points to
a missing grant, wrong scope, stale hat assignment, or training gap, then
route follow-up through supervisor-chain communication and normal work
commands.

## Weak-Point Indicators

Weak points should be typed so agents can reason over them without
parsing prose. The starter taxonomy is:

| Indicator          | Meaning                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `blocked_work`     | Work cannot proceed without supervisor triage, dependency, or input. |
| `slow_triage`      | A queue, gate, review, or escalation is exceeding its SLO.           |
| `repeated_failure` | The same workflow, test, run, or gate is failing repeatedly.         |
| `missing_evidence` | A reviewer or agent cannot prove that acceptance criteria were met.  |
| `missing_tool`     | The hat lacks a safe existing tool or prompt flow for repeated work. |
| `policy_denied`    | Policy rejected an attempted action and needs triage or education.   |
| `harness_failure`  | Agent runtime, MCP, prompt-flow, or orchestration harness broke.     |
| `telemetry_gap`    | Required event, trace, metric, log, artifact, or link is missing.    |

Indicators should include a short summary and a suggested next action.
The next action is still routed through the supervisor chain or normal
work commands; the indicator does not bypass hierarchy, policy, or
review.

## LGTM Integration

The full cluster already provides the visibility substrate:

- Alloy collects telemetry.
- Tempo stores traces.
- Loki stores logs.
- Prometheus and Mimir store metrics.
- Grafana renders dashboards and exploration links.

Agentic Organization should standardize links and labels so every
visibility record can open the same context from multiple surfaces:

```text
work item timeline
  -> event
  -> visibility record
  -> trace
  -> logs
  -> metrics
  -> artifacts and evidence
  -> related discussions and decisions
```

All runtime hosts should attach the canonical `agentic.*` trace fields
and Kubernetes workload labels before exporting telemetry.

## Agent Self-Healing Loop

Agents should eventually run this loop on their own workflows:

```text
observe workflow visibility records
  -> classify weak points
  -> inspect linked trace, logs, metrics, artifacts, and work graph
  -> decide whether the issue is local, team-level, department-level, or platform-level
  -> send supervisor-chain communication when work, authority, tooling, or policy must change
  -> create or update work items through normal commands
  -> route to the right team, review gate, and security gate
  -> implement harness, prompt-flow, tool, adapter, or process fix
  -> validate through tests, gates, and runtime telemetry
  -> run outcome review and update memories or docs when appropriate
```

The loop must remain auditable. Self-healing is not permission to mutate
the runtime outside command, policy, idempotency, and review boundaries.

## UI Expectations

The operations UI should make weak points visible at every hierarchy:

- organization health;
- project and initiative health;
- department and team queues;
- hat supply and assignment health;
- work item timelines;
- agent schedules and runs;
- review, QA, security, architecture, delivery, and outcome gates;
- Cockroach durable adapter health;
- NATS, Temporal, Dapr, Hermes, Hindsight, MCP, and k8s adapter health.

Every view should support drilling from summary to evidence. A red or
degraded status without a trace, log query, metric panel, event ID or
policy decision/command ID, work item, and suggested action is not good
enough for this platform.

Startup and composition failures count as observable runtime failures.
If the worker process cannot construct or validate its Cockroach, NATS,
or telemetry adapters, the failure should produce explicit startup
evidence and a degraded/readiness signal rather than disappearing before
agents and operators can inspect it.

The worker process now has the first executable readiness boundary:
dependency probes return typed ready/not-ready checks and the aggregate
readiness result degrades when any dependency is not ready or when a
probe throws. The first NATS process adapter contributes a NATS
readiness probe alongside its publisher, pull-consumer, dead-letter, and
shutdown ports. Later entrypoints should expose this result through
Kubernetes readiness probes and structured startup telemetry, then link
failures to the same trace and weak-point vocabulary used by
worker-cycle telemetry.

Durable transaction and publication ambiguity also counts as observable
runtime evidence. A Cockroach ambiguous commit, stale outbox claim,
missing outbox claim, or duplicate publish mark should surface as a
weak-point trail with the command ID, event ID, claim ID when present,
trace ID, and worker runtime stage so agents can distinguish harmless
replay pressure from a real harness or consistency problem.

The first worker telemetry adapter is deliberately simple: an app-local
JSON sink that records timestamp, event name, and stable worker/NATS
attributes. This gives local runs and cluster logs the same field shape
before an OTLP exporter is introduced. Later Alloy/Loki/Tempo/Mimir
binding should ingest or translate this shape rather than inventing a
parallel telemetry vocabulary.

Worker failure evidence is intentionally contract-bound. Runtime hosts
may attach only domain-defined evidence keys to worker-cycle failures;
unknown keys are dropped at the worker boundary instead of entering
telemetry as ad hoc fields. The first recorded worker failure is
projected under the stable `agentic.worker.failure.first_*` attribute
namespace so later multiple-failure reporting can add additional
families without changing the meaning of existing dashboards.

## Implementation Rule

When adding a package, command, adapter, workflow, gate, or runtime host,
add its visibility contract with the same change:

- typed event or command names;
- OpenTelemetry attributes;
- workflow visibility projection;
- weak-point indicators it may emit;
- dashboard or UI projection needs;
- tests proving the projection includes the trace chain.
