---
title: Org System Build Blueprint
canonical_name: Agentic Organization
status: design
---

# Org System Build Blueprint

The end-to-end build of the hat + department organization: deterministic
guardrails, agent-driven outcomes, full observability. This blueprint is the
single map of what is being built and how each piece maps to the docs.

## Design invariant (everywhere)

Every decision uses the **`observe → decide` kernel** already in
`packages/application/src/observe.ts`:

- **deterministic** computes the *legal set* (next legal gate, eligible hats,
  in-scope reprioritizations, supply-permitted candidates),
- the **agent composer chooses within it** (which work, approve/reject, who to
  staff, how many hats).

The agent can never widen the rules — it only selects inside them. This is the
"enough determinism, agents drive outcomes" tenet at organizational scope.

## Traceability invariant (everywhere)

Every state transition emits **exactly one durable `org_event`** (generalizing
the doc's "one HatSwap per transition"). Each carries: `actorHatId`,
`departmentId`, `supervisorChain` (the DAG path), `decision`, `evidenceRefs`,
and `correlationId/causationId/traceId`. "What's happening" is one query over
`agentic_org_org_events` plus the `org snapshot` projection.

## Layers being built (on top of what exists)

Already present (build *on* these): `QualityGateKind` (7 gates),
`company-work-policy.ts` (gate-chain order + prior-gate enforcement),
`work-item-state-machine.ts`, `record_quality_gate_evaluation`, the keep-alive
control plane, Hermes runs, the observe/decide kernel.

| # | Layer | New modules | Doc anchor |
|---|---|---|---|
| P1 | **Org as data** | `domain/department.ts`, `domain/hat-definition.ts`, `application/org-seed.ts` (15 depts + ~100 hats) | DEPARTMENT_HAT_TOOL_INVENTORY |
| P2 | **Hat binding lifecycle** | `domain/hat-binding.ts` (Pending→Warmup→Active→Probation→Revoked→Expired/Released/Succeeded), `application/hat-lifecycle.ts` (TTL expiry, warmup, cooldown, succession) | CLUSTER_NATIVE_HAT_SYSTEM |
| P3 | **Prioritization + RMO** | `application/prioritization.ts` (PriorityDecision), `application/rmo.ts` (hat-supply voting) | ANTI_STALL_PRIORITY_RUNTIME |
| P4 | **Assignment engine** | `application/assignment-engine.ts` (rank by reputation, assign within supply+policy) | CLUSTER_NATIVE_HAT_SYSTEM, ANTI_STALL |
| P5 | **Work pipeline driver** | `application/pipeline.ts` (discovery→…→release; gate→owner-hat; agent runs approve/reject) | BUSINESS_QUALITY_GATE_SYSTEM |
| P6 | **Observability** | `domain/org-event.ts`, `observability/org-snapshot.ts`, Cockroach tables + stores | CLUSTER_NATIVE_HAT_SYSTEM §Observability |
| P7 | **Deploy + observe** | worker lifecycle loops, kind deploy, full-hierarchy proof | all |

## Departments (15) and hierarchy

```
Executive Board
  → C-suite (CEO, CTO, COO, CFO, Chief Architect)
    → Department Directors
      → TPMs / Engineering Managers / QA Managers
        → Team Leads / Reviewers
          → Specialists / Implementers / QA / Operators
```

Departments: Executive Board & Governance, Program & Initiative Management,
Product & Customer Discovery, Business Analysis, Architecture, Engineering,
Engineering Management, QA & Verification, QA Engineering, Security & Compliance,
Delivery & Release, Memory & Knowledge, Documentation & Project Skills,
Operations & Infrastructure, Observability & Evidence, Capability & Automation
Expansion. The `supervises`/`reportsTo` edges form a DAG (validated acyclic).

## Hat definition (the record)

Per the doc's `HatDefinition` (30 fields): id, name, departmentId, parent/
supervises/reportsTo/conflictsWith/assignableBy hat ids, allowedToolBundles,
skills, approval/voting/memory/credential/documentation scopes,
lifecycleTransitions, requiredEvidence, maxConcurrentAssignments, tokenTtlSeconds,
warmup/cooldownSeconds, successionPolicy, stickyAttribution, quorumSize,
reputationScope, riskLevel, requiresTwoPersonApproval, requiresHumanApproval.

## Hat binding lifecycle (deterministic transitions)

```
Pending → Warmup (warmupSeconds) → Active → {Probation | Expired(tokenTtlSeconds) | Released | Succeeded}
                                              ↘ Cooldown gate before same wearer re-takes
```

Each transition → one HatSwap-shaped `org_event`. Succession picks the next
wearer via `observe→decide` (legal = eligible candidates per successionPolicy).

## RMO (resource/hat-supply)

From the *prioritized workload* compute `requiredCount` per hat (sum of
`requiredHats` across non-paused, ranked work). Supervisors (Director, Cost
Controller, CFO, Executive Board by risk) **vote**; the tally yields a
`HatSupplyDecision` (reserve | release | expand | preempt) with a target count.
The assignment engine respects the target. Movement invariant: every scarce hat
has a visible supply queue.

## Prioritization

`PriorityDecision` (expedite|high|normal|defer|paused; `decidedBy`
tpm|engineering_manager|department_director|review_hat|agent_vote|executive|
incident_commander|approved_policy; requiredHats; reasonCodes). Platform computes
`PriorityRecommendation` from the ~20 inputs; a Director/TPM hat decides via
`observe→decide` (legal = within-scope rank moves).

## Pipeline (the 7 gates → owner hats)

| Gate | Owner hats |
|---|---|
| customer_rfp_review | Product Owner, Business Analyst, Customer Interviewer |
| brd_approval | BRD Reviewer, Business Approver, Product Owner |
| architecture_approval | Architect, Architecture Reviewer, Chief Architect |
| implementation_review | Code Reviewer, Engineering Manager |
| runtime_validation | QA Verifier, QA Reviewer, Browser Automation QA |
| final_business_validation | Product Owner, Business Analyst |
| release_readiness | Release Manager, Delivery Reviewer, TPM |

The driver: `observe→decide` computes the next legal gate (prior gates approved/
waived per `company-work-policy`), routes a reaction-plan agent run to an
owner-hat actor, records the gate evaluation, advances the work item. Failures
route back via the recovery-path table. Every step → `org_event`.

## Cockroach tables (new)

`agentic_org_departments`, `agentic_org_hat_definitions`,
`agentic_org_hat_bindings`, `agentic_org_org_events`,
`agentic_org_priority_decisions`, `agentic_org_hat_supply_decisions`,
`agentic_org_pipeline_stages`. Migrations are additive + mirrored on disk with
the TS↔disk parity test.

## Kind end-to-end proof (P7)

Seed org at worker startup → submit a customer-discovery goal → observe one work
item traverse all 7 gates, with **Executive Board → C-suite → Directors →
Management → ICs** each acting (gate approvals, priority decisions, supply votes,
assignments attributed to a hat at the right level), **hat expiry firing** on
TTL, **RMO voting** on supply — every step readable from `agentic_org_org_events` +
the org-snapshot projection. The hierarchy walk must show activity at every
level.
