---
id: 081M108RYNT087G0R001JSRNZE
type: task
state: in-progress
priority: P1
slug: zetafs-dual-fold-git-replacement-1-i-and-1-generator-reinter
title: "ZetaFS dual-fold git replacement: +1 I and -1 generator-reinterpret over DagFs Merkle"
created: 2026-08-27T00:09:03.418Z
depends_on: []
composes_with:
  - 081M100RB97087G0R0008EAAY7
  - 081M100RH3Q087G0R0018X4RSJ
---

# ZetaFS dual-fold git replacement: +1 I and −1 generator-reinterpret over DagFs Merkle

Aaron 2026-08-26: DBSP Z-sets run **dual folds** — forward in time `+1` (`I`) and
`−1` folds driven by **generator-function updates that reinterpret the past**.
That algebra is the foundation of ZetaDB/FS once we fully replace git,
including LibGit2Sharp, with our own storage (`DagFs` + Merkle trees).

This is ROADMAP item 1 (NO GIT CLI) stated as an algebra, not as "keep wrapping
git forever."

## Already shipped (do not rebuild)

| Piece | Role |
|---|---|
| `ZSet` `+` / `~-` | abelian group; `+1` emit, `−1` retract |
| `Primitive` `IntegrateZSet` / `DifferentiateZSet` / `DelayZSet` | DBSP `I` / `D` / `z⁻¹` |
| `FourCornerTrace` | generator re-reads immutable `H`; delta = `−gen(before)+gen(after)` |
| `ZSetMerkle` | Merkle root of the **net** Z-set (retraction is a no-op on the root) |
| `ContentStore` / `DagFs` | blobs + multi-parent trees; `editLocal` vs `editEverywhere` |
| `ZetaFsDeltaLog` | `IDeltaLog` over loose objects + refs, **no libgit2** |
| `GitDeltaLog` | hexagonal v1 adapter; LibGit2Sharp is not the destination |

## This increment

`src/Core/ZetaFsDualFold.fs` names the contract and pins it:

1. `foldForward` / `foldLog` = `I`
2. `retract` = unary minus, appended later
3. `reinterpret` = generator update as a new delta
4. `snapshot` = `ZSetMerkle.root`
5. `applyPresence` = Distinct-shaped DagFs patch (`link`/`unlink`, editLocal default)

## Remaining slices (do not pretend they shipped)

1. **Parent edge on `ZetaFsDeltaLog`.** ✅ Truncate writes a commit with the
   old tip as parent. Read surface (`ReplayAsync`) is still Erasing; the
   DAG walk is Reversible — same split as `GitDeltaLog`.
2. **BLAKE3 as default hasher** for the tamper-evident store (injected today;
   XxHash128 is the default).
3. **Factory path** stops execing `git`/`gh`; Harny sc/fs tools ride this log.
   Closed-tools workitem `081M100RH3Q087G0R0018X4RSJ`.
4. **Phase out LibGit2Sharp** behind `IDeltaLog` / `IRefDeltaLog` once (1)+(3)
   hold. Clone-at-tag still builds (`.claude/rules/clone-at-tag-stays-sufficient.md`).

## Honesty

Pseudo-retrocausality, not time travel. The log is append-only. Retrocausality
is on **beliefs** (the generator's reading), not **facts** (the stored events).
See `docs/VISION.md` §"Echolocation over time" and
`docs/research/2026-08-20-what-counts-as-a-measurement-*` §8.
