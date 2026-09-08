---
id: 081M1YB9Z6H087G0R00220883B
type: task
state: backlog
priority: P2
slug: fake-vfs-lookup-and-readdir-synthesize-dot-and-dotdot
title: "Fake VFS lookup and readdir synthesize dot and dotdot"
created: 2026-09-07T16:30:31.121Z
depends_on: []
composes_with: []
---

# Fake VFS lookup and readdir synthesize dot and dotdot

PR13 Fake VFS (DST, no kernel). Lookup `.` / `..` / collator-aware
names. Readdir synthesizes `.` and `..`. Ascii imported collisions are
Confusable, never a silent merge. No kernel FUSE. Recovery stays `toy`.
Apple Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YB9Z6H087G0R00220883B-*.md` glob. -->
