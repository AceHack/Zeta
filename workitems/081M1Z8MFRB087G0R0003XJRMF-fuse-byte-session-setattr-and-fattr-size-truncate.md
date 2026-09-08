---
id: 081M1Z8MFRB087G0R0003XJRMF
type: task
state: backlog
priority: P2
slug: fuse-byte-session-setattr-and-fattr-size-truncate
title: "FUSE byte session SETATTR and FATTR_SIZE truncate"
created: 2026-09-08T01:03:04.459Z
depends_on: []
composes_with: []
---

# FUSE byte session SETATTR and FATTR_SIZE truncate

PR13 byte session SETATTR over Fake VFS. `FATTR_SIZE` truncates mutbuf.
`FATTR_MTIME` / `FATTR_CTIME` write caller unix-ns. Reply is
`fuse_attr_out`. No `/dev/fuse`. Recovery stays `toy`. Apple Developer
Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Z8MFRB087G0R0003XJRMF-*.md` glob. -->
