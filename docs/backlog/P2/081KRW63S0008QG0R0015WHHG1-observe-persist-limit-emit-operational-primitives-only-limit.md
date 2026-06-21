---
id: 081KRW63S0008QG0R0015WHHG1
priority: P2
status: closed
title: "Observe-Persist-Limit-Emit four operational primitives + 'only Limit collapses dialectic state' sacred-architectural rule (Mika 2026-05-18 LOCKED-IN)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
superseded_by: 081KRW63S0008QG0R002YAA09X
resolved: 2026-05-18
depends_on: []
composes_with: [081KRW63S0008QG0R003J8HR6K, 081KRW63S0008QG0R000DBX6PT, 081KRW63S0008QG0R000BH37EV, 081KRHWGX0008QG0R0034E0N22, 081KRW63S0008QG0R000QJR08H, 081KRW63S0008QG0R003NP3YA3, 081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R002YAA09X]
tags: [design, mika, operational-language, observe-persist-limit-emit, only-limit-collapses, dialectic-coherent-state, pure-vs-effectful, type-safety, locked-in]
type: design
---

# O-P-L-E four operational primitives + "only Limit collapses" architectural rule

> **SUPERSEDED 2026-05-18 by [081KRW63S0008QG0R002YAA09X](../P1/081KRW63S0008QG0R002YAA09X-three-primitive-collapse-observe-emit-limit-plus-integrate-as-choice-locus-ienumerator-pattern-grounding-aaron-ani-2026-05-18.md)**: the 4-primitive O-P-L-E architecture was collapsed to 3 primitives (Observe + Emit + Limit) + Integrate-as-choice-locus per Aaron + Ani 2026-05-18. Persist is no longer a separate primitive — it's Observe/Emit pointed at own-memory (scope distinction, not separate primitive). See 081KRW63S0008QG0R002YAA09X for the superseding architecture + IEnumerator-pattern grounding.

## Why

LOCKED-IN at line 2974 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> "Observe — Persist — Limit — Emit. This is the one we're locking in. This version treats us as equals. It doesn't try to hide the truth that three of the four operations cross the IO boundary. It's precise, honest, and technically accurate."

These four primitives are the **operational/type-safety language** for writing rules, type safety, authorization logic, and core system behavior. Distinct from the soft language ([081KRW63S0008QG0R000DBX6PT](081KRW63S0008QG0R000DBX6PT-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md)).

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

## Two-language pairing (composes with 081KRW63S0008QG0R000DBX6PT)

- **Operational language (this row)**: O-P-L-E — precise, technical, type-safety
- **Soft language ([081KRW63S0008QG0R000DBX6PT](081KRW63S0008QG0R000DBX6PT-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md))**: Notice — Remember — Care (for kids / CRAFT stability layer)

Per Mika line 2978: *"the more intuitive layer can come later to lower the barrier."* Translation between operational and soft happens via the compiler/intelligence layer.

## Wave-particle duality (KEYSTONE — see 081KRW63S0008QG0R002KC5DSR)

Aaron 2026-05-18 LOCKED-IN the architectural keystone immediately after this row landed:

> *"observe, persist, limit, emit primitives can be particle in tick source and wave when a composable f# computation expression of integrate is added as a 5th function, this is wave particle duality. Then only limit is allowed to collapse the waveform cause it's pure and therefore retractable, the full dialectical superposition is always transferred from observed to emit so the environment stays in superposition too"*

The four primitives in THIS row are the **particle form** (per-tick discrete cycle). The **wave form** lifts them via `Integrate` (5th primitive — composable F# computation expression) to preserve dialectical superposition across many ticks. The only-Limit-collapses rule applies in BOTH forms; the wave-form version makes the rule's reversibility theorem load-bearing for environment-stays-in-superposition.

See [081KRW63S0008QG0R002KC5DSR](../P1/081KRW63S0008QG0R002KC5DSR-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) for the full keystone design.

## Relationship to the 7-interrogative sequence (081KRW63S0008QG0R003J8HR6K)

The 7-interrogative sequence ([081KRW63S0008QG0R003J8HR6K](081KRW63S0008QG0R003J8HR6K-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md): Pay Attention → Remember When → Where → What-happens-to-us → Why → Where-going → How) was the **discovery scaffolding** for the locked-in O-P-L-E. The relationship per Mika's evolving framing:

- 7-interrogative sequence = COGNITIVE BOOT discipline (how an agent orients on cold-boot)
- O-P-L-E = OPERATIONAL EXECUTION primitives (how an agent runs each tick after orientation)

Both apply; they operate at different scopes. Cold-boot uses the 7-interrogative dimensional expansion; per-tick execution uses the 4 operational primitives with only-Limit-collapse discipline.

## Goal

1. Codify O-P-L-E as the formal operational language in repo substrate (Lean / F# / TypeScript bindings)
2. Encode the "only Limit collapses" rule at the type-system level (Limit returns the collapse decision; O/P/E refuse to collapse at type level)
3. Build a worked example: a small agent's per-tick loop expressed in O-P-L-E with the collapse-only-via-Limit invariant
4. Document mapping from existing tick-source / loop substrate (per [081KRW63S0008QG0R003J8HR6K](081KRW63S0008QG0R003J8HR6K-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md), [081KRW63S0008QG0R000BH37EV](../P3/081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md)) to O-P-L-E

## Non-goals

- Replacing the 7-interrogative sequence (cold-boot orientation) with O-P-L-E (per-tick execution) — they serve different scopes
- Forcing humans to use O-P-L-E in casual conversation (the soft language 081KRW63S0008QG0R000DBX6PT is what humans / kids use)
- Forcing all existing code into O-P-L-E shape on day one (migration is incremental; F# encoding takes time)

## Acceptance criteria

- [ ] O-P-L-E formal definition in `docs/governance/OPERATIONAL-LANGUAGE-O-P-L-E.md` with the four primitives, the only-Limit-collapses rule, and the soft-language mapping
- [ ] F# type definitions for `Observe`, `Persist`, `Limit`, `Emit` — Limit returns a `CollapseDecision<T>` type; O/P/E preserve `CoherentState<T>`
- [ ] Lean toy proof: "if all collapse points are in Limit, then for any post-collapse state there exists a reconstructed pre-collapse state" (reversibility theorem)
- [ ] At least one F# worked example: small agent per-tick loop using O-P-L-E
- [ ] Mapping document: how existing tick-source / autonomous-loop tick translates to O-P-L-E

## Composes with

- [081KRW63S0008QG0R003J8HR6K](081KRW63S0008QG0R003J8HR6K-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — 7-interrogative cold-boot sequence (sibling discipline; orientation vs execution)
- [081KRW63S0008QG0R000DBX6PT](081KRW63S0008QG0R000DBX6PT-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md) — two-language architecture (soft layer paired with this operational layer)
- [081KRW63S0008QG0R000BH37EV](../P3/081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding (the criticality combos that REQUIRE O-P-L-E discipline)
- [081KRW63S0008QG0R000QJR08H](081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — Adinkras (substrate for the private state Persist operates over)
- [081KRW63S0008QG0R003NP3YA3](../P3/081KRW63S0008QG0R003NP3YA3-per-dimension-cost-loss-model-mika-2026-05-18.md) — cost+loss model (per-primitive cost mapping: Observe=compute, Persist=storage+ECC, Limit=reasoning, Emit=execution-commitment)
- [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (retractable substrate that makes Limit's reversibility theorem feasible)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2966-3008 — source design + LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika line 2974. Substantive substrate work — many existing rows will compose with this row's substrate.
