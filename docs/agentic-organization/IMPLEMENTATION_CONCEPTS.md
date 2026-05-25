# Hermes Organization Runtime - Implementation Concepts

## Purpose

This document turns the current Organization architecture into an implementation plan.

It assumes the conceptual model from `ORGANIZATION_RUNTIME_ARCHITECTURE.md`:

- Oz/Warp is the macro-orchestrator for distributed Hermes agent runs.
- OpenZiti is the secure transport/connectivity layer in the cluster context, not the workflow engine.
- Hermes agents are the reasoning and work layer.
- Hats are role/capability/policy assignments, not memory.
- Hindsight stores long-term memory with Organization-controlled hat attribution.
- The Organization Control Plane owns truth, policy, task management, meetings, votes, artifacts, reviews, and prioritization.
- k3s, Docker, Cilium Service Mesh, SPIRE, Vault, External Secrets, NATS/JetStream, MCP, credential proxy, and the Organization API form the execution and communication substrate.

## Implementation Principle

The platform should be agentic, but the state transitions should be explicit.

Agents propose, request, discuss, vote, and perform work through tools.

The Organization Control Plane validates, persists, authorizes, routes, and records.

```text
Hermes agent intent
  -> MCP tool call
  -> Organization policy check
  -> state transition / Oz run / NATS message / credential proxy request
  -> persisted event and audit record
```

Avoid implementing a huge hard-coded corporation. Build small primitives that let the corporation operate:

- hats;
- assignments;
- projects;
- initiatives;
- tasks;
- reports;
- meetings;
- votes;
- artifacts;
- reviews;
- inbox/outbox;
- memory attribution;
- Oz run bindings.

## Bounded Contexts

### Organization Identity

Owns agents, hats, departments, hierarchy, and assignments.

Core entities:

- `Agent`
- `Hat`
- `HatAssignment`
- `Department`
- `DepartmentDirectorAssignment`
- `ExecutiveAssignment`
- `AgentSpecialtyProfile`
- `HatSupplyPolicy`

Primary services:

- `AgentRegistryService`
- `HatRegistryService`
- `HatAssignmentService`
- `HierarchyService`
- `AgentFitService`

### Authorization and Policy

Owns short-lived hat authorization, RBAC, OPA policy, and tool scope checks.

Core entities:

- `HatToken`
- `PolicyVersion`
- `ToolPermission`
- `CredentialScopeGrant`
- `MemoryScopeGrant`
- `AuthorizationAuditEvent`

Primary services:

- `HatTokenService`
- `PolicyDecisionService`
- `ToolAuthorizationService`
- `CredentialScopeService`

### Work Management

Owns projects, portfolios, initiatives, missions, work items, tasks, backlog, defects, and service requests.

Core entities:

- `Project`
- `Portfolio`
- `Initiative`
- `Mission`
- `WorkItem`
- `Task`
- `Subtask`
- `BacklogItem`
- `Defect`
- `ServiceRequest`
- `Dependency`
- `Blocker`

Primary services:

- `ProjectService`
- `InitiativeService`
- `TaskBoardService`
- `BacklogService`
- `DefectTriageService`
- `ServiceRequestService`

### Meetings and Communication

Owns messages, reports, inboxes, meetings, conversation modes, broadcasts, and escalations.

Core entities:

- `Inbox`
- `InboxMessage`
- `Report`
- `Thread`
- `Meeting`
- `MeetingParticipant`
- `ConversationMode`
- `Broadcast`
- `Escalation`

Primary services:

- `InboxService`
- `ReportService`
- `MeetingService`
- `ThreadService`
- `EscalationService`
- `NatsEventBridge`

### Governance and Decisions

Owns votes, approvals, reviews, gates, standards, and executive/director decisions.

Core entities:

- `Vote`
- `VoteBoard`
- `Decision`
- `Gate`
- `Review`
- `OutcomeReview`
- `PerformanceReview`
- `Standard`
- `PolicyChangeRequest`

Primary services:

- `VotingService`
- `GateService`
- `ReviewService`
- `PerformanceReviewService`
- `StandardService`

### Agent Runtime

Owns Hermes session containers, Oz run mappings, agent execution state, and runtime health.

Core entities:

- `AgentSession`
- `OzRunBinding`
- `RuntimeLease`
- `ContainerSpec`
- `RunArtifact`
- `RunLogPointer`

Primary services:

- `OzAdapter`
- `HermesSessionService`
- `RuntimeLeaseService`
- `RunStatusService`

### Memory

Owns the adapter around Hindsight and the Organization-specific attribution model.

Core entities:

- `MemoryAttribution`
- `MemoryActivation`
- `MemoryScope`
- `MemoryAdaptationRequest`
- `MemoryReview`

Primary services:

- `MemoryAdapter`
- `MemoryScopeService`
- `MemoryAttributionService`
- `MemoryReviewService`

### Artifacts and Evidence

Owns BRDs, CAs, screenshots, logs, traces, red/green test evidence, QA reports, review artifacts, and delivery evidence.

Core entities:

- `Artifact`
- `ArtifactRequirement`
- `EvidencePackage`
- `BRD`
- `CA`
- `TestEvidence`
- `QaReport`
- `DeliveryEvidence`

Primary services:

- `ArtifactService`
- `EvidenceService`
- `DocumentArtifactService`
- `QaEvidenceService`

### Documentation and Project Skills

Owns project-scoped documentation, architecture records, repo/project skills, graph ingestion, and lifecycle enforcement.

Core entities:

- `DocumentationArtifact`
- `DocumentationScope`
- `ADR`
- `DesignDoc`
- `BRD`
- `CA`
- `ProjectSkill`
- `SkillFrontmatter`
- `SkillGraphEdge`
- `DocumentationRequirement`

Primary services:

- `DocumentationService`
- `AdrService`
- `DesignDocService`
- `ProjectSkillService`
- `SkillGraphIngestionService`
- `DocumentationContextService`

## Suggested Backend Shape

Use NestJS as the Organization Control Plane shell.

Recommended modules:

```text
OrganizationModule
  IdentityModule
  PolicyModule
  WorkModule
  MeetingsModule
  GovernanceModule
  RuntimeModule
  MemoryModule
  ArtifactsModule
  DocumentationModule
  ProjectSkillsModule
  McpGatewayModule
  ReportsModule
  SchedulingModule
  ObservabilityModule
```

Each module should expose internal services and MCP-facing tool handlers.

MCP handlers should be thin:

```text
validate request shape
  -> authenticate hat token
  -> authorize tool
  -> call domain service
  -> persist event/audit
  -> return structured result
```

## Source of Truth

Pick one primary database at the start.

Recommendation: use CockroachDB first for Organization-owned state. The Organization needs relational queries across projects, initiatives, tasks, agents, hats, assignments, votes, reviews, audit events, outbox records, and projections, and CockroachDB fits the cluster's distributed SQL direction.

Use JSON columns for flexible agent/tool payloads where needed, but keep core lifecycle state typed.

NATS/JetStream is not the source of truth. It is the event and message transport.

Oz metadata is not the source of Organization truth. It is the source for run lifecycle and execution artifacts.

Hindsight is not the source of execution truth. It is long-term memory.

## Core Tables

Initial relational model:

```text
agents
hats
hat_edges
hat_supply_policies
hat_assignments
hat_assignment_tokens
agent_hat_performance
departments
department_director_assignments
projects
portfolios
initiatives
missions
work_items
tasks
task_dependencies
blockers
backlog_items
defects
service_requests
reports
inboxes
inbox_messages
messages
threads
meetings
meeting_participants
meeting_decisions
votes
decisions
reviews
gates
artifacts
artifact_links
artifact_requirements
documentation_artifacts
documentation_scopes
adrs
design_docs
project_skills
skill_graph_edges
documentation_requirements
memory_attributions
memory_scope_rules
memory_adaptation_requests
oz_run_bindings
runtime_leases
teams
team_members
credential_scope_grants
credential_scope_requests
capability_requests
capability_request_reviews
capability_implementations
credential_proxy_endpoint_requests
credential_proxy_endpoint_registry
workflow_capability_requests
workflow_registry
actor_capability_requests
actor_registry
tool_audit_events
audit_events
trace_records
span_records
metric_observations
health_reports
anomaly_reports
self_healing_attempts
observability_coverage
organizational_rules
rule_evaluations
reaction_plans
durable_triggers
trigger_executions
trigger_checkpoints
outbox_events
worker_heartbeats
dead_letter_messages
dead_letter_investigations
replay_requests
quarantine_decisions
discard_decisions
watcher_checkpoints
reconciliation_findings
slo_definitions
slo_measurements
incident_reports
incident_assignments
runbook_skills
human_overrides
standards
scheduled_jobs
```

Keep these concepts distinct:

- `BacklogItem`: uncommitted potential work.
- `WorkItem`: planned deliverable unit of value.
- `Task`: executable assignment for one or more hats/agents.
- `Mission`: temporary coordinated delivery grouping under an initiative.
- `OzRunBinding`: external execution run linked back to Organization-owned work.

Core lifecycle/status fields should use enums, not loose strings:

- project status;
- initiative status;
- work item status;
- task status;
- report type/status;
- review verdict;
- gate type/status;
- vote status/decision;
- meeting type/status;
- inbox type;
- hat assignment status;
- artifact type;
- memory visibility;
- trace/span status;
- metric type;
- health status;
- anomaly type/status;
- self-healing action/status;
- observability coverage status;
- rule evaluation status;
- reaction plan status;
- trigger type/status;
- dead-letter status;
- incident severity/status;
- SLO burn status;
- human override status;
- capability request type/status;
- capability review verdict;
- workflow registry status;
- actor registry status;
- credential proxy endpoint status.

## Event Model

Every important state transition should produce a domain event.

Examples:

```text
HatAssigned
HatTokenRefreshed
HatDeprovisioned
ProjectCreated
InitiativeCreated
TpmAssigned
TaskCreated
TaskMarkedReady
RedTestsSubmitted
GreenTestsSubmitted
ReviewRequested
ReviewApproved
QaIssueStillReproducible
QaSignedOff
MeetingOpened
VoteSubmitted
DecisionRecorded
MemoryAdaptationRequested
OzRunStarted
OzRunCompleted
CredentialScopeApproved
CapabilityRequestSubmitted
CapabilityRequestTriaged
CapabilityRequestApproved
CapabilityRequestRejected
CredentialProxyEndpointRequested
CredentialProxyEndpointApproved
WorkflowCapabilityRequested
WorkflowRegistered
ActorCapabilityRequested
ActorRegistered
McpToolCalled
PolicyEvaluated
TraceLinked
HealthReportCreated
AnomalyDetected
SelfHealingAttempted
SelfHealingSucceeded
SelfHealingEscalated
ObservabilityGapDetected
OrganizationalRuleMatched
OrganizationalRuleSkipped
ReactionPlanCreated
ReactionPlanExecuted
DurableTriggerFired
ScheduledJobClaimed
RuntimeLeaseAcquired
RuntimeLeaseExpired
DeadLetterCreated
DeadLetterReplayRequested
IncidentOpened
IncidentCommanderAssigned
SloErrorBudgetBurned
```

Events should include:

- event ID;
- organization ID;
- project/initiative/task context when available;
- agent ID;
- active hat assignment ID;
- Oz run ID when available;
- timestamp;
- payload;
- correlation ID;
- causation ID;
- trace ID;
- span ID;
- policy version.

## MCP Tool Implementation Pattern

Every MCP tool should follow the same pattern.

```text
1. Parse arguments.
2. Validate hat token.
3. Refresh/deny if token expired.
4. Resolve AgentSessionActor using session ID.
5. Load actor runtime context.
6. Load active HatAssignment from Organization state.
7. Build ToolExecutionContext.
8. Evaluate RBAC and OPA policy.
9. Validate domain preconditions.
10. Execute state transition or request.
11. Persist domain event and audit.
12. Emit NATS event if other agents should know.
13. Record tool activity back to AgentSessionActor.
14. Return structured result.
```

The MCP Gateway must not trust request-provided context as authority. Request context is only a lookup hint. The authoritative execution context comes from:

- hat JWT validation;
- `AgentSessionActor`;
- active `HatAssignment`;
- Organization DB state;
- policy engine;
- tool-specific domain checks.

### Actor-Resolved Tool Execution Context

Every protected MCP tool should execute with a `ToolExecutionContext`.

```text
ToolExecutionContext
  agent_id
  session_id
  actor_id
  hat_id
  hat_assignment_id
  department_id
  project_id
  initiative_id
  task_id
  team_id
  meeting_id
  oz_run_id
  current_mode
  memory_scopes
  credential_scopes
  allowed_tool_scopes
  policy_version
  trace_id
  correlation_id
  causation_id
```

`AgentSessionActor` should own live runtime context:

```text
agentId
sessionId
activeHatAssignmentId
currentTaskId
currentTeamId
currentMeetingId
currentOzRunId
currentProjectId
currentInitiativeId
memoryScopes
credentialScopes
allowedToolScopes
policyVersion
lastHeartbeat
currentMode
```

Actor methods:

```text
getRuntimeContext
recordHeartbeat
recordToolCallStarted
recordToolCallCompleted
setCurrentTask
setCurrentTeam
setCurrentMeeting
setMode
markRoleless
```

For task, meeting, team, or incident-scoped tools, the gateway may also query `TaskActor`, `MeetingActor`, `TeamRoomActor`, `IncidentActor`, or `HatSupplyActor` before policy evaluation.

Actors provide hot session context. Organization DB remains authoritative for final state.

Example: `assign_hat`

```text
caller: Director or higher
checks:
  - caller can assign target hat
  - target agent exists
  - hat supply available
  - budget available
  - agent is recommended or override reason supplied
effects:
  - create HatAssignment
  - issue short-lived token
  - create MemoryActivation
  - emit HatAssigned
```

Example: `complete_task`

```text
caller: Implementer or owning hat
checks:
  - task assigned to caller or caller has manager scope
  - required red/green test evidence exists when required
  - required artifacts exist
effects:
  - task moves to code_review, not done
  - review request is created
  - reviewers are notified
```

Example: `qa_bounce_back`

```text
caller: QA hat with review scope
checks:
  - QA hat is assigned to task/release/project
  - reproducibility report includes required evidence
effects:
  - task moves to qa_reproducible or needs_rework
  - defect/rework item is created or reopened
  - owning TPM and Engineering Manager receive report
```

Example: `read_documentation_context`

```text
caller: any active hat assigned to project/initiative/task scope
checks:
  - caller has project/task visibility
  - requested docs are within memory/documentation scope
effects:
  - returns BRD, CA, ADRs, design docs, project skills, repo conventions, and required artifact expectations
  - records DocumentationContextRead audit event
```

Example: `submit_adr`

```text
caller: Architect, Architecture Reviewer, CTO, or approved Engineering Manager
checks:
  - caller has architecture/documentation write scope
  - ADR is linked to project/initiative/repo/service
  - decision, context, options, consequences, and status are present
effects:
  - creates ADR artifact
  - links ADR to affected work
  - opens architecture review gate if required
  - emits AdrSubmitted
```

Example: `propose_project_skill`

```text
caller: Engineering Manager, Memory Curator, QA Engineering Manager, Architect, or TPM
checks:
  - caller has project scope
  - frontmatter includes project/repository/allowed hats/owners/status/version
  - skill does not grant tools or credentials outside hat policy
effects:
  - creates ProjectSkill in proposed state
  - schedules department review
  - emits ProjectSkillProposed
```

Example: `submit_capability_request`

```text
caller: any active hat
checks:
  - caller has active assignment
  - request is linked to project, initiative, task, incident, review, or department
  - requested capability type is explicit
  - evidence, limitation, expected benefit, and risk are present
effects:
  - creates CapabilityRequest in submitted state
  - routes to owning Engineering Manager or department manager
  - emits CapabilityRequestSubmitted
```

Example: `review_capability_request`

```text
caller: Engineering Manager, Department Director, Architect, Security Reviewer, Product Owner, or Executive depending on gate
checks:
  - caller owns the required review gate
  - request has required evidence and scope
  - previous required gates are complete or explicitly waived by policy
effects:
  - records CapabilityRequestReview
  - advances request to next gate, implementation, backlog, initiative, rejected, or needs_clarification
  - emits CapabilityRequestTriaged, CapabilityRequestApproved, or CapabilityRequestRejected
```

Example: `request_credential_proxy_endpoint`

```text
caller: Engineering Manager, Security Manager, Director, or approved agent hat
checks:
  - linked CapabilityRequest exists
  - external API/system and data classification are documented
  - requested operations, rate limits, audit requirements, and allowed hats are defined
effects:
  - creates CredentialProxyEndpointRequest
  - opens Security and Architecture gates
  - emits CredentialProxyEndpointRequested
```

Example: `register_temporal_workflow`

```text
caller: Platform Operator, Workflow Maintainer, Architect, or Director-approved Engineering Manager
checks:
  - linked WorkflowCapabilityRequest exists
  - workflow type, task queue, version, activities, signals, queries, and owners are documented
  - deterministic workflow tests pass
  - activities are idempotent and policy checked
  - rollback/versioning plan is approved
  - Security approval exists when workflow can launch agents, use credentials, or change protected state
effects:
  - creates or updates WorkflowRegistry entry
  - enables rule/trigger launch only for approved scopes
  - emits WorkflowRegistered
```

MVP tool scope should be deliberately small.

Start with tools that prove policy and state:

```text
read_assignment_status
refresh_hat_token
send_report
read_inbox
submit_artifact
request_review
submit_review
read_run_status
```

Then add work-management tools:

```text
create_project
create_backlog_item
convert_backlog_item
create_initiative
assign_hat
create_task
groom_task
mark_ready
complete_task
```

Defer wide tool catalogs until the first vertical slice proves authorization, audit, state transitions, and Hermes/Oz integration.

## Hat Tokens

Hat tokens are short-lived JWTs.

Claims:

```json
{
  "sub": "agent-id",
  "hat_id": "hat-id",
  "hat_assignment_id": "assignment-id",
  "department_id": "department-id",
  "project_id": "project-id",
  "session_id": "session-id",
  "oz_run_id": "oz-run-id",
  "tool_scopes": ["task.write", "meeting.open"],
  "memory_scopes": ["project:abc", "hat:engineering-manager"],
  "credential_scopes": ["gitlab.read"],
  "policy_version": "2026-05-25.1",
  "exp": 1234567890,
  "jti": "token-id"
}
```

Refresh flow:

```text
refresh_hat_token
  -> load assignment
  -> verify assignment active
  -> verify hat supply/budget still valid
  -> verify no deprovision/revocation
  -> issue new token or return roleless state
```

Do not rely only on JWT claims. Services must re-check active assignment for sensitive operations.

## Agent Fit and Hindsight

Hindsight should help rank agents for hats, but the Organization should decide assignments.

Agent fit inputs:

- memories attributed to the agent;
- memories attributed to the agent while wearing the target hat;
- project/domain memory;
- prior performance reviews;
- prior QA bounce-backs;
- cost/runtime history;
- review approval/rejection history;
- tool reliability;
- current workload.

