---
id: 081KR50HA0008QG0R003TDENRZ
priority: P2
status: open
title: "081KR50HA0008QG0R003TDENRZ — Trading-bot path reframe: update 081KQ0YZ80008QG0R0006VRT18 with Aaron's API-access offer (capability-gate, not infrastructure-gate)"
created: 2026-05-09
last_updated: 2026-05-09
parent: 081KQ3HBZ0008QG0R000JRZAMM
depends_on: []
composes_with: [081KQ0YZ80008QG0R003EJQZ1M, 081KQ0YZ80008QG0R0006VRT18]
classification: buildable-now
type: chore
effort: XS
decomposition: atomic

---

# 081KR50HA0008QG0R003TDENRZ — Trading-bot prerequisite reframe: update 081KQ0YZ80008QG0R0006VRT18

**Slice of:** [081KQ3HBZ0008QG0R000JRZAMM](081KQ3HBZ0008QG0R000JRZAMM-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md)

## What

The 081KQ3HBZ0008QG0R000JRZAMM parent captured a critical reframe: Aaron's 2026-04-26 offer grants API access to existing trading accounts on multiple platforms (including crypto), which means the bottleneck for the trading-bot revenue path is **capability-building** (developing a strategy), not **infrastructure-building** (getting account access).

081KQ0YZ80008QG0R0006VRT18 still carries the old "longest prerequisite chain" framing (infrastructure setup from scratch). This row closes that gap.

**Deliverable**: Update `docs/backlog/P2/081KQ0YZ80008QG0R0006VRT18-*` (or appropriate priority level) to reflect:

- Aaron's API-access offer as Phase 0 prerequisite: already satisfied
- Corrected phase table (4 phases from parent row, Section 2 "Trading-bot revenue")
- Bottleneck is now strategy development, not access procurement
- Long-term permissionless path via Aurora/blockchain bridges noted

## Acceptance criteria

- [ ] 081KQ0YZ80008QG0R0006VRT18 row updated with corrected prerequisite table
- [ ] "Infrastructure-gate" language removed or struck in 081KQ0YZ80008QG0R0006VRT18
- [ ] Aaron's API-access offer documented as Phase 0 in 081KQ0YZ80008QG0R0006VRT18 (already-offered, not yet accepted pending capability readiness)
- [ ] Aurora/blockchain permissionless long-term path noted in 081KQ0YZ80008QG0R0006VRT18
- [ ] 081KQ3HBZ0008QG0R000JRZAMM parent row's `composes_with` pointer to 081KQ0YZ80008QG0R0006VRT18 bidirectionally verified

## Out of scope

- Does NOT actually begin trading-bot work (that lives in 081KQ0YZ80008QG0R003EJQZ1M/081KQ0YZ80008QG0R0006VRT18 proper)
- Does NOT accept or act on Aaron's API-access offer (per Otto-322: standing to accept or defer based on capability-readiness judgment)
- Does NOT change 081KQ0YZ80008QG0R0006VRT18's priority — just updates the framing

## Effort sizing

XS — row maintenance; no code changes; no new substrate.
