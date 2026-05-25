# Agentic Organization UI and Observability Concepts

## Purpose

Humans need to see the Organization operating in real time.

The UI is not only an admin panel. It is the operating console for a living agentic organization:

- what work exists;
- who owns it;
- which hats are active;
- which agents are running;
- what pods and clusters are executing;
- what decisions were made;
- where tasks are blocked;
- what meetings are happening;
- what reports were filed;
- what memory and artifacts were created;
- how budget and hat supply are being used.

## Product Principle

The UI should make the Organization legible.

Humans should be able to move from broad health to exact evidence:

```text
Organization health
  -> project
  -> initiative
  -> mission/team
  -> task
  -> agent session
  -> pod/Oz run
  -> messages, artifacts, votes, logs, traces
```

The UI should not feel like a marketing dashboard. It should feel like an operations console: dense, searchable, status-rich, and built for repeated daily use.

## Primary Views

### Organization Overview

Shows the whole Organization at a glance.

Core widgets:

- active projects;
- active initiatives;
- active Oz runs;
- active Hermes sessions;
- active hats by department;
- hat supply utilization;
- blocked tasks;
- QA reproducible failures;
- pending reviews;
- pending votes;
- open escalations;
- budget usage;
- cluster health;
- NATS event health;
- credential proxy denials;
- recent major decisions.

### Hierarchy Explorer

A tree/table view of the hierarchy:

```text
Organization
  -> Portfolio
      -> Project
          -> Initiative
              -> Mission
                  -> Work Item
                      -> Task
```

Capabilities:

- expand/collapse hierarchy;
- filter by status, department, hat, agent, priority, project, cluster;
- show owners and active hats;
- show progress and blockers;
- click into exact task or initiative detail.

### Project Board

Project-level work view.

Shows:

- initiatives by status;
- project backlog;
- service requests;
- defects;
- scheduled QA suites;
- release readiness;
- active departments;
- project memory highlights;
- documentation health;
- project skill health;
- project-level decisions.

### Project Documentation Library

Project-scoped source of truth for business, product, architecture, and engineering documents.

Shows:

- BRDs by project, initiative, and product area;
- CAs by initiative, repository, service, and component;
- ADRs by decision status;
- design docs by system area;
- documentation owners;
- approval state;
- linked gates;
- stale documentation warnings;
- missing documentation requirements;
- work items blocked by missing docs.

Useful filters:

- project;
- initiative;
- repository;
- service/component;
- document type;
- approval state;
- owning hat;
- required for gate.

Each document view should show the work it governs, the agents and hats that used it, the reviews that cited it, and the downstream decisions it produced.

### Project Skill Library

Operational view for repo and project-specific skills.

Shows:

- active skills;
- proposed skills;
- deprecated skills;
- skill owners;
- allowed hats;
- project/repo scope;
- required tools;
- required artifacts;
- ingestion status;
- graph edges;
- usage history;
- observed success/failure outcomes.

Engineering Manager hats should be able to review proposed skills, approve ingestion, deprecate stale skills, and request new skill work when team reviews reveal recurring failure modes.

### Initiative Control Room

Focused view for one initiative.

Shows:

- assigned director;
- assigned TPM;
- engineering managers;
- active teams;
- tasks by state;
- BRD and CA artifacts;
- gate status;
- review queue;
- QA status;
- budget and hat supply;
- meeting history;
- escalation history;
- Oz run bindings.

### Task Board

Agent-native Linear-like task management.

Columns:

```text
backlog
intake
discovery
ready
planned
in_progress
code_review
qa_review
qa_reproducible
needs_rework
approved
merged
released
done
blocked
```

Task cards should show:

- title;
- owning hat;
- assigned agent;
- reviewers;
- required artifacts;
- gate state;
- red/green test evidence state;
- QA evidence state;
- priority;
- blockers;
- linked Oz runs;
- last event.

### Department Dashboard

Per-department operations view.

Examples:

- Engineering department: teams, managers, task readiness, review queue, TDD compliance.
- QA department: scheduled suites, reproducible failures, coverage gaps, screenshots/traces.
- Security department: credential requests, denied scopes, policy changes.
- Memory department: memory adaptation requests, stale memories, missing memory reports.
- DevOps department: pipeline failure reports, cluster health, Oz worker health.

### Hat Supply View

Shows limited hat capacity and usage.

Core data:

- total supply per hat;
- active assignments;
- waiting requests;
- token expiry;
- revoked/deprovisioned hats;
- assignment chain;
- utilization by project/initiative;
- cost by hat;
- agent fit recommendations.

### Agent Directory

Shows Hermes agents and their experience profile.

For each agent:

- active status;
- current hats;
- historical hats;
- memory specialties;
- performance reviews;
- projects worked on;
- tasks completed;
- review outcomes;
- QA bounce-backs;
- cost/runtime;
- current Oz runs;
- session history.

### Run and Cluster Observatory

Shows execution across all pods and clusters.

Group by:

- cluster;
- namespace;
- Oz run;
- Hermes session;
- project;
- initiative;
- hat;
- agent.

Shows:

