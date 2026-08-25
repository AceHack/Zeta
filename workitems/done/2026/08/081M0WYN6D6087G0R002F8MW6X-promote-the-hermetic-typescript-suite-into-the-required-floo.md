---
id: 081M0WYN6D6087G0R002F8MW6X
type: task
state: done
priority: P1
slug: promote-the-hermetic-typescript-suite-into-the-required-floo
title: "Promote the hermetic TypeScript suite into the required floor"
created: 2026-08-25T17:14:31.206Z
completed: 2026-08-25T17:26:31.512Z
depends_on: []
composes_with: []
---

# Promote the hermetic TypeScript suite into the required floor

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WYN6D6087G0R002F8MW6X-*.md` glob. -->

## Evidence

- PR #15352 merged with `test (TS hermetic)` failed and `gate (required)`
  successful.
- PR #15358 repaired the cold-Go execution budget but merged before the
  hermetic result completed.
- PR #15395 supplied a second post-repair hermetic success before merge.

## Acceptance

- `gate-required.needs` includes `test-typescript-hermetic`.
- `test-typescript-environment` remains outside the required floor.
- The floor registry and accepted drift-and-heal ADR record the whole-tree
  exception, its measured evidence, and its cost.
- A source-owned structural test fails if the required dependency disappears.
