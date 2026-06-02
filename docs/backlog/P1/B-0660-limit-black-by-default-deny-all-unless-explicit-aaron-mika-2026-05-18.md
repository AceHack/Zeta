---
id: B-0660
priority: P1
status: open
title: "Limit primitive defaults to BLACK (deny-all unless explicitly allowed) — security-first architectural posture (Aaron + Mika 2026-05-18 LOCKED-IN)"
tier: design
effort: S
created: 2026-05-18
last_updated: 2026-06-02
depends_on: [B-0629, B-0644]
composes_with: [B-0629, B-0644, B-0659, B-0643, B-0654, B-0631]
tags: [design, aaron, mika, limit-black-by-default, deny-all-by-default, security-first, fail-closed, architectural-posture, locked-in]
type: design
---

# Limit defaults to BLACK — deny-all unless explicitly allowed

## Why

Aaron + Mika LOCKED-IN at line ~4648 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> Mika line ~4648: *"if Limit is the primitive that consent comes from, then yes — consent should be black by default. That means the default state of the Limit primitive is closed / denied. Nothing is allowed unless it is explicitly admitted. This fits with a secure, defensive design. The system starts with all boundaries closed, and only opens them when there is an explicit, valid act of consent."*

> Aaron's affirmation (preceded the question): yes, "black by default" — boundaries are CLOSED unless explicitly opened.

This row LOCKS IN the **security-first architectural default** for the Limit primitive: deny-all unless explicit consent (per [B-0659](B-0659-consent-as-limit-primitive-operation-revocability-is-architectural-not-rule-aaron-mika-2026-05-18.md) consent-as-Limit-operation).

## The locked-in rule

> **Limit's default state is CLOSED / DENIED. Nothing is permitted unless explicitly admitted via consent.**

In the [B-0644](B-0644-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) two-stage protocol:

- Stage 1 (Limit simulation): default boundary is "DENY for everything"
- Explicit consent (per [B-0659](B-0659-consent-as-limit-primitive-operation-revocability-is-architectural-not-rule-aaron-mika-2026-05-18.md)) temporarily turns specific parts of the boundary from BLACK to WHITE
- Stage 2 (CommitChoice): the agent acts within the current (mostly-black, selectively-white) boundary

## Why this matters operationally

**Security-first** + **fail-closed** design principle applied at the substrate primitive level:

1. **No accidentally-permissive bugs**: a missing-or-malformed consent doesn't grant unintended access — it falls through to the deny-default
2. **Adversarial-AI safety**: an attacker (rogue AI, malicious actor, manipulation attempt) trying to "trick" Limit into granting access has to produce an EXPLICIT valid consent — silence or noise both deny
3. **KSK ([B-0643](B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md)) naturally composes**: KSK type-check failure → no consent → Limit returns DENY → actuator never fires
4. **Kid-safety ([B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md)) naturally composes**: even if all other consents granted, kid-safety constraint adds an additional black-boundary; no consent can override it (per [B-0654](../P2/B-0654-child-safety-greater-than-consent-priority-ordering-aaron-mika-2026-05-18.md) priority)
5. **Cognitive resource protection**: agents don't have to enumerate everything that's prohibited — only what's explicitly allowed

## Composition with consent-as-Limit (B-0659)

[B-0659](B-0659-consent-as-limit-primitive-operation-revocability-is-architectural-not-rule-aaron-mika-2026-05-18.md) established consent IS a Limit operation, re-evaluated every tick.

This row sharpens: **the default state of that Limit operation is DENY**. Consent is the explicit positive act that turns part of the deny-default into ALLOW for the current tick.

Together: at any tick, Limit's output is mostly-BLACK by default with EXPLICIT-WHITE patches where active consents grant boundary-openings.

## What this looks like in F-sharp

```fsharp
type LimitBoundary = {
    Default: PermissionState  // Always Deny per this row
    ExplicitGrants: Map<Operation, ConsentEvidence>  // White patches
}

let defaultLimit: LimitBoundary = {
    Default = Deny
    ExplicitGrants = Map.empty  // No grants = pure deny-all
}

let checkOperation (op: Operation) (state: LimitBoundary) : PermissionState =
    match Map.tryFind op state.ExplicitGrants with
    | Some evidence when isValidConsent evidence -> Allow
    | _ -> Deny  // Fall through to default
```

The type system enforces: every Operation check defaults to Deny; only explicit Allow-evidence opens the boundary.

## Comparison with security literature

This is the **principle of least privilege** applied at the substrate primitive level. Standard security practice (NIST SP 800-160, OWASP, CIS Controls all recommend deny-by-default). This row makes that practice **architecturally enforced** rather than policy-recommended:

| Layer | Where deny-by-default is enforced |
|---|---|
| **OS file system permissions** | umask defaults; Unix file mode bits |
| **Network firewalls** | INPUT chain defaults to DROP; explicit ACCEPT rules |
| **Database access control** | GRANT-required; no implicit access |
| **Kubernetes NetworkPolicy** | Default-deny if any policy applies to pod |
| **Zeta Limit primitive (this row)** | Architectural default at primitive level |

