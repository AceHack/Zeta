---
title: Adaptive Organization Platform — Design
canonical_name: Agentic Organization
status: design
---

# Adaptive Organization Platform — Design

How the agentic organization becomes a **generic, configurable runtime** that any
company can make run *exactly* how they want: import their Jira/Linear workflows
and move work bidirectionally, configure which states need a human, ingest and
understand a large existing codebase, inject their business practices (how BRDs
and RFPs are written), and — through a guided onboarding that is *itself* the
org's first work — build out handbooks, skills, hat adjustments, and an autonomy
policy that the deterministic kernel then enforces. And, the piece stressed most:
**deterministic guardrails so a hat acts only within its role** — a TPM that tries
to write code is rejected, for as long as it wears that hat.

The thesis in one line: **a customer's entire organization-style is configuration
data** (workflow definitions + handbooks + skills + hat adjustments + autonomy
policy + integration mappings), versioned over git/Cockroach with pointers,
authored during onboarding, and enforced by the same `observe → decide` kernel we
already built. Adaptation is the hierarchy's *purpose*: it exists to meet the
customer's goals and self-heals to keep doing so.

Builds on what already exists: the Work OS (W0–W6), `HatDefinition` (which already
carries `allowedToolBundles`, `lifecycleTransitions`, `skills` pointers,
`requiresHumanApproval`), the `org_event` trace, the
[`WorkflowDefinition`](WORK_AND_RELEASE_MANAGEMENT_OS.md) data shape, the
[knowledge graph](AGENT_NATIVE_KNOWLEDGE_GRAPH.md), the
[MCP preflight](V0_POLICY_AND_RUNTIME_BOUNDARIES.md), and the
[memory system](DYNAMIC_MEMORY_SYSTEM_DESIGN.md).

---

## Part 1 — Everything-as-configuration (the tenancy + config substrate)

The runtime is fixed; the *organization* is data. Each customer is a **tenant**;
their org-style lives in versioned configuration objects, all addressable by
**pointer** (a stable id resolvable over Cockroach + git, the same pointer-index
discipline the memory system uses):

| Config object | What it customizes | Pointer references |
|---------------|--------------------|--------------------|
| **WorkflowDefinition** | the states/transitions/gates/allowed-hats for a work type (copied from their Jira or described) | → gates, → allowed hat ids, → handbooks |
| **Handbook** | a versioned practice doc consulted at a stage ("how we write BRDs/RFPs", "definition of done") | ← bound to workflow stages + hats |
| **Skill** | a reusable capability a hat can wear; **references other skills by pointer** | → `referencedSkillIds`, → handbooks |
| **HatAdjustment** | per-tenant overrides to a seed hat: tool bundles, allowed transitions, bound handbooks, bound skills, autonomy | → skill ids, → handbook ids |
| **AutonomyPolicy** | per (work type, transition/gate): `auto` \| `human_review` \| `human_approve` — the "where it asks a human" dial | ← bound to workflow transitions |
| **IntegrationMapping** | external system field/state/workflow ↔ internal mapping | ← external project, → WorkflowDefinition |

These are **first-class typed records over Cockroach + git** (markdown-as-row for
the prose-heavy ones — handbooks — per the git-as-DB substrate; typed rows for the
rest), each carrying a `tenantId`, a `version`, and `org_event` provenance. The
seed org we built (16 departments, ~115 hats) is the **default template**; a tenant
is the template + their config overlays. Nothing in the kernel is per-customer
code — only per-customer *data*.

**Pointers, everywhere.** A hat points to skills; a skill points to other skills;
a hat points to handbooks; a workflow gate points to the handbook that defines its
acceptance; a work item points to the codebase nodes it touches. Resolution is a
pointer-lookup over Cockroach/git (cheap, cached) — the same `(location → content)`
index the memory system formalizes. This is what makes the org **composable**:
practices are reused by reference, not copied.

---

## Part 2 — Onboarding *is* the org's first work (self-bootstrapping)

