---
id: 081KTH2F0H708QG0R003S79960
type: task
state: backlog
priority: P3
slug: hitchhiker-tree-path-copying-fractal-b-sorted-persistent-ind
title: "Hitchhiker tree (path-copying fractal B+) sorted persistent index for the COW store — buffered writes + flush control"
created: 2026-06-07T12:55:58.759Z
depends_on: []
composes_with: ["081KTGTJC1Q08QG0R002VCB55A"]
---

# Hitchhiker tree (path-copying fractal B+) sorted persistent index for the COW store — buffered writes + flush control

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH2F0H708QG0R003S79960-*.md` glob. -->

## Purpose

A Hitchhiker tree (David Greenberg) — a **path-copying (functional/immutable) fractal/B+ tree** with
per-index-node write buffers + flush control — as the SORTED, range-scannable, IO/remote-optimized
immutable index for the COW store (081KTGTJC1Q). Complements the HAMT `ImmutableDictionary` (keyed, unordered)
and the Jumprope (large blobs). Full prior-art:
`docs/research/ip-questionable/2026-06-07-david-greenberg-hitchhiker-trees-...md`.

## Why it fits Zeta exactly

- Path-copying = our structural-sharing/COW (only root->leaf path copied; old versions persist = free
  snapshots / cheap branches).
- Buffered writes flushed in batches = our DeltaLog append + group-commit/checkpoint cadence (<1 IO/insert).
- Reads = path-find + project in-range pending ops into the leaf = DBSP integrate/Z-set replay over a tree.
- Flush control = our commit cadence knob; remote-storage tuning = cross-cell/object-store case.

## Build (later; P3)

Path-copying fractal B+ over the ContentStore: index nodes with bounded write buffers; recursive flush;
range scan projecting in-range buffered ops; pluggable flush policy. BLAKE3 (via the hashing port) for node
content addresses. Acceptance: sorted insert/lookup/range-scan; immutable (old root unchanged after insert);
buffered-write IO count beats a plain B+ over a workload; range scan correct under pending buffers.

## Anchors

- Greenberg Hitchhiker trees / datacrypt · fractal/Bε-trees (Bender et al., Tokutek) · B+ (Comer) ·
  persistent search trees / path copying (Sarnak-Tarjan, Okasaki) · LSM (O'Neil) · `ContentStore.fs` /
  `DagFs.fs` / `DeltaLog.fs` / DBSP · 081KTGTJC1Q.
