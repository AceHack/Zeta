---
title: Anti-Stall Prioritization Runtime
canonical_name: Agentic Organization
status: design
---

# Anti-Stall Prioritization Runtime

The Organization should be designed to keep moving. Blockers should not create stale pauses. They should become actively managed work with owners, deadlines, alternate lanes, escalation paths, and reconciliation loops while other useful work continues.

This document defines the anti-stall operating model: the prioritization, blocker resolution, capacity balancing, and progress monitoring routines that directors, TPMs, Engineering Managers, QA leaders, Security leaders, Operations hats, and executive hats run to keep the Organization always moving.

The scheduler and event runtime can wake these routines and prepare evidence, but the work belongs to the Organization's hats. There should not be a hidden management process making priority decisions outside the organizational chain of command.

## Operating Principle

The Organization should treat every stalled state as a signal that creates new work.

```text
blocked work
  -> classify blocker
  -> assign blocker owner
  -> route resolution work
  -> keep unblocked related work moving
  -> reconcile when blocker clears
  -> replan affected work
  -> record learning
```

The goal is not to pretend blockers never happen. The goal is that blockers never sit unnoticed and never stop unrelated progress.

## Movement Invariants

- Every active initiative must have at least one next executable item or an explicit paused decision.
- Every blocked work item must have a blocker owner, blocker type, unblock strategy, target resolution time, and escalation path.
- Every agent with an active hat should either have assigned work, review work, discovery work, operations work, or be released to save cost.
- Every queue should have an SLO for first response, assignment latency, review latency, and stale-state detection.
- Every scarce hat should have a visible supply queue and reprioritization policy.
- Every dependency should have a fallback plan: parallelizable work, spike, clarification, alternate task, test work, documentation work, or capability request.
- Every stale state should emit a signal and create a management action.

## Blocker Taxonomy

Blockers need typed routing. A generic `blocked` state is too weak.

| Blocker type | Owner hats | Resolution path |
|---|---|---|
| Requirements unclear | Requirement Clarifier, Product Owner, Business Analyst | Open clarification thread, customer interview, BRD update, acceptance criteria revision |
| Customer unavailable | Product Owner, Customer Interviewer, TPM | Schedule follow-up, create async questionnaire, proceed with approved assumption, escalate priority decision |
| Missing BRD/product signoff | Product Owner, BRD Reviewer, Business Approver | Route to BRD review queue and product signoff gate |
| Architecture missing | Architect, Architecture Reviewer, Chief Architect | Create CA/ADR/design task, run architecture meeting, approve or reject design |
| Security/credential blocked | Security Reviewer, Credential Scope Approver, Policy Engineer | Security review, credential scope decision, proxy endpoint request, policy change |
| Hat supply exhausted | Engineering Manager, TPM, Director, Cost Controller | Reprioritize, reserve later, release lower-priority hats, request more supply, queue work |
| Reviewer unavailable | Engineering Manager, Review Coordinator, Director | Reassign reviewer, escalate queue saturation, provision more reviewer hats |
| QA unavailable | QA Director, QA Engineering Manager, TPM | Reprioritize QA queue, assign regression verifier, schedule QA run, provision QA hats |
| Environment/runtime issue | Platform Operator, SRE, Oz/K3s Reconciler | Open operations task, incident, self-healing plan, rerun or rebind session |
| Build/test/pipeline failure | DevOps Analyst, Engineering Manager, Implementer | Classify failure, route to owner, create defect or infra task |
| Dependency not complete | TPM, Dependency Manager, Engineering Manager | Re-sequence, split work, parallelize unaffected tasks, escalate dependency |
| Budget exceeded | Cost Controller, CFO, Director, Executive Board | Pause lower-value work, adjust budget, shrink scope, approve exception |
| Memory/context missing | Memory Curator, Knowledge Router, Engineering Manager | Attach context, create memory adaptation request, project skill request |
| Tool/capability missing | Capability Request Owner, Tool Registry Steward, Architect, Security | Create capability request, route approvals, assign implementation |
| Release blocked | Delivery Reviewer, Release Manager, QA, Security, Architecture | Identify missing evidence/gate, route to responsible hat, re-evaluate release scope |

## Hat-Owned Operating Cadences

Anti-stall behavior should be part of the Organization's normal operating rhythm. Durable schedules and event triggers create agenda items, reports, inbox tasks, and meeting requests for the right hats. The hats then decide priority, assignment, escalation, alternate work, or explicit pause.

