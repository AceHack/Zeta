# Work and Release Management OS

The Organization needs its own task, backlog, project, and release management product. This is not an integration with Linear or Jira. It is the operational backbone that lets Hermes agents understand work, update progress, receive assignments, emit signals, request reviews, manage releases, and keep every level of the Organization aware of health.

This layer should be small at first, but it must be designed as a real workflow system from day one.

Ambiguous and customer-facing work follows the discovery lifecycle in [Ambiguous Requirement Lifecycle](./AMBIGUOUS_REQUIREMENT_LIFECYCLE.md) before it can become implementation-ready.

Blocked and stale work follows the hat-owned movement lifecycle in [Anti-Stall Prioritization Runtime](./ANTI_STALL_PRIORITY_RUNTIME.md) so directors, TPMs, managers, and review hats resolve blockers while other useful work continues.

## Purpose

The Work and Release Management OS should:

- capture all work as first-class state;
- track goals, projects, initiatives, tasks, defects, service requests, capability requests, reviews, releases, and incidents;
- drive transitions through required gates and evidence;
- assign hats reliably without double-booking or lag;
- emit signals when state changes, work stalls, budgets burn, hats are scarce, or releases become risky;
- provide role-specific boards and queues for agents and humans;
- support scheduled work such as QA regression, department reviews, release checks, and runtime health reviews;
- create durable audit trails for every action, decision, review, artifact, and automation event.

The OS is how the Organization knows what everyone is doing and how it is performing at every level.

## Product Shape

```text
Goal / Report / Service Request
  -> Project
      -> Initiative
          -> Work Item
              -> Task / Defect / Capability Request / Review / Incident
                  -> Gate
                  -> Artifact
                  -> Assignment
                  -> Run
                  -> Release Link
```

This structure should be flexible enough for internal platform work and product/customer work. A capability request for a new MCP tool, a QA-discovered defect, a release blocker, and a customer feature request all become work, but each gets a different workflow type, gate policy, and owner department.

## Core Domain Objects

| Object | Meaning |
|---|---|
| Goal | Ambiguous or high-level objective submitted by a human, agent, system, or executive hat |
| Report | Internal signal such as QA finding, pipeline failure, SLO burn, memory quality issue, or process issue |
| Service Request | Request for help, credential access, environment change, investigation, or operational action |
| Project | Long-lived product, platform, repo family, customer area, or internal system |
| Initiative | Prioritized body of work with owner, scope, budget, required gates, and expected outcomes |
| Initiative Branch | Feature branch or branch family where all development and QA for an initiative happens before promotion to the system build branch |
| Work Item | Common superclass for task, defect, capability request, review task, incident task, release task |
| Task | Concrete unit of execution with acceptance criteria, required hats, dependencies, and evidence |
| Defect | Reproducible problem with severity, reproduction evidence, affected project/release, and fix flow |
| Capability Request | Request for a new tool, credential, workflow, actor, skill, memory adaptation, or runtime feature |
| Gate | Required approval such as BRD, CA, security, code review, QA, delivery, memory, release |
| Assignment | Binding of a hat and agent to scoped work, with TTL, lease, token, and release policy |
| Release | Merge/promotion/deployment unit with gate evidence, risk, rollback, notes, and verification |
| Automation Package | CI, test, deployment, preview environment, rollback, observability, and operational automation created or updated with the feature |
| Work Schedule | Hat-bound schedule of prioritized work, prompt-flow execution, review, reflection, memory maintenance, free time, and reporting blocks |
| Prompt Flow | Reusable deterministic MCP-driven pipeline composed of phases, gates, reviewers, artifacts, and memory behavior |
| Universal Action | Typed action atom inside a prompt-flow phase, with actor, target, preconditions, observation contract, reversibility, and evidence |
| Signal | Durable event that informs boards, rules, agents, meetings, triggers, and UI read models |
| Requirement Maturity | Discovery-specific state that tracks whether an ambiguous request has enough customer, business, workflow, and acceptance context to move toward implementation |

## State Machines

### Work Item States

```text
intake
  -> classified
  -> discovery
  -> needs_business_approval
  -> needs_architecture
  -> ready
  -> planned
  -> assigned
  -> in_progress
  -> blocked
  -> review
  -> needs_rework
  -> qa_review
  -> qa_reproducible
  -> delivery_review
  -> approved
  -> merged
  -> released
  -> outcome_review
  -> done
```

The state machine should allow workflow-specific subsets. For example, a credential request does not need code review, but it does need security review. A documentation task may not need QA, but it may need architecture or product approval.

