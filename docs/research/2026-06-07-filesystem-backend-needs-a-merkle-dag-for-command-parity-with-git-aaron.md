# The filesystem backend needs a Merkle DAG (like git's) so the data-plane commands are EQUAL across git and filesystem (Aaron, 2026-06-07)

The concrete requirement that makes "the data plane is ONE interface over both git AND filesystem"
(`2026-06-07-command-surface-not-1to1-git-...`) actually hold. Faithful capture; Beacon-anchored.

## The steer

> Aaron: *"for our filesystem implementation we are going to need a Merkle tree or something like git does,
> so our commands can be equal between filesystem and git."*

## Why it's required (not optional)

The one-interface promise is: the same retractable/historied/verifiable commands behave identically whether
the bytes land in **git refs** or in **files**. Git gets those properties *for free* from its object model
— a **content-addressed Merkle DAG** (blobs/trees/commits keyed by hash; history = a hash-chain of commits;
integrity = hash verification; dedup + cheap diff = shared subtrees). A plain filesystem has **none** of
that — it's mutable named bytes, no history, no content-addressing, no tamper-evidence. So to make the fs
backend *equal* to the git backend under one interface, the fs implementation must grow its **own Merkle
DAG / content-addressed store** — otherwise `commit`/`log`/`history`/`get`/retract/compensate cannot mean
the same thing on both backends.

Properties the fs backend gains from a Merkle DAG (achieving git-parity):

| Property | git has it via | fs backend gets it via |
|----------|----------------|------------------------|
| History / log | commit hash-chain | Merkle-rooted entry chain |
| Content-addressing / dedup | blob/tree SHA | chunk digest (FastCDC + MerkleHash) |
| Integrity / tamper-evidence | object SHA verify | Merkle root verification |
| Retraction parity | revert/reset over DAG | inverse-entry over the same DAG |
| Cheap diff / incremental ship | shared subtrees | shared internal nodes (already the Merkle trick) |

## We already have most of the primitives

- **`src/Core/Merkle.fs`** — `MerkleHash` (XxHash128, zero-alloc struct) + the tree (leaf-hash,
  internal-node combine, "ship only changed leaves + O(log N) path"). Built as the CAS-DBSP checkpoint
  building block; the same machinery a content-addressed fs store needs.
- **`FastCdc`** — content-defined chunking; pairs with Merkle (chunk → digest → tree), so two versions
  sharing most bytes share most nodes (git-packfile-style incremental).
- **`src/Core/DiskDeltaLog.fs`** — the fs delta-log backend that would sit *on* the content-addressed
  store (its frame `[len][crc][payload]` is per-entry integrity; the Merkle DAG adds cross-entry history +
  content-addressing + a verifiable root).

**Gap to build:** a content-addressed object/blob store + a commit-equivalent (Merkle-rooted history node)
over the fs, wired so `GitCommand`/`DbCommand` verbs resolve identically on the fs backend as on git.

## Hash-strength caveat (honest)

`Merkle.fs` uses **XxHash128 — non-cryptographic** (fast, collision-safe for same-tenant replication, NOT
tamper-proof). Git uses SHA-1/SHA-256 (cryptographic). If the fs store must give git-equivalent
**tamper-evidence / Byzantine integrity** (not just dedup + history), upgrade the leaf/node hash to
**BLAKE3** (already flagged roadmap P2 in `Merkle.fs`). For plain history + dedup parity, XxHash128 is
fine; for "as trustworthy as git's object integrity", it is not — pick per the property the fs store must
match. This is a real decision, not a detail.

## Design refinement — Merkle over retractable Z-sets, closure-table DAG, single- OR multi-file (Aaron 2026-06-07, cont.)

> Aaron: *"we should be able to do Merkle over DBSP retractable Z-sets, and maybe even use our closure
> table — and have the filesystem inside one file with the closure table over Z-sets, or multi-file if we
> use existing OS filesystem."*

Three moves that make the fs-Merkle store *be* the existing substrate rather than a bolt-on:

1. **Merkle leaves are retractable Z-sets, not opaque byte chunks.** Hash Z-set entries `(element, weight)`
   into the tree, so the content-addressed node IS the differential structure. Retraction is then *native*:
   the inverse is a weight-negating Z-set, not a special "undo" — the "retractable by nature" command
   property (`2026-06-07-command-surface-...`) reduces to Z-set algebra under the Merkle root. Two Z-sets
   differing by a small delta share most leaves → most internal Merkle nodes → cheap diff / incremental
   ship (the FastCDC+Merkle trick, now over deltas instead of bytes).

2. **The DAG structure is the closure table — itself a Z-set of edges.** Which node derives from which
   (the Merkle DAG's ancestry) is stored as a **closure table** (ancestor / descendant / depth rows) — and
   that table is *also* a Z-set (of edges). So it's **Z-sets all the way down**: the leaves are Z-sets and
   the structure-over-leaves is a Z-set. That is the **recursive / self-similar** property (manifesto §9/§10)
   falling out for free, and it means the same DBSP incremental-view machinery maintains the history graph
   that maintains the data.

3. **Two physical layouts, ONE logical structure** (the one-interface theme recurring one level down):
   - **Single-file** — the entire filesystem lives *inside one file*: the closure-table-over-Z-sets is
     self-contained (SQLite-shaped — one file, a VFS over it). Portable, atomic, no OS-dir sprawl.
   - **Multi-file** — ride the **existing OS filesystem**: directories/files ARE the DAG nodes
     (git-loose-object-shaped). Native tooling, OS-level sharing.
   Same closure-table-over-Z-sets, Merkle-rooted, both ways — chosen per deployment, identical commands on
   top. (This mirrors git's own loose-objects-vs-packfile duality.)

Added Beacon: **closure table** — Bill Karwin, *SQL Antipatterns* (2010), the closure-table pattern for
storing hierarchies/DAGs relationally (ancestor/descendant/depth); transitive-closure relations.
**Single-file DB** — SQLite (D. Richard Hipp) — one-file database + pluggable VFS. Novelty stays honest:
not a new Merkle store nor a new closure table, but **Merkle-hashing the DBSP Z-set so the
content-addressed history is natively retractable, with the DAG itself a Z-set closure table**, materialized
single- or multi-file under one command interface.

## Ties

- `docs/research/2026-06-07-command-surface-not-1to1-git-...` (the one-interface-over-git-and-fs steer this
  satisfies) · `2026-06-07-identity-proof-tiers-*` (git = a Merkle DAG = half a blockchain; this builds the
  fs half) · `src/Core/Merkle.fs` · `FastCdc` · `src/Core/DiskDeltaLog.fs` · roadmap #1 (no-git-CLI).

## Beacon anchors

- **Ralph Merkle**, "A digital signature based on a conventional encryption function" (CRYPTO 1987) — hash
  trees. · **Git object model** (Linus Torvalds, 2005) — content-addressed Merkle DAG (blob/tree/commit).
  · **Content-addressed storage**: Plan 9 **Venti** (Quinlan & Dorward, 2002), **IPFS** Merkle DAG (Benet,
  2014), **Perkeep/Camlistore**, **Dat/hypercore**. · **FastCDC** — Xia et al., USENIX ATC 2016
  (the chunker). Honest novelty: not a new Merkle store, but a content-addressed fs DAG built to be
  *command-interchangeable with git* under one data-plane interface.
