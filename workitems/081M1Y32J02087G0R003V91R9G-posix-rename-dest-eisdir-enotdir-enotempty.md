---
id: 081M1Y32J02087G0R003V91R9G
type: task
state: backlog
priority: P2
slug: posix-rename-dest-eisdir-enotdir-enotempty
title: "POSIX rename dest EISDIR ENOTDIR ENOTEMPTY"
created: 2026-09-07T14:06:39.618Z
depends_on: []
composes_with: []
---

# POSIX rename dest EISDIR ENOTDIR ENOTEMPTY

PR13: POSIX typed replace. Dest dir + src file = Eisdir. Dest file + src
dir = Enotdir. Dest non-empty dir = Enotempty. Those paths do not
tombstone. Dest absent binds the same EntityId. Same parent+name is a
no-op. No kernel FUSE. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Y32J02087G0R003V91R9G-*.md` glob. -->
