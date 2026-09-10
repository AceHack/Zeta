---
id: 081M1WHV7KD087G0R001CNTJ1M
type: task
state: backlog
priority: P2
slug: unlinkfile-tombstone-persists-across-freeze-reopen
title: "unlinkFile tombstone persists across freeze reopen"
created: 2026-09-06T23:46:19.373Z
depends_on: []
composes_with: []
---

# unlinkFile tombstone persists across freeze reopen

PR3 E1: unlink appends a Tombstone; it does not retract the Live winner.
`persistNamespace` already writes tombstone lines. Expose `unlinkFile` and
falsify: after reopen, `liveResolve` is None. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1WHV7KD087G0R001CNTJ1M-*.md` glob. -->
