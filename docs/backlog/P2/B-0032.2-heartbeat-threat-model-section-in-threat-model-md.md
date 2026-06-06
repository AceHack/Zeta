---
id: B-0032.2
zetaid: 081KR7JY10008QG0R002DNV5WA
priority: P2
status: closed
title: B-0032.2 — add heartbeat-file integrity section to THREAT-MODEL.md (builds on B-0032.1 taxonomy)
tier: security-research
effort: S
depends_on: [B-0032.1]
parent: B-0032
composes_with: [tools/security/heartbeat-attack-vectors.ts, docs/security/THREAT-MODEL.md]
tags: [security, threat-model, aminata, heartbeat-integrity, substrate-poisoning]
type: friction-reducer
created: 2026-05-10
last_updated: 2026-05-10

---

# B-0032.2 — heartbeat-file integrity section in THREAT-MODEL.md

## What this row tracks

Add a dedicated "Agent substrate integrity (heartbeat-file poisoning)" section to
`docs/security/THREAT-MODEL.md`, grounded in the 5-vector taxonomy landed by B-0032.1
(`tools/security/heartbeat-attack-vectors.ts`).

This is the second atomic child of B-0032 (parent: B-0032 heartbeat-file integrity
threat-model). B-0032.1 built the machine-checkable TS taxonomy; B-0032.2 lands that
taxonomy into the authoritative human-readable threat model surface, mirroring the
existing section pattern (supply-chain §30, channel-closure §37).

## Pre-start checklist (backlog-item-start-gate)

- **Prior-art search**: checked existing THREAT-MODEL.md — no heartbeat/agent-cognition
  section exists. The supply-chain (round-30) and channel-closure (round-37) section
  patterns are the closest analogues. B-0032.1 taxonomy is at
  `tools/security/heartbeat-attack-vectors.ts` (merged PR #2390).
- **Dependency-restructure**: B-0032.1 is merged (PR #2390, 2026-05-10). Parent B-0032
  row updated to note both children. No circular depends_on. B-0032.3 (Aminata
  adversarial review) depends on this section existing.

## Implementation

Add `## Agent substrate integrity (heartbeat-file poisoning)` section to
`docs/security/THREAT-MODEL.md` after the "Channel-closure threats" section.
Section covers:

- Otto-339/340 grounding (substrate-poisoning = cognition-poisoning)
- The 5 attack vectors from B-0032.1 taxonomy
- Current-state mitigations and tier gaps
- Branch-protection requirements for task #276 dependency

## Acceptance criteria

- [ ] Section lands in THREAT-MODEL.md with 5 attack vectors cross-referenced to
      `tools/security/heartbeat-attack-vectors.ts`
- [ ] Each vector has tier tagging (T0/T1/T2/T3) consistent with existing tables
- [ ] `dotnet build -c Release` 0W/0E
- [ ] `bunx tsc --noEmit` clean

## Owed after this lands

- B-0032.3: Aminata adversarial review (now has a surface to review)
- B-0032.4: Task #276 update with blocker note pointing at B-0032
