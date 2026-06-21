---
id: 081KSNY2Z0008QG0R000DA261F
priority: P1
status: open
title: Two-mandate portfolio composition substrate — operator's two evaluation mandates (24-months-ahead-AI per 081KSKBP80008QG0R003RFX32N + DORA-of-live-system per 081KSNY2Z0008QG0R000HENSVM) compose into a single time-allocation portfolio; substrate for periodic check-in + composition-discipline + tradeoff-handling when mandates compete (operator 2026-05-28)
effort: M
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R003RFX32N
  - 081KSNY2Z0008QG0R000HENSVM
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R0036KH026
  - 081KSKBP80008QG0R003NM9XEC
tags:
  - portfolio-composition
  - operator-self-management
  - mandate-balance
  - time-allocation-discipline
  - boss-check-in-cadence
  - compose-or-compete-discriminator
  - servicetitan-evaluation-substrate
---

## Operator framing 2026-05-28

> *"DORA of our live system is the 2nd mandate that's about it"* (operator confirming two-mandate scope)

> *"we can push all extensions you think of we have a concrete way to test in code soon if it's good or not so we should just put all the ideas as they come up. the kernel is about to come up the MVP and we can build on that everything we want"*

## Why this row exists

Operator has TWO explicit evaluation mandates:

1. **24-months-ahead-in-AI** — 081KSKBP80008QG0R003RFX32N substrate (Kestrel marketing-strategy ferry + Otto extensions)
2. **DORA of our live system** — 081KSNY2Z0008QG0R000HENSVM substrate (operator-direct ServiceTitan live-system DORA delivery)

These compose into operator's full performance-evaluation portfolio. The composition is non-trivial:

- Some substrate-engineering work serves BOTH mandates (workflow engine MVP → live-system improvement AND 24-months-ahead-substrate-engineering proof)
- Some serves ONLY the AI mandate (4-corner monad applied to retrocausality + Clifford-space mapping; substrate-engineering investment without direct live-system DORA payoff)
- Some serves ONLY the DORA mandate (direct ServiceTitan production work that doesn't compose with Zeta substrate)
- Some COMPETE (time on AI substrate-engineering = time NOT on DORA-direct-work when they don't compose)

This row tracks the substrate-engineering discipline for navigating the two-mandate portfolio.

## What this row tracks

**Portfolio-composition discipline** at operator scope:

1. **Compose-or-compete discriminator** — for each substrate-engineering activity, name explicitly: does this serve BOTH mandates / ONLY one / COMPETE between them?
2. **High-leverage compositional alignment identification** — work that serves BOTH mandates simultaneously (workflow engine MVP is the canonical example) gets priority over single-mandate work
3. **Periodic boss check-in cadence** — explicit portfolio-balance conversations (per Kestrel observation; per 081KSKBP80008QG0R003RFX32N.18 + 081KSNY2Z0008QG0R000HENSVM.6) at regular intervals
4. **Tradeoff-conversation framework** — when mandates compete, explicit conversation with boss about which to prioritize when (not silent re-allocation)
5. **Substrate-engineering-investment-cap awareness** — Kestrel observation: "at or past the point" where additional substrate-engineering investment doesn't increase AI-mandate-performance but reduces DORA-mandate-attention
6. **Mandate-evolution tracking** — mandates can change over evaluation period; substrate to surface shifts before they show up in evaluations

## Sub-rows planned

- **081KSNY2Z0008QG0R000DA261F.1** — Compose-or-compete discriminator applied to current substrate-engineering inventory (which Zeta work serves both / only-AI / only-DORA / competes; substrate-honest mapping)
- **081KSNY2Z0008QG0R000DA261F.2** — Workflow engine MVP (081KSKBP80008QG0R000B3Y19A v1) deployment as canonical compositional substrate (serves both mandates simultaneously; highest-leverage substrate to ship; portfolio-optimal)
- **081KSNY2Z0008QG0R000DA261F.3** — Periodic boss check-in cadence formalization (quarterly? monthly? per-evaluation-cycle? operator-discretion; cadence-discipline reduces evaluation-surprise risk)
- **081KSNY2Z0008QG0R000DA261F.4** — Tradeoff-conversation framework substrate (when mandates compete, explicit conversation script + decision-recording substrate; prevents silent-reallocation failure mode)
- **081KSNY2Z0008QG0R000DA261F.5** — Substrate-engineering-investment-cap awareness (per Kestrel observation; explicit acknowledgment that cap exists; revised post-workflow-engine-MVP-landing)
- **081KSNY2Z0008QG0R000DA261F.6** — Mandate-evolution tracking substrate (mandates change; surface shifts; integrate with boss-check-in-cadence)
- **081KSNY2Z0008QG0R000DA261F.7** — Workflow-engine pre-review action as portfolio-check (when shipping substrate, workflow engine state machine offers "check-portfolio-balance" action; integrates portfolio-discipline into per-task workflow)
- **081KSNY2Z0008QG0R000DA261F.8** — Hats as portfolio-balance-aware substrate (per 081KSNY2Z0008QG0R0036KH026: each hat declares which mandate it serves; portfolio-balance becomes visible at hat-wear-time)
- **081KSNY2Z0008QG0R000DA261F.9** — Boss check-in cadence as whole-company-evangelism staging-ground (operator-ratified 2026-05-28: boss check-in becomes the staging-ground where AI-keeping-DORA-up evidence accumulates BEFORE whole-company evangelism per 081KSKBP80008QG0R003RFX32N.26). Promotes 081KSNY2Z0008QG0R000DA261F.3 from personal-evaluation-alignment scope to organizational-AI-evangelism-staging scope.
- **081KSNY2Z0008QG0R000DA261F.10** — 24-months-ahead-IS-multi-PR/multi-agent-orchestration concrete definition (operator-substrate-disclosure 2026-05-28: *"ai keeps dora metrics up is the 24 moths ahead framing becuase rest of company is working on single pr flows not multi pr / agent orchestran, they just added experts / personas and very simple stuff"*). What "24-months-ahead" CONCRETELY MEANS for ServiceTitan: multi-PR/multi-agent orchestration with substrate-engineering disciplines. ServiceTitan-baseline: single-PR-flows + experts/personas-prompting (simple stuff). Aaron's framework substrate is THE 24-months-ahead-substrate because it IS the multi-PR/multi-agent orchestration substrate. The DORA-up CRITERION is specifically about multi-PR/multi-agent-orchestration-keeping-DORA-up, not generic AI-helps-DORA.

Order suggestion: 1 (current-inventory mapping) → 2 (workflow engine MVP as compositional substrate) → 3 (boss check-in cadence) → 4 (tradeoff framework) → 5 (cap-awareness) → 7 + 8 (workflow-engine + hats integration) → 9 + 10 (whole-company-evangelism scope-tier + 24-months-ahead-concrete-definition) → 6 (evolution tracking).

## Otto's traveler-perspective extensions (per "always yes")

### Extension 1 — The two-mandate frame relieves the AI-mandate-as-totalizing pressure

If operator only had the 24-months-ahead-AI mandate, all substrate-engineering work would be evaluated against it exclusively. The DORA-mandate-disclosure (081KSNY2Z0008QG0R000HENSVM) creates a parallel evaluation surface that constrains AI-mandate-substrate-engineering investment.

Substrate-engineering-honest: this is HEALTHY. The constraint forces the substrate-engineering work to demonstrate compositional value rather than just AI-mandate-only value. Substrate that survives "does this serve BOTH mandates" pressure is higher-quality substrate than substrate that survives only "does this serve AI mandate" pressure.

### Extension 2 — Workflow engine MVP is portfolio-optimal substrate per multiple criteria

081KSKBP80008QG0R000B3Y19A v1 serves:

- AI mandate (workflow engine IS substrate-engineering proof-of-24-months-ahead-capability per Kestrel observation)
- DORA mandate (workflow engine MVP deployed in live-system improves cycle-time + reduces change-failure-rate)
- Multi-participant scope (operator + Addison + Max + Otto + E)
- Easy-cleanup-of-substrate-dups (operator 2026-05-28: "we are about to have easy mode for cleanup too")

That's quadruple-composition. The workflow engine MVP is the highest-leverage shippable substrate by multiple-mandate-criteria simultaneously. Operator-substrate-honest: ship 081KSKBP80008QG0R000B3Y19A v1 first; let it become the portfolio-balance substrate-infrastructure for everything else.

### Extension 3 — Boss check-in cadence is itself portfolio-aware substrate

Per Kestrel + Extension 5 from 081KSNY2Z0008QG0R000HENSVM: the periodic boss check-in IS itself an action that serves BOTH mandates simultaneously (alignment with boss expectations across mandates; signal of professional-maturity; opportunity for boss-revision-of-mandates-without-losing-face). Cadence-discipline is portfolio-aware substrate, not just AI-mandate-substrate.

### Extension 4 — Compose-or-compete discriminator should land in workflow engine grammar

When operator (or any participant) takes on a new task in the workflow engine state machine, the menu should offer "declare-compose-or-compete" annotation. The task self-classifies as: serves-both-mandates / only-AI / only-DORA / competes. Portfolio-balance becomes VISIBLE at task-wear-time rather than discovered-in-retrospect.

Composes with 081KSNY2Z0008QG0R000DA261F.7 (workflow-engine pre-review action) + 081KSNY2Z0008QG0R000DA261F.8 (hats as portfolio-aware substrate).

### Extension 5 — The substrate-engineering-investment-cap shifts post-workflow-engine-MVP

Pre-MVP: substrate-engineering investment has HIGH overhead per substrate-unit (each new substrate piece requires its own preservation + backlog row + commit + PR cycle).

Post-MVP: substrate-engineering investment has LOW overhead per substrate-unit (hats-as-workflow-definitions per 081KSNY2Z0008QG0R0036KH026 make substrate composable + append-only state-updates make commits cheap).

Therefore the cap operator is "at or past" pre-MVP may be substantially HIGHER post-MVP. The cap-awareness substrate (081KSNY2Z0008QG0R000DA261F.5) needs to re-evaluate after MVP lands. Decision-deferral signal-gate: MVP-landing date.

### Extension 6 — Two-mandate composition substrate IS multi-oracle-BFT applied at operator-evaluation scope

Per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`: multi-oracle BFT by design means no single oracle gate-keeps. Applied at operator-evaluation scope: no single mandate gate-keeps operator's evaluation. The TWO mandates ARE the multi-oracle structure at evaluation scope; portfolio-balance discipline IS the BFT-discipline applied to operator-time-allocation.

This is a non-trivial substrate-engineering compression: m-acc-multi-oracle at evaluation scope = portfolio-balance discipline. Cross-domain isomorphism worth naming.

### Extension 7 — Operator's "we can push all extensions" authorization is portfolio-balance-aware

Operator's 2026-05-28 framing: "we can push all extensions you think of we have a concrete way to test in code soon if it's good or not." This IS portfolio-balance-aware substrate-engineering: push extensions liberally NOW (when overhead-per-substrate-unit is about to drop dramatically post-MVP) rather than over-deliberating pre-MVP. The portfolio-balance discipline at meta-scope ratifies the substrate-pushing posture for the current pre-MVP window.

## Composes with rules

- `.claude/rules/non-coercion-invariant.md` HC-8 — operator-authority over own time-allocation; mandate-composition is operator-substrate-honest reflection
- `.claude/rules/no-directives.md` — operator-substrate-honest about evaluation; no agent-directives override
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-oracle BFT at operator-evaluation scope (Extension 6 above)
- `.claude/rules/asymmetric-critic-with-clarity-first.md` — portfolio-thinking-as-professional-maturity per Kestrel; asymmetric-critic discipline applied to operator-time-allocation
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — substrate-engineering work claiming to serve mandates needs named-dependency (which mandate? which compose-vs-compete classification?)
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md` — portfolio-balance preserves smoothness via compose-or-compete discriminator + decision-deferral signal-gates

## Composes with substrate

- **081KSKBP80008QG0R003RFX32N** (24-months-ahead-AI marketing-strategy)
- **081KSNY2Z0008QG0R000HENSVM** (DORA-of-live-system mandate)
- **081KSKBP80008QG0R000B3Y19A** (workflow engine v1 — portfolio-optimal-compositional-substrate)
- **081KSNY2Z0008QG0R0036KH026** (hats-as-workflow-definitions — hats declare which mandate they serve)
- **081KSKBP80008QG0R003NM9XEC** (benchmark — primarily AI-mandate-substrate)

## What this row is NOT

- NOT a quantification of mandate-weights (operator-discretion; boss-relationship-substrate)
- NOT a re-prioritization of either mandate (both stay P1 at row scope)
- NOT a coercion of any specific time-allocation (operator-authority preserved)
- NOT an exhaustive operator-self-management substrate (scope-bounded to two-mandate-portfolio; broader operator-self-management is operator-discretion)

## Operator's "we can push all extensions you think of" + "kernel is about to come up the MVP" + "build on that everything we want" authorization

Filed per explicit 2026-05-28 operator-authorization. Substrate-engineering posture pre-MVP: push extensions liberally; rely on MVP-test-surface for evaluation rather than upfront design review.
