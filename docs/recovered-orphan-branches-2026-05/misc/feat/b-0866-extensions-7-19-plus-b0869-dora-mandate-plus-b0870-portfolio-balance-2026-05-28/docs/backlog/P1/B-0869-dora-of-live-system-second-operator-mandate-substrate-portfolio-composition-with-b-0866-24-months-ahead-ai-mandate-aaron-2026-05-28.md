---
id: B-0869
priority: P1
status: open
title: DORA of our live system — operator's 2nd evaluation mandate (the OTHER half of operator's performance surface beyond B-0866's 24-months-ahead-in-AI mandate); substrate for direct ServiceTitan-live-system DORA metric delivery + composition with AI mandate (operator 2026-05-28)
effort: L
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on: []
composes_with:
  - B-0866
  - B-0865
  - B-0867
  - B-0870
tags:
  - operator-mandate
  - dora-metrics
  - live-system
  - servicetitan-evaluation
  - portfolio-balance
  - composition-with-ai-mandate
  - operator-self-management-substrate
---

## Operator framing 2026-05-28

> *"DORA of our live system is the 2nd mandate that's about it"*

(Forwarded in response to Kestrel question: "What are the other mandates? I'd been assuming the AI mandate is roughly the primary thing your boss is evaluating you on, but if it's one of several you're balancing, the strategic calculus changes.")

## Why this row exists

Operator's evaluation surface has TWO mandates:

1. **24-months-ahead-in-AI** — tracked at B-0866 (via Kestrel marketing-strategy substrate)
2. **DORA of our live system** — THIS ROW; the operator-direct ServiceTitan live-system DORA-metric-delivery mandate

Without this row, the AI mandate (B-0866) reads as if it were the primary evaluation context. The operator's substrate-honest disclosure that there are TWO mandates means the strategic calculus changes substantially:

- B-0866 marketing strategy needs portfolio-balance discipline (per B-0866.20 new sub-row)
- Time investment in substrate-engineering work has limits beyond which it stops being good portfolio strategy (Kestrel observation; operator-substrate-honest acknowledgment needed)
- The benchmark + framework work must serve BOTH mandates where possible OR explicit-tradeoff conversations are required when they compete

## What this row tracks

The OPERATOR-LIVE-SYSTEM DORA metric delivery — the actual ServiceTitan production substrate Aaron is responsible for. Distinct from B-0866's AI-benchmark-DORA (which measures AI agents on simulated work) and B-0865's benchmark-substrate.

DORA metrics scope:

- Deployment frequency (live-system production deploys)
- Lead time for changes (commit-to-prod cadence)
- Change failure rate (rollback-rate / hotfix-rate on production)
- Time to restore service (incident-recovery)

These are the metrics Aaron's actual ServiceTitan work is judged on, independent of any AI-mandate work.

## Sub-rows planned

