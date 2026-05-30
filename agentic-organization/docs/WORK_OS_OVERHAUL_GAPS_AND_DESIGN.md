---
title: Work OS Overhaul — Gaps and Design
canonical_name: Agentic Organization
status: design
---

# Work OS Overhaul — Gaps and Design

This document does two things, in order:

1. **Documents every gap** between what the org system actually does today (the
   simplified P5 pipeline proved in kind) and a **true agentic Work OS** — proper
   work types, work flowing in and out of the system, a *standing* QA department
   that evolves the product through testing, a real test-case-management +
   test-run + regression system, and the living feedback / churn / escalation
   loops that keep work moving.
2. **Specifies the overhaul** we will then implement and prove in kind — built on
   the primitives we already have (`observe → decide` kernel, `org_event` trace,
   `HatBinding` lifecycle, RMO supply voting, CockroachDB, NATS), before any
   memory work begins.

It composes with the existing design docs and makes them executable:
[`WORK_AND_RELEASE_MANAGEMENT_OS.md`](WORK_AND_RELEASE_MANAGEMENT_OS.md) (the
target product shape), [`ANTI_STALL_PRIORITY_RUNTIME.md`](ANTI_STALL_PRIORITY_RUNTIME.md)
(churn/escalation), [`BUSINESS_QUALITY_GATE_SYSTEM.md`](BUSINESS_QUALITY_GATE_SYSTEM.md)
(gate-failure routing), [`AMBIGUOUS_REQUIREMENT_LIFECYCLE.md`](AMBIGUOUS_REQUIREMENT_LIFECYCLE.md)
(BRD → scenarios), and [`METRICS_AND_REVIEW_BOARD.md`](METRICS_AND_REVIEW_BOARD.md)
(the existing code-metrics + 3-agent review board).

The design invariant is unchanged: **determinism computes the legal set; agents
drive the outcomes; every transition emits one durable `org_event`.** The overhaul
makes the *work itself* a living, observable, self-moving system — not a single
linear pipeline.

---

## Part A — What exists today (honest current state)

The org system (P0–P7, proved in kind) shipped a **simplified slice**:

| Built | Reality |
|-------|---------|
| `runOrgCycle` 7-gate pipeline (`pipeline.ts`) | **One linear, single-type gate chain** `customer_rfp_review → … → merged`. It proved the kernel end-to-end but flattened away work types, batches, QA, and flow-in/out. |
| `observe.ts` | A **single-run execution lifecycle** read (`observing → compose → gate → execute → evidence → review → complete`), vetoed by deterministic rules. **Not scoped by hat authority.** Every hat would see the same readout. |
| `prioritization.ts` | Per-item priority, class **clamped by decider level** — but **flat**: one item at a time, no roll-up across teams/batches. |
| `work-item-state-machine.ts` (domain) | A **V0 work-item lifecycle** (`created → intake → triage → ready → in_progress → blocked/review → done`) with only two types (`task`, `defect`) and defect-specific guards. **Not used by `runOrgCycle`.** |
| `packages/metrics/` | Quantitative **code** metrics + a 3-agent qualitative **review board**. Real, but about *source text*, not *work-group health*. |
| RMO supply voting, `HatBinding` lifecycle, `org_event` trace, org-snapshot | Solid primitives — the overhaul **reuses all of them**. |

### The structural problem: three unreconciled work models

There are **three** different "work" abstractions that do not talk to each other:

1. `WorkItemState` (domain) — the *work-item* lifecycle (intake → done). Unused by the runtime.
2. `RunLifecyclePhase` (`observe.ts`) — the *execution* lifecycle of one run.
3. `PipelineStage` (`pipeline.ts`) — the *7 quality gates*. What the runtime actually drives.

A true Work OS needs these unified into **one coherent model**: a typed **work
item** moves through a **type-specific workflow** of **gates**, executed by
**runs**, grouped into **work batches** that carry **rolled-up metrics**, observed
per **hat authority scope**.

---

## Part B — The gap map

Each row: the target capability, where it is designed, what exists today, and the
gap this overhaul closes.

