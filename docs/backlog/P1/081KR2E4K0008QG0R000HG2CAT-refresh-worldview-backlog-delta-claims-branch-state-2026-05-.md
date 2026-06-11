---
id: B-0263
zetaid: 081KR2E4K0008QG0R000HG2CAT
priority: P1
status: closed
title: "refresh-worldview — backlog delta + claim inventory + branch state"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0159
depends_on: [B-0262]
classification: buildable-now
decomposition: atomic
---

# B-0263 — refresh-worldview additional queries

Second child of B-0159. Extend refresh.ts with:

1. Backlog row delta (docs/backlog/ file count vs stored snapshot)
2. Claim-file inventory (claim/* branches on origin)
3. Branch state (current branch ahead/behind origin/main)
4. Pending CI runs

## Acceptance criteria

- refresh.ts outputs backlogDelta, claims, branchState, pendingCI
- Single JSON output preserved
- tsc clean
