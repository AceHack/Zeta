---
id: 081M218759R087G0R000ESY8EY
type: task
state: backlog
priority: P2
slug: d9-truncate-fastcdc-from-first-mismatched-window
title: "D9 truncate FastCDC from first mismatched window"
created: 2026-09-08T19:34:16.632Z
depends_on: ["081M214YS9J087G0R0011YKARN"]
composes_with: []
---

# D9 truncate FastCDC from first mismatched window

Overwrite and append already reused prefix. Truncate does too: a cut on
a chunk boundary keeps prefix leaves with no suffix payloads; a mid-chunk
cut FastCDC from that window. Non-periodic bytes show the first prefix
chunk is absent from reused Cas. Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M218759R087G0R000ESY8EY-*.md` glob. -->
