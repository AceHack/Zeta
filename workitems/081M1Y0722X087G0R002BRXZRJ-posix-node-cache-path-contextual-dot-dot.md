---
id: 081M1Y0722X087G0R002BRXZRJ
type: task
state: backlog
priority: P2
slug: posix-node-cache-path-contextual-dot-dot
title: "POSIX node cache path-contextual dot-dot"
created: 2026-09-07T13:16:41.437Z
depends_on: []
composes_with: []
---

# POSIX node cache path-contextual dot-dot

PR13 merge-gate peel: FUSE node cache holds arrival parent. `lookup("..")`
is path-contextual. Two parents yield two `..` values. Root `..` is root.
Volume Handle is EntityId only. `st_ino` is a side table over EntityId.
No kernel FUSE. No Apple Developer Program. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Y0722X087G0R002BRXZRJ-*.md` glob. -->
