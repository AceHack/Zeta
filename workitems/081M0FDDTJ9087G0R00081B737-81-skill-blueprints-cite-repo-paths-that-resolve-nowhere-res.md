---
id: 081M0FDDTJ9087G0R00081B737
type: task
state: backlog
priority: P2
slug: 81-skill-blueprints-cite-repo-paths-that-resolve-nowhere-res
title: "81 skill blueprints cite repo paths that resolve nowhere — residual after the mechanical sweep"
created: 2026-08-20T11:03:16.297Z
depends_on: []
composes_with: []
---

# 81 skill blueprints cite repo paths that resolve nowhere — residual after the mechanical sweep

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0FDDTJ9087G0R00081B737-*.md` glob. -->

## What

`audit-skill-path-refs.ts` (landed alongside this item) reports **81 stale path
references** remaining in `.claude/skills/**/*.md` after the mechanical sweep took the
total from 218 down. These resolve nowhere in the tracked tree — not at the cited path,
not under an archive dir, not by basename anywhere.

## Why it is not one more mechanical pass

The 137 already fixed had a mechanical answer: a `tools/*` -> `src/Core.*` and
`src/Zeta.Core/` -> `src/Core/` reorg the skills never followed, plus rules moved to
`rules.bak/` by the #6676 sweep, plus 20 references to sibling expert-skills that
`git log` shows were **never created**. Every one of those had a real target.

These 81 do not. Each needs a per-item call between two honest options:

1. **The artifact should exist** -> create it (e.g. **docs/ASPIRATIONS.md** x5,
   **docs/STYLE.md** x3, **tools/setup/common/verifiers.sh** x4 are cited as though load-bearing).
2. **The claim is false** -> delete the pointer. Removing a false claim is always correct;
   inventing a plausible-looking target to silence the auditor would be worse than the
   dangler, because it launders a dead reference into a live-looking one.

Bulk-editing them blind would be option 3: manufacturing resolution. That is the failure
this auditor exists to catch, so it is explicitly not the fix.

## Highest-count offenders

| refs | path |
|---|---|
| 5 | **docs/ASPIRATIONS.md** |
| 4 | **src/Core/Kll.fs** |
| 4 | **tools/setup/common/verifiers.sh** |
| 3 | **docs/STYLE.md** |
| 3 | **docs/github-repo-settings-snapshot.md** |
| 3 | **docs/hygiene-history/pulse-snapshot.md** |

The six above are written **bold, not in backticks, on purpose**: they resolve
nowhere by definition — they are this item's subject, not its pointers. A
backtick path-ref is read by `src/Core.TypeScript/backlog/auto-vivify.ts` as a
claim the file exists today, so code-spanning a censused absence turns the
preflight lane red for naming the very thing the item exists to name. Keep them
unspanned until each is resolved or deleted.

Full list: run `bun src/Core.TypeScript/hygiene/audit-skill-path-refs.ts --report <out>.md`,
or read the `skill-path-refs-audit-*` artifact from `factory-hygiene-audit-cadence.yml`.

## Done when

Every one of the 81 has been either resolved to a real artifact or deleted, and the
auditor reports `stale 0` — or the survivors are documented here with the reason each
is intentionally unresolvable.
