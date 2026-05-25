# Agentic Organization Runtime - Current Design

## Purpose

The Organization exists to meet goals by forming, coordinating, and governing teams of autonomous Hermes agents.

The system should accept ambiguous goals, clarify them when needed, decompose them into concrete work, assign the right roles, run distributed agent sessions, and complete work with evidence, artifacts, review, and durable state.

This is not a single TPM-led swarm. It is an Organization made of many Hermes agents that can wear role-specific hats and act as leaders, planners, interviewers, architects, implementers, reviewers, operators, or other organizational roles as needed.

## Core Concept

```text
Organization goals
  -> determine needed departments and hats
  -> assign hats to Hermes agents
  -> launch Hermes sessions through Oz/Warp orchestration
  -> connect sessions through OpenZiti transport when required
  -> coordinate work through Organization MCP tools
  -> persist state, messages, artifacts, votes, and memory attribution
  -> complete goals through gates, reviews, and evidence
```

The Organization owns the rules and shared truth.
Hermes agents own reasoning and work.
Oz/Warp owns distributed run launch and lifecycle.
OpenZiti owns secure transport/connectivity in the cluster.
k3s and Docker provide isolated execution.

## Main Runtime Layers

```text
Oz / Warp Run Orchestrator
  Top-level Hermes session launch, distributed execution lifecycle, logs, artifacts, and k3s worker scheduling. This is distinct from OpenZiti transport.

OpenZiti Transport
  Secure connectivity layer used by Hermes sessions, Credential Proxy paths, and private service access where required.

Organization Portal / Control Plane
  Product UI, API, MCP gateway, policy engine, hat registry, task registry, memory adapter, and shared state.

Always-On Runtime Workers
  Durable schedulers, triggers, rule evaluators, reaction executors, watchdogs, reconcilers, lease managers, queue consumers, and self-healing classifiers.

k3s Execution Plane
  Runs Docker session containers where one or more Hermes agents live.

Hermes Agents
  Autonomous agents that can wear hats and act as orchestrators, leaders, workers, interviewers, reviewers, or specialists.

NATS / JetStream
  Cross-container agent messaging, inbox/outbox, status events, task events, and live updates.

Hindsight Memory
  Long-term memory for agents, with Organization-controlled scoping and hat attribution.

Credential Proxy
  Scoped access to GitLab, Jira, Confluence, source repos, cloud services, and other protected systems.

Cilium Service Mesh
  CNI-native L7 policy, mTLS-capable service mesh, Gateway API, ingress, traffic policy, Hubble observability, and egress/access enforcement for agent sessions.

cert-manager / Vault / SPIRE / Trust Manager / External Secrets
  TLS issuance, secret backend, workload identity, CA bundle distribution, and Vault-to-Kubernetes secret sync.
```

The always-on runtime is the operating system of the Organization. It keeps the Organization awake even when no Hermes agent is actively reasoning: schedules fire, rules react to state changes, queues drain, leases expire, dead letters are investigated, run/k3s drift is reconciled, and anomalies become reports or self-healing attempts.

Detailed mechanics live in [Always-On Orchestration Runtime](./ALWAYS_ON_ORCHESTRATION_RUNTIME.md).

The service layer and role workspace plan live in [Organization Layer Build Plan](./ORGANIZATION_LAYER_BUILD_PLAN.md).

The custom backlog, assignment, signal, and release workflow product is described in [Work and Release Management OS](./WORK_AND_RELEASE_MANAGEMENT_OS.md).

The lifecycle for turning vague requirements into curated features lives in [Ambiguous Requirement Lifecycle](./AMBIGUOUS_REQUIREMENT_LIFECYCLE.md).

The hat-owned movement, blocker, queue SLO, and reprioritization model lives in [Anti-Stall Prioritization Runtime](./ANTI_STALL_PRIORITY_RUNTIME.md).

The pre-implementation decision checklist lives in [Implementation Readiness Checklist](./IMPLEMENTATION_READINESS_CHECKLIST.md).

The Kubernetes-native hat enforcement/projection model lives in [Cluster-Native Hat System](./CLUSTER_NATIVE_HAT_SYSTEM.md).

The k3s execution, sandbox, Credential Proxy, Cilium, SPIRE, Vault, External Secrets, NATS, and Hindsight substrate is described in [Cluster Execution and Memory Substrate](./CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md).

The NixOS/k3s/ArgoCD scaffold assumptions and component clarifications are captured in [AI Cluster Scaffold Context](./AI_CLUSTER_SCAFFOLD_CONTEXT.md).

## Technology Stack

Initial stack:

- Oz/Warp for distributed Hermes session lifecycle and k3s-backed execution.
- OpenZiti for secure transport/connectivity where private agent service paths need it.
- k3s for the local/self-hosted Kubernetes execution plane.
- Docker session containers for isolated Hermes agent sessions.
- Hermes Agent for orchestrator, executive, director, manager, specialist, reviewer, QA, security, and worker agents.
- NestJS for the Organization Portal / Control Plane backend.
- Organization MCP Gateway for governed agent actions.
- NATS / JetStream for cross-agent inbox/outbox, reports, events, and live updates.
- Hindsight for long-term memory, with Organization-controlled hat attribution and scoped recall.
- Credential Proxy for scoped access to external systems.
- Cilium Service Mesh for CNI-native L7 policy, Gateway API, ingress, traffic shaping, Hubble observability, and mesh enforcement without Envoy sidecars per pod.
- cert-manager, Vault, SPIRE, Trust Manager, and External Secrets Operator for TLS, secrets, workload identity, CA bundle distribution, and secret synchronization.
- CockroachDB for Organization-owned state and distributed SQL durability.

Deferred or optional:

- Temporal TS should be considered the durable process rail when Organization workflows need crash-proof long-running execution, timers, retries, human waits, and child workflows.
- Dapr Actors should be considered the entity-local concurrency rail for hot state such as agent mailboxes, hat supply allocation, team rooms, meetings, incidents, and Oz run heartbeat coordination.
- Dapr Workflow should be deferred if Temporal TS is selected, because it overlaps with Temporal's durable workflow role.

The initial version can still start without Temporal or Dapr, using native Organization state and fakes for workflow/actor boundaries. The clean integration path is documented in [Runtime Technology and Package Strategy](./RUNTIME_TECH_AND_PACKAGE_STRATEGY.md).

## Oz/Warp and OpenZiti Boundary

Oz is the macro-orchestrator for agent runs. In this design language, Oz represents the Warp-style orchestration layer rather than the OpenZiti transport layer.

Oz should:

- start Organization runs;
- schedule Hermes session containers across k3s;
- track run status, logs, transcripts, artifacts, and outputs;
- manage distributed execution environments;
- support parent and child runs;
- allow Organization-controlled agents to request new runs through policy-checked APIs.

OpenZiti should be treated as the cluster transport/connectivity layer, not the Organization workflow engine.

If any cluster scaffold currently names the OpenZiti application `oz/`, treat that as a naming conflict to resolve. The app should either be renamed to `openziti/` or clearly documented as OpenZiti transport, while Oz remains orchestration.

Oz should not be the only source of Organization truth.

The Organization control plane owns:

- goals;
- departments;
- hats;
- tasks;
- teams;
- messages;
- memory attribution;
- voting state;
- artifact requirements;
- review and completion gates;
- credential scopes;
- policy decisions.

## Hermes Agent Model

A Hermes agent is an autonomous worker with identity and memory.

A Hermes agent can wear one or more hats during a session. The hat determines what role the agent is fulfilling at that moment.

```text
Hermes Agent
  identity, base memory, performance history, current session

Hat
  role, responsibilities, skills, tools, RBAC, OPA policy, voting scope, memory activation scope

Hat Assignment
  runtime fact that agent X is wearing hat Y for task/session Z
```

Hats are not memory.

Hats activate and constrain memory. Memories created while wearing a hat must be attributed to that hat assignment.

## Hats

A hat is a role and policy bundle.

The starter department, hat, and tool inventory is maintained in
`agentic-organization/docs/DEPARTMENT_HAT_TOOL_INVENTORY.md`.