- pod status;
- container image;
- resource usage;
- logs;
- traces;
- run duration;
- restart count;
- Cilium mesh, Gateway, and workload identity status;
- credential proxy calls;
- MCP calls;
- NATS events;
- linked Organization task.

### Trace and Evidence Explorer

Deep inspection view for one correlated chain of work.

A human should be able to start from any object and walk the trace:

```text
goal
  -> project
  -> initiative
  -> task
  -> hat assignment
  -> agent session
  -> Oz run
  -> pod
  -> MCP call
  -> policy decision
  -> credential proxy call
  -> memory/doc/skill read
  -> NATS event
  -> artifact
  -> state transition
```

Shows:

- trace ID and correlation ID;
- span tree;
- causation chain;
- exact state transitions;
- active agent, hat, policy version, and token status;
- MCP tool inputs and structured outputs where safe;
- policy allow/deny rationale;
- credential proxy allow/deny evidence;
- memory reads and writes with scope;
- documentation and project skills consulted;
- NATS publish/consume/replay/dead-letter details;
- linked screenshots, logs, browser traces, test output, and reports;
- retry and self-healing attempts;
- final outcome.

The view should make it easy to answer "why did this happen?" without reading raw logs first.

### Anomaly and Self-Healing Console

View for failures, degradations, retries, and automated remediation.

Shows:

- detected anomalies;
- classified failure mode;
- affected project/initiative/task/run;
- blast radius;
- correlated traces and logs;
- attempted remediation;
- verification result;
- escalation owner;
- repeated occurrence count;
- linked backlog item, defect, memory adaptation request, or skill request.

Supported actions:

- approve safe remediation when human approval is required;
- pause remediation;
- escalate to department;
- convert recurring issue into backlog item;
- request memory update;
- request project skill creation;
- request observability improvement.

### Observability Coverage View

Every project, repo, internal service, and agent-built tool should show whether it meets the Organization observability standard.

Coverage dimensions:

- structured logs;
- distributed traces;
- metrics;
- health checks;
- readiness checks;
- state events;
- audit events;
- artifact evidence;
- UI-visible status;
- self-healing behavior;
- escalation behavior.

Missing coverage should be actionable. Engineering Manager and DevOps hats should be able to create backlog items directly from coverage gaps.

### Always-On Runtime Console

Operations view for the machinery that keeps the Organization awake.

Shows:

- worker heartbeats;
- scheduler lag;
- due scheduled jobs;
- running scheduled jobs;
- durable triggers;
- recent trigger executions;
- rule evaluation queue;
- reaction plans by status;
- runtime leases;
- outbox backlog;
- NATS consumer lag;
- dead-letter counts;
- watcher checkpoints;
- reconciliation findings;
- self-healing queue;
- budget admission decisions.

Supported actions:

- pause or resume a trigger;
- pause or resume a scheduled job;
- inspect a reaction plan;
- approve a guarded reaction plan;
- release a stale lease when policy allows;
- replay or quarantine dead-letter messages;
- acknowledge reconciliation findings;
- open an incident from runtime drift.

### Rules and Reactions View

Every automated organizational action should be explainable.

Shows:

- rule catalog;
- rule owner department;
- rule scope;
- predicate;
- priority;
- conflict policy;
- matched and skipped rules;
- reaction plan;
- policy version;
- final action;
- linked state changes;
- trace and audit evidence.

This view should be reachable from projects, initiatives, teams, tasks, departments, and agent runs.

### SLO and Incident Command

Always-on operations need visible reliability goals.

Shows:

- SLO targets;
- current burn rate;
- error budget remaining;
- affected projects and components;
- open incidents;
- severity;
- incident commander;
- assigned responder hats;
- mitigation status;
- communication cadence;
- rollback/freeze state;
- postmortem and follow-up backlog items.

### Meeting Center

Shows active and historical meetings.

Supports:

- executive meetings;
- department meetings;
- team chats;
- one-on-one chats;
- decision meetings;
- review panels;
- incident triage.

For each meeting:

- purpose;
- participants and hats;
- conversation mode;
- current speaker/turn order;
- agenda;
- transcript;
- votes;
- decisions;
- artifacts created;
- memories created;
- resulting tasks.

### Decision and Vote Ledger

Immutable view of organizational decisions.

Shows:

- decision;
- voters;
- hats worn;
- vote scope;
- rationale;
- linked evidence;
- linked meeting;
- policy version;
- timestamp;
- resulting state changes.

### Reports Inbox

Unified report handling.

Report types:

- service request;
- bug report;
- QA reproducibility report;
- DevOps pipeline failure report;
- security risk report;
- memory quality report;
- outcome review;
- performance review;
- incident report.

View should support:

- triage status;
- owner;
- priority;
- linked task/backlog/initiative;
- evidence;
- escalation path;
- SLA/age.

### Artifact and Evidence Browser

Searchable artifact store.

Artifact types:

- BRD;
- CA;
- ADR;
- design doc;
- project skill;
- repo skill;
- test evidence;
- red test evidence;
- green test evidence;
- screenshots;
- browser traces;
- logs;
- QA reports;
- review reports;
- release evidence;
- meeting transcripts;
- memory changes.

