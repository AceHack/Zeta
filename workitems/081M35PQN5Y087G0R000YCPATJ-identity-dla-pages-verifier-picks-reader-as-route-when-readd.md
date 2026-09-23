---
id: 081M35PQN5Y087G0R000YCPATJ
type: bug
state: backlog
priority: P1
slug: identity-dla-pages-verifier-picks-reader-as-route-when-readd
title: "identity-dla Pages verifier picks reader as route when readdir lists EvidenceRoomPage first"
created: 2026-09-22T23:20:36.798Z
depends_on: []
composes_with: []
---

# identity-dla Pages verifier picks reader as route when readdir lists EvidenceRoomPage first

`gate (required)` red on `b17179b081`. `test (TS hermetic)`:

```
Expected: "index-fixture.js"
Received: "EvidenceRoomPage-fixture.js"
```

`verifyPagesArtifact` used `scripts.find(body.includes("evidence-seam"))`.
The fixture's reader chunk also contains `evidence-seam`. `readdirSync`
order is not a contract, so CI flakes. Select the route chunk as
`evidence-seam` AND NOT `room-evidence`.

Prior art: `#15806` split route vs reader markers; this is the missing
discriminator between them.
