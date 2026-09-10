---
id: 081M1WFC7QN087G0R0029EQNT0
type: task
state: backlog
priority: P2
slug: persist-tagbindings-on-freeze-volumes
title: "Persist TagBindings on freeze volumes"
created: 2026-09-06T23:03:10.837Z
depends_on: []
composes_with: []
---

# Persist TagBindings on freeze volumes

FORMAT ns=bindings and ROOT exist; TagBinding objects did not. Persist a
text `bindings` file (not JSON trees). `bindFile` under ROOT; reopen
`liveResolve` finds the same EntityId. Git-trees deltaLog still refuses.
Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1WFC7QN087G0R0029EQNT0-*.md` glob. -->
