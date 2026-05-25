# Organization Layer Build Plan

This document describes how to build the Organization layer that makes departments and hats operational. The hat inventory defines who can exist. This build plan defines the environment, automation, runtime state, and feedback loops that let each hat actually perform its role.

The Organization layer should behave like a deterministic operating system for Hermes agents. It should not hard-code every business behavior. It should provide enough structure that agents can govern work, communicate, request capabilities, run teams, review outputs, improve memory, and expand the platform without bypassing policy.

## Core Thesis

Each hat needs four things:

1. Authority: what it can read, change, approve, vote on, spawn, and request.
2. Workspace: the queues, inboxes, documents, dashboards, and tools that make the role easy to perform.
3. Cadence: the triggers, schedules, review loops, and escalation timers that keep the role active.
4. Feedback: outcome reviews, traces, metrics, memories, and backlog pathways that let the role improve the Organization.

The Organization layer exists to provide those four things consistently.

## TypeScript Application Stack

Build the Organization as a TypeScript monorepo with a modular-monolith core and separately deployable runtime processes.

Recommended stack:

| Layer | Choice | Purpose |
|---|---|---|
| Monorepo | `pnpm` workspaces with Turborepo or Nx | Shared packages, isolated apps, incremental builds, CI task graph |
| Backend API | NestJS with the Fastify adapter | Organization API, internal APIs, MCP gateway shell, policy guards, worker-safe module boundaries |
| Frontend | Next.js App Router with React and TypeScript | Dense operations console for humans watching projects, hats, runs, boards, meetings, and evidence |
| UI primitives | Tailwind, Radix/shadcn-style components, TanStack Table/Virtual, React Flow | High-density boards, trees, timelines, graphs, and status panels |
| API contract | REST/OpenAPI first, SSE for live updates, WebSocket later for active meetings/chat | Agent-friendly contracts, generated clients, auditability, simple live UI path |
| Database | CockroachDB | Distributed Organization source of truth, state machines, audit, outbox, projections |
| Query/migrations | Drizzle ORM | TypeScript-native schema, explicit SQL shape, typed enums, migration control against CockroachDB's PostgreSQL-compatible interface |
| Messaging | NATS JetStream | Organization signals, inbox/outbox, live projection updates, DLQ/replay |
| Durable workflows | Temporal TypeScript | Initiative, approval, release, incident, scheduled review, and long-running process lifecycles |
| Hot entity state | Dapr Actors | Hat supply, agent session context, team rooms, mailboxes, meeting state, run heartbeat coordination |
| Kubernetes hat contracts | `@kubernetes/client-node`, generated or hand-checked CRD types | TypeScript-first access to `Hat`, `HatBinding`, `HatSwap`, and `HatPolicy` without redefining the hat API |
| Testing | Vitest, Playwright, Testcontainers | Domain/unit tests, browser QA automation, real CockroachDB/NATS integration tests |
| Observability | OpenTelemetry JS, Pino, Prometheus metrics | End-to-end traces across API, workflows, actors, MCP tools, NATS, pods, and UI evidence |
| Delivery | Docker images, Helm or Kustomize, ArgoCD, GitLab CI | Initiative branch builds, preview/QA deployments, GitOps promotion into the cluster |

Default app layout:

```text
apps/
  api/                 NestJS Organization API and internal control-plane endpoints
  web/                 Next.js operations console
  workers/             schedulers, reconcilers, rules, NATS consumers
  temporal-worker/     Temporal TypeScript workers
  dapr-actors/         Dapr actor service
  mcp-gateway/         separate MCP gateway when API shell becomes too large

packages/
  domain/              typed entities, enums, events, commands, value objects, state machines
  db/                  Drizzle schema, migrations, repositories, projections
  messaging/           NATS, outbox, inbox, DLQ, event contracts
  policy/              RBAC, OPA/Rego policy contracts, authorization decisions
  hats/                hat graph, assignment, JWT issuance/refresh, supply policies
  workflows/           Temporal workflow and activity definitions
  actors/              Dapr actor interfaces and shared actor contracts
  k8s-hats/            CRD types, watch helpers, HatSwap codecs, projection clients
  mcp/                 tool registry, tool schemas, policy-checked handlers
  memory/              Hindsight adapter, attribution, scoped recall/write contracts
  hermes/              Hermes session adapter, run adapter, context builder
  observability/       tracing, logging, metrics, health checks, evidence helpers
  ui/                  shared UI primitives for the operations console
  sdk/                 typed client for UI, agents, and internal workers
  adapters-agentic-services/
                       temporary wrappers for selectively reused agentic-services primitives
```