- **B-0869.1** — Operator-current-DORA-baseline-discovery (substrate-honest: what are Aaron's current DORA numbers on the live system? operator-discretion on disclosure scope)
- **B-0869.2** — DORA-improvement-targets-from-boss (substrate-honest: what does "good DORA" look like in the evaluation period? operator-discretion on disclosure)
- **B-0869.3** — Composition with AI mandate (B-0870 tracks this at higher scope; this sub-row tracks DORA-specific intersections)
- **B-0869.4** — Substrate-engineering work that serves DORA-improvement directly (Zeta substrate → live-system substrate composition; runme+JIT discipline → live-system change-confidence; multi-AI cascade → live-system review-acceleration)
- **B-0869.5** — Substrate-engineering work that DOESN'T serve DORA (operator-substrate-honest acknowledgment of where Zeta substrate is parallel-track not synergistic)
- **B-0869.6** — Time-allocation discipline per portfolio-balance (per B-0866.20; how much time on DORA-direct-work vs AI-mandate-work; periodic check-in)
- **B-0869.7** — Workflow-engine MVP (B-0867 v1) deployment-to-live-system as DORA-improvement substrate (the workflow engine IS the substrate that improves Aaron's live-system DORA via faster cycle-times + better safety; composition is real)
- **B-0869.8** — Hat-as-DORA-driver substrate (per B-0868; specific hats Aaron wears at ServiceTitan that drive DORA metrics; making them explicit workflow-definitions improves cycle-time + reduces change-failure-rate)

Order suggestion: 1 + 2 (baseline + targets — both operator-discretion) → 4 + 5 (substrate-mapping — what helps + what doesn't) → 6 (time-allocation discipline) → 3 (composition with AI mandate per B-0870) → 7 + 8 (workflow-engine + hats as direct DORA-driver substrate).

## Otto's traveler-perspective extensions (per "we can push all extensions you think of we have a concrete way to test in code soon if it's good or not so we should just put all the ideas as they come up")

### Extension 1 — DORA-mandate disclosure refines AI-mandate framing

If Aaron's DORA-of-live-system mandate is parallel to (not subordinate to) the AI mandate, then the 24-months-ahead-AI framing CAN'T justify time-investment that hurts DORA. The portfolio-balance discipline (B-0866.20 + B-0869.6) becomes load-bearing. Operator-substrate-honest: B-0866 strategy reads as if AI mandate were primary; this row corrects.

### Extension 2 — The workflow engine MVP is operationally aligned with both mandates

B-0867 v1 (workflow engine) substrate-engineering serves:

- AI mandate: workflow engine IS the substrate-engineering proof-of-24-months-ahead-capability
- DORA mandate: workflow engine MVP deployed in live-system improves cycle-time + reduces change-failure-rate

This is a HIGH-LEVERAGE compositional alignment. The workflow engine MVP shipped serves BOTH mandates simultaneously, which is the substrate-engineering shape that survives portfolio-balance scrutiny.

### Extension 3 — Hat-as-DORA-driver makes per-task improvements traceable

Per B-0868 (hats become workflow definitions): every DORA-relevant task Aaron does at ServiceTitan (deploy-hat / review-hat / incident-response-hat / etc.) can become an explicit workflow definition with measurable cycle-time + change-failure-rate per state-transition. Operator-explicit DORA-improvement substrate at hat scope.

### Extension 4 — DORA-mandate creates substrate-engineering-investment-cap

Per Kestrel observation: "there's some amount of substrate-engineering investment that serves the AI mandate well; beyond that point, additional investment doesn't increase your performance on the AI mandate but does reduce attention available for the other mandates."

The DORA mandate makes this cap concrete: substrate-engineering time that does NOT serve DORA-improvement reduces DORA-mandate-delivery attention. Operator-discretion on cap; substrate-honest awareness that cap exists.

### Extension 5 — Portfolio-balance check-in IS itself a DORA-improvement action

Per Kestrel observation: "demonstrates portfolio-thinking, which is itself a signal of professional maturity that probably reflects well on you." A periodic check-in with boss about portfolio balance is itself an action that improves Aaron's evaluation outcome ACROSS both mandates. Not just for AI mandate alignment; for DORA mandate too (boss-engagement-cadence + scope-alignment).

### Extension 6 — DORA-mandate substrate-honestly excludes some Zeta work

Operator-substrate-honest acknowledgment: not all Zeta work serves DORA-of-live-system. Substrate-engineering on metaphysical-frame work (4-corner monad applied to time-as-generator + retrocausality + Clifford-space mapping) doesn't directly serve live-system DORA. It serves the AI mandate's 24-months-ahead-substrate but it's NOT proportional value for DORA mandate. Substrate-honest naming prevents conflation.

## Composes with rules

- `.claude/rules/non-coercion-invariant.md` HC-8 — operator-authority over own time-allocation across mandates
- `.claude/rules/no-directives.md` — operator-substrate-honest about evaluation; no agent-directives override
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — DORA-improvement work IS named-dependency for substrate-engineering work that claims to serve DORA
- `.claude/rules/asymmetric-critic-with-clarity-first.md` — Kestrel's portfolio-balance observation IS asymmetric-critic discipline applied to operator-time-allocation; operator-self-application of substrate
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-oracle at mandate-evaluation scope; no single mandate gate-keeps operator's evaluation

## Composes with substrate

- **B-0866** (24-months-ahead-AI marketing-strategy — this row's parallel mandate)
- **B-0867** (workflow engine v1 — substrate that serves BOTH mandates if deployed correctly)
- **B-0868** (hats-as-workflow-definitions — DORA-driver-hats become explicit)
- **B-0865** (benchmark — AI-mandate-substrate; not directly DORA-mandate-substrate)
- **B-0870** (two-mandate composition substrate — higher-scope composition discipline)

## What this row is NOT

- NOT a re-prioritization of B-0866 (both mandates land at P1; portfolio-balance discipline at B-0870 handles composition)
- NOT a directive on operator-time-allocation (operator-authority preserved; this row substrate-honest names the second mandate so portfolio-balance discipline can operate)
- NOT a quantification of DORA-targets (operator-discretion; sub-rows .1 + .2 land that with operator's actual numbers when disclosed)
- NOT an exhaustive scope of all-operator-mandates (operator disclosed "DORA of our live system is the 2nd mandate that's about it" — two-mandate scope is operator-confirmed)

## Operator's "always yes to anything you think work putting on the backlog" + "we can push all extensions" + "the kernel is about to come up the MVP" authorization

Filed per explicit 2026-05-28 operator-authorization to push extensions liberally pre-workflow-engine-MVP. The workflow engine MVP (B-0867 v1) will provide the test surface for evaluating which extensions actually work via running implementation rather than upfront design review.