| # | Target capability | Designed in | Today | Gap |
|---|-------------------|-------------|-------|-----|
| G1 | **Full work-item types** (goal, report, service_request, task, defect, capability_request, review, incident, release) | WORK_OS §Core Domain | only `task`/`defect` in domain; runtime is type-blind | Add the full `WorkItemType` DU + per-type workflow policy |
| G2 | **Work batches / mission runs** (durable work groups) with status + capacity + completion/recovery | WORK_OS §Work Batch | none | Add `WorkBatch` DU + membership + batch lifecycle |
| G3 | **Work flows IN from outside** (customer defect/SR → intake → triage → backlog) | WORK_OS §Purpose; Product Shape | none | **External intake adapter** (W5) |
| G4 | **Work flows OUT** (release → merge → activation → post-release verify) | WORK_OS §Release | partial (gate chain ends at `merged`) | Release workflow + egress |
| G5 | **`observe` scoped per hat authority** | operator (this session) | observe is run-scoped, not hat-scoped | **`observeForHat()`** (W2) |
| G6 | **Hierarchical prioritization roll-up** (IC→Lead→Director→exec) | WORK_OS; ANTI_STALL §Cadences | flat per-item | Scope-aware prioritization over batches (W2) |
| G7 | **Work-group rolled-up metrics** (completion %, defect counts, QA bounce-backs) | METRICS; ANTI_STALL §signals | code metrics only | **Operational metrics roll-up** (W2) |
| G8 | **QA as a standing department** that continuously tests + evolves the product | WORK_OS §QA board; ANTI_STALL §QA flow | QA is just a gate approver in the pipeline | **QA standing loop** (W3) |
| G9 | **Test-case management** — derive scenarios off BRDs, store suites/cases | AMBIGUOUS_REQ ("feed learnings into test cases"); WORK_OS §QA board | none | **TestSuite/TestCase domain** (W3) |
| G10 | **Test runs** — execute (computer-use / browser-automation / manual), record pass/fail + evidence | BUSINESS_QUALITY_GATE §runtime_validation | none | **TestRun domain + executor port** (W3) |
| G11 | **Regression + failed-feature observation** (a previously-passing case now fails) | WORK_OS §QA; goal | none | **Regression detector over test-run history** (W3) |
| G12 | **Defect feedback loop** (failed run → defect → fix → re-test) | BUSINESS_QUALITY_GATE §failure routing | defect type exists, loop doesn't | **Failure→defect→retest loop** (W4) |
| G13 | **Churn reduction** (detect bounce-back; stop the loop) | ANTI_STALL §QA bounce-back; METRICS | none | **Churn detector + `RepeatedQaBounceBack`** (W4) |
| G14 | **Escalation ladder** (EM/TPM bring on more agents; architect changes approach) | ANTI_STALL §blocker table | none | **Escalation as observe→decide hat actions** (W4) |
| G15 | **Living, event-driven movement** (no polling; signals create the next action) | WORK_OS §guardrails | the cycle runs once, top-to-bottom | **NATS-driven continuous org cycle** (W6) |
| G16 | **Signals as durable typed events** beyond our 7 `OrgEventKind`s | WORK_OS §Signal Model | 7 kinds | Extend `OrgEventKind` with work/QA/escalation families |

---

## Part C — The overhaul design

### C1. One unified work model (G1, G2, G4)

A single **`WorkItem`** is the spine. It has a **type**, a **workflow** (the legal
state path for that type), a **batch** membership, and a stream of `org_event`s.

```ts
// House DU
const WorkItemType = {
  Goal: "goal", Report: "report", ServiceRequest: "service_request",
  Task: "task", Defect: "defect", CapabilityRequest: "capability_request",
  Review: "review", Incident: "incident", Release: "release",
} as const;

const WorkItemState = {
  Created: "created", Intake: "intake", Triage: "triage", Ready: "ready",
  InProgress: "in_progress", Blocked: "blocked", InReview: "in_review",
  InQa: "in_qa", QaFailed: "qa_failed", Done: "done", Released: "released",
  Cancelled: "cancelled",
} as const;
```

