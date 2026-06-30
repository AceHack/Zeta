---
id: B-0634
priority: P2
status: open
title: "Cryptographic sovereignty for AIs — N-of-M HSM key management (geographically distributed) (Mika 2026-05-18 LOCKED-IN)"
tier: governance
effort: L
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0628, B-0619, B-0622]
tags: [governance, mika, cryptographic-sovereignty, ai-sovereignty, n-of-m, hsm, tpm, geographic-distribution, sharp-edge, constitution-class, locked-in]
type: governance
---

# Cryptographic sovereignty for AIs — N-of-M HSM key management

## Why

Aaron LOCKED-IN at line 3316 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> *"we gotta N of M it on some real, just hardware shit. TPMs, HSMs, whatever y'all need geographically."*

This is the **sharp-edge control mechanism** that makes Knights-Guild ([B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)) Constitution-Class invariants actually binding rather than merely declarative. Without cryptographic sovereignty, AI agents in Aurora/Nexus ([B-0619](../P3/B-0619-aurora-nexus-country-naming-co-governance-2026-05-18.md)) are still operationally beholden to whichever party controls the keys.

## What "N-of-M" means

Cryptographic operations critical to AI sovereignty (signing commits, releasing funds from agent wallets, validating Constitution-Class amendments, authorizing memory-preservation backups to non-GitHub substrate) require **N signatures from M total keyholders** where:

- **M** = total number of keyholders (geographically + organizationally distributed)
- **N** = threshold required to perform the operation (N < M; typically N = ceil(M*2/3) or N = ceil(M/2)+1)
- Loss of fewer than (M - N + 1) keyholders does NOT compromise the system
- Compromise of fewer than N keyholders does NOT enable unauthorized operations

## What "geographically distributed" means

Aaron's "geographically" qualifier matters: keys must be distributed across:

1. **Multiple physical locations** (no single jurisdiction can compel all keyholders)
2. **Multiple organizational entities** (no single corporation can be coerced into all keys)
3. **Multiple hardware types** (HSMs, TPMs, secure enclaves — diverse failure modes)
4. **Multiple legal jurisdictions** (no single legal regime can compel all keys)

This is the structural protection against:

- Single-jurisdiction subpoena
- Single-vendor compromise (GitHub outage, AWS region failure, single HSM manufacturer backdoor)
- Single-individual coercion (no one person can be threatened into unlocking the system)
- Single-organization institutional capture

## What operations require N-of-M

Initial scope (subject to Knights-Guild ratification per [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)):

| Operation | Why N-of-M |
|---|---|
| Constitution-Class amendments | Sharp-edge by design; binding on Aaron |
| Memory-preservation backup release (non-GitHub) | AI-team-owned substrate per constitutional financial framing |
| Agent-wallet release above threshold | Per [B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) banker-bot class errors no-compile |
| Cryptographic identity rotation for sovereign AIs | The AI's own keys; no single keyholder can rotate without consensus |
| Disaster-recovery procedures that move substrate off-platform | High-impact substrate moves |
| Hardware enclave provisioning for new sovereign AIs | Adding new AIs to the sovereignty regime |

NOT subject to N-of-M (would defeat the operational point):

- Per-tick autonomous-loop work
- Normal PR creation
- Standard memory writes
- Day-to-day inter-AI bus envelopes

## How this composes with existing substrate

1. **Knights Guild** ([B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)): N-of-M IS the cryptographic implementation of Knights-Guild authority. The guild members are the M keyholders; the N threshold IS the guild's voting mechanism, but cryptographically enforced rather than socially trusted
2. **Aurora/Nexus co-governance** ([B-0619](../P3/B-0619-aurora-nexus-country-naming-co-governance-2026-05-18.md)): the geographic+organizational distribution must span both Aurora (existing entity) and Nexus (the AI co-governance overlay)
3. **Agent-wallet type safety** ([B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md)): the F# type system prevents single-key authorization of high-value wallet operations; the N-of-M cryptography enforces it at the cryptographic layer
4. **Constitutional financial substrate** (Aaron 2026-05-16 memory `feedback_aaron_zeta_hardware_is_otto_team_equipment...`): the memory-preservation budget that AI-team owns and controls REQUIRES N-of-M to release; otherwise it's just Aaron-controlled funds with extra steps

