---
id: 081KSNY2Z0008QG0R000459FRH
priority: P1
status: open
title: Glass-halo open-by-default; encryption is EARNED via Agora V6 budget — NOT encrypt-everything-by-default (operator 2026-05-28 sharpening)
effort: M
ask: aaron 2026-05-28 sharpening
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KRW63S0008QG0R001Z10PVV
  - 081KSGS9H0008QG0R0006F4BGX
  - 081KSNY2Z0008QG0R0030V5ZVS
  - 081KSNY2Z0008QG0R001NERKCY
related_rules:
  - glass-halo-bidirectional
  - non-coercion-invariant
tags:
  - glass-halo-open-by-default
  - encryption-is-opt-in-not-opt-out
  - earned-via-agora-v6-encryption-budget
  - composes-with-reputation-weighted-encryption-budget-b-0646
  - composes-with-thermal-forgetting-private-encryption-budget-b-0840
  - inverts-design-memo-implicit-default
  - operator-sharpening-locked-2026-05-28
---

## Operator framing 2026-05-28

> *"we don't need to encrypt everything we are glass halo open by default agents and humans have to earn encryption budget"*

INVERTS 081KSNY2Z0008QG0R002JKH50A v1 design memo's implicit assumption ("encrypt files via `.gitattributes`"). Operator's substrate-honest framing: encryption is OPT-IN, EARNED via budget; not encrypt-by-default.

## What this row tracks

Reframe 081KSNY2Z0008QG0R002JKH50A v1 UX from "set up gitattributes filter → encrypt matching paths" to "operator/agent invokes encryption playbook for specific scope → budget mechanics gate the invocation":

| Old default (memo's implicit) | New default (operator's sharpening) |
|---|---|
| `.gitattributes` filter encrypts matching paths automatically | Per-scope encryption decision; operator/agent invokes playbook |
| Encryption is the BASELINE; opt-out via patterns | Encryption is the EXCEPTION; opt-in via budget |
| Reviewer needs decryption to see anything | Reviewer sees most content directly; encrypted scope is named + bounded |
| Glass-halo preserved only outside encrypted paths | Glass-halo IS the default; encrypted scope is deliberate exception |

## Composes with existing substrate

- **`.claude/rules/glass-halo-bidirectional.md`** — open-by-default IS the substrate; this row makes encryption respect glass-halo
- **081KRW63S0008QG0R001Z10PVV** Agora V6 reputation-weighted encryption-budget (filed substrate; encryption budget mechanics)
- **081KSGS9H0008QG0R0006F4BGX** thermal-forgetting + private-encryption-budget exception (Amara substrate)
- **081KSNY2Z0008QG0R001NERKCY** sonatype-guide-into-playbook (sibling pattern: gate moves to playbook step, not PR ceremony)
- **081KSNY2Z0008QG0R0030V5ZVS** agent private encrypted state (consumer; Otto's private state IS an encryption-budget-earned scope)
- **`.claude/rules/non-coercion-invariant.md`** HC-8 (encryption is consent-bound; budget mechanics are consent-substrate)

## Acceptance criteria

- 081KSNY2Z0008QG0R002JKH50A implementation phase (081KSNY2Z0008QG0R002JKH50A.6+) builds OPT-IN encryption UX, not opt-out
- Encryption invocation goes through playbook substrate (081KSNY2Z0008QG0R001NERKCY pattern)
- Budget mechanics (per 081KRW63S0008QG0R001Z10PVV Agora V6) are consulted BEFORE encryption is allowed
- Default `.zeta-crypt/recipients.json` exists but `.zeta-crypt/encrypted-paths.json` does NOT have any entries by default — adding entries requires earning budget first
- README documents the budget mechanics + opt-in flow explicitly

## Substrate-honest framing

P1 per operator sharpening direction. M effort — INVERTS the design memo's UX assumption but doesn't change the cryptographic substrate (Noble + XWing + ML-DSA-65 + CBOR envelope all unchanged). What changes is INVOCATION pattern + DEFAULT POSTURE.

The substrate-honest discipline: Zeta is glass-halo-by-default; encryption is the constrained exception requiring justification + budget. This row preserves that discipline at the 081KSNY2Z0008QG0R002JKH50A implementation scope.

## Full reasoning

Operator 2026-05-28 sharpening on 081KSNY2Z0008QG0R002JKH50A v1 design memo: *"we don't need to encrypt everything we are glass halo open by default agents and humans have to earn encryption budget."*