Start as one repository and one deployable product made of multiple processes. Do not split into many microservices until the domain boundaries have proven themselves through real Organization workflows.

Initial implementation should not start with GraphQL, Dapr Workflow, or a broad service mesh abstraction inside the app. Use REST/OpenAPI, Temporal for durable workflows, Dapr Actors for narrow hot-state actors, Orleans for .NET grain/silo workloads where those semantics are required, NATS for events, and OpenZiti/Cilium at the cluster layer.

NestJS does not replace Orleans. NestJS is the TypeScript composition shell for APIs, workers, policy checks, and adapters. Orleans remains a cluster-resident distributed-cron/virtual-actor primitive that the TypeScript app can call through an explicit adapter when a workflow needs Orleans grain semantics.

### Nest Orchestrator Composition

The TypeScript architecture should use many shared npm packages and relatively thin NestJS orchestrator apps.

Shared packages own reusable capability logic:

- domain entities, enums, value objects, state machines, and events;
- policy contracts and authorization decisions;
- repositories, migrations, outbox, idempotency, and projections;
- NATS event contracts and consumers;
- Temporal workflow/activity definitions;
- Dapr actor contracts;
- Kubernetes hat CRD clients, informers, and event codecs;
- MCP tool schemas and handlers;
- Hindsight, Hermes, OpenZiti, Credential Proxy, and observability adapters.

NestJS apps compose those packages into runnable orchestrators:

- `apps/api` orchestrates HTTP/internal APIs, guards, OpenAPI, and request-scoped policy checks;
- `apps/workers` orchestrates schedulers, reconcilers, durable triggers, rules, and NATS consumers;
- `apps/temporal-worker` hosts workflow workers and wires activities to package services;
- `apps/dapr-actors` hosts actor implementations and binds actor state to package contracts;
- `apps/mcp-gateway` exposes MCP tools and resolves actor/session/hat context before delegating to package handlers.

Cluster-owned operator code may live under `full-ai-cluster/k8s/applications/hat-system/operator-ts/` rather than inside the app monorepo. It should still consume the same TypeScript contracts from the Organization package layer when that dependency boundary is available, or mirror generated CRD types with a parity test until package sharing is stable.

The rule: packages should contain the reusable business and infrastructure capability; Nest orchestrators should wire lifecycle, dependency injection, transport adapters, health checks, and process concerns. Do not bury Organization rules directly inside controllers or worker entrypoints.

### Orleans Composition

Orleans should be treated as an existing cluster primitive, not an accidental duplicate of NestJS.

Use Orleans when:

- a .NET grain model is already the best fit;
- the work benefits from Orleans silo locality or grain identity;
- the cluster-level distributed-cron design explicitly routes through Orleans.

Use NestJS when:

- the Organization needs HTTP/OpenAPI, MCP, worker, or UI-facing process orchestration;
- the logic belongs in shared TypeScript packages;
- the flow coordinates CockroachDB, NATS, Temporal, Dapr, Hermes, Hindsight, and Credential Proxy adapters.

Integration shape:

```text
NestJS orchestrator
  -> shared npm package contract
  -> Orleans adapter
  -> Orleans grain/silo
  -> Organization signal/audit projection
```

No implementation should silently move long-running state from Orleans to NestJS or from NestJS to Orleans. That boundary needs an explicit design note or ADR.

## Organization Layer Services

