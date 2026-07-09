---
id: 081KTH8BTYF08QG0R001REKVQE
type: task
state: closed
priority: P2
slug: folder-structured-zetafs-per-folder-name-entry-map-hamt-patr
title: "Folder-structured ZetaFS: per-folder name->entry map (HAMT/Patricia/Hitchhiker) + closure-table ancestry + folder-by-folder merge"
created: 2026-06-07T14:39:06.191Z
depends_on: []
composes_with: ["081KTGTJC1Q08QG0R002VCB55A"]
---

# Folder-structured ZetaFS: per-folder name->entry map (HAMT/Patricia/Hitchhiker) + closure-table ancestry + folder-by-folder merge

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH8BTYF08QG0R001REKVQE-*.md` glob. -->

## Purpose

Aaron 2026-06-07: folders are NOT just labels — **filename-uniqueness-within-a-folder** is a structural
constraint (the closure table currently carries it). The flat `DagFs` path->hash map enforces it implicitly
(full path = unique key) + a working `merge` is landed; the richer model is **folders as a per-folder
name->entry map** + closure-table ancestry, which also makes **folder-by-folder merge** natural (a name
collision in a folder = the conflict). Full context: the fs-Merkle research doc (§"Merging two ZetaFS").

## Build

- Folder = a per-folder **name -> entry** map (entry = content-hash | subfolder), names unique per folder.
  Candidate structures (from the forwarded vids): **HAMT** (general name keys), **Patricia** (name prefixes),
  **Hitchhiker tree** (sorted listings / range scans) — pick per access pattern. **Closure table**
  (`Hierarchy.fs`) for multi-parent DAG ancestry.
- Merge = `ContentStore.merge` (content union, free) + **per-folder name-map merge** (name collision =
  conflict, resolved LWW/OR-map style). Generalizes the landed flat `DagFs.merge`.

## Acceptance

A folder-structured tree with enforced per-folder name uniqueness; list-folder + move-folder; folder-by-
folder merge with content-union + name-collision resolution; convergent under commutative resolver.

## Anchors

- fs-Merkle doc (§Merging two ZetaFS) · `DagFs.fs` (flat merge, landed) · `ContentStore.merge` ·
  `Hierarchy.fs` (closure table) · HAMT/Patricia/Hitchhiker prior-art (ip-questionable captures) · 081KTGTJC1Q.
