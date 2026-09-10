---
id: 081M20TMRD9087G0R0035Y762D
type: task
state: backlog
priority: P2
slug: d9-freeze-log-boat-carries-only-unknown-cas-objects
title: "D9 freeze log boat carries only unknown CAS objects"
created: 2026-09-08T15:37:02.121Z
depends_on: ["081M1HK4AQE087G0R002RRJXWE"]
composes_with: []
---

# D9 freeze log boat carries only unknown CAS objects

Volume freeze rebuilt the whole Jumprope into the log boat even when
CAS already held the prefix chunks. Boat now carries only unknown
objects. A 1-byte edit must not double KnownObjects. Recovery stays
toy. Not Apple. Not FUSE.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M20TMRD9087G0R0035Y762D-*.md` glob. -->