It should define:

- role name;
- department;
- responsibilities;
- skills;
- allowed MCP tools;
- RBAC roles;
- OPA policy references;
- credential scopes;
- memory recall scopes;
- memory write attribution rules;
- voting scope;
- whether the wearer can orchestrate;
- whether the wearer can spawn agents or teams;
- whether the wearer can propose or create new hats.

Example hats:

- Executive Strategy;
- Product Leadership;
- Engineering Leadership;
- Architecture Governance;
- Delivery Governance;
- Customer Interviewer;
- Requirements Analyst;
- Mission Control Lead;
- Backend Implementer;
- Frontend Implementer;
- Test Engineer;
- Security Reviewer;
- Release Operator;
- Memory Curator;
- Hat Designer.

## Hat Designer

The Hat Designer is a special hat that allows an agent to propose or create new hats.

It should not have unrestricted authority by default.

The Hat Designer can:

- analyze gaps in the current Organization capability graph;
- propose new hats;
- define responsibilities and tool scopes;
- recommend RBAC and OPA policies;
- define memory activation scopes;
- define voting scopes;
- submit the hat for executive approval.

The Organization decides whether the proposed hat becomes active.

## Hat Graph

The Organization maintains a hat graph.

The hat graph describes:

- which hats exist;
- which hats depend on other hats;
- which hats can supervise or review other hats;
- which hats belong to departments;
- which hats can vote on which decisions;
- which hats can spawn or assign which other hats;
- which memory scopes each hat can activate;
- which tools and credentials each hat can use.

The hat graph is similar to a skill graph, but it includes role authority and policy.

## Departments

Departments are grouped sets of hats.

Initial departments:

- Executive Board;
- Program and Initiative Management;
- Product and Customer Discovery;
- Business Analysis;
- Architecture;
- Engineering;
- Engineering Management;
- QA and Verification;
- QA Engineering;
- Security and Compliance;
- Delivery and Release;
- Memory and Knowledge Management;
- Documentation and Project Skills;
- Operations and Infrastructure;
- Observability and Evidence;
- Capability and Automation Expansion.

Departments do not need to be human-like bureaucracy. They are capability boundaries that make agent orchestration more understandable and governable.

## Executive Board

The Executive Board is a group of Hermes agents wearing high-authority hats.

They are not the only orchestrators. They are organizational leaders that vote on how the Organization should respond to goals.

The Executive Board is the ultimate organizational authority.

Some executive hats may be long-living, such as CEO, CTO, COO, CFO, or Chief Architect. Long-living does not mean permanent. These hats still use expiring authorization and review.

Recommended initial C-suite:

- CEO: owns overall priority, organization shape, project/portfolio direction, and final escalation.
- CTO: owns technical standards, architecture quality, engineering strategy, and technical efficiency.
- COO: owns operating rhythm, capacity, process health, coordination, and whether the Organization is executing efficiently.

CFO can be deferred until budget and cost controls become complex enough to need a dedicated executive hat. Chief Architect can be either a C-suite hat or a senior Architecture department hat depending on how much architectural authority the Organization needs.

When a long-living executive hat expires or is revoked, the Executive Board should run a selection meeting and vote on the next assignment.

This lets different Hermes agents grow into executive hats over time while keeping authority revocable and accountable.

The Executive Board can decide:

- what kind of goal has been submitted;
- whether clarification is required;
- what departments need to participate;
- which hats are needed and how many;
- whether a new hat should be created;
- whether a long-term initiative should be formed;
- whether customer interview, architecture planning, or delivery execution should begin;
- whether a plan is ready to hand off to Mission Control;
- which TPM hats are assigned to initiatives;
- budget ceilings, concurrency limits, and hat supply limits for initiatives;
- whether internal platform-improvement requests should become backlog items or initiatives.

Executive Board powers:

- define and prioritize projects and portfolios;
- create initiatives;
- elect and rotate C-suite hats;
- appoint or rotate executive hats;
- set organization-wide budgets and hat supply limits;
- approve new departments or major hat classes;
- resolve escalations that lower departments cannot resolve;
- call meetings with department leaders, TPMs, engineering managers, or teams;
- define organization-wide policy and escalation chains.

Oz acts at the bidding of the executive layer. The Executive Board and C-suite decide what should exist, what should be prioritized, and what should run. Oz provides the distributed execution substrate for those decisions.

## C-Suite and Directors

The C-suite organizes the high-level shape of the Organization.

C-suite hats should:

- set standards;
- observe whether standards improve output;
- revise standards when evidence shows they hurt efficiency or quality;
- define and prioritize projects;
- define department goals;
- approve major initiatives and organizational changes;
- maximize efficiency in their respective focus areas;
- appoint department director hats;
- resolve cross-department priority conflicts.

Department directors sit below C-suite hats and above TPMs/managers.

Directors should:

- own a department's project and initiative portfolio;
- prioritize initiatives within projects;
- track all initiatives for the department;
- ensure the department has enough hats and budget;
- assign TPM hats to initiatives;
- assign Engineering Manager hats or equivalent manager hats to teams/areas;
- select agents for hats directly under them based on memory, performance, and specialty fit;
- escalate conflicts or resource shortages to C-suite.

Directors assign TPMs and Engineering Managers. TPMs prioritize tasks within an initiative. Engineering Managers ensure teams have what they need and evaluate whether teams are succeeding.

## Assignment Chain

Hat assignment should follow the Organization chain of command.

```text
Executive Board
  -> elects C-suite
      -> appoints Department Directors
          -> assign TPMs and Engineering Managers
              -> assign team leads, reviewers, implementers, QA, and specialists
```

Each layer assigns hats directly below it.

Assignment decisions should use:

- agent memory profile;
- prior performance reviews;
- hat-specific experience;
- project/domain memory;
- current budget;
- current hat supply;
- active workload;
- risk level;
- escalation history.

The Organization needs tooling that lets authorized agents ask:

- which agents are strongest candidates for this hat?
- which agents have memory relevant to this project or domain?
- which agents have performed well in this hat before?
- which agents are overloaded?
- which agents recently failed in similar work?
- which agent/hat pairing gives the best balance of quality, cost, and availability?

Hindsight should support this by providing memory and experience signals, but the Organization should make the final assignment decision through policy and chain-of-command rules.

## Corporate Operating Model

The Organization should behave like an agentic corporation.

It should have:

- executives that define goals, priorities, budgets, and initiatives;
- TPM hats that own initiative delivery lifecycle;
- departments that own capability areas;
- managers that ensure teams have the right context, memory, tools, acceptance criteria, and staffing;
- specialists that perform concrete work;
- reviewers that approve or reject work;
- QA hats that verify behavior through automation and evidence;
- security hats that approve credential and tool expansion;
- memory hats that curate and route institutional knowledge.

The goal is not to hard-code every corporate behavior. The goal is to provide enough structured tooling, policy, and state that Hermes agents can run the corporation while the platform enforces guardrails.

## Hierarchy

The Organization hierarchy should be explicit.

```text
Organization
  -> Portfolio
      -> Initiative
          -> Program / Mission
              -> Epic / Capability
                  -> Work Item
                      -> Task
                          -> Subtask
```

Initial hierarchy responsibilities:

- C-suite defines standards, projects, portfolios, and organization-level priorities;
- department directors prioritize initiatives within projects;
- directors assign TPM hats and Engineering Manager hats;
- TPM hats prioritize tasks within an initiative;
- TPM hats form missions and coordinate initiative delivery;
- Engineering Managers organize teams, team schedules, readiness, context, and performance;
- architects create conceptual architecture documents;
- business hats create and approve BRDs;
- engineering hats implement through TDD;
- reviewer hats approve code and artifacts;
- QA hats verify completed work through automation and evidence;
- delivery hats merge, release, or promote completed work.

## Agent-Native Task Management

The Organization needs its own Linear-like task management system built for agents.

It should be local and first-party, not dependent on an external task management service.

Core entities:

