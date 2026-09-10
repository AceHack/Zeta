---
id: 081M1Z1C0KT087G0R002FWC42P
type: task
state: backlog
priority: P2
slug: fuse-byte-session-getattr-encodes-fuse-attr-out
title: "FUSE byte session GETATTR encodes fuse_attr_out"
created: 2026-09-07T22:56:06.778Z
depends_on: []
composes_with: []
---

# FUSE byte session GETATTR encodes fuse_attr_out

PR13 byte session GETATTR over Fake VFS. `fuse_attr_out` carries
`st_ino` and zero cache timeout. Missing is ENOENT. No `/dev/fuse`.
Recovery stays `toy`. Apple Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Z1C0KT087G0R002FWC42P-*.md` glob. -->
