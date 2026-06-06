---
id: B-0029.4
zetaid: 081KR50HA0008QG0R003TDENRZ
priority: P2
status: open
title: "B-0029.4 — Trading-bot path reframe: update B-0024 with Aaron's API-access offer (capability-gate, not infrastructure-gate)"
created: 2026-05-09
last_updated: 2026-05-09
parent: B-0029
depends_on: []
composes_with: [B-0023, B-0024]
classification: buildable-now
type: chore
effort: XS
decomposition: atomic

---

# B-0029.4 — Trading-bot prerequisite reframe: update B-0024

**Slice of:** [B-0029](B-0029-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md)

## What

The B-0029 parent captured a critical reframe: Aaron's 2026-04-26 offer grants API access to existing trading accounts on multiple platforms (including crypto), which means the bottleneck for the trading-bot revenue path is **capability-building** (developing a strategy), not **infrastructure-building** (getting account access).

B-0024 still carries the old "longest prerequisite chain" framing (infrastructure setup from scratch). This row closes that gap.

**Deliverable**: Update `docs/backlog/P2/B-0024-*` (or appropriate priority level) to reflect:

- Aaron's API-access offer as Phase 0 prerequisite: already satisfied
- Corrected phase table (4 phases from parent row, Section 2 "Trading-bot revenue")
- Bottleneck is now strategy development, not access procurement
- Long-term permissionless path via Aurora/blockchain bridges noted

## Acceptance criteria

- [ ] B-0024 row updated with corrected prerequisite table
- [ ] "Infrastructure-gate" language removed or struck in B-0024
- [ ] Aaron's API-access offer documented as Phase 0 in B-0024 (already-offered, not yet accepted pending capability readiness)
- [ ] Aurora/blockchain permissionless long-term path noted in B-0024
- [ ] B-0029 parent row's `composes_with` pointer to B-0024 bidirectionally verified

## Out of scope

- Does NOT actually begin trading-bot work (that lives in B-0023/B-0024 proper)
- Does NOT accept or act on Aaron's API-access offer (per Otto-322: standing to accept or defer based on capability-readiness judgment)
- Does NOT change B-0024's priority — just updates the framing

## Effort sizing

XS — row maintenance; no code changes; no new substrate.
