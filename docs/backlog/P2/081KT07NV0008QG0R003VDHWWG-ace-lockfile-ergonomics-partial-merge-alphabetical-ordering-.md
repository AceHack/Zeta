---
id: 081KT07NV0008QG0R003VDHWWG
priority: P2
status: open
title: Ace lockfile ergonomics — partial-merge, alphabetical ordering, leaf-install lock (deferred from slice 5.3)
effort: S
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KR2E4K0008QG0R002YE3MMD
composes_with: []
tags: [ace, package-manager, lockfile, ergonomics, deferred-enhancement, slice-5.3]
---

## What this row proposes

Three small lockfile ergonomics deferred from slice 5.3 (which keeps the lock minimal:
full-graph, install-ordered, written only for dependency installs):

1. **Partial-merge** — add/bump one dependency without a full re-solve, holding the rest of
   the lock pinned (the primitive `ace update --package <name>` (081KT07NV0008QG0R002GV3MXW) builds on).
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
- 081KT07NV0008QG0R002GV3MXW (`ace update` — consumes the partial-merge primitive)
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)

## Progress — leaf-install lock shipped by #6416 (slice 5.4)

Item #3 (leaf-install lock) landed in slice 5.4: `buildLeafLockfile(root)` →
`{ format_version: 1, root, nodes: [] }`; default-written on a leaf `ace install`
(warn on fail), read + drift-gated under `--frozen`, compared under `--locked`.
`ace update` on a leaf writes it too.

**Still deferred** (row stays open): #1 partial-merge (the single-package-bump primitive
081KT07NV0008QG0R002GV3MXW `--package` builds on) and #2 alphabetical node ordering with re-derived install
order. The lock format is unchanged (`format_version: 1`, deterministic install order).
