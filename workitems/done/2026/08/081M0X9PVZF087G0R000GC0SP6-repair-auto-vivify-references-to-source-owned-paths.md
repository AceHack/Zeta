---
id: 081M0X9PVZF087G0R000GC0SP6
type: bug
state: done
priority: P1
slug: repair-auto-vivify-references-to-source-owned-paths
title: "Repair auto-vivify references to source-owned paths"
created: 2026-08-25T20:27:40.399Z
completed: 2026-08-25T20:41:22.136Z
depends_on: []
composes_with: []
---

# Repair auto-vivify references to source-owned paths

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X9PVZF087G0R000GC0SP6-*.md` glob. -->

## Defect

`bun run preflight:quick` reports eleven dangling paths across four newly added
workitems. Each abbreviated path names a real file but omits its canonical source
root, so the auto-vivify gate resolves it under a nonexistent `db/` location.

## Acceptance

- All eleven references point at their tracked canonical paths.
- `bun src/Core.TypeScript/hygiene/auto-vivify.ts --check` passes.
- `bun run preflight:quick` passes without weakening the resolver.

## Resolution

The four affected workitems now use canonical tracked paths. TypeScript and
Python implementation references resolve under `src/`; the stage-0 shell helper
resolves under the policy-approved `tools/setup/` edge. The resolver itself was
not changed.

## Verification

- `bun src/Core.TypeScript/backlog/auto-vivify.ts --check` - 630 files scanned,
  zero dangling references.
- `bun run preflight:quick` - all 13 executed checks passed.
