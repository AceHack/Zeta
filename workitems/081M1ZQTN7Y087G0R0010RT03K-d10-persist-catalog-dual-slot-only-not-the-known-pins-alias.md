---
id: 081M1ZQTN7Y087G0R0010RT03K
type: task
state: backlog
priority: P2
slug: d10-persist-catalog-dual-slot-only-not-the-known-pins-alias
title: "D10 persist catalog dual-slot only not the known.pins alias"
created: 2026-09-08T05:28:35.326Z
depends_on: ["081M1ZMGJ0J087G0R001W8HX2V"]
composes_with: []
---

# D10 persist catalog dual-slot only not the known.pins alias

Slots are source of truth. persist also wrote `known.pins` as a copy.
That is a second full catalog encode+tmp+rename per freeze. Stop the
alias write. Reopen still loads leftover `known.pins` if both slots
are missing. Recovery stays toy. Not Apple. Not FUSE.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZQTN7Y087G0R0010RT03K-*.md` glob. -->
