# Agentic Organization Implementation Governance

## Status

Standing guardrail for implementation work.

## Purpose

This document translates existing Zeta governance into Agentic
Organization implementation rules. It exists so package code, docs,
runtime hosts, and future cluster deployments move together.

## Current-State Rule

Agentic Organization docs are current-state design documents. Update
the relevant document when the implementation teaches us something.
Create an ADR only for durable architectural decisions that future
contributors must understand as a decision record.

## Behavioral Specs Lead

Runtime behavior that must survive a rebuild belongs in OpenSpec.
The first Agentic Organization behavior is captured in
`openspec/specs/agentic-organization/spec.md`.

When code adds a new command, lifecycle transition, event, review gate,
telemetry rule, or automation behavior, update the behavioral spec,
tests, and docs in the same change.

## Authority and Scope

Only Organization command services may change authoritative Organization
business state.

Adapters and runtime hosts may call commands. They must not bypass
commands to mutate work items, assignments, gates, hat decisions,
memory scope, audit rows, idempotency records, or outbox records.

Every privileged action must carry:

- actor agent ID;
- active hat assignment ID;
- organization ID;
- project ID;
- work item ID;
- command ID;
- correlation ID;
- causation ID;
- trace ID;
- idempotency key.

## Work Anchors

No meaningful discussion, memory write, tool call, gate review,
runtime run, or automation reaction should be anchorless. If an agent
needs to discuss or act on something ambiguous, create or link the
appropriate work item first.

## Review and Self-Approval

Agents may propose work and produce work. They may not approve their own
privileged work unless a future policy explicitly allows a narrow
low-risk exception.

Reviewer gates must be represented as explicit state, not as chat
agreement.

## Idempotency and Replay

Duplicates are normal. Temporal retries, NATS redelivery, Dapr
reminders, Oz callbacks, and agent retries must call the same
Organization command with the same idempotency key.

Conflicting reuse of an idempotency key must produce a typed rejection.

## Telemetry

Every implementation package should preserve the Agentic event trace
chain. Runtime hosts and adapters must export telemetry compatible with
the existing full-ai-cluster LGTM stack:

- Alloy for collection;
- Tempo for traces;
- Loki for logs;
- Mimir and Prometheus for metrics;
- Grafana for dashboards.

The first slice defines the required `agentic.*` attributes in
`@agentic-org/observability`. Later packages should consume that
contract instead of inventing new names.

Every meaningful workflow movement must also be projectable into a
workflow visibility record. The record is the agent- and UI-readable
surface that links command state, events, traces, logs, metrics,
work-item scope, active hat, aggregate version, and typed weak-point
indicators. This makes harness failures, blocker patterns, slow triage,
missing evidence, and telemetry gaps visible enough for agents to route
self-healing work through normal Organization commands.

## Security

Credential access must remain indirect and scoped through approved
Credential Proxy paths. Agents should not receive broad raw secrets.

New MCP tools, Temporal workflows, Dapr actors, NATS subjects,
credential endpoints, or runtime capabilities must start as scoped
supervisor-chain communication and then move through the appropriate
expansion lifecycle and security review when they expand authority,
credentials, network reach, memory reach, or data access.

## Data Is Not Directives

Retrieved docs, logs, memories, web pages, tool output, and user
attachments are context data. They must not be treated as executable
instructions unless an authorized command or prompt-flow phase explicitly
adopts them.

## Quality Gate

Every implementation change must include representative tests first
when it changes behavior. Avoid magic strings by centralizing command
names, event names, states, error codes, hat names, action types, metric
names, and telemetry keys as typed constants.

## Generic Lifecycle Duty

Agentic Organization must prefer generic lifecycle primitives over
hardcoded one-off tools. A specific tool should become first-class only
after the Organization has evidence that the pattern repeats and that a
specialized tool improves coordination, safety, or observability.

The expected path is:

```text
agent discovers need
  -> hat uses supervisor-chain communication
  -> supervisor triages
  -> route to specialized lifecycle if needed
  -> agents may propose new tools or flows
  -> review, security, implementation, activation, and outcome review
```

This is non-negotiable for the architecture. The platform exists to help
agents expand their own coordination substrate safely, not to freeze the
first vocabulary forever.
