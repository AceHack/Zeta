---
id: 081M1WCTENE087G0R003D6HZS5
type: task
state: backlog
priority: P2
slug: freeze-volumes-write-root-entityid
title: "Freeze volumes write ROOT EntityId"
created: 2026-09-06T22:18:30.958Z
depends_on: []
composes_with: []
---

# Freeze volumes write ROOT EntityId

PR3: new volumes mint a Crockford-26 ROOT hub. Freeze now writes FORMAT
ns=bindings but not ROOT. Write ROOT on first create (no FORMAT, no HEAD),
do not rewrite on reopen. TagBinding objects still not persisted. Recovery
stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1WCTENE087G0R003D6HZS5-*.md` glob. -->