- project;
- portfolio;
- initiative;
- mission;
- work item;
- task;
- subtask;
- dependency;
- blocker;
- artifact;
- review;
- gate;
- vote;
- hat assignment;
- Oz run mapping;
- budget allocation;
- memory attribution.

Tasks should support hierarchy, dependencies, owners, reviewers, artifacts, acceptance criteria, budget, status, priority, and required hats.

The task system should be MCP-native so Hermes agents can create, groom, update, review, and close work through governed tools.

## Projects

Projects organize work for a specific product, application, customer area, repository family, platform capability, or internal system.

Projects contain:

- goals;
- portfolios;
- initiatives;
- missions;
- work items;
- defects;
- service requests;
- test suites;
- releases;
- memories;
- documentation library;
- project skill library;
- departments and hats assigned to the project.

Executives prioritize across projects.

Project prioritization should consider:

- strategic value;
- customer impact;
- production risk;
- delivery deadlines;
- blocked initiatives;
- available hats;
- budget;
- operational load;
- internal platform needs.

Project-level state lets the Organization decide whether a new report belongs to an existing initiative, an existing project backlog, a new initiative, or a new project.

## Project Documentation and Knowledge

Architecture, product, business, and engineering knowledge must be scoped to the right project, initiative, repository, and work item.

Documentation types:

- BRD;
- CA;
- ADR;
- design document;
- product requirement;
- engineering standard;
- test strategy;
- runbook;
- security review;
- release note;
- repo-specific convention;
- project-specific skill.

Documentation should be indexed by:

- organization;
- project;
- portfolio;
- initiative;
- mission;
- work item;
- repository;
- service/component;
- owning department;
- authoring hat;
- approving hat;
- status;
- version.

Agents working on a project or initiative should receive the relevant documentation through lifecycle tooling, not by hoping they search for it.

Examples:

```text
Implementer starts task
  -> Organization attaches relevant BRD, CA, ADRs, repo conventions, acceptance criteria, and project skills

Reviewer opens review
  -> Organization shows the same BRD/CA/ADR context plus review checklist

QA starts verification
  -> Organization shows acceptance criteria, user workflows, test strategy, and linked evidence requirements
```

## Documentation Enforcement

The Organization should enforce documentation through gates and tool context.

Rules:

- Product/business work must link to BRD or explicit no-BRD decision.
- Architecture-risk work must link to CA and relevant ADRs.
- Structural changes should create or update ADRs when design decisions are made.
- Reviewers must review against linked BRD, CA, ADR, and design docs.
- Implementers must acknowledge relevant docs before moving work into implementation.
- QA must verify against documented acceptance criteria and workflows.
- Delivery must link final artifacts back to the project/initiative documentation set.

When documentation is missing or stale, the work should move to:

```text
needs_business_approval
needs_architecture
needs_documentation_update
needs_rework
```

Documentation gaps should create backlog items or memory adaptation requests.

## Project Skill Libraries

Projects and repositories should have their own skill libraries.

Skills complement hats.

A hat defines role, authority, tool scope, and responsibility. A project skill defines project/repo-specific ways of working.

Examples:

- repo build and test commands;
- architecture conventions;
- coding patterns;
- initiative branch and merge workflow;
- known traps;
- test data setup;
- browser QA workflow;
- release checklist;
- debugging playbook;
- service ownership map.

Engineering Managers should curate project and repo skills as they observe teams solving problems.

Skill lifecycle:

```text
skill_gap_identified
  -> Engineering Manager or Memory hat creates skill proposal
  -> relevant department reviews
  -> skill is documented with frontmatter
  -> skill is ingested into graph
  -> skill becomes available to approved hats in project context
  -> future teams receive it automatically when relevant
```

Skill files should include structured frontmatter:

```yaml
id: repo-build-and-test
name: Repo Build and Test Workflow
scope:
  project: project-id
  repositories:
    - repo-name
departments:
  - Engineering
allowedHats:
  - Backend Implementer
  - Engineering Manager
triggers:
  - run tests
  - validate build
artifacts:
  - test evidence
owners:
  - engineering-manager-hat-id
status: active
version: 1
```

The graph should connect:

- hats;
- skills;
- projects;
- repositories;
- documentation;
- memories;
- tasks;
- artifacts;
- agents;
- performance outcomes.

This lets the Organization answer:

- which skills apply to this task?
- which docs must this agent follow?
- which agents have succeeded with this repo before?
- which memories are relevant to this hat and project?
- which reviews failed because a skill or doc was missing?

Use a graph database or graph-indexed projection when relationships become too complex for simple relational queries. The source of truth can remain the Organization DB, with graph ingestion as a query/projection layer.

## Work Item Lifecycle

Work should move through explicit states.

```text
backlog
  -> intake
  -> discovery
  -> ready
  -> planned
  -> in_progress
  -> code_review
  -> qa_review
  -> approved
  -> merged
  -> released
  -> done
```

Failure and exception states:

```text
blocked
needs_clarification
needs_architecture
needs_business_approval
needs_security_approval
needs_rework
qa_reproducible
review_rejected
cancelled
```

`ready` must mean real grooming has happened.

Ready work should have:

- clear problem statement;
- acceptance criteria;
- relevant memory attached;
- required hats identified;
- dependencies known;
- risk level;
- required artifacts;
- test expectations;
- budget estimate;
- owner or owning department;
- no unresolved clarification blockers.

## Initiative Lifecycle

Initiatives are larger bodies of work owned by TPM hats.

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

Initiative gates:

- Executive Board accepts the initiative.
- Business creates or approves BRD artifacts.
- Product or Customer Discovery confirms user/customer needs.
- Architecture creates CA artifacts and approves technical direction.
- Security approves new credentials, tools, or risky integrations.
- TPM defines staffing, hats, budget, milestones, and mission breakdown.
- Engineering completes tasks through TDD and review.
- QA verifies the delivered behavior with evidence.
- Delivery records merge/release completion.

## Business and Requirements Flow

Ambiguous or customer-facing work should pass through business discovery before implementation.

Product Owners own the business view of how a product should work.

Product Owner hats should:

- understand user and customer needs;
- define product behavior expectations;
- sign off on BRDs;
- work with architects to ensure CA artifacts support the intended business behavior;
- enforce business rules through acceptance criteria and review;
- decide when requirements are clear enough for architecture and delivery planning.

Business hats should:

- interview the user or customer when requirements are unclear;
- create BRD artifacts;
- document assumptions, needs, constraints, and acceptance criteria;
- identify open questions;
- approve or reject requirement readiness;
- hand ready requirements to Architecture and TPM hats.

The system should allow a Hermes agent wearing a Customer Interviewer hat to talk to the user, gather requirements, and produce a BRD-like artifact.

Business Analyst hats should:

- research the business area;
- clarify ambiguous requirements;
- create or refine BRDs;
- validate BRDs against source conversations and artifacts;
- coordinate with Product Owners for signoff;
- coordinate with Architecture so CAs reflect the business rules.

Product Owners sign off on the business intent. Business Analysts do the detailed discovery, documentation, clarification, and BRD preparation work.

## Architecture Flow

Architecture hats should create CA artifacts before risky or structural work begins.

Architecture hats should:

- read the BRD and related memory;
- inspect current systems and constraints;
- define conceptual architecture;
- identify tradeoffs and risks;
- define integration boundaries;
- define required changes and non-goals;
- approve architecture readiness.

Engineering work that changes infrastructure, major architecture, security boundaries, credential scope, or cross-service behavior should not proceed without architecture approval.

## Engineering Flow

Engineering hats must follow TDD for defects and implementation work.

The normal engineering sequence:

```text
1. Read task, BRD, CA, memory, and acceptance criteria.
2. Write representative failing tests first.
3. Run tests and prove failure.
4. Implement the smallest correct fix or feature.
5. Run focused tests and relevant broader checks.
6. Submit artifacts: test evidence, diff summary, logs, and notes.
7. Request code review.
```

The task system should record:

- red test artifact;
- green test artifact;
- implementation summary;
- changed files;
- commands run;
- failures encountered;
- remaining risks.

