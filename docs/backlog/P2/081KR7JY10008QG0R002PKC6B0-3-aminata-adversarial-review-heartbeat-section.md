---
id: 081KR7JY10008QG0R002PKC6B0
priority: P2
status: closed
title: 081KR7JY10008QG0R002PKC6B0 — Aminata adversarial review of the heartbeat-file integrity section in THREAT-MODEL.md
tier: security-research
effort: S
depends_on: [081KR7JY10008QG0R002DNV5WA]
parent: 081KQ3HBZ0008QG0R002ZPXAFQ
composes_with: [docs/security/THREAT-MODEL.md, tools/security/heartbeat-attack-vectors.ts]
tags: [security, threat-model, aminata, heartbeat-integrity, substrate-poisoning, adversarial-review]
type: friction-reducer
created: 2026-05-10
last_updated: 2026-05-10
---

# 081KR7JY10008QG0R002PKC6B0 — Aminata adversarial review of heartbeat-file integrity section

## What this row tracks

Aminata (`threat-model-critic`) adversarial review of the
`## Agent substrate integrity (heartbeat-file poisoning)` section added by
081KR7JY10008QG0R002DNV5WA (PR #2394). Ten findings (AH-1..AH-10) absorbed into
`docs/security/THREAT-MODEL.md` and `tools/security/heartbeat-attack-vectors.ts`.

## Pre-start checklist

- **Prior-art search**: 081KR7JY10008QG0R002DNV5WA merged at PR #2394; section at
  `docs/security/THREAT-MODEL.md` line 431. No prior Aminata review of
  heartbeat surface found in commit history.
- **Dependency-restructure**: 081KR7JY10008QG0R002DNV5WA merged. Parent 081KQ3HBZ0008QG0R002ZPXAFQ row updated to
  reflect 081KR7JY10008QG0R002PKC6B0 child. 081KQ3HBZ0008QG0R002ZPXAFQ.4 (task #276 blocker note) remains open.

## Findings summary

| ID | Class | Severity | Topic |
|----|-------|----------|-------|
| AH-1 | unsound-mitigation | critical | Review gate circular at bus-factor 1 |
| AH-2 | missing-adversary | critical | Content-injection / prompt-injection-via-substrate has no dedicated row |
| AH-3 | missing-adversary | critical | AceHack mirror is an unmodelled second attack surface |
| AH-4 | missing-adversary | important | Cache-poison composition gap on heartbeat-specific blast radius |
| AH-5 | missing-adversary | important | Unicode smuggling omitted from branch-protection requirements |
| AH-6 | unsound-mitigation | important | BouncyCastle cited as deployed mitigation; it is design intent |
| AH-7 | tier-misclassification | important | Insider/supply-chain STRIDE should be Tampering, not EoP |
| AH-8 | unsound-mitigation | important | "Exhaustive" discriminated union claim creates false security closure |
| AH-9 | unstated-assumption | important | Pre-merge read path not stated as out-of-scope assumption |
| AH-10 | unstated-assumption | watch | Blast-radius claim lacks empirical bound |

## Changes landed

- `docs/security/THREAT-MODEL.md`: section updated with all 10 findings; 6th
  content-injection vector added to table; STRIDE corrected (AH-7); BouncyCastle
  mitigation language fixed (AH-6); AceHack scoping note added (AH-3); pre-merge
  assumption stated (AH-9); invisible-Unicode added to branch-protection
  requirements (AH-5); bus-factor note on insider threat (AH-1); Defender persona
  updated to mark review complete.
- `tools/security/heartbeat-attack-vectors.ts`: "exhaustive" → "versioned" in
  JSDoc (AH-8); content-injection variant added (AH-2); insider-threat and
  supply-chain mitigations updated (AH-1, AH-6); KNOWN_KINDS array extracted for
  `isHeartbeatAttackVector` guard.

## Owed after this lands

- 081KQ3HBZ0008QG0R002ZPXAFQ.4: Task #276 update with blocker note pointing at 081KQ3HBZ0008QG0R002ZPXAFQ