| Service | Purpose | Makes these hats effective |
|---|---|---|
| Organization Kernel | Authoritative state transitions, policy checks, audit events, outbox events | All hats |
| Hat Graph Service | Defines hats, departments, assignment rules, approval scopes, supply, TTLs, reporting lines | Executive Board, Directors, Engineering Managers, Hat Designer |
| Agent Registry Service | Tracks Hermes agents, active sessions, memory profiles, specialties, current hats, cost, reliability | Directors, TPMs, Engineering Managers, Memory hats |
| Assignment and Staffing Service | Ranks agents for hats, reserves hat supply, assigns agents to teams/tasks, handles release and deprovisioning | Directors, TPMs, Engineering Managers, Cost Controller |
| Work Management Service | Owns projects, initiatives, tasks, defects, service requests, blockers, queues, lifecycle state | TPMs, Product, BA, Engineering, QA, Delivery |
| Gate and Review Service | Owns readiness, BRD, architecture, code, QA, security, delivery, memory, and outcome gates | Review hats and managers |
| Department Runtime Service | Maintains department rules, queues, schedules, standing meetings, director reports, escalation paths | Directors and department managers |
| Meeting and Communication Service | Provides inboxes, reports, broadcasts, one-on-one chats, team rooms, meeting modes, decisions, and mandatory work anchors for every discussion | All hats, especially TPMs, directors, executives |
| Documentation Context Service | Organizes BRDs, CAs, ADRs, design docs, project docs, repo docs, and required context by scope | Product, BA, Architecture, Engineering, QA, Reviewers |
| Project Skill Service | Stores project/repo skills with frontmatter, graph links, review state, deprecation, and ingestion | Engineering Managers, Documentation hats, Memory hats |
| Memory Scope Service | Mediates Hindsight recall/write attribution by agent, hat, project, task, team, and meeting | Memory hats, all execution hats |
| Tool and Credential Gateway | Authorizes MCP tools and credential proxy use using actor context, hat policy, OPA, and audit | Security, all tool-using hats |
| Oz/Hermes Run Service | Creates and binds Hermes/Oz runs to tasks, teams, hats, pods, sessions, logs, artifacts | TPMs, Engineering Managers, Operations |
| Automation Runtime Service | Runs triggers, rules, reaction plans, schedules, leases, timers, and replay-safe workers | Operations, Scheduler Steward, Trigger Steward |
| Capability Expansion Service | Accepts requests for tools, workflows, actors, hats, docs, skills, and credentials; routes approvals | Engineering Managers, Directors, Security, Architecture |
| Observability and Evidence Service | Captures traces, logs, metrics, screenshots, artifacts, timelines, SLOs, audit events | Operations, QA, Reviewers, UI |
| Performance and Learning Service | Runs team reviews, hat effectiveness reviews, outcome reviews, memory adaptation, process improvements | Engineering Managers, Directors, Memory, Executives |
| UI Projection Service | Builds read models for humans to watch work, meetings, runs, pods, gates, decisions, and health | Humans, executives, operators |

## Role Workspaces

Every active hat should open into a role-specific workspace. A workspace is the agent-facing and human-facing surface for the role.

### Common Workspace Elements

- Role brief: current hat, department, scope, reporting chain, active policies, token TTL, and current assignment.
- Work queue: tasks, reports, gates, reviews, meetings, incidents, or capability requests relevant to the hat.
- Discussion anchor: the current project, initiative, task, defect, review, incident, release, policy, capability request, or context gap that justifies a meeting/thread/broadcast.
- Required context: documents, memories, project skills, artifacts, traces, and prior decisions the hat must consider.
- Allowed tools: MCP tools available under the current hat and why each is available.
- Blocked tools: MCP tools denied under the current hat with escalation path.
- Inbox: direct messages, reports, meeting invites, escalations, and broadcasts.
- Decision log: votes, approvals, rejections, gate outcomes, and rationale.
- Evidence panel: artifacts, screenshots, logs, traces, test runs, workflow events, and runtime links.
- Performance panel: recent outcomes, bounce-backs, defects, memory quality findings, and improvement recommendations.

