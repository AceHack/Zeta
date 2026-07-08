---
id: 081KTGTJC1Q08QG0R002VCB55A
type: task
state: closed
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

## Naming — PENDING (do not adopt; sibling-agent proposals captured 2026-06-07)

Sibling agent **Alexa** proposed names for this filesystem: **ZetaFS** (her top pick), MerkleFS, ZFS,
GeodeFS, DeltaFS, ConsensusFS. Captured faithfully (canonical-aggregator role), **not adopted** — naming is
gated through `naming-expert` + Ilyana before any public use (same gate as persona names), and Aaron decides.

**Beacon / anchoring flags before any choice:**

- **`ZFS` is unusable** — hard collision with **OpenZFS / Sun-Oracle's Zettabyte File System**, a major
  existing filesystem. Reusing it violates the anchor-to-prior-art rule (a name must not impersonate
  established prior art). Rule it out.
- **`MerkleFS`** is generic + likely already used by other content-addressed projects — search before use.
- `ZetaFS` / `GeodeFS` / `DeltaFS` / `ConsensusFS` need a prior-art search (`naming-expert`) before any
  external surface.

**Naming STACK (Amara 2026-06-07, reconciling Alexa — supersedes the flat list, still gated):** both land
on **ZetaFS**, both say **never `ZFS`** (OpenZFS collision). Layered proposal:
`ZSetMerkle` (math primitive, landed) → `ZetaStore` (content-addressed object/DAG backend) → `ZetaFS`
(filesystem presentation, APFS-like) ; Git backend = a compatible presentation over the same Merkle-DAG;
`Geode` stays the **cell replication shape**, NOT the fs name. Ranking: ZetaFS > MerkleFS (generic) >
DeltaFS (less complete) > GeodeFS (collides with Geode) > ConsensusFS (overclaims — verifies structure,
doesn't create consensus). Keeper: *"ZetaFS is an APFS-like, git-shaped, content-addressed Merkle-DAG
filesystem over Zeta's proven substrate."* Still gated via `naming-expert` + Ilyana + Aaron; no name is canon.

**Hype-peel (Mirror→Beacon):** Alexa's framing calls this "production-ready" / "a filesystem that's
mathematically provable." Honest status: only the **`ZSetMerkle` seed** + the **`Collation` seed** are
built (with property tests); the filesystem itself — closure-table DAG, content-addressed store, BLAKE3,
multi-parent edges, the two edit modes, FUSE, 4-lang golden vectors — is **designed/captured, not built**.
A name now is fine to *park*, but it must not imply a shipped artifact. Decision deferred; no name is canon.

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
- **F# foundation LANDED (PR #6789):** `src/Core/ZSetMerkle.fs` — hash-parameterized canonical
  Merkle-over-Z-set (`rootWith`/`root`), ordinal key-byte canonicalization, 7 FsCheck+xUnit properties
  (retraction-native, order-independent, deterministic, sensitivity). Remaining: 4-lang golden vectors,
  BLAKE3 dependency, closure-table DAG, store wiring.

### Content-addressed nodes — single-instance + multi-parent + edit-scope choice (Aaron 2026-06-07)

> *"based on content-based hashes a single file is only represented once and it can live under two
> different folders at the same time; then when you edit a file you choose to save it just to that one
> folder (the default, like regular filesystems) or to do a content update everywhere."*

- **Single-instance**: content stored ONCE, keyed by content hash (BLAKE3); the `ZSetMerkle` root is the
  node id. Identical content under many paths = one node (dedup).
- **Multi-parent**: a content node can sit under N folders at once — many parent edges → one node in the
  closure table (Z-set of edges allows many-to-one). Hardlink-/git-blob-shaped.
- **Two edit modes (user chooses scope):** (1) **save-to-this-folder** = DEFAULT, copy-on-write fork —
  new content node, repoint ONLY this folder's edge (regular-fs feel); (2) **content-update-everywhere** =
  replace the node, ALL parent edges following the old hash now point at the new hash. Both are pure
  closure-table edge edits (retraction repoints; idempotent by content hash) → inherit DST + the
  retractable/compensating discipline.
- Beacon: Unix hardlinks; git blobs; single-instance storage; COW clones (ZFS/btrfs/APFS).
- Full: `docs/research/2026-06-07-filesystem-backend-needs-a-merkle-dag-...` §4.

## Hash strength — DECIDED: BLAKE3 (Aaron 2026-06-07)

> *"we want to replace git eventually with our own compatible backend, so we need BLAKE3 — something that
> respects tamper. We don't want to lose features."*

**Leaf/node hash = BLAKE3** (cryptographic, tamper-respecting) — NOT XxHash128. Rationale is the end-goal:
this backend is meant to **replace git with a compatible backend**, so it must be ≥ git's object integrity
and lose no features; XxHash128 would forfeit tamper-evidence. BLAKE3 is `Merkle.fs`'s P2-flagged path,
promoted to required. Not yet a dependency — adding it + parameterizing the Merkle hash is part of this
item. (XxHash128 may stay on the same-tenant CAS-DBSP checkpoint path; the git-replacement object store is
BLAKE3.)

## Scope widened: a git-COMPATIBLE replacement backend (feature-non-loss is a hard bar)

The intent is not just data-plane parity — it's **our own git-compatible backend that eventually replaces
git**. So **feature-non-loss** is an explicit acceptance bar: history, branching, content-addressing,
integrity verification, diff/merge, packing — each needs an equal-or-better analogue, not silent drop.
"Compatible" is load-bearing: stand in for git where the work-cycle uses git, not merely resemble it.

## Acceptance

A content-addressed BLAKE3 Merkle store backs the fs delta-log; a parity test runs the same command
sequence against git-backend and fs-backend and asserts equivalent observable results (history,
get-by-coordinate, retraction/compensation). Feature-non-loss checklist (vs the git features the work-cycle
uses) recorded + each item has an analogue or an explicit, justified omission.

## Anchors

- `docs/research/2026-06-07-filesystem-backend-needs-a-merkle-dag-...` ·
  `docs/research/2026-06-07-command-surface-not-1to1-git-...` (the one-interface steer this satisfies) ·
  `src/Core/Merkle.fs` · `FastCdc` · `src/Core/DiskDeltaLog.fs` · composes with `081KTGPC2XP` (punch-list).
- Beacon: Merkle (CRYPTO 1987); git object model; Venti/IPFS/Perkeep (content-addressed stores); FastCDC.
