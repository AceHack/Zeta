---
id: 081KT07NV0008QG0R002GV3MXW
priority: P2
status: open
title: Ace `ace update` — re-solve within ranges + rewrite the lockfile (bump; deferred from slice 5.3 lockfile)
effort: S
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KR2E4K0008QG0R002YE3MMD
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
- Single-package bump uses the existing lock as a partial pin set (composes with 081KT07NV0008QG0R003VDHWWG).

## Composes with

- Slice 5.3 spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.3-lockfile-design.md`
- 081KT07NV0008QG0R003VDHWWG (lockfile ergonomics — partial-merge is the single-package-bump primitive)
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)

## Progress — `ace update` core shipped by #6416 (slice 5.4)

The core `ace update <root>` verb landed in slice 5.4: re-solve within ranges + rewrite
`./ace.lock`, **lock-only** (never extracts), running the same integrity preflight as
install **before** writing (content_hash + store-collision + `validatePackagePaths`;
preflight-before-write per spec #6412 / fix-forward #6414). Leaf root → leaf lock.

**Still deferred** (row stays open): `--package <name>` single-dependency bump, which
consumes the 081KT07NV0008QG0R003VDHWWG partial-merge primitive. No `--install` side-effect mode shipped
(update is lock-only by design).
