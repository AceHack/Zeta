---
id: 081M1WK2NS5087G0R002C5ACQ4
type: task
state: backlog
priority: P2
slug: bindname-refuses-a-directory-cycle
title: "bindName refuses a directory cycle"
created: 2026-09-07T00:07:51.845Z
depends_on: []
composes_with: []
---

# bindName refuses a directory cycle

PR3 cycle guard: adding a Directory under an ancestor would cycle.
`bindDirectory` / `bindName` persist; binding A under B when A is an
ancestor of B is `BindError.Cycle`. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1WK2NS5087G0R002C5ACQ4-*.md` glob. -->
