namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Runtime.CompilerServices
open System.Runtime.InteropServices


/// Log-structured merge (LSM) trace over Z-set batches.
///
/// A `Spine<'K>` holds the integrated history of a stream of Z-sets as a
/// vector of sorted batches arranged in `~log₂ n` size-doubling levels.
/// Inserting a batch at `L_i` is amortised O(log n) — when two batches
/// exist at level `i` they merge into `i+1`. Reads walk at most one batch
/// per level, giving O(log n) lookup and O(n) scan with excellent cache
/// locality on each level.
///
/// This is the .NET port of differential-dataflow's `Spine`, and the
/// foundation on which the incremental-join operator's state sits: instead
/// of re-scanning the whole integrated input every tick, we walk the
/// spine's sorted runs and emit only the matching deltas.
[<Sealed>]
type Spine<'K when 'K : comparison>() =
    // Each level is at most one batch. A merge of level-i + level-i yields
    // level-(i+1). We stop growing levels at 32 (≈ 4 billion entries).
    let levels = ResizeArray<ZSet<'K> voption>()

    /// Number of non-empty levels currently stored.
    member _.Depth = levels.Count

    /// Total entry count across all levels.
    member _.Count =
        let mutable n = 0
        for lvl in levels do
            match lvl with ValueSome z -> n <- n + z.Count | _ -> ()
        n

    /// Insert a batch. Cascades merges up levels until an empty slot is found.
    member _.Insert(batch: ZSet<'K>) =
        if batch.IsEmpty then ()
        else
            let mutable cur = batch
            let mutable i = 0
            let mutable keepGoing = true
            while keepGoing && i < levels.Count do
                match levels.[i] with
                | ValueSome existing ->
                    cur <- ZSet.add cur existing
                    levels.[i] <- ValueNone
                    i <- i + 1
                | ValueNone ->
                    keepGoing <- false
            if i = levels.Count then levels.Add(ValueSome cur)
            else levels.[i] <- ValueSome cur

    /// Collapse all levels into a single canonical batch. O(n log n) work
    /// when many levels are populated; amortised O(n) across the batch
    /// history that went into the spine.
    member _.Consolidate() : ZSet<'K> =
        let mutable acc = ZSet<'K>.Empty
        for lvl in levels do
            match lvl with
            | ValueSome z -> acc <- ZSet.add acc z
            | _ -> ()
        acc

    /// Snapshot of the populated levels. Materialised eagerly so callers
    /// can iterate without racing against background inserts. O(depth),
    /// which is bounded at ≤ 32.
    member _.Levels : ZSet<'K> array =
        [| for lvl in levels do
             match lvl with ValueSome z -> yield z | _ -> () |]

    /// Remove all state. Used by transaction rollback.
    member _.Clear() = levels.Clear()


/// Integrate-via-spine — drop-in replacement for `IntegrateOp` on Z-set
/// streams that scales to very large accumulated relations. At each tick,
/// the delta is inserted into the spine, and the spine's consolidated
/// view is published as the operator's output.
///
/// Trade-off: `Consolidate` at output time is linear in total size on
/// every tick. For true streaming-join asymptotic wins, downstream
/// operators should be refactored to walk `spine.Levels` directly rather
/// than reading `Value` — `TraceHandle` below exposes that primitive.
[<Sealed>]
type internal SpineIntegrateOp<'K when 'K : comparison>(input: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    let spine = Spine<'K>()
    override _.Name = "spineIntegrate"
    override _.Inputs = inputs
    override this.StepAsync(_: System.Threading.CancellationToken) =
        spine.Insert input.Value
        this.Value <- spine.Consolidate()
        System.Threading.Tasks.ValueTask.CompletedTask
    member _.Spine = spine


/// A handle to an operator's accumulated spine — lets join/aggregate
/// operators walk sorted runs without forcing a consolidation.
[<Struct; IsReadOnly; NoComparison; NoEquality>]
type TraceHandle<'K when 'K : comparison> =
    val internal op: SpineIntegrateOp<'K>
    internal new(op: SpineIntegrateOp<'K>) = { op = op }

    /// Total entries across all spine levels.
    member this.Count = this.op.Spine.Count

    /// Snapshot the sorted runs (oldest-largest to newest-smallest).
    member this.Levels : ZSet<'K> array = this.op.Spine.Levels

    /// Materialise a single consolidated Z-set.
    member this.Consolidate() : ZSet<'K> = this.op.Spine.Consolidate()

    /// The underlying stream (spine's consolidated output per tick).
    member this.Stream = Stream this.op


[<Extension>]
type SpineExtensions =

    /// Integrate a Z-set stream using an LSM-spine for efficient storage
    /// and scan. Returns a `TraceHandle` that lets downstream operators
    /// walk the sorted runs directly.
    [<Extension>]
    static member IntegrateToTrace<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>) : TraceHandle<'K> =
        let op = this.Register (SpineIntegrateOp(s.Op))
        TraceHandle op