## Review Power

Review authority belongs to hats.

An agent can only mark another agent's work approved if its active hat has review power for that decision scope.

Examples:

- Code Reviewer can approve code review tasks.
- Architecture Reviewer can approve architecture gates.
- Business Approver can approve BRD readiness.
- Security Reviewer can approve credential/tool requests.
- QA Reviewer can approve QA signoff.
- Delivery Reviewer can approve merge/release readiness.

Review hats should be limited resources. The Organization should track review capacity and avoid assigning more review work than available hats can handle.

Tasks should not move to `approved`, `merged`, `released`, or `done` just because the implementer says they are done.

## QA Flow

QA hats verify whether the originally reported behavior, acceptance criteria, and user workflow are actually fixed after code review and merge/release readiness.

QA hats should:

- use browser automation where relevant;
- run scripted checks and exploratory workflows;
- capture screenshots;
- attach traces, console logs, network logs, and reproduction steps;
- verify acceptance criteria;
- sign off when behavior passes;
- bounce work back when the issue is still reproducible or the fix is insufficient.

The important failure case is not "QA work failed." The failure case is that QA identifies the original issue, workflow defect, or acceptance gap is still reproducible after the attempted fix.

When QA finds the issue is still reproducible or insufficiently fixed, the QA hat should attach:

- explicit steps to reproduce;
- expected result;
- actual result;
- screenshots;
- logs;
- traces;
- environment details;
- linked artifacts;
- suggested owning department or task.

The task should move to `qa_reproducible` or `needs_rework`, not disappear into chat history.

QA should also be able to produce structured QA reports:

- verification report;
- reproducibility report;
- browser automation report;
- regression report;
- evidence package;
- signoff report.

These reports become first-class artifacts on the work item.

## Scheduled QA Regression Runs

QA should also run scheduled verification across the app, not only task-specific signoff.

Scheduled QA runs should:

- execute known test cases;
- exercise critical user workflows;
- use browser automation where relevant;
- capture screenshots and traces;
- compare behavior against expected results;
- identify regressions;
- create QA reproducibility reports for failures;
- create or reopen defects;
- recommend new test cases when coverage is weak;
- report coverage gaps to QA Engineering Managers.

Scheduled QA flow:

```text
scheduled_qa_run
  -> select project, app area, release, or critical workflow set
  -> run test cases and browser automation
  -> collect screenshots, logs, network traces, and results
  -> create regression report
  -> create defects for reproducible failures
  -> create backlog items for missing test tooling or coverage gaps
  -> feed findings into project prioritization
```

QA Engineering hats should own the quality and evolution of these test suites. If scheduled QA repeatedly finds gaps, the Organization should create internal platform work to improve test case management and automation tooling.

## Delivery Flow

Delivery hats own the final movement from approved work to merged/released state.

The default development model is initiative-scoped feature branches:

```text
initiative approved
  -> initiative branch created
  -> CI/CD and deployment automation created or updated
  -> development, review, and QA happen on the branch
  -> branch preview or QA deployment proves the feature
  -> QA signs off the complete feature branch
  -> Delivery approves merge
  -> branch merges to main
  -> system build verification runs
```

`main` is the system build branch. It should only receive complete initiative branches after QA signoff and delivery approval.

Delivery hats should:

- ensure code review approval exists;
- ensure required tests and branch-level QA evidence exist;
- ensure CI/CD, preview/deployment, rollback, and observability automation exists or has an approved exception;
- merge only approved initiative branches into `main`;
- verify the system build after merge;
- record release or deployment evidence;
- link final artifacts to the work item;
- notify the owning TPM and initiative.

## Resource and Hat Supply Management

Hats are limited resources.

The Organization should track:

- how many agents can wear a given hat at once;
- how many sessions are active per hat;
- budget per hat, team, initiative, and department;
- Oz run cost and resource usage;
- credential scope utilization;
- review queue depth;
- blocked work due to missing hats.

TPM hats should manage resources across active tasks and teams.

Executive hats should manage budget and priority across initiatives.

If hat supply becomes a bottleneck, the Organization can:

- reprioritize work;
- create more hat assignments;
- propose new hats;
- train or specialize additional agents;
- defer lower-priority work;
- create platform/tooling tasks to improve throughput.

## Internal Platform Improvement Loop

The Organization must be able to improve itself.

After the base orchestration layer exists, internal departments should continuously build and improve the Organization's own infrastructure.

These internal teams are normal Organization teams:

- they belong to departments;
- they are staffed by Hermes agents wearing hats;
- they use the same task, review, QA, security, and delivery lifecycle;
- they produce artifacts and memory;
- their work competes for budget and hat supply like all other work.

Internal infrastructure teams can build:

- better task management tools;
- better QA test case tooling;
- better memory routing and memory review tools;
- better agent performance review dashboards;
- better hat supply and budget planning tools;
- better credential proxy integrations;
- better Oz run dashboards;
- better browser automation and screenshot comparison tools;
- better artifact tracking;
- better backlog prioritization tools;
- better report intake and triage tools;
- better MCP gateways and policy tooling.

Example:

```text
QA Engineering Manager reports QA quality problems.
Executive Board accepts that QA needs better test case tracking.
Business creates a BRD for a test case organization tool.
Architecture creates CA.
Engineering builds the tool.
QA validates it.
Memory department records lessons.
The new tool becomes available to QA hats through MCP after security approval.
```

This loop should apply to any internal capability gap:

- better QA tooling;
- better memory routing;
- better acceptance criteria tooling;
- better credential proxy workflows;
- better architecture document generation;
- better run dashboards;
- better artifact tracking;
- better reviewer queue management.

Internal platform work should flow through the same corporate lifecycle as customer-facing work, but with internal departments as the customer.

This makes the Organization self-building.

The first version should be small and manual enough to work. Over time, agents should identify missing capabilities, create reports or performance reviews, convert them into backlog items, and build the internal tools that make future orchestration better.

## Report-Driven Workflows

The Organization should accept structured reports as work intake.

Report types include:

- service request from a customer or user;
- user bug report;
- customer requirement report;
- QA reproducibility report;
- engineering manager outcome report;
- performance review report;
- DevOps pipeline failure report;
- security risk report;
- memory quality report;
- incident report;
- release readiness report.

Reports are not automatically tasks. They are evaluated, classified, prioritized, and converted into backlog items, initiatives, or direct tasks depending on severity and clarity.

Service requests and bug reports should follow a natural intake path.

```text
service_request_received
  -> classify as question, request, defect, enhancement, or incident
  -> gather missing information if needed
  -> link customer/user context
  -> determine severity and impact
  -> create defect, backlog item, or initiative candidate
  -> prioritize against project and portfolio work
```

Customer/user defects should be triaged as defects, not generic tasks.

```text
defect_reported
  -> reproduce or request reproduction evidence
  -> classify severity, scope, and owner area
  -> attach logs, screenshots, traces, and affected version
  -> decide whether urgent fix, project backlog, or initiative is needed
  -> assign TPM if coordination is required
  -> enter TDD-first engineering lifecycle
```

QA-reported defects should also be triaged.

```text
qa_defect_reported
  -> confirm reproducibility
  -> link failing test case or browser automation evidence
  -> determine whether it is regression, incomplete fix, acceptance gap, or new defect
  -> create or reopen work item
  -> prioritize against active initiative and release risk
```

Report intake flow:

```text
report_received
  -> classify report type, severity, and owning department
  -> attach evidence and source context
  -> recall relevant memory
  -> determine if clarification is needed
  -> determine required hats
  -> check hat supply and budget
  -> create backlog item, initiative, or urgent mission
  -> assign TPM or department owner
```

## DevOps Internal Workflow

The DevOps department should create internal reports when infrastructure or pipeline failures appear to be development-related.

Example:

```text
pipeline_failure_detected
  -> DevOps agent analyzes logs, stage, commit, branch, and owner signals
  -> DevOps determines whether failure is infra, flaky, dependency, test, or dev-related
  -> if dev-related, DevOps creates a pipeline failure report
  -> Organization prioritizes the report against existing work
  -> TPM hat is assigned if the fix requires coordination
  -> engineering hats are provisioned based on required skills and available hat supply
  -> fix moves through TDD, review, QA/repro verification, and delivery gates
```

