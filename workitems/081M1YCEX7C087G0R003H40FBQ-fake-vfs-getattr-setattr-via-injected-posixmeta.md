---
id: 081M1YCEX7C087G0R003H40FBQ
type: task
state: backlog
priority: P2
slug: fake-vfs-getattr-setattr-via-injected-posixmeta
title: "Fake VFS getattr setattr via injected PosixMeta"
created: 2026-09-07T16:50:41.516Z
depends_on: []
composes_with: []
---

# Fake VFS getattr setattr via injected PosixMeta

PR13 Fake VFS getattr/setattr over PosixMeta. Auto-stamps from the
injected clock. `utimensat` is caller unix-ns. Getattr size is dirty
mutbuf length. No kernel FUSE. Recovery stays `toy`. Apple Developer
Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YCEX7C087G0R003H40FBQ-*.md` glob. -->
