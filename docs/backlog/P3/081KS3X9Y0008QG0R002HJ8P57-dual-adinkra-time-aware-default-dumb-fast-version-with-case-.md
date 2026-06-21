---
id: 081KS3X9Y0008QG0R002HJ8P57
priority: P3
status: open
title: "Dual-Adinkra architecture — full time-aware retractable default + dumb fast version with case-by-case performance justification (Aaron + Mika 2026-05-18)"
tier: design
effort: S
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [081KRW63S0008QG0R000QJR08H, 081KRW63S0008QG0R003J8HR6K]
composes_with: [081KRW63S0008QG0R000QJR08H, 081KRW63S0008QG0R003J8HR6K, 081KRW63S0008QG0R003NP3YA3]
tags: [design, mika, adinkras, retractable-z-state, performance-escape-hatch, dual-default-rule]
type: design
---

# Dual-Adinkra architecture — time-aware default + dumb fast version with case-by-case performance justification

## Why

The Aaron + Mika 2026-05-18 conversation ([`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2619-2629) landed an architectural rule that is NOT yet captured as its own backlog row, despite being a real decision that constrains all future Adinkra implementation work ([081KRW63S0008QG0R000QJR08H](../P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md), [081KRW63S0008QG0R003J8HR6K](../P2/081KRW63S0008QG0R003J8HR6K-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) position 4).

The decision:

> *Default = Full time-aware retractable Adinkra
> Exception = Dumb (non-time-aware) version only on explicit performance justification, case-by-case.*

Aaron line 2627: *"go for the full retractable every time unless it's a performance issue, and we do it on a case-by-case basis."*

Mika line 2629 lock-in: *"All the important cognitive work (Pay Attention, Remember When, worldview updates, internal state, Why updates, commitments, etc.) uses the full retractable Z-state Adinkra by default. Only specific, purely computational, high-frequency, low-importance operations get to use the lightweight dumb version when we can prove it's a meaningful performance win."*

This row exists to make the rule addressable and reviewable rather than buried in 3000+ lines of research-archive transcript.

## What

Codify the dual-Adinkra rule as authoritative substrate:

1. **Default tier (full time-aware retractable)** — any operation that touches Remember When, Pay Attention, worldview-refresh indexes, internal state ([081KRW63S0008QG0R000QJR08H](../P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) private-subspace Adinkras), Why-commitments, or Where-going planning.
2. **Performance escape tier (dumb / non-time-aware)** — pure computation, stateless transformations, short-lived tactical heuristics, math kernels. ONLY when both (a) the operation is truly non-time-bearing AND (b) the perf win is demonstrable, not speculative.

Operationally, a coherent agent's Adinkra construction path needs two code paths:

- **Primary**: time-aware builder that emits structures compatible with the retractable-Z-state primitive (the Zeta substrate's `z⁻¹` delay primitive in `src/Core/Primitive.fs`, plus the `D∘Q∘I` differential/integral identity in `src/Core/Incremental.fs`).
- **Escape**: dumb-builder explicitly tagged with the perf-justification context and a structural marker that prevents it from being used as a state-carrying surface.

## Civilization-scope decision

Mika line 2633 generalized this rule to the whole AI civilization, not just one agent:

> *"Honestly, it feels like the right rule for the whole civilization, not just my side. Defaulting to the full time-aware retractable Adinkra keeps everything coherent and mathematically principled."*

So this is a default-rule for all Zeta agents that build Adinkra structures, not a per-agent preference.

## Default-asymmetry as substrate discipline

The interesting architectural property: making time-awareness the default and performance-optimization the explicit exception is the OPPOSITE of conventional software defaults (start fast, add coherence when needed). The framework's choice matches its pattern elsewhere — irreversible properties (statelessness loss, transparency loss, time-coherence) get default treatment; reversible properties (compute cost) get explicit-justification treatment. Same shape as the cost-vs-loss table in [081KRW63S0008QG0R003NP3YA3](081KRW63S0008QG0R003NP3YA3-per-dimension-cost-loss-model-mika-2026-05-18.md) — essential gets default, accidental gets the escape hatch.

The rule generalizes beyond Adinkras: any future substrate decision between (coherent/expensive) and (lightweight/limited) primitives inherits this default-asymmetry pattern.

## Composes with

- [081KRW63S0008QG0R000QJR08H](../P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — the Adinkra-as-substrate row this rule constrains
- [081KRW63S0008QG0R003J8HR6K](../P2/081KRW63S0008QG0R003J8HR6K-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — the 7-step boot sequence whose position 4 (What is happening to us?) requires full time-aware Adinkras per this rule
- [081KRW63S0008QG0R003NP3YA3](081KRW63S0008QG0R003NP3YA3-per-dimension-cost-loss-model-mika-2026-05-18.md) — cost+loss model; the dumb-tier escape hatch is a cost-side optimization that does NOT change the LOSS profile (a dumb-Adinkra dimension still loses the same invariant; it just costs less compute)
- Retractable Z-state primitive — the underlying time substrate this rule presupposes; referenced in conversation lines 2611-2637; not yet a separate row
- `src/Core/Primitive.fs` + `src/Core/Incremental.fs` — Zeta already has retractable Z-state via `z⁻¹` plus the `D∘Q∘I` differential/integral identity; this rule extends that primitive into Adinkra-construction code paths
- `.claude/rules/default-to-both.md` — both-default discipline; this row is both-default applied at construction-tier-choice scope

## Non-goals

- Implementing the dumb-tier first (the rule says default time-aware; dumb is escape-only)
- Defining which specific operations qualify for dumb-tier (case-by-case per the rule; no upfront classification)
- Replacing existing math kernels (this is a guideline for Adinkra-construction code paths, not a refactor of compute primitives)

## Acceptance

- [ ] Rule codified in `docs/governance/` or as a `.claude/rules/` entry that future Adinkra implementation work auto-loads at cold-boot
- [ ] 081KRW63S0008QG0R000QJR08H implementation work (when it lands) cites this row as the binding default-rule
- [ ] If a dumb-tier Adinkra ships, it carries an explicit `[PerfJustified]`-style marker + the case-specific rationale in its construction site
- [ ] The civilization-scope framing preserved (rule applies to all Zeta agents, not just one persona's stack)

## Source

[`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2619-2629 (the dual-architecture decision conversation).