DevOps reports should include:

- pipeline URL or run ID;
- failing stage;
- failing command;
- logs;
- suspected owner area;
- branch or commit;
- repro command when available;
- classification;
- recommended priority;
- impact;
- suggested required hats.

DevOps should not bypass prioritization. If hat supply is limited, the Organization must decide whether the pipeline failure interrupts current work, enters backlog, becomes an initiative, or is assigned to a waiting queue.

## Prioritization and Hat Allocation

Every report, task, and initiative competes for limited hats and budget.

Prioritization should consider:

- business impact;
- customer impact;
- production or delivery risk;
- blocked initiatives;
- severity;
- deadlines;
- available hats;
- budget;
- opportunity cost;
- dependency chains;
- whether a TPM is required;
- whether architecture, business, security, or QA gates are required.

The Organization should maintain a prioritization board where executive, TPM, department manager, and specialist hats can submit scoped votes.

Prioritization output should include:

- priority;
- owning department;
- assigned TPM when needed;
- required hats;
- hat supply reservation;
- budget allocation;
- expected artifacts;
- target lifecycle path.

If required hats are unavailable, the work should be marked as waiting for capacity, escalated for reprioritization, or converted into a request to expand hat supply.

## Capability Expansion

Agents must be able to request expansion of their capabilities.

Capability expansion includes:

- new MCP tools;
- new project or repo skills;
- new hat capabilities;
- new credential proxy scopes;
- new credential proxy endpoints;
- new external API integrations;
- new Temporal workflows;
- new Dapr actors;
- new scheduled jobs, durable triggers, or automation rules;
- new runbook skills;
- new observability or QA tooling.

Agents can identify capability gaps while doing work, during reviews, during incidents, or during scheduled team reviews. They can submit requests, but they cannot self-approve new authority.

General capability expansion flow:

```text
capability_gap_identified
  -> agent submits capability request with evidence
  -> Engineering Manager reviews operational need
  -> Department Director decides priority and departmental fit
  -> Architecture reviews design when runtime/workflow/API impact exists
  -> Security reviews tool, credential, policy, and data exposure
  -> Product/Business reviews when user/customer behavior changes
  -> implementation task or initiative is created
  -> capability is built with tests, observability, docs, and rollback plan
  -> reviewer and security approval gates pass
  -> policy, hat graph, MCP registry, workflow registry, actor registry, or credential proxy registry is updated
  -> capability becomes available only to approved hats and scopes
```

Engineering Managers own team-level capability requests. Directors own department-level capability evolution. Security owns approval for credentials, external APIs, policy changes, and dangerous automation. Architecture owns runtime and cross-service design review.

Capability requests should record:

- requesting agent;
- active hat;
- project, initiative, task, incident, or review source;
- observed limitation;
- evidence and traces;
- desired capability;
- expected benefit;
- affected departments;
- requested tools or credentials;
- data classification;
- risk level;
- proposed owner;
- required tests;
- required observability;
- rollback/deprecation plan.

Capability requests should become backlog items, direct tasks, or initiatives depending on scope and risk.

## Security and Credential Proxy Expansion

Security owns approval of new tools, credential scopes, credential proxy endpoints, external API integrations, and risky automation.

Engineering managers, directors, or agents can request new tool access, but cannot self-approve it.

Credential proxy expansion flow:

```text
request_tool_or_credential
  -> Engineering Manager confirms need and work context
  -> Director confirms department priority
  -> security_triage
  -> risk_review
  -> architecture_review when new proxy endpoint or integration is needed
  -> implementation_task
  -> build credential proxy endpoint or tool adapter
  -> add policy, audit, rate limit, and observability
  -> security_review
  -> policy_update
  -> credential proxy registry update
  -> MCP/tool registry update if agent-facing
  -> availability to approved hats
```

Security review should record:

- requested tool or credential;
- requested credential proxy endpoint or external API;
- requesting hat and task;
- intended use;
- risk level;
- allowed operations;
- denied operations;
- audit requirements;
- rate limits and budget constraints;
- data access classification;
- expiration or review date.

Cilium Service Mesh, SPIRE workload identity, and the Credential Proxy should enforce the resulting access boundary.

## Workflow and Runtime Expansion

Agents should also be able to request new Temporal workflows, durable triggers, Dapr actors, and scheduled automation when they discover repeatable organizational inefficiency.

Workflow expansion examples:

- Engineering Manager notices repeated review drift and requests `ReviewEscalationWorkflow`.
- QA Engineering Manager notices repeated missed test coverage and requests `RegressionSuiteLifecycleWorkflow`.
- Security Manager notices repeated credential mistakes and requests `CredentialScopeApprovalWorkflow`.
- Director notices department handoffs are slow and requests a department-specific initiative intake workflow.
- Incident Commander notices repeated remediation steps and requests a runbook-backed `IncidentMitigationWorkflow`.

Workflow expansion flow:

```text
workflow_gap_identified
  -> agent or manager submits workflow capability request
  -> Engineering Manager validates team/process need
  -> Department Director prioritizes it for department capability
  -> Architecture reviews workflow boundaries and state ownership
  -> Security reviews policy, credentials, and automation risk
  -> implementation creates Temporal workflow/activity definitions
  -> tests cover deterministic workflow behavior and activity idempotency
  -> observability, SLOs, rollback, and versioning are documented
  -> workflow is registered in the Organization workflow catalog
  -> rules/triggers can launch it only under approved policy
```

Temporal workflow creation must remain governed. Hermes agents may propose, design, and implement workflow code, but the runtime only enables it after code review, architecture review, security review, and workflow registry approval.

## Engineering Management

Engineering Management hats ensure teams are set up to succeed.

They should:

- confirm tasks have acceptance criteria;
- ensure relevant memories are attached;
- ensure architecture and business gates are satisfied;
- confirm the right hats are staffed;
- monitor blocked work;
- request backlog items for missing tools or process gaps;
- ensure future teams working on related tasks receive the right memory and artifacts.

Engineering managers do not replace implementers or reviewers. They manage readiness, context, staffing, and process quality.

At any given time, an engineering manager hat for a department or project area is the organizer of that area's teams.

Engineering managers should actively manage:

- which teams exist;
- when teams run;
- which scheduled reviews and QA checks run;
- which hats are assigned;
- whether the right memory is attached;
- whether tasks are ready;
- whether teams are blocked;
- whether TPMs need to reprioritize or escalate;
- whether executives need to adjust budget or hat supply.

Scheduled workflows should not be ownerless timers. They should be owned by department or project managers.

Examples:

- QA Engineering Manager schedules regression suites.
- Engineering Manager schedules team reviews.
- Memory Manager schedules memory quality reviews.
- DevOps Manager schedules pipeline health reviews.
- Security Manager schedules credential-scope audits.

These managers coordinate with TPMs and executives to make sure schedules, resources, and priorities are aligned.

Engineering managers also need their own management tasks.

Management tasks include:

- determine whether assigned teams reached their goals;
- compare delivered artifacts against acceptance criteria;
- inspect whether red tests were created before implementation;
- inspect whether green test evidence is representative;
- review code review outcomes and QA outcomes;
- identify whether failures were caused by unclear requirements, poor memory recall, weak tools, wrong hat assignment, insufficient review, or agent performance;
- create performance reviews for agents, teams, hats, and processes;
- recommend backlog items to close gaps;
- recommend memory updates for future related tasks;
- recommend hat supply changes when staffing bottlenecks hurt delivery;
- escalate systemic issues to Executive Board, QA Engineering, Security, Architecture, or Memory departments.

An engineering manager's job is not complete when a task is marked done. It is complete when the manager has evaluated whether the team achieved the intended outcome and recorded any follow-up work needed to improve future delivery.

## Outcome and Performance Review Loop

Every significant task, mission, and initiative should produce an outcome review.

