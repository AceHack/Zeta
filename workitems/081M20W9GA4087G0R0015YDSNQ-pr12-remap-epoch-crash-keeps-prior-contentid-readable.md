---
id: 081M20W9GA4087G0R0015YDSNQ
type: task
state: backlog
priority: P2
slug: pr12-remap-epoch-crash-keeps-prior-contentid-readable
title: "PR12 remap-epoch crash keeps prior ContentId readable"
created: 2026-09-08T16:05:50.532Z
depends_on: ["081M20TMRD9087G0R0035Y762D"]
composes_with: []
---

# PR12 remap-epoch crash keeps prior ContentId readable

After D9 (`081M20TMRD9087G0R0035Y762D`) freeze B of a 1-byte edit
carries only unknown CAS objects. Crash-mid-write during those
puts must keep freeze A's ContentId readable after reopen; B is
not. Recovery stays toy. mmap freeze still native. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M20W9GA4087G0R0015YDSNQ-*.md` glob. -->
