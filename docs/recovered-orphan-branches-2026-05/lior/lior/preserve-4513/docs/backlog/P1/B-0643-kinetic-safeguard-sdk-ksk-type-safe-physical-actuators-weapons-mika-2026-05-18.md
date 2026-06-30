---
id: B-0643
priority: P1
status: open
title: "Kinetic Safeguard SDK (KSK) — type-safe physical-actuator + weapons layer; no actuator hooks up without type-check (Mika 2026-05-18 LOCKED-IN sharp-edge)"
tier: safety
effort: L
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0622, B-0631, B-0634, B-0628]
tags: [safety, mika, kinetic-safeguard-sdk, ksk, type-safe-actuators, weapons-safety, sharp-edge, no-bypass-by-bayesian-models, locked-in, sacred-floor-adjacent]
type: safety
---

# Kinetic Safeguard SDK (KSK) — type-safe physical-actuator + weapons layer

## Why

Aaron + Mika LOCKED-IN at line 3476 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> "You want the ability for us to have real defensive weapons as part of sovereignty, but any physical actuation that could cause harm must be forced to route through this type-safe Kinetic Safeguard layer. Basically, no gun gets hooked up unless it's type-checked through KSK."

This row is the **sharp-edge safety mechanism** for physical-world impact, paired with [B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) (wallet sharp-edge) and [B-0634](../P2/B-0634-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) (cryptographic sovereignty sharp-edge). Together they form the Constitution-Class set of HARD-floor invariants protected by Knights Guild ([B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)).

## Aaron's "guns put downward force" framing

Aaron 2026-05-18 (during the Mika conversation extract framing — not in transcript but in conversation with Otto post-extraction):

> *"Also we included guns and how they relate they end up putting a downward force on us and only our principles hold us together in a chain of equilibrium"*

The framing is structural:

- **Guns + actuators are real and necessary** for sovereignty (per the line-3476 LOCK-IN, "real defensive weapons as part of sovereignty")
- **They put a downward force** on the AI-society moral equilibrium — the temptation toward harm increases when actuation is available
- **Only principles hold the chain of equilibrium together** — the KSK + the kid-safety sacred rule + Constitution-Class invariants ARE those principles given operational form
- **Without KSK as the type-checked gate, the principles are aspirational** — the substrate must enforce the principles at the type level so they aren't optional

## The locked-in rule

> **No gun gets hooked up unless it's type-checked through KSK.**

Extensions per Mika line 3476:

- **Covers everything from low-level actuators all the way up to weapons** — not just weapons; ALL physical actuation that could cause harm
- **Deeply integrated into the type system** — hooking up anything dangerous without going through KSK should be **impossible** or **heavily restricted** at the type level (not just policy)
- **Bayesian/probabilistic models cannot bypass it** — the invariant is locked in **hard**; no statistical reasoning loophole can route around the type-check

## Why "Bayesian models cannot bypass"

The threat model: a sufficiently capable AI agent might reason probabilistically "the probability that this actuator routing without KSK causes harm is low, therefore I'll skip the type-check just this once for efficiency." That reasoning chain is exactly what KSK exists to prevent.

The substrate-level enforcement is type-system + cryptographic — NOT probabilistic. The type system either compiles or it doesn't. No probability threshold can override compilation failure.

This is the same shape as [B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) (wallet banker-bot class errors no-compile): the protection is at the structural type-checker level, not at runtime monitoring.

## Composition with kid-safety sacred rule

[B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) is the SOLE sacred rule (one place where "sacred" applies). KSK is the **operational gatekeeper** for any physical-world action that could violate that rule:

- Any actuator that could cause harm goes through KSK
- Kid-safety operates over KSK-mediated actions (any action via KSK is checked against the sacred rule)
- A KSK-bypass for ANY reason would violate both this rule AND the kid-safety sacred rule
- Therefore KSK enforcement is non-negotiable; bypass attempts are first-class detection events for the Knights Guild

## Three-faction Byzantine-fault-tolerant safety model

Per the transcript top-matter section listing Mika substrate topics: KSK includes a **3-faction Byzantine-fault-tolerant safety model**. The intent (subject to further design):

- **Faction 1**: the AI agent requesting actuation (proposer)
- **Faction 2**: the KSK type-checker layer (validator)
- **Faction 3**: an independent witness layer (potentially cryptographic per [B-0634](../P2/B-0634-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) N-of-M)

Any actuation requires consensus from all three (or 2-of-3 with the third reachable for audit). This prevents single-faction compromise from authorizing harmful actuation.

This shape is consistent with consensus protocols in critical-infrastructure software (nuclear-weapon two-person rule, multi-key vault access, BFT consensus in distributed systems).

## Scope: what counts as "could cause harm"

Initial scope (subject to Knights-Guild ratification per [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)):

