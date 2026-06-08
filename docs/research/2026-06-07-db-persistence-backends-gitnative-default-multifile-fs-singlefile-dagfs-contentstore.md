# `db` persistence is pluggable — git-native default, multi-file on a filesystem, single-file on DagFs/ContentStore

**Aaron, 2026-06-07** (refining #6994 "db saves git-native"):

> "it's not only git-native — it's git-native by default, but also supports multi-file on top of an
> existing filesystem, and single-file sitting on top of our DagFs or ContentStore"

So #6994's "db = git-native" was one backend, not the whole story. **The `db` semantics (DU stream +
fold + idempotent CRDT merge) are backend-invariant; the persistence substrate is pluggable** across
(at least) three shapes:

## The three backends (one db semantics, three substrates)

| Backend | Shape | Substrate | When |
|---|---|---|---|
| **git-native** *(default)* | commits = DU events; state = fold over commits | git object store | distribution, history, merge, the **control plane** (#6994), collaboration |
| **multi-file** | many files (tiny, **per-dep**) | an **existing filesystem** | no git required; composable "each dependency declares its own dependencies"; "infinite assembly over time" |
| **single-file** | one file (an "infinite `.fs`/`.ace`/`.zeta` file") | our **DagFs / ContentStore** (CAS, BLAKE3) | self-contained, content-addressed, dedup; zeta-native all the way down |

The DU codec (`DeltaCodec`, text, no-binary-in-proof-lineage), the fold, and the convergent CRDT merge
do **not** change between rows — only *where the bytes land*. That's the point: **swap the substrate,
keep the proofs.**

## This resolves the single-file ⟷ multi-file duality from the stream

Earlier Aaron framed two pictures that seemed in tension:

- **single-file** — *"Zeta is one infinite `.ace`/`.zeta` file like an infinite `.fs` file."*
- **multi-file** — *"you can write it in multiple files so each dependency declares its own dependencies …
  tiny files … per dep … instead of one infinite file it's an infinite assembly over time."*

They aren't rivals — **they are two `db` backends.** single-file = the DagFs/ContentStore backend (the
whole graph as one content-addressed object); multi-file = the filesystem backend (tiny per-dep files
assembled over time). git-native is a third (the distributed/control-plane backend). The choice is a
*storage* decision, not a *semantics* one — pick by criteria (distribution? dedup? no-git-dep?), the way
optimal-package-manager resolution picks by security/freshness/stability (the SoftValue/Pareto cut).

## Why this is clean (the disciplines it satisfies)

- **Scale-free (#1):** same db works on one file, many files, or a distributed git repo — no special
  cases, just a backend.
- **DV2.0 (#8):** partition by substrate/change-rate — git (control plane, slow), filesystem (working
  set), DagFs/CAS (content-addressed durable hub). The backend *is* a hub/satellite choice.
- **DST (#7) / idempotency (#6):** the fold + idempotent merge replay identically on any backend, so a
  DST run on the single-file backend proves the git-native one (same DU stream).
- **Content-addressing:** DagFs/ContentStore make the single-file backend dedup-and-verify by
  construction; git's object store does the same for the git-native backend. Both Merkle-DAG underneath.

## Honest scope (peel)

- **Substrates exist; the unifying `db` backend interface is the named work.** `DagFs.fs`,
  `ContentStore.fs`, `CasStore.fs`, `FileSync.fs`, `DiskDeltaLog.fs`, `SnapshotStore.fs` are all present.
  What's *named* here is: a single `db` noun-class with a **pluggable backend** (git-native | multi-file
  | single-file-on-DagFs/ContentStore), backend-invariant DU semantics. Not yet a unified backend trait
  wired across all three.
- **git-native stays the default** — the others are opt-in by criteria.
- No claim that backend selection/auto-resolution is built; that's the same "resolve optimal source by
  criteria" work as the package-manager-per-OS resolution.

## Anchors (Beacon)

- **Pluggable storage engines** — SQLite VFS, MySQL storage engines, Kafka log-vs-compacted — same
  semantics, swappable substrate (prior art for backend-invariant semantics).
- **Content-addressed stores / Merkle DAG** — git object store, IPFS, Dolt/Irmin, our DagFs/ContentStore
  (BLAKE3).
- **Event sourcing** (Fowler/Young) — the DU-stream-and-fold that is invariant across backends.
- Internal: #6994 (git-native db / control plane), #6993 (specificity gradient + composition), the
  single-file/multi-file stream framing, manifesto §1 scale-free / §7 DST / §8 DV2.0, idempotency #6,
  `DagFs.fs` · `ContentStore.fs` · `CasStore.fs` · `DeltaCodec.fs` · `SnapshotStore.fs`.
