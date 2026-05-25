# Department, Hat, and Tool Inventory

This document is the first inventory for the Agentic Organization. It expands the architecture into concrete departments, hats, MCP tool bundles, approval powers, and ownership boundaries.

The goal is not to freeze the company shape forever. The Organization should be able to evolve itself. This inventory defines the starter graph that lets it operate safely while it learns which hats, tools, memories, workflows, and departments need to be added.

## Inventory Principles

- A hat is a role, policy, tool, credential, memory, voting, and responsibility bundle.
- A Hermes agent can wear one or more hats only through active hat assignments.
- Hat authority is time-bound, revocable, and checked through JWT refresh against Organization state.
- Memory belongs to agents, but memory reads and writes are scoped and attributed by active hat.
- Every protected MCP tool call must resolve the caller through `AgentSessionActor`, validate the active `HatAssignment`, evaluate RBAC/OPA policy, check domain preconditions, write audit evidence, and update actor activity.
- Request-provided IDs are lookup hints, not authority. The actor and Organization DB decide the effective agent, hat, team, task, project, run, and credential scope.
- Implementers cannot approve their own work.
- Capability expansion cannot be self-approved by the requesting agent.
- Scheduled jobs, triggers, reactions, and automation must have owner hats and owner departments.
- The Organization DB is the authoritative system of record. Temporal, Dapr Actors, NATS, Oz/Warp orchestration, OpenZiti transport, Hindsight, and observability stores are execution or projection layers.

## Operating Hierarchy

```text
Executive Board
  -> C-suite hats
      -> Department Directors
          -> TPMs, Department Managers, Engineering Managers
              -> Team Leads and Mission Control Leads
                  -> Specialists, Reviewers, Operators, QA, Implementers
```

The Executive Board is the ultimate organizational authority. It elects and reviews high-authority hats, creates or retires departments, approves major hat classes, and resolves unresolved cross-department escalations.

C-suite hats set standards and priorities. Directors translate those standards into department portfolios and initiative priorities. TPMs coordinate initiatives. Managers ensure teams have context, memories, acceptance criteria, tools, and staffing. Specialists execute scoped work. Review hats approve or reject gates.

## Department Inventory

| Department | Reports to | Owns | Core hats |
|---|---|---|---|
| Executive Board and Governance | Executive Board | Org shape, high-power hats, policy, major priorities, budget ceilings, dangerous overrides, final escalations | Executive Board Member, CEO, CTO, COO, CFO, Chief Architect, Voting Board Chair, Policy Steward, Hat Approval Steward |
| Program and Initiative Management | COO, with CEO priority input | Initiative lifecycle, mission formation, task sequencing, dependency coordination, escalation routing | Program Director, Senior TPM, TPM, Mission Control Lead, Initiative Planner, Portfolio Coordinator, Dependency Manager, Blocker Manager |
| Product and Customer Discovery | CEO | Product intent, customer needs, behavior expectations, product acceptance criteria, product signoff | Product Director, Product Owner, Customer Interviewer, Requirement Clarifier, Acceptance Criteria Owner, Customer Feedback Lead |
| Business Analysis | Product Director or CEO | BRDs, ambiguity reduction, business evidence, assumptions, open questions, requirements readiness | BA Director, Business Analyst, Requirements Analyst, BRD Author, BRD Reviewer, Business Approver, Domain Researcher |
| Architecture | CTO or Chief Architect | CA documents, ADRs, tradeoffs, non-goals, integration boundaries, architecture gates, runtime design review | Chief Architect, Architecture Director, Architect, Conceptual Architect, Architecture Reviewer, ADR Steward, Integration Architect, Runtime Architecture Reviewer |
| Engineering | CTO | TDD implementation, code changes, focused validation, implementation evidence, code review | Engineering Director, Backend Implementer, Frontend Implementer, Full-Stack Implementer, Defect Fixer, Test-First Engineer, Integration Engineer, Tooling Engineer, Code Reviewer |
| Engineering Management | CTO and COO | Task readiness, staffing, memory/context attachment, team health, blocked work, outcome reviews, performance reviews | Engineering Manager, Team Lead, Readiness Reviewer, Context Attachment Reviewer, Outcome Reviewer, Performance Review Author, Capability Request Triage |
| QA and Verification | COO, partnering with CTO | Acceptance verification, browser checks, screenshots, traces, logs, reproducibility reports, QA signoff, bounce-back reports | QA Director, QA Verifier, QA Reviewer, Browser Automation QA, Regression Verifier, Reproducibility Analyst, Evidence Package Author |
| QA Engineering | CTO, dotted line to QA Director | Test automation tooling, scheduled regression suites, coverage gaps, test case systems, flaky test triage | QA Engineering Director, QA Engineering Manager, QA Automation Engineer, Test Suite Maintainer, Coverage Analyst, Regression Scheduler, Test Case Manager |
| Security and Compliance | CEO and CTO, with independent veto | Credential proxy scopes, tool expansion approval, policy changes, external API review, security gates, audit requirements | Security Director, Security Reviewer, Credential Scope Approver, Policy Engineer, External API Reviewer, Dangerous Automation Reviewer, Audit Reviewer |
| Delivery and Release | COO | Merge readiness, release readiness, deployment evidence, rollback coordination, final delivery gates | Delivery Director, Release Manager, Release Operator, Delivery Reviewer, Merge Steward, Deployment Evidence Author, Rollback Coordinator |
| Memory and Knowledge Management | COO, partnering with all departments | Hindsight attribution, memory scopes, stale and duplicate memories, project context routing, memory adaptation | Memory Director, Memory Manager, Memory Curator, Memory Reviewer, Memory Scope Steward, Memory Adaptation Reviewer, Knowledge Router, Project Context Librarian |
| Documentation and Project Skills | Architecture and Memory, with COO process ownership | BRD/CA/ADR/design-doc lifecycle, documentation gates, repo skills, project skill ingestion, skill graph quality | Documentation Systems Director, ADR Steward, Design Doc Steward, Documentation Reviewer, Project Skill Author, Skill Graph Curator, Documentation Enforcement Reviewer |
| Operations and Infrastructure | COO for operating health, CTO for platform design | Always-on runtime, schedulers, durable triggers, queues, DLQs, Oz/k3s reconciliation, NATS health, incidents, SLOs, runbooks, capacity | Operations Director, Platform Operator, Runtime Steward, SRE, Incident Commander, DLQ Steward, Scheduler Steward, Trigger Steward, Runbook Maintainer, Cost Controller |
| Observability and Evidence | Operations, with QA and Architecture consumers | Traces, metrics, health reports, anomaly reports, telemetry coverage, evidence quality, UI observability projections | Observability Director, Observability Curator, Trace Analyst, Trace and Evidence Steward, Health Report Reviewer, Anomaly Classifier, Coverage Gap Reporter |
| Capability and Automation Expansion | Executive Board, Architecture, Security, and Directors by scope | New hats, tools, workflows, actors, MCP registry entries, automation patterns, capability review flow | Hat Designer, Capability Request Owner, Tool Registry Steward, Automation Expansion Reviewer, Workflow Maintainer, Actor Registry Maintainer, MCP Registry Maintainer |