### Workspace Examples

| Hat | Workspace focus |
|---|---|
| Executive Board Member | Portfolio queue, high-risk votes, department health, budget pressure, major escalations, policy changes |
| CEO | Project priorities, customer value, cross-department blockers, executive decisions, org efficiency |
| CTO | Technical standards, architecture review load, engineering quality, runtime strategy, tool expansion risk |
| COO | Operating rhythm, capacity, schedules, incidents, delivery flow, department coordination |
| Product Owner | Customer interviews, BRDs, acceptance criteria, product signoff queue, feedback reports |
| Business Analyst | Ambiguous goals, open questions, BRD drafts, source evidence, domain research |
| Architect | BRDs awaiting CA, design docs, ADR queue, architecture risks, integration constraints |
| TPM | Initiative plan, active teams, task boards, blockers, hat supply, budget, meeting rooms |
| Engineering Manager | Ready queue, team staffing, task context, TDD evidence, outcome reviews, performance reviews |
| Implementer | Assigned task, red-test requirement, docs/memory context, scoped tools, run logs, review feedback |
| Code Reviewer | Review queue, diff evidence, tests, scope boundaries, policy/doc compliance |
| QA Reviewer | QA queue, acceptance criteria, browser checks, screenshots, reproduction evidence, bounce-back reports |
| Security Reviewer | Credential requests, tool expansion, policy diffs, audit traces, risky automation queue |
| Release Operator | Release queue, upstream gate evidence, deployment logs, rollback plans, final release records |
| Memory Curator | Memory quality issues, stale memories, missing recall, hat-attributed writes, adaptation requests |
| Platform Operator | Worker heartbeats, leases, Oz runs, pod sessions, DLQs, SLO burn, incidents |
| Hat Designer | Hat proposals, tool bundles, memory scopes, approval scopes, supply rules, effectiveness data |

## Authoritative State Model

The Organization DB must capture the full operating reality. The first schema needs enough structure to make hats real.

### Identity and Authority

- `agents`: Hermes agent identity, status, cost profile, model/runtime capabilities.
- `agent_sessions`: active runtime sessions, Oz run IDs, pod bindings, heartbeat, current context.
- `departments`: department records, reporting line, active rules, owner hats.
- `hat_definitions`: role authority, tool bundles, approval scopes, memory scopes, credential scopes, voting scopes.
- `hat_assignments`: agent, hat, project/team/task scope, token TTL, status, assigned by, released by.
- `hat_supply_policies`: max concurrent assignments, scarcity rules, reserve pools, budget class.
- `hat_tokens`: issued JWT metadata, refresh state, revocation state, actor binding.

### Work and Lifecycle

- `projects`: long-lived product or platform areas.
- `initiatives`: executive/director-prioritized work packages.
- `work_items`: tasks, defects, service requests, reports, capability requests.
- `work_item_states`: state transition history with actor, hat, policy, and evidence.
- `blockers`: blocked work with owner, severity, escalation target, timeout.
- `dependencies`: work-to-work, initiative-to-initiative, project-to-project dependencies.
- `gates`: BRD, architecture, code review, QA, security, delivery, memory, outcome gates.
- `gate_decisions`: approval/rejection, rationale, evidence links, reviewer hat assignment.

### Communication and Decisions

- `inboxes`: agent, hat, team, department, and organization inboxes.
- `messages`: typed messages, reports, escalations, broadcasts, and decision notices.
- `discussion_anchors`: immutable opening anchors for meetings, one-on-ones, broadcasts, votes, reports, review comments, and conversation threads.
- `conversation_threads`: one-on-one, team, department, executive, incident, and review threads with mandatory anchors.
- `meetings`: scheduled or ad hoc meetings with scope, mode, facilitator, participants, anchors, decisions.
- `votes`: voting scope, eligible hats, quorum, options, close policy, result.
- `decisions`: durable decision records linked to votes, gates, meetings, docs, tasks, and policies.

