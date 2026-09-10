---
id: 081M23BDKQA087G0R001QEFR2E
type: task
state: backlog
priority: P2
slug: d10-freeze-intent-and-commit-write-cbor-without-dynamicvalue
title: "D10 freeze intent and commit write CBOR without DynamicValue"
created: 2026-09-09T15:08:42.602Z
depends_on: ["081M239JRJ0087G0R001FCAKEH"]
composes_with: []
---

# D10 freeze intent and commit write CBOR without DynamicValue

encodeIntent / encodeCommit built a DynamicValue graph (lists,
ImmutableArray per leaf). They now write the same RFC 8949 maps, keeping
the historical key order (decode is by name). Freeze-storm bound stays
12 MiB. Recovery stays toy. Not Apple.
