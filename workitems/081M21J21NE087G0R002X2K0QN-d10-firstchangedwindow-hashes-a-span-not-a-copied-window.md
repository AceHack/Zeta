---
id: 081M21J21NE087G0R002X2K0QN
type: task
state: backlog
priority: P2
slug: d10-firstchangedwindow-hashes-a-span-not-a-copied-window
title: "D10 firstChangedWindow hashes a span not a copied window"
created: 2026-09-08T22:26:14.830Z
depends_on: ["081M21GEXXY087G0R001WJ79KG"]
composes_with: []
---

# D10 firstChangedWindow hashes a span not a copied window

Prefix-window compare copied each window into a new array before hashing
chunk/1 CBOR. It now hashes a ReadOnlySpan over the file bytes. Walk of
a 500 KiB 1-byte edit < 3 MiB (2 MiB was the guess; CBOR of chunk/1 still
copies). Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M21J21NE087G0R002X2K0QN-*.md` glob. -->
