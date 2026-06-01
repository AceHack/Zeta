---
id: B-0973
priority: P2
status: open
title: Ace `ace update` — re-solve within ranges + rewrite the lockfile (bump; deferred from slice 5.3 lockfile)
effort: S
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - B-0288
composes_with: []
tags: [ace, package-manager, lockfile, update, deferred-enhancement, slice-5.3]
---

## What this row proposes

Slice 5.3 writes a lockfile on a normal `ace install` (solve fresh → write) and replays
it under `--frozen`. There is no explicit "bump within the declared ranges" command:
today re-locking just means running a normal `ace install` (which always solves fresh and
rewrites the lock). This row tracks a dedicated **`ace update`** verb that re-solves the
root's ranges against the current registry and rewrites `./ace.lock` — the cargo
`cargo update` analog — with optional `--package <name>` to bump a single dependency.

## Why deferred (operator 2026-06-01)

Slice 5.3's normal `ace install` already regenerates the lock (solve-fresh-then-write), so
a separate `update` verb is pure ergonomics, not a capability gap. Keep slice 5.3 to
write + `--frozen`-replay. Operator: *"everything we skipped lets slice off for further
enhancements."*

## Scope sketch

- `ace update [--package <name>] [--lockfile <path>]`: read the root, solve fresh (or
  solve with all-but-`<name>` pinned to the existing lock when `--package` is given),
  write the lock. No install side effect required (lock-only), or `--install` to also
  install.
- Single-package bump uses the existing lock as a partial pin set (composes with B-0975).

## Composes with

- Slice 5.3 spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.3-lockfile-design.md`
- B-0975 (lockfile ergonomics — partial-merge is the single-package-bump primitive)
- B-0288 (Ace DLC package manager CLI)