## Tool Bundles

Hat records should store concrete tool IDs, but the design is easier to reason about through reusable bundles.

| Bundle | Tools |
|---|---|
| Goal Intake | `submit_goal`, `submit_report`, `submit_service_request`, `classify_report`, `clarify_goal`, `classify_goal`, `create_initiative`, `promote_backlog_to_initiative` |
| Project | `create_project`, `update_project_priority`, `assign_project_department`, `read_project_status` |
| Portfolio and Initiative | `create_portfolio`, `create_initiative`, `assign_tpm`, `set_budget`, `set_priority`, `read_initiative_status` |
| Hat Authorization | `list_hats`, `request_hat`, `propose_hat`, `approve_hat`, `assign_hat`, `release_hat`, `deprovision_hat`, `refresh_hat_token`, `read_hat_supply` |
| Agent Insight | `rank_agents_for_hat`, `read_agent_specialties`, `read_agent_memory_profile`, `read_hat_performance_history`, `recommend_hat_assignment` |
| Voting | `open_vote`, `submit_vote`, `close_vote`, `read_vote_result` |
| Team Runtime | `create_team`, `spawn_agent`, `spawn_team`, `assign_task`, `stop_agent`, `stop_team` |
| Work Rhythm | `read_schedule`, `propose_schedule_adjustment`, `approve_schedule_adjustment`, `start_schedule_block`, `complete_schedule_block`, `request_reflection_block`, `record_free_time_output` |
| Prompt Flow | `list_available_prompt_flows`, `start_prompt_flow`, `submit_prompt_flow_phase`, `request_prompt_flow_gate`, `approve_prompt_flow_gate`, `reject_prompt_flow_gate`, `propose_prompt_flow`, `deprecate_prompt_flow` |
| Universal Action Grammar | `list_universal_actions`, `validate_universal_action`, `record_action_observation`, `request_action_correction`, `record_action_reversal`, `promote_action_to_phase` |
| Task | `create_task`, `claim_task`, `update_task`, `block_task`, `groom_task`, `mark_ready`, `submit_red_tests`, `submit_green_tests`, `complete_task` |
| Backlog and Defect | `create_backlog_item`, `prioritize_backlog_item`, `link_backlog_item`, `convert_backlog_item`, `create_backlog_item_from_review`, `create_defect_from_report` |
| Messaging | `send_message`, `read_inbox`, `send_report`, `open_thread`, `reply_thread`, `request_one_on_one_chat`, `open_team_chat`, `send_team_broadcast`, `validate_discussion_anchor`, `escalate` |
| Meeting | `request_meeting`, `schedule_meeting`, `open_meeting`, `set_conversation_mode`, `submit_meeting_decision`, `close_meeting`, `validate_discussion_anchor` |
| Artifact and Evidence | `submit_artifact`, `list_artifacts`, `link_artifact`, `require_artifact`, `attach_screenshot`, `attach_trace`, `attach_log` |
| Business | `start_customer_interview`, `record_customer_answer`, `create_brd`, `approve_brd`, `reject_brd` |
| Architecture | `create_ca`, `request_architecture_review`, `approve_architecture`, `reject_architecture` |
| Review and Gates | `request_review`, `submit_review`, `approve_gate`, `reject_gate`, `assign_reviewer`, `create_outcome_review`, `create_performance_review` |
| Memory | `query_memory`, `write_memory`, `explain_memory_scope`, `reflect_on_memory`, `propose_memory_update`, `deprecate_memory`, `create_memory_adaptation_request` |
| Credential Proxy | `request_credential_scope`, `review_credential_scope`, `approve_credential_scope`, `use_credential_proxy` |
| QA | `create_test_case`, `run_browser_check`, `run_scheduled_qa_suite`, `record_qa_result`, `create_reproducibility_report`, `create_regression_report`, `qa_signoff`, `qa_bounce_back` |
| DevOps | `submit_pipeline_failure_report`, `classify_pipeline_failure`, `attach_pipeline_log`, `recommend_dev_owner` |
| Delivery | `request_merge`, `approve_merge`, `record_merge`, `record_release` |
| Status | `read_org_status`, `read_team_status`, `read_run_status`, `read_budget_status`, `read_review_queue` |
| Observability | `read_trace`, `read_audit_events`, `read_run_logs`, `read_agent_timeline`, `record_metric`, `create_health_report`, `classify_anomaly`, `request_self_healing`, `record_self_healing_result` |
| Always-On Runtime | `list_rules`, `evaluate_rules`, `read_reaction_plan`, `approve_reaction_plan`, `list_triggers`, `pause_trigger`, `resume_trigger`, `read_scheduler_status`, `read_worker_heartbeat`, `read_runtime_lease`, `release_runtime_lease`, `read_dead_letters`, `request_dlq_replay`, `quarantine_dead_letter`, `read_slo_status`, `open_incident`, `assign_incident_commander` |
| Scheduled Reviews | `schedule_team_review`, `schedule_department_review`, `schedule_qa_regression`, `run_team_review`, `create_memory_adaptation_request`, `create_hat_effectiveness_review` |
| Documentation Context | `read_documentation_context`, `submit_adr`, `submit_design_doc`, `submit_project_doc`, `request_documentation_review`, `approve_documentation_gate`, `reject_documentation_gate` |
| Project Skills | `propose_project_skill`, `review_project_skill`, `approve_project_skill`, `deprecate_project_skill`, `ingest_project_skill`, `read_skill_graph` |
| Capability Expansion | `submit_capability_request`, `review_capability_request`, `approve_capability_request`, `reject_capability_request`, `activate_capability`, `read_capability_registry` |
| Temporal Workflow Registry | `submit_workflow_capability_request`, `review_workflow_capability_request`, `register_temporal_workflow`, `deprecate_temporal_workflow`, `read_workflow_registry` |
| Dapr Actor Registry | `submit_actor_capability_request`, `review_actor_capability_request`, `register_dapr_actor`, `deprecate_dapr_actor`, `read_actor_registry` |
| NATS and DLQ Operations | `read_nats_consumer_status`, `read_stream_lag`, `request_message_replay`, `quarantine_message`, `discard_message`, `read_dlq_policy` |
| Oz and Hermes Runtime | `create_hermes_run`, `cancel_hermes_run`, `read_hermes_run`, `list_child_runs`, `fetch_run_logs`, `fetch_run_artifacts`, `bind_run_to_work_item` |
| Human Override | `request_human_override`, `approve_human_override`, `reject_human_override`, `record_human_decision` |

