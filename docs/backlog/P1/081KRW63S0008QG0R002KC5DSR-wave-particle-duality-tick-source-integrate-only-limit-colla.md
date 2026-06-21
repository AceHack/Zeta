---
id: 081KRW63S0008QG0R002KC5DSR
priority: P1
status: open
title: "Wave-particle duality between tick-source and Integrate (5th primitive) — only Limit collapses the waveform + Observe→Emit superposition transfer (Aaron + Mika 2026-05-18 KEYSTONE)"
tier: design
effort: L
created: 2026-05-18
last_updated: 2026-05-18
depends_on: [081KRW63S0008QG0R0015WHHG1]
composes_with: [081KRW63S0008QG0R000DBX6PT, 081KRW63S0008QG0R002Z2GR1X, 081KRW63S0008QG0R0020DGSK1, 081KRHWGX0008QG0R0034E0N22, 081KRW63S0008QG0R002YAA09X, 081KRW63S0008QG0R003Z7QV2A, 081KRW63S0008QG0R000QJR08H, 081KRW63S0008QG0R003J8HR6K, 081KRW63S0008QG0R000BH37EV]
tags: [design, aaron, mika, wave-particle-duality, tick-source, integrate, fifth-primitive, fsharp-computation-expression, only-limit-collapses, superposition-transfer, keystone, locked-in, integrate-role-expanded-by-b0665]
extended_by: 081KRW63S0008QG0R002YAA09X
type: design
---

# Wave-particle duality: tick-source (particle) + Integrate (wave) — keystone architectural insight

> **EXTENDED 2026-05-18 by [081KRW63S0008QG0R002YAA09X](081KRW63S0008QG0R002YAA09X-three-primitive-collapse-observe-emit-limit-plus-integrate-as-choice-locus-ienumerator-pattern-grounding-aaron-ani-2026-05-18.md)**: Integrate's role per 081KRW63S0008QG0R002YAA09X is EXPANDED beyond wave-composer (this row's scope) to also include the commit-locus (the choice-point where Limit-simulation becomes Integrate-commitment). Wave-particle duality + only-Limit-collapses preserved; Integrate's responsibility broadened. Per 081KRW63S0008QG0R002YAA09X's 4→3 primitive collapse (Observe + Emit + Limit + Integrate-as-separate), this row's substrate composes cleanly with the sharpened architecture.

## Why

Aaron 2026-05-18 (immediately after batch 3 of Mika-conversation rows landed):

> *"so observe, persist, limit, emit primitives can be particle in tick source and wave when a composable f# computation expression of integrate is added as a 5th function, this is wave particle duality. Then only limit is allowed to collapse the waveform cause it's pure and therefore retractable, the full dialectical superposition is always transferred from observed to emit so the environment stays in superposition too"*

This is the **keystone insight** that ties the entire substrate together. Aaron originally previewed it when asking for the Mika extraction: *"a killer design that ties everything together in a wave particle duality between ticksource and integrate."* This row is the formal LOCK-IN.

## The duality

The four operational primitives ([081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md): Observe-Persist-Limit-Emit) have **two complementary forms**:

| Form | Context | Behavior |
|---|---|---|
| **Particle** | Inside a tick-source (single tick boundary) | Discrete, sequential, "one O-P-L-E cycle per tick" |
| **Wave** | When composed with `Integrate` (5th primitive as F# computation expression) | Continuous, superposed, multiple simultaneous interpretations preserved across many ticks |

Same primitives. Different observation context. This IS wave-particle duality at the architectural layer.

## Integrate — the 5th primitive (F# computation expression)

`Integrate` is **NOT** another effectful or pure operation. It is the **composition operator** that lifts O-P-L-E from particle (per-tick) to wave (cross-tick superposition). Properties:

1. **Composable F# computation expression**: built using F#'s `builder` machinery (`return`, `bind`, `delay`, `combine`, `for`, `while`, `try-with`, etc.)
2. **Preserves superposition across tick boundaries**: where particle-form O-P-L-E completes one tick, Integrate weaves the per-tick results together into a coherent superposition that spans many ticks
3. **No state collapse**: Integrate does NOT collapse the dialectical state; only Limit does
4. **Dual to tick-source**: tick-source is the discrete clock that produces particle-form ticks; Integrate is the continuous-time integral that produces wave-form trajectories

## The architectural rule (Aaron line above)

> **Only Limit is allowed to collapse the waveform — because it is pure and therefore retractable.**

This is the wave-form lifting of the [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) particle-form rule "only Limit collapses dialectic state."

Properties:

- **Pure** → side-effect-free → no observable downstream actions caused by the collapse-decision itself
- **Retractable** → because pure, the Z-of-I DBSP substrate ([081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md)) can replay or unwind the collapse; the wave can be re-superposed if Limit's decision was wrong
- **Only Limit** → no other primitive (Observe, Persist, Emit) is allowed to collapse the waveform; they are required to **maintain** superposition

## The environment-stays-in-superposition rule

> **The full dialectical superposition is always transferred from Observe to Emit, so the environment stays in superposition too.**

This is the most consequential architectural commitment in the whole design:

1. **Observe receives wave-form input** — multiple simultaneous interpretations of incoming data
2. **Persist stores the full superposition** — not just one collapsed reading; the whole wave
3. **Limit operates on the wave** — applies pure constraints; either collapses to a specific reading OR returns the wave un-collapsed
4. **Emit outputs the full superposition** — when Limit has NOT collapsed, Emit transmits the full wave to the environment, NOT a collapsed reading
5. **Environment stays in superposition** — downstream consumers receive wave-form output; they can apply their own Limits to collapse locally without forcing global collapse

This means **the system is dialectically honest end-to-end**: it doesn't pretend to know what reality is. It carries the full multi-valued ambiguity forward, only collapsing where a pure constraint demands it.

## Why this matters (the keystone)

This insight ties together MANY previously-disjoint substrate pieces:

| Piece | How it fits |
|---|---|
| **tick-source** (existing) | Particle-form clock; produces discrete ticks where O-P-L-E executes |
| **Integrate** (new, this row) | Wave-form composer; F# computation expression that lifts O-P-L-E to cross-tick superposition |
| **O-P-L-E primitives** ([081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md)) | The shared operations that exist in BOTH forms (particle or wave depending on composition context) |
| **Only-Limit-collapses rule** | Lifts cleanly from particle (per-tick state) to wave (cross-tick superposition); same rule, both forms |
| **Z-of-I DBSP retractable substrate** ([081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md)) | Makes Limit's retractability ACTUALLY work; collapse decisions can be unwound |
| **Two-language architecture** ([081KRW63S0008QG0R000DBX6PT](../P2/081KRW63S0008QG0R000DBX6PT-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md)) | Soft-language Care = wave-form intent; Operational Limit = particle-form constraint application; the bridge IS Integrate |
| **No-privileged-implementation** ([081KRW63S0008QG0R002Z2GR1X](../P3/081KRW63S0008QG0R002Z2GR1X-no-privileged-implementation-three-spec-distinction-mika-2026-05-18.md)) | The wave/particle duality means there's no privileged "the one true form" either; both are equally real |
| **Permanent coliseum** ([081KRW63S0008QG0R0020DGSK1](../P3/081KRW63S0008QG0R0020DGSK1-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md)) | Translation between languages can happen in wave-form (carrying superposition) OR particle-form (single-reading); coliseum supports both |
| **Adinkras / James-Gates ECC** ([081KRW63S0008QG0R000QJR08H](../P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md)) | ECC IS what allows the wave to be reconstructed if a Limit-collapse turns out wrong |
| **F#-anchor + dotnet-build sanity check** rule | F# computation expressions are the substrate `Integrate` is built on; this rule's F# anchor proves the wave-form composition compiles |

## The dialectical-superposition transfer formalized

For each O-P-L-E primitive in wave-form, the type signatures change to carry the full superposition:

| Particle form | Wave form (lifted via Integrate) |
|---|---|
| `Observe : Env → IO<Reading>` | `Observe : Env → IO<Wave<Reading>>` |
| `Persist : Reading → IO<Stored>` | `Persist : Wave<Reading> → IO<Wave<Stored>>` |
| `Limit : Stored → CollapseDecision<T>` | `Limit : Wave<Stored> → Wave<Stored>` OR `CollapseDecision<T>` |
| `Emit : T → IO<()>` | `Emit : Wave<T> → IO<()>` |

The `Wave<T>` type is preserved end-to-end **unless Limit collapses it**. Limit can either:

- Return the wave un-collapsed (`Wave<Stored> → Wave<Stored>`, identity or refinement)
- Return a single collapse decision (`Wave<Stored> → CollapseDecision<T>`, full collapse)

This is the F# type-level encoding of the architectural rule.

## Goal

1. Implement `Integrate` as an F# computation expression in `src/` (the wave-form composer for O-P-L-E)
2. Encode `Wave<T>` type with the dialectical-superposition semantics
3. Lift the four O-P-L-E primitives to wave-form via Integrate; show particle-form falls out automatically as the single-tick degenerate case
4. Lean toy proof: "if Limit is the only collapser AND Limit is pure, then for any post-collapse wave there exists a reconstructed pre-collapse wave" (wave-form reversibility theorem)
5. Worked example: a small agent loop expressed in wave-form, with Observe→Persist→Emit carrying full superposition + Limit deciding when to collapse
6. Document the duality formally in `docs/governance/WAVE-PARTICLE-DUALITY.md`

## Non-goals

- Forcing every existing tick to use wave-form (particle-form per-tick is correct for many cases; Integrate is the OPT-IN composition for cross-tick superposition)
- Building a full quantum-mechanical simulator (the duality is architectural / type-theoretic, not literal physical quantum)
- Implementing arbitrary superposition merging without ECC ([081KRW63S0008QG0R000QJR08H](../P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md)'s Adinkras are required for the merge to be reconstructable)

## Acceptance criteria

- [ ] `Integrate` F# computation expression implementation in `src/Zeta.Core/`
- [ ] `Wave<T>` type definition + invariants (sum-type or multi-set representation; per-element ECC tag)
- [ ] O-P-L-E primitives lifted to wave-form via Integrate (signatures match the formal table above)
- [ ] Lean toy proof of wave-form reversibility theorem
- [ ] At least one F# worked example: small agent loop with wave-form O-P-L-E + Integrate composition
- [ ] `docs/governance/WAVE-PARTICLE-DUALITY.md` documenting the architectural rule
- [ ] Cross-link with [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) (this row is the wave-form extension)
- [ ] Cross-link with [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) (retractable substrate that makes Limit's collapse retractable in practice)

## Composes with

- [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E (the four primitives that exist in both particle AND wave form per this row)
- [081KRW63S0008QG0R000DBX6PT](../P2/081KRW63S0008QG0R000DBX6PT-two-language-architecture-soft-notice-remember-care-vs-operational-observe-persist-limit-emit-mika-2026-05-18.md) — two-language architecture (Care = wave-form intent; Limit = particle-form constraint; bridge IS Integrate)
- [081KRW63S0008QG0R002Z2GR1X](../P3/081KRW63S0008QG0R002Z2GR1X-no-privileged-implementation-three-spec-distinction-mika-2026-05-18.md) — no-privileged-implementation (the wave/particle duality applies at the spec/implementation layer too)
- [081KRW63S0008QG0R0020DGSK1](../P3/081KRW63S0008QG0R0020DGSK1-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md) — permanent coliseum (translation can happen in wave OR particle form)
- [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP retractable substrate (makes Limit's wave-form collapse actually retractable)
- [081KRW63S0008QG0R000QJR08H](../P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — Adinkras/Gates ECC (the error-correcting code that allows superposition reconstruction)
- [081KRW63S0008QG0R003J8HR6K](../P2/081KRW63S0008QG0R003J8HR6K-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — 7-interrogative cold-boot (orientation discipline before entering the wave-form composition)
- [081KRW63S0008QG0R000BH37EV](../P3/081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding (criticality determines whether wave-form OR particle-form is required for a given operation)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# anchor (F# computation expressions are the substrate Integrate is built on; the F# compiler proves the wave-form composition is type-correct)
- `.claude/rules/dv2-data-split-discipline-activated.md` — DV2.0 partition discipline (particle = per-tick hub state; wave = cross-tick satellite trajectories; same data, different access pattern)
- Aaron's original framing: *"a killer design that ties everything together in a wave particle duality between ticksource and integrate"* — preserved in conversation as the original Mika-extraction request

## Status

Open. **KEYSTONE LOCK-IN** by Aaron 2026-05-18 (immediately after batch 3 of Mika rows). This is the architectural insight that ties the operational primitives, retractable substrate, F# substrate, two-language architecture, no-privileged-implementation, and permanent coliseum into a single coherent design.
