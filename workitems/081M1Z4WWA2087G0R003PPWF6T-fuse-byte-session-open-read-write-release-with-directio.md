---
id: 081M1Z4WWA2087G0R003PPWF6T
type: task
state: backlog
priority: P2
slug: fuse-byte-session-open-read-write-release-with-directio
title: "FUSE byte session OPEN READ WRITE RELEASE with DirectIo"
created: 2026-09-07T23:57:45.154Z
depends_on: []
composes_with: []
---

# FUSE byte session OPEN READ WRITE RELEASE with DirectIo

PR13 byte session OPEN/READ/WRITE/RELEASE over Fake VFS. OPEN sets
`FOPEN_DIRECT_IO`. No `/dev/fuse`. Recovery stays `toy`. Apple
Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Z4WWA2087G0R003PPWF6T-*.md` glob. -->