### Requirement Maturity States

```text
raw_intake
  -> classified
  -> ambiguity_scored
  -> discovery_required
  -> interview_planned
  -> interview_in_progress
  -> source_evidence_captured
  -> requirements_drafted
  -> workflow_modeled
  -> acceptance_criteria_drafted
  -> brd_review
  -> product_signoff
  -> architecture_ready
  -> implementation_ready
```

Requirement maturity gates implementation. A customer-facing or ambiguous feature cannot move to `ready` until it reaches `implementation_ready` or receives an approved no-discovery/no-BRD exception.

### Initiative Branch States

```text
branch_requested
  -> branch_created
  -> automation_plan_ready
  -> development_open
  -> ci_cd_ready
  -> qa_environment_ready
  -> qa_in_progress
  -> qa_signed_off
  -> merge_ready
  -> merged_to_main
  -> system_build_verified
  -> branch_closed
```

Each initiative should have a feature branch or branch family that isolates all development, review, QA, and evidence until the initiative is complete. `main` is the system build branch. Work should not merge to `main` until the initiative branch has passed required review and QA gates.

### Release States

```text
release_intake
  -> scope_selected
  -> evidence_check
  -> qa_required
  -> qa_signed_off
  -> security_review_required
  -> delivery_review
  -> approved_for_merge
  -> merged
  -> system_build_verified
  -> approved_for_release
  -> released
  -> post_release_verification
  -> release_complete
```

Release state should be explicit because Delivery hats need a queue that proves readiness instead of relying on chat. Releases can represent a code merge, internal platform activation, workflow registry activation, MCP tool activation, credential proxy endpoint rollout, or product deployment.

### Assignment States

```text
requested
  -> candidate_ranked
  -> supply_reserved
  -> token_issued
  -> active
  -> refresh_required
  -> suspended
  -> released
  -> expired
  -> revoked
```

Assignments are their own state machine because hat reliability is central. Work should not be considered assigned just because a task has an owner field. The Organization must reserve supply, issue authority, bind a session, monitor heartbeats, and release capacity deterministically.

## Signal Model

Signals are durable, typed events. They are not chat messages. They drive boards, rules, triggers, automation, UI projections, and agent inboxes.

| Signal family | Examples | Primary consumers |
|---|---|---|
| Work state | `WorkItemCreated`, `WorkItemMarkedReady`, `TaskBlocked`, `TaskSubmittedForReview`, `TaskDone` | TPMs, Engineering Managers, Reviewers, UI |
| Branch state | `InitiativeBranchRequested`, `InitiativeBranchCreated`, `BranchQaEnvironmentReady`, `BranchQaSignedOff`, `BranchMergeReady`, `BranchMergedToMain`, `SystemBuildVerified` | TPMs, Engineering Managers, QA, Delivery, UI |
| Automation state | `AutomationPlanCreated`, `CiPipelineUpdated`, `PreviewEnvironmentReady`, `DeploymentAutomationReady`, `RollbackAutomationReady`, `ObservabilityAutomationReady` | Engineering Managers, DevOps, QA, Delivery, Operations |
| Requirement maturity | `RequirementReceived`, `AmbiguityDetected`, `DiscoveryRequired`, `RequirementsDrafted`, `WorkflowModeled`, `ImplementationReady` | Product, BA, Architecture, TPMs, UI |
| Interview | `InterviewRequested`, `InterviewStarted`, `CustomerAnswerRecorded`, `ClarificationQuestionOpened`, `InterviewCompleted` | Customer Interviewer, Product Owner, Business Analyst |
| Gate state | `BrdApproved`, `ArchitectureRejected`, `CodeReviewApproved`, `QaBounceBack`, `DeliveryApproved` | Reviewers, managers, Delivery |
| Assignment | `HatRequested`, `HatSupplyReserved`, `HatTokenIssued`, `HatRefreshFailed`, `HatReleased`, `HatRevoked` | Assignment service, managers, agents |
| Schedule | `ScheduleBlockPlanned`, `ScheduleBlockStarted`, `ScheduleBlockCompleted`, `ReflectionDue`, `FreeTimeStarted`, `MemoryMaintenanceDue` | Agents, managers, Memory, UI |
| Prompt flow | `PromptFlowRequested`, `PromptFlowActivated`, `PromptFlowRunStarted`, `PromptFlowPhaseCompleted`, `PromptFlowGateRejected`, `PromptFlowRunCompleted` | Agents, reviewers, managers, Capability teams |
| Universal action | `UniversalActionStarted`, `ActionObservationRecorded`, `ActionCorrectionRequested`, `ActionReverted`, `ActionCompleted` | Prompt-flow runners, reviewers, graph ingestion, audit |
| Runtime | `OzRunStarted`, `OzRunSilent`, `PodHeartbeatMissing`, `RunCompleted`, `RunFailed` | Operations, TPMs, Engineering Managers |
| Release | `ReleaseScopeSelected`, `ReleaseEvidenceMissing`, `ReleaseApproved`, `ReleaseCompleted`, `RollbackRequested` | Delivery, QA, Security, executives |
| Capacity | `HatSupplyExhausted`, `BudgetThresholdExceeded`, `QueueLagHigh`, `ReviewQueueSaturated` | Directors, Cost Controller, executives |
| Anti-stall | `QueueSloViolated`, `BlockedWorkStale`, `BlockerOwnerMissing`, `AssignmentSilent`, `AlternateWorkAssigned`, `DependencyCleared`, `WorkReactivated` | TPMs, Engineering Managers, Directors, Operations |
| Quality | `RepeatedQaBounceBack`, `MemoryGapDetected`, `FlakyTestDetected`, `AcceptanceCriteriaMissing` | Engineering Managers, QA Engineering, Memory |
| Capability | `CapabilityRequested`, `SecurityReviewRequired`, `WorkflowRegistered`, `ToolActivated` | Directors, Architecture, Security |
| Meeting | `DiscussionAnchorValidated`, `MeetingRequested`, `DecisionRecorded`, `VoteOpened`, `VoteClosed` | Participants, governance hats |

