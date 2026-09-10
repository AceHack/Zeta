---
id: 081M1WBDCR3087G0R001P68H7W
type: task
state: backlog
priority: P2
slug: freeze-volumes-write-format-ns-bindings
title: "Freeze volumes write FORMAT ns=bindings"
created: 2026-09-06T21:53:54.435Z
depends_on: []
composes_with: []
---

# Freeze volumes write FORMAT ns=bindings

Freeze does not speak JSON trees. New freeze volumes write
`zetafs/2 ns=bindings; body=jumprope`. Git-trees `deltaLog` still refuses.
TagBinding objects are not persisted in this peel. v1 stores with HEAD and
no FORMAT are not silently converted. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1WBDCR3087G0R001P68H7W-*.md` glob. -->
