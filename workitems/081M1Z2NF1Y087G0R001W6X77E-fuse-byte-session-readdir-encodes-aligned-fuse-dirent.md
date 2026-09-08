---
id: 081M1Z2NF1Y087G0R001W6X77E
type: task
state: backlog
priority: P2
slug: fuse-byte-session-readdir-encodes-aligned-fuse-dirent
title: "FUSE byte session READDIR encodes aligned fuse_dirent"
created: 2026-09-07T23:18:45.054Z
depends_on: []
composes_with: []
---

# FUSE byte session READDIR encodes aligned fuse_dirent

PR13 byte session READDIR over Fake VFS. `fuse_dirent` records are
8-byte aligned. `.` / `..` are synthesized. No `/dev/fuse`. Recovery
stays `toy`. Apple Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Z2NF1Y087G0R001W6X77E-*.md` glob. -->
