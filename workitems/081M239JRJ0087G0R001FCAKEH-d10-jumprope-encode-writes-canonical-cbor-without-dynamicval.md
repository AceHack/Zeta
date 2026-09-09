---
id: 081M239JRJ0087G0R001FCAKEH
type: task
state: backlog
priority: P2
slug: d10-jumprope-encode-writes-canonical-cbor-without-dynamicval
title: "D10 jumprope encode writes canonical CBOR without DynamicValue"
created: 2026-09-09T14:36:34.240Z
depends_on: ["081M22J5T0T087G0R00189SA2P"]
composes_with: []
---

# D10 jumprope encode writes canonical CBOR without DynamicValue

encodeChunk / encodeLeaf / encodeLimb / encodeTrunk / firstChangedWindow
built a DynamicValue graph (F# lists, ImmutableArray, List<byte>) per
object. They now write the same RFC 8949 maps into a reused buffer.
Golden vectors still lock ContentId. 32 one-byte builds < 256 KiB.
Freeze-storm bound stays 12 MiB. Recovery stays toy. Not Apple.
