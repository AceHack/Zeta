---
id: B-0262
zetaid: 081KR2E4K0008QG0R001DYCKNH
priority: P1
status: closed
title: "refresh-worldview scaffold - open-PR list + recent-merges query"
created: 2026-05-08
last_updated: 2026-05-08
closed_by: "tools/refresh-github-worldview/refresh.ts"
parent: B-0159
depends_on: []
classification: buildable-now
decomposition: atomic
---

# B-0262 - refresh-worldview scaffold

First child of B-0159. Create `tools/refresh-github-worldview/refresh.ts`
with two queries:

1. Full open-PR list (`gh pr list --state open --json`)
2. Recent merges since stored SHA (`git log origin/main..`)

Output: single JSON to stdout with `prs[]` and `recentMerges[]`.

## Acceptance criteria

- Script exists at `tools/refresh-github-worldview/refresh.ts`
- Runs via `bun tools/refresh-github-worldview/refresh.ts`
- Outputs valid JSON with prs and recentMerges arrays
- tsc clean