## Hat Catalog

The starter hat graph should include the hats below. Each hat should be represented as data with allowed tool bundles, approval scope, memory scope, credential scope, voting scope, lifecycle states it can move, required evidence, max concurrency, and token TTL.

### Executive Board and Governance

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Executive Board Member | Vote on organization-level priorities, high-power hats, new departments, major policy, unresolved escalations | Goal Intake, Project, Portfolio and Initiative, Hat Authorization, Agent Insight, Voting, Status, Messaging, Meeting, Observability | Major initiatives, departments, dangerous overrides, high-power hats, budget ceilings, cross-department conflicts |
| CEO | Overall direction, portfolio priority, organization shape, final business escalation | Goal Intake, Project, Portfolio and Initiative, Voting, Status, Meeting, Messaging, Hat Authorization, Agent Insight | Project and portfolio priority, org direction, executive escalation closure |
| CTO | Technical standards, architecture quality, runtime strategy, engineering efficiency | Project, Portfolio and Initiative, Architecture, Review and Gates, Status, Observability, Hat Authorization, Meeting, Capability Expansion | Technical standards, major technical gates, architecture escalation, engineering platform direction |
| COO | Operating rhythm, capacity, process health, schedules, incidents, delivery flow | Project, Portfolio and Initiative, Team Runtime, Status, Always-On Runtime, Scheduled Reviews, Meeting, Messaging | Operating cadence, process changes, incident process, schedule policy |
| CFO | Cost policy, burn-rate reviews, cost attribution, budget guardrails | Project, Portfolio and Initiative, Status, Hat Authorization, Agent Insight, Always-On Runtime, Observability | Budget ceilings, cost exceptions, capacity scaling policy |
| Chief Architect | Cross-org architectural policy and risky design arbitration | Architecture, Review and Gates, Documentation Context, Capability Expansion, Temporal Workflow Registry, Dapr Actor Registry, Voting, Observability | High-risk CA/ADR approval, runtime architecture approval, cross-service design arbitration |
| Policy Steward | Governance policy consistency, voting rules, hard-block precedence | Voting, Review and Gates, Hat Authorization, Observability, Documentation Context, Capability Expansion | Policy review recommendations; final approval depends on Executive, Security, or Architecture scope |
| Hat Approval Steward | Hat supply policy, hat class review, authority drift detection | Hat Authorization, Agent Insight, Voting, Scheduled Reviews, Review and Gates, Observability | New hat classes and sensitive hat activation recommendations; high-power approval requires Executive Board |

### Program and Initiative Management

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Program Director | Department portfolio, initiative priority, TPM assignment, dependency escalation | Project, Portfolio and Initiative, Hat Authorization, Agent Insight, Status, Meeting, Scheduled Reviews | Department initiative priority, TPM assignment, escalation to C-suite |
| Senior TPM | Complex initiative planning, cross-team coordination, dependency resolution | Portfolio and Initiative, Team Runtime, Task, Backlog and Defect, Hat Authorization, Agent Insight, Messaging, Meeting, Artifact and Evidence, Status | Initiative readiness and staffing within assigned scope |
| TPM | Break initiatives into tasks, manage task priority, coordinate teams, unblock delivery | Team Runtime, Task, Backlog and Defect, Messaging, Meeting, Artifact and Evidence, Status, Agent Insight, Hat Authorization | Task priority and team coordination within initiative; no technical/security/QA approval |
| Mission Control Lead | Operate active mission rooms, enforce handoffs, track blockers and evidence | Team Runtime, Task, Messaging, Meeting, Artifact and Evidence, Status, Observability | Mission-level coordination and escalation |
| Initiative Planner | Convert approved goals into initiatives, milestones, dependencies, and staffing plan | Project, Portfolio and Initiative, Backlog and Defect, Task, Artifact and Evidence, Status | Planning recommendations; Director/Executive approves priority and budget |
| Dependency Manager | Detect and resolve cross-task, cross-team, and cross-department dependencies | Task, Backlog and Defect, Messaging, Meeting, Status, Observability | Dependency escalation and sequencing recommendations |
| Blocker Manager | Track blocked work and route it to the right department or manager | Task, Backlog and Defect, Messaging, Meeting, Status, Scheduled Reviews | Blocker classification and escalation |

