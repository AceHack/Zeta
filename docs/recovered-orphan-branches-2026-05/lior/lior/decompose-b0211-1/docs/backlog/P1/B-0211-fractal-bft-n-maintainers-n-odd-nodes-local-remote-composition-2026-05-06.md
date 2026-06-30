---
id: B-0211
priority: P1
status: open
title: "Fractal BFT — N maintainers × n(odd) nodes, local broadcast + remote git composition"
created: 2026-05-06
last_updated: 2026-05-15
decomposition: blob
depends_on: [B-0209]
children: [B-0527]
type: feature
---

# B-0211 — Fractal BFT architecture

Each maintainer runs their own n(odd)-node local cluster
(minimum 3 for f=1). Local clusters compose with remote
clusters through the git-native claim protocol.

Local layer: broadcast bus, sub-second coordination.
Remote layer: git claims + PR surface, minutes-scale.
Compose: a local node can peer with a remote node from
another cluster — same protocol shape at both scales.

## Depends on

- B-0209 (remote-only background agent test matrix) — proves
  the remote-only path works before multi-cluster composition
- SAFE-AUTONOMOUS-ACTIONS.md (merged #1725) — shared action set
- Claim protocol remote-only mode (merged #1724)
- Broadcast bus (merged #1718)

## Acceptance criteria

1. Protocol doc describing local-cluster + remote-cluster
   composition with worked example
2. At least one remote-only test agent (per B-0209) successfully
   coordinating with the local 3-node cluster
3. The protocol scales to 2+ maintainers without modification
