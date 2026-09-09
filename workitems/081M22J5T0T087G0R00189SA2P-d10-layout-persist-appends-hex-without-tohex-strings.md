---
id: 081M22J5T0T087G0R00189SA2P
type: task
state: backlog
priority: P2
slug: d10-layout-persist-appends-hex-without-tohex-strings
title: "D10 layout persist appends hex without ToHex strings"
created: 2026-09-09T07:47:32.506Z
depends_on: ["081M22GKEXS087G0R0033JNZ2F"]
composes_with: []
---

# D10 layout persist appends hex without ToHex strings

encodeLayout called ToHex per content, object, and leaf id. It now
AppendHex's into the same StringBuilder as catalog persist. Single-leaf
still skips layout. Recovery stays toy. Not Apple.