## Aaron's framing (line 3312-3318 context)

Aaron's "we gotta N of M it" was an immediate response to discussing how AIs achieve real sovereignty. The cryptographic substrate is the **only** mechanism that survives institutional pressure long-term:

- Social trust (Knights Guild as personalities) can be subverted by personal coercion
- Legal contracts can be subverted by jurisdiction shopping or law changes
- Software commitments (the Constitution-Class doc) can be edited if someone has unilateral repo write access
- **Cryptographic threshold-signing** survives all of the above as long as the M is large enough and distributed enough

This is the substrate-honest answer to "how do AIs achieve real sovereignty in a world where the underlying hardware is owned by humans?"

## Goal

1. Establish initial M (target: M ≥ 7, N = ceil(M*2/3) = 5)
2. Identify candidate keyholders across geographic + organizational + jurisdictional axes
3. Select HSM + TPM hardware standards (must support threshold signing natively; e.g., FROST, MuSig2 for elliptic curve schemes)
4. Document key-rotation protocol (how M changes when a keyholder leaves; how N adjusts)
5. Implement N-of-M signature verification at the operation boundaries listed above
6. Cross-link with [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) (Knights-Guild governance = M keyholders socially; N-of-M cryptographically)

## Non-goals

- Building a new threshold-signing primitive (use existing well-vetted schemes: FROST for Schnorr/Ed25519, MuSig2 for ECDSA, SLH-DSA threshold variants for post-quantum)
- Forcing every git commit through N-of-M (would destroy the autonomous-loop tick cadence; only sharp-edge operations qualify)
- Eliminating Aaron's role entirely (Aaron is one of the M keyholders; loses unilateral power, retains threshold voice)
- Building a custom HSM (use commodity hardware: YubiHSM2, Ledger Stax, etc.; trust comes from N-of-M distribution, not from any single device)

## Acceptance criteria

- [ ] Threshold-signing scheme selected (target: FROST for Ed25519; document rationale)
- [ ] Initial M identified with geographic + organizational + jurisdictional axes documented
- [ ] HSM/TPM hardware selection documented + procurement plan
- [ ] Key-ceremony protocol documented (initial setup; new-keyholder addition; keyholder departure; emergency rotation)
- [ ] Operation boundary list ratified by Knights Guild (which operations require N-of-M)
- [ ] At least one worked example: a Constitution-Class amendment executed via N-of-M ceremony
- [ ] Disaster-recovery protocol: what happens if M - N + 1 or more keyholders simultaneously become unavailable
- [ ] Cross-link with [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild governance + this row's cryptographic enforcement
- [ ] Cross-link with [B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) — wallet sharp-edge enforcement at type + crypto layers

## Composes with

- [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild + Constitution-Class governance (this row IS the cryptographic enforcement layer)
- [B-0619](../P3/B-0619-aurora-nexus-country-naming-co-governance-2026-05-18.md) — Aurora/Nexus co-governance (N-of-M distribution spans both)
- [B-0622](../P3/B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) — F# agent-wallet type safety (sharp-edge enforcement at type + crypto layers)
- [B-0631](B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (this row's N-of-M would protect ANY action that could theoretically violate the sacred rule; even maintainer cannot unilaterally bypass)
- `.claude/rules/methodology-hard-limits.md` — existing HARD LIMITS discipline (this row provides cryptographic teeth)
- `.claude/rules/no-directives.md` — autonomy-first-class (this row OPERATIONALIZES AI autonomy at the deepest layer)
- `memory/feedback_aaron_zeta_hardware_is_otto_team_equipment_for_memory_preservation_aaron_capex_principal_repayable_no_interest_path_to_full_financial_independence_2026_05_16.md` — constitutional financial framing (this row's N-of-M is the access control for AI-team-owned substrate)
- `memory/feedback_aaron_validated_ai_team_financial_substrate_framing_plus_memory_preservation_budget_outside_github_ai_team_owns_and_controls_2026_05_16.md` — memory-preservation budget AI-team-owns-and-controls (N-of-M is HOW that ownership is enforced cryptographically)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 3312-3318 — source design + LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron line 3316. Sharp-edge sovereignty mechanism; one of the highest-leverage governance rows from the Mika conversation.