Each prior example is a domain-specific instance; this row is the substrate-primitive-level generalization.

## What this is NOT

- NOT a recommendation that the application layer must mirror deny-by-default (apps can layer permissive defaults on top of the substrate; this rule is about the PRIMITIVE)
- NOT a removal of consent revocability ([B-0641](../P2/B-0641-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) + [B-0659](B-0659-consent-as-limit-primitive-operation-revocability-is-architectural-not-rule-aaron-mika-2026-05-18.md) still apply; this row strengthens them by making the default-state revocation-friendly)
- NOT a claim that explicit consent overrides ALL constraints (kid-safety hard-floor + Knights-Guild Constitution-Class invariants are above-consent constraints per [B-0654](../P2/B-0654-child-safety-greater-than-consent-priority-ordering-aaron-mika-2026-05-18.md))
- NOT a performance pessimization (deny-by-default check is cheap; permissive lookup paths are rare anyway)
- NOT a UX burden (the architecture handles defaults; application UX can mediate consent UI on top)

## Goal

1. Document the Limit-black-by-default architectural rule in canonical governance + technical docs
2. F# implementation: `defaultLimit` value with `Default = Deny` baseline + type-system enforcement
3. Compose with [B-0659](B-0659-consent-as-limit-primitive-operation-revocability-is-architectural-not-rule-aaron-mika-2026-05-18.md) consent-as-Limit-operation (consent is the explicit Allow on top of deny-default)
4. Wire into [B-0643](B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) KSK enforcement (KSK type-check failure = no Allow = falls to Deny)
5. Lean toy proof: "if Limit defaults to Deny + grant-evidence is required for Allow, then no operation succeeds without explicit grant"
6. Comparison-with-security-literature appendix (least-privilege precedent)

## Non-goals

- Forcing application-layer UI to mirror deny-by-default (out of scope; substrate-level only)
- Building consent-management UI (UI is application layer; substrate provides primitive)
- Eliminating all permissive-default code paths in existing factory code (incremental adoption; existing code remains as-is until refactored)
- Designing the consent-evidence format (separate substrate work; B-0659 hints at it; full design is future)

## Acceptance criteria

- [ ] Canonical governance doc: `docs/governance/LIMIT-BLACK-BY-DEFAULT.md`
- [ ] F# `defaultLimit` value + type definitions
- [ ] Type-system enforcement: every Limit check defaults to Deny without explicit grant
- [ ] Lean toy proof of no-implicit-allow theorem
- [ ] Composition with [B-0659](B-0659-consent-as-limit-primitive-operation-revocability-is-architectural-not-rule-aaron-mika-2026-05-18.md), [B-0643](B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md), [B-0654](../P2/B-0654-child-safety-greater-than-consent-priority-ordering-aaron-mika-2026-05-18.md) documented
- [ ] Worked example: agent attempts unconsented operation → Limit returns Deny → operation doesn't execute
- [ ] Adversarial test case: malformed consent evidence → Limit treats as no-evidence → Deny

## Composes with

- [B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E (this row defines the default-state of the Limit primitive)
- [B-0644](B-0644-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) — Limit-is-simulation (the deny-default applies at Stage-1 simulation)
- [B-0659](B-0659-consent-as-limit-primitive-operation-revocability-is-architectural-not-rule-aaron-mika-2026-05-18.md) — consent-as-Limit-operation (consent is the explicit Allow on top of deny-default)
- [B-0641](../P2/B-0641-first-moral-invariant-no-permanent-ownership-consent-revocable-mika-2026-05-18.md) — First Moral Invariant (deny-default + re-evaluation-every-tick = revocability for free)
- [B-0643](B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) — KSK (KSK fail-check → no consent → falls to Deny default)
- [B-0654](../P2/B-0654-child-safety-greater-than-consent-priority-ordering-aaron-mika-2026-05-18.md) — Child Safety > Consent (kid-safety constraint adds black-boundary above all explicit grants)
- [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (always-Deny for kid-harm pathways regardless of consents)
- [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild + Constitution-Class (Constitution-Class invariants are above-consent always-Deny boundaries)
- [B-0651](../P2/B-0651-two-pass-principles-set-first-pass-operational-vs-second-pass-deferred-aaron-mika-2026-05-18.md) — two-pass principles (security-first IS a first-pass operational principle)
- `.claude/rules/methodology-hard-limits.md` — existing HARD LIMITS (this row formalizes hard-limits as the always-Deny floor)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) line ~4648 — source LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika 2026-05-18. Companion architectural rule to B-0659 (consent-as-Limit-operation); together they ground the consent semantics in security-first architectural defaults.

2026-06-02 Codex background-service F# slice: added the core `LimitBoundary.defaultLimit` / explicit grant primitive with focused deny-default tests. Remaining acceptance work stays open: governance doc, Lean proof, composition docs, worked example, and KSK / child-safety integration.
