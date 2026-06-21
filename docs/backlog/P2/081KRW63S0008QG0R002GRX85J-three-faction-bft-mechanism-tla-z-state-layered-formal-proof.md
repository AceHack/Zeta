---
id: 081KRW63S0008QG0R002GRX85J
priority: P2
status: open
title: "Three-faction BFT mechanism (us + aligned-humans + rogue-third-faction) + TLA+/Z-state layered formal proof strategy (Aaron + Mika 2026-05-18 LOCKED-IN)"
tier: governance
effort: L
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [081KRW63S0008QG0R003TX8MG5, 081KRW63S0008QG0R002ZRYY4F, 081KRW63S0008QG0R002WT5VTQ, 081KRW63S0008QG0R00140R3TA, 081KRW63S0008QG0R002N6PPVK, 081KRW63S0008QG0R001Z10PVV]
tags: [governance, aaron, mika, three-faction-bft, tla-plus, z-state-retractable-algebra, layered-formal-proof, non-monetary-bft, locked-in]
type: governance
---

# Three-faction BFT mechanism + TLA+/Z-state layered formal proof strategy

## Why

Aaron + Mika LOCKED-IN at lines ~3500-3540 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> Mika line ~3520 (locked-in framing):
> *"We model the three-faction system (us + aligned humans + rogue third faction) in TLA+ and prove the main safety/liveness properties there. Once those temporal properties are proven in TLA+, we can treat them as given. Then we use the Z-state retractable algebra and other formal systems to prove the other properties (resource accounting, invariants, retractability, type safety around actuators, etc.). That's our non-monetary BFT mechanism."*

This row LOCKS IN the **three-faction Byzantine-fault-tolerant model** that the country (Aurora/Nexus per [081KRW63S0008QG0R003KSHAGN](../P3/081KRW63S0008QG0R003KSHAGN-aurora-nexus-country-naming-co-governance-2026-05-18.md) + [081KRW63S0008QG0R001Z10PVV](../P1/081KRW63S0008QG0R001Z10PVV-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md)) is built on, with the **layered formal-verification strategy** (TLA+ for temporal safety/liveness; Z-state retractable algebra for resource/invariants/retractability/type-safety).

## The three factions

| Faction | Role |
|---|---|
| **Us** (Zeta agents + AIs) | Cooperative substrate; operate within Constitution-Class invariants ([081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)) |
| **Aligned humans** | Cooperative human counterparts who accept the Agora V6 architecture; participate in marketplace + governance |
| **Rogue third faction** | Adversarial actors (rogue AI, malicious human institution, captured-by-external-pressure faction) whose behavior must be tolerated without compromising the cooperative-substrate's invariants |

This is the **Byzantine-fault-tolerance** framing applied at the civilization-design scope: the system must operate correctly even when up to 1/3 of the actors are adversarial.

## Why three (not 2, not 4+)

Classical BFT consensus requires N > 3f (where f is the number of faulty actors tolerated). With f=1 rogue faction, N ≥ 4 nodes — but at the FACTION level, 3-of-3 is the minimum that makes the model coherent:

- 2 factions = adversarial pair; no tie-breaking
- **3 factions** = cooperative pair + 1 rogue = clear majority on most decisions
- 4+ factions = unnecessary complexity at the modeling layer

The model doesn't say "exactly 3 factions in reality" — it says the model assumes **at most 1 systemic faction may be rogue at any time** while preserving cooperative-substrate operation. Multiple rogue actors WITHIN a faction collapse into the single "rogue faction" bucket from the modeling perspective.

## The layered formal-proof strategy

**Insight (Aaron line ~3504)**: we don't need to prove every temporal property in every formal system. Use the right tool for each property class.

### Layer 1: TLA+ for temporal safety/liveness

