---
id: 081M1ZTPQW0087G0R001ZM8PFA
type: task
state: backlog
priority: P2
slug: d10-applyretention-does-not-persist-catalog-notefreeze-does
title: "D10 applyRetention does not persist catalog noteFreeze does once"
created: 2026-09-08T06:18:52.672Z
depends_on: ["081M1ZS5N52087G0R0005S5ZYJ"]
composes_with: []
---

# D10 applyRetention does not persist catalog noteFreeze does once

finish called applyRetention (persist) then noteFreeze (persist).
Pins update in memory; noteFreeze writes once. One Journaled freeze
ends at catalog gen 2. Recovery stays toy. Not Apple. Not FUSE.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZTPQW0087G0R001ZM8PFA-*.md` glob. -->
