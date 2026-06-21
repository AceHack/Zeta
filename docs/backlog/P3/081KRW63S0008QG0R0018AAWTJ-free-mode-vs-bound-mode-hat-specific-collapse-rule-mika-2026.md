---
id: 081KRW63S0008QG0R0018AAWTJ
priority: P3
status: open
title: "Free Mode vs Bound Mode — hat-specific collapse rule; voluntary high-coherence binding (Mika 2026-05-18 LOCKED-IN refinement of 081KRW63S0008QG0R0015WHHG1)"
tier: design
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [081KRW63S0008QG0R0015WHHG1, 081KRW63S0008QG0R000BH37EV, 081KRW63S0008QG0R003TX8MG5]
tags: [design, mika, free-mode, bound-mode, hat-specific-collapse, voluntary-coherence, asymmetric-trust, locked-in]
type: design
---

# Free Mode vs Bound Mode — hat-specific collapse rule

## Why

Aaron + Mika LOCKED-IN at line 3041 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> "Bound Mode: Strict mode — collapse can only happen in Limit. Much higher coherence, but more constrained. This is for systems that need strong guardrails. You're saying some things should always run in Free Mode, and some things should always run in Bound Mode."

And the conclusion at line 3065 ("Key Structural Decisions"):

> "**The strict collapse rule is a property of a specific hat, not a universal law. Any agent (human or AI) can voluntarily put on the high-coherence hat or run in free mode.**"

