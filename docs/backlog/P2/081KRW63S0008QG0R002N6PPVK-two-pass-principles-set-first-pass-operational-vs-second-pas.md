---
id: 081KRW63S0008QG0R002N6PPVK
priority: P2
status: open
title: "Two-pass principles set — first-pass operational (lock-free/wait-free/det-replayable-retractable/adversarial-review) + second-pass deferred (scale-free/self-similar) (Aaron + Mika 2026-05-18 LOCKED-IN substrate-honest)"
tier: governance
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [081KRW63S0008QG0R003TX8MG5, 081KRW63S0008QG0R001Z10PVV, 081KRW63S0008QG0R002ZRNDJ8, 081KRW63S0008QG0R0025E4PH6]
tags: [governance, aaron, mika, two-pass-principles, lock-free, wait-free, deterministic-replayable-retractable, adversarial-review, scale-free-deferred, self-similar-deferred, substrate-honest, locked-in]
type: governance
---

# Two-pass principles set — first-pass operational + second-pass deferred

## Why

Aaron + Mika 2026-05-18 (preserved verbatim at lines ~3700-3780 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md)) substrate-honestly carved a **two-pass principles set** for the Agora V6 substrate:

> Mika line ~3700: *"Let's officially lock in only what we've clearly agreed on tonight: [first-pass list]. Everything else (scale-free, self-similar, etc.) we park for now. We can come back to them later when we both have fresh context and have done the proper research."*

> Aaron's response: agreement to park scale-free/self-similar despite both being repeatedly referenced in prior factory substrate.

This row LOCKS IN the **first-pass operational principles** + records the **second-pass deferred concepts** with substrate-honest framing that the second-pass concepts are NOT load-bearing on day-one operations.

## The two-pass split

### First-pass (LOCKED IN operationally; used now)

| Principle | Status | Scope |
|---|---|---|
| **Lock-free required** | LOCKED-IN | All concurrency-sensitive paths |
| **Wait-free preferred (bounded waits acceptable)** | LOCKED-IN | All operations; default to wait-free; bounded waits OK when wait-free impractical |
| **Strong deterministic + replayable + retractable design** | LOCKED-IN | Especially Infer.NET + the 4 O-P-L-E primitives ([081KRW63S0008QG0R0015WHHG1](081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md)) |
| **Regular adversarial review on these invariants** | LOCKED-IN | Periodic stress-test of decisions against these principles; informal until formal-verification lands |

### Second-pass (DEFERRED; expensive, not for inference time)

| Principle | Status | Why deferred |
|---|---|---|
| **Scale-free** | PARKED | Mathematical property with very specific implications; neither Aaron nor Mika had it fully loaded in working memory; needs research before commit |
| **Self-similar** | PARKED | Heavy architectural claim; same reasoning |
| Any other heavy theoretical properties | PARKED | Substrate-honest: if it's not loaded enough to use right now, parking it prevents premature commitment |

## Substrate-honest framing (the move that distinguishes this row)

Aaron + Mika both admitted neither had scale-free / self-similar fully loaded in working context. Rather than rubber-stamping concepts they didn't deeply understand, they SUBSTRATE-HONESTLY parked them:

- Mika line ~3720: *"these concepts aren't fresh in our context either. So let's not rush to lock in scale-free, self-similar, or any of these other heavy terms when neither of us has them properly loaded."*
- Aaron's empirical anchor: *"If we're already moving fast and making solid progress while being fuzzy on those terms, it suggests they might not be as foundational as you initially thought. They might be nice-to-have second-pass refinements rather than core invariants we need right now."*

This is the substrate-engineering analogue of "**don't ship what you can't maintain**." The two-pass split lets the operational principles operate at full strength without dragging the unloaded theoretical concepts as cognitive overhead.

## Composition with prior factory substrate

Several existing `.claude/rules/` reference scale-free / lock-free / wait-free / weight-free without the substrate-honest two-pass framing:

| Existing rule | Two-pass alignment |
|---|---|
| `.claude/rules/dv2-data-split-discipline-activated.md` | Lists "scale-free" + "lock-free / wait-free" + "weight-free" + "DST" as "5 always-active disciplines" — this row refines: lock-free + wait-free + DST are FIRST-PASS; scale-free needs DEFERRED until properly loaded |
| Existing scale-free invocations across `memory/` | Refinements may apply — should be reviewed against this row's substrate-honest framing |
| `.claude/rules/bandwidth-served-falsifier.md` | Lock-free/wait-free/deterministic = bandwidth-engineering at concurrency layer; first-pass operational |