- **Type-specific workflow policy** (data, not code) decides which transitions are
  legal for a given type — the `WorkflowDefinition` shape from WORK_OS §Custom
  Workflow Builder, evaluated by `observe`. A `defect` cannot reach `ready`
  without triage fields + reproduction evidence (we keep the existing guard); a
  `release` runs the release sub-states; a `goal` runs discovery first.
- **The P5 pipeline becomes one workflow** (the `task`/feature workflow) among
  several, instead of *the* pipeline. `runOrgCycle` dispatches by the item's type
  to its workflow. This **unifies the three models**: `WorkItem` is the spine,
  `RunLifecyclePhase` is how a single execution run advances *within* an
  `in_progress` item, gates are the approvals between states.

**Work batches** group related items for an initiative/release/incident:

```ts
const WorkBatchState = {
  Created: "created", Scoped: "scoped", CapacityPlanned: "capacity_planned",
  Scheduled: "scheduled", Active: "active", PartiallyBlocked: "partially_blocked",
  CompletionCheck: "completion_check", Done: "done",
} as const;
```

A batch carries the **rolled-up metrics** (C2) and is the unit a Lead/Director
prioritizes over.

### C2. Scoped observe + hierarchical prioritization + work-batch metrics (G5, G6, G7)

**`observeForHat(hat, orgState)`** is the new organizational read — *distinct from*
the per-run `observe()` (which stays for execution). It returns a readout **scoped
to the hat's authority**:

```ts
function observeForHat(hat: HatDefinition, state: OrgWorkState): HatReadout {
  const inScopeBatches = batchesInAuthorityScope(hat, state); // IC: own items; Lead: team batch;
                                                              // Director: dept batches; exec: all
  const metrics = inScopeBatches.map(rollUpBatchMetrics);     // C2 metrics, aggregated upward
  const legalActions = legalPrioritizationActions(hat, inScopeBatches); // clamped by level (P3)
  return { hatId: hat.id, scope: authorityScopeOf(hat), batches: inScopeBatches, metrics, legalActions };
}
```

- **Authority scope** is derived from `hat.level` + `departmentId` + the work
  groups it owns: an **IC** sees its assigned items; a **Lead** sees its team's
  batch; a **Director** sees its department's batches; the **C-suite/Board** see
  org-wide rollups. *Each higher scope sees a higher-level rollup* — this is "the
  observe is different for each hat."
- **Prioritization rolls up**: an IC orders its own queue; a Lead orders items
  *within* its batch; a Director orders *batches* across teams; exec orders across
  the org. The legal priority classes stay clamped by level (the P3 mechanism we
  already built); what changes is the **scope of the objects being ordered**.

**Work-group metrics (pure roll-up fold over work items + test runs + org_events):**

```ts
type WorkBatchMetrics = {
  batchId: string;
  total: number; done: number; completionPct: number;     // completion %
  blocked: number; inQa: number;
  openDefects: number; defectsOpenedInTestSetup: number;   // # defects QA opened during test-case setup
  qaBounceBacks: number;                                   // churn signal (C4)
  testRuns: number; testFailures: number; passRate: number;
  regressionsOpen: number;                                  // previously-passing cases now failing
  slaBreaches: number; oldestBlockedAgeMs: number;
  movementScore: number;                                    // ANTI_STALL: is the batch moving?
};
```

These aggregate **scope → scope** (item → batch → department → org), so a Director's
readout shows department rollups and an exec's shows org rollups. **These metrics
become the memory KPI signal** (the memory design §6 will correlate against
`WorkBatchMetrics`, not a binary `merged`).

### C3. QA as a standing department + test-case management + test runs + regressions (G8–G11)

This is the deepest new design and the goal's core. QA is **not a gate approver** —
it is a **continuously-running department** that authors and runs tests, files
defects, and observes regressions, *evolving the product*.

#### C3.1 Test-case management (derive from BRDs)

