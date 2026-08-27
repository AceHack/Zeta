# ZetaFS dual fold — git replacement is +1 `I` and −1 generator-reinterpret

*2026-08-26. Operational status: research-grade absorb of a current-state
plan; live pointers [`docs/ROADMAP.md`](../ROADMAP.md) item 1 and
[`docs/trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md).
GOVERNANCE.md §33.*

Aaron 2026-08-26, speaking of fold: look at the DBSP Z-sets — dual
**forward-in-time +1 folds** and **−1 folds running backwards** based on
**generator-function updates that reinterpret the past**. That is the
foundation of ZetaDB/FS once we fully replace git, including LibGit2,
with our own storage formats. It ties to `DagFs` and Merkle trees.

## What this is (checked, not invented this afternoon)

| Fold | Operator | In-tree |
|---|---|---|
| Forward +1 | DBSP `I` (integrate) | `Primitive.IntegrateZSet`; `ZetaFsDualFold.foldForward` |
| Delay | `z⁻¹` | `Primitive.DelayZSet` |
| Differentiate | `D` | `Primitive.DifferentiateZSet` |
| Backward-looking −1 | generator re-reads immutable `H`; emit `−gen(before)+gen(after)` as a **new** entry | `FourCornerTrace.delta`; `ZetaFsDualFold.reinterpret` |
| Snapshot | Merkle root of the **net** Z-set | `ZSetMerkle.root`; `ZetaFsDualFold.snapshot` |
| Tree | content-addressed multi-parent DAG | `DagFs` (`editLocal` default, `editEverywhere` shared) |
| Log | `IDeltaLog` over loose objects + refs | `ZetaFsDeltaLog` (own format); `GitDeltaLog` (LibGit2Sharp **v1**) |

`+1` then `−1` annihilates in the group (`a + (−a) = 0`). The Merkle
root is a pure function of that net, so a retracted emission is a no-op
on the snapshot. That is why the filesystem can be a Z-set.

## Pseudo-retrocausality (honesty)

The −1 fold does **not** edit the recorded event. A generator-function
update changes the *reading* of retained history; the log stays
append-only. Aaron: *"retrocausality is only on beliefs, not facts."*
The generator is not itself an event in the log — it is not located in
the timeline it reinterprets. Same shape as
[`docs/VISION.md`](../VISION.md) §"Echolocation over time" (the fold is
a ping and a return) and
[`docs/research/2026-08-20-what-counts-as-a-measurement-kastner-transactional-and-our-uncertainty-ledger.md`](2026-08-20-what-counts-as-a-measurement-kastner-transactional-and-our-uncertainty-ledger.md)
§8.

This is also `.claude/rules/local-time-never-enters-the-shared-fold.md`:
the fold sees agreed phase and evidence, never a node's wall clock.

## What git was standing in for

| git | ZetaFS |
|---|---|
| blob | `ContentStore` object (`MerkleHash`) |
| tree | `DagFs` path → hash (`editLocal` = fork, `editEverywhere` = shared edit) |
| commit | `IDeltaLog` append; seq is logical order |
| revert | `ZetaFsDualFold.retract` as a later +1 of the inverse |
| rebase / amend (reinterpret history) | generator update; **new** delta, history bytes unchanged |
| HEAD | `foldForward` / `I` of the log |
| SHA | `ZSetMerkle.root` of the net view |

LibGit2Sharp `GitDeltaLog` already documents itself as the first
adapter behind a port we own. The destination is `ZetaFsDeltaLog` +
this algebra, not a forever git packfile.

## Open (do not round up)

1. **Parent edge.** ✅ `ZetaFsDeltaLog.TruncateAsync` writes a commit with
   the old tip as parent. Read surface still Erasing; DAG walk Reversible.
   Same split as `GitDeltaLog`.
2. **BLAKE3 default** for the tamper-evident store (injected today;
   XxHash128 is the default digest).
3. **Factory path** still execs `git`/`gh`. Item 1 done-test is zero
   git CLI **and** zero LibGit2Sharp.

Workitem `081M108RYNT087G0R001JSRNZE`. Module `src/Core/ZetaFsDualFold.fs`.

## Anchors

- Budiu et al., *DBSP* (VLDB 2023) — `I`, `D`, `z⁻¹`, Distinct/`H`
- Merkle, *A digital signature based on a conventional encryption function* (CRYPTO 1987)
- Joyal–Street–Verity 1996 — traced monoidal category (`FourCornerTrace`)
- Bennett 1973 / Landauer 1961 — negation is free; consolidation is the erasure
