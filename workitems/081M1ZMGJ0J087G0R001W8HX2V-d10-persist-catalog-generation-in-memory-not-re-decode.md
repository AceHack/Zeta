---
id: 081M1ZMGJ0J087G0R001W8HX2V
type: task
state: backlog
priority: P2
slug: d10-persist-catalog-generation-in-memory-not-re-decode
title: "D10 persist catalog generation in memory not re-decode"
created: 2026-09-08T04:30:38.610Z
depends_on: ["081M1ZHZ7EW087G0R00006H4BK"]
composes_with: []
---

# D10 persist catalog generation in memory not re-decode

Persist used to decode both `known.pins` slots on every write to find
maxGen. Generation now lives on the volume. Dual-slot files stay the
reopen source of truth. Freeze-storm bound stays 48 MiB. Recovery stays
toy. Not Apple. Not FUSE.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZMGJ0J087G0R001W8HX2V-*.md` glob. -->