### Context and Knowledge

- `documents`: BRDs, CAs, ADRs, design docs, runbooks, reports, postmortems, project docs.
- `document_requirements`: docs required before work can enter a state.
- `project_skills`: project/repo skill metadata, frontmatter, review state, graph links.
- `memory_events`: memory read/write requests, effective scope, hat attribution, Hindsight reference.
- `memory_adaptation_requests`: requested memory changes from reviews or failures.
- `artifact_links`: screenshots, logs, traces, test output, evidence packages.

### Runtime and Automation

- `mcp_tool_calls`: tool ID, actor context, policy decision, result, trace ID, artifact links.
- `credential_requests`: requested scope, business need, reviewer, approval state.
- `oz_runs`: bound Hermes/Oz sessions, parent/child runs, pod, status, budget, artifacts.
- `automation_rules`: organization, department, project, initiative, team, hat, and task rules.
- `durable_triggers`: event, state, timeout, schedule, threshold, and external triggers.
- `reaction_plans`: deterministic rule output before side effects execute.
- `runtime_leases`: lease owner, fencing token, heartbeat, expiration, release reason.
- `dead_letters`: failed events/messages, classification, quarantine, replay/discard decision.
- `worker_heartbeats`: always-on worker status and health.

### Feedback and Improvement

- `outcome_reviews`: whether work met goal, acceptance criteria, doc compliance, and quality expectations.
- `performance_reviews`: agent/hat/team performance assessments and improvement actions.
- `hat_effectiveness_reviews`: whether a hat definition has the right authority, tools, memory, and supply.
- `department_reviews`: scheduled department-level reviews and follow-up backlog items.
- `observability_gaps`: missing traces, logs, metrics, dashboards, or evidence.
- `capability_requests`: requested tools, workflows, actors, skills, docs, memory changes, credentials.

## Automation Loops

The Organization layer should run a set of durable loops. These loops are how hats stay active without manually polling.

### Work Intake Loop

```text
goal/report/SR submitted
  -> classify intent and scope
  -> route to Product, Business, Security, Operations, or Executive triage
  -> create project/initiative/task/defect/capability request
  -> attach required context and owner department
  -> emit state event
```

This makes Product, Business Analysis, Security, Operations, and Executive hats shine because their queue is populated with the right work type instead of a generic pile.

### Initiative Formation Loop

```text
approved goal or backlog item
  -> Executive or Director prioritizes
  -> TPM assigned
  -> Product/BA/Architecture gates required
  -> task breakdown proposed
  -> hat supply and budget reserved
  -> team created
```

This gives TPMs a deterministic mission-control environment with budget, staffing, blockers, and gates already visible.

### Task Readiness Loop

```text
task created or updated
  -> check required BRD/CA/ADR/project docs
  -> check acceptance criteria
  -> check memory/project-skill attachments
  -> check security/runtime risk
  -> assign readiness reviewer
  -> mark ready or bounce to missing owner
```

This is the loop that makes Engineering Managers valuable. They organize conditions for success before implementers start.

### Execution Loop

```text
ready task
  -> rank agents for needed hats
  -> reserve hat supply
  -> issue hat tokens
  -> create Hermes/Oz run
  -> bind run to task/team/agent/session
  -> monitor progress and tool calls
  -> collect evidence
```

This lets implementers work in a scoped environment with the right docs, memory, tools, credentials, and observability.

### Review and Gate Loop

```text
work submitted
  -> request scoped reviewers
  -> validate required evidence
  -> run gate-specific checks
  -> approve, reject, or request clarification
  -> emit next state event
```

This is where Code Reviewer, Architecture Reviewer, Security Reviewer, QA Reviewer, and Delivery Reviewer hats each get their own queue, criteria, and evidence.

### QA and Reproducibility Loop

```text
code review approved
  -> assign QA reviewer
  -> load acceptance criteria and original report
  -> run browser/API/manual-style automation
  -> attach screenshots, traces, logs, exact steps
  -> sign off or bounce back as reproducible
```