```ts
type TestCase = {
  testCaseId: string; suiteId: string;
  projectId: string; initiativeId: string;
  brdId: string;                          // the BRD/acceptance criterion it covers (AMBIGUOUS_REQ)
  title: string; scenario: string;        // a work-scenario derived off the BRD
  steps: readonly TestStep[];             // ordered, each with expected result
  executionMode: TestExecutionMode;       // computer_use | browser_automation | api | manual
  authoredByHatId: string;                // a QA hat (qa_reviewer / browser_automation_qa)
  status: TestCaseStatus;                 // draft | active | retired
};
const TestExecutionMode = { ComputerUse: "computer_use", BrowserAutomation: "browser_automation", Api: "api", Manual: "manual" } as const;
```

A QA hat **reads an approved BRD → derives scenarios → authors test cases** into a
**TestSuite** scoped to the project/initiative. This is a deterministic-shaped
step: the BRD's acceptance criteria are the legal source; the QA agent drives the
authoring within them; each case emits `test_case_authored`.

#### C3.2 Test runs (execute + record, against the initiative branch)

```ts
type TestRun = {
  testRunId: string; testCaseId: string; suiteId: string;
  initiativeBranch: string;               // QA validates the branch, not main (WORK_OS §branch model)
  executorHatId: string; agentId: string;
  mode: TestExecutionMode;
  outcome: TestRunOutcome;                // passed | failed | blocked | flaky
  evidence: readonly EvidenceRef[];       // screenshots, traces, logs, repro steps
  startedAt: string; finishedAt: string;
};
const TestRunOutcome = { Passed: "passed", Failed: "failed", Blocked: "blocked", Flaky: "flaky" } as const;
```

- **Execution is a port** (`TestExecutor`) so the *real* runner can be computer-use,
  browser-automation (Playwright), an API harness, or a recorded manual result —
  all behind one interface. The in-process fake records deterministic outcomes for
  tests; the live adapter drives the actual tool. (This mirrors how the live
  LLM/sandboxed-tool backend plugs in behind a port, Phase 14.)
- Every run is durable + evidence-bearing + emits `test_run_recorded`. **This is
  the "track failed test runs" substrate** the goal asks for.

#### C3.3 Regression + failed-feature observation (G11)

A **regression** is deterministic to detect: a `TestCase` whose **latest** run on
the integration target is `failed`/`flaky` but whose **prior** run was `passed`.

```ts
function detectRegressions(history: readonly TestRun[]): readonly Regression[] {
  // group by testCaseId, order by finishedAt; a regression = passed... then failed
}
```