Initial tools:

```text
rank_agents_for_hat
read_agent_specialties
read_agent_memory_profile
read_hat_performance_history
recommend_hat_assignment
```

Implementation approach:

```text
Organization query
  -> read structured performance data from CockroachDB
  -> query Hindsight with metadata filters
  -> combine into ranked recommendation
  -> require director/executive approval for assignment
```

## Documentation Context and Project Skills

Every Hermes run should receive a scoped documentation context before meaningful work begins.

Context inputs:

- project;
- initiative;
- mission;
- work item;
- task;
- repository;
- service or component;
- active hat;
- assigned agent;
- gate being executed.

Context output:

- BRDs;
- CAs;
- ADRs;
- design docs;
- product rules;
- repo conventions;
- project skills;
- required artifacts;
- known risks;
- relevant memories.

Runtime flow:

```text
task or agent run starts
  -> DocumentationContextService resolves docs and skills
  -> MemoryAdapter resolves scoped memories
  -> Organization MCP Gateway exposes read_documentation_context
  -> Hermes prompt receives concise context summary and artifact links
  -> Hermes can fetch full docs, skills, and evidence through scoped tools
```

Reviewers receive the same context plus gate-specific checklists. QA hats receive acceptance criteria, product workflows, test strategy, known regression areas, and prior reproducibility reports.

### Project Skill Files

Project and repository skills should live in deterministic paths:

```text
projects/<project-id>/skills/<skill-id>/SKILL.md
projects/<project-id>/repos/<repo-name>/skills/<skill-id>/SKILL.md
```

Skill files should include frontmatter that is parseable by the ingestion pipeline:

```yaml
id: repo-build-and-test
name: Repo Build and Test Workflow
scope:
  project: project-id
  initiative: optional-initiative-id
  repositories:
    - repo-name
departments:
  - engineering
allowedHats:
  - developer
  - reviewer
  - engineering-manager
triggers:
  - task.ready
  - review.requested
requiredTools:
  - git.read
  - test.run
requiredArtifacts:
  - test-evidence
owners:
  - engineering-manager-hat-id
status: active
version: 1
```

Important graph edges:

```text
Hat -> can_use -> Skill
Skill -> applies_to -> Project
Skill -> applies_to -> Repository
Skill -> references -> DocumentationArtifact
Skill -> informed_by -> Memory
Task -> used -> Skill
Agent -> succeeded_with -> Skill
Review -> failed_due_to_missing -> Skill
```

The first implementation can store these relationships in `skill_graph_edges`. A dedicated graph database can be introduced later if traversal across projects, memories, skills, hats, and outcomes becomes a bottleneck.

### Documentation Enforcement Commands

Documentation and skill lifecycle tools:

```text
read_documentation_context
submit_brd
approve_brd
submit_ca
approve_ca
submit_adr
approve_adr
submit_design_doc
link_documentation_to_work
propose_project_skill
approve_project_skill
ingest_project_skill
read_project_skills
```

Guardrails:

- implementers cannot start gated work without reading the documentation context;
- reviewers cannot approve gated work without linked documentation and gate evidence;
- architecture-risk work cannot pass without CA or ADR context;
- Product Owner hats sign off product and business documentation;
- Engineering Manager or department owner hats approve project and repo skills;
- skill ingestion cannot grant tools, credentials, memory scopes, or voting scope beyond the active hat policy.

## Oz Integration

Oz should be wrapped behind `OzAdapter`.

Initial adapter operations:

```text
createRun(spec)
cancelRun(runId)
getRunStatus(runId)
listChildRuns(parentRunId)
getRunArtifacts(runId)
getRunLogs(runId)
```

An Organization run spec should include:

- Hermes profile;
- active hat assignment;
- project/initiative/task context;
- MCP gateway URL;
- NATS subject prefix;
- credential proxy URL;
- memory adapter URL;
- workspace/repo configuration;
- resource limits;
- budget metadata;
- parent run ID.

Oz is allowed to run containers. Oz does not decide Organization state transitions.

## NATS and Messaging

Use NATS/JetStream for agent messages and report/event transport.

Recommended subjects:

```text
org.<orgId>.project.<projectId>.events
org.<orgId>.initiative.<initiativeId>.events
org.<orgId>.team.<teamId>.broadcasts
org.<orgId>.agent.<agentId>.inbox
org.<orgId>.hat.<hatAssignmentId>.inbox
org.<orgId>.department.<departmentId>.reports
org.<orgId>.executive.escalations
```

Use JetStream for durable inboxes, reports, and required task/review events.

Use ephemeral NATS messages for live progress updates and UI streaming.

Persist important messages in CockroachDB before or while publishing to NATS.

Every NATS message should include:

- message ID;
- idempotency key;
- correlation ID;
- causation ID;
- organization ID;
- source agent ID;
- source hat assignment ID;
- linked project/initiative/task when available;
- event type;
- schema version.

NATS failure behavior:

- if NATS is unavailable, protected state changes should still persist and enqueue an outbox record;
- a publisher worker should retry outbox delivery;
- consumers must be idempotent;
- poison messages should move to a dead-letter stream with a report to Operations/DevOps.

## Meetings

Meetings should be implemented as first-class entities, not only chat transcripts.

Meeting state:

```text
requested
scheduled
open
in_discussion
in_vote
decision_recorded
closed
cancelled
```

Meeting fields:

- purpose;
- organizer hat assignment;
- participants;
- hierarchy scope;
- conversation mode;
- linked project/initiative/task;
- agenda;
- transcript;
- decisions;
- votes;
- artifacts;
- memory outputs.

Conversation modes should be enforced by the Meeting Service at the turn-routing level.

First MVP can support:

- leader-led;
- round-robin;
- vote-driven.

Add pass-the-stick and reviewer-panel later.

## Workflow State Machines

Every workflow state change should be implemented as a permissioned command.

Each transition should define:

- source states;
- destination state;
- required hat authority;
- required artifacts/evidence;
- blocking conditions;
- emitted events;
- inbox/report destinations;
- escalation path on failure.

Transition table format:

```text
Command: mark_task_ready
Source states: discovery, intake
Destination: ready
Required hat: Engineering Manager or TPM with task scope
Required artifacts: acceptance criteria, required hats, risk, memory context
Blocks when: missing BRD/CA gate for gated work, unresolved blocker, no owner
Events: TaskMarkedReady
Inbox: assigned TPM, owning Engineering Manager
Escalation: Director if task cannot be readied due to missing hats/budget
```

