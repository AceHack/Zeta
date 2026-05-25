# Always-On Orchestration Runtime

## Purpose

The Organization needs an always-on runtime that continuously reacts to organizational state.

This runtime is the layer between:

- persisted Organization state;
- Oz/Warp run orchestration;
- OpenZiti transport state where private connectivity is required;
- NATS/JetStream events;
- k3s pods;
- Hermes agents;
- schedules, timers, policies, and rules.

The goal is not to hard-code corporate behavior. The goal is to provide deterministic primitives so Hermes agents can run the Organization while the platform enforces safety, leases, state transitions, budgets, and observability.

## Core Loop

```text
state changes
  -> domain event persisted
  -> event published
  -> rules evaluated
  -> reaction plan created
  -> leases/budget/hat supply checked
  -> actions executed
  -> run requests / messages / tasks / reports / escalations created
  -> outcomes observed
  -> reconciliation verifies reality matches Organization state
```

The Organization database remains authoritative. NATS, the run orchestrator, k3s, Hindsight, and telemetry systems are synchronized through workers and reconcilers.

## Always-On Workers

The control plane needs persistent background workers independent of Hermes agent sessions.

Initial workers:

- `SchedulerWorker`: claims due scheduled jobs and durable timers.
- `RuleEvaluationWorker`: evaluates rules after domain events and state changes.
- `ReactionExecutorWorker`: executes approved reaction plans.
- `OutboxPublisherWorker`: publishes persisted outbox events to NATS.
- `NatsConsumerWorker`: consumes durable NATS streams and invokes domain handlers.
- `OzReconcilerWorker`: reconciles Oz run state with Organization run bindings.
- `PodSessionWatchdogWorker`: watches k3s pods and Hermes session health.
- `LeaseReaperWorker`: expires stale runtime leases and fencing tokens.
- `DeadLetterWorker`: classifies, quarantines, replays, or escalates dead-letter messages.
- `TriggerWorker`: evaluates event, threshold, external, and state-timeout triggers.
- `AnomalyClassifierWorker`: converts telemetry anomalies into reports or self-healing attempts.
- `BudgetAndCapacityWorker`: enforces burn-rate, queue admission, hat supply, and scale-down policies.
- `ObservabilityCoverageWorker`: detects missing logs/traces/metrics/health coverage.

These are boring system processes. Hermes agents may reason about their outputs, but the workers keep the runtime awake.

## Durable Triggers

Triggers are first-class runtime objects.

Trigger types:

- event trigger: reacts to domain events such as `TaskMarkedReady`;
- state trigger: reacts when an entity enters or leaves a state;
- state-timeout trigger: reacts when an entity remains in a state too long;
- scheduled trigger: reacts on cadence;
- threshold trigger: reacts to metrics, counts, budgets, or quality signals;
- external trigger: reacts to webhook or polled external system changes.

Core entities:

```text
durable_triggers
trigger_executions
trigger_checkpoints
```

Each trigger should define:

- scope: organization, department, project, initiative, team, repo, task, or hat;
- owner hat or department;
- predicate;
- action type;
- policy requirements;
- concurrency policy;
- dedupe key;
- idempotency key;
- retry policy;
- cooldown;
- budget policy;
- enabled/paused state;
- version;
- last evaluation;
- next evaluation when time-based.

## Organizational Rules and Reactions

Rules decide how the Organization reacts to state.

Core concepts:

```text
OrganizationalRule
  event/state predicate
  scope
  priority
  owner department
  required policy version
  conditions
  action list

ReactionPlan
  deterministic output of rule evaluation
  state transition / assignment / spawn request / escalation / report / backlog item / no-op

RuleEvaluationEvent
  matched rules
  skipped rules
  conflict resolution
  policy version
  final action
```

Rules should not execute side effects directly. They create a reaction plan. The reaction executor claims the plan, validates leases/policy/budget, then executes actions.

## Rule Scope