The first interaction with any customer is a guided **setup that the organization
runs on itself**. The user describes each process and gives examples; the agents
turn those into the configuration of Part 1 — using the very discovery lifecycle
([`AMBIGUOUS_REQUIREMENT_LIFECYCLE.md`](AMBIGUOUS_REQUIREMENT_LIFECYCLE.md)) the org
uses for any ambiguous work. Onboarding is a `WorkBatch` of work items:

```text
onboarding batch (owned by an onboarding/TPM hat)
  → interview: "describe your intake process" → produce WorkflowDefinition(s)
  → interview: "show me a BRD / an RFP you like" → produce Handbook(s) (templates + rules)
  → interview: "which steps must a human approve?" → produce AutonomyPolicy
  → interview: "what tools/credentials does each role use?" → produce HatAdjustments
  → connect Jira/Linear → import their workflows → produce WorkflowDefinitions + IntegrationMappings
  → point at the codebase → build codebase intelligence (Part 5)
  → ingest existing docs/wiki → Handbooks + knowledge-graph nodes (Part 6)
  → produce the org's own handbooks (skills, hat→handbook bindings) and hand off to normal operation
```

Each step is a traced work item with human gates where the customer wants them.
The output is the tenant's configuration — **the org configured itself by doing
work, using its own machinery.** That is the deepest form of "adaptive."

The **frontend** surfaces this as a setup wizard: a sequence of process-description
prompts + example uploads + a Jira/codebase connect step + an autonomy dial; behind
it, the onboarding batch executes and the customer watches their org take shape
(the same `org_event` trace, rendered).

---

## Part 3 — External integration (Jira / Linear, bidirectional)

An **`IntegrationAdapter` port** (Jira, Linear, GitHub Issues, …) with three jobs:

1. **Workflow import (copy their flow).** Read the external project's workflow
   (statuses + transitions + who can move them) → generate a `WorkflowDefinition`
   that mirrors it. The customer's process becomes an internal workflow without
   hand-modeling.
2. **Inbound pull (their work becomes our work).** Poll/webhook external issues →
   the W5 intake normalizer → an internal `WorkItem` linked by `externalRef`
   (`jira:PROJ-123`), placed in the internal state mapped from the external status
   via the `IntegrationMapping`. De-duped on `externalRef` (idempotent).
3. **Outbound mirror (our movement moves theirs).** When an internal work item
   transitions, the adapter maps the internal `toState` back to the external status
   and **moves the Jira/Linear ticket** to match. As internal work flows, the
   external board flows with it.

**Echo-loop safety (the hard part of bidirectional sync):** every change carries a
`causationId` naming the side that originated it. The adapter ignores an inbound
change whose causation is its own prior outbound write (and vice-versa), so an
internal→external→inbound round-trip does not re-trigger. Field mappings
(`IntegrationMapping`) translate priorities, types, severities, assignees
(external user ↔ internal hat). The whole sync is itself traced as `org_event`s.

---

## Part 4 — Configurable human gating + the autonomy dial

The customer decides **how autonomous** the system is, per process. The
`AutonomyPolicy` maps each `(workType, transition | gate)` to one of:

| Mode | Behavior |
|------|----------|
| `auto` | the kernel + agent drive it; no human |
| `human_review` | proceeds, but a human is notified + can intervene (advisory) |
| `human_approve` | **blocking** — the transition is *not legal* until a human approves |

This plugs straight into the legal-set kernel: when a transition's gate is
`human_approve`, `legalNextTransitions` surfaces it but the deterministic veto
holds it (exactly like an unapproved quality gate) until a `HumanApproval`
`org_event` is recorded. The **frontend** renders a "pending human gates" queue;
approving emits the event and the transition unblocks. The customer turns the dial
per work type — full autonomy for low-risk SRs, human-approve on releases — and the
same kernel enforces it. `HatDefinition.requiresHumanApproval` is the per-hat
default; the AutonomyPolicy is the per-transition override.

---

## Part 5 — Codebase intelligence (enter a large codebase, understand it, route it)

