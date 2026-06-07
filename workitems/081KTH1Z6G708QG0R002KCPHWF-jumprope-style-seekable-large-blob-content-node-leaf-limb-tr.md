---
id: 081KTH1Z6G708QG0R002KCPHWF
type: task
state: backlog
priority: P3
slug: jumprope-style-seekable-large-blob-content-node-leaf-limb-tr
title: "Jumprope-style seekable large-blob content node (Leaf/Limb/Trunk skiplist over FastCdc chunks) for the COW store"
created: 2026-06-07T12:47:20.583Z
depends_on: []
composes_with: ["081KTGTJC1Q08QG0R002VCB55A"]
---

# Jumprope-style seekable large-blob content node (Leaf/Limb/Trunk skiplist over FastCdc chunks) for the COW store

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH1Z6G708QG0R002KCPHWF-*.md` glob. -->

## Purpose

A Jumprope-style (Scott Vokes, Strange Loop 2012) seekable large-blob content node for the COW store
(081KTGTJC1Q): the right leaf type for BIG FILES / streaming, complementing `ZSetMerkle` (which is for
structured Z-set data). Full prior-art:
`docs/research/2026-06-07-jumprope-vokes-content-addressed-storage-skiplist-hash-prior-art-aaron.md`.

## Build

- Leaf (raw chunk) / Limb (array of content hashes + links) / Trunk (limb with big end node), over a KV /
  ContentStore backing. Chunk with the existing `FastCdc.fs` (rolling hash); content-hash chunks with
  `Merkle.fs`. Skiplist-with-hash-as-probability for O(log n) seek (the "distance" express-lanes).
- CAS-not-pointers (lock-free); persistent/immutable (COW, cache anywhere); tunable guarantees.
- A `DagFs` leaf whose content is a large file resolves to a Jumprope instead of a single Merkle node.

## Acceptance

Store/stream a large blob as Leaf/Limb/Trunk over FastCdc chunks; content-addressed + dedup'd; seek to an
offset in O(log n); round-trip (store -> fetch == original); two blobs sharing chunks dedup at the chunk
level.

## Anchors

- Vokes Jumprope (Strange Loop 2012) · Pugh skip lists · `FastCdc.fs` · `Merkle.fs` · `ContentStore.fs` ·
  `DagFs.fs` · 081KTGTJC1Q (the store) · PRIOR-ART-LIST.