## Live Organization Map

The UI should include a graph view that shows how work is flowing.

Nodes:

- projects;
- initiatives;
- missions;
- teams;
- tasks;
- agents;
- hats;
- skills;
- meetings;
- decisions;
- artifacts;
- Oz runs;
- pods.

Edges:

- owns;
- assigned_to;
- reviews;
- blocks;
- depends_on;
- spawned;
- reports_to;
- voted_on;
- created_artifact;
- references_artifact;
- can_use_skill;
- used_skill;
- applies_to;
- produced_memory;
- running_in.

This is useful for understanding why the Organization is doing something.

## Interaction Timeline

Every project, initiative, task, agent, and run should have a timeline.

Timeline events:

- task created;
- hat assigned;
- Oz run started;
- agent sent report;
- artifact submitted;
- review requested;
- vote opened;
- decision recorded;
- QA reproduced issue;
- meeting opened;
- memory written;
- credential denied;
- task moved state.

Timelines should support filtering by event type and jumping to source evidence.

## Human Actions

Humans should be able to:

- submit goals;
- submit reports;
- answer customer interview questions;
- approve or reject human-required gates;
- pause or stop Oz runs;
- deprovision hats;
- adjust priority;
- trigger escalation;
- request meeting;
- inspect memory attribution;
- override with audited reason when policy allows;
- create or edit standards through approved workflows.

Human actions must be audited like agent actions.

## Alerting

Alerts should be visible in the UI and optionally routed externally.

Initial alerts:

- hat token denials spike;
- credential proxy denials spike;
- Oz run stuck;
- Hermes session crash loop;
- NATS dead-letter messages;
- QA reproducible failures on high-priority initiative;
- review queue exceeds threshold;
- budget threshold exceeded;
- scheduled QA suite failing;
- executive vote pending too long;
- project blocked by missing hat supply;
- memory adapter degraded;
- trace ingestion degraded;
- log ingestion degraded;
- metrics ingestion degraded;
- self-healing failure rate exceeds threshold;
- observability coverage drops below project standard;
- repeated anomaly classification for the same repo, skill, hat, or component;
- scheduler lag exceeds SLO;
- trigger execution failures exceed threshold;
- worker heartbeat missing;
- runtime lease contention spike;
- reaction plan stuck;
- outbox backlog exceeds threshold;
- NATS consumer lag exceeds threshold;
- dead-letter replay fails;
- watcher checkpoint stale;
- reconciliation drift remains unresolved;
- SLO error budget burned;
- incident commander unassigned.

## Data Sources

UI data should come from:

- Organization DB for authoritative state;
- NATS for live updates;
- Oz API for run lifecycle/log/artifact metadata;
- k3s/Kubernetes API for pod state;
- Cilium Hubble telemetry for service interactions;
- Credential Proxy audit log;
- Hindsight adapter for memory summaries;
- artifact store for evidence;
- trace backend for distributed traces;
- log backend for structured and raw logs;
- metrics backend for time-series health, quality, and cost signals;
- graph projection for relationships between agents, hats, skills, docs, memories, tasks, runs, and outcomes.

Do not make the UI infer truth from logs. Logs support diagnosis. Organization state remains authoritative.

## Frontend Implementation Notes

Likely frontend shape:

- React or Next.js;
- dense dashboard layout;
- left navigation by Organization, Projects, Departments, Runs, Reports, Meetings, Agents, Hats;
- WebSocket or SSE for live updates;
- table-first views with graph/timeline overlays;
- command palette for finding tasks, agents, hats, runs, and artifacts;
- drill-down panels instead of excessive page switching.

Important UI constraints:

- do not hide evidence behind chat transcripts;
- every status should link to the state transition or gate that caused it;
- every agent action should reveal active hat and policy scope;
- every Oz run should link back to Organization work;
- every task should show required artifacts and missing gates;
- every decision should show voters and rationale;
- every trace should link to state, artifacts, logs, and metrics;
- every failure should show whether it was retried, self-healed, escalated, or left blocked;
- every internal tool should expose observability coverage;
- every automated action should show the rule and trigger that caused it;
- every scheduled job should show owner, cadence, last run, next run, and last result;
- every dead-letter message should show classification, replay/discard decision, and evidence.

## MVP UI

First useful UI:

```text
1. Organization Overview
2. Project Board
3. Initiative Control Room
4. Task Board
5. Agent/Run Detail
6. Reports Inbox
7. Artifact Browser
8. Trace and Evidence Explorer
9. Anomaly and Self-Healing Console
10. Always-On Runtime Console
11. Rules and Reactions View
12. SLO and Incident Command
```

MVP live update path:

```text
Organization DB state
  -> domain event
  -> NATS
  -> UI SSE/WebSocket
  -> update visible board/timeline
```

First visual proof:

```text
Goal submitted
  -> Oz run starts
  -> Hermes agent receives hat
  -> task created
  -> artifact submitted
  -> review approved
  -> QA signs off or reports reproducible issue
  -> timeline and board update live
```
