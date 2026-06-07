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

## Hash strength — DECIDED: BLAKE3 (Aaron 2026-06-07)

> Aaron: *"we want to replace git eventually with our own compatible backend, so we need BLAKE3 — something
> that respects tamper. We don't want to lose features."*

**Decision: the fs-Merkle store uses BLAKE3 (cryptographic, tamper-respecting) — not XxHash128.** The
reasoning is the end-goal, not just the parity bar: the fs backend is meant to eventually **replace git
with a compatible backend**, so it must be *at least as trustworthy as git's object integrity* and **lose
no features**. XxHash128 (fast, non-crypto — fine for same-tenant dedup/history) would forfeit
tamper-evidence, which is a git feature we refuse to lose. So:

- **Leaf/node hash = BLAKE3** (cryptographic; faster than SHA-2, tree-/SIMD-friendly — a good fit for a
  Merkle tree). `Merkle.fs` already flags this as the roadmap-P2 upgrade path; this decision promotes it
  from "if you need Byzantine guarantees" to **required** for the git-replacement backend.
- **Current state:** BLAKE3 is *not yet a dependency* (only a comment in `Merkle.fs`); adding it +
  parameterizing the Merkle hash is part of workitem `081KTGTJC1Q`.
- XxHash128 may still serve where only same-tenant dedup speed matters (e.g. the CAS-DBSP checkpoint path
  it was built for); the **git-replacement object store** is BLAKE3.

### Bigger intent: a git-COMPATIBLE replacement backend, feature-non-loss as a hard requirement

This reframes the workitem from "fs parity for the data-plane" to "**our own git-compatible backend that
eventually replaces git**." Consequences: (a) tamper-evidence is mandatory (→ BLAKE3, above); (b)
**feature-non-loss** becomes an explicit acceptance bar — the git features we depend on (history, branching,
content-addressing, integrity verification, diff/merge, packing) must each have an equal-or-better analogue,
not be silently dropped. "Compatible" is the load-bearing word: it must interoperate with / stand in for git
where our work-cycle uses git, not merely resemble it.

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

4. **Content-addressed nodes → single-instance + multi-parent + an explicit edit-scope choice** (Aaron
   2026-06-07): *"based on content-based hashes, a single file is only represented once and it can live
   under two different folders at the same time; then when you edit a file you choose to save it just to
   that one folder (the default, like regular filesystems) or to do a content update everywhere."*
   - **Single-instance.** Each file's content is stored **once**, keyed by its **content hash (BLAKE3)** —
     identical content under many paths is one node (dedup / single-instance storage). The content hash
     *is* the node id; the `ZSetMerkle` root over the node's bytes/entries is the natural key.
   - **Multi-parent.** A content node can sit under **two (or N) folders simultaneously** — many parent
     edges to one node in the closure table (a Z-set of edges naturally allows many-to-one). Hardlink- /
     git-blob-shaped: one blob, multiple tree entries.
   - **Two edit modes — the user chooses scope:**
     | Mode | Semantics | Mechanism |
     |------|-----------|-----------|
     | **save-to-this-folder** (DEFAULT, regular-fs feel) | copy-on-write fork — only *this* folder sees the change | new content node (new hash); repoint **only this folder's edge**; other referrers keep the old node |
     | **content-update-everywhere** | every folder referencing the content follows the change | replace the content node; **all parent edges** that pointed at the old hash now point at the new hash |
   - Both modes are pure closure-table edge edits (retraction repoints an edge; idempotent by content
     hash) — so they inherit DST-replay + the retractable/compensating command discipline.

Added Beacon: **closure table** — Bill Karwin, *SQL Antipatterns* (2010), hierarchies/DAGs relationally
(ancestor/descendant/depth). **Single-file DB** — SQLite (D. Richard Hipp), one-file DB + pluggable VFS.
**Content-addressed single-instance + multi-reference**: Unix **hardlinks** (one inode, many dir entries),
**git blobs** (content-addressed, shared across trees/commits), single-instance storage (Windows SIS),
**copy-on-write clones** (ZFS / btrfs / APFS) — the COW-local-vs-propagate choice is exactly "clone the
blob and repoint one edge" vs "edit the shared object." Novelty stays honest: not a new Merkle store nor a
new closure table, but **Merkle-hashing the DBSP Z-set so the content-addressed history is natively
retractable, the DAG itself a Z-set closure table with content-hash single-instance multi-parent nodes**,
materialized single- or multi-file under one command interface.

## ZetaFS is BRANCH-scoped — a branch is a Merkle root (Aaron, 2026-06-07)

> Aaron: *"in our Merkle tree the filesystem is scoped to branches, right? so the collision would be same
> branch + filename + different content hash."*

Yes. **Each branch is a Merkle root — a COW tree version** (every content-store `put` / `DagFs` op yields a
new root; old roots persist as cheap branches). So the scoping is:

- **Filename uniqueness is WITHIN a branch** (a branch-relative path is the unique key); different branches
  may hold the same path with different content — that's not a conflict until you *merge* them.
- **The merge collision is `same branch-relative path + different content hash`** — exactly what
  `DagFs.merge`'s `resolve` handles, with each `DagFs.Tree` standing for **one branch** (one root).
- **Content is global / branch-independent** (a content node is addressed by its hash regardless of branch),
  so identical content across branches is already one node — merge dedups it for free; only the *path→content*
  binding is branch-scoped and can collide.

