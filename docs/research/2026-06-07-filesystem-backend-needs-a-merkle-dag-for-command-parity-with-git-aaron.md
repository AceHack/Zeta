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
