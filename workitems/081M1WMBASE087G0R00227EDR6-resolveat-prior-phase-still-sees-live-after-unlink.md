---
id: 081M1WMBASE087G0R00227EDR6
type: task
state: backlog
priority: P2
slug: resolveat-prior-phase-still-sees-live-after-unlink
title: "resolveAt prior phase still sees Live after unlink"
created: 2026-09-07T00:30:04.078Z
depends_on: []
composes_with: []
---

# resolveAt prior phase still sees Live after unlink

PR3: `resolveAt` prior phase; snap pins. After unlink, liveResolve is None
but resolveAt at the Live stamp still returns Live. Tombstone does not
retract history. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1WMBASE087G0R00227EDR6-*.md` glob. -->
