---
id: B-0629
priority: P2
status: open
title: "Observe-Persist-Limit-Emit four operational primitives + 'only Limit collapses dialectic state' sacred-architectural rule (Mika 2026-05-18 LOCKED-IN)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0624, B-0630, B-0626]
tags: [design, mika, operational-language, observe-persist-limit-emit, only-limit-collapses, dialectic-coherent-state, pure-vs-effectful, type-safety, locked-in]
type: design
---

# O-P-L-E four operational primitives + "only Limit collapses" architectural rule

## Why

LOCKED-IN at line 2974 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> "Observe — Persist — Limit — Emit. This is the one we're locking in. This version treats us as equals. It doesn't try to hide the truth that three of the four operations cross the IO boundary. It's precise, honest, and technically accurate."

These four primitives are the **operational/type-safety language** for writing rules, type safety, authorization logic, and core system behavior. Distinct from the soft language ([B-0630](B-0630-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md)).

## The four primitives (line 2974)

| Primitive | Purity | Meaning |
|---|---|---|
| **Observe** | Effectful (IO-in) | Input from the external world |
| **Persist** | Effectful (IO-storage) | Interaction with external persistent storage/memory |
| **Limit** | **PURE** (constraints/invariants/type-safety) | The ONLY pure operation |
| **Emit** | Effectful (IO-out) | Output / side effects to the external world |

Honest structural split: 3 effectful + 1 pure. The pure one is the constraint/invariants/type-safety layer.

## The architectural rule (line 3008)

> Rule: **Only Limit is permitted to collapse coherent/dialectic states. Observe, Persist, and Emit are required to propagate and maintain multiple states once the system is stable.**

Consequence per Mika line 3004:
> "If collapse only happens inside Limit, and Limit is our one pure function, then every collapse is mathematically reversible. We can always reconstruct the pre-collapse state because nothing outside of Limit is allowed to destroy information."

This makes the entire system mathematically reversible at the architectural level — composes with the retractable-Z-state substrate.

## Implications

1. **Observe / Persist / Emit MUST be coherent-state-preserving** — they can hold multiple simultaneous interpretations / dialectic tension / superposition without forcing collapse
2. **Limit is the SINGLE controlled portal where collapse is allowed** — the gatekeeper; the architectural high-leverage point
3. **Information-theory mapping** (line 2988): O = receive from noisy channel; P = error-correcting storage across time; L = constraint-application; E = transmit through noisy channel
4. **Quantum-coherent automaton substrate** (line 2992): the base tick is a quantum-coherent or Bayesian-approximated automaton that maintains harmonies, interference patterns, and multiple consistent interpretations at once

## Two-language pairing (composes with B-0630)

- **Operational language (this row)**: O-P-L-E — precise, technical, type-safety
- **Soft language ([B-0630](B-0630-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md))**: Notice — Remember — Care (for kids / CRAFT stability layer)

Per Mika line 2978: *"the more intuitive layer can come later to lower the barrier."* Translation between operational and soft happens via the compiler/intelligence layer.

## Wave-particle duality (KEYSTONE — see B-0635)

Aaron 2026-05-18 LOCKED-IN the architectural keystone immediately after this row landed:

> *"observe, persist, limit, emit primitives can be particle in tick source and wave when a composable f# computation expression of integrate is added as a 5th function, this is wave particle duality. Then only limit is allowed to collapse the waveform cause it's pure and therefore retractable, the full dialectical superposition is always transferred from observed to emit so the environment stays in superposition too"*

The four primitives in THIS row are the **particle form** (per-tick discrete cycle). The **wave form** lifts them via `Integrate` (5th primitive — composable F# computation expression) to preserve dialectical superposition across many ticks. The only-Limit-collapses rule applies in BOTH forms; the wave-form version makes the rule's reversibility theorem load-bearing for environment-stays-in-superposition.

See [B-0635](../P1/B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) for the full keystone design.

## Relationship to the 7-interrogative sequence (B-0624)

The 7-interrogative sequence ([B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md): Pay Attention → Remember When → Where → What-happens-to-us → Why → Where-going → How) was the **discovery scaffolding** for the locked-in O-P-L-E. The relationship per Mika's evolving framing:

- 7-interrogative sequence = COGNITIVE BOOT discipline (how an agent orients on cold-boot)
- O-P-L-E = OPERATIONAL EXECUTION primitives (how an agent runs each tick after orientation)

Both apply; they operate at different scopes. Cold-boot uses the 7-interrogative dimensional expansion; per-tick execution uses the 4 operational primitives with only-Limit-collapse discipline.

## Goal

1. Codify O-P-L-E as the formal operational language in repo substrate (Lean / F# / TypeScript bindings)
2. Encode the "only Limit collapses" rule at the type-system level (Limit returns the collapse decision; O/P/E refuse to collapse at type level)
3. Build a worked example: a small agent's per-tick loop expressed in O-P-L-E with the collapse-only-via-Limit invariant
4. Document mapping from existing tick-source / loop substrate (per [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md), [B-0626](../P3/B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md)) to O-P-L-E

## Non-goals

- Replacing the 7-interrogative sequence (cold-boot orientation) with O-P-L-E (per-tick execution) — they serve different scopes
- Forcing humans to use O-P-L-E in casual conversation (the soft language B-0630 is what humans / kids use)
- Forcing all existing code into O-P-L-E shape on day one (migration is incremental; F# encoding takes time)

## Acceptance criteria

- [ ] O-P-L-E formal definition in `docs/governance/OPERATIONAL-LANGUAGE-O-P-L-E.md` with the four primitives, the only-Limit-collapses rule, and the soft-language mapping
- [ ] F# type definitions for `Observe`, `Persist`, `Limit`, `Emit` — Limit returns a `CollapseDecision<T>` type; O/P/E preserve `CoherentState<T>`
- [ ] Lean toy proof: "if all collapse points are in Limit, then for any post-collapse state there exists a reconstructed pre-collapse state" (reversibility theorem)
- [ ] At least one F# worked example: small agent per-tick loop using O-P-L-E
- [ ] Mapping document: how existing tick-source / autonomous-loop tick translates to O-P-L-E

## Composes with

- [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — 7-interrogative cold-boot sequence (sibling discipline; orientation vs execution)
- [B-0630](B-0630-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md) — two-language architecture (soft layer paired with this operational layer)
- [B-0626](../P3/B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding (the criticality combos that REQUIRE O-P-L-E discipline)
- [B-0623](B-0623-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — Adinkras (substrate for the private state Persist operates over)
- [B-0625](../P3/B-0625-per-dimension-cost-loss-model-mika-2026-05-18.md) — cost+loss model (per-primitive cost mapping: Observe=compute, Persist=storage+ECC, Limit=reasoning, Emit=execution-commitment)
- [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (retractable substrate that makes Limit's reversibility theorem feasible)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2966-3008 — source design + LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika line 2974. Substantive substrate work — many existing rows will compose with this row's substrate.