The important distinction: QA failure is not merely "QA failed." It is "the issue remains reproducible" or "acceptance criteria were not met," with evidence linked to the work item.

### Delivery Loop

```text
all required gates approved
  -> delivery reviewer checks evidence chain
  -> confirm initiative branch QA signoff
  -> confirm CI/CD, deployment, rollback, and observability automation evidence
  -> release manager determines release impact
  -> merge initiative branch to main or execute release action
  -> verify system build
  -> release evidence recorded
  -> outcome review scheduled
```

This prevents Delivery from being a blind final button. It becomes an evidence and risk checkpoint.

### Department Review Loop

```text
scheduled department review
  -> inspect team outcomes, blocked work, budget, quality, memory, tools
  -> identify repeated failure patterns
  -> create performance reviews, memory adaptation requests, or capability requests
  -> prioritize through department backlog
```

This loop is the bridge from "agents did work" to "the organization learned something."

### Capability Expansion Loop

```text
agent or manager requests new capability
  -> classify as hat/tool/workflow/actor/credential/doc/skill/memory
  -> manager triages
  -> director prioritizes
  -> Architecture reviews runtime/API/state impact
  -> Security reviews authority/data/credential risk
  -> implementation task created
  -> tests/docs/policies added
  -> capability activated in registry
```

This is how the Organization becomes self-building while staying governed.

### Runtime Health Loop

```text
worker heartbeat, SLO, trace, DLQ, pod, or Oz anomaly detected
  -> classify anomaly
  -> create health report, incident, or self-healing plan
  -> validate lease, budget, policy, and blast radius
  -> execute safe remediation or escalate
  -> record outcome and create follow-up backlog if needed
```

This is the always-on control plane that keeps the Organization awake even when no Hermes agent is actively chatting.

## Department Runtime Contracts

Every department should have a runtime contract. This prevents departments from becoming just labels.

```ts
type DepartmentRuntimeContract = {
  departmentId: string;
  directorHatIds: string[];
  managerHatIds: string[];
  defaultQueues: string[];
  standingMeetings: string[];
  scheduledReviews: string[];
  ownedStateMachines: string[];
  ownedGateTypes: string[];
  ownedRuleScopes: string[];
  escalationTargets: string[];
  requiredDashboards: string[];
  requiredSloCategories: string[];
};
```

Examples:

- Product owns discovery queues, customer interview schedules, BRD signoff queues, product acceptance criteria, and feedback triage.
- Architecture owns CA/ADR queues, architecture review gates, runtime design reviews, and architecture standards.
- Engineering Management owns readiness queues, blocked task escalation, team performance reviews, memory/context sufficiency, and TDD compliance.
- QA owns verification queues, reproducibility reports, browser evidence, QA signoff, and bounce-back workflow.
- Operations owns runtime leases, worker health, DLQs, SLOs, incidents, self-healing policy, and runbooks.
- Memory owns memory quality queues, adaptation requests, scope audits, and Hindsight integration quality.

## Hat Activation Contract

When an agent receives a hat, the platform should create an activation packet.

```ts
type HatActivationPacket = {
  agentId: string;
  hatAssignmentId: string;
  hatId: string;
  departmentId: string;
  scope: {
    projectId?: string;
    initiativeId?: string;
    teamId?: string;
    taskId?: string;
    meetingId?: string;
    runId?: string;
  };
  authorityBrief: string;
  responsibilities: string[];
  allowedToolIds: string[];
  blockedToolIds: string[];
  memoryScopes: string[];
  credentialScopes: string[];
  requiredDocuments: string[];
  requiredArtifacts: string[];
  activePolicies: string[];
  escalationPath: string[];
  tokenExpiresAt: string;
};
```

Hermes should receive this packet at run start and after token refresh. MCP tools should also derive it server-side through actor context so the agent prompt and the infrastructure agree.

## Role-Specific Automation Requirements