This row does NOT supersede the existing rules — it ADDS the two-pass framing so future-Otto can distinguish "operational principle used now" from "deferred concept parked for later loading."

## Operational discipline

When evaluating any substrate-engineering decision:

1. **Apply first-pass principles** as operational filters (lock-free / wait-free / det-replayable-retractable / adversarial-review)
2. **Do NOT invoke second-pass principles** in load-bearing reasoning until they've been deeply loaded + research-verified
3. **If second-pass concepts feel naturally needed**, that's a signal to load them properly (research + ratify) before committing
4. **Adversarial review cadence**: periodic stress-test of substrate decisions against the first-pass set — informal until formal-verification lands

## What about the existing scale-free references?

The existing factory substrate references to "scale-free" remain as historical record. They were authored at times when the concept was implicitly invoked without the substrate-honest "is this loaded?" check. Going forward:

- New substrate that uses "scale-free" as load-bearing reasoning should either (a) load + verify the concept first, or (b) substitute the operational first-pass principle that actually does the work
- Existing references can be left as-is; future audit pass (081KRW63S0008QG0R0025E4PH6 cross-substrate-triangulator) can sharpen them if/when scale-free is ratified

## Goal

1. Document the two-pass split in canonical governance doc: `docs/governance/TWO-PASS-PRINCIPLES.md`
2. Cross-link with existing rules referencing the first-pass concepts (DV2.0, fsharp-anchor, glass-halo, etc.)
3. Define the adversarial-review cadence (frequency, scope, owner)
4. Establish promotion criteria: what does it take for a second-pass concept to graduate to first-pass?
5. Knights Guild ratification per [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) Constitution-Class

## Non-goals

- Deprecating existing factory substrate that uses scale-free / self-similar (historical record preserved)
- Banning the concepts from future use (they remain available; just not load-bearing until research-loaded)
- Designing the formal adversarial-review tooling day-one (informal review is the start; formal verification per [081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) KSK + Lean toy proofs evolves over time)
- Forcing all existing code into lock-free shape day-one (these are operational PRINCIPLES; existing concurrency-sensitive code can migrate incrementally)

## Acceptance criteria

- [ ] Canonical governance doc: `docs/governance/TWO-PASS-PRINCIPLES.md`
- [ ] First-pass set documented with operational scope for each
- [ ] Second-pass set documented with "deferred until research-loaded" status
- [ ] Cross-reference with `.claude/rules/dv2-data-split-discipline-activated.md` (refine the "5 always-active" framing)
- [ ] Adversarial-review cadence specified (frequency + scope + owner)
- [ ] Promotion-to-first-pass criteria documented (what does scale-free need to do to graduate?)
- [ ] Knights Guild ratification per [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)

## Composes with

- [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild + Constitution-Class (first-pass principles belong in Constitution-Class)
- [081KRW63S0008QG0R0015WHHG1](081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E (det-replayable-retractable applies especially to these)
- [081KRW63S0008QG0R002ZRNDJ8](../P1/081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) — Limit-is-simulation (Limit's purity IS retractability via DBSP)
- [081KRW63S0008QG0R001Z10PVV](../P1/081KRW63S0008QG0R001Z10PVV-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md) — Agora V6 Constitution (operational principles compose with the V6 architecture)
- [081KRW63S0008QG0R0025E4PH6](../P1/081KRW63S0008QG0R0025E4PH6-cross-substrate-triangulation-first-class-skill-hat-aaron-2026-05-18.md) — cross-substrate triangulation (the discipline for evaluating second-pass concepts before promotion)
- [081KRW63S0008QG0R0004D5XG1](../P1/081KRW63S0008QG0R0004D5XG1-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md) — Infer.NET BP/EP/EmP (det-replayable mathematically-provable consistency = first-pass anchor)
- `.claude/rules/dv2-data-split-discipline-activated.md` — existing 5-always-active framing (refined by this row's two-pass split)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# compiler IS the formal adversarial-review at type level
- `.claude/rules/razor-discipline.md` — operational claims only; this row IS razor-discipline applied at principles-set scope
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines ~3700-3780 — source LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika 2026-05-18 (substrate-honest two-pass split). Refines the existing factory framing of "5 always-active disciplines" into "first-pass operational + second-pass deferred." Composes with all keystone substrate from today's cascade.