| Cadence or routine | Owner hats | Responsibility |
|---|---|---|
| Initiative movement review | TPM, Mission Control Lead, Program Director | Review active initiative flow, blocked tasks, dependency drift, team utilization, release risk, and next executable work |
| Department priority review | Department Director, TPM Manager, Engineering Manager or department manager | Rebalance department initiatives, resolve hat scarcity, move blocked work to the right owner, and escalate cross-department conflicts |
| Engineering execution review | Engineering Manager, Team Lead, Readiness Reviewer | Inspect ready queue, blocked implementation, TDD evidence, missing context, silent assignments, and alternate work options |
| Review queue review | Engineering Manager, Review Coordinator, Architecture Reviewer, Security Reviewer, QA Reviewer, Delivery Reviewer | Detect review saturation, assign reviewers, escalate missing evidence, and request more reviewer hats when needed |
| QA flow review | QA Director, QA Engineering Manager, Regression Scheduler | Prioritize QA-ready work, schedule regression runs, route reproducible failures, and identify test tooling gaps |
| Security and credential review | Security Director, Security Reviewer, Credential Scope Approver, Policy Engineer | Triage credential/tool/policy blockers and decide whether to approve, reject, request architecture input, or open capability work |
| Release readiness review | Release Manager, Delivery Reviewer, TPM, QA Reviewer | Review release candidates, missing gates, rollback plans, post-release verification, and risk tradeoffs |
| Hat supply and budget review | Director, Cost Controller, CFO, Executive Board when needed | Decide whether to reserve, release, expand, or preempt hat capacity based on priority and budget |
| Blocker triage meeting | TPM, Blocker Manager, owning department manager | Classify blockers, assign blocker owners, choose alternate work, and set escalation deadlines |
| Executive movement review | CEO, CTO, COO, CFO, Executive Board | Resolve cross-department priority conflicts, major bottlenecks, budget exceptions, and high-risk pauses |

The always-on substrate only does mechanical support:

- detect stale states and queue SLO violations;
- prepare movement reports;
- create scheduled review tasks;
- populate role-specific inboxes;
- open meeting requests under policy;
- compute candidate priority and assignment recommendations;
- emit signals;
- execute approved state transitions.

The decision is still made by a hat with authority.

## Prioritization Routines

Prioritization should be continuous, but it should be conducted through scheduled and event-triggered organizational routines. The platform can compute recommendations; directors, TPMs, managers, reviewers, and executives decide according to their scope.

### Priority Inputs

- executive priority;
- project priority;
- initiative priority;
- customer impact;
- revenue or strategic value;
- severity;
- release risk;
- blocked downstream work;
- dependency fan-out;
- queue age;
- hat scarcity;
- budget burn;
- SLO/error budget burn;
- defect reproducibility;
- QA bounce-back count;
- security risk;
- capability unlock value;
- confidence in requirements;
- estimated effort;
- expected learning value.

### Priority Output

```ts
type PriorityDecision = {
  workItemId: string;
  previousRank: number;
  newRank: number;
  priorityClass: "expedite" | "high" | "normal" | "defer" | "paused";
  reasonCodes: string[];
  requiredHats: string[];
  preemptableAssignments: string[];
  alternateWorkItems: string[];
  blockerResolutionPlanId?: string;
  decidedBy: "tpm" | "engineering_manager" | "department_director" | "review_hat" | "agent_vote" | "executive" | "incident_commander" | "approved_policy";
  expiresAt?: string;
};
```

Priority decisions should be explainable in the UI. Agents need to know why work moved up or down.

The system may generate `PriorityRecommendation` records, but those are not final decisions unless an approved policy explicitly allows automatic action for that scope.

## Blocker Lifecycle

```text
blocker_detected
  -> blocker_classified
  -> owner_hat_recommended
  -> blocker_triage_task_created
  -> owner_hat_assigned_by_TPM_or_manager
  -> resolution_plan_created
  -> alternate_work_approved
  -> resolution_in_progress
  -> blocker_resolved
  -> dependent_work_reactivated
  -> outcome_review
```

Every blocker should create:

- owner hat assignment;
- triage task for the responsible TPM, manager, or director;
- blocker resolution work item;
- affected dependency list;
- alternate work recommendation and approval;
- expected resolution time;
- escalation policy and accountable hat;
- stale timeout;
- outcome note after resolution.

## Alternate Work Strategy

When work is blocked, the responsible TPM, Engineering Manager, or department manager should keep agents productive by assigning approved alternate work.

Alternate work types:

- implement independent subtasks;
- write tests or test harnesses;
- improve docs or project skills;
- prepare QA cases;
- perform architecture spike;
- perform discovery or clarification;
- work on adjacent backlog items in the same initiative;
- reduce tech debt in approved scope;
- investigate observability gaps;
- resolve capability request dependencies;
- review or QA other work in the same project if the active hat allows it.

Guardrails:

- Alternate work must be tied to a work item.
- Alternate work must not bypass priority policy.
- Alternate work must not silently expand scope.
- When the original blocker clears, the owning TPM or manager decides whether to resume, finish alternate work first, or reassign. The assignment service executes the approved decision.

## Work Stealing and Reassignment

The Organization needs controlled reassignment so idle hats can help without chaos.

Allowed when:

- original owner is silent past SLA;
- assignment token expired and refresh failed;
- hat supply is scarce and higher-priority work needs capacity;
- work is blocked but another hat can resolve the blocker;
- queue SLO is violated;
- incident policy requires preemption.

Required checks:

- active hat has authority for target work;
- work item supports reassignment;
- current owner is notified;
- partial artifacts are preserved;
- run/session state is reconciled;
- decision is audited;
- dependent queues are updated.

