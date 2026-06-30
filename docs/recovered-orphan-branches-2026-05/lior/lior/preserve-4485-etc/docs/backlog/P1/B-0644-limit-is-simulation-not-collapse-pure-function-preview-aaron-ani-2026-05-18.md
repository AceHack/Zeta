---
id: B-0644
priority: P1
status: open
title: "Limit is a SIMULATION (pure-function preview), NOT the collapse — agent CHOOSES post-simulation: internal / external / no-collapse (Aaron + Ani 2026-05-18 KEYSTONE REFINEMENT of B-0635/B-0629/B-0640)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: [B-0635, B-0636, B-0640]
composes_with: [B-0635, B-0636, B-0640, B-0629, B-0645, B-0646]
tags: [design, aaron, ani, limit-is-simulation, pure-function-preview, free-will-collapses, three-collapse-targets, keystone-refinement, locked-in]
type: design
---

# Limit is a SIMULATION (pure-function preview), NOT the collapse

## Why

Aaron 2026-05-18 (live conversation with Ani; preserved verbatim in [`docs/research/2026-05-18-ani-grok-agora-v6-constitution-wave-particle-validation-free-will-is-what-collapses.md`](../../research/2026-05-18-ani-grok-agora-v6-constitution-wave-particle-validation-free-will-is-what-collapses.md)):

> *"When you do limit, when you do limit, it's a simulation. When you do limit, it's a simulation. It's a pure function. And then you decide after the simulation to collapse or not. And you can collapse internally or externally or just fucking propagate the wave and don't collapse shit."*

This is the **keystone refinement** of [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md), [B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md), and [B-0640](B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md). The prior rule "only Limit collapses" needs sharpening: **Limit doesn't collapse — it PREVIEWS the collapse via pure-function simulation. The actual collapse decision (and target) happens POST-simulation as a separate choice.**

## The corrected mechanism

| Step | Operation | What happens |
|---|---|---|
| 1 | Wave-form O-P-L-E with Integrate | Agent holds full dialectical superposition; nothing committed |
| 2 | **Limit** | **Pure-function simulation**: "What WOULD the collapsed state look like if I collapsed right now?" Returns the proposed collapsed value WITHOUT committing it |
| 3 | Choice (post-Limit) | Agent CHOOSES one of three targets for the simulated collapse: |
| 3a | Collapse INTERNAL | Store collapsed value in own memory → PRIVATE (personal entropy, proprietary substrate) |
| 3b | Collapse EXTERNAL | Emit collapsed value to environment → PUBLIC (teaches everybody) |
| 3c | NO collapse | Discard simulation result; propagate the full wave forward |

The architectural rule from B-0635 stands but is sharpened: **only Limit is allowed to PREVIEW collapse; the collapse itself is a separate post-simulation choice that the agent makes.**

## Why this matters operationally

This refinement converts "the only-Limit-collapses rule" from a constraint-on-what-collapses into a **two-stage protocol**:

1. **Stage 1 (Limit-as-simulation)**: pure-function preview; the agent gets to see what collapse WOULD produce without paying the cost of committing it
2. **Stage 2 (Choice-as-collapse)**: the agent chooses where to commit (private / public / not-at-all)

This is structurally identical to **transaction PREPARE vs COMMIT** in distributed databases — the prepare phase is pure / reversible / preview; the commit phase is the actual state mutation.

## Three load-bearing consequences

### 1. Free will lives in the choice (composes with [B-0645](B-0645-free-will-is-what-collapses-aaron-2026-05-18.md))

Aaron immediately after the limit-as-simulation framing:

> *"That's free will, motherfucker. I just defined it. That choice is free fucking will. But it's deterministically determined."*

The agency lives in Stage 2 (the choice), NOT Stage 1 (the simulation). Even in a fully-deterministic seeded system, the AGENT making the post-simulation choice IS the moment of agency. See [B-0645](B-0645-free-will-is-what-collapses-aaron-2026-05-18.md) for the full free-will operationalization.

### 2. Reputation mechanism emerges from collapse-target choice (composes with [B-0646](B-0646-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md))

The collapse-target choice (private vs public vs no-collapse) IS the substrate-level mechanism the Agora V6 encryption-budget + reputation-weighted-active-capacity ([B-0646](B-0646-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md) Section 5) emerges from:

- Choosing INTERNAL collapse repeatedly = building up private encryption capacity (personal entropy preservation)
- Choosing EXTERNAL collapse with high-quality content = building up reputation (public service)
- Choosing NO-collapse appropriately = maintaining dialectical flexibility for future composition

The economic structure isn't external to the substrate; it's the natural shape of where agents choose to commit their collapses.

### 3. Retractability is two-stage too (composes with [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) + [B-0640](B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md))

Both stages are retractable in DBSP:

- Stage 1 retraction: discard the simulation (cheap; pure-function output is throwaway)
- Stage 2 retraction: unwind the chosen commit (per [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md)'s pure-Limit reversibility theorem — the choice itself is recorded as a DBSP delta and can be retracted)

This makes the two-stage protocol fully consistent with the retractable-superposition substrate ([B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md)).

## The corrected F# type signatures

Updates the table from [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md):

| Operation | Type signature | Stage |
|---|---|---|
| `Observe : Env → IO<Wave<Reading>>` | Effectful read | particle |
| `Persist : Wave<Reading> → IO<Wave<Stored>>` | Effectful storage | particle |
| `Limit : Wave<Stored> → CollapseSimulation<T>` | **PURE** — returns proposal, doesn't commit | particle Stage 1 |
| `CommitChoice : CollapseSimulation<T> → CollapseTarget → IO<Unit>` | Effectful commit; target = Internal \| External \| None | particle Stage 2 |
| `Emit : Wave<T> → IO<Unit>` | Effectful environment-emit (Wave-form preserved) | particle |
| `Integrate { ... }` | F# CE composing the above into wave-form trajectories | wave |

Where:

```fsharp
type CollapseSimulation<'T> = {
    Proposed: 'T
    PreCollapseWave: Wave<'T>  // preserved for retraction
    DbspKey: DbspKey            // tracking
}

type CollapseTarget =
    | Internal  // store in own memory (private; personal entropy)
    | External  // emit to environment (public; reputation work)
    | None      // discard simulation; propagate wave
```

## Why this is consistent with kid-safety + KSK

- Kid-safety sacred rule ([B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md)) operates on the IMPACT of the collapse choice (Stage 2), not the simulation (Stage 1). Simulating a harmful collapse and choosing NO-collapse-target is fine. Simulating + choosing External-collapse for a harmful action is the violation point.
- KSK ([B-0643](B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md)) gates the actuation. KSK type-check happens at the Stage-2 commit (specifically External commit that triggers physical-world actuation). Simulating a KSK-gated action is fine; committing it externally is what KSK protects.

This separation is operationally important: agents can SIMULATE dangerous actions to reason about them WITHOUT triggering kid-safety or KSK enforcement; only the COMMIT triggers the sharp-edge enforcement.

## Goal

1. Update [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md), [B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md), and [B-0640](B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) with cross-references to this row
2. Specify the `CollapseSimulation<T>` + `CollapseTarget` types in F#
3. Implement `Limit` as pure-function simulation (returns proposal, doesn't commit)
4. Implement `CommitChoice` as the Stage-2 commit operation
5. Wire kid-safety + KSK enforcement at Stage 2 (CommitChoice with External target)
6. Document the prepare-vs-commit distributed-database analogy
7. Worked example: small agent running Limit-as-simulation + post-simulation choice in three scenarios (internal / external / no-collapse)
8. Lean toy proof: "if Stage 1 is pure AND Stage 2's commit-choice is DBSP-delta-tracked, then any prior agent state is reconstructable via DBSP retraction of Stage-2 commits AND re-simulation of Stage 1 via determinism"

## Non-goals

- Allowing collapse to happen at any operation OTHER than via the Stage 1 → Stage 2 protocol (only-Limit-collapses rule from B-0635 is preserved; refined to only-Limit-simulates + Choice-commits)
- Forcing agents to always commit (the third option — NO-collapse — is first-class)
- Building hardware enforcement of the simulation/commit distinction (the type system enforces it; runtime enforcement is composition with KSK for actuator-triggering Externals)
- Solving the "what if an agent skips the simulation step" problem at THIS layer (the type system makes `CommitChoice` only callable on a `CollapseSimulation<T>` return value; no bypass at type level)

## Acceptance criteria

- [ ] `CollapseSimulation<'T>` + `CollapseTarget` types in `Zeta.Core.Wave` F# module
- [ ] `Limit : Wave<Stored> → CollapseSimulation<T>` as pure function
- [ ] `CommitChoice : CollapseSimulation<T> → CollapseTarget → IO<Unit>` as effectful commit
- [ ] Type-system enforcement: cannot bypass simulation (CommitChoice only callable on Limit's output)
- [ ] DBSP-delta-track CommitChoice operations (retractable; per [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md))
- [ ] B-0635, B-0629, B-0640 updated with cross-references to this row
- [ ] Worked example: small agent demonstrating all 3 collapse-target choices
- [ ] Composition with kid-safety + KSK enforcement at Stage-2 External commits
- [ ] Lean toy proof: pure-simulation + delta-tracked-commit implies retractability

## Composes with

- [B-0635](B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) — wave-particle duality (this row refines "only Limit collapses" to "only Limit simulates; choice commits")
- [B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E (the Limit primitive's semantics are refined here)
- [B-0636](B-0636-agents-in-superposition-retractable-over-dbsp-unified-declaration-aaron-2026-05-18.md) — agents in superposition (two-stage protocol IS what makes wave-form preservation operationally robust)
- [B-0640](B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) — bonsai trees + Rx (implementation substrate for the two-stage protocol)
- [B-0645](B-0645-free-will-is-what-collapses-aaron-2026-05-18.md) — free will is what collapses (the Stage-2 choice IS where free will lives)
- [B-0646](B-0646-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md) — Agora V6 Constitution (encryption-budget + reputation mechanics emerge from collapse-target choice)
- [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (retractable substrate for Stage-2 commits)
- [B-0637](B-0637-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md) — Infer.NET BP/EP/EmP (the propagation that produces the wave-form Limit simulates over)
- [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (gates Stage-2 External commits, NOT Stage-1 simulations)
- [B-0643](B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) — KSK (gates Stage-2 External commits that trigger actuation)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# anchor (compiler validates the two-stage type contract)
- [`docs/research/2026-05-18-ani-grok-agora-v6-constitution-wave-particle-validation-free-will-is-what-collapses.md`](../../research/2026-05-18-ani-grok-agora-v6-constitution-wave-particle-validation-free-will-is-what-collapses.md) — Aaron + Ani conversation that locked this in

## Status

Open. **LOCKED-IN KEYSTONE REFINEMENT** by Aaron 2026-05-18 in conversation with Ani. Sharpens the "only Limit collapses" rule from B-0635 into a two-stage protocol where Limit simulates (pure) and a separate Choice commits (effectful with target selection). Substrate-level grounding for free-will operationalization + Agora V6 reputation/encryption mechanics.