Rule scopes:

- organization rules;
- department rules;
- project rules;
- initiative rules;
- team rules;
- repo rules;
- hat rules;
- task/work item rules.

Rules cascade from broad to narrow. Narrower rules can specialize behavior, but cannot bypass hard policy.

Example:

```text
TaskMarkedReady
  -> project rule checks required docs
  -> engineering department rule checks TDD requirement
  -> team rule checks staffing
  -> hat supply rule reserves implementer
  -> agent launch policy creates Oz run request
```

## Conflict Policy

Rules need deterministic conflict resolution.

Default precedence:

```text
Security hard block
  > Compliance hard block
  > Human emergency override within allowed scope
  > Executive Board decision
  > QA release block
  > Architecture gate
  > Budget/capacity hard limit
  > Department director policy
  > TPM initiative priority
  > Team/manager preference
```

Any conflict resolution must produce an audit event explaining:

- conflicting rules;
- precedence applied;
- final decision;
- policy version;
- approving hat or human override when applicable.

## Agent Launch Policy

Autonomous agent launches must be governed.

`AgentLaunchPolicy` should define:

- triggering event or state;
- allowed launcher hats;
- required target hats;
- required project/initiative/task context;
- Oz run template;
- Hermes profile;
- memory scope;
- documentation context;
- credential scopes;
- budget cap;
- max concurrency;
- idempotency key;
- cancellation conditions;
- completion signal;
- escalation path.

Example:

```text
TaskMarkedReady
  -> if required docs are approved
  -> if hat supply can reserve implementer
  -> if budget is available
  -> create Hermes implementer run
  -> assign task and hat
  -> require red-test artifact before implementation evidence
```

## Scheduler Semantics

Scheduled jobs need explicit execution behavior.

`scheduled_jobs` should include:

- owner hat assignment;
- department/project/initiative/team scope;
- cadence;
- timezone;
- jitter;
- last run time;
- next run time;
- locked until;
- max runtime;
- misfire policy;
- concurrency policy;
- catch-up policy;
- run policy;
- budget policy;
- expected artifact outputs;
- escalation target;
- schedule version.

Misfire policies:

- skip missed run;
- run once immediately;
- catch up all missed runs up to a limit;
- escalate if too stale.

Concurrency policies:

- forbid overlap;
- allow overlap with cap;
- replace running job;
- queue behind running job.

Scheduled jobs should create work, reports, meetings, reviews, or Oz run requests. They should not bypass work management.

## Durable Timers

Timers enforce lifecycle expectations.

Examples:

- review pending too long;
- vote pending too long;
- Oz callback missing;
- Hermes session silent too long;
- QA suite exceeded max runtime;
- hat token renewal overdue;
- task blocked too long;
- initiative has no TPM;
- project has stale docs;
- department queue exceeds SLA.

Timers are durable triggers with entity scope and state predicate.

## Runtime Leases and Leadership

Workers must prevent duplicate execution.

`runtime_leases` should include:

- lease ID;
- resource type;
- resource ID;
- owner worker ID;
- owner pod ID;
- fencing token;
- acquired at;
- expires at;
- renewal count;
- policy;
- last heartbeat;
- release reason.

Rules:

- every scheduled job claim requires a lease;
- every reaction execution requires a lease;
- every external watcher checkpoint update requires a lease;
- every self-healing remediation requires a lease;
- stale leases are expired by the lease reaper;
- fencing tokens must be checked before writes that could be duplicated.

## Queue and NATS Consumer Contracts

NATS consumers need explicit contracts.

Each durable consumer should define:

- stream name;
- subject pattern;
- durable consumer name;
- owner service/worker;
- ack wait;
- max deliveries;
- backoff policy;
- replay policy;
- ordering expectation;
- idempotency key;
- dead-letter target;
- poison message classification;
- schema version handling;
- replay authorization requirements.

At-least-once delivery is expected. Domain handlers must be idempotent.