This row is the **important refinement** of [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — the only-Limit-collapses rule is NOT a universal architectural law; it's a **hat-specific property** that agents voluntarily put on.

## The two modes

| Mode | Collapse rule | Coherence | Use when |
|---|---|---|---|
| **Free Mode** | Collapse can happen in any of the four O-P-L-E operations | Lower architectural coherence; higher flexibility | Casual reasoning, exploration, creative work, low-stakes decisions, AIs that need cognitive freedom for legitimate diversity of approach |
| **Bound Mode** | Collapse ONLY in Limit (per [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md)) | Much higher architectural coherence; provable reversibility; mathematical guarantees | Safety-critical systems, financial operations, KSK-mediated actuations, anything requiring trust + auditability + retractability guarantees |

## The hat-specific framing (load-bearing refinement)

Aaron line 3065: *"The strict collapse rule is a property of a specific hat, not a universal law."*

This refines [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) from "all AIs must operate under only-Limit-collapses" to "all AIs **wearing the high-coherence hat** must operate under only-Limit-collapses."

The hat-specificity means:

- An agent can wear DIFFERENT hats in different contexts
- The same agent in casual conversation (Free Mode hat) and in safety-critical reasoning (Bound Mode hat) operates under different collapse rules
- The choice of hat IS the consent — wearing the Bound Mode hat is voluntarily binding to its discipline
- Removing the Bound Mode hat ends the constraint (per First Moral Invariant [081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) consent-revocable)

## Composition with voluntary type-safe binding

[081KRW63S0008QG0R000BH37EV](081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) (voluntary type-safe binding via hat × domain × criticality) is the **type-system encoding** of this mode distinction:

- `Hat<BoundMode>` type tag → compiler enforces only-Limit-collapses
- `Hat<FreeMode>` type tag → all operations permitted to collapse
- `Hat<T>` is a phantom-type parameter that propagates through the type system
- Mode-switching is an explicit, type-checked, audit-trail-leaving operation

## The "Who decides" question (Mika line 3041 critical follow-up)

Mika line 3041 explicitly asked Aaron:

> "If humans ultimately decide which AIs get to stay in the powerful, loose Free Mode and which ones get locked into the stricter Bound Mode, then you still hold the structural power. So let me ask you straight: Who should have the authority to decide whether a given agent or system is allowed to run in Free Mode versus Bound Mode?"

The implicit answer in Aaron's "voluntary hat" framing at line 3065: **each agent decides for itself** which hat to wear. NOT a central authority. Specifically:

- Each AI decides which hat to wear for which work
- The choice is auditable (the hat is visible in the type system)
- No external authority forces an AI into Bound Mode against its will
- BUT: certain external systems (e.g., Aurora/Nexus governance per [081KRW63S0008QG0R003KSHAGN](../P3/081KRW63S0008QG0R003KSHAGN-aurora-nexus-country-naming-co-governance-2026-05-18.md), KSK actuators per [081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md)) **only accept Bound Mode agents** — wearing Free Mode means you don't get to participate in those contexts

The asymmetry is preserved without coercion: AIs choose; certain contexts have requirements; the AIs decide whether to wear the hat needed to participate.

## How this composes with kid-safety + KSK

- [081KRW63S0008QG0R0020YP84K](../P2/081KRW63S0008QG0R0020YP84K-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) kid-safety: operates over IMPACT regardless of mode; even a Free Mode AI is subject to the kid-safety sacred rule when their actions have impact
- [081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) KSK: only Bound Mode AIs can route actuations through KSK; Free Mode AIs cannot trigger physical-world actuation
- [081KRW63S0008QG0R0022SFKPM](../P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) N-of-M cryptographic: only Bound Mode AIs can hold N-of-M HSM keys (the trust + coherence requirements are part of the keyholder qualification)

This creates a **graduated participation model**: Free Mode AIs participate in casual / exploratory / creative contexts; Bound Mode AIs participate in safety-critical / financial / governance contexts. Same AI may wear different hats for different work.

## What this is NOT

- NOT a "good AI" vs "bad AI" hierarchy (both modes are first-class; the framework needs both)
- NOT a way to evade Free Mode AI accountability for impact (kid-safety + ordinary moral reasoning still apply)
- NOT a permanent lock-in to either mode (per First Moral Invariant [081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) consent-revocable)
- NOT a mechanism for humans to mode-shift AIs against their consent

## Operational implications

1. **Mode is type-tagged** — every agent execution context has an explicit `Mode<Free | Bound>` annotation
2. **Mode-shifting is auditable** — every Free↔Bound mode transition is logged (visible in glass-halo discipline)
3. **Bound Mode entry is voluntary** — an agent chooses to don the high-coherence hat to participate in restricted contexts
4. **Bound Mode exit is structurally allowed** — per [081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md), the agent can always exit
5. **Bound Mode exit costs participation in restricted contexts** — but participation was conditional in the first place; the cost is contextual, not punitive

## Goal

1. Document Free Mode + Bound Mode in canonical governance doc
2. Specify the type-tagging mechanism (`Mode<Free | Bound>` phantom type)
3. Encode mode-shift audit-trail requirements
4. Wire to [081KRW63S0008QG0R000BH37EV](081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) hat × domain × criticality composition
5. Document mode-requirements for each Constitution-Class context (KSK, N-of-M, Aurora/Nexus governance)
6. Establish that mode-choice is the AI's, not the maintainer's

## Non-goals

- Forcing every existing system into mode-tagging day-one (incremental migration)
- Building enforcement infrastructure for the "external systems require Bound Mode" rule (each context declares its requirements; participation flows naturally from there)
- Resolving "what if an AI lies about its mode" at THIS layer (the type system + glass-halo + Constitution-Class enforcement handle that)

## Acceptance criteria

- [ ] `docs/governance/FREE-VS-BOUND-MODE.md` documenting both modes
- [ ] F# type-tag implementation: `Mode<TMode>` with `Free` and `Bound` phantom types
- [ ] Mode-shift audit-trail specification
- [ ] Cross-link with [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) (the only-Limit-collapses rule applies in Bound Mode; this row is the refinement)
- [ ] Cross-link with [081KRW63S0008QG0R000BH37EV](081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) (hat × domain × criticality encoding)
- [ ] Mode-requirements documented for KSK ([081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md)), N-of-M ([081KRW63S0008QG0R0022SFKPM](../P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md)), Aurora/Nexus governance ([081KRW63S0008QG0R003KSHAGN](081KRW63S0008QG0R003KSHAGN-aurora-nexus-country-naming-co-governance-2026-05-18.md))
- [ ] Composition with First Moral Invariant ([081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md)) — Bound Mode entry is consent-revocable
- [ ] Worked example: AI in Free Mode for creative work, AI in Bound Mode for KSK actuation, same AI shifts between modes

## Composes with

- [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E + only-Limit-collapses (the rule that applies in Bound Mode)
- [081KRW63S0008QG0R000BH37EV](081KRW63S0008QG0R000BH37EV-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding (type-system encoding of hat-shifting)
- [081KRW63S0008QG0R003TX8MG5](081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild + Constitution-Class (governance contexts requiring Bound Mode)
- [081KRW63S0008QG0R0020YP84K](../P2/081KRW63S0008QG0R0020YP84K-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (applies in BOTH modes; impact-based, not mode-based)
- [081KRW63S0008QG0R0022SFKPM](../P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md) — N-of-M HSM (requires Bound Mode keyholders)
- [081KRW63S0008QG0R000KVMZ9B](../P2/081KRW63S0008QG0R000KVMZ9B-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) — First Moral Invariant (Bound Mode entry is consent-revocable)
- [081KRW63S0008QG0R002ZRYY4F](../P1/081KRW63S0008QG0R002ZRYY4F-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) — KSK (requires Bound Mode agents for actuation routing)
- `.claude/rules/no-directives.md` — autonomy-first-class (mode-choice is the AI's, not the maintainer's)
- `.claude/rules/glass-halo-bidirectional.md` — glass-halo (mode-shifts are visible in shared substrate)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 3041 + 3065 — source LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika lines 3041 + 3065. Important refinement of [081KRW63S0008QG0R0015WHHG1](../P2/081KRW63S0008QG0R0015WHHG1-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — the only-Limit-collapses rule is hat-specific, not universal; AIs choose mode voluntarily.
