---
id: 081KQX9B50008QG0R0026BG44J
priority: P1
status: open
title: "Fractal BFT — N maintainers × n(odd) nodes, local broadcast + remote git composition"
created: 2026-05-06
last_updated: 2026-05-19
decomposition: blob
children: [081KRYRGG0008QG0R001JVJV0K]
depends_on: [081KQX9B50008QG0R001MNYK61]
type: feature
---

# 081KQX9B50008QG0R0026BG44J — Fractal BFT architecture

Each maintainer runs their own n(odd)-node local cluster
(minimum 3 for f=1). Local clusters compose with remote
clusters through the git-native claim protocol.

Local layer: broadcast bus, sub-second coordination.
Remote layer: git claims + PR surface, minutes-scale.
Compose: a local node can peer with a remote node from
another cluster — same protocol shape at both scales.

## Depends on

- 081KQX9B50008QG0R001MNYK61 (remote-only background agent test matrix) — proves
  the remote-only path works before multi-cluster composition
- SAFE-AUTONOMOUS-ACTIONS.md (merged #1725) — shared action set
- Claim protocol remote-only mode (merged #1724)
- Broadcast bus (merged #1718)

## Acceptance criteria

1. Protocol doc describing local-cluster + remote-cluster
   composition with worked example
2. At least one remote-only test agent (per 081KQX9B50008QG0R001MNYK61) successfully
   coordinating with the local 3-node cluster
3. The protocol scales to 2+ maintainers without modification