| Role family | Automation required |
|---|---|
| Executives | Portfolio health rollups, high-risk vote queue, department performance reports, budget and hat scarcity alerts |
| Directors | Department backlog, initiative priority queue, staffing recommendations, department review cadence, cross-department escalations |
| TPMs | Initiative boards, dependency maps, blocker alerts, team creation, meeting scheduling, budget/hat supply warnings |
| Product | Interview scheduling, BRD readiness alerts, acceptance criteria gap detection, feedback/SR classification |
| BA | Ambiguity detection, missing evidence alerts, BRD review routing, open-question tracking |
| Architecture | Architecture-required detection, CA/ADR queues, design risk classification, runtime/API/security-boundary alerts |
| Engineering Managers | Task readiness checks, TDD gate enforcement, memory/context gap detection, performance reviews, skill requests |
| Implementers | Scoped task packets, red-test requirement, tool/credential availability, run progress capture, evidence submission |
| Reviewers | Review queue, evidence completeness check, self-approval block, decision templates, bounce-back routing |
| QA | Reproducibility workflows, browser automation runs, screenshot/log/trace capture, scheduled regression triggers |
| Security | Credential/tool request queue, policy diff review, audit trail inspection, dangerous automation classification |
| Delivery | Release readiness checks, gate evidence chain, merge/release audit record, rollback plan requirement |
| Operations | Worker health, leases, DLQ, SLOs, incidents, self-healing decisions, runbook execution |
| Memory | Hat-attributed memory writes, stale memory detection, repeated-failure analysis, memory adaptation review |
| Documentation and Skills | Required doc checks, skill frontmatter validation, skill graph ingestion, stale doc alerts |
| Capability Expansion | Request classification, approval routing, implementation task creation, registry activation, post-activation monitoring |

## MCP Tool Execution Path

All role automation depends on tool calls being actor-aware.

```text
Hermes agent calls MCP tool
  -> MCP gateway extracts session token
  -> AgentSessionActor resolves effective agent/session/hat/team/task/run
  -> Organization Kernel loads active HatAssignment
  -> Policy service evaluates RBAC/OPA/domain preconditions
  -> Tool service checks tool-specific invariants
  -> State transition or side effect occurs
  -> Audit, trace, artifact, and outbox event are written
  -> AgentSessionActor records activity and token refresh needs
```

This lets agents run tools while the system always knows who acted, under which hat, against which scope, and with which authority.

## UI Needed to Make Roles Shine

The UI should not be only a dashboard. It should be the human-readable projection of the Organization runtime.

Initial UI surfaces:

- Organization map: departments, reporting lines, active hats, current agents, supply, and scarcity.
- Work map: projects, initiatives, tasks, defects, service requests, capability requests, gates, blockers.
- Role workspace: a live view of the queues and authority for any selected hat.
- Mission control: active teams, Oz/Hermes runs, pods, sessions, logs, messages, decisions.
- Review center: gate queues, required evidence, approvals, rejections, bounce-backs.
- Meeting center: scheduled meetings, active rooms, mode, participants, decisions, follow-up actions.
- Runtime operations: triggers, rules, reaction plans, workers, leases, DLQs, SLOs, incidents.
- Memory and skills: memory scopes, Hindsight profiles, memory changes, skill graph, stale context.
- Capability expansion: requested tools, credentials, workflows, actors, hats, docs, skills, approval path.
- Evidence explorer: traces, logs, screenshots, artifacts, timelines, audit events.

## MVP Build Sequence

### Phase 1: Organization Kernel and Hat Graph

Build:

- departments;
- hat definitions;
- hat assignments;
- hat tokens;
- policy checks;
- audit/outbox;
- actor-aware MCP gateway path;
- basic UI for hats and assignments.

Proof:

- an agent can receive a scoped hat;
- tool access changes by hat;
- JWT refresh revokes authority after deprovision;
- every tool call records hat attribution.

### Phase 2: Work Management and Gate Runtime

Build:

- projects, initiatives, tasks, defects, service requests;
- task and initiative state machines;
- gate records and gate decisions;
- evidence links;
- review queues.

Proof:

- work moves from intake to ready to implementation to review to QA to done;
- implementers cannot approve themselves;
- missing BRD/CA/QA evidence blocks the right transitions.

### Phase 3: Role Workspaces and Communication

Build:

- inboxes;
- reports;
- broadcasts;
- one-on-one and team chats;
- meetings;
- discussion anchor validation;
- votes;
- role-specific queues.

Proof:

- a TPM can create a team and meeting;
- a reviewer receives the right gate queue;
- executive votes and department escalations are durable decisions.
- unanchored meetings, threads, and broadcasts are rejected;
- executive meetings anchor to project/initiative/policy, TPM meetings anchor to initiatives/missions, and developer discussions anchor to tasks/defects/reviews.

### Phase 4: Oz/Hermes Runtime Binding

Build:

- run bindings;
- session actor records;
- parent/child run links;
- pod/session heartbeat ingestion;
- artifact/log/trace links;
- budget and hat supply checks before spawning.

Proof:

- Organization launches Hermes work through Oz;
- child runs are bound to tasks and hats;
- stopped or silent runs are reconciled;
- hat supply is released when runs complete or expire.

### Phase 5: Always-On Automation

Build:

- durable triggers;
- rules;
- reaction plans;
- leases;
- workers;
- scheduler;
- DLQ;
- SLOs;
- runtime health reports.

Proof:

- a ready task automatically triggers staffing;
- a silent run escalates;
- a blocked task triggers manager review;
- a scheduled QA regression creates evidence and defects.

### Phase 6: Memory, Documentation, and Skills

Build:

- Hindsight scoped adapter;
- memory event attribution;
- documentation context;
- project skill graph;
- doc and skill review gates.

Proof:

- memory reads/writes are attributed by hat;
- task packets include required docs and memories;
- stale or missing documentation blocks readiness;
- project skills can be proposed, reviewed, ingested, and used.

### Phase 7: Capability Expansion

Build:

- capability request flow;
- credential request flow;
- workflow registry;
- actor registry;
- MCP registry;
- post-activation monitoring.

Proof:

- an agent can request a new tool;
- Engineering Manager triages it;
- Security and Architecture review it;
- implementation work is created;
- registry activation makes the new capability available to scoped hats.

### Phase 8: Performance and Self-Improvement

Build:

- outcome reviews;
- performance reviews;
- hat effectiveness reviews;
- department reviews;
- memory adaptation;
- process improvement backlog.

Proof:

- repeated QA bounce-backs create improvement work;
- bad memory/context outcomes produce memory adaptation requests;
- ineffective hat definitions produce hat redesign proposals;
- department reviews become prioritized backlog.

## First Concrete Slice

The first valuable slice should prove the whole shape with one narrow lifecycle:

```text
Human submits goal
  -> Product/BA clarifies and creates BRD
  -> Architect creates CA
  -> TPM creates initiative and tasks
  -> Engineering Manager marks one task ready
  -> Implementer Hermes agent runs via Oz
  -> Code Reviewer approves or rejects
  -> QA runs browser verification and attaches evidence
  -> Delivery marks done
  -> Outcome review creates memory or capability follow-up
```

The slice should include:

- real departments and hats;
- real hat tokens;
- actor-aware MCP tools;
- one Oz/Hermes run binding;
- one task state machine;
- one BRD gate;
- one CA gate;
- one code review gate;
- one QA gate;
- one evidence chain;
- one outcome review;
- UI read models for each step.

This gives us a small Organization that already behaves like the larger one.

## Design Guardrails

- The platform should create structure, not replace agent reasoning.
- Agents can propose changes to the Organization, but policy decides whether those changes activate.
- Every automation action must be traceable to a rule, trigger, hat, actor, and state transition.
- Every role must have a queue and cadence. Ownerless automation should be treated as a defect.
- Every approval must have evidence and scope. Broad authority should be rare, expiring, and visible.
- Every failure should create one of: evidence, defect, memory adaptation, capability request, or explicit no-action decision.
- The UI should show the Organization acting, not just database rows.