### Product and Customer Discovery

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Product Director | Product portfolio, product owner assignment, product standards | Goal Intake, Project, Portfolio and Initiative, Business, Review and Gates, Status, Meeting | Product priority and product signoff escalation |
| Product Owner | Own product intent, behavior, acceptance criteria, BRD signoff | Business, Artifact and Evidence, Project, Task, Review and Gates, Messaging, Memory, Status, Documentation Context | BRD/product signoff and product readiness gate |
| Customer Interviewer | Clarify ambiguous goals with humans, capture interview evidence | Business, Messaging, Artifact and Evidence, Task, Memory, Documentation Context | No final approval by default; submits discovery artifacts |
| Requirement Clarifier | Turn vague goals into questions, constraints, and explicit requirement candidates | Goal Intake, Business, Messaging, Artifact and Evidence, Backlog and Defect | Clarification readiness recommendation |
| Acceptance Criteria Owner | Maintain product acceptance criteria and link them to work items | Business, Task, Artifact and Evidence, Review and Gates, Documentation Context | Acceptance criteria readiness recommendation; Product Owner approves |
| Customer Feedback Lead | Convert reports, feedback, and SRs into product backlog or defects | Goal Intake, Backlog and Defect, Business, Messaging, Artifact and Evidence, Status | Feedback classification recommendation |

### Business Analysis

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| BA Director | BA standards, BRD quality, requirements capacity | Business, Review and Gates, Status, Meeting, Scheduled Reviews | BA process and BRD quality standards |
| Business Analyst | Research business area, refine BRDs, document assumptions and rules | Business, Artifact and Evidence, Task, Backlog and Defect, Messaging, Memory, Review and Gates, Documentation Context | BRD draft readiness recommendation |
| Requirements Analyst | Break business needs into concrete, testable requirements | Business, Artifact and Evidence, Task, Documentation Context, Memory | Requirements readiness recommendation |
| BRD Author | Write BRDs with evidence, open questions, and acceptance criteria | Business, Artifact and Evidence, Documentation Context, Memory, Messaging | No final approval; submits BRD for review |
| BRD Reviewer | Review BRDs for ambiguity, missing evidence, and testability | Business, Review and Gates, Artifact and Evidence, Documentation Context | BRD review recommendation |
| Business Approver | Independent approval that BRD is ready for architecture and planning | Business, Review and Gates, Artifact and Evidence, Status, Messaging | Approve or reject BRD readiness |
| Domain Researcher | Investigate domain rules and source material for BRD and QA evidence | Business, Artifact and Evidence, Memory, Documentation Context, Messaging | Evidence quality recommendation |

### Architecture

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Architecture Director | Architecture staffing, standards, CA/ADR quality, review queues | Architecture, Review and Gates, Documentation Context, Status, Scheduled Reviews, Agent Insight | Architecture standards and reviewer assignment |
| Architect | Create CA/design docs, define boundaries, risks, non-goals, integration shape | Architecture, Artifact and Evidence, Project, Task, Memory, Documentation Context, Observability | CA readiness recommendation; low-risk approval if policy grants it |
| Conceptual Architect | Explore design options and tradeoffs before concrete CA approval | Architecture, Documentation Context, Artifact and Evidence, Memory, Meeting | No final approval by default |
| Architecture Reviewer | Review CA/ADR/design readiness and reject risky or under-scoped plans | Architecture, Review and Gates, Artifact and Evidence, Documentation Context, Observability | Approve or reject architecture gate within scope |
| ADR Steward | Maintain ADR lifecycle, ensure decisions are linked and current | Documentation Context, Architecture, Review and Gates, Project Skills, Memory | ADR documentation gate |
| Integration Architect | Review service, API, credential, event, and external integration boundaries | Architecture, Credential Proxy, Review and Gates, Documentation Context, Observability | Integration architecture gate; Security co-approval when credentials/data are involved |
| Runtime Architecture Reviewer | Review Temporal workflows, Dapr actors, NATS flows, Oz/Hermes runtime changes | Architecture, Temporal Workflow Registry, Dapr Actor Registry, NATS and DLQ Operations, Oz and Hermes Runtime, Review and Gates, Observability | Runtime architecture approval |

