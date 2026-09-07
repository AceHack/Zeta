---
id: 081M1YRXRZ5087G0R002K9XG7B
type: task
state: backlog
priority: P2
slug: fuse-dispatcher-setattr-via-posixmeta
title: "FUSE dispatcher setattr via PosixMeta"
created: 2026-09-07T20:28:31.589Z
depends_on: []
composes_with: []
---

# FUSE dispatcher setattr via PosixMeta

PR13 FUSE setattr over Fake VFS PosixMeta. Caller unix-ns. Replies with
getattr. No `/dev/fuse`, no kernel. Recovery stays `toy`. Apple
Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YRXRZ5087G0R002K9XG7B-*.md` glob. -->
