---
id: B-0264
priority: P1
status: open
title: "refresh-worldview — integrate into tick scripts as canonical pre-decide"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0159
depends_on: [B-0262, B-0263]
classification: blocked-on-B-0262
decomposition: atomic
type: friction-reducer
---

# B-0264 — refresh-worldview tick integration

Third child of B-0159. Wire refresh.ts into all agent
tick scripts as the canonical pre-decide refresh call.

## Acceptance criteria

- Otto's tick calls refresh.ts before picking work
- Vera's tick calls refresh.ts before picking work
- Lior's tick calls refresh.ts before reporting status
- Summary field in JSON enables cross-cutting drift detection
