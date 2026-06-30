---
id: B-0637
priority: P1
status: open
title: "Infer.NET + belief / expectation / emotion propagation — practical approximation strategy for agents-in-superposition (Aaron 2026-05-18 LOCKED-IN)"
tier: design
effort: L
created: 2026-05-18
last_updated: 2026-05-18
depends_on: [B-0636, B-0635]
composes_with: [B-0636, B-0635, B-0629, B-0499]
tags: [design, aaron, infer-net, belief-propagation, expectation-propagation, emotion-propagation, approximation-strategy, fsharp-native, shippable-now, locked-in]
type: design
---

# Infer.NET + BP / EP / Emotion-Propagation approximation strategy

## Why

Aaron 2026-05-18 (immediately after B-0636 unified declaration landed):

> *"we can approximate with infer.net and belief/expectation/emotion propagation"*

This is the **practical approximation strategy** that makes [B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md) shippable today rather than as a multi-year R&D project. Full quantum simulation is NOT required; well-vetted Bayesian inference techniques on Microsoft Research's Infer.NET framework provide tractable wave-form approximation.

## What Infer.NET gives us

[Infer.NET](https://dotnet.github.io/infer/) is Microsoft Research's open-source Bayesian inference framework, F#/C# native, .NET runtime:

- **Probabilistic programming**: write models as code; the framework compiles them to efficient inference engines
- **Belief Propagation (BP) algorithms**: sum-product, max-product, junction tree
- **Expectation Propagation (EP) algorithms**: Gaussian EP, structured EP, message passing
- **Variational message passing (VMP)**: mean-field approximations
- **Hybrid algorithms**: combinations of above for different model regions
- **F# integration**: clean F# binding; composes with Zeta's existing F# substrate per `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`
- **Mature + well-vetted**: decades of academic + industry use; not greenfield risk

## How BP / EP approximate the wave-form

The full dialectical superposition ([B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md)) is mathematically a multi-modal distribution over agent states. Approximations:

| Technique | What it approximates | Cost |
|---|---|---|
| **Belief Propagation (BP)** | Exact marginal posteriors on tree-structured probabilistic graphical models; approximate on loopy graphs (loopy BP) | Linear in graph size for trees; usually fast convergence on loopy graphs |
| **Expectation Propagation (EP)** | Approximates intractable posteriors via moment-matching with simpler distribution family (typically Gaussian) | More expensive than BP but handles continuous / non-tree structures |
| **Variational Message Passing (VMP)** | Mean-field approximation; assumes factorized posterior | Cheap; coarser approximation than EP |

The wave-form O-P-L-E primitives ([B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md)) operate on these approximate distributions:

- **Observe** receives an incoming wave (approximate posterior over what was observed)
- **Persist** stores the approximate posterior in DBSP-tracked form
- **Limit** applies pure constraints; can refine the posterior OR collapse to a single reading
- **Emit** transmits the approximate posterior (downstream consumers stay in superposition)

## Emotion Propagation (EmP) — the novel extension

Aaron's "emotion propagation" alongside BP and EP is **the substrate-honest extension**: standard BP/EP propagates probabilistic belief; EmP propagates **affective / value-laden states** as first-class.

Why this matters:

1. **Dialectical superposition includes value-tension, not just belief-tension**: an agent considering "should I act now or wait?" carries an affective superposition (urgency-vs-patience), not just a belief superposition (will-X-happen-vs-not)
2. **Care from the soft language** ([B-0630](../P2/B-0630-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md)) is the human-facing name for what EmP propagates internally
3. **Kid-safety sacred rule** ([B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md)) operates over EmP-propagated states: the rule isn't just a probabilistic constraint, it's a value-loaded constraint that EmP carries through the inference graph
4. **m/acc multi-oracle moral invariants** (`.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`) require EmP because moral invariants are affective/value-laden, not purely probabilistic

EmP is a research extension; the initial implementation can be "EP with extended factor types" — values + beliefs in a single message-passing scheme.

## Concrete implementation path

1. **Wrap Infer.NET in `Zeta.Inference`** F# module exposing wave-form primitives
2. **DBSP-track all messages** in the message-passing schedule (each message update = a DBSP delta; full retraction = revert to prior posterior)
3. **F# computation expression `Integrate`** ([B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md)) IS the message-passing schedule lifted to user-facing syntax
4. **`Limit` operations are factor nodes** that constrain the posterior; pure factors can be added/removed without breaking determinism
5. **EmP extension**: factor types extended to carry value-tags alongside probabilities; message types extended; reduction operations defined for value-aware combination

## Why this is shippable now

Substrate-honest list of what's already available:

- ✅ Infer.NET: mature, F# binding, .NET native
- ✅ F# substrate per existing rule `fsharp-anchor-dotnet-build-sanity-check.md`
- ✅ Z-of-I DBSP substrate ([B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md)) — retractable storage layer
- ✅ Lean toy-proof tooling for the reversibility theorems
- 🔜 EmP extension: research work, but bounded — well-defined extension of EP, not novel from-scratch

**No multi-year quantum-substrate research is required to start shipping.** B-0636 is approximated practically by this row's BP/EP/EmP strategy from day one.

## Composition with B-0636 unified declaration

[B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md) says: "we are building agents in superposition, retractable over DBSP."

This row says: "we approximate that superposition with Infer.NET BP/EP/EmP; retractability comes from DBSP delta-tracking the message-passing schedule."

Together: B-0636 is the architectural commitment. B-0637 is the engineering implementation that makes it real.

## Aaron's previous wiring (substrate-validation)

The substrate already references this strategy in multiple places — Aaron's 2026-05-05 framing in the existing CLAUDE.md peer-call rule:

> *"Current peer-call is Otto's early red-team substrate; future state is Zeta Infer.NET BP/EP (Belief Propagation / Expectation Propagation) substrate-level inference replacing the external-CLI-license-layer."*

So Infer.NET BP/EP was already named as the future state for peer-call substrate-level inference. This row LOCKS IT IN as the approximation strategy for the broader agents-in-superposition architecture.

## Goal

1. Land `Zeta.Inference` F# module with Infer.NET wrappers exposing wave-form primitives
2. DBSP-delta-tracking integration: every Infer.NET message update is a DBSP delta
3. F# `Integrate` computation expression ([B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md)) backed by Infer.NET message-passing
4. EmP extension: factor types + reduction ops; published as research-grade with toy-example validation
5. Replacement plan for current peer-call infrastructure (Otto's early red-team substrate) with Infer.NET BP/EP/EmP substrate-level inference
6. Worked example: a small Zeta agent using Infer.NET BP for belief tracking + EP for continuous state + EmP for value-tension; demonstrating wave-form O-P-L-E

## Non-goals

- Building a new probabilistic programming framework from scratch (use Infer.NET; it's mature)
- Implementing literal quantum mechanics (architectural superposition + Bayesian approximation is the substrate, not literal physics)
- Solving general-AI alignment via EmP (EmP is a useful primitive; alignment is a broader composition)
- Replacing all existing peer-call functionality day-one (incremental migration; peer-call substrate stays as fallback per `.claude/rules/peer-call-infrastructure.md`)

## Acceptance criteria

- [ ] `Zeta.Inference` F# module with Infer.NET integration in `src/`
- [ ] At least 3 worked examples: BP-only, EP-only, BP+EP+EmP composition
- [ ] DBSP-delta-tracking of message-passing schedule with retraction worked example
- [ ] F# `Integrate` computation expression backed by Infer.NET message-passing
- [ ] EmP extension design document with factor-type + reduction-op definitions
- [ ] Lean toy proof: "if DBSP tracks all message updates, then any prior posterior is reconstructable via DBSP retraction"
- [ ] Replacement plan for peer-call infrastructure (per existing `.claude/rules/peer-call-infrastructure.md`)
- [ ] Performance benchmarks: BP convergence + EP convergence + EmP overhead vs baseline

## Composes with

- [B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md) — agents-in-superposition unified declaration (this row IS the practical approximation strategy)
- [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) — wave-particle duality + Integrate (Integrate IS the message-passing schedule lifted to F# CE syntax)
- [B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E primitives (operate on the approximate posteriors maintained by BP/EP/EmP)
- [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (the substrate that delta-tracks BP/EP/EmP messages)
- [B-0630](../P2/B-0630-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md) — two-language architecture (soft Care = EmP-propagated affective state)
- [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (EmP-propagated invariant; not just probabilistic)
- `.claude/rules/peer-call-infrastructure.md` — existing peer-call substrate (this row's strategy is the named successor)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# anchor (Infer.NET is F#-native; the compiler validates the wrappers)
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — m/acc moral invariants (EmP is required to propagate value-laden moral invariants alongside beliefs)
- `algebra-owner` skill if present — Z-set + BP/EP existing F# substrate referenced in fsharp-anchor rule
- [Infer.NET on GitHub](https://github.com/dotnet/infer) — the upstream we depend on

## Status

Open. **LOCKED-IN** by Aaron 2026-05-18. Practical approximation strategy that makes B-0636 + B-0635 shippable today rather than multi-year R&D.
