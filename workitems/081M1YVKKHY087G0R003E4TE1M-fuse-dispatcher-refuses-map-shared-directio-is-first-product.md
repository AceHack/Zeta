---
id: 081M1YVKKHY087G0R003E4TE1M
type: task
state: backlog
priority: P2
slug: fuse-dispatcher-refuses-map-shared-directio-is-first-product
title: "FUSE dispatcher refuses MAP_SHARED; DirectIo is first-product"
created: 2026-09-07T21:15:24.094Z
depends_on: []
composes_with: []
---

# FUSE dispatcher refuses MAP_SHARED; DirectIo is first-product

PR13 first-product FUSE uses `direct_io` and refuses MAP_SHARED
(`ENOSYS`). MAP_PRIVATE is process COW and does not enter the store.
No kernel FUSE. Recovery stays `toy`. Apple Developer Program is not
the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YVKKHY087G0R003E4TE1M-*.md` glob. -->
