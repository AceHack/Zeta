---
id: 081M211SN5W087G0R00129M1E6
type: task
state: backlog
priority: P2
slug: d9-append-length-fastcdc-from-last-chunk-not-full-rebuild
title: "D9 append-length FastCDC from last chunk not full rebuild"
created: 2026-09-08T17:42:02.684Z
depends_on: ["081M21080ZQ087G0R0037YY66R"]
composes_with: []
---

# D9 append-length FastCDC from last chunk not full rebuild

Same-span overwrite reused prefix. Append still full-built because
the last previous chunk was a Flush, not a gear cut. Re-chunk from
that last window. Truncate on a chunk boundary keeps the prefix.
Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M211SN5W087G0R00129M1E6-*.md` glob. -->