Every signal should include:

```ts
type OrganizationSignal = {
  id: string;
  type: string;
  scope: {
    organizationId: string;
    departmentId?: string;
    projectId?: string;
    initiativeId?: string;
    workItemId?: string;
    taskId?: string;
    releaseId?: string;
    runId?: string;
    assignmentId?: string;
  };
  emittedBy: {
    agentId?: string;
    hatAssignmentId?: string;
    serviceId?: string;
    workerId?: string;
  };
  payload: Record<string, unknown>;
  causationId?: string;
  correlationId: string;
  traceId: string;
  createdAt: string;
};
```

## Boards and Queues

The UI and agents should not read raw tables. They should consume purpose-built boards and queues.

| Board or queue | Shows | Used by |
|---|---|---|
| Executive Portfolio Board | Projects, initiatives, budget, hat scarcity, delivery risk, department health | Executive Board, CEO, CTO, COO, CFO |
| Requirement Maturity Board | Ambiguous requirements, discovery state, interviews, open questions, BRD readiness, product signoff | Product, Business Analysis, TPMs, Architecture |
| Director Initiative Board | Department initiatives, blocked work, staffing, review lag, capability gaps | Directors |
| TPM Mission Board | Initiative tasks, dependencies, teams, blockers, meetings, evidence, release links | TPMs |
| Anti-Stall Command Center | stale work, blockers, queue SLOs, alternate work, dependency reactivation, reassignment, movement score | TPMs, Engineering Managers, Directors, Operations |
| Engineering Manager Board | Ready queue, assigned tasks, blocked tasks, TDD evidence, memory/doc gaps, team outcomes | Engineering Managers |
| Implementer Task Queue | Assigned tasks, required docs, red tests, allowed tools, run status, review feedback | Implementer hats |
| Review Center | Pending reviews by type, evidence completeness, self-approval blocks, decision history | Review hats |
| QA Verification Board | QA-ready work, test cases, browser runs, reproducibility evidence, bounce-backs | QA and QA Engineering |
| Delivery Board | Release candidates, upstream gates, release evidence, rollback plans, deployment state | Delivery hats |
| Security Queue | Credential requests, tool expansions, policy diffs, dangerous automation reviews | Security hats |
| Operations Board | Workers, leases, DLQs, Oz runs, pod health, SLO burn, incidents, self-healing | Operations hats |
| Memory and Skills Board | Memory adaptation, stale docs, project skills, context quality, repeated misses | Memory and Documentation hats |
| Capability Expansion Board | Requested tools, workflows, actors, skills, credentials, approvals, activation state | Hat Designer, directors, Architecture, Security |

Each board should be backed by read models updated from signals. This keeps UI fast and avoids expensive live aggregation across every domain table.

## Reliable Hat Assignment

