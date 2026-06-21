---
id: 081KRHWGX0008QG0R003N033PD
priority: P1
status: open
title: Mechanize new-surface audit for alignment-clause consistency
tier: substrate-foundational-discipline
effort: S
ask: Peel off from 081KQ3HBZ0008QG0R002S674CG — "New-surface audit" into atomic slice.
created: 2026-05-14
last_updated: 2026-05-14
renumbered_from: "081KR2E4K0008QG0R001F0YB5S (2026-05-14, ID collision with 081KR2E4K0008QG0R001F0YB5S-claude-md-as-process-not-doctrine.md caught by Copilot review on PR #3247)"
depends_on: [081KQ3HBZ0008QG0R002S674CG]
composes_with: [docs/ALIGNMENT.md, docs/GLOSSARY.md]
tags: [ai-ethics, alignment, new-surface-audit, decomposed, 081KQ3HBZ0008QG0R002S674CG-slice]
type: friction-reducer
---

# 081KRHWGX0008QG0R003N033PD — Mechanize new-surface audit for alignment-clause consistency

## Origin

Decomposed from 081KQ3HBZ0008QG0R002S674CG item 2: "New-surface audit".

## What this slice owns

Implementation of a cadence or CI check ensuring that:
Every new skill under `.claude/skills/**`, persona under `.claude/agents/**`, glossary entry in `docs/GLOSSARY.md`, and BACKLOG row at P0/P1 runs through an alignment-clause consistency check against `docs/ALIGNMENT.md` (HC-1..HC-7 / SD-1..SD-8 / DIR-1..DIR-5).

This check must fire at author-time (prevention surface) and on a cadence (detection surface). It follows the same shape as the skill-data/behaviour-split audit, but verifies alignment-clause compliance rather than mix-signature.

## Next Steps

1. Create a `tools/hygiene/audit-new-surface-alignment.ts` script.
2. Hook it into the razor-cadence or GitHub Actions.
