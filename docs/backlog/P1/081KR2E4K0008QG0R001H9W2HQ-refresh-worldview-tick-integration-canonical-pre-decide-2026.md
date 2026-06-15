---
id: B-0264
zetaid: 081KR2E4K0008QG0R001H9W2HQ
priority: P1
status: closed
title: "refresh-worldview — integrate into tick scripts as canonical pre-decide"
created: 2026-05-08
last_updated: 2026-05-09
closed_by: "PR via claim/B-0264-refresh-worldview-tick-integration"
parent: 081KQGDBJ0008QG0R003H0G5YQ
depends_on: [081KR2E4K0008QG0R001DYCKNH, 081KR2E4K0008QG0R000HG2CAT]
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# B-0264 — refresh-worldview tick integration

Third child of B-0159. Wire refresh-worldview.ts into all
agent tick scripts as the canonical pre-decide refresh call.

## Acceptance criteria

- Otto's tick calls refresh-worldview.ts before picking work
- Vera's tick calls refresh-worldview.ts before picking work
- Lior's tick calls refresh-worldview.ts before reporting status
- Summary field in JSON enables cross-cutting drift detection
