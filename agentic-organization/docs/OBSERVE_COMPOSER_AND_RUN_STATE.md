---
title: Observe, Compose, and Run-State
canonical_name: Agentic Organization
status: v0
ideas: [2, 4, 5, 6]
extends:
  - ORGANIZATION_RUNTIME_ARCHITECTURE.md
  - ALWAYS_ON_ORCHESTRATION_RUNTIME.md
composes_with:
  - ./OBSERVABILITY_AND_SELF_HEALING.md
  - ./SUPERVISOR_CHAIN_COMMUNICATION.md
  - ./BUSINESS_QUALITY_GATE_SYSTEM.md
  - ./GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md
  - ./DOC_FRONTMATTER_CONVENTION.md
  - ./OBSERVE_CONTEXT_PACKS.md
code_anchors:
  - ../packages/application/src/observe.ts
  - ../packages/application/test/observe.test.ts
  - ../packages/observability/src/workflow-visibility.ts
  - ../packages/application/src/command-pipeline.ts
  - ../packages/governance/src/constitution-gate.ts
supersedes: []
---

# Observe, Compose, and Run-State

The keystone that unifies operator ideas **2** (explicit discriminated unions),
**5** (a single `observe.ts` entrypoint with a memoryless composer), and **6**
(complete workflow visibility, triggers, and lifecycle with deterministic rules
applied at every step). Operator idea **4** (metrics via MCP + review) attaches
here because metrics are derived from the same readouts.

## The one thing an agent remembers

An agent in the Agentic Organization remembers exactly one entrypoint:
`observe.ts`. It does **not** remember the work item lifecycle, the gate rules,
the hat policy matrix, or its own past. It calls `observe(runId-scoped snapshot)`
and is handed:

- the **current run state** (an explicit lifecycle phase), and
- the **legal next options** at the requested **scope**, already filtered by the
  Organization's deterministic rules.

This inverts the usual burden: instead of every agent carrying organizational
knowledge, the knowledge lives in `observe.ts` and the agent carries nothing.

## Everything is an explicit discriminated union (idea 2)

Per the repo rule *"IMPLICIT-NOT-EXPLICIT in DUs is class error"*, every
substantively distinct state is an explicit DU variant, never buried in an
if-chain or a field combination. The keystone defines, in
`packages/application/src/observe.ts`:

| DU | Variants | Role |
|----|----------|------|
| `RunScope` | run, work_item, initiative, project, organization | the "varying scopes" a run is observed at |
| `RunLifecyclePhase` | observing, composing, awaiting_gate, executing, awaiting_evidence, awaiting_review, completed, blocked, failed | the run state machine, mirroring the V0 spine |
| `ObserveResult` | `{ outcome: "readout" }` \| `{ outcome: "feedback" }` | `Result<T, TFeedback>` as an explicit two-variant DU — failure is data, never a thrown exception or null |
| `ObserveFeedbackReason` | unknown_phase, terminal_phase, deterministic_rule_violation | why a readout could not be produced |
| `ComposerSelection` | `{ decision: "select" }` \| `{ decision: "hold" }` | what the memoryless composer decided |
| `DecideResult` | selected \| held \| feedback | the composed observe→compose outcome |

These follow the house DU convention (`const X = {...} as const; type X =
(typeof X)[keyof typeof X]`).

## observe() is pure; the composer holds the intelligence (idea 5)

The separation is the whole point:

- **`observe(snapshot, deps)`** is a **pure function**. It reads nothing and
  stores nothing. It computes the readout from an injected `RunSnapshot` and an
  explicit `phase → options` table (the same shape as
  `domain/src/work-item-state-machine.ts`'s transition table). Determinism here
  is what makes the system auditable.
- **`EphemeralComposerPort.compose(request) → ComposerSelection`** is the
  intelligence. It is **memoryless by contract**: everything it needs is in the
  `request.readout` argument; it keeps nothing between calls. An LLM-backed
  composer must put all context into the request, never into instance state.
  This is the `agent-loop` skill's *LLM-as-pure-selector* substrate made
  concrete.
- **`decide(snapshot, composer, deps)`** wires them: it observes, asks the
  composer to pick from the surviving options, and **rejects any selection
  outside the readout**. The composer cannot escape the deterministic rules — it
  can only select within them. (Test: *"decide rejects a composer that selects
  an option outside the readout."*)

```text
caller loads snapshot (from Cockroach / git-as-db, ZetaId-addressed)
  -> observe(snapshot)            # pure logic: state + legal options at scope
  -> composer.compose(readout)    # ephemeral, memoryless: pick one (or hold)
  -> decide(...) validates the pick is legal
  -> emit selection as a command through command-pipeline.ts
```

## Deterministic rules apply at every step (idea 6)

`DeterministicRule` is a pure predicate `(option, snapshot) → veto?`. The default
set (`gate-precondition`, `evidence-precondition`) is always applied, and the
readout records `deterministicRulesApplied` so the *visibility* of which rules
ran is first-class. A phase with no surviving option returns
`deterministic_rule_violation` feedback rather than silently stalling — stall is
a signal, composing with `ANTI_STALL_PRIORITY_RUNTIME.md`.

This is the trigger/lifecycle contract idea 6 asks for: every transition is
gated by explicit rules, every readout is timestamped and trace-carrying, and
the legal surface is computed, not improvised.

## Visibility and metrics (idea 4)

Each `observe`/`decide` outcome maps onto the existing
`observability/src/workflow-visibility.ts` `WorkflowObservationKind` DU — no new
visibility substrate is invented. A `decide` selection becomes a `command`
observation; a `hold` or `feedback` becomes a weak-point indicator
(`BlockedWork` / `PolicyDenied` analog). **Metrics (idea 4) are aggregations
over these observation records** exposed through an MCP tool
(`read_workflow_metrics`), and the *review* of those metrics is itself ordinary
Organization work routed through the supervisor chain and documented as a
recurring report. The metric pipeline therefore reuses the trace envelope
(`correlationId`/`causationId`/`traceId`/`idempotencyKey`) already carried on
every readout. Detailed metric schemas extend `OBSERVABILITY_AND_SELF_HEALING.md`
rather than living here.

## Context packs: intelligence needs the right context

`observeAgentSurface` also returns a hat-scoped context readout. The core
`observe(snapshot, deps)` kernel remains context-pack blind and pure; context is
assembled at the surface through an injected `ContextPackBuilderPort` after the
deterministic readout, scoped metrics, prompt-flow readout, and hierarchy readout
exist.

The context pack is the Organization's answer to the real autonomy problem: a
director, TPM, reviewer, or implementer must wake up with the governing docs,
decisions, graph neighborhood, memory pointers, omissions, stale inputs, and
contradictions needed for this hat and this work. If no builder is wired, the
surface returns a degraded `missing` context pack with an explicit
`builder_unavailable` omission instead of silently implying that no context is
needed. The detailed architecture lives in `OBSERVE_CONTEXT_PACKS.md`.

## Constitution ratification needs ≥3 agents (idea 2, governance half)

The `compose → awaiting_gate → execute` edge requires an approved gate. For the
class of decisions that set **constitutions** (the deterministic rule sets and
scope policies that `observe` itself applies), the gate is a **multi-oracle
ratification gate**: at least **3 independent agents** must agree before the
constitution set is adopted. This composes with the existing `governance`
package and the repo's multi-oracle / three-faction BFT substrate (081KS3X9Y0008QG0R00218150M,
081KRW63S0008QG0R002GRX85J) rather than inventing a new voting path.

Explicit gate DU, implemented in `packages/governance/src/constitution-gate.ts`:

```ts
const ConstitutionRatificationState = {
  Proposed: "proposed",
  Gathering: "gathering",          // collecting independent agent agreements
  Ratified: "ratified",            // >= quorum (default 3) distinct agents agreed
  Rejected: "rejected",
  Superseded: "superseded",        // lifecycle variant; not produced by the pure evaluation
} as const;

type ConstitutionAgreement = {
  agentId: string;                 // must be distinct; self-agreement does not count
  hatAssignmentId: string;
  decision: ConstitutionDecision;  // "agree" | "object"
  rationale: string;
};
```

`evaluateConstitutionRatification({ agreements, quorum? })` is a pure function.
Ratification is reached only when the **distinct** `agentId`s with `decision ===
"agree"` number **≥ quorum** (default 3, `DEFAULT_CONSTITUTION_QUORUM`), with no
unresolved `object` (any objection vetoes to `Rejected`). A single agent agreeing
twice counts once — no self-amplification. The quorum, the distinctness check,
and the objection-veto precedence are explicit — not buried — exactly as the
`decide()` legality check is explicit.

## Status

`observe.ts` + `decide` + the default deterministic rules are **implemented and
tested**, and the constitution ratification gate DU
(`packages/governance/src/constitution-gate.ts`) is **implemented and tested**
(full suite 318 green). The MCP metrics tool (idea 4) remains **design** (next
slice). See `PHASED_DEVELOPMENT_PLAN.md` for sequencing.
