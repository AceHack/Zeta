---
id: 081KR7JY10008QG0R002DNV5WA
priority: P2
status: closed
title: 081KR7JY10008QG0R002DNV5WA — add heartbeat-file integrity section to THREAT-MODEL.md (builds on 081KQ3HBZ0008QG0R002ZPXAFQ.1 taxonomy)
tier: security-research
effort: S
depends_on: [081KQ3HBZ0008QG0R002ZPXAFQ.1]
parent: 081KQ3HBZ0008QG0R002ZPXAFQ
composes_with: [tools/security/heartbeat-attack-vectors.ts, docs/security/THREAT-MODEL.md]
tags: [security, threat-model, aminata, heartbeat-integrity, substrate-poisoning]
type: friction-reducer
created: 2026-05-10
last_updated: 2026-05-10

---

# 081KR7JY10008QG0R002DNV5WA — heartbeat-file integrity section in THREAT-MODEL.md

## What this row tracks

Add a dedicated "Agent substrate integrity (heartbeat-file poisoning)" section to
`docs/security/THREAT-MODEL.md`, grounded in the 5-vector taxonomy landed by 081KQ3HBZ0008QG0R002ZPXAFQ.1
(`tools/security/heartbeat-attack-vectors.ts`).

This is the second atomic child of 081KQ3HBZ0008QG0R002ZPXAFQ (parent: 081KQ3HBZ0008QG0R002ZPXAFQ heartbeat-file integrity
threat-model). 081KQ3HBZ0008QG0R002ZPXAFQ.1 built the machine-checkable TS taxonomy; 081KR7JY10008QG0R002DNV5WA lands that
taxonomy into the authoritative human-readable threat model surface, mirroring the
existing section pattern (supply-chain §30, channel-closure §37).

## Pre-start checklist (backlog-item-start-gate)

- **Prior-art search**: checked existing THREAT-MODEL.md — no heartbeat/agent-cognition
  section exists. The supply-chain (round-30) and channel-closure (round-37) section
  patterns are the closest analogues. 081KQ3HBZ0008QG0R002ZPXAFQ.1 taxonomy is at
  `tools/security/heartbeat-attack-vectors.ts` (merged PR #2390).
- **Dependency-restructure**: 081KQ3HBZ0008QG0R002ZPXAFQ.1 is merged (PR #2390, 2026-05-10). Parent 081KQ3HBZ0008QG0R002ZPXAFQ
  row updated to note both children. No circular depends_on. 081KR7JY10008QG0R002PKC6B0 (Aminata
  adversarial review) depends on this section existing.

## Implementation

Add `## Agent substrate integrity (heartbeat-file poisoning)` section to
`docs/security/THREAT-MODEL.md` after the "Channel-closure threats" section.
Section covers:

- Otto-339/340 grounding (substrate-poisoning = cognition-poisoning)
- The 5 attack vectors from 081KQ3HBZ0008QG0R002ZPXAFQ.1 taxonomy
- Current-state mitigations and tier gaps
- Branch-protection requirements for task #276 dependency

## Acceptance criteria

- [ ] Section lands in THREAT-MODEL.md with 5 attack vectors cross-referenced to
      `tools/security/heartbeat-attack-vectors.ts`
- [ ] Each vector has tier tagging (T0/T1/T2/T3) consistent with existing tables
- [ ] `dotnet build -c Release` 0W/0E
- [ ] `bunx tsc --noEmit` clean

## Owed after this lands

- 081KR7JY10008QG0R002PKC6B0: Aminata adversarial review (now has a surface to review)
- 081KQ3HBZ0008QG0R002ZPXAFQ.4: Task #276 update with blocker note pointing at 081KQ3HBZ0008QG0R002ZPXAFQ
