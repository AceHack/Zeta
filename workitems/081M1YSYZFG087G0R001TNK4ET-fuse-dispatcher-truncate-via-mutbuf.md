---
id: 081M1YSYZFG087G0R001TNK4ET
type: task
state: backlog
priority: P2
slug: fuse-dispatcher-truncate-via-mutbuf
title: "FUSE dispatcher truncate via mutbuf"
created: 2026-09-07T20:46:39.600Z
depends_on: []
composes_with: []
---

# FUSE dispatcher truncate via mutbuf

PR13 FUSE truncate over Fake VFS mutbuf. Directory is EISDIR. Negative
length is EINVAL. No `/dev/fuse`, no kernel. Recovery stays `toy`.
Apple Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YSYZFG087G0R001TNK4ET-*.md` glob. -->