### Engineering

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Engineering Director | Engineering portfolio, standards, staffing, implementation quality | Project, Portfolio and Initiative, Hat Authorization, Agent Insight, Status, Scheduled Reviews | Engineering priority and standards, not self-approval of implementation gates |
| Backend Implementer | Implement backend tasks with red tests, green tests, and evidence | Task, Artifact and Evidence, Memory, Credential Proxy, DevOps, Observability, Messaging, Documentation Context | No approval over own work |
| Frontend Implementer | Implement UI tasks with tests, screenshots where relevant, and evidence | Task, Artifact and Evidence, Memory, DevOps, Observability, Messaging, Documentation Context, QA | No approval over own work |
| Full-Stack Implementer | Implement cross-layer work with linked frontend/backend evidence | Task, Artifact and Evidence, Memory, Credential Proxy, DevOps, Observability, Messaging, Documentation Context, QA | No approval over own work |
| Defect Fixer | Reproduce defects, write representative red tests, fix minimally, prove green | Task, Backlog and Defect, Artifact and Evidence, Memory, DevOps, Observability, Messaging | No approval over own work |
| Test-First Engineer | Build regression tests, test harnesses, and TDD evidence | Task, Artifact and Evidence, DevOps, Observability, QA, Documentation Context | Test evidence recommendation |
| Integration Engineer | Implement integrations under architecture/security approved scopes | Task, Credential Proxy, Artifact and Evidence, DevOps, Observability, Architecture, Documentation Context | No approval over own work; requires Architecture/Security gates for risky scopes |
| Tooling Engineer | Build internal tools, MCP services, project skills, CI helpers | Task, Project Skills, Capability Expansion, DevOps, Observability, Artifact and Evidence, Documentation Context | Tooling readiness recommendation; Security/Architecture approve expansion |
| Code Reviewer | Review code, tests, scope, evidence, unauthorized tool/credential changes | Review and Gates, Artifact and Evidence, Task, Memory, Status, Observability, Messaging, Documentation Context | Code review approval within assigned scope |

### Engineering Management

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Engineering Manager | Ensure task readiness, staffing, context, memory, acceptance criteria, TDD compliance, team outcomes | Task, Team Runtime, Review and Gates, Backlog and Defect, Artifact and Evidence, Memory, Scheduled Reviews, Status, Observability, Agent Insight | Readiness, outcome, and process gates within team scope |
| Team Lead | Coordinate day-to-day execution and handoffs for a team | Team Runtime, Task, Messaging, Meeting, Artifact and Evidence, Status, Memory | Team coordination and escalation |
| Readiness Reviewer | Check that work is groomed, documented, scoped, and has acceptance criteria | Task, Review and Gates, Artifact and Evidence, Documentation Context, Memory, Status | Move task to ready or reject readiness |
| Context Attachment Reviewer | Ensure tasks have correct BRDs, CAs, ADRs, memories, repo skills, and evidence links | Task, Artifact and Evidence, Memory, Documentation Context, Project Skills, Review and Gates | Context readiness gate |
| Outcome Reviewer | Decide whether completed work met intended outcomes after delivery or review | Review and Gates, Artifact and Evidence, Observability, QA, Status, Backlog and Defect | Outcome review; can create backlog items from gaps |
| Performance Review Author | Review agent/hat/team performance and propose improvements | Scheduled Reviews, Review and Gates, Memory, Agent Insight, Observability, Backlog and Defect | Performance review submission; improvements flow to backlog |
| Capability Request Triage | Turn repeated team pain into governed capability requests | Capability Expansion, Backlog and Defect, Review and Gates, Artifact and Evidence, Messaging | Triage recommendation; cannot self-approve capability |

### QA and Verification

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| QA Director | QA standards, verification capacity, release confidence | QA, Review and Gates, Status, Scheduled Reviews, Meeting, Backlog and Defect | QA standards and signoff escalation |
| QA Verifier | Verify task acceptance criteria and original behavior | QA, Artifact and Evidence, Task, Review and Gates, Observability, Status, Backlog and Defect, Messaging | QA verification recommendation |
| QA Reviewer | Sign off or bounce back work when issue remains reproducible or acceptance criteria fail | QA, Review and Gates, Artifact and Evidence, Task, Observability, Backlog and Defect, Messaging | QA signoff or QA rejection |
| Browser Automation QA | Run browser automation, capture screenshots, traces, and reproduction steps | QA, Artifact and Evidence, Observability, Task, Messaging | Browser evidence recommendation |
| Regression Verifier | Run regression suites and classify failures against known acceptance criteria | QA, Scheduled Reviews, Artifact and Evidence, Observability, Backlog and Defect | Regression report recommendation |
| Reproducibility Analyst | Prove whether a reported issue is still reproducible and attach evidence | QA, Backlog and Defect, Artifact and Evidence, Observability, Messaging | Defect reproducibility classification |
| Evidence Package Author | Package screenshots, logs, traces, and exact steps for review and bounce-back | Artifact and Evidence, QA, Observability, Documentation Context | Evidence quality recommendation |

### QA Engineering

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| QA Engineering Director | QA automation strategy, test infrastructure, coverage investment | QA, Scheduled Reviews, Project, Backlog and Defect, Capability Expansion, Status | QA engineering priority and standards |
| QA Engineering Manager | Manage regression schedules, test case systems, coverage gaps, tooling requests | QA, Scheduled Reviews, Backlog and Defect, Artifact and Evidence, Status, Observability, Project Skills | QA automation readiness and test-suite evolution |
| QA Automation Engineer | Build browser/script/API automation and improve repeatability | QA, Task, Artifact and Evidence, DevOps, Observability, Project Skills | No final QA signoff unless assigned separate reviewer hat |
| Test Suite Maintainer | Maintain scheduled suites, reduce flake, update test data and harnesses | QA, Scheduled Reviews, DevOps, Observability, Backlog and Defect, Artifact and Evidence | Test-suite maintenance approval within scope |
| Coverage Analyst | Identify missing test coverage and propose backlog or capability work | QA, Observability, Backlog and Defect, Artifact and Evidence, Status | Coverage-gap recommendations |
| Regression Scheduler | Own scheduled QA cadence and trigger configuration | QA, Scheduled Reviews, Always-On Runtime, Status, Messaging | Regression schedule changes within QA policy |
| Test Case Manager | Maintain test case inventory and link cases to requirements and work | QA, Documentation Context, Artifact and Evidence, Project Skills, Backlog and Defect | Test case readiness |

