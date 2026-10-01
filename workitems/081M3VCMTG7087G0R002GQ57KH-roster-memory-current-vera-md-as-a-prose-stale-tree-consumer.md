---
id: 081M3VCMTG7087G0R002GQ57KH
type: bug
state: backlog
priority: P1
slug: roster-memory-current-vera-md-as-a-prose-stale-tree-consumer
title: "Roster memory/CURRENT-vera.md as a prose stale-tree consumer"
created: 2026-10-01T09:27:35.687Z
depends_on: []
composes_with: []
---

# Roster memory/CURRENT-vera.md as a prose stale-tree consumer

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3VCMTG7087G0R002GQ57KH-*.md` glob. -->

## Symptom

`gate (required)` red on `origin/main` `8ea4b2c648` (archive of PR #17438 as
#17808). Three jobs, one finding:

- `lint (yaml/k8s)` — `audit-cluster-tree-consumers.ts`
- `test (TS hermetic)` — `the REAL repo roster matches the REAL tree`
- `lint (bash retirement inventory + hygiene unit tests)` — same test

Finding: `[unrostered-consumer] memory/CURRENT-vera.md` names
`infra/k8s/bootstrap/argocd-install.yaml` in leftover-grade notes and is not
in `cluster-tree-consumers.json`.

`build-and-test (windows-11-arm)` HungPast 2000 ms on the CBOR length bomb is
a separate non-blocking flake, not this item. `drift (loud)` is not in the
gate floor.

## Fix

Roster the file as `prose`. The leftover-grade notes are about the stale
path; pointing them at `full-ai-cluster/` would falsify what Vera graded.
Nothing resolves the path.

## Done when

`bun src/Core.TypeScript/hygiene/audit-cluster-tree-consumers.ts` exits 0
against the live tree, and the real-repo roster test is green.
