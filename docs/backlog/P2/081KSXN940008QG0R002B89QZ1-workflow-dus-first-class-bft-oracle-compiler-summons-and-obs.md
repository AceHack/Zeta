---
id: 081KSXN940008QG0R002B89QZ1
priority: P2
status: open
title: Workflow DUs with first-class BFT oracle/compiler summons + observe.ts keystone -- research-to-get-clean then build
tier: core-architecture
ask: Aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-05-31
type: feature
composes_with:
  - docs/research/2026-05-31-workflow-dus-first-class-bft-oracle-summons-and-observe-keystone-design-space-aaron-otto.md
  - docs/backlog/P1/081KSV2WD0008QG0R00051XS0N-tri-boolean-core-primitives-digital-qubit-floating-point-multi-language-build-compiler-parity-non-byzantine-bft-aaron-2026-05-30.md
  - docs/backlog/P2/081KS3X9Y0008QG0R00218150M-multi-oracle-consensus-with-bft-inside-dst-agreement-across-trust-gradient-architecture-aaron-2026-05-21.md
  - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
  - src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts
  - agentic-organization/docs/OBSERVE_COMPOSER_AND_RUN_STATE.md
tags: [workflow-du, bft, summonable-bft, compiler-summons, observe-keystone, oracle-class, ople, multi-oracle, research, core-architecture]
---

# 081KSXN940008QG0R002B89QZ1 -- Workflow DUs with first-class BFT oracle/compiler summons + observe.ts

## The directive (Aaron 2026-05-31)

> *"workflow DUs should have BFT compiler summons and observe.ts first class somehow -- this prob
> needs a bit of research to get clean and backlog."*

## The thing

Make **two properties first-class (by construction, not bolted on per-workflow) on every workflow
DU** (the state machines: `RunLifecyclePhase`, the F# DU canon 081KSKBP80008QG0R000B3Y19A.5, the work-item lifecycle):

1. **`observe`** -- the keystone `observe(state, scope) -> ObserveResult` (current phase + legal
   options at `RunScope`), uniform across all workflow DUs.
2. **BFT oracle/compiler summons** -- a transition's validity / an option's availability is
   established by **summoning N independent oracles + joining to consensus** (summonable BFT, 081KSV2WD0008QG0R00051XS0N),
   with two distinct oracle classes: **compiler-summon** (non-Byzantine; structural/type/invariant
   validity) and **LLM-summon** (Byzantine-tolerant quorum; semantic/contextual validity; the
   self-recursive observe). `Tri = T | F | N` is the per-option consensus result.

## Why research-first ("get it clean")

Per the operator, the abstraction needs research before it's buildable. The design space + open
questions are in
[`docs/research/2026-05-31-workflow-dus-first-class-bft-oracle-summons-and-observe-keystone-design-space-aaron-otto.md`](../../research/2026-05-31-workflow-dus-first-class-bft-oracle-summons-and-observe-keystone-design-space-aaron-otto.md):

- two oracle classes (compiler vs LLM) must be typed distinctly;
- three attach layers (transition / option-availability / constitution-gate);
- four candidate first-class shapes (typeclass `IWorkflowDU` / `Observable<DU>` wrapper /
  OPLE-algebra primitives / spec-to-code generation) -- likely OPLE-substrate + typeclass-surface +
  gen-for-the-ballot, but that is the design call;
- 7 open questions (summon/join protocol, oracle-class typing, recursion+termination, constitution
  escalation, single-node cost, mapping to existing keystone code).

## Acceptance (research stage, then build)

1. **Research / design pass** (the doc above is the input): pick the clean abstraction (which of the
   4 shapes; the summon/join protocol; the oracle-class typing) with operator + Max review.
2. **Spec the `WorkflowDU` contract**: `observe(state, scope) -> ObserveResult` + per-transition
   oracle-class declaration + the summon/join + the constitution-gate escalation, in the F# DU canon
   (and the cross-language ballot per 081KSV2WD0008QG0R00051XS0N).
3. **Implement** against the existing keystone (`agentic-organization/packages/application/src/observe.ts` +
   `src/Core.TypeScript/workflow-engine/agent-loop/`) without forking it; wire compiler-summons (081KSV2WD0008QG0R00051XS0N 4-compiler ballot) +
   LLM-summons (self-recursive observe) as first-class.
4. **DST/replay** the whole summon tree (deterministic-rule + constitution gate bound the recursion).

## Pre-start checklist (per backlog-item-start-gate)

- **Claim:** `bun tools/bus/claim.ts acquire --from otto-cli --item 081KSXN940008QG0R002B89QZ1` -> claimed
  (4e3c2a88..., 2026-05-31).
- **Prior-art search (2026-05-31):** the substrate to compose already exists -- 081KSV2WD0008QG0R00051XS0N (summonable
  BFT / compilers-don't-lie / tri-boolean), 081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R002GRX85J (multi-oracle BFT), 081KSKBP80008QG0R0031DTHS9 (OPLE), 081KSKBP80008QG0R000B3Y19A.5
  (agent-loop DU canon), the agentic-organization observe.ts keystone + ≥3-agent constitution gate,
  the 2026-05-31 observe->act ADR (incl. the self-recursive observe addition). No existing row makes
  observe + BFT-summons *first-class on the workflow DU itself* -- that is this row's gap. The
  research doc performed the design-space inventory.
- **Dependency check:** the cleanest shape (OPLE-algebra) depends on 081KSKBP80008QG0R0031DTHS9 (OPLE, open); the
  compiler-summon depends on 081KSV2WD0008QG0R00051XS0N (in progress); the constitution gate exists. Research can proceed
  now; implementation gates on the design pick + 081KSKBP80008QG0R0031DTHS9/081KSV2WD0008QG0R00051XS0N maturing.

## Why P2

Core-architecture research that the agent-loop / observe.ts keystone builds on, but research-stage
(needs the clean-abstraction design pick before implementation) and dependent on 081KSKBP80008QG0R0031DTHS9/081KSV2WD0008QG0R00051XS0N. Raise
to P1 when the design is ratified + the observe.ts wiring becomes the bottleneck.
