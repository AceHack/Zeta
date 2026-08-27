namespace Zeta.Core

open System.Text

/// **ZetaFS dual fold — the git-replacement algebra.**
///
/// After LibGit2Sharp is gone, source control is still a log of Z-set deltas over a
/// content-addressed Merkle DAG (`ContentStore` / `DagFs` / `ZetaFsDeltaLog`). It is
/// not a second copy of git's object format. Two folds, never crossed:
///
///   - **Forward (+1, `I`)** — `foldForward` is DBSP integrate (`Primitive.IntegrateZSet`):
///     the running sum of appended deltas. Materialized HEAD is this view.
///   - **Backward-looking (−1)** — a generator-function update re-reads the SAME
///     retained history under a new interpretation and emits
///     `−gen(before, H) + gen(after, H)` as a **new forward log entry**. The past
///     record is not rewritten. That is the `FourCornerTrace` law, specialised to
///     Z-sets: pseudo-retrocausality, not time travel.
///
/// Merkle roots (`ZSetMerkle`) are a pure function of the **net** Z-set, so `+w`
/// then `−w` is a no-op on the snapshot. `DagFs.editLocal` is the default fork
/// (copy-on-write); `editEverywhere` is the shared-object edit. Parent-linked
/// trees (the missing edge that makes `GitDeltaLog.Truncate` reversible and
/// `ZetaFsDeltaLog.Truncate` erasing) are the next storage-format slice.
///
/// Anchors: Budiu et al. VLDB 2023 (DBSP `I` / `D` / `z⁻¹`); Merkle 1987;
/// Joyal–Street–Verity 1996 (trace); `FourCornerTrace` honesty note in `WSet.fs`.
[<RequireQualifiedAccess>]
module ZetaFsDualFold =

    /// A generator: an interpretation `'I` reads a stored history `'H` and emits a Z-set.
    /// Feedback never edits `'H` — it only ever moves `'I`.
    type Generator<'H, 'I, 'K when 'K: comparison> = 'I -> 'H -> ZSet<'K>

    /// Forward fold: DBSP `I` — running Z-set sum, empty identity. Same combiner as
    /// `Primitive.IntegrateZSet`. Order of equal-seq keys is the Z-set's ordinal merge.
    let foldForward (deltas: ZSet<'K> seq) : ZSet<'K> =
        let mutable acc = ZSet<'K>.Empty
        for d in deltas do
            acc <- ZSet.add acc d
        acc

    /// Fold a delta-log replay (sorted by `Seq`) into the current view.
    let foldLog (entries: DeltaLogEntry<'K> seq) : ZSet<'K> =
        entries
        |> Seq.sortBy (fun e -> e.Seq)
        |> Seq.map (fun e -> e.Delta)
        |> foldForward

    /// The abelian-group inverse: a +1 emission run backwards. Append this as a
    /// later log entry — do not splice it into the past.
    let retract (emitted: ZSet<'K>) : ZSet<'K> = ZSet.neg emitted

    /// Generator-function update: `−gen(before, history) + gen(after, history)`.
    /// History is not mutated. Callers append the result as the next delta.
    /// Rows the reinterpretation did not touch cancel (`w + (−w) = 0`) and drop.
    let reinterpret
        (gen: Generator<'H, 'I, 'K>)
        (history: 'H)
        (before: 'I)
        (after: 'I)
        : ZSet<'K> =
        ZSet.add (ZSet.neg (gen before history)) (gen after history)

    /// Merkle snapshot of the net view. Equal Z-sets ⇒ equal roots, including
    /// after a +1/−1 pair. Pass BLAKE3 at the call site for the tamper-evident store.
    let snapshot (encodeKey: 'K -> byte[]) (view: ZSet<'K>) : MerkleHash =
        ZSetMerkle.root encodeKey view

    let snapshotUtf8 (view: ZSet<string>) : MerkleHash =
        snapshot (fun (s: string) -> Encoding.UTF8.GetBytes s) view

    /// Apply a **presence** delta (Distinct / DBSP `H`): path linked iff net weight
    /// > 0. Positive keys `link` (editLocal-shaped: only this path moves);
    /// negative keys `unlink`. Shared content stays one node until `editEverywhere`.
    /// `contentOf` supplies the blob for a newly-positive path; missing content is
    /// skipped rather than invented.
    let applyPresence
        (contentOf: string -> 'V option)
        (delta: ZSet<string>)
        (tree: DagFs.Tree<'V>)
        : DagFs.Tree<'V> =
        let span = delta.AsSpan()
        let mutable t = tree
        for i in 0 .. span.Length - 1 do
            let path = span.[i].Key
            let w = span.[i].Weight
            if w < 0L then
                t <- DagFs.unlink path t
            elif w > 0L then
                match contentOf path with
                | Some v -> t <- DagFs.link path v t
                | None -> ()
        t
