---
id: 081M22GKEXS087G0R0033JNZ2F
type: task
state: backlog
priority: P2
slug: d10-catalog-persist-appends-hex-without-tohex-strings
title: "D10 catalog persist appends hex without ToHex strings"
created: 2026-09-09T07:20:02.745Z
depends_on: ["081M21NVSJ2087G0R002J9WVRP"]
composes_with: []
---

# D10 catalog persist appends hex without ToHex strings

encodeCatalog called ToHex per ContentHash256 (StringBuilder plus
ToString("x2") per byte). AppendHex writes nibbles into the catalog
builder. Freeze-storm bound stays 12 MiB. Recovery stays toy. Not Apple.
