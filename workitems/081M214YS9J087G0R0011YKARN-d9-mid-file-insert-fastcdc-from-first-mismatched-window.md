---
id: 081M214YS9J087G0R0011YKARN
type: task
state: backlog
priority: P2
slug: d9-mid-file-insert-fastcdc-from-first-mismatched-window
title: "D9 mid-file insert FastCDC from first mismatched window"
created: 2026-09-08T18:37:16.466Z
depends_on: ["081M213CHF9087G0R0032FB65S"]
composes_with: []
---

# D9 mid-file insert FastCDC from first mismatched window

Overwrite and append already reused prefix. Mid-file insert does too:
FastCDC from the first mismatched window. Patterned `i%251` bytes made
suffix chunks collide with the prefix, which looked like a full recode.
Non-periodic bytes show the skip. Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M214YS9J087G0R0011YKARN-*.md` glob. -->
