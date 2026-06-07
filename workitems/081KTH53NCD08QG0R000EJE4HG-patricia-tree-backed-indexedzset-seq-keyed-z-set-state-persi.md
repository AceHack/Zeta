---
id: 081KTH53NCD08QG0R000EJE4HG
type: task
state: backlog
priority: P3
slug: patricia-tree-backed-indexedzset-seq-keyed-z-set-state-persi
title: "Patricia-tree-backed IndexedZSet / seq-keyed Z-set state (persistent store-only-diffs) — do it in zset"
created: 2026-06-07T13:42:12.621Z
depends_on: []
composes_with: ["081KTH4Q78208QG0R0022E5Z3Z"]
---

# Patricia-tree-backed IndexedZSet / seq-keyed Z-set state (persistent store-only-diffs) — do it in zset

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH53NCD08QG0R000EJE4HG-*.md` glob. -->

## Purpose

Aaron 2026-06-07: *"[Patricia trees in Z-set] is what i was also saying do in zset."* Back `IndexedZSet` /
seq-keyed Z-set state with a **Patricia tree** (immutable integer-keyed persistent map; Okasaki & Gill) so
per-version state is copy-only-on-the-diff (structural sharing) — the COW property the store/branches need,
and the perf win Sparta saw (90% mem / 60% time hash-table → Patricia). Complements the HAMT
(`ImmutableDictionary`, general keys) with the int/seq-keyed specialist.

## Build (P3)

- A Patricia-trie persistent int-keyed map (or adopt one) backing `IndexedZSet` / seq/register-keyed state.
- Bench vs the current representation (Naledi): memory + update time on a churny workload.
- Keep DBSP semantics + golden vectors unchanged (structure swap, not a semantics change).

## Anchors

- Patricia trees (Okasaki & Gill, Fast Mergeable Integer Maps) · Sparta capture
  (`docs/research/ip-questionable/2026-06-07-sparta-abstract-interpretation-...md`) · `IndexedZSet.fs` ·
  `ImmutableDictionary`/HAMT (the general-key sibling) · ContentStore/DagFs (COW) · 081KTH4Q782 (CRDT-on-zset).

