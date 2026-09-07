---
id: 081M1Y1J92F087G0R002WKAWY3
type: task
state: backlog
priority: P2
slug: freeze-bindsymlink-persists-utf-8-target-bytes
title: "freeze bindSymlink persists UTF-8 target bytes"
created: 2026-09-07T13:40:17.615Z
depends_on: []
composes_with: []
---

# freeze bindSymlink persists UTF-8 target bytes

PR13: mint a Symlink EntityId, bind the name, persist UTF-8 target
bytes as a satellite. Reopen readSymlink returns the same bytes. Does
not resolve the target. No kernel FUSE. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Y1J92F087G0R002WKAWY3-*.md` glob. -->