Extend the [knowledge graph](AGENT_NATIVE_KNOWLEDGE_GRAPH.md) with **code node/edge
kinds** so the org can reason about an existing system:

- **Nodes:** `Repo`, `Service`, `Module`, `Package`, `Endpoint`, `DataStore`,
  `CodePath`, plus an `owner` edge to a hat/department.
- **Edges:** `depends_on`, `calls`, `owns`, `tested_by`, `deploys_to`, `documented_in`.

**First-entry flow (two stages — determinism then enrichment):**

1. **Deterministic structural scan** — parse package manifests, import graphs,
   service boundaries (directory + manifest heuristics), API specs, CI/deploy
   config. This produces the *skeleton* graph with zero model calls: which
   services exist, what depends on what, where the data stores are. Cheap,
   reproducible, re-runnable on every commit (a structural diff updates the graph).
2. **Agent enrichment** — an architecture hat reads the skeleton + key files and
   writes the *semantic* layer: an architecture summary per service, the role each
   plays, the risky paths, the ownership map — stored as graph nodes + a
   **handbook** ("System Architecture") bound to the architecture stage.

**Storage:** nodes/edges over Cockroach (queryable) + git (the durable, diffable
source, markdown-as-row for the prose); every node is pointer-addressable.

**Use as context (route + reason):** when a work item touches a service, the
relevant **codebase subgraph is retrieved and injected** into the agent's prompt —
the same retrieval shape as memory (scope = the touched services + their
dependencies; ranked by relevance). "Route and reason about microservices" =
graph traversal: *what calls this endpoint, who owns it, what tests cover it, what
deploys it.* The codebase graph is the standing answer.

---

## Part 6 — Organization intelligence + self-consultation (consult your own docs)

The org's accumulated knowledge — handbooks, decisions, architecture docs, prior
work — becomes **consultable context**, and this is where it converges with the
memory system:

- **Handbooks are high-tier memory.** A handbook is a `hat`/`department`-tier
  memory (the memory design's tiers) with a stable pointer. Binding a hat to a
  handbook means the handbook is *always retrieved* when that hat acts (a
  deterministic injection, not an agent choice).
- **Ingest existing documentation** (wiki, Confluence, READMEs) → handbook records
  + knowledge-graph `Document` nodes; processes **consult** them via an explicit
  workflow step (`consult_handbook(handbookId)` injects the bound doc into the
  prompt). "How are BRDs written here" is a handbook the BRD stage consults.
- **The org consults its own docs.** As the org builds a large system, its own
  decisions/architecture/handbooks are stored over Cockroach/git **with pointers**;
  a `consult` step retrieves them. This is the same retrieval substrate as codebase
  intelligence and memory — one pointer-indexed knowledge layer, three lenses
  (memory = what worked, codebase = how the system is built, handbooks = how we do
  things). The memory KPI weighting (which docs produce good outcomes) applies here
  too: handbooks that correlate with good work surface more.

---

## Part 7 — Deterministic hat guardrails (a hat acts only within its role)

**The problem, named:** if an agent wearing the **TPM** hat starts *writing or
implementing code*, that is a violation — the TPM's job is prioritization and
coordination, not implementation. The system must **deterministically** prevent it,
for as long as the agent wears that hat.

**The mechanism — the observe→decide clamp at the *action* layer.** Every action an
agent takes is classified into an **action class**, and each class requires a
**capability** (a tool bundle). The active hat's `allowedToolBundles` +
`lifecycleTransitions` define its legal action classes. A **deterministic preflight**
(extending the existing [MCP preflight](V0_POLICY_AND_RUNTIME_BOUNDARIES.md))
computes the legal action set *from the active hat binding* and **rejects any action
outside it before it executes**, emitting a `hat_guardrail_violation` org_event.

```ts
// action class → required capability (tool bundle)
const ActionClass = {
  WriteCode: "write_code",        // requires devops / oz_and_hermes_runtime bundle
  ReviewCode: "review_code",      // requires review_and_gates bundle
  Prioritize: "prioritize",       // requires task / portfolio_and_initiative bundle
  ApproveGate: "approve_gate",    // requires review_and_gates + the gate's approvalScope
  AuthorBrd: "author_brd",        // requires business bundle
  RunTest: "run_test",            // requires qa bundle
  GrantCredential: "grant_credential", // requires credential_proxy + security scope
  // …
} as const;

function legalActionClasses(hat: HatDefinition): ReadonlySet<ActionClass> {
  // derived from hat.allowedToolBundles (+ lifecycleTransitions for state moves)
}

function preflightAction(action: ProposedAction, binding: HatBinding, hat: HatDefinition): Result<Authorized, GuardrailViolation> {
  if (isTerminalHatBinding(binding.phase)) return reject("hat authority expired");
  if (!legalActionClasses(hat).has(action.class)) return reject(`${hat.id} may not ${action.class}`);
  if (action.class === ActionClass.ApproveGate && !hat.approvalScopes.includes(action.gateScope)) return reject("gate not in approval scope");
  if (action.class === ActionClass.ReviewCode && action.authoredBySameAssignment) return reject("cannot review own work"); // the V0 conflict rule
  return authorize();
}
```

- **TPM writes code → rejected.** The TPM hat's `allowedToolBundles` do not include
  the implementation bundle (`oz_and_hermes_runtime` / `devops`), so
  `WriteCode ∉ legalActionClasses(tpm)` → preflight rejects + emits a violation.
- **Bound to the active binding.** The guardrail reads the *active* `HatBinding`
  (W1 lifecycle). The agent abides by the hat's limits **for the binding's
  duration**; when the binding expires/releases, authority and guardrails change
  with it. There is no window where a worn hat's limits are unenforced.
- **It cannot be escaped.** Same property as every other kernel clamp: the legal
  action set is computed by determinism *from the hat*; the agent only selects
  inside it. A model that *tries* to write code as a TPM produces an action the
  preflight refuses to execute — the attempt is logged, not performed.
- **Tenant-tunable.** A `HatAdjustment` can tighten or loosen a hat's allowed
  bundles per the customer's org-style (some orgs let a senior IC both implement
  and review; others forbid it) — the *enforcement* is fixed, the *policy* is data.
- **Beyond tools:** the same preflight enforces the V0 can/cannot table —
  "Code Reviewer cannot review work they implemented", "EM cannot create a new
  credential scope alone", "expired hat loses all tools" — as deterministic rules,
  not hopes.

Every privileged agent action thus routes through one choke point that asks: *does
the hat you are wearing, right now, permit this?* That is the guarantee.

---

## Part 8 — Self-healing / adaptation (the purpose of the hierarchy)

The hierarchy exists to **meet the customer's goals** and to **adjust itself** to
keep meeting them. The adaptation loop reuses everything built:

```text
observe (per-hat scoped metrics W2 + guardrail violations + KPIs + churn W4)
  → decide (a hat, within its legal set):
       re-staff (RMO supply-expand) · re-approach (architect) · re-prioritize ·
       update a handbook · tighten a guardrail · request a human decision ·
       propose a workflow-definition change (human-gated)
  → act (within guardrails)
  → trace (org_event) → feeds the next observe
```