Hat assignment is a first-class subsystem. It should be closer to a capacity scheduler than a permissions table.

### Assignment Flow

```text
work needs hats
  -> compute required hat bundle
  -> rank candidate agents using memory profile, specialties, availability, cost, and prior outcomes
  -> check department and project policy
  -> reserve hat supply with a lease
  -> issue hat token
  -> create assignment record
  -> bind assignment to work item, team, run, and session
  -> monitor heartbeat and progress
  -> refresh, suspend, revoke, or release assignment
```

### Reliability Mechanics

- Use optimistic concurrency or actor-owned supply counters so two tasks cannot reserve the same scarce hat.
- Use `HatSupplyActor` or an equivalent serialized allocator for hot supply decisions.
- Use assignment leases with fencing tokens so stale workers cannot keep authority after replacement.
- Store assignment state in the Organization DB before launching Oz/Hermes runs.
- Treat JWT as a cached capability, not the source of truth.
- Refresh tokens through the Organization MCP Gateway and `AgentSessionActor`.
- Release hat supply on task completion, run completion, timeout, revocation, or budget pressure.
- Reconcile assignments against Oz runs and pod/session heartbeats.
- Escalate when a hat is assigned but no progress signal appears within the expected SLA.

### Lag and Breakdown Prevention

The system should actively detect:

- work with required hats but no active assignment;
- active assignment with expired token;
- active assignment with no Oz run or session heartbeat;
- Oz run with no bound work item;
- hat supply reserved but no task started;
- task in review with no reviewer assigned;
- QA-ready work with no QA assignment;
- release candidate with missing gate evidence;
- blocked work with no owner response;
- queues growing faster than available hats;
- repeated reassignment of the same work item;
- assignments that exceed expected duration for their hat/work type.

Each condition should produce a signal, not a hidden log line.

## Release Management Workflow

Release management should handle both product delivery and internal Organization capability activation.

### Feature Branch Delivery Model

The default software delivery model is initiative-scoped feature branches.

Rules:

- Every implementation initiative creates or binds to an `InitiativeBranch`.
- Development tasks, defect fixes, review iterations, QA runs, screenshots, traces, and test evidence attach to that branch.
- The initiative branch should include the CI/CD, deployment, preview, rollback, and observability automation required to test and operate the feature.
- The branch is the QA target. QA validates the complete feature branch, not isolated fragments already merged into `main`.
- `main` is the system build branch. It should only receive work that has completed initiative-level QA signoff and delivery approval.
- Partial work can be merged within the initiative branch as needed, but it must not enter `main` until the whole feature is approved.
- Delivery hats own the promotion from initiative branch to `main`; QA hats own the QA signoff gate before that promotion.
- After merge to `main`, the system build verification confirms the integrated build is healthy and records evidence.

This keeps the system build branch clean while still allowing agent teams to iterate aggressively inside scoped initiative branches.

### CI/CD and Deployment Automation Requirement

Agents should treat automation as part of the delivered feature.

Every initiative should decide, before implementation, what automation it needs. For most code-producing work, the branch should either create or update:

- CI pipeline jobs for build, lint, typecheck, unit tests, integration tests, and relevant security scans;
- deterministic test data or environment setup scripts;
- preview or branch deployment automation so QA can test the feature before it reaches `main`;
- deployment or activation automation for the target runtime;
- rollback, disable, or deactivation automation where the change can affect users or runtime behavior;
- observability automation such as dashboards, alerts, log queries, trace views, and health checks.

The Automation Package should be scoped to the initiative. Small documentation-only work can record a no-automation decision, but product, platform, runtime, workflow, MCP, Credential Proxy, CI, deployment, or infrastructure changes should not reach release readiness without the automation needed to test and operate them.

### Release Candidate Creation

A release candidate is created when:

- a task reaches delivery review;
- an initiative reaches release readiness;
- an initiative branch has QA signoff and is ready to merge into `main`;
- a workflow/tool/actor/capability is ready for activation;
- a security-approved credential proxy endpoint is ready for rollout;
- an internal platform change needs controlled promotion.

### Release Readiness Checks

Readiness should validate:

- linked work items and scope;
- initiative branch identity and diff scope;
- branch build/test health;
- automation package completeness or approved no-automation decision;
- preview or QA deployment evidence when applicable;
- required BRD/CA/ADR/design docs;
- code review approvals;
- branch-level QA signoff or documented no-QA decision;
- security approval if credentials, data, policy, external APIs, or dangerous automation are involved;
- architecture approval if workflows, actors, APIs, state ownership, or infrastructure are involved;
- test evidence and build evidence;
- rollback or deactivation plan;
- rollback/deactivation automation when applicable;
- release notes or activation notes;
- post-release verification owner;
- budget/runtime impact;
- affected projects, repos, teams, and docs.