Outcome reviews should answer:

- Did the team meet the stated goal?
- Did the work satisfy acceptance criteria?
- Were required BRD, CA, test, review, QA, and delivery artifacts produced?
- Did the agents follow required process such as TDD-first implementation?
- Were the right hats assigned?
- Were reviewers effective?
- Did QA catch issues before delivery?
- Did memory retrieval help or hurt?
- Were tools missing or inadequate?
- Did cost, runtime, or hat supply exceed expectations?
- What should change before similar work happens again?

Performance review targets:

- individual agent;
- hat assignment;
- team;
- department;
- initiative;
- tool;
- memory scope;
- Organization process.

Bad or weak performance reviews should not just become comments. They should be converted into actionable backlog items when there is a fixable gap.

Examples:

```text
Review finding: QA missed visual regression.
Backlog item: Build screenshot-diff tool for QA hats.

Review finding: implementers skipped red tests.
Backlog item: Strengthen task gate so code work cannot move to review without red-test artifact.

Review finding: agents lacked relevant memory.
Backlog item: Improve memory recall policy for related repo and hat scope.

Review finding: Security reviews are blocking credential requests.
Backlog item: Increase Security Reviewer hat supply or improve credential request templates.
```

Backlog items from performance reviews should flow through the same corporate lifecycle:

```text
performance_review
  -> backlog_item
  -> business / internal customer clarification
  -> architecture when needed
  -> implementation
  -> review
  -> QA
  -> rollout
```

## Scheduled Team Reviews

The Organization should run scheduled review jobs.

These jobs are internal recurring workflows, not user-requested one-offs.

Scheduled review types:

- team review;
- member performance review;
- hat effectiveness review;
- department review;
- initiative health review;
- memory quality review;
- tool effectiveness review;
- budget and hat supply review;
- QA regression coverage review.

Team review flow:

```text
scheduled_team_review
  -> list active and recently completed teams
  -> evaluate team goals and outcomes
  -> inspect each member's assigned tasks
  -> inspect each member's artifacts, reviews, rework, and blocked work
  -> create member performance reviews
  -> create team outcome review
  -> identify process, memory, tooling, or staffing gaps
  -> create recommended actions
  -> prioritize actions into backlog or initiatives
```

Member review should evaluate:

- goal completion;
- quality of artifacts;
- TDD compliance;
- review outcomes;
- QA bounce-backs;
- communication quality;
- task throughput;
- memory use;
- tool use;
- cost and runtime;
- whether the agent was wearing an appropriate hat;
- whether the hat definition or memory scope needs refinement.

Scheduled reviews should not automatically punish agents. They should produce actionable improvements for agents, hats, memory, tools, and process.

## Memory Adaptation Review

Engineering managers and memory hats should evaluate whether memories need to be adapted, changed, deprecated, or created.

Memory adaptation triggers:

- team repeated an old mistake;
- agent missed relevant context;
- agent used stale memory;
- memory was too broad or leaked into the wrong hat scope;
- acceptance criteria were misunderstood;
- related future teams need better context;
- performance review identified memory-related failure.

Memory adaptation actions:

- create memory;
- update memory;
- deprecate memory;
- split memory by hat scope;
- change memory visibility;
- add memory to project or initiative context;
- request memory tooling improvement;
- create backlog item for memory system work.

Memory changes should be reviewed when they affect broad organization behavior.

Memory adaptation flow:

```text
memory_issue_identified
  -> memory hat reviews source evidence
  -> engineering manager confirms task/process impact
  -> update or propose memory change
  -> create backlog item if tooling or policy work is needed
  -> prioritize through normal backlog flow
```

## Hat Authorization and Deprovisioning

Hats must have enforceable runtime authorization.

Each active hat assignment should receive a short-lived authorization token, such as a JWT, that represents:

- agent ID;
- hat ID;
- hat assignment ID;
- session ID;
- Oz run ID;
- department;
- allowed MCP tools;
- credential scopes;
- memory scopes;
- voting scopes;
- expiration time;
- issuer;
- policy version.

Agents should not keep hat authority forever.

Hat tokens should expire and require refresh. On refresh, the Organization checks:

- whether the agent still exists;
- whether the hat assignment is still active;
- whether the session or task is still active;
- whether the Organization has deprovisioned the hat;
- whether budget or concurrency limits still allow the hat;
- whether security policy changed;
- whether the agent was suspended or reassigned.

If refresh fails, the agent becomes roleless for that Organization context.

Roleless agents:

- cannot call protected Organization MCP tools;
- cannot access hat-scoped memory;
- cannot access credential proxy scopes;
- cannot vote;
- cannot approve or mark work done;
- may only call minimal tools such as `read_assignment_status`, `request_hat`, or `shutdown_self`.

This supports cost and supply management. The Organization can deprovision hats when work completes, budgets tighten, reviews fail, or higher-priority initiatives need the capacity.

JWTs should not be the only control. MCP gateway policy, credential proxy policy, Organization state, SPIRE workload identity, and Cilium service policy should all check the active hat assignment.

Recommended validation path:

```text
Hermes agent calls MCP tool
  -> MCP Gateway validates JWT
  -> Gateway resolves AgentSessionActor by session ID
  -> AgentSessionActor returns current runtime context
  -> Gateway checks Organization state for active hat assignment
  -> Gateway builds ToolExecutionContext from actor context + Organization state
  -> Gateway evaluates OPA/RBAC policy
  -> Gateway checks tool-specific scope
  -> Gateway checks current mode, task/team/meeting/run scope, and actor heartbeat
  -> Credential Proxy / Memory Adapter / Task Service performs its own authorization check
  -> Gateway records tool activity back to AgentSessionActor
```

This makes hat authority revocable, auditable, and time-bound.

`AgentSessionActor` should act as the live context authority for the session. It should know the active hat assignment, current task, current team, current meeting, current Oz run, memory scopes, credential scopes, current mode, policy version, and last heartbeat. It should not replace Organization DB truth; it gives the MCP Gateway the ambient runtime context needed to execute tools safely.

## Memory Department

Memory hats manage institutional knowledge.

They should:

- inspect whether new tasks have relevant memories attached;
- curate memories produced by completed work;
- detect duplicate or stale memories;
- recommend memory scopes for hats;
- ensure future related tasks receive relevant context;
- flag missing memory when teams repeat mistakes.

Memory hats can request new backlog items when the memory system needs better tooling, attribution, or retrieval quality.

## Goal Intake

When Oz or a user submits a goal, the Organization should not immediately spawn random workers.

It should first run goal intake:

```text
Goal received
  -> classify ambiguity and risk
  -> recall relevant memory
  -> Executive Board votes on required hats
  -> if unclear, assign Customer Interviewer / Requirements Analyst
  -> produce requirement artifacts
  -> plan departments and teams
  -> start execution runs
```

Ambiguous goals should be clarified through an interview process.

The Customer Interviewer hat should:

- ask the user targeted questions;
- extract customer requirements;
- produce requirement documents;
- identify open assumptions;
- hand off to Product, Architecture, or Mission Control.

## Mission Control

Mission Control is a temporary team formed around a concrete mission.

It receives:

- goal statement;
- clarified requirements;
- constraints;
- acceptance criteria;
- relevant memory;
- required hats;
- budget and policy;
- artifact expectations.

Mission Control then coordinates execution until the mission is complete.

Mission Control may spawn:

- implementation teams;
- research teams;
- architecture review teams;
- test teams;
- release teams;
- customer feedback teams.

## Voting Board

The Organization needs a voting board for role selection and major decisions.

Voting is scoped by hats.

Examples:

- Architecture Governance can vote on architecture readiness.
- Product Leadership can vote on requirement completeness.
- Security Reviewer can vote on security acceptance.
- Delivery Governance can vote on release readiness.
- Executive Strategy can vote on goal priority and department allocation.

Votes should be persisted with:

- voter agent ID;
- hat assignment ID;
- decision scope;
- rationale;
- confidence;
- timestamp;
- links to evidence.

## Communication Model

Agents need multiple communication modes.

