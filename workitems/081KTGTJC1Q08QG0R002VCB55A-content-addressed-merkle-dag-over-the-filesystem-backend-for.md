---
id: 081KTGTJC1Q08QG0R002VCB55A
type: task
state: backlog
priority: P1
slug: content-addressed-merkle-dag-over-the-filesystem-backend-for
title: "Content-addressed Merkle DAG over the filesystem backend for command parity with git"
created: 2026-06-07T10:38:00.247Z
depends_on: []
composes_with: ["081KTGPC2XP08QG0R000X8X1M9"]
---

# Content-addressed Merkle DAG over the filesystem backend for command parity with git

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGTJC1Q08QG0R002VCB55A-*.md` glob. -->

## Purpose

Make the data-plane "one interface over BOTH git and filesystem" actually hold (Aaron 2026-06-07): the
fs backend needs its own **content-addressed Merkle DAG** so `commit`/`log`/`history`/`get`/retract/
compensate mean the *same thing* on fs as on git. A plain filesystem has no history, no content-addressing,
no tamper-evidence; git gets all three from its object model. Build the fs equivalent.

Full rationale + property-parity table + hash-strength caveat:
`docs/research/2026-06-07-filesystem-backend-needs-a-merkle-dag-for-command-parity-with-git-aaron.md`.

## Build (primitives already exist — wire them into a store)

- **Have:** `src/Core/Merkle.fs` (`MerkleHash`/XxHash128 tree, ship-changed-leaves+O(log N) path),
  `FastCdc` (content-defined chunking), `src/Core/DiskDeltaLog.fs` (fs delta-log, per-entry `[len][crc]`).
- **Build:** a content-addressed object/blob store (chunk → digest → Merkle tree) + a commit-equivalent
  (Merkle-rooted history node) over the fs, wired so `GitCommand`/`DbCommand` verbs resolve identically on
  the fs backend as on the git backend (the parity test: same command sequence → equivalent observable
  history/get/retract results on both backends).

### Design refinement (Aaron 2026-06-07, cont.) — Merkle over Z-sets, closure-table DAG, single/multi-file

- **Merkle leaves = retractable Z-set entries** `(element, weight)`, NOT opaque byte chunks → the
  content-addressed node IS the differential structure; retraction = a weight-negating Z-set (native, no
  special undo). Small delta → shared leaves → shared Merkle nodes (cheap incremental).
- **DAG ancestry = a closure table** (ancestor/descendant/depth), itself a **Z-set of edges** → Z-sets all
  the way down (leaves + structure), so the recursive/self-similar property (manifesto §9/§10) is free and
  the same DBSP incremental-view machinery maintains the history graph.
- **Two physical layouts, one logical structure** (pick per deployment, identical commands on top):
  **single-file** (whole fs in ONE file, closure-table-over-Z-sets self-contained, SQLite-shaped + a VFS)
  OR **multi-file** (ride the OS filesystem; dirs/files ARE nodes, git-loose-object-shaped). Mirrors git's
  loose-vs-packfile duality. Both must pass the same backend-parity test.
- Beacon add: closure table (Karwin, *SQL Antipatterns* 2010); single-file DB + VFS (SQLite).

## Open decision (Aaron's call — real, not a detail)

**Hash strength.** `Merkle.fs` is XxHash128 (non-crypto: fast, dedup+history-safe, NOT tamper-proof). Git
uses cryptographic SHA. If the fs store must match git's **tamper-evidence/Byzantine integrity**, upgrade
leaf/node hash to **BLAKE3** (already roadmap-P2-flagged in `Merkle.fs`). For history+dedup parity only,
XxHash128 suffices. Pick per the property the fs store must equal.

## Acceptance

A content-addressed Merkle store backs the fs delta-log; a parity test runs the same command sequence
against git-backend and fs-backend and asserts equivalent observable results (history, get-by-coordinate,
retraction/compensation). Hash-strength decision recorded.

## Anchors

- `docs/research/2026-06-07-filesystem-backend-needs-a-merkle-dag-...` ·
  `docs/research/2026-06-07-command-surface-not-1to1-git-...` (the one-interface steer this satisfies) ·
  `src/Core/Merkle.fs` · `FastCdc` · `src/Core/DiskDeltaLog.fs` · composes with `081KTGPC2XP` (punch-list).
- Beacon: Merkle (CRYPTO 1987); git object model; Venti/IPFS/Perkeep (content-addressed stores); FastCDC.
