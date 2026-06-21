# Our filesystem IS git (APFS-like, with Merkle history + content-addressed dedup); and: greenfield → change the public API when it's right (Aaron, 2026-06-07)

Two steers. The first collapses the fs backend and the git backend into one shape; the second is a standing
operating principle. Faithful capture; Beacon-anchored.

## 1. The filesystem is git-shaped — a Merkle tree for the FS, not only the git impl

> Aaron: *"basically our filesystem can be just git. We are an APFS-like filesystem with history and
> deduplication like git's content-based addressing, and we can have the same file in multiple folders — so
> we end up with a Merkle tree for our fs as well, not just our git implementation. So our closure-table fs
> might need some updates; we have some backlogged perf enhancements too for this."*

The fs backend and the git backend are **the same construction**: a content-addressed Merkle DAG. Stated as
properties our filesystem has:

- **APFS-like** — a modern copy-on-write filesystem (snapshots, clones, space-sharing) as the surface feel.
- **History** — like git: every state is a node in a Merkle DAG; the log is the commit-equivalent chain.
- **Content-addressed dedup** — like git blobs: a file is stored once by its content hash (BLAKE3);
  identical content anywhere is one node (single-instance).
- **Same file in multiple folders** — multi-parent edges in the closure table (hardlink-/git-blob-shaped),
  with the COW-local-vs-propagate edit choice (`...filesystem-backend-needs-a-merkle-dag-...` §4).
- **⇒ a Merkle tree for the FS too** — not just the git implementation. The fs *is* git-as-a-filesystem;
  one Merkle-DAG construction, two presentations (a repo, a mounted fs).

**Consequence flagged by Aaron:** the **closure-table fs may need updates** to carry this (content-hash
node ids, multi-parent edges, the two edit modes). There are **backlogged perf enhancements** for the
closure-table fs already — **081KSV2WD0008QG0R00030G6S9** (fs DSL as an F# computation expression + FUSE backend; *benchmark vs
closure-table*; DST at millions-of-nodes on one machine) over `src/Core/Hierarchy.fs`. Fold the
content-hash / multi-parent / Merkle-root requirements into that line of work and into `081KTGTJC1Q` (the
content-addressed Merkle-DAG backend) — they are now clearly the same target.

This also confirms the convergence already captured: "git is a Merkle DAG = half a blockchain"
(`2026-06-07-identity-proof-tiers-*`) — the fs is the other presentation of that same DAG, so the
git-compatible-replacement backend (`081KTGTJC1Q`, BLAKE3) and the APFS-like fs are **one build**.

## 2. Greenfield — change the public API when it's right

> Aaron: *"we are greenfield; we should always feel free to change our public API when it's right."*

A standing operating principle: we have **no external consumers we are bound to yet**, so a *better* public
surface is worth a breaking change — do not contort a design to preserve API stability that protects no
one. This directly **relaxes the churn caveat on 081KT07NV0008QG0R001YDB73K strategy (a)** (explicit comparer-is-part-of-
identity): the public-API change is *acceptable* because it's the right shape, not a cost to route around.
`public-api-designer` (Ilyana) still reviews for *quality* of the new surface — but "it breaks the existing
API" is, by itself, **not** a blocker while greenfield. (The discipline that does still apply: when the API
*does* later stabilize for real consumers, the calculus flips — every public member becomes a contract.
Greenfield is the window, not a forever-license.)

## Ties

- `081KTGTJC1Q` (content-addressed Merkle-DAG backend) · `081KSV2WD0008QG0R00030G6S9` (closure-table fs FUSE/benchmark, perf
  enhancements) · `src/Core/Hierarchy.fs` (closure table) · `src/Core/ZSetMerkle.fs` (the Merkle-over-Z-set
  root, landed #6789) · `2026-06-07-filesystem-backend-needs-a-merkle-dag-...` (§4 content-hash/multi-parent)
  · `2026-06-07-command-surface-not-1to1-git-...` (one interface over git+fs) · 081KT07NV0008QG0R001YDB73K (greenfield relaxes
  the comparer-strategy churn).

## Beacon anchors

- **APFS** (Apple, 2017) — copy-on-write fs: snapshots, clones, space-sharing. · **git object model**
  (Torvalds, 2005) — content-addressed Merkle DAG (blob/tree/commit). · **Content-addressed / single-
  instance**: git blobs, Unix hardlinks, Venti (Plan 9), IPFS, dedup fs (ZFS/btrfs). · **Greenfield API
  freedom**: SemVer's pre-1.0 contract (0.x may break) — the standard name for "no stability promise yet."
  Honest novelty: not a new fs nor new content-addressing, but **one Merkle-DAG construction presented as
  both a git-compatible repo and an APFS-like filesystem**, over the Z-set closure table.