This unifies the whole stack: a **branch = a Merkle root = a COW version = an Evolution experiment-timeline**
(`2026-06-07-evolution-...`); merging branches = `DagFs.merge` (content union + per-branch-path resolve);
"fork from prod" / canary / parallel experiments are all *branches* (roots) of the same content-addressed
DAG. `CasStore` swaps a *row's* content address; a *branch* swaps the *whole tree's* root — same CAS idea at
two granularities.

## Merge is ANCESTRY-FREE — works across independent repos, not just branches (Aaron, 2026-06-07)

> Aaron: *"so you can merge two independent streams / git repos AND within a branch on the same git repo."*

Yes — at **both scopes**, with the **same `DagFs.merge`**, because content addresses are **global and
history-independent**:

- **Within one repo** — merge two branches (two roots sharing history).
- **Across independent repos / streams** — merge two roots with **no common ancestor** at all.

Both work identically: a content node's hash is the same regardless of which repo/stream produced it, so the
content union dedups across *strangers* (identical content in two never-connected repos collapses to one
node), and only the path→content bindings resolve.

**This is a property git itself does NOT have.** Git's merge is a **3-way merge requiring a common ancestor
(merge-base)**; you cannot cleanly merge two repos with unrelated histories. Content-addressed merge needs
**no merge-base** — *any* two trees merge (content union + per-branch-path resolve). Two strangers'
filesystems merge as easily as two branches of one. This is the same reason **CRDT merge** needs no
coordination/ancestry (commutative + content-addressed) and why **DBSP** can merge two independent event
streams by Z-set union — and it's the substrate for the **geo-replicated / anygit edge-replica** vision
(independent edge replicas reconcile without a shared origin). "git-compatible but better": merge is
ancestry-free.

## The merge WIRE PROTOCOL — request = your fs metadata, response = streamed missing content (Aaron, 2026-06-07)

> Aaron: *"the merge request could be your fs metadata, and their response is a streaming response of missing
> content."*

The network form of the ancestry-free merge, and content-addressing makes it trivial:

```
1. requester → responder:  fs METADATA  (the manifest: path→hash links + the set/closure of content hashes
                                          I have, or my root + a reachable-set summary). Compact — HASHES, not content.
2. responder:              set-diff against its own store → the nodes the requester LACKS
3. responder → requester:  a STREAM of just the missing content nodes (pipelined, seekable — Jumprope)
4. requester:              content-union the received nodes + resolve path collisions → the merged branch
```

"What's missing" is a **set-difference of content hashes** — no 3-way diff, no merge-base, no ancestor
(per the ancestry-free property above). You transfer **only the content the other side doesn't already
have** (deduped by hash globally), so syncing two large filesystems moves minimal bytes. The manifest can
itself be a content-addressed object (a `DagFs` tree / a hash list / a reachability summary), so the request
is "here's my root + what I can reach," and the response streams the closure of the missing nodes.

This is the standard CAS-sync shape, which we adopt rather than reinvent: **rsync** (rolling-hash have-list →
deltas), **git smart protocol** (want/have negotiation → packfile stream), **IPFS Bitswap** (want-list →
blocks), **Dat/hypercore**, **BitTorrent** (have-bitfield → pieces). Transport rides the bus / CloudEvents
envelope; for big blobs the streamed nodes are **Jumprope** chunks (seekable, resumable). It's also the
sync mechanism for the **geo-replicated / anygit edge-replica** vision and the cross-cell AP reconcile.

## Merging two ZetaFS + folder name-uniqueness (Aaron, 2026-06-07)

> Aaron: *"since we have content-based addressing, if we have two single-file ZetaFS we can easily merge
> them — folders are basically just labels and the content is the real address."* … *"well not exactly
> labels — you have to support filename uniqueness within the folder, that's why we have the closure table;
> but you found some other data structures that might fit better."*

**Merge is nearly free at the content layer.** Content-addressing makes merging two filesystems an
**unconditional, conflict-free union of content nodes** (identical content ⇒ identical hash ⇒ one node;
auto-dedup). The only real conflict is at the **path/name layer**. **LANDED:** `ContentStore.merge`
(content union) + `DagFs.merge resolve a b` (content union + path resolution); the path layer's only
conflict is **same path → different content**, handed to `resolve`. Tested incl. the edge case Aaron named:
**same folder + filename, different content hashes → the resolver fires** (commutative resolver ⇒
path-convergent both merge directions).

**But folders are NOT just labels — filename-uniqueness-within-a-folder is a structural constraint.** A flat
path→hash map enforces it *implicitly* (a full path `folder/name` is a unique key), which is what
`DagFs.merge` uses today. The **richer model** is folders as a **per-folder name→entry map** (names unique
per folder) + the **closure table** (`Hierarchy.fs`) for ancestry/DAG. The data-structure candidates from
the forwarded vids fit the per-folder name-map better than a flat map: **HAMT** (general name keys),
**Patricia** (compact name prefixes), **Hitchhiker tree** (sorted folder listings / range scans), with the
**closure table** for the multi-parent DAG ancestry. Merge then becomes: content-union (free) + per-folder
**name-map merge** (a name collision in a folder = the conflict, resolved like an LWW/OR-map). Backlogged as
the folder-structured upgrade.

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
