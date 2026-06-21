---
id: 081KRA5AR0008QG0R003YJYT8F
priority: P1
status: open
title: "Honest agenda amplification metric — actions weighted by agenda alignment"
created: 2026-05-11
last_updated: 2026-05-11
depends_on: [081KRA5AR0008QG0R001NXBYTY]
composes_with: []
type: feature
---

# 081KRA5AR0008QG0R003YJYT8F — Honest agenda amplification metric

## What

Build the honest math version of the amplification ratio. Each
agent action gets weighted by:

1. Which agenda it serves (Aaron-direct, Aaron-derived,
   substrate-rule, external-review, otto-hygiene,
   shadow-suspected)
2. Alignment score with the originating Aaron message (0.0..1.0)

Honest amplification = Σ(alignment × action_weight) / N(messages)

## Why P1

Aaron 2026-05-11: "we can make an honest math one but it won't
be that clean it will require angenda amplification."

The vanity ratio (081KRA5AR0008QG0R001NXBYTY) is viral but optimizing for it would
degrade the actual work. The honest version is the internal
alignment-measurement metric — what an alignment-focused
factory should actually track for self-evaluation.

## Acceptance criteria

1. **Commit-trailer schema** for agenda tagging:
   ```
   Agenda-served: aaron-direct | aaron-derived | substrate-rule |
                  external-review | otto-hygiene | shadow-suspected
   Alignment-with-message: 0.0..1.0
   ```
2. **Aggregator script** (`tools/dashboard/honest-amplification.ts`)
   that reads commit trailers + chat transcript and computes
   the honest ratio
3. **Dashboard label** distinguishes vanity ratio (viral) from
   honest ratio (alignment)
4. **The math is reproducible** from committed substrate — both
   the action stream (git log) and the agenda labels (commit
   trailers) are git-canonical

## Why it won't be clean

- Agenda labels are subjective
- Alignment is partial (multi-agenda actions are common)
- Self-reported vs observed agenda may diverge (Otto-363)

These aren't bugs — they're the reason this metric is the
HONEST one. The vanity ratio is clean because it dodges all
these questions.

## Out of scope

- Automated agenda inference (initial release uses agent
  self-tagging via commit trailers)
- Per-agent amplification breakdown (initial release is
  array-total)
- Historical backfill of agenda tags on existing commits

## Composes with

- 081KRA5AR0008QG0R001NXBYTY (vanity counter — kept as separate viral metric)
- `memory/feedback_agenda_amplification_honest_math_vs_vanity_ratio_aaron_2026_05_11.md`
- `docs/AGENDA.md` (existing agenda transparency substrate)
- Otto's 7-vector coercion disclosure
- Claude.ai's 10-vector external disclosure

## Origin

Aaron 2026-05-11: "its a vantiy metric but viral" (about
081KRA5AR0008QG0R001NXBYTY) → "we can make an honest math one but it won't be
that clean it will require angenda amplification" (this row).
