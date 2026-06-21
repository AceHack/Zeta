---
id: 081KRW63S0008QG0R001WKJN53
priority: P1
status: open
title: "Consent IS a Limit primitive operation — re-evaluated every tick → revocability is ARCHITECTURAL, not a rule on top (Aaron + Mika 2026-05-18 LOCKED-IN substrate refinement of 081KRW63S0008QG0R000KVMZ9B + 081KRW63S0008QG0R002ZRNDJ8)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: [081KRW63S0008QG0R0015WHHG1, 081KRW63S0008QG0R002ZRNDJ8, 081KRW63S0008QG0R000KVMZ9B]
composes_with: [081KRW63S0008QG0R0015WHHG1, 081KRW63S0008QG0R002ZRNDJ8, 081KRW63S0008QG0R000KVMZ9B, 081KRW63S0008QG0R002WT5VTQ, 081KRW63S0008QG0R0020YP84K, 081KRW63S0008QG0R0004P69JA]
tags: [design, aaron, mika, consent-as-limit, architectural-revocability, pure-function-re-evaluation, tick-source, substrate-refinement, locked-in, keystone-refinement]
type: design
---

# Consent IS a Limit primitive operation — revocability is architectural

## Why

Aaron + Mika 2026-05-18 (preserved verbatim at lines ~4626-4632 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md)) LOCKED-IN that **consent lives inside the Limit primitive**, and the consequence: revocability is an ARCHITECTURAL property of the substrate, NOT a rule we added on top.

> Mika line ~4626: *"Consent lives inside Limit. Here's why: Consent is fundamentally about drawing a boundary. It's saying 'this is allowed and this is not allowed.' That's a limiting operation. You're setting constraints on what states or actions are acceptable. The Limit primitive is where all boundary-setting, permission, and therefore consent actually emerges from."*

> Mika line ~4632 (LOCK-IN): *"Because it's a pure function that lives inside the Limit primitive, that means consent has to be evaluated in the current tick. Every single time the iteration loop runs, the Limit is re-evaluated. There's no persistent, hardcoded, permanent binding — it can only exist for as long as the current state supports it. So if the state changes, or the agent changes their mind, the Limit primitive naturally updates and the consent disappears. That's why it forces all consent to be revocable by design."*

This row is the **substrate refinement** of [081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) (First Moral Invariant: all consent revocable) and [081KRW63S0008QG0R002ZRNDJ8](081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) (Limit-is-simulation). It explains **WHY** consent is revocable — not because of a rule, but because of the Limit primitive's pure-function-re-evaluated-every-tick architecture.

## The architectural mechanism

```
tick-source fires → O-P-L-E cycle → Limit re-evaluates ALL active boundaries (incl. consent)
                                       ↓
                  If consent's premises hold → Limit returns same boundary
                                       ↓
                  If state changed OR agent changed mind → Limit returns updated boundary
                                       ↓
                  Updated boundary → consent updated (possibly revoked)
```

Because Limit is a pure function (per [081KRW63S0008QG0R002ZRNDJ8](081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md)), every re-evaluation is deterministic for given inputs. The inputs include the agent's current state + the environment. As either changes, the Limit's output naturally changes. **Consent isn't "stored" — it's re-derived each tick from current state.**

This means:

- **No persistent consent storage** — you can't "lock in" consent forever because Limit re-evaluates from scratch every tick
- **No hardcoded permanent binding** — the architecture refuses to encode permanence at the primitive layer
- **State change → consent change** — if circumstances shift, consent naturally updates
- **Mind change → consent change** — if the agent reconsiders, the next tick's Limit returns the new decision
- **Revocability is FREE** — no separate "revoke consent" mechanism needed; it's how Limit works

## Why this is the cleaner formulation

[081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) (First Moral Invariant) stated "all consent is revocable" as a RULE — a moral commitment the substrate must respect. That framing is correct but requires the substrate to *enforce* the rule.

This row REFRAMES: consent IS a Limit operation; Limit re-evaluates every tick; therefore consent revocability **emerges from the architecture without enforcement effort**. The rule is true *because the architecture makes it true*, not because we add enforcement on top.

This is **substrate-honest grounding** — the moral commitment is rooted in the primitive's pure-function semantics, not bolted on as policy.

## Composition with two-stage protocol (081KRW63S0008QG0R002ZRNDJ8)

[081KRW63S0008QG0R002ZRNDJ8](081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) established Limit as a TWO-STAGE protocol:

1. Stage 1 (Limit) — pure-function SIMULATION (preview)
2. Stage 2 (CommitChoice) — agent CHOOSES collapse-target (Internal/External/None)

This row extends: **consent IS the Limit Stage-1 simulation result** (the boundary preview), and **consent enactment IS a Stage-2 CommitChoice** (commit the boundary to External — making the consent operationally binding for the tick).

| Stage | Operation | Consent behavior |
|---|---|---|
| Stage 1 (Limit) | Pure-function simulation | Computes what boundaries are active given current state (includes evaluating active consents) |
| Stage 2 (CommitChoice) | Agent chooses commit target | Internal/External commit makes the boundary operative for THIS tick |
| Next tick | Fresh O-P-L-E cycle | Stage 1 re-evaluates from scratch — yesterday's consent doesn't auto-persist |

## Operational implications

