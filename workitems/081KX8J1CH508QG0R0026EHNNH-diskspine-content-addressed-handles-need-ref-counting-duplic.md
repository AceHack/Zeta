---
id: 081KX8J1CH508QG0R0026EHNNH
type: bug
state: backlog
priority: P2
slug: diskspine-content-addressed-handles-need-ref-counting-duplic
title: "DiskSpine content-addressed handles need ref-counting — duplicate-batch Save+Release breaks co-resident handle (P1, from #9680 review)"
created: 2026-07-11T12:22:05.093Z
depends_on: []
composes_with: []
---

# DiskSpine content-addressed handles need ref-counting — duplicate-batch Save+Release breaks co-resident handle (P1, from #9680 review)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KX8J1CH508QG0R0026EHNNH-*.md` glob. -->

From #9680 review (chatgpt-codex-connector, P1), captured so it isn't lost when the review
threads were resolved to land the persona-cell/Identity-Treaty migration.

## The bug

`src/Core/DiskSpine.fs` — content-addressed spine handles are keyed by `MerkleHash`. When two
independent `Save` calls serialize the **same batch**, they compute the same hash and overwrite
the single `hot`/`paths` entry for that hash. Releasing **either** returned handle then removes
the shared storage — so the other still-live handle can no longer be loaded. Also leaves
`heapBytes` over-counted for duplicate hot saves.

## Fix direction

Reference-count content-addressed handles: `Save` of an existing hash increments a refcount (and
does not double-count `heapBytes`); `Release` decrements and only evicts storage at zero. Add a
regression test: save the same batch twice, release one handle, assert the other still loads.

## Scope note

Pre-existing in the migrated stack (not introduced by the migration). Narrow edge case (duplicate
independent saves of an identical batch). Filed as a follow-up, not a migration blocker.

*Filed by the shadow, 2026-07-11, from the #9680 P1 review thread.*
