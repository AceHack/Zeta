---
title: Business Quality Gate System
canonical_name: Agentic Organization
status: design
---

# Business Quality Gate System

The Organization needs business quality gates in addition to engineering and
runtime validation. QA proves the delivered behavior works. Business validation
proves the delivered behavior is the right behavior for the customer,
stakeholder, BRD, and recorded decisions.

## Canonical Gate Chain

Customer-facing or ambiguous work should move through this chain before it can
merge from an initiative feature branch into `main`:

| Phase | Required artifact | Gate kind | Gate owner | Event | Next allowed movement |
|---|---|---|---|---|---|
| Ambiguous intake | original request and current-state inventory | `customer_rfp_review` | Product Owner, Business Analyst, customer-facing hat | `quality_gate.evaluated` | customer/user confirms the Organization understood what exists, what is missing, and what may need extension |
| Requirements | BRD with business rules and acceptance criteria | `brd_approval` | Business Analyst reviewer and Product Owner | `quality_gate.evaluated` | architecture may begin |
| Architecture | CA, ADRs, design docs, workflow/data/security impact | `architecture_approval` | Architect, Product Owner for business-rule fit | `quality_gate.evaluated` | implementation planning may begin |
| Implementation review | code, tests, traces, branch evidence | `implementation_review` | reviewer hat, manager as needed | `quality_gate.evaluated` | runtime validation may begin |
| Runtime validation | QA/browser automation, screenshots, logs, traces, reproducibility evidence | `runtime_validation` | validation/reviewer hats | `quality_gate.evaluated` | final business validation may begin |
| Final business validation | outcome report mapped rule-by-rule to the BRD and decisions | `final_business_validation` | Product Owner or Business Analyst reviewer | `quality_gate.evaluated` | release readiness may begin |
| Release readiness | branch evidence package, gate summary, rollout notes | `release_readiness` | Delivery/TPM/release authority | `quality_gate.evaluated` | feature branch may merge to `main` |

V0 implements the generic `record_quality_gate_evaluation` command and the
first company-level Work OS policy for this chain. Approved later gates read
prior `quality_gate_evaluations` through a generic policy-evidence port and are
rejected unless every required earlier gate is already `approved` or `waived`.
This makes the company process enforceable while still allowing the internal
team to evolve the chain by changing policy data and adding reviewed
implementation slices.

Requirement-maturity policy is still separate: work-transition policy must reject
`ready` for ambiguous work without `implementation_ready` or an approved
no-discovery/no-BRD exception.

## RFP / Discovery Brief

The first stage should generate an RFP-style discovery brief from the user or
customer input. In this system, RFP means a structured request-for-proposal /
request-for-product brief, not a procurement workflow.

The brief should state:

- what the customer/user asked for;
- what already exists;
- what is missing;
- what needs extension or new development;
- known risks, unknowns, and assumptions;
- affected project, initiative, repos, docs, memories, and skills;
- proposed scope boundaries and non-goals;
- likely hats and departments needed;
- likely artifacts required before engineering starts.

The `customer_rfp_review` gate asks the customer/user whether this is the right
understanding. If it is not, the work returns to discovery instead of drifting
into implementation with invented requirements.

## Final Business Validation

Final business validation must evaluate every active business rule from the BRD
and governing decisions.

Each business rule result is one of:

- `satisfied`;
- `partially_satisfied`;
- `not_satisfied`;
- `not_applicable`;
- `changed_by_decision`.

An approved `final_business_validation` gate can only be recorded when every
business rule is `satisfied`, `not_applicable`, or `changed_by_decision`.
`partially_satisfied` and `not_satisfied` require a non-approval outcome such as
`changes_requested` or `rejected`, which routes follow-up work through the normal
Organization lifecycle.

## Recovery Paths

Business gate failure is work-routing evidence, not a stale blocker.

| Failure class | Recovery path |
|---|---|
| Implementation missed BRD | route back to engineering with evidence and required rule deltas |
| Runtime validation missed behavior | create validation process improvement work and reopen the affected task |
| BRD was incomplete or wrong | reopen discovery / BRD work and record a decision |
| Architecture missed a constraint | reopen CA/ADR work and notify architecture owner |
| Customer expectation changed | create change request or scope-change decision |
| Repeated pattern | manager outcome review creates process, memory, test, or prompt-flow improvement work |

Every recovery path should create anchored work, decisions, or quality-gate
evidence. No free-floating meeting or chat should decide a release.

## Current V0 Implementation

The current executable slice adds:

- `record_quality_gate_evaluation`;
- typed `QualityGateKind`, `QualityGateOutcome`, and
  `BusinessRuleEvaluationStatus`;
- company Work OS gate-chain policy in the domain package;
- generic `QualityGateEvaluationStateReaderPort` policy evidence readers;
- in-memory and Cockroach quality-gate reader adapters behind that port;
- transactional command effects in the in-memory and Cockroach command outcome
  stores;
- `quality_gate.evaluated` outbox events for NATS projections;
- additive Cockroach migration `0010_agentic_org_quality_gate_evaluation_kernel`.

The command is deliberately generic. It does not hardcode a "capability request"
tool or one-off business process. Hats and future prompt flows can reuse the
same gate primitive for RFP review, BRD approval, architecture approval,
implementation review, runtime validation, final business validation, and
release readiness.