### Service Request

```text
submitted
  -> classified
  -> needs_clarification
  -> triaged
  -> backlog_item_created
  -> initiative_candidate
  -> closed
```

### Defect

```text
reported
  -> reproducing
  -> reproducible
  -> prioritized
  -> assigned
  -> red_test_written
  -> fixed
  -> code_review
  -> qa_review
  -> qa_reproducible
  -> needs_rework
  -> qa_signed_off
  -> done
```

### Initiative

```text
proposed
  -> executive_triage
  -> discovery
  -> business_approved
  -> architecture_approved
  -> planned
  -> active
  -> delivery_review
  -> qa_signoff
  -> released
  -> complete
```

### Hat Assignment

```text
requested
  -> approved
  -> active
  -> refreshing
  -> expired
  -> deprovisioned
  -> revoked
```

### Meeting

```text
requested
  -> scheduled
  -> open
  -> decision_pending
  -> decision_recorded
  -> closed
```

## Gate Contracts

Gates are enforceable contracts, not advice.

Each gate should define:

- approving hat;
- required input artifacts;
- required evidence;
- pass criteria;
- failure criteria;
- rejection destination state;
- emitted events;
- audit requirements.

### BRD Gate

Approving hats:

- Product Owner;
- Business Approver.

Required artifacts:

- BRD;
- customer/user context or source report;
- open question list;
- acceptance criteria.

Pass criteria:

- requirements are understandable;
- business rules are documented;
- acceptance criteria are testable;
- Product Owner signs off.

Failure destination:

- `needs_clarification`
- `needs_business_approval`

### CA Gate

Approving hats:

- Architecture Reviewer;
- Chief Architect for high-risk work.

Required artifacts:

- CA document;
- BRD or business context;
- current-system notes;
- risks and non-goals.

Pass criteria:

- integration boundaries are clear;
- design supports business intent;
- risks and constraints are documented;
- implementation scope is clear enough for planning.

Failure destination:

- `needs_architecture`

### ADR / Documentation Gate

Approving hats:

- Architecture Reviewer;
- Engineering Manager for repo/process docs;
- Product Owner for product docs;
- Memory Curator for skill/memory-facing docs.

Required artifacts:

- linked ADR, design doc, BRD, CA, or documented no-doc decision;
- project/initiative/repo scope;
- owner;
- status;
- version.

Pass criteria:

- work has the correct project-scoped documentation context;
- structural decisions are recorded as ADRs;
- repo/project conventions are linked when relevant;
- reviewers and implementers can read the same source of truth;
- stale or missing docs are explicitly tracked.

Failure destination:

- `needs_documentation_update`
- `needs_architecture`
- `needs_business_approval`

### TDD Gate

Approving hats:

- Engineering Manager;
- Code Reviewer may verify during review.

Required artifacts:

- red test artifact;
- command output proving the test failed before implementation;
- link to task acceptance criteria.

Pass criteria:

- failing test represents the scenario;
- test is strict enough to catch the defect or feature gap;
- test was produced before green implementation evidence.

Failure destination:

- `needs_rework`

### Code Review Gate

Approving hats:

- Code Reviewer with project/task scope.

Required artifacts:

- diff summary;
- changed files;
- red/green test evidence;
- implementation notes;
- known risks.

Pass criteria:

- code satisfies task scope;
- tests pass;
- no unresolved review blockers;
- no unauthorized credential/tool changes.

Failure destination:

- `review_rejected`
- `needs_rework`

### QA Gate

Approving hats:

- QA Reviewer.

Required artifacts:

- test run evidence;
- browser automation evidence when relevant;
- screenshots/traces/logs for user workflows;
- reproducibility report when issue persists.

Pass criteria:

- original issue is no longer reproducible;
- acceptance criteria pass;
- critical workflow evidence is attached.

Failure destination:

- `qa_reproducible`
- `needs_rework`

### Delivery Gate

Approving hats:

- Delivery Reviewer;
- Release Operator when release impact exists.

Required artifacts:

- code review approval;
- QA signoff;
- merge/release evidence;
- linked artifacts.

Pass criteria:

- all required upstream gates are approved;
- release or merge action is auditable;
- owning TPM and initiative are updated.

Failure destination:

- `delivery_blocked`

## Permission Matrix Starter

The implementation should start with a table-driven permission model.

Initial hats:

| Hat | Assigns Hats | Approves Gates | Creates Tasks | Votes | Credential Scope | Memory Scope |
|---|---:|---:|---:|---:|---|---|
| Executive Board | yes, high-power | executive gates | yes | organization | policy-defined | organization |
| CEO | directors/executives | priority gates | yes | organization | limited by policy | organization |
| CTO | technical directors | CA/high-risk tech | yes | technical | technical scopes | technical/org |
| COO | operations directors | operating standards | yes | operations | ops scopes | operations/org |
| Department Director | TPMs/managers | department gates | yes | department | department scopes | department |
| TPM | team hats by initiative scope | initiative readiness | yes | initiative | initiative scopes | initiative |
| Engineering Manager | implementer/reviewer recommendations | TDD/readiness/outcome | yes | team/initiative | limited | team/project |
| Product Owner | no | BRD/product signoff | yes | product | none/default | product/project |
| Business Analyst | no | BRD draft readiness | yes | business | none/default | business/project |
| Architect | no | CA draft/readiness | yes | architecture | read-only technical | architecture/project |
| Implementer | no | no | limited/subtasks | task | task-limited | task/project |
| Code Reviewer | no | code review | no | review scope | read-only | task/project |
| QA Reviewer | no | QA signoff | no | QA scope | browser/test scopes | QA/project |
| Security Reviewer | no | credential/tool gates | yes | security | security scopes | security/org |
| Memory Curator | no | memory changes | yes | memory scope | none/default | memory/org |

The final implementation should store this as policies, not hard-coded `if` statements.

## Escalation Policies

Escalations should be typed.

Each escalation policy should define:

- trigger;
- severity;
- recipient inbox;
- required chat/meeting mode;
- SLA/timeout;
- fallback authority;
- emitted events.

Initial escalation policies:

| Trigger | Recipient | Mode | Fallback |
|---|---|---|---|
| unclear requirements | Product Owner / BA | one-on-one or meeting | Director |
| missing BRD | Product Director | report | Executive Board |
| missing CA | Architecture Director | report | CTO |
| skipped TDD | Engineering Manager | report | TPM / Director |
| failed code review | Engineering Manager | thread | TPM |
| QA issue still reproducible | Engineering Manager + TPM | report + meeting | Director |
| blocked hat supply | Director | report | C-suite |
| credential request | Security Reviewer | report | Security Director / Executive Board |
| delivery risk | TPM + Delivery Director | meeting | Executive Board |
| executive priority conflict | Executive Board | executive-session | CEO vote/board vote |