Communication should be governed by active hat, department, hierarchy, task context, and policy.

Core communication primitives:

- report;
- inbox message;
- team broadcast;
- one-on-one chat;
- team chat;
- department-wide channel;
- executive meeting;
- escalation;
- meeting request;
- decision vote.

Communication is not just text. Different communication modes can open different infrastructure capabilities:

- memory creation;
- document creation;
- hat proposal;
- task creation;
- voting;
- escalation;
- artifact linking;
- decision recording;
- meeting transcript persistence.

## Inboxes and Reports

Reports should be delivered to typed inboxes.

Inbox types:

- agent inbox;
- hat inbox;
- team inbox;
- department inbox;
- project inbox;
- initiative inbox;
- executive inbox;
- escalation inbox.

Reports and messages should include:

- sender agent ID;
- sender active hat;
- recipient scope;
- message type;
- task/project/initiative context;
- priority;
- requested action;
- expiration or due date;
- links to evidence;
- whether response is required.

Department-wide reporting should be the default for structured findings. Ad hoc chat should be used when a conversation is needed to resolve ambiguity or make a decision.

## One-on-One Chats

One-on-one chats are scoped conversations between two agents or hats.

They can be opened for:

- clarification;
- coaching;
- handoff;
- review discussion;
- performance review;
- memory adaptation;
- hat proposal;
- conflict resolution;
- task planning.

One-on-one chat should require a reason and scope.

During one-on-one mode, the participants can:

- create memories;
- create documents;
- propose tasks;
- propose hats;
- make scoped decisions if both hats have authority;
- escalate if authority is insufficient.

One-on-one chat should be allowed with same-level or lower-hierarchy hats by default, depending on active hat and department policy. Higher-level chats require request, invitation, or escalation.

## Team Chats and Meetings

Team chats are multi-agent conversations with a defined membership, purpose, and conversation mode.

Meeting types:

- team planning;
- task review;
- architecture review;
- QA triage;
- incident triage;
- executive meeting;
- TPM status meeting;
- performance review;
- handoff meeting;
- decision meeting.

Team chats should choose a conversation mode.

Conversation modes:

- leader-led: the meeting leader decides the order and final synthesis;
- round-robin: each participant speaks in a fixed order;
- pass-the-stick: current speaker chooses the next speaker;
- vote-driven: proposals are discussed and then voted on;
- reviewer-panel: reviewers ask questions and produce decisions;
- open-discussion: free discussion with a moderator;
- executive-session: executive leader controls agenda, motions, and votes.

The selected mode determines how the Organization routes turns, records decisions, and closes the meeting.

Executive meetings may be CEO-led or Executive Board-led.

TPM meetings may be TPM-led with development teams, reviewers, QA, and engineering managers.

Engineering managers may call meetings with their teams and TPMs.

The CEO or other executive hats can schedule meetings with TPMs, engineering managers, and development teams when priority, delivery, or organizational health requires it.

## Broadcasts

Team broadcasts are shared messages delivered to all team members.

Broadcasts are for information all members need, not for complex discussion.

Examples:

- priority change;
- new blocker;
- test evidence available;
- architecture decision published;
- QA reproduced issue;
- meeting scheduled;
- delivery deadline changed;
- task reassignment.

Broadcasts should be recorded and linked to the relevant team/task/initiative.

## Escalation Chains

The platform should enforce guardrails mostly through escalation chains, not excessive hard-coded behavior.

Escalation examples:

```text
Implementer blocked by unclear acceptance criteria
  -> Engineering Manager
  -> TPM
  -> Product / Business
  -> Executive Board if priority or scope changes

QA finds issue still reproducible
  -> Engineering Manager
  -> TPM
  -> owning implementer/reviewer
  -> Executive Board if release risk is high

Agent requests new credential scope
  -> Security Manager
  -> Security Reviewer
  -> Executive Board for high-risk scopes

Team lacks required hat supply
  -> Engineering Manager
  -> TPM
  -> Executive Board
```

Escalation should open the appropriate report, inbox item, chat, or meeting based on type and severity.

## Hat Growth and Agent Specialization

Agents may become stronger in certain hats over time.

This happens because memories, performance reviews, task history, and artifacts accumulate around:

- agent ID;
- hat ID;
- department;
- project;
- task type.

Some hats may become associated with agents that have proven performance. Other hats may rotate frequently to avoid overfitting, cost concentration, or governance risk.

The Organization should track:

- which agents perform well in which hats;
- which hats have strong memory fit for which agents;
- which agents should be candidates for future hat assignments;
- whether long-lived hats should be renewed, rotated, or revoked.

Executive Board should own final authority for high-power hat assignment and rotation.

## Memory Model

Agents have memory. Hats scope and attribute memory.

Memory recall should consider:

- agent identity;
- active hat;
- task;
- department;
- project;
- organization;
- source repo;
- customer or domain;
- visibility policy.

Memory writes should include:

- agent ID;
- hat ID;
- hat assignment ID;
- task ID;
- session ID;
- department ID;
- source artifact;
- visibility;
- confidence;
- timestamp.

If Hindsight cannot support this level of metadata, scoped retrieval, and attribution, the Organization may need an adapter layer or a fork.

Start with an adapter first. Fork only if Hindsight cannot enforce hat-scoped recall and attribution.

## Observability and Telemetry Spine

The Organization should be obsessively observable.

Observability is not just for debugging infrastructure. It is how the Organization sees itself, how humans understand what is happening, how agents improve their own tools, and how self-healing becomes possible.

Every meaningful action should produce:

- an authoritative state transition when state changes;
- a domain event;
- a structured audit log;
- a distributed trace span;
- metrics when the action affects throughput, latency, reliability, budget, or quality;
- linked artifacts when human-reviewable evidence exists.

This applies to:

- goal intake;
- project and initiative changes;
- hat assignment and deprovisioning;
- JWT refresh and denial;
- policy evaluation;
- Oz run creation and lifecycle;
- Hermes session and turn lifecycle;
- subagent/team spawning;
- MCP tool calls;
- NATS publish/consume/replay/dead-letter events;
- credential proxy allow/deny/use;
- Hindsight memory reads and writes;
- documentation context reads;
- skill usage and skill ingestion;
- task state transitions;
- gate decisions;
- review decisions;
- QA runs and reproducibility decisions;
- meetings, votes, and decisions;
- artifact creation;
- self-healing attempts.

Every run should be traceable across:

```text
goal/request
  -> project/initiative/task
  -> active hat assignment
  -> Hermes agent/session/turn
  -> Oz run
  -> k3s pod/container
  -> MCP tool calls
  -> policy checks
  -> credential proxy requests
  -> memory/documentation/skill reads
  -> NATS events
  -> artifacts
  -> resulting state transitions
```

Agents should be required to build internal tools and project features with observability from the start.

Agent-created systems should expose:

- status endpoints or MCP status tools;
- structured logs;
- trace spans;
- metrics;
- health checks;
- readiness checks;
- linked artifacts for evidence;
- clear failure codes;
- remediation recommendations;
- UI-readable state.

Review gates should reject infrastructure and internal platform work that cannot answer:

```text
What happened?
Why did it happen?
Which agent and hat caused it?
Which policy allowed or denied it?
Which project, initiative, task, and run were affected?
What evidence was produced?
What failed or degraded?
Was it retried?
Was it self-healed?
Was it escalated?
What should future agents learn from it?
```

## Self-Healing and Improvement Loop

Self-healing should be built from observable facts.

The Organization should not guess. It should classify issues from state, traces, logs, metrics, artifacts, and known failure patterns.

Basic loop:

```text
detect anomaly
  -> correlate state, trace, logs, metrics, artifacts
  -> classify failure mode
  -> check policy for allowed remediation
  -> run safe remediation if allowed
  -> verify result
  -> record outcome
  -> escalate if unresolved
  -> create report/backlog item if recurring or systemic
  -> update memories, skills, docs, or hats when approved
```

Examples:

- stuck Oz run creates a run health report, attempts a safe retry, and escalates to DevOps if retry fails;
- repeated MCP timeout creates an internal reliability backlog item;
- repeated QA reproducibility failures create a test tooling or project skill request;
- repeated memory misses create a memory adaptation request;
- frequent credential proxy denials create either a Security review request or a documentation/skill update request;
- recurring review rejection reasons create Engineering Manager performance review actions.

This is one of the main ways the Organization becomes self-building. It observes its own failure modes, turns them into governed work, and improves its tools and processes over time.

The self-healing loop depends on the always-on runtime:

- durable triggers detect timeouts, stale state, metric thresholds, and external changes;
- organizational rules decide whether to create work, escalate, launch agents, or attempt remediation;
- runtime leases prevent duplicate remediation;
- runbook skills define safe operational procedures;
- SLOs and error budgets influence priority and admission control;
- incident rules determine severity, commander assignment, communication cadence, rollback authority, and postmortem requirements.

## Organization MCP Tools

Hermes agents interact with the Organization through MCP tools.

Initial tool families:

```text
Goal tools
  submit_goal, submit_report, submit_service_request, classify_report, clarify_goal, classify_goal, create_initiative, promote_backlog_to_initiative

Project tools
  create_project, update_project_priority, assign_project_department, read_project_status

Portfolio and initiative tools
  create_portfolio, create_initiative, assign_tpm, set_budget, set_priority, read_initiative_status

Hat tools
  list_hats, request_hat, propose_hat, approve_hat, assign_hat, release_hat, deprovision_hat, refresh_hat_token, read_hat_supply

Agent insight tools
  rank_agents_for_hat, read_agent_specialties, read_agent_memory_profile, read_hat_performance_history, recommend_hat_assignment

Voting tools
  open_vote, submit_vote, close_vote, read_vote_result

Team tools
  create_team, spawn_agent, spawn_team, assign_task, stop_agent, stop_team

Task tools
  create_task, claim_task, update_task, block_task, groom_task, mark_ready, submit_red_tests, submit_green_tests, complete_task

Backlog tools
  create_backlog_item, prioritize_backlog_item, link_backlog_item, convert_backlog_item, create_backlog_item_from_review, create_defect_from_report

Messaging tools
  send_message, read_inbox, send_report, open_thread, reply_thread, request_one_on_one_chat, open_team_chat, send_team_broadcast, escalate

Artifact tools
  submit_artifact, list_artifacts, link_artifact, require_artifact, attach_screenshot, attach_trace, attach_log

Business tools
  start_customer_interview, record_customer_answer, create_brd, approve_brd, reject_brd

Architecture tools
  create_ca, request_architecture_review, approve_architecture, reject_architecture

Review tools
  request_review, submit_review, approve_gate, reject_gate, assign_reviewer, create_outcome_review, create_performance_review

Memory tools
  query_memory, write_memory, explain_memory_scope

Credential tools
  request_credential_scope, review_credential_scope, approve_credential_scope, use_credential_proxy

QA tools
  create_test_case, run_browser_check, run_scheduled_qa_suite, record_qa_result, create_reproducibility_report, create_regression_report, qa_signoff, qa_bounce_back

DevOps tools
  submit_pipeline_failure_report, classify_pipeline_failure, attach_pipeline_log, recommend_dev_owner

Delivery tools
  request_merge, approve_merge, record_merge, record_release

Status tools
  read_org_status, read_team_status, read_run_status, read_budget_status, read_review_queue

Observability tools
  read_trace, read_audit_events, read_run_logs, read_agent_timeline, record_metric, create_health_report, classify_anomaly, request_self_healing, record_self_healing_result

Always-on runtime tools
  list_rules, evaluate_rules, read_reaction_plan, approve_reaction_plan, list_triggers, pause_trigger, resume_trigger, read_scheduler_status, read_worker_heartbeat, read_runtime_lease, release_runtime_lease, read_dead_letters, request_dlq_replay, quarantine_dead_letter, read_slo_status, open_incident, assign_incident_commander

Meeting tools
  request_meeting, schedule_meeting, open_meeting, set_conversation_mode, submit_meeting_decision, close_meeting

Scheduled review tools
  schedule_team_review, schedule_department_review, schedule_qa_regression, run_team_review, create_memory_adaptation_request, create_hat_effectiveness_review
```

All tools must be policy checked.

## Credential Proxy

Hermes agents should not receive raw broad credentials.

They should receive scoped access through a credential proxy.

Access should be based on:

- agent identity;
- active hat;
- task;
- session;
- department;
- Oz run ID;
- mesh identity;
- Organization policy.

Cilium Service Mesh and SPIRE workload identity can enforce that only the correct agent workloads can reach the credential proxy endpoints.

## Cilium and SPIRE as Infrastructure Injection

Cilium Service Mesh is not code-level dependency injection. It is infrastructure injection at the CNI and Gateway layer. SPIRE provides workload identity, and Trust Manager distributes trusted CA bundles.

It can provide:

- workload identity through SPIRE;
- mTLS between services;
- authorization policy;
- service routing through Gateway API;
- traffic shifting;
- egress control;
- telemetry through Hubble;
- access boundaries around MCP gateway, NATS, memory, and credential proxy.

This lets the Organization inject dependencies and permissions around Hermes containers without giving agents uncontrolled access.

## Session Containers

Each Oz-run Hermes session container should include:

- Hermes runtime;
- Organization MCP config;
- NATS connection config;
- workspace or repo access;
- credential proxy URL;
- memory adapter URL;
- agent profile;
- active hat assignment;
- resource limits;
- audit context.

One container may host one or more Hermes agents, but the simplest model is one primary Hermes agent per container until multiplexing is proven safe.

## State Ownership

Oz owns run lifecycle.

Organization owns organizational truth.

NATS owns event transport.

Hindsight owns long-term memory storage.

Credential Proxy owns secret exchange.

Cilium owns CNI, service mesh policy, Gateway API, ingress, and Hubble telemetry.

SPIRE owns workload identity.

cert-manager, Vault, Trust Manager, and External Secrets own TLS, secrets, CA distribution, and secret synchronization.

Hermes owns reasoning and work.

## First Proof

The first proof should demonstrate:

```text
1. User or Oz submits ambiguous goal.
2. Organization opens intake.
3. Executive Board hats vote that clarification is needed.
4. Customer Interviewer Hermes agent is launched through Oz.
5. Interviewer asks user questions and creates requirements artifact.
6. Business hat creates BRD and submits it for approval.
7. Architecture hat creates CA and submits it for approval.
8. Executive Board votes on needed hats, budget, TPM assignment, and departments.
9. TPM hat creates an initiative plan and Mission Control team.
10. Engineering Manager hat grooms work to ready.
11. Implementer hat writes red tests first and records failing evidence.
12. Implementer completes the work and records green test evidence.
13. Reviewer hat approves or rejects the work.
14. Delivery hat records merge or release readiness.
15. QA hat uses browser automation, screenshots, logs, and traces to sign off or bounce back.
16. Organization records completion, artifacts, votes, and memory attribution.
```

This proves the core model:

- Oz orchestration;
- Hermes agents;
- hats;
- limited hat supply;
- scoped memory;
- voting;
- MCP-governed actions;
- BRD and CA artifacts;
- TDD-first engineering;
- task execution;
- artifact submission;
- review;
- QA signoff;
- delivery tracking;
- Organization-owned state.

## Open Questions

- Does Oz expose the exact run creation and child-run APIs needed for Hermes-driven spawning?
- Can Hermes run reliably as a containerized, resumable session under Oz/k3s?
- Does Hindsight support metadata-rich memory attribution and scoped recall, or is an adapter/fork required?
- Should one container run one Hermes agent, or can multiple agents safely share a container?
- What is the minimum Executive Board size for useful voting without excess cost?
- Which hat has authority to create or approve new hats?
- Should votes be majority, weighted by hat, consensus, or policy-defined per decision type?
- What state belongs in CockroachDB versus run-orchestrator metadata versus Hindsight?
- Where should long-running initiatives live: Organization DB only, or Oz parent/child run hierarchy too?
