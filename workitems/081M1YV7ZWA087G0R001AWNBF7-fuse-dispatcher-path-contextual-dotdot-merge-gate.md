---
id: 081M1YV7ZWA087G0R001AWNBF7
type: task
state: backlog
priority: P2
slug: fuse-dispatcher-path-contextual-dotdot-merge-gate
title: "FUSE dispatcher path-contextual dotdot merge gate"
created: 2026-09-07T21:09:03.498Z
depends_on: []
composes_with: []
---

# FUSE dispatcher path-contextual dotdot merge gate

PR13 E4 at the FUSE opcode layer. `lookup(".")` is self.
`lookup("..")` is the arrival parent. Two parents yield two `..`
nodes and one `st_ino`. No kernel FUSE. Recovery stays `toy`. Apple
Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YV7ZWA087G0R001AWNBF7-*.md` glob. -->