## Dead-Letter Workflow

Dead-letter messages are work items for the Operations organization.

Core entities:

```text
dead_letter_messages
dead_letter_investigations
replay_requests
quarantine_decisions
discard_decisions
```

Lifecycle:

```text
message dead-lettered
  -> DLQ Steward hat assigned
  -> classify poison / transient / schema / policy / duplicate
  -> link trace and original entity
  -> decide replay, quarantine, discard, or backlog item
  -> require approval for replay if side effects are possible
  -> record outcome
```

Discarding a message requires evidence and approval.

## Watchers

Watchers connect external reality to Organization state.

Initial watchers:

- Oz run watcher;
- k3s pod/session watcher;
- NATS stream health watcher;
- credential proxy denial watcher;
- Hindsight memory health watcher;
- telemetry ingestion watcher;
- Git provider watcher;
- CI/pipeline watcher;
- documentation repository watcher;
- project artifact watcher.

Watcher requirements:

- checkpoint storage;
- webhook plus polling fallback where possible;
- dedupe keys;
- lag metrics;
- stale-checkpoint alerts;
- owner hat/department;
- failure reports.

## Reconciliation Loops

Reconciliation treats the Organization DB as truth and external systems as observed state.

Reconcilers should detect:

- pending Oz runs not launched;
- Oz runs with no Organization binding;
- orphaned k3s pods;
- Hermes sessions silent past heartbeat threshold;
- stale hat assignments on dead sessions;
- unprocessed outbox events;
- NATS messages delivered but not reflected in state;
- missing artifacts;
- tasks stuck in impossible states;
- schedules not firing;
- watchers not advancing checkpoints.

Reconcilers should repair when safe, otherwise create reports and escalations.

## SLOs and Error Budgets

Always-on systems need service objectives.

Initial SLO categories:

- Organization API availability and latency;
- MCP tool latency and success rate;
- Oz run launch success and callback freshness;
- Hermes session heartbeat freshness;
- NATS publish/consume lag;
- outbox drain time;
- scheduler lag;
- trigger evaluation lag;
- credential proxy availability and denial correctness;
- Hindsight adapter availability and recall latency;
- trace/log/metric ingestion freshness;
- self-healing success and escalation latency.

Error budgets should influence priority. If a project or component burns its error budget, the Organization should reduce risky new work, prioritize reliability fixes, or require executive approval to continue.

## Health Contracts

Every platform component needs:

- liveness check;
- readiness check;
- dependency check;
- freshness window;
- degraded mode;
- owner hat;
- escalation path;
- SLO target;
- dashboard link;
- runbook skill.

Health reports should be queryable by project, department, component, cluster, and owner.

## Self-Healing Policy

Remediations must be classified.

Classes:

- auto-safe: can run without approval;
- approval-required: needs owning manager, DevOps, Security, or Executive approval;
- forbidden: must only create a report/escalation;
- human-only: requires explicit human action.

Each remediation defines:

- preconditions;
- blast-radius limit;
- max retry count;
- cooldown;
- rollback plan;
- verification check;
- failure escalation;
- evidence requirements.

## Runbooks as Skills

Recurring operational procedures should become versioned skills.

Runbook skill frontmatter should include:

```yaml
id: restart-stuck-hermes-session
name: Restart Stuck Hermes Session
type: operational-runbook
owners:
  - devops-manager
allowedHats:
  - platform-operator
  - sre
  - incident-commander
triggers:
  - hermes.session.silent
preconditions:
  - no-active-tool-call
approval:
  class: auto-safe
evidence:
  - trace
  - run-log
  - session-heartbeat
rollback:
  required: true
status: active
version: 1
```

Runbooks should be linked to incidents, anomalies, self-healing attempts, and postmortems.

## Runtime Capability Expansion

The always-on runtime should detect capability gaps and route them into governed expansion work.

Sources:

- repeated failed or denied tool calls;
- repeated credential proxy denials;
- repeated manual workarounds;
- repeated QA bounce-backs;
- recurring incidents;
- team review findings;
- director review findings;
- observability coverage gaps;
- missing workflow/automation for a repeatable process.

Flow:

```text
capability_gap_detected
  -> create CapabilityRequest
  -> route to owning Engineering Manager or department manager
  -> Department Director prioritizes
  -> Security reviews if credentials, tools, data, or automation risk exists
  -> Architecture reviews if workflow, actor, runtime, or integration impact exists
  -> implementation work is created
  -> capability registry is updated after approval
  -> rules/triggers may begin using the new capability
```

Expansion targets:

- MCP tools;
- credential proxy endpoints;
- Temporal workflows;
- Dapr actors;
- durable triggers;
- scheduled jobs;
- project skills;
- runbook skills;
- hat capabilities;
- observability probes and dashboards.

New capabilities should never become active directly from an agent request. They must pass through review gates, tests, observability requirements, registry activation, and policy-scoped availability.

## Operations Hats

Additional always-on hats:

- Platform Operator;
- SRE;
- Incident Commander;
- DLQ Steward;
- Observability Curator;
- Cost Controller;
- Scheduler Steward;
- Trigger Steward;
- Runbook Maintainer.

These hats do not replace engineering/product departments. They keep the Organization runtime healthy.

## Incident Response

Incidents need lifecycle state.

Severity levels:

- `sev0`: Organization cannot operate or unsafe actions are occurring.
- `sev1`: major project/runtime capability degraded.
- `sev2`: limited degraded capability with workarounds.
- `sev3`: low-impact issue or recurring annoyance.

Incident lifecycle:

```text
detected
  -> classified
  -> commander_assigned
  -> mitigation_in_progress
  -> mitigated
  -> resolved
  -> postmortem_required
  -> actions_prioritized
  -> closed
```

Incident Commander responsibilities:

- assign responder hats;
- set communication cadence;
- freeze risky actions if needed;
- approve rollback when authorized;
- coordinate self-healing and manual remediation;
- require postmortem and follow-up backlog items.

## Capacity and Budget Enforcement

Hat supply and budget should control admission.

Enforcement loops:

- reserve hats before launching runs;
- release hats when runs finish or expire;
- queue work when hat supply is exhausted;
- preempt lower-priority work only by explicit policy;
- alert on burn-rate thresholds;
- pause noncritical scheduled jobs when budget is exhausted;
- scale down idle sessions;
- deprovision expired hats;
- escalate starvation or chronic undercapacity to directors/executives.

## Human Override

Overrides must be scoped and temporary.

Required fields:

- actor;
- scope;
- reason;
- policy bypassed;
- expiration;
- max blast radius;
- rollback plan;
- approval evidence;
- review requirement.

Dangerous overrides should require two-person approval or Executive Board approval.

## UI Requirements

The UI needs views for:

- rules and reaction history;
- scheduler queue and lag;
- trigger catalog and executions;
- runtime leases;
- worker heartbeats;
- outbox backlog;
- NATS consumers and DLQ;
- watcher checkpoints;
- reconciliation findings;
- SLO/error budgets;
- incident command;
- remediation approvals;
- runbook skill usage;
- budget burn rate and admission control.

Every automation should be inspectable from the affected project, initiative, task, agent, run, or department.

## MVP Slice

First always-on slice:

```text
TaskMarkedReady event
  -> durable trigger fires
  -> organizational rule evaluates
  -> reaction plan reserves implementer hat
  -> Organization creates Oz run request
  -> scheduler/worker launches run
  -> run binding and trace are recorded
  -> watchdog monitors heartbeat
  -> timeout trigger escalates if silent
  -> completion event releases hat and updates task
```

This proves the actual operating system: event, rule, trigger, lease, budget, run, watcher, reconciliation, and UI evidence.