- A **failed feature** = an `active` test case that has *never* passed on the
  branch (a new feature that doesn't meet its BRD scenario yet).
- Regressions and failed features **roll into `WorkBatchMetrics`** (C2) and each
  opens (or links to) a **Defect** (C4). QA thereby *continuously evolves the
  product*: every BRD becomes scenarios, scenarios become runs, runs surface
  regressions, regressions become defects, defects drive fixes, fixes get
  re-tested — a standing loop, not a one-shot gate.

#### C3.4 The standing QA cycle

`runQaCycle` runs on its own NATS cadence (independent of feature work), owned by
the QA department hats (`qa_director`, `qa_engineering_manager`, `qa_verifier`,
`qa_reviewer`, `browser_automation_qa`, `regression_scheduler`):

1. For each active initiative branch: ensure BRD-derived suites exist (author if not).
2. Schedule + execute due runs (regression sweep + new-feature validation).
3. Record outcomes + evidence; detect regressions/failed-features.
4. Open/refresh defects for failures; emit quality signals.
5. Update `WorkBatchMetrics`.

### C4. The living feedback / churn / escalation loops (G12–G14)

This is what makes the system **dynamic and alive** rather than a pipeline.

#### C4.1 Failure → defect → re-test feedback loop

A `failed`/`regression` test run **deterministically opens a Defect** linked to the
failing test case + the work item that introduced the change (from the branch's
work-item set). The defect flows the defect workflow; on fix, the **same test case
is re-run**; pass closes the defect. This is a closed loop with durable evidence at
every hop.

#### C4.2 Churn detection (reduce bounce-back)

**Churn** = the same work item bouncing between states (e.g. `in_qa ↔ qa_failed ↔
in_progress`) repeatedly. We count **bounce-backs per work item** from the
`org_event` history; crossing a threshold emits `RepeatedQaBounceBack` and **moves
the item out of the normal loop into an escalation decision** — the loop is *broken
deliberately* instead of spinning.

```ts
function bounceBackCount(workItemId, events): number; // count qa_failed → in_progress transitions
// threshold (default 3) → churn signal → escalation candidate (C4.3)
```

#### C4.3 Escalation ladder (observe → decide, by a hat)

When churn (or an SLA breach, or a stalled blocker) is detected, the legal
**escalation actions** are computed deterministically and the responsible hat
(EM/TPM/Director) chooses within them — *exactly* the ANTI_STALL blocker table,
expressed in our kernel:

| Trigger | Legal escalation set (deterministic) | Decider hat |
|---------|--------------------------------------|-------------|
| Repeated QA bounce-back | `{ add_agents, bring_in_architect, re-scope, pause, accept-risk }` | `engineering_manager` / `tpm` |
| `add_agents` chosen | RMO **expand** hat supply for the work's owner hats (we already have `decideHatSupply`) | RMO voters |
| `bring_in_architect` chosen | assign an `architect` to **change the approach** (new CA/ADR), reopen architecture gate | `engineering_director` |
| Reviewer queue saturated | `{ reassign_reviewer, provision_reviewer_hats, escalate }` | `engineering_manager` |
| Blocker stale, no owner | `{ assign_owner, alternate_work, escalate_priority }` | `tpm` |

- **"Bring on more agents"** = the escalation chooses `add_agents`, which routes to
  the **RMO supply-expand** mechanism we already built (`rmo.ts` votes to raise the
  target hat count) → the assignment engine staffs more wearers of the owner hat.
- **"Architect changes approach"** = the escalation chooses `bring_in_architect`,
  which assigns an `architect` hat, reopens the `architecture_approval` gate, and
  the prior implementation is re-scoped against the new CA. The churn loop is
  *replaced* by a new approach instead of repeating the failing one.
- Every escalation is one `org_event` (`escalation_decision`), fully traced.

This is the closed governance loop: **churn is detected deterministically →
escalation options are bounded → a hat decides → the org re-staffs or re-approaches
→ work moves again.** Reducing churn is structural: once an item escalates, it
**cannot** re-enter the same failing loop without a changed input (more agents,
new approach, re-scope, or an explicit accept-risk decision).

### C5. External / SR intake — work flows IN (G3)

An **intake adapter** lets outside systems (customer portals, support tools,
monitoring) submit defects/SRs/feature-requests that **become first-class work**:

```text
external event  (HTTP webhook OR NATS subject org.intake.external)
  -> normalize  (deterministic: map payload → { type, title, severity, projectId, evidence })
  -> create WorkItem in `created`
  -> intake → triage  (a triage hat classifies: defect | service_request | goal | …)
  -> ready             (enters the backlog / SR pipeline)
```

- **Inbound transport:** an HTTP endpoint + a NATS subject; both land on the same
  deterministic **normalizer** (no model call to parse — a typed mapping with a
  `Result<WorkItem, IntakeFeedback>` so malformed payloads are rejected cleanly,
  not silently dropped).
- **De-dup:** content-addressed external key (`uuidv5(source:externalId)`) so the
  same upstream report doesn't create duplicate work items (idempotent intake).
- Every intake emits `work_item_created` with `source: "external"` + the upstream
  ref, so customer-reported defects are traceable end-to-end into the backlog/SR
  pipeline.

---

## Part D — Determinism ⇄ autonomy (the whole overhaul)

| Concern | Deterministic (legal set / math) | Agent drives (within it) |
|---------|----------------------------------|--------------------------|
| Work-item transitions | type-specific workflow policy → legal next states | which transition to take |
| `observeForHat` | scope union + metric roll-up (pure) | what to prioritize within scope |
| Prioritization | classes clamped by level; objects scoped by authority | the ordering |
| Test authoring | BRD acceptance criteria = legal source | the scenarios/steps |
| Test execution | the executor port runs deterministically; outcome recorded | (the runner; agent for manual) |
| Regression detection | pure fold over run history | — |
| Churn detection | bounce-back count vs threshold (pure) | — |
| Escalation | bounded legal escalation set per trigger | which escalation (EM/TPM/Director) |
| Intake | deterministic normalize + de-dup | the triage classification |

Nothing here lets an agent skip QA, fake a test pass, escalate beyond the legal
set, or create invisible work. Every move is one `org_event`.

---

## Part E — Storage (CockroachDB, mirroring `OrgSystemV15`)

New tables (migration `WorkOsV16`, on-disk mirror + parity test, same conventions):

- `agentic_org_work_items` — id, type, state, project/initiative/batch refs, source (internal|external + upstream ref), severity, timestamps.
- `agentic_org_work_batches` — id, state, scope, capacity plan, completion/recovery rule refs.
- `agentic_org_test_cases` — id, suite, brd ref, scenario, steps (JSONB), execution_mode, status.
- `agentic_org_test_runs` — id, test_case, initiative_branch, outcome, evidence (JSONB), executor hat/agent, timestamps.
- `agentic_org_defects` — id, severity, repro evidence, linked test_case + work_item, fix flow state.
- `agentic_org_intake_inbox` — external de-dup key, raw payload (JSONB), normalized work_item_id, received_at.

The `org_event` trace + org-snapshot fold extend to a **work/QA view**; new
`OrgEventKind`s: `WorkItemTransition`, `WorkBatchTransition`, `TestCaseAuthored`,
`TestRunRecorded`, `RegressionDetected`, `DefectOpened`, `ChurnDetected`,
`EscalationDecision`, `IntakeReceived`.

---

## Part F — Phased build plan (each phase tsc-clean, tested, proved in kind)

| Phase | Deliverable |
|-------|-------------|
| **W1** | Unified work model: `WorkItemType` (9) + `WorkItemState` + per-type workflow policy DUs + `WorkBatch` + Cockroach `agentic_org_work_items`/`_work_batches` (migration `WorkOsV16` + parity test). The P5 pipeline becomes the `task` workflow. |
| **W2** | `observeForHat()` (authority-scoped readout) + hierarchical prioritization over batches + `WorkBatchMetrics` roll-up fold + new work `OrgEventKind`s. Unit-proved at IC/Lead/Director/exec scopes. |
| **W3** | QA standing dept: `TestSuite`/`TestCase`/`TestRun`/`Regression` domain + `TestExecutor` port (fake + a browser/computer-use adapter shell) + `runQaCycle` (BRD→suites→runs→regressions→defects). |
| **W4** | Feedback + churn + escalation: failure→defect→retest loop, `bounceBackCount` churn detector, the escalation ladder as observe→decide hat actions wired to RMO supply-expand + architect re-approach. |
| **W5** | External/SR intake adapter (HTTP + NATS → deterministic normalize + de-dup → triage → backlog/SR), traced. |
| **W6** | **Wire the living system into `org-runtime` + the worker; prove end-to-end in kind:** an external defect intake → triage → assigned → developed → **QA test run catches a regression** → defect → bounce-back → **churn escalation pulls in more agents + an architect re-approach** → fixed → re-tested green → released; observe the whole living loop in `org_events` + the snapshot, with `WorkBatchMetrics` rolling up to the exec scope. Record proof in NORTH_STAR_ALIGNMENT_CHECKPOINT. |

The end-to-end kind proof (W6) is the bar: not "a pipeline ran," but **"the org
observed churn, escalated, re-staffed, changed approach, and the work moved" —
visible from IC to exec.**

---

## Part G — Scope honesty (what this overhaul implements vs. the full vision)

The `WORK_AND_RELEASE_MANAGEMENT_OS` doc describes a very large product (every
board, every signal family, Temporal-backed durable workflows, Dapr actors). This
overhaul implements the **living core** the goal calls for — work types + flows,
scoped observe + rollup, the standing QA + test-mgmt + regression system, and the
feedback/churn/escalation loops — on our proven deterministic kernel, **fully
functional and proved in kind.** Explicitly *deferred* (named so they are not
silently dropped): role-specific UI boards, Temporal durable workflows, Dapr
actor supply (we keep the RMO vote mechanism), and the full release-automation
package. These are additive and do not block the living loop.

This document is **W0**. On its acceptance, W1 begins.