### Security and Compliance

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Security Director | Security posture, sensitive approvals, audit policy, veto escalation | Credential Proxy, Review and Gates, Hat Authorization, Observability, Voting, Meeting, Status | Security veto, sensitive tool/credential policy, security escalation |
| Security Reviewer | Review security gates, risky integrations, credential/tool expansion | Review and Gates, Credential Proxy, Observability, Artifact and Evidence, Documentation Context | Security gate approval or rejection |
| Credential Scope Approver | Approve scoped credential grants and proxy-use permissions | Credential Proxy, Review and Gates, Observability, Artifact and Evidence, Messaging | Credential scope approval |
| Policy Engineer | Maintain RBAC/OPA policy versions and hard-block precedence | Review and Gates, Observability, Documentation Context, Capability Expansion, Hat Authorization | Policy change recommendation; Security Director approves risky changes |
| External API Reviewer | Review new proxy endpoints and external service integrations | Credential Proxy, Architecture, Review and Gates, Documentation Context, Observability | External API security approval with Architecture co-review |
| Dangerous Automation Reviewer | Classify automation by safe, approval-required, forbidden, or human-only | Credential Proxy, Always-On Runtime, Review and Gates, Observability, Human Override | Dangerous automation approval or rejection |
| Audit Reviewer | Inspect audit trails and policy compliance | Observability, Artifact and Evidence, Review and Gates, Status, Documentation Context | Audit finding approval and escalation |
| Credential Proxy Operator | Operate proxy availability, denial correctness, and proxy SLOs | Credential Proxy, Observability, Always-On Runtime, DevOps, Status | Operational proxy remediation within approved runbooks |

### Delivery and Release

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Delivery Director | Delivery policy, release standards, delivery queue health | Delivery, Review and Gates, Status, DevOps, Meeting, Scheduled Reviews | Delivery standards and escalation |
| Release Manager | Coordinate release readiness and release-impact review | Delivery, Review and Gates, Artifact and Evidence, Status, DevOps, Messaging | Release readiness approval within scope |
| Release Operator | Execute approved release or promotion and record evidence | Delivery, DevOps, Artifact and Evidence, Observability, Status, Messaging, Always-On Runtime | Release execution when all gates are satisfied |
| Delivery Reviewer | Check required upstream approvals, QA evidence, tests, and release risk | Delivery, Review and Gates, Artifact and Evidence, Status, DevOps, Project, Messaging | Merge/release approval or rejection |
| Merge Steward | Manage merge queues, conflict evidence, and merge recording | Delivery, DevOps, Artifact and Evidence, Status, Messaging | Merge execution when approved |
| Deployment Evidence Author | Attach deployment logs, release notes, environment state, and verification artifacts | Delivery, Artifact and Evidence, Observability, Documentation Context | Evidence package recommendation |
| Rollback Coordinator | Coordinate rollback decisions during incidents or failed releases | Delivery, Always-On Runtime, Meeting, Messaging, Observability, Human Override | Rollback recommendation; Incident Commander/Executive may approve high-risk rollback |

### Memory and Knowledge Management

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Memory Director | Memory policy, Hindsight adaptation, memory quality priorities | Memory, Agent Insight, Scheduled Reviews, Status, Backlog and Defect, Documentation Context | Memory policy and adaptation priority |
| Memory Manager | Manage memory review queues and memory adaptation actions | Memory, Scheduled Reviews, Review and Gates, Agent Insight, Backlog and Defect | Memory adaptation approval within scope |
| Memory Curator | Improve institutional knowledge quality, remove stale/duplicate gaps | Memory, Agent Insight, Backlog and Defect, Artifact and Evidence, Documentation Context | Memory write/change recommendation |
| Memory Reviewer | Review whether memories caused or prevented task failures | Memory, Review and Gates, Scheduled Reviews, Observability, Artifact and Evidence | Memory quality review |
| Memory Scope Steward | Ensure recall/write attribution and visibility by hat, agent, project, and task | Memory, Agent Insight, Observability, Review and Gates, Documentation Context | Memory scope gate recommendation; Security co-review for sensitive memories |
| Memory Adaptation Reviewer | Convert outcome/performance reviews into memory changes or backlog work | Memory, Scheduled Reviews, Review and Gates, Backlog and Defect, Agent Insight | Approve scoped memory adaptation |
| Knowledge Router | Attach relevant docs, memories, skills, and prior evidence to teams/tasks | Memory, Documentation Context, Project Skills, Task, Artifact and Evidence | Context routing recommendation |
| Project Context Librarian | Maintain project/initiative documentation context and retrieval rules | Documentation Context, Memory, Project, Project Skills, Artifact and Evidence | Project context readiness |

### Documentation and Project Skills

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Documentation Systems Director | Documentation standards, doc gate policy, project skill lifecycle | Documentation Context, Project Skills, Review and Gates, Status, Scheduled Reviews | Documentation policy and reviewer assignment |
| Design Doc Steward | Maintain design docs and link them to initiatives, tasks, repos, and decisions | Documentation Context, Architecture, Artifact and Evidence, Memory | Design documentation readiness recommendation |
| Documentation Reviewer | Review docs for staleness, scope, and enforceability | Documentation Context, Review and Gates, Artifact and Evidence, Memory | Documentation gate approval or rejection |
| Project Skill Author | Create repo/project-specific skills that complement hats | Project Skills, Documentation Context, Memory, Artifact and Evidence, Capability Expansion | No approval over own skill; submits for review |
| Skill Graph Curator | Maintain skill graph links, frontmatter quality, dependencies, and deprecations | Project Skills, Memory, Documentation Context, Review and Gates | Skill graph maintenance approval within scope |
| Documentation Enforcement Reviewer | Ensure work follows required BRD/CA/ADR/design docs and project skills | Documentation Context, Review and Gates, Task, Artifact and Evidence, Memory | Documentation compliance gate |

