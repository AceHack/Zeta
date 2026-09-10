---
id: 081M21GEXXY087G0R001WJ79KG
type: task
state: backlog
priority: P2
slug: d10-firstchangedwindow-hashes-chunk-id-without-a-cas-put
title: "D10 firstChangedWindow hashes chunk id without a Cas put"
created: 2026-09-08T21:58:19.838Z
depends_on: ["081M21F108S087G0R003JK8WST"]
composes_with: []
---

# D10 firstChangedWindow hashes chunk id without a Cas put

Prefix-window compare used encodeChunk into an empty Cas, which copied
the payload into Objects and Payloads and threw them away. chunkIdOf
now hashes the same chunk/1 CBOR without a Cas put. Bound 4 MiB for a
500 KiB 1-byte edit walk. Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M21GEXXY087G0R001WJ79KG-*.md` glob. -->