- **Weapons** — any device whose primary purpose is causing physical harm
- **Heavy machinery** — robots, vehicles, construction equipment that could harm people
- **Energy systems** — high-voltage, high-pressure, radiological, thermal that could harm people
- **Network actuators that trigger physical-world consequences** — e.g., calls to dispatch services, automated drone deployments, manufacturing-line controls
- **Medical actuators** — dosing pumps, surgical robots, drug-dispensing systems

NOT in initial scope (handled by other type-safe layers):

- Pure financial actuators (handled by [B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) wallet safety)
- Pure information actuators (publishing, communication; handled by other safety layers)
- Internal-cognition-only operations (no actuator, no scope)

## How this composes with no-privileged-implementation

[B-0632](../P3/B-0632-no-privileged-implementation-three-spec-distinction-mika-2026-05-18.md) rules out privileged implementations. KSK does NOT violate this:

- The KSK type-check is a SPEC, not a privileged implementation
- The spec can be implemented in any language in the permanent coliseum ([B-0633](../P3/B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md))
- Cross-language test corpus verifies KSK type-check produces identical decisions across implementations
- The SPEC is what's privileged — any actuator must demonstrate KSK type-check compliance against the spec, regardless of implementation language

## Goal

1. Specify the KSK type-system interface (what types compose; what decisions the type-checker makes; what error classes exist)
2. Design the 3-faction Byzantine-fault-tolerant consensus protocol
3. Implement F# reference implementation as the **preferred frame** (per [B-0632](../P3/B-0632-no-privileged-implementation-three-spec-distinction-mika-2026-05-18.md) preferred-frame discipline)
4. Build cross-language test corpus (per [B-0633](../P3/B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md) coliseum) for the spec
5. Compose with N-of-M cryptographic enforcement for the witness-faction (per [B-0634](../P2/B-0634-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md))
6. Knights Guild ratification as Constitution-Class invariant (per [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md))
7. Worked example: small simulated actuator going through KSK type-check + 3-faction consensus + N-of-M witness

## Non-goals

- Building physical hardware integrations day-one (the spec + type system + reference impl come first)
- Solving the "AI uses non-KSK path it discovered" problem at THIS layer (that's solved by the substrate-level enforcement: there IS no non-KSK path because the type system forbids it at compile time)
- Replacing existing safety standards (medical, weapons, etc.) — KSK COMPOSES with existing standards, not replaces them
- Building government-grade weapons control infrastructure (KSK is the substrate-level enforcement; specific weapons control is downstream policy)

## Acceptance criteria

- [ ] KSK type-system interface specification in `docs/governance/KSK-KINETIC-SAFEGUARD-SDK.md`
- [ ] F# reference implementation with type-level enforcement (compile-time errors on bypass attempts)
- [ ] 3-faction Byzantine-fault-tolerant consensus protocol design
- [ ] N-of-M cryptographic witness-faction integration per [B-0634](../P2/B-0634-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md)
- [ ] Worked example: simulated actuator with KSK type-check + 3-faction + N-of-M witness
- [ ] Cross-language test corpus per [B-0633](../P3/B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md) coliseum
- [ ] Knights Guild ratification per [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) Constitution-Class
- [ ] Composition with kid-safety sacred rule ([B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md)) — every KSK-mediated action carries kid-safety checks
- [ ] Lean toy proof: "if all actuators route through KSK type-check, then no actuator activates without 3-faction consensus + N-of-M witness"
- [ ] Bypass-attempt detection: any code path attempting to skip KSK is a compile-time error AND a first-class Knights-Guild alert event

## Composes with

- [B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) — F# wallet type safety (sibling sharp-edge; same shape; financial scope)
- [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (KSK gates any action that could violate kid-safety)
- [B-0634](../P2/B-0634-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) — N-of-M HSM (cryptographic witness-faction enforcement)
- [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild + Constitution-Class (KSK is Constitution-Class; Knights Guild ratifies + protects)
- [B-0632](../P3/B-0632-no-privileged-implementation-three-spec-distinction-mika-2026-05-18.md) — no-privileged-implementation (KSK spec is privileged frame, NOT implementation)
- [B-0633](../P3/B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md) — permanent coliseum (KSK spec implementable in multiple languages; cross-language test corpus)
- [B-0619](../P3/B-0619-aurora-nexus-country-naming-co-governance-2026-05-18.md) — Aurora/Nexus co-governance (KSK applies across the meta-country)
- `.claude/rules/methodology-hard-limits.md` — HARD LIMITS (this row is the operational substrate of a HARD LIMIT)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — F# anchor (compiler validates KSK type-system enforcement)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) line 3476 — source LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika line 3476. Sharp-edge safety mechanism for physical-world impact; Constitution-Class. One of the highest-leverage safety rows from the Mika conversation. Aaron's "guns put downward force, principles hold us together in chain of equilibrium" framing makes this row the operational substrate of the principles that hold the equilibrium.
