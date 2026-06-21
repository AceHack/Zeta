---
id: 081KR2E4K0008QG0R0032TWN5H
priority: P2
status: open
title: "Long-tail external-anchor cadenced sweep — memory files + research docs"
tier: substrate-quality
effort: S
parent: 081KQ8P5D0008QG0R000N718AC
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [081KR2E4K0008QG0R001ZWARTN]
composes_with: [081KQ8P5D0008QG0R000N718AC, 081KQ8P5D0008QG0R0002TN22C]
tags: [substrate-quality, external-anchors, cadence, memory, research-docs]
type: friction-reducer
---

# Long-tail external-anchor cadenced sweep

Define and integrate a cadenced sweep procedure for
external-anchor coverage across the ~930 memory files and
~358 docs/research/ files. This is Phase 3 of 081KQ8P5D0008QG0R000N718AC —
ongoing, not a one-shot.

## Approach

1. Add an `--sweep N` flag to the external-anchor coverage
   scanner (081KR2E4K0008QG0R001ZWARTN) that samples every Nth file.
2. Wire the sweep into an existing cadence tool or the
   razor-cadence workflow as an optional check.
3. Each sweep iteration:
   - Pick the next batch of memory/research files.
   - For each file with a load-bearing concept and no
     external anchor, flag as `anchor-pending`.
   - Log sweep progress so subsequent iterations continue
     where the last left off.

## Scope boundary

This row covers the SETUP of the cadence (the tool flag +
the wiring), not the execution of all ~1288 files. Execution
is ongoing cadenced work after setup lands.

## Composes with 081KQ8P5D0008QG0R0002TN22C

081KQ8P5D0008QG0R0002TN22C (cadenced lost-substrate recovery audit) already
defines a cadence pattern for sweeping memory files. This
row adds the external-anchor dimension to that sweep.

## Done-criteria

- [ ] `--sweep N` flag added to audit_external_anchors.ts.
- [ ] Sweep progress tracking (file or JSON state) so
      iterations resume.
- [ ] Integration point documented (razor-cadence or
      standalone invocation).
- [ ] Tests cover sweep-resume behavior.
- [ ] Build gate passes.

## Reviewers

- `devops-engineer` — cadence integration.
