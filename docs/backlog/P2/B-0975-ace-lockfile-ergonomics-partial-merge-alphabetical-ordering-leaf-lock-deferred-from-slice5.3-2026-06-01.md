---
id: B-0975
priority: P2
status: open
title: Ace lockfile ergonomics — partial-merge, alphabetical ordering, leaf-install lock (deferred from slice 5.3)
effort: S
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - B-0288
composes_with: []
tags: [ace, package-manager, lockfile, ergonomics, deferred-enhancement, slice-5.3]
---

## What this row proposes

Three small lockfile ergonomics deferred from slice 5.3 (which keeps the lock minimal:
full-graph, install-ordered, written only for dependency installs):

1. **Partial-merge** — add/bump one dependency without a full re-solve, holding the rest of
   the lock pinned (the primitive `ace update --package <name>` (B-0973) builds on).
2. **Alphabetical ordering** — emit `nodes` sorted by name with the install order
   re-derived at `--frozen` time (cleaner diffs), instead of slice-5.3's
   deterministic-install-order serialization.
3. **Leaf-install lock** — write a trivial lock (root + empty `nodes`) for no-dependency
   installs too, so `--frozen` works uniformly on leaf artifacts.

## Why deferred (operator 2026-06-01)

Slice 5.3's serialization is already deterministic (install order is stable because
solve+resolve are deterministic), so alphabetical ordering is a diff-readability nicety,
not correctness. Partial-merge is an optimization over solve-fresh-then-write. Leaf-lock
adds a uniform-but-empty artifact. None are needed for the core write + `--frozen`-replay
guarantee. Operator: *"everything we skipped lets slice off for further enhancements."*

## Scope sketch

- Partial-merge: `buildLockfile` variant that takes an existing lock + a single changed
  node and re-pins only the affected subtree.
- Alphabetical: sort `nodes` by `name` on serialize; re-derive install order from the dep
  graph at `--frozen` time (requires the lock to also carry edges, or a topo re-derivation
  from the installed manifests).
- Leaf-lock: extend the leaf (no-dep) install path to write `{ format_version, root, nodes: [] }`.

## Composes with

- Slice 5.3 spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.3-lockfile-design.md`
- B-0973 (`ace update` — consumes the partial-merge primitive)
- B-0288 (Ace DLC package manager CLI)
