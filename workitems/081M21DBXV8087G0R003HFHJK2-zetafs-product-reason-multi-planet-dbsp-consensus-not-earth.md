---
id: 081M21DBXV8087G0R003HFHJK2
type: task
state: backlog
priority: P2
slug: zetafs-product-reason-multi-planet-dbsp-consensus-not-earth
title: "ZetaFS product reason: multi-planet DBSP consensus not Earth-only FS"
created: 2026-09-08T21:04:15.720Z
depends_on: []
composes_with: []
---

# ZetaFS product reason: multi-planet DBSP consensus not Earth-only FS

ZetaDB's aim is the fastest DBSP database that still agrees across planets.
The honest statement is not "geo consensus is impossible, therefore federate."
Cross-site is already weaker than consensus (CALM-monotonic). Raft is the
wrong tool: a total order nobody across sites needs, priced by distance.
Not shipped. Not a ZD4 batching win. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M21DBXV8087G0R003HFHJK2-*.md` glob. -->