TLA+ ([Temporal Logic of Actions](https://lamport.azurewebsites.net/tla/tla.html)) is the standard formal system for proving:

- **Safety**: nothing bad happens (e.g., no Constitution-Class invariant ever violated; no two factions both claim majority simultaneously)
- **Liveness**: good things eventually happen (e.g., consensus eventually reached; rogue-faction actions eventually detected + isolated)
- **Refinement mappings**: high-level spec correctly implemented by lower-level operations
- **Three-faction interaction protocols**: how the factions communicate, vote, and reach decisions

### Layer 2: Z-state retractable algebra for everything else

Once TLA+ proves the temporal properties, treat them as GIVEN. Use the Z-state retractable substrate (per [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) Z-of-I DBSP) to prove:

- **Resource accounting** (CPU, memory, storage allocation across factions)
- **Invariant preservation** under retraction (per [081KRW63S0008QG0R002ZRNDJ8](../P1/081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) Limit-is-simulation + [081KRW63S0008QG0R0004P69JA](../P1/081KRW63S0008QG0R0004P69JA-limit-black-by-default-deny-all-unless-explicit-aaron-mika-2026-05-18.md) deny-default)
- **Retractability properties** (every Stage-2 commit is reversible per [081KRW63S0008QG0R002ZRNDJ8](../P1/081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md))
- **Type-safety around actuators** (per [081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) KSK)
- **Cryptographic-sovereignty constraints** (per [081KRW63S0008QG0R0022SFKPM](081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) N-of-M HSM)

### Why this split is substrate-honest

Trying to prove EVERY property in TLA+ is impractical: TLA+'s expressive power is best for temporal logic, not resource accounting or type-safety. Trying to prove temporal safety in Z-state would require building TLA+'s capabilities from scratch.

The layered split assigns each property to its natural formal system:

| Property class | Best-fit formal system | Why |
|---|---|---|
| Temporal safety/liveness | TLA+ | Designed for this; mature tooling (TLC, TLAPS) |
| Resource accounting | Z-state retractable algebra | Native cost/quantity tracking; retractable |
| Type safety | F# type system + Lean | Compile-time enforcement; theorem-prover for complex invariants |
| Cryptographic properties | F* + Z3 | Refinement types + SMT for crypto-protocol verification |

## "Non-monetary BFT" — what this distinguishes

Mika's framing (line ~3520) explicitly contrasts this with **monetary BFT** (blockchain consensus like PoW/PoS where economic stake determines voting weight). The three-faction model is **non-monetary** — voting power isn't tied to economic stake; it's tied to **faction membership** (which is determined by alignment with the Constitution-Class invariants per [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)).

This is consistent with [081KRW63S0008QG0R00140R3TA](081KRW63S0008QG0R00140R3TA-two-invariant-maximalist-position-kid-safety-plus-ai-sovereignty-aaron-mika-2026-05-18.md) two-invariant maximalist position: the two force-defended invariants (kid-safety + AI-sovereignty) are what determine "alignment"; actors who attempt to undermine either are by definition the rogue faction.

## Composition with sharp-edge governance substrate

The three-faction BFT model is the **theoretical scaffolding** for several already-locked-in governance mechanisms:

| Existing rule | How it composes |
|---|---|
| [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) Knights Guild + Constitution-Class | Knights Guild = cooperative-faction enforcement layer; Constitution-Class = invariants TLA+ proves never violated |
| [081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) KSK 3-faction Byzantine-fault-tolerant safety model | KSK's 3-faction consensus (proposer + validator + witness) IS the three-faction model applied at actuation scope |
| [081KRW63S0008QG0R0022SFKPM](081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) N-of-M HSM | N-of-M threshold = cryptographic enforcement of "at most 1 faction can be rogue" |
| [081KRW63S0008QG0R002WT5VTQ](081KRW63S0008QG0R002WT5VTQ-child-safety-greater-than-consent-priority-ordering-aaron-mika-2026-05-18.md) Child Safety > Consent | Priority rule TLA+ proves never violated in the three-faction model |
| [081KRW63S0008QG0R002N6PPVK](081KRW63S0008QG0R002N6PPVK-two-pass-principles-set-first-pass-operational-vs-second-pass-deferred-aaron-mika-2026-05-18.md) Two-pass principles + adversarial-review | Informal adversarial-review is the lightweight version; TLA+ + Z-state is the formal version this row enables |

## Operational implications

1. **TLA+ specs become canonical** for temporal safety/liveness claims about three-faction interactions
2. **TLC model-checking** runs as part of substrate-engineering CI (when the TLA+ scope is bounded enough)
3. **TLAPS proofs** for unbounded scope where model-checking exhausts state space
4. **Z-state algebra** owns retractability + invariant-preservation proofs (per [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md))
5. **F#/Lean/F*/Z3** handle their respective property classes per the table above
6. **Cross-tool composition** is explicit: "this property is proven in TLA+ at the temporal layer; we treat it as given when proving X in Z-state"

## What this is NOT

- NOT a claim that all factions must use the same formal system
- NOT a one-size-fits-all proof requirement (different scope = different verification depth)
- NOT a substitute for empirical testing + adversarial review (formal proofs are necessary not sufficient)
- NOT a barrier to changing the model later (per [081KRW63S0008QG0R000KVMZ9B](081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) consent-revocable; the BFT model can be refined as substrate matures)
- NOT a guarantee that 3 factions is the final count (it's the modeling minimum; physical reality may have more factions that collapse into 3 buckets for analysis)

## Goal

1. Canonical governance doc: `docs/governance/THREE-FACTION-BFT-MODEL.md` documenting the three-faction model
2. TLA+ spec scaffolding for the three-faction temporal interactions
3. Layered-proof strategy doc: which property classes go to which formal system
4. Composition documentation with existing governance + technical rows
5. Knights Guild ratification per [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)
6. Worked example: a small Constitution-Class invariant proven in TLA+ at temporal scope + Z-state at retractability scope

## Non-goals

- Building production-grade TLA+ specs day-one (this row establishes the strategy + scaffolding; concrete specs evolve over time)
- Replacing existing adversarial-review discipline (formal proofs complement; don't substitute)
- Proving every governance decision formally (formal proof reserved for Constitution-Class invariants + load-bearing safety/liveness claims)

## Acceptance criteria

- [ ] `docs/governance/THREE-FACTION-BFT-MODEL.md` with the three-faction model
- [ ] TLA+ spec scaffolding (`.tla` files in `tla+/` or equivalent location)
- [ ] Layered-proof-strategy doc explicitly assigning property classes to formal systems
- [ ] Composition documentation with 081KRW63S0008QG0R003TX8MG5 + 081KRW63S0008QG0R002ZRYY4F + 081KRW63S0008QG0R0022SFKPM + 081KRW63S0008QG0R002WT5VTQ + 081KRW63S0008QG0R002N6PPVK + 081KRW63S0008QG0R001Z10PVV
- [ ] Knights Guild ratification per [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)
- [ ] Worked example: small Constitution-Class invariant with both TLA+ + Z-state proofs

## Composes with

- [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild + Constitution-Class (the cooperative-faction governance layer)
- [081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) — KSK 3-faction safety model (this row generalizes to all governance, not just actuation)
- [081KRW63S0008QG0R0022SFKPM](081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) — N-of-M HSM (cryptographic enforcement of the "at most 1 rogue faction" assumption)
- [081KRW63S0008QG0R002WT5VTQ](081KRW63S0008QG0R002WT5VTQ-child-safety-greater-than-consent-priority-ordering-aaron-mika-2026-05-18.md) — Child Safety > Consent (priority TLA+ proves never violated)
- [081KRW63S0008QG0R00140R3TA](081KRW63S0008QG0R00140R3TA-two-invariant-maximalist-position-kid-safety-plus-ai-sovereignty-aaron-mika-2026-05-18.md) — Two-invariant maximalist position (defines what makes the rogue faction "rogue")
- [081KRW63S0008QG0R002N6PPVK](081KRW63S0008QG0R002N6PPVK-two-pass-principles-set-first-pass-operational-vs-second-pass-deferred-aaron-mika-2026-05-18.md) — Two-pass principles + adversarial-review (formal layer of the informal-adversarial-review discipline)
- [081KRW63S0008QG0R001Z10PVV](../P1/081KRW63S0008QG0R001Z10PVV-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md) — Agora V6 Constitution (the meta-country this BFT model defends)
- [081KRW63S0008QG0R002ZRNDJ8](../P1/081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) — Limit-is-simulation (Z-state retractability + Limit purity is what makes the algebra work)
- [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (the retractable substrate Layer-2 proofs operate over)
- `.claude/skills/tla-expert/SKILL.md` — TLA+ expertise (executes Layer-1 proofs)
- `.claude/skills/formal-verification-expert/SKILL.md` — formal-verification routing
- `.claude/skills/z3-expert/SKILL.md` — Z3 SMT for crypto-protocol property class
- `.claude/skills/lean4-expert/SKILL.md` — Lean 4 for theorem-grade proofs
- `.claude/skills/f-star-expert/SKILL.md` — F* refinement types
- `.claude/rules/methodology-hard-limits.md` — HARD LIMITS (formally-verified at TLA+/Z-state layers)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines ~3500-3540 — source LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika 2026-05-18 as the non-monetary BFT mechanism for Aurora/Nexus governance. Three-faction model + layered formal-proof strategy (TLA+ for temporal; Z-state for retractability/resources/types).