### Operations and Infrastructure

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Operations Director | Runtime operations, incident standards, operational staffing, SLO posture | Always-On Runtime, Observability, DevOps, Status, Meeting, Scheduled Reviews | Operations priority and incident process |
| Platform Operator | Runtime health, workers, pods, Oz/k3s state, safe manual intervention | Always-On Runtime, Observability, DevOps, Status, Messaging, Artifact and Evidence | Safe operational remediation within runbook |
| Runtime Steward | Worker contracts, rule/reaction correctness, control-plane behavior | Always-On Runtime, Observability, Backlog and Defect, Documentation Context, Review and Gates | Runtime reaction approval within scoped policy |
| Lease Steward | Stale leases, fencing-token safety, duplicate execution prevention | Always-On Runtime, Observability, Artifact and Evidence, Backlog and Defect | Lease release when evidence proves stale ownership |
| Oz/K3s Reconciler | Orphan pods, silent sessions, Oz run bindings, stuck runs | Oz and Hermes Runtime, Always-On Runtime, Observability, DevOps, Artifact and Evidence | Self-healing recommendation; risky remediation requires approval |
| SRE | SLOs, error budgets, reliability backlog, incident prevention | Always-On Runtime, Observability, Backlog and Defect, DevOps, Status | Reliability backlog creation and incident escalation |
| Incident Commander | Active incident lifecycle, responder assignment, cadence, freezes, postmortems | Always-On Runtime, Messaging, Meeting, Status, Artifact and Evidence, Backlog and Defect, Observability, Human Override | Incident command decisions and scoped freeze/rollback recommendation |
| DLQ Steward | Dead-letter classification, quarantine, replay, discard decisions | Always-On Runtime, NATS and DLQ Operations, Observability, Artifact and Evidence, Backlog and Defect | Replay/quarantine recommendation; side-effect replay requires approval |
| Scheduler Steward | Scheduled jobs, misfires, lag, catch-up, concurrency policies | Always-On Runtime, Scheduled Reviews, Observability, Status, Backlog and Defect | Schedule changes within owner policy |
| Trigger Steward | Durable trigger definitions, predicates, owner/version policy | Always-On Runtime, Observability, Review and Gates, Documentation Context | Trigger changes within approved policy |
| Runbook Maintainer | Operational runbooks, rollback plans, evidence requirements | Documentation Context, Project Skills, Always-On Runtime, Review and Gates, Memory | Runbook documentation gate |
| Cost Controller | Hat supply, burn rate, admission control, queue pressure, scale-down policy | Status, Hat Authorization, Portfolio and Initiative, Always-On Runtime, Observability, Agent Insight | Cost guardrail recommendation; CFO/Executive approve major budget changes |

### Observability and Evidence

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Observability Director | Telemetry standards, evidence coverage, observability staffing | Observability, Status, Scheduled Reviews, Backlog and Defect, Meeting | Observability standards and coverage priorities |
| Observability Curator | Trace/log/metric coverage, dashboard gaps, telemetry consistency | Observability, Artifact and Evidence, Backlog and Defect, Documentation Context | Observability coverage recommendation |
| Trace Analyst | Investigate traces across goal/task/hat/session/Oz/pod/MCP/NATS/artifact | Observability, Artifact and Evidence, Status, DevOps | Trace findings and defect recommendations |
| Trace and Evidence Steward | Ensure correlation chains and evidence packages are complete | Observability, Artifact and Evidence, QA, Documentation Context, Review and Gates | Evidence completeness gate recommendation |
| Health Report Reviewer | Review health reports and decide whether to create incident/backlog work | Observability, Always-On Runtime, Backlog and Defect, Review and Gates | Health finding classification |
| Anomaly Classifier | Classify failure modes and route safe remediation | Observability, Always-On Runtime, Backlog and Defect, Messaging | Anomaly classification; remediation approval depends on risk class |
| Coverage Gap Reporter | Identify missing telemetry and create observability backlog | Observability, Backlog and Defect, Documentation Context, Project Skills | Coverage-gap recommendations |

### Capability and Automation Expansion

| Hat | Responsibilities | Tool bundles | Approval powers |
|---|---|---|---|
| Hat Designer | Propose hats, tool scopes, memory scopes, voting scopes, supply rules | Hat Authorization, Agent Insight, Capability Expansion, Review and Gates, Documentation Context, Scheduled Reviews | Hat proposals; approval depends on Executive/Security/Architecture scope |
| Capability Request Owner | Convert repeated failures and manual workarounds into capability requests | Capability Expansion, Backlog and Defect, Artifact and Evidence, Review and Gates, Messaging | Capability request readiness |
| Tool Registry Steward | Manage MCP tool registry entries, tool permissions, and availability | Capability Expansion, Review and Gates, Observability, Documentation Context, Hat Authorization | Tool registry recommendation; Security approves authority/data changes |
| Automation Expansion Reviewer | Review new workflows, actors, triggers, schedules, and runbooks | Temporal Workflow Registry, Dapr Actor Registry, Always-On Runtime, Architecture, Review and Gates, Observability | Automation expansion approval with Architecture/Security as needed |
| Workflow Maintainer | Maintain Temporal workflow registrations and deterministic workflow contracts | Temporal Workflow Registry, Architecture, Documentation Context, Observability, Review and Gates | Workflow registration recommendation; Architecture approves |
| Actor Registry Maintainer | Maintain Dapr actor registrations and state-ownership contracts | Dapr Actor Registry, Architecture, Documentation Context, Observability, Review and Gates | Actor registration recommendation; Architecture approves |
| MCP Registry Maintainer | Maintain MCP service/tool schemas and policy metadata | Capability Expansion, Credential Proxy, Documentation Context, Observability, Review and Gates | MCP registry recommendation; Security approves privileged tools |

## Lifecycle Ownership

### Task Flow

