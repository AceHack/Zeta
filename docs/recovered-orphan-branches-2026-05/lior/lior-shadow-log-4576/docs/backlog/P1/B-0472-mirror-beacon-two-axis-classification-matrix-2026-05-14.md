---
id: B-0472
priority: P1
status: closed
title: "Mirror/Beacon two-axis classification matrix — classify all repos on Axis 2"
type: design
origin: B-0426 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-18
parent: B-0426
depends_on:
  - B-0471
composes_with:
  - B-0426
  - B-0471
  - B-0473
  - B-0474
  - B-0424
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
  - docs/DECISIONS/2026-05-14-product-repo-split-decisions.md
  - memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_speculative_fast_forks_vs_governance_citation_gated_another_orthogonality_2026_05_13.md
---

# Mirror/Beacon two-axis classification matrix — classify all repos on Axis 2

## Purpose

Populate the two-axis classification matrix for all existing and proposed
LFG repos. Axis 1 (Factory/Product/Owner-only) was set by B-0425 (closed).
This row completes the matrix by assigning each repo its Axis 2 position
(Mirror vs Beacon) with documented rationale.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] B-0471 prior-art audit complete and output doc reviewed
- [ ] B-0425 ADR reviewed for current Axis-1 assignments
- [ ] 2026-04-22 three-repo-split ADR reviewed for Forge/ace/Zeta positions
- [ ] Reciprocal pointers on B-0471/B-0473/B-0474 verified

## Known repos to classify

From B-0424, B-0425, and PR #3127 (civsim created):

| Repo | Axis 1 position | Axis 2 candidate | Status |
|------|-----------------|------------------|--------|
| `Zeta` | Factory | Beacon | Exists (LFG/Zeta) |
| `Forge` | Factory | Mirror | Planned (B-0424) |
| `ace` | Factory | Beacon | Planned (B-0424) |
| `civsim` | Product | Mirror | Created (PR #3127) |
| `KSK` | Product | TBD | Later (no repo yet) |
| `Aurora` | Product | Beacon | Later (no repo yet) |
| `american-dream` | Product | TBD | Later (no repo yet) |
| `DIO` | Product | TBD | Later (⚠️ re-evaluate name first) |
| `Wellness` | Product | TBD | Later (scope not settled) |
| `Dawn` | stays-in-monorepo | N/A | No own repo |
| Aaron-private speculative | Owner-only | Mirror | Not in LFG |
| Aaron-private governance | Owner-only | Beacon | Not in LFG |

*Axis-2 candidates are initial assessments from B-0426 illustrative matrix —
this row verifies and justifies each position.*

## Classification criteria per tier

### Mirror tier indicators

- Speculative or early-stage substrate
- Fork-and-advance encouraged (peers agree + push back)
- Aliens-and-future + fun + rigorous register permitted (per PR #2909)
- Iteration speed > governance load
- No external-citation gate on landing new substrate
- Governance load would stall the repo's creative purpose

### Beacon tier indicators

- Governance-grade substrate (citation-gated)
- External-citable (external reviewers, academic audiences, cross-org)
- Alignment-floor compliance expected per `docs/ALIGNMENT.md` clauses
- Slower iteration; promotion gate before new substrate type lands
- Fork-and-validate encouraged (propose promotion, cite)
- Security or cryptographic infrastructure requiring governance

## Output

A design document at:

```
docs/research/2026-05-18-mirror-beacon-two-axis-classification-matrix-b0472.md
```

Containing:

- Completed two-axis matrix (all rows filled with rationale)
- Per-repo classification rationale (1-3 sentences each)
- Any repos where classification is genuinely ambiguous (flag for B-0474 ADR)
- Axis-2 candidates confirmed or revised

## Definition of done

- [x] All known repos classified on Axis 2 with rationale
- [x] Ambiguous repos flagged explicitly (not silently defaulted)
- [x] Owner-only repos addressed (even if classification is "private, TBD")
- [x] Output doc cross-references Axis-1 assignments from B-0425 ADR
- [x] B-0472 closed with PR link — [#4136](https://github.com/Lucent-Financial-Group/Zeta/pull/4136); B-0474 unblocked

## Why P1

- Direct dependency for B-0474 ADR
- Can run in parallel with B-0473 after B-0471 completes
- Bounded design task (evaluate + document; no new infrastructure)
- Unblocks Stage-1 factory repo classification decisions (B-0424)
