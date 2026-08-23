---
id: 081M0QDJGEP087G0R000N6MATX
type: bug
state: backlog
priority: P2
slug: tsc-fails-on-main-swarm-worker-ts-passes-an-object-where-a-n
title: "tsc fails on main: swarm.worker.ts passes an object where a number is expected"
created: 2026-08-23T13:39:45.238Z
depends_on: []
composes_with: []
---

# tsc fails on main: swarm.worker.ts passes an object where a number is expected

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QDJGEP087G0R000N6MATX-*.md` glob. -->

## Observed

`bunx tsc --noEmit -p tsconfig.json` exits 2 on `origin/main`, with exactly one
error — and it is **not** in any file the rung-reachable-raw-manifests session
touched:

```
src/apps/twitch-ai/src/swarm.worker.ts:40:24 - error TS2345:
  Argument of type '{ apiKey: any; baseUrl: any; model: string; }'
  is not assignable to parameter of type 'number'.
```

`swarm.init(...)` is called with a config object where its declared signature takes
a `number`.

## Provenance, and why it is filed separately

It arrived with `feat: restore twitch-ai and mutual-sim after revert (#14159)`.
Confirmed not mine by `git status --porcelain` on the working branch: the modified
set was cluster files only, none under `src/apps/`.

Filed rather than fixed because that branch had auto-merge armed and a follow-up
push races the merge. It is a one-line signature disagreement and wants its own PR.

## What to check

Whether `swarm.init` should take the config object (the call site's reading) or a
number (the declaration's reading) — one of the two is wrong, and the revert history
around #14159 is where the answer is.