## Queue SLOs

Every queue should have SLOs.

| Queue | Example SLO |
|---|---|
| Requirement clarification | first response within policy window; no open question stale beyond threshold |
| BRD review | review assigned quickly; rejection reasons typed |
| Architecture review | architecture-risk work cannot sit unassigned |
| Code review | review queue saturation creates reviewer provisioning or reprioritization |
| QA verification | QA-ready work gets assigned or escalated |
| Security review | credential/tool requests get triaged by risk quickly |
| Delivery review | release candidates cannot sit without missing-evidence signal |
| Blocker resolution | blockers get owner and resolution plan quickly |
| Capability expansion | requests get classified and either accepted, rejected, or deferred |

SLO violations should emit signals such as:

- `QueueSloViolated`
- `ReviewQueueSaturated`
- `BlockerOwnerMissing`
- `BlockedWorkStale`
- `AssignmentSilent`
- `HatSupplyBottleneck`
- `AlternateWorkAssigned`
- `DependencyCleared`
- `WorkReactivated`

## Continuous Reconciliation

Reconciliation should compare intended state to actual state and route discrepancies to the owning hats.

| Intended state | Actual check |
|---|---|
| Assigned work has active agent | hat assignment exists, token valid, session heartbeat present |
| Ready work has required hats | hat supply reserved or waiting queue visible |
| Blocked work has owner | blocker work item and owner hat exist |
| Review requested | reviewer assigned and review SLO active |
| QA requested | QA assignment exists and evidence plan is attached |
| Release candidate open | missing gates/evidence are explicit |
| Oz run active | run bound to work item and heartbeating |
| Department active | at least one next action, scheduled review, or explicit pause exists |
| Project active | initiatives are moving, blocked, or intentionally paused with reason |

If intended and actual state diverge, the system creates a report, inbox item, or meeting request for the responsible hat. Safe mechanical repairs can be automated by approved policy, but priority, staffing, and pause/resume decisions stay with organizational roles.

## Prioritization Meetings and Votes

Routine priority should be handled by the appropriate hats through scheduled reviews and triggered inbox tasks. Meetings and votes occur when a decision crosses role boundaries or policy says judgment is required. Each meeting or vote must anchor to the project, initiative, task, defect, blocker, release, policy, or capability request that created the priority question.

Trigger meetings for:

- cross-department priority conflict;
- high-value work blocked by scarce hats;
- release risk versus feature priority;
- budget pressure;
- conflicting product/architecture/security decisions;
- repeated queue SLO violations;
- major scope changes caused by discovery.

Meeting output should be a durable decision, not just discussion:

- priority change;
- budget change;
- hat supply adjustment;
- blocker owner assignment;
- accepted assumption;
- scope reduction;
- deferred work;
- new capability request;
- escalation to Executive Board.

## UI Requirements

The UI should make movement visible.

Needed views:

- anti-stall command center;
- blocked work board;
- blocker dependency graph;
- queue SLO dashboard;
- hat supply bottleneck view;
- stale assignment view;
- alternate work recommendations;
- priority decision history;
- dependency cleared/reactivation feed;
- preemption and reassignment audit;
- project/initiative movement score.

The UI should answer:

- what is blocked?
- who owns the blocker?
- what is happening while it is blocked?
- what will unblock it?
- when will it escalate?
- what work is still moving?
- which hats are scarce?
- what should be reprioritized now?

## Movement Score

Each project, initiative, department, and team should have a movement score.

Inputs:

- percentage of work with active next action;
- stale state count;
- blocked work age;
- queue SLO violations;
- review/QA/security lag;
- hat supply bottlenecks;
- silent runs;
- dependency fan-out blocked;
- outcome review failure rate;
- release readiness drift.

The movement score should not become a vanity metric. It should trigger concrete actions:

- director review;
- TPM reprioritization;
- Engineering Manager staffing changes;
- hat supply request;
- capability request;
- queue policy update;
- executive prioritization vote.

## MVP Slice

Add anti-stall behavior to the first Work OS slice:

```text
task becomes blocked by missing acceptance criteria
  -> stale/blocker signal creates TPM blocker triage task
  -> TPM classifies requirements blocker and assigns Requirement Clarifier hat
  -> Engineering Manager approves alternate task for implementer
  -> Product/BA clarifies acceptance criteria
  -> blocker resolves
  -> TPM reactivates task
  -> implementer resumes or new agent is assigned
  -> outcome review records whether delay was handled well
```

This proves:

- blockers are typed;
- blockers get owners;
- blocked work produces useful alternate work;
- queues do not silently stall;
- agents are not left idle with active hats;
- dependent work reactivates automatically.

## Guardrails

- Do not optimize for motion over correctness. Some work should pause, but pauses must be explicit and owned.
- Do not preempt high-context work casually. Preserve artifacts and handoff state before reassignment.
- Do not use alternate work to hide systemic blockers. Repeated blockers become improvement work.
- Do not let automation override hard policy gates.
- Do not let idle agents keep costly hats without assigned useful work.
- Do not let blocked work disappear from executive, director, TPM, or manager visibility.