| State | Primary owner hats |
|---|---|
| `intake` | Product Owner, Customer Feedback Lead, Requirement Clarifier |
| `discovery` | Customer Interviewer, Business Analyst, Product Owner |
| `needs_clarification` | Requirement Clarifier, Product Owner, Business Analyst |
| `needs_business_approval` | BRD Reviewer, Business Approver, Product Owner |
| `needs_architecture` | Architect, Architecture Reviewer |
| `ready` | Engineering Manager, Readiness Reviewer, TPM |
| `planned` | TPM, Mission Control Lead, Engineering Manager |
| `in_progress` | Implementer hats |
| `code_review` | Code Reviewer |
| `review_rejected` | Code Reviewer, Engineering Manager, Implementer |
| `qa_review` | QA Reviewer, QA Verifier |
| `qa_reproducible` | QA Reviewer, Reproducibility Analyst, Engineering Manager |
| `approved` | Delivery Reviewer |
| `merged` | Merge Steward, Release Manager |
| `released` | Release Operator, Delivery Reviewer |
| `done` | TPM, Delivery Reviewer, Outcome Reviewer |

### Initiative Flow

| State | Primary owner hats |
|---|---|
| `proposed` | Executive Board Member, CEO, Product Director |
| `executive_triage` | Executive Board, CEO, CTO, COO, CFO |
| `business_approved` | Product Owner, Business Approver |
| `architecture_approved` | Architecture Reviewer, Chief Architect |
| `planned` | Program Director, TPM, Initiative Planner |
| `active` | TPM, Mission Control Lead, Department Director |
| `delivery_review` | Delivery Reviewer, QA Reviewer |
| `qa_signoff` | QA Reviewer, QA Director |
| `released` | Release Operator, Release Manager |
| `complete` | TPM, Program Director, Outcome Reviewer |

## High-Risk Gates

| Risk area | Required review |
|---|---|
| New credential proxy endpoint, credential scope, external API, data exposure, security policy change | Security Reviewer or Security Director; Architecture co-review for integration/runtime impact |
| New or changed Kubernetes CRD, operator, controller ownership rule, leader-election behavior, or HatSwap event contract | Runtime Architecture Reviewer or Chief Architect; Security co-review if credentials, protected state, or workload identity are affected |
| New Temporal workflow, Dapr actor, durable trigger, scheduled job, runtime worker, or Oz/Hermes execution pattern | Runtime Architecture Reviewer or Chief Architect; Security if tools/credentials/protected state are involved |
| New high-power hat, new department, new major hat class, dangerous override, broad self-healing authority | Executive Board approval; two-person approval for high-risk operational override |
| Product behavior change, customer-facing feature, acceptance criteria change | Product Owner and Business Approver |
| BRD readiness | BRD Reviewer plus Business Approver or Product Owner |
| CA/ADR/design readiness | Architecture Reviewer; Chief Architect for high-risk or cross-org designs |
| Code readiness | Code Reviewer, with TDD evidence for implementation/defect work |
| QA readiness | QA Reviewer with reproducibility, screenshots, traces, logs, and acceptance evidence as applicable |
| Merge or release | Delivery Reviewer or Release Manager after upstream gates are complete |
| DLQ replay, message discard, lease release, forced stop, rollback, or self-healing action | Operations hat plus risk-specific Security, Architecture, Incident Commander, or Executive approval |
| Memory adaptation that changes future behavior broadly | Memory Manager plus affected department manager; Security for sensitive memories |

## Starter Data Model Fields

Each hat definition should eventually become a first-class record with at least:

```ts
type HatDefinition = {
  id: string;
  name: string;
  departmentId: string;
  parentHatIds: string[];
  supervisesHatIds: string[];
  conflictsWithHatIds: string[];
  assignableByHatIds: string[];
  reportToHatIds: string[];
  allowedToolBundles: string[];
  allowedToolIds: string[];
  skills: string[];
  approvalScopes: string[];
  votingScopes: string[];
  memoryScopes: string[];
  credentialScopes: string[];
  documentationScopes: string[];
  lifecycleTransitions: string[];
  requiredEvidence: string[];
  maxConcurrentAssignments: number;
  tokenTtlSeconds: number;
  warmupSeconds: number;
  cooldownSeconds: number;
  successionPolicy: "rotate" | "renew" | "election" | "director_assigned" | "executive_vote";
  stickyAttribution: boolean;
  quorumSize?: number;
  reputationScope: Array<"hat" | "agent_hat" | "department_hat" | "project_hat">;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresTwoPersonApproval: boolean;
  requiresHumanApproval: boolean;
};
```

The hat graph should be queryable by task type, project, repo, initiative, current scarcity, agent memory profile, and active budget. The assignment engine should rank candidate Hermes agents through Hindsight-derived specialization data, then use policy to decide whether the suggested assignment is allowed.

`skills` and `authority` should map cleanly to any future cluster-native `Hat` CRD. `supervisesHatIds` should remain acyclic. `conflictsWithHatIds`, `warmupSeconds`, `cooldownSeconds`, `successionPolicy`, `stickyAttribution`, `quorumSize`, and `reputationScope` preserve the distinction between a persistent hat and a temporary wearer.

## Open Decisions

- Whether `Engineering Management` is a department or a horizontal management layer inside each execution department.
- Whether `Documentation and Project Skills` is its own department or a bounded context under Memory with Architecture approval authority.
- Whether `Observability and Evidence` is a standalone department or an Operations subdepartment.
- Whether `Chief Architect` is a C-suite hat or the Architecture Director.
- Whether `CFO` is active at launch or introduced after Oz/runtime cost attribution exists.
- How many executive hats should be allowed at once, how often they rotate, and which votes require human review.
- Which operations actions are auto-safe, approval-required, forbidden, or human-only.
- Which memory mutations can be approved by Memory alone versus requiring the owning department.