### Release Signals

Release state should emit signals such as:

- `ReleaseCandidateCreated`
- `ReleaseEvidenceCheckFailed`
- `ReleaseQaRequired`
- `ReleaseSecurityReviewRequired`
- `ReleaseArchitectureReviewRequired`
- `ReleaseApprovedForMerge`
- `ReleaseMerged`
- `SystemBuildVerified`
- `ReleaseApprovedForActivation`
- `ReleaseActivated`
- `PostReleaseVerificationFailed`
- `RollbackRequested`
- `ReleaseCompleted`

These signals let Delivery, QA, Security, Architecture, Operations, and executives see the same truth.

## Custom Workflow Builder

The Organization will need more than one workflow. The Work OS should support workflow definitions as data, with governed code expansion for complex durable workflows.

### Workflow Definition

```ts
type WorkflowDefinition = {
  id: string;
  name: string;
  workType: string;
  states: string[];
  transitions: Array<{
    from: string;
    to: string;
    allowedHatIds: string[];
    requiredGates: string[];
    requiredArtifacts: string[];
    emitsSignals: string[];
  }>;
  gatePolicyIds: string[];
  assignmentPolicyIds: string[];
  releasePolicyIds: string[];
  escalationPolicyIds: string[];
  ownerDepartmentId: string;
  version: number;
};
```

Simple workflows can run through the Organization Kernel and rule engine. Long-running, crash-proof workflows can later be backed by Temporal TS when they need durable timers, retries, human waits, or child workflows.

## Runtime Implementation Pattern

The recommended split:

- CockroachDB: authoritative work, assignment, release, gate, signal, audit, and outbox state.
- NestJS modules: domain services and MCP gateway.
- NATS/JetStream: event distribution, inbox updates, board updates, worker fanout.
- Dapr Actors: hot serialized coordination for hat supply, team rooms, agent mailboxes, run heartbeats, meeting rooms.
- Temporal TS: long-running release, capability, incident, and complex approval workflows once the basic state machines are proven.
- Oz/Hermes: distributed execution for agent work sessions.
- Hindsight: memory profile, specialties, scoped recall/write attribution.
- Observability stack: traces, logs, metrics, screenshots, evidence packages, audit projection.

## MVP Slice

Build the first slice around one real internal platform task.

```text
Capability request: add a new project skill workflow
  -> classified as internal platform work
  -> Project and initiative created
  -> TPM assigned
  -> Engineering Manager grooms task
  -> Hat supply reserved for Implementer and Code Reviewer
  -> Hermes run launched through Oz
  -> Implementer records red/green evidence
  -> Code Reviewer approves
  -> QA verifies UI/API behavior if applicable
  -> Delivery creates release candidate
  -> Release activates capability
  -> Outcome review checks whether the new workflow improved future work
```

This slice proves:

- custom backlog and task flow;
- reliable hat assignment;
- signal emission;
- Oz/Hermes run binding;
- review and release gates;
- release activation;
- status rollups for project, initiative, department, and executive views.

## Non-Negotiable Guardrails

- No work should be invisible. If an agent is doing work, it must be tied to a work item, hat assignment, run, and trace.
- No assignment should be implied by chat. Assignment requires hat supply reservation and active token.
- No discussion may be unanchored. Meetings, threads, broadcasts, one-on-ones, votes, reports, and review comments must reference project, initiative, task, defect, review, gate, incident, release, policy, capability request, or context-gap work.
- No release should happen without an evidence chain.
- No workflow should bypass the Work OS. Schedulers and agents create work or signals, then the Work OS drives state.
- No prompt flow should bypass gates. Each phase must persist evidence and route required reviewer decisions before protected completion.
- No action should be opaque. Universal actions must record preconditions, observations, reversibility, evidence, and action mode.
- No schedule should be invisible. Active hat assignments need schedule blocks for work, review, reflection, memory maintenance, and free time.
- No role should rely on polling chat. Each role needs a queue, board, and signal-driven inbox.
- No stale authority. Expired or revoked hats lose MCP tools, credential scopes, memory scopes, approval powers, and active assignment.
- No silent lag. Stuck states, missing assignments, missing reviewers, silent runs, and saturated queues must produce signals and escalation.