## Runtime Topology

Local k3s topology:

```text
k3s
  organization-api
  organization-mcp-gateway
  postgres
  nats-jetstream
  credential-proxy-stub
  memory-adapter-stub
  oz-worker / oz-runner integration
  hermes-session pods
  Cilium Service Mesh, Gateway API, Hubble, and SPIRE workload identity
```

First runtime proof:

```text
one goal
  -> one Oz run
  -> one Hermes container
  -> one MCP call
  -> one persisted artifact
  -> one correlated trace
```

Deployment stages:

- local k3s;
- shared staging;
- production-like cluster.

Promotion criteria:

- all protected MCP tools enforce hat authorization;
- Hermes containers receive no raw credentials;
- Oz run IDs map to Organization sessions;
- NATS messages are idempotent;
- artifacts are persisted and linked;
- traces connect API request, Oz run, Hermes session, MCP call, NATS event, and artifact write.

## Component Contracts

### Organization API

Owns synchronous application APIs and internal services.

Must provide:

- CRUD for core Organization entities;
- state transition commands;
- policy checks;
- audit events;
- event outbox.

### MCP Gateway

Owns agent-facing tools.

Must provide:

- JWT validation;
- live hat assignment validation;
- OPA/RBAC policy checks;
- schema validation;
- domain service invocation;
- audit log;
- structured tool result.

### Oz Adapter

Owns integration with Oz.

Must provide:

- create run;
- cancel run;
- get run status;
- list child runs;
- fetch logs/artifacts;
- persist Oz run bindings.

### Hermes Session Container

Must receive:

- Hermes profile;
- active hat assignment;
- MCP gateway URL;
- NATS subject prefix;
- credential proxy URL;
- memory adapter URL;
- Organization correlation IDs;
- resource limits.

Must not receive:

- broad raw credentials;
- unscoped memory access;
- unrestricted MCP tools.

### Credential Proxy

Must provide:

- scoped token exchange;
- denied-operation reporting;
- audit events;
- revocation behavior;
- policy version checks.

### Memory Adapter

Must provide:

- scoped memory recall;
- memory write attribution;
- metadata filtering;
- visibility enforcement;
- fallback behavior when Hindsight cannot satisfy a scoped query.

## Failure and Recovery Matrix

| Failure | Required Behavior |
|---|---|
| Oz unavailable | Persist requested run as pending, report to Operations/TPM, retry or escalate. |
| Oz run starts but no callback | Poll Oz status, mark run uncertain after timeout, escalate. |
| Hermes pod crashes | Mark AgentSession interrupted, preserve Oz logs, allow retry if assignment active. |
| NATS unavailable | Persist outbox event, retry publisher, do not lose Organization state. |
| NATS message replayed | Use idempotency key and ignore duplicate transition. |
| Hat token expired | Tool call returns refresh-required or roleless state. |
| Hat assignment deprovisioned | Deny protected calls, notify agent and owning manager. |
| Credential proxy denies request | Return structured denial, create security/report event if unexpected. |
| Memory adapter unavailable | Continue with explicit degraded-memory warning; block only if task requires memory gate. |
| Partial artifact write | Mark artifact incomplete, retry or require resubmission. |
| Stale assignment in JWT | Re-check Organization state and deny. |
| Policy version changed | Require token refresh and re-evaluate tool scope. |

## Observability Contract

Observability is a core runtime contract. Agents should build Organization infrastructure, project features, skills, and internal tools as observable systems by default.

Every run should have a correlation chain:

```text
Organization request
  -> trace ID
  -> span ID
  -> command ID
  -> event ID
  -> Oz run ID
  -> k3s pod ID
  -> Hermes session ID
  -> Hermes turn ID
  -> MCP call ID
  -> NATS message ID
  -> credential proxy request ID
  -> artifact ID
```

Every persisted record that can participate in work should carry correlation metadata:

```text
trace_id
span_id
causation_id
correlation_id
request_id
command_id
event_id
project_id
initiative_id
task_id
agent_id
hat_id
hat_assignment_id
session_id
oz_run_id
pod_id
policy_version
```

Required logs:

- state transition logs;
- MCP tool audit logs;
- hat token refresh/denial logs;
- Oz run lifecycle logs;
- NATS publish/consume logs;
- credential proxy allow/deny logs;
- artifact submission logs;
- prompt/run boundary logs;
- Hermes turn start/end logs;
- subagent spawn/stop logs;
- meeting message and vote logs;
- documentation context read logs;
- memory read/write logs with scope metadata;
- skill ingestion and skill usage logs;
- policy evaluation logs;
- gate evaluation logs;
- retry/backoff/dead-letter logs;
- self-healing attempt logs.

Required traces:

- user or Oz goal intake through work creation;
- hat assignment through token issuance;
- Hermes session launch through first MCP call;
- every MCP tool call through policy check, domain service, database write, event publish, and artifact write;
- NATS publish through consumer handling and idempotency decision;
- credential proxy request through policy decision and upstream call;
- memory query through Hindsight adapter filters and returned memory IDs;
- documentation context resolution through selected docs, skills, and gate requirements;
- QA run through browser automation, screenshots, traces, and reproducibility decision;
- self-healing detection through attempted fix, verification, and escalation.

Required metrics:

- active Hermes sessions by project, initiative, hat, agent, cluster, and pod;
- task lead time and cycle time by state;
- gate pass/fail rate by gate type and reviewer hat;
- QA reproducibility and bounce-back rate;
- review rejection reasons;
- memory hit/miss and memory usefulness feedback;
- skill usage and skill success/failure rate;
- policy allow/deny rate;
- credential proxy allow/deny rate;
- MCP tool latency and failure rate;
- Oz run queue time, run time, crash rate, retry rate, and orphan rate;
- NATS consumer lag, dead-letter count, replay count, and duplicate suppression count;
- budget and token usage by project, initiative, hat, agent, and run;
- self-healing success, failure, and escalation rate.

Telemetry storage should be split by purpose:

```text
Organization DB
  authoritative state, state transitions, audit events, gate results

Event store / outbox
  append-only domain events and replayable integration events

Trace backend
  distributed traces and span attributes

Log backend
  structured logs and raw execution logs

Metrics backend
  time-series metrics and SLOs

Artifact store
  screenshots, browser traces, test output, reports, transcripts, run bundles

Graph projection
  queryable relationships between agents, hats, skills, docs, memories, tasks, runs, and outcomes
```

The UI should read Organization state as truth and use traces/logs/artifacts as evidence. Agents should never need to scrape logs to understand normal state, but logs and traces must be rich enough to debug every abnormal state.

### Agent Observability Standard

Every agent-created feature or internal tool must include an observability plan before it is considered ready.

Minimum implementation checklist:

- structured logs at lifecycle boundaries;
- trace spans around external calls, tool calls, policy checks, and long-running work;
- domain events for state transitions;
- metrics for throughput, latency, failures, and cost where relevant;
- artifact capture for human-reviewable evidence;
- correlation IDs passed through all service calls and NATS messages;
- UI-visible status and failure reasons;
- self-healing or escalation behavior for known failure modes.

Reviewers should reject infrastructure work that cannot answer:

```text
What happened?
Who or what caused it?
Which hat and policy allowed it?
Which project/initiative/task did it affect?
What evidence was produced?
What failed?
Was it retried?
Was it healed, escalated, or left blocked?
How would a future agent learn from this?
```

### Self-Healing Feedback Loop

Self-healing should be evidence-driven, not magical.

```text
anomaly detected
  -> classify by known failure mode
  -> inspect correlated traces/logs/artifacts/state
  -> attempt approved remediation if policy allows
  -> verify with explicit check
  -> record self-healing result
  -> create report/backlog item if unresolved or recurring
  -> feed outcome into memory, skill, and performance review systems
```

Examples:

- stuck Oz run creates a run-health report, retries when safe, escalates to DevOps if retry fails;
- repeated MCP timeout creates an infrastructure reliability report and links affected tasks;
- QA bounce-backs with the same cause create a proposed project skill or test tooling backlog item;
- repeated memory misses create a memory adaptation request;
- frequent policy denials create either a security review request or a skill documentation update.

Required dashboards:

- active Oz runs;
- active hat assignments;
- hat token denials;
- task state distribution;
- review queue;
- QA reproducible failures;
- NATS dead-letter stream;
- credential proxy denials;
- cost/budget by project/initiative/hat;
- trace error rate by component;
- MCP tool latency/failure rate;
- Hermes session crash/retry/orphan rate;
- self-healing attempts and outcomes;
- recurring failure modes by project/repo/hat;
- missing observability coverage by project and component.

## Always-On Runtime Mechanics

The Organization needs persistent workers that keep it operating when no Hermes agent is actively reasoning.

Detailed mechanics live in [Always-On Orchestration Runtime](./ALWAYS_ON_ORCHESTRATION_RUNTIME.md).

Initial control-plane workers:

- scheduler worker;
- rule evaluation worker;
- reaction executor worker;
- outbox publisher worker;
- NATS consumer worker;
- Oz reconciler worker;
- k3s pod/session watchdog;
- lease reaper;
- dead-letter worker;
- trigger worker;
- anomaly classifier;
- budget and capacity worker;
- observability coverage worker.

### Rules and Reactions

State changes should be evaluated by explicit rules.

```text
domain event
  -> durable trigger or direct rule evaluation
  -> matched OrganizationalRule records
  -> deterministic ReactionPlan
  -> policy, budget, lease, and hat supply checks
  -> side effects executed
  -> audit, trace, metrics, and resulting events recorded
```

Rules should create reaction plans, not perform side effects directly.

Reaction actions can include:

- state transition;
- hat reservation or assignment;
- Oz run request;
- message/inbox notification;
- meeting request;
- escalation;
- report creation;
- backlog item creation;
- self-healing attempt;
- no-op with recorded reason.

### Durable Triggers

Triggers should support:

- event-based triggers;
- state-based triggers;
- state-timeout triggers;
- scheduled triggers;
- threshold triggers;
- external watcher triggers.

Each trigger needs scope, owner, predicate, policy requirements, dedupe key, retry policy, cooldown, budget policy, enabled state, and version.

### Runtime Leases

Every scheduled job claim, reaction execution, watcher checkpoint write, dead-letter replay, and self-healing remediation should be protected by a runtime lease with a fencing token.

Duplicate execution must be safe through both leases and idempotency keys.

### Scheduler Semantics

`scheduled_jobs` should additionally track:

- timezone;
- jitter;
- last run time;
- locked until;
- max runtime;
- misfire policy;
- concurrency policy;
- catch-up policy;
- schedule version.

Misfires should either skip, run once, catch up within a limit, or escalate.

### Watchers and Reconcilers

Watchers observe external systems. Reconcilers repair or report drift.

Initial watchers and reconcilers:

- Oz run watcher/reconciler;
- k3s pod/session watcher;
- NATS stream health watcher;
- credential proxy denial watcher;
- Hindsight memory health watcher;
- telemetry ingestion watcher;
- Git/CI watcher;
- documentation repository watcher.

Reconciliation should detect pending runs not launched, orphaned pods, silent Hermes sessions, stale hat assignments, stuck outbox events, dead-letter growth, missing artifacts, and schedules not firing.

### SLOs and Incidents

Always-on operation needs SLOs and incident rules.

Initial SLO categories:

- Organization API;
- MCP gateway;
- Oz launch/callback;
- Hermes heartbeat;
- NATS publish/consume lag;
- scheduler lag;
- trigger lag;
- credential proxy;
- Hindsight adapter;
- telemetry ingestion;
- self-healing success/escalation latency.

Incidents should have severity, commander assignment, communication cadence, mitigation, resolution, postmortem, and follow-up backlog items.

### Runbooks as Skills

Recurring remediation procedures should become versioned project or platform skills.

Runbook skills should include:

- detection signal;
- preconditions;
- allowed hats;
- approval class;
- remediation steps;
- verification;
- rollback;
- evidence requirements;
- owner;
- version.

### Capability Expansion

Agents can request new capabilities when existing hats, tools, workflows, skills, or credential scopes are insufficient.

Capability request types:

- MCP tool;
- project/repo skill;
- hat capability;
- credential proxy scope;
- credential proxy endpoint;
- external API integration;
- Temporal workflow;
- Dapr actor;
- durable trigger or scheduled job;
- observability/tooling improvement;
- QA/test tooling;
- runbook skill.

Lifecycle:

```text
submitted
  -> manager_triage
  -> director_prioritization
  -> architecture_review when runtime/API/workflow impact exists
  -> security_review when tools, credentials, data, or automation risk exists
  -> product_review when user/customer behavior changes
  -> approved_for_implementation
  -> implemented
  -> tested
  -> reviewed
  -> registered
  -> active
```

Engineering Managers review team-level need and evidence. Department Directors decide whether the capability belongs in the department backlog or becomes an initiative. Security approves new credential proxy endpoints, credential scopes, external APIs, and dangerous automations. Architecture approves new Temporal workflows, Dapr actors, runtime workers, or cross-service integrations.

Temporal workflow capability requests must define:

- workflow type;
- owning department;
- allowed launch rules;
- task queue;
- activities;
- signals and queries;
- cancellation behavior;
- versioning/rollback plan;
- deterministic workflow tests;
- activity idempotency tests;
- policy and credential gates.

Credential proxy endpoint requests must define:

- external system/API;
- operations exposed;
- allowed hats;
- data classification;
- rate limits;
- audit events;
- expiry/review date;
- failure mode;
- test plan.

Approved capabilities update the relevant registry: MCP tool registry, credential proxy endpoint registry, workflow registry, actor registry, skill graph, hat graph, or durable trigger catalog.

### Dead-Letter Ownership

Dead letters require a governed workflow:

```text
dead-letter created
  -> DLQ Steward assigned
  -> classify poison/transient/schema/policy/duplicate
  -> investigate linked trace and entity
  -> replay, quarantine, discard, or create backlog item
  -> record evidence and approvals
```

Discard and replay decisions must be auditable.

## Acceptance Tests

Initial implementation should include tests for:

- cannot call protected tool without active hat token;
- expired hat token requires refresh;
- deprovisioned hat becomes roleless;
- implementer cannot mark task done directly;
- task cannot enter code review without red/green evidence when TDD required;
- QA bounce-back requires reproducibility evidence;
- Oz run binding is created when Hermes session starts;
- duplicate NATS event does not duplicate state transition;
- memory write requires hat attribution;
- credential proxy request is denied without approved scope;
- meeting decision records participant hats and vote evidence;
- durable trigger creates only one reaction plan for the same idempotency key;
- scheduler cannot double-claim a job under concurrent workers;
- stale runtime lease is reaped and fenced writes are rejected;
- rule conflict resolution follows deterministic precedence;
- dead-letter replay requires approval when side effects are possible;
- incident opens when SLO burn exceeds configured threshold;
- capability request cannot become active without required manager/director/security/architecture gates;
- credential proxy endpoint request cannot be registered without security approval and audit requirements;
- Temporal workflow registration requires deterministic workflow tests and idempotent activity tests;
- protected MCP tool call resolves `AgentSessionActor` before policy evaluation;
- MCP Gateway denies tool call when actor context and Organization DB hat assignment disagree;
- MCP Gateway records tool start/completion activity back to `AgentSessionActor`;
- task-scoped MCP tool checks task assignment through actor context and authoritative task state.

## Scheduling

Scheduled jobs should be owned by manager hats.

Examples:

- Engineering Manager schedules team reviews.
- QA Engineering Manager schedules regression suites.
- Memory Manager schedules memory quality reviews.
- DevOps Manager schedules pipeline health reviews.
- Security Manager schedules credential-scope audits.

`scheduled_jobs` should include:

- owner hat assignment;
- department/project scope;
- cadence;
- next run time;
- run policy;
- budget policy;
- output artifact expectations;
- escalation target.

The scheduler should create work or reports, not bypass work management.

## Guardrails

Required guardrails:

- no protected tool call without active hat assignment;
- no stale hat token authorization;
- no task moves to done directly from implementer;
- no QA signoff without evidence;
- no credential scope without security approval;
- no architecture-risk work without CA approval;
- no customer-facing ambiguous work without BRD/product signoff;
- no new high-power hat without Executive Board approval;
- no memory write without attribution;
- no Oz child run without Organization approval and run binding.

## MVP Milestones

### M0 - Documentation and Domain Slice

Deliverables:

- architecture doc;
- implementation concepts doc;
- initial entity model;
- tool inventory;
- MVP workflow selection.

### M1 - Local Control Plane

Build NestJS service with:

- agents;
- hats;
- hat assignments;
- projects;
- initiatives;
- tasks;
- reports;
- simple inboxes;
- JWT hat token issue/refresh;
- MCP gateway skeleton.

No Oz yet. Use local fake Hermes/Oz adapters.

### M2 - Hermes Session Spike

Build:

- Hermes session container;
- Hermes runner adapter;
- one orchestrator Hermes profile;
- one worker Hermes profile;
- Organization MCP config.

Prove:

```text
orchestrator creates task
worker claims task
worker submits artifact
reviewer approves
task state advances
```

### M3 - Oz Integration

Build:

- OzAdapter;
- run bindings;
- parent/child run metadata;
- Oz-launched Hermes session;
- status sync.

Prove:

```text
Organization starts Hermes orchestrator through Oz
orchestrator requests worker run
Organization approves
Oz launches worker
worker reports back
```

### M4 - NATS Messaging

Build:

- durable inbox/outbox;
- team broadcasts;
- reports;
- escalation messages;
- live UI events.

### M5 - Hindsight Memory Adapter

Build:

- memory query/write adapter;
- hat attribution metadata;
- agent fit recommendation MVP;
- memory adaptation request workflow.

### M6 - Corporate Lifecycle MVP

Build one end-to-end lifecycle:

```text
service request
  -> defect
  -> TDD task
  -> code review
  -> QA reproducibility/signoff
  -> outcome review
  -> memory attribution
```

### M7 - Self-Building Loop

Build:

- performance reviews;
- backlog item from review;
- internal platform initiative creation;
- scheduled team review.

### M8 - Cilium / SPIRE / Credential Proxy Hardening

Build:

- service identity;
- credential proxy scope checks;
- MCP gateway authz checks;
- audit trail;
- network policy.

## First Implementation Bet

The best first vertical slice is not the whole corporation.

Build this:

```text
Project
  -> Initiative
      -> Director assigns TPM + Engineering Manager
      -> TPM creates task
      -> Hermes worker runs through Oz/local adapter
      -> reviewer approves
      -> QA reports still reproducible or signs off
      -> manager creates outcome review
      -> memory attribution is recorded
```

This tests the smallest version of:

- hierarchy;
- hats;
- MCP;
- Oz/Hermes runtime;
- task management;
- review;
- QA;
- memory;
- performance loop.
