---
id: 081M1YH9TP1087G0R002S6GBZX
type: task
state: backlog
priority: P2
slug: fake-vfs-create-mkdir-with-collator-refuse
title: "Fake VFS create mkdir with collator refuse"
created: 2026-09-07T18:15:17.953Z
depends_on: []
composes_with: []
---

# Fake VFS create mkdir with collator refuse

PR13 Fake VFS create/mkdir. Collator refuse first. `.` / `..` are
Confusable. `bindFileUnder` mints a File under any parent. No kernel
FUSE. Recovery stays `toy`. Apple Developer Program is not the next
blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YH9TP1087G0R002S6GBZX-*.md` glob. -->