The configuration itself is **mutable work**: improving a handbook, adjusting a
hat, changing an autonomy gate are all work items the org runs (human-gated per the
customer's dial). Self-healing examples:

- repeated `hat_guardrail_violation`s by a role → flag the hat-config or the agent
  for review;
- a workflow that keeps stalling at one gate → propose a workflow-definition change;
- repeated QA failures → architect re-approach (W4) + a handbook update capturing
  the lesson;
- a handbook that correlates with bad outcomes (memory KPI) → demote/revise it.

The org reads its own trace + metrics and adapts — that is what the hierarchy is
*for*.

---

## Part 9 — Phased build plan (C-track; each phase tsc-clean, tested, kind-proved)

| Phase | Deliverable |
|-------|-------------|
| **C0** | This design doc. |
| **C1** | Config substrate: `tenantId` scoping + `WorkflowDefinition`, `Handbook`, `Skill` (pointer-linked), `AutonomyPolicy`, `HatAdjustment` domain + Cockroach/git storage + pointer resolution. |
| **C2** | **Deterministic hat guardrails** (the priority): action-class taxonomy + `preflightAction` + `hat_guardrail_violation` events; the legal action set derived from the active binding. *Kind proof: a TPM-writes-code action is rejected + traced; a Code-Reviewer-reviews-own-work is rejected.* |
| **C3** | Configurable human gating: `AutonomyPolicy` enforced in the legal-set veto + `HumanApproval` events + a pending-approvals view. |
| **C4** | External integration: `IntegrationAdapter` port (Jira/Linear) — workflow import, inbound pull (extends W5), outbound mirror, echo-safe causation. |
| **C5** | Codebase intelligence: code node/edge kinds + deterministic structural scan + agent enrichment + subgraph retrieval-as-context. |
| **C6** | Org intelligence: handbooks-as-consultable-context + `consult_handbook` workflow step + doc ingestion; converges with the memory system. |
| **C7** | Onboarding-as-work: the self-bootstrapping discovery → config batch + the setup-wizard frontend contract. |
| **C8** | The adaptation loop wired + **end-to-end kind proof**: a tenant config drives a *different* workflow with *its* human gates, a guardrail rejection is traced, a Jira ticket mirrors an internal transition, and a codebase subgraph is retrieved as context — all observable. |

C2 (guardrails) is recommended first — it is the most stressed, the most grounded
(the hat data already carries `allowedToolBundles`/`lifecycleTransitions`), and the
safety floor everything else operates within.

---

## Part 10 — What's grounded vs. new

**Already grounded (this overhaul is mostly enforcement + config on top):**

- `HatDefinition` already carries `allowedToolBundles`, `lifecycleTransitions`,
  `skills` (pointers), `approvalScopes`, `requiresHumanApproval`,
  `conflictsWithHatIds` — the guardrail + skill-pointer surface exists.
- `WorkflowDefinition`-as-data is designed (WORK_AND_RELEASE_MANAGEMENT_OS).
- The knowledge graph (nodes/edges) is designed (AGENT_NATIVE_KNOWLEDGE_GRAPH).
- The MCP preflight is designed (V0_POLICY_AND_RUNTIME_BOUNDARIES).
- The Work OS (W0–W6) + memory design provide the work loop + the retrieval/
  pointer substrate.

**New (what this design adds):**

- The **enforcement preflight** (action-class → capability → reject).
- The **config substrate as tenant data** (handbooks/skills/autonomy/adjustments).
- The **integration adapter** (bidirectional, echo-safe).
- The **codebase-graph ingestion** (structural scan + enrichment).
- The **onboarding-as-work** flow + the setup frontend contract.
- The **adaptation loop** tying observe → config-change → trace.

## Determinism ⇄ autonomy (the platform-wide split)

| Concern | Deterministic (the kernel) | Configurable / agent-driven |
|---------|----------------------------|------------------------------|
| Which actions a hat may take | preflight from `allowedToolBundles` (cannot be escaped) | the tenant tunes the bundles via `HatAdjustment` |
| Which transitions are legal | the WorkflowDefinition + gates | the tenant authors the WorkflowDefinition |
| Where a human is required | the AutonomyPolicy veto | the customer sets the dial |
| External sync | the mapping + echo-safe causation | the tenant authors the mapping |
| What context is injected | handbooks/codebase/memory retrieval (always-on for bound hats) | which handbooks/skills a hat is bound to |
| Adaptation | observe (metrics/violations) computes the legal responses | a hat chooses; config changes are human-gated per dial |

The customer configures *what the org does and how autonomous it is*; the kernel
guarantees *the rules are followed* — including that a hat never acts outside its
role. **Adaptation is the product; determinism is the floor that makes adaptation
safe.**
