---
id: 081M2VDSD40087G0R00058B2ND
type: task
state: backlog
priority: P1
slug: same-overlap-rotator-for-schema-expand-into-and-key-previous
title: "Same overlap rotator for schema expand-into and key Previous"
created: 2026-09-18T23:31:52.576Z
depends_on: ["081M2NH3N4W087G0R0023MXFEB"]
composes_with: []
---

# Same overlap rotator for schema expand-into and key Previous

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2VDSD40087G0R00058B2ND-*.md` glob. -->

## Purpose

Schema expand-into and key `Previous` acceptance are one bounded overlap on
an agreed phase line, not two windows. `OverlapRotator` is the gate;
`ZetaDbFact.OverlapOpen` / `OverlapClose` ride the host WAL.

Depends on `081M2NH3N4W087G0R0023MXFEB` (facts on the log). This peel does
**not** prove live catalog overlap.

## Acceptance

- Expand-into is refused while a schema-reader overlap is Live at the frame.
- A key Previous overlap is accepted inside the same window and refused after
  it expires. Expiry needs no event.
- Early `OverlapClose` unblocks expand-into before expiry.
- One gate, two callers. Crash recovery stays `toy`.
