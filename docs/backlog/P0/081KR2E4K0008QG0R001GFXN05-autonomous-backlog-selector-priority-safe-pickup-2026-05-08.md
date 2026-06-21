---
id: 081KR2E4K0008QG0R001GFXN05
priority: P0
status: closed
closed: 2026-05-08
closed_by: "tools/backlog/autonomous-pickup.ts priority/age selector, open-child/open-PR claim filtering, decompose-first action, and focused tests"
title: "Autonomous backlog pickup - priority selector"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQZVQW0008QG0R000C35RNY
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect, backlog-shepherd]
---

# 081KR2E4K0008QG0R001GFXN05 - Autonomous backlog selector

Build the read-only selector that runs when the PR queue is empty
and returns the next safe backlog item to work.

## Acceptance criteria

- Reads committed backlog rows from `docs/backlog/**`.
- Orders candidates by priority, then creation/update age.
- Skips closed rows, already-decomposed parents with open children,
  rows with active claim branches, and rows with open PR branches.
- Returns `decompose-first` when the best candidate is still a blob.
- Emits a concise machine-readable decision record for loop logs.