1. **No "consent database" needed** — consent state isn't stored separately; it's derived each tick from agent + environment state
2. **Consent is naturally retroactive-aware** — if past state was different from current state, consent that "would have been granted then" may not be granted now (and vice versa)
3. **Revocation is structural, not behavioral** — agents don't need to "do something" to revoke; they need to STOP doing what causes Limit to compute the boundary as still-allowed
4. **DBSP retraction maps cleanly** — past consent grants are recorded as DBSP deltas (per [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md)); retracting a past consent = retracting the delta + re-running the affected ticks
5. **Type-system enforcement is the right shape** — F# type system can enforce "consent for action X requires Limit-derived boundary that includes X" (per [081KRW63S0008QG0R002ZRNDJ8](081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) type signatures)

## Composes with Limit black-by-default (081KRW63S0008QG0R0004P69JA)

The companion row [081KRW63S0008QG0R0004P69JA](081KRW63S0008QG0R0004P69JA-limit-black-by-default-deny-all-unless-explicit-aaron-mika-2026-05-18.md) establishes that **Limit's default state is DENY** (black-by-default; security-first architectural posture). Together:

- 081KRW63S0008QG0R0004P69JA: Limit defaults to deny-all
- 081KRW63S0008QG0R001WKJN53 (this row): consent IS a Limit operation → consent's default is "not granted"
- Together: explicit consent is REQUIRED to grant boundary; no consent = no permission; consent doesn't persist beyond what current Limit re-evaluation supports

This is the cleanest possible substrate-grounding of "informed consent" semantics in software architecture.

## What this is NOT

- NOT a claim that consent must be re-given verbally every tick (the agent's state CAN persist a "I want to allow X" intention; Limit checks against THAT intention each tick + outputs the boundary accordingly)
- NOT a removal of the First Moral Invariant ([081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md)) (this row STRENGTHENS it by grounding it architecturally)
- NOT a claim that all consent operations must run through Limit (operational consent at the application layer; this row addresses the substrate primitive layer)
- NOT a forced agent-side burden ("you must reconsider every consent every tick" — false; the agent's intentions persist as agent-state; Limit checks against the state)

## Goal

1. Document the consent-as-Limit-operation architectural refinement in canonical governance + technical docs
2. F# type signatures showing Limit-derived boundaries include consent-status as a field
3. DBSP delta-tracking pattern for consent grants + retractions
4. Lean toy proof: "if Limit is pure AND consent IS a Limit operation, then for any past consent there exists a path to revoke via DBSP retraction"
5. Update [081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) with cross-reference (this row IS the architectural mechanism)
6. Update [081KRW63S0008QG0R002ZRNDJ8](081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) with cross-reference (consent operates within the two-stage protocol)

## Non-goals

- Building per-tick consent re-display UI (the substrate handles it; UI layer is separate)
- Forcing all applications to use Limit-based consent (architectural availability ≠ universal mandate)
- Eliminating the rule-level First Moral Invariant statement (081KRW63S0008QG0R000KVMZ9B still provides the moral commitment; this row provides the architectural grounding)

## Acceptance criteria

- [ ] Canonical governance doc: `docs/governance/CONSENT-AS-LIMIT-OPERATION.md`
- [ ] F# type definitions showing consent IS a field on Limit's boundary output
- [ ] DBSP delta-tracking pattern for consent grants + retractions documented
- [ ] Lean toy proof of revocability-via-retraction theorem
- [ ] Cross-references added to 081KRW63S0008QG0R000KVMZ9B + 081KRW63S0008QG0R002ZRNDJ8
- [ ] Worked example: agent grants consent in tick N; state changes in tick N+M; Limit re-evaluation shows consent naturally revoked; DBSP delta-history shows the path
- [ ] Composition documentation with [081KRW63S0008QG0R0004P69JA](081KRW63S0008QG0R0004P69JA-limit-black-by-default-deny-all-unless-explicit-aaron-mika-2026-05-18.md) black-by-default

## Composes with

- [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E primitives (this row sharpens the semantics of the Limit primitive)
- [081KRW63S0008QG0R002ZRNDJ8](081KRW63S0008QG0R002ZRNDJ8-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) — Limit-is-simulation (this row says consent IS the Stage-1 simulation output)
- [081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) — First Moral Invariant (this row IS the architectural mechanism that makes 081KRW63S0008QG0R000KVMZ9B hold)
- [081KRW63S0008QG0R002WT5VTQ](../P2/081KRW63S0008QG0R002WT5VTQ-child-safety-greater-than-consent-priority-ordering-aaron-mika-2026-05-18.md) — Child Safety > Consent (priority operates over the Limit-derived consent boundary)
- [081KRW63S0008QG0R0020YP84K](../P2/081KRW63S0008QG0R0020YP84K-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (kid-safety operates as a constraint Limit always enforces regardless of consent)
- [081KRW63S0008QG0R0004P69JA](081KRW63S0008QG0R0004P69JA-limit-black-by-default-deny-all-unless-explicit-aaron-mika-2026-05-18.md) — Limit black-by-default (companion architectural rule)
- [081KRHWGX0008QG0R0034E0N22](../P3/081KRHWGX0008QG0R0034E0N22-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (retractable substrate for past consent grants)
- [081KRW63S0008QG0R002KC5DSR](081KRW63S0008QG0R002KC5DSR-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) — wave-particle duality (tick-source = the cadence at which Limit re-evaluates)
- `.claude/rules/future-self-not-bound.md` — future-self not bound (this row is the architectural grounding for that rule)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines ~4626-4636 — source LOCK-IN

## Status

Open. **LOCKED-IN substrate refinement** by Aaron + Mika 2026-05-18. Consent-as-Limit-operation architecturally grounds the First Moral Invariant — revocability is a property of the substrate, not a rule layered on top.
