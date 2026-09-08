---
id: 081M1YJASGG087G0R000QNVQF4
type: task
state: backlog
priority: P2
slug: fake-vfs-unlink-rmdir-symlink-readlink
title: "Fake VFS unlink rmdir symlink readlink"
created: 2026-09-07T18:33:18.096Z
depends_on: []
composes_with: []
---

# Fake VFS unlink rmdir symlink readlink

PR13 Fake VFS unlink/rmdir/symlink/readlink. Directory unlink is
Eisdir. Non-empty rmdir is Enotempty. Symlink target is not resolved.
No kernel FUSE. Recovery stays `toy`. Apple Developer Program is not
the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YJASGG087G0R000QNVQF4-*.md` glob. -->
