---
id: 081M010NSB8087G0R002PJVJG7
type: task
state: backlog
priority: P2
slug: rebuild-legacy-b-id-aliases-exceeds-10min-dry-run-git-histor
title: "rebuild-legacy-b-id-aliases exceeds 10min dry-run: git-history mining is the hot path, not the walk"
created: 2026-08-14T20:51:03.656Z
depends_on: []
composes_with: []
---

# rebuild-legacy-b-id-aliases exceeds 10min dry-run: git-history mining is the hot path, not the walk

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M010NSB8087G0R002PJVJG7-*.md` glob. -->

## Observation

`src/Core.TypeScript/backlog/rebuild-legacy-b-id-aliases.ts` is the remedy the
legacy-id gate prints on failure. It is not runnable inside an ordinary agent
tick:

- Aaron, 2026-08-14: a full run **exceeded a 500s timeout and was killed
  mid-rewrite**, having already modified 1,693 files.
- This session: a **`--dry-run` exceeded 590s** and was also killed, on a tree
  where the write-scope had already been narrowed.

The dry-run measurement is the informative one. `--dry-run` performs no writes,
so the cost is **not** the filesystem walk and **not** the number of files
rewritten — it is the alias-map construction, which mines git history
(sources 2, 3, 5 in the script header: rename commits, pre-migration
frontmatter, first `id: B-NNNN` occurrence per file). That is many `git log` /
`git show` subprocesses over the full history.

## Why it matters

A remedy that cannot complete inside a tick is a remedy nobody runs. When the
lint next fires on a genuine authored reference, the advertised fix will again
be abandoned halfway — and a half-applied rewrite is worse than the red check.

## Not this work-item

The **blast radius** half is already fixed (PR for
`shadow/fix-frozen-legacy-backlog-drift`): the rewrite walk now shares
`b-ref-scope.ts` with the linter, so it no longer rewrites archives the linter
refuses to police. That change does **not** improve runtime, and this item
exists so that limitation is on the record rather than assumed fixed.

## Likely shape of a fix

- Cache the derived alias map; the git-history sources are append-only, so the
  mining is re-derivable incrementally rather than from scratch each run.
- Or batch the history queries (one `git log --name-status` pass instead of
  per-file subprocesses).
- Or split the tool: `--rebuild-map` (slow, rare) vs `--apply` (fast, the part
  an agent actually needs when the lint fires).

Measure before optimising — the attribution above is inferred from the
dry-run/full-run comparison, not from a profile.

## Update 2026-08-15 — pressure reduced, item still stands

`lint-no-b-refs.ts` was replaced by `lint-b-refs-resolve.ts`, which permits a
legacy reference and checks that it resolves. Two consequences for this item:

- The gate's failure mode is now **per-reference** ("this id points at
  nothing") rather than **whole-tree** ("some legacy token exists"), so the
  ordinary fix is to correct one reference by hand. The bulk rewrite is no
  longer the advertised first move, and `--report` is what an agent reaches for.
- The runtime defect is **unchanged**. `rebuild-legacy-b-id-aliases.ts` is still
  the only bulk remedy and still mines git history per run, so this item is not
  closed by that change — only made less frequently load-bearing.
