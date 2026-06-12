---
id: B-0392
zetaid: 081KR50HA0008QG0R003BM7FNK
priority: P3
status: open
title: Tier-aware bulk grouping model — ADR mapping Tier 0-4 to reviewer attention levels for dashboard bulk-review surface
tier: research-grade
effort: S
ask: decomposition of B-0017
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [B-0390]
composes_with: [B-0017, B-0388, B-0389, B-0390, B-0391, B-0393, B-0394, B-0395]
parent: B-0017
tags: [frontier, tier-aware, bulk-review, dashboard, operational-resonance, adr, tier-model]
type: research
---

# B-0392 — Tier-aware bulk grouping model ADR

## What

Produce an ADR that defines how the dashboard groups items for
bulk review based on structural tier, and maps each tier to
the appropriate reviewer attention level.

This implements the 2026-05-04 architectural extension in B-0017:

> *"I review your architecture decisions based on those levels
> you named earlier, so I don't need tiny corrects at every step."*

### The tier model to formalize

Based on existing Zeta tiering vocabulary (compression tiers,
mirror/beacon-safe register tiers, substrate-cluster levels):

| Tier | Description | Reviewer attention | Default action |
|------|-------------|-------------------|----------------|
| 0 | Fully mechanical (formatting, ASCII-lint, whitespace) | Skip / auto-merge | Auto-land with CI |
| 1 | Structured/additive (doc additions, backlog rows, memory files, closed-form refactors) | Bulk-review (fast scan) | Batch approve |
| 2 | Judgment calls (design decisions, backlog decompositions, API changes, skill edits) | Attention-required review | Individual review |
| 3 | Architectural (substrate-class promotions, CLAUDE.md changes, alignment-contract changes, new capability claims) | Deep review | Explicit sign-off |
| 4 | Unknown/unclassified | Must classify before routing | Hold for triage |

The ADR must:

1. **Confirm or revise** the tier labels above — these are a
   starting-point hypothesis, not a commitment.

2. **Define the classification rule** — given a PR or backlog
   item, which signals put it in which tier? (tag-based?
   file-path-based? change-size-based? combination?)

3. **State the routing decision** — what happens to each tier
   in the dashboard UI? (auto-dismiss? batched card? flagged
   card? blocked until reviewed?)

4. **Define the time-to-answer impact** — how does tier-aware
   grouping reduce the time-to-answer the primary question?
   (this is how the model earns its presence per B-0390.)

5. **State explicit non-goals** — what the tier model does NOT
   decide (e.g., code quality, correctness — those are
   separate signals).

### Integration with existing substrate

- **Mirror/Beacon-safe register tiers** (`memory/feedback_*register*`)
  — are these the same tiers or orthogonal? The ADR states the
  relationship explicitly.
- **GOVERNANCE.md mechanical vs judgment classifications** — the
  existing governance distinction between "mechanical" and
  "judgment" items is the informal predecessor; this ADR
  formalizes it for dashboard routing.
- **B-0390 metric**: the ADR must cite B-0390's accepted
  time-to-answer definition and show how tier grouping reduces it.

## Why after B-0390

The tier routing decision is "does tier grouping reduce
time-to-answer?" Without B-0390 defining the metric, the model
cannot justify itself. The ADR depends on having the metric
to evaluate against.

## Output artifact

`docs/DECISIONS/YYYY-MM-DD-frontier-tier-aware-bulk-grouping-model.md`

Structure:

- Context (why tiering for bulk review)
- Tier definitions (0-4 with classification rules)
- Routing decisions per tier
- Relationship to existing register tiers
- Time-to-answer impact analysis (cite B-0390)
- Non-goals

## Focused check

```bash
ls docs/DECISIONS/ | grep tier-aware-bulk
```

Expected: ADR file present.

## Acceptance signal

- Tier 0-4 defined with classification rules
- Routing decision per tier stated
- Relationship to mirror/beacon register tiers stated
- Time-to-answer impact analysis present (cites B-0390)
- Non-goals section present

## Pre-start checklist

- [x] Prior-art search: no existing formal tier-aware grouping
  model ADR found in `docs/DECISIONS/`. The concept appears in
  B-0017 body (2026-05-04 section) and memory files but has not
  been formalized into an ADR. Mirror/beacon register tiers are
  distinct; check before conflating.
- [x] Dependency-restructure: `depends_on: [B-0390]` — needs
  the time-to-answer metric to evaluate grouping impact. B-0394
  depends on this ADR for the grouping UI component.

## Composes with

- B-0017 (parent): implements "tier-aware bulk grouping" architectural
  extension (2026-05-04 section)
- B-0390 (dependency): time-to-answer metric used to evaluate tier model
- B-0394 (downstream): MVP dashboard uses this model for the
  tier-grouped review surface
- GOVERNANCE.md (existing): formalizes the mechanical/judgment
  distinction already present informally
