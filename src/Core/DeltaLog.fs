namespace Zeta.Core

open System.Collections.Generic
open System.Threading
open System.Threading.Tasks


/// One entry in the **delta log** — the durable record of a committed input
/// Z-set delta (a "command", VoltDB-style: we log the input, not the derived
/// state) at a logical sequence number, plus any captured non-determinism the
/// producer read (clock/RNG/external) so replay is deterministic (DST §7).
///
/// `Captured` is empty when the producer was pure. Keys are caller-chosen names
/// (e.g. "clock", "seed"); values are the byte-verified-serializable form re-fed
/// on replay. (Stored as string here — v1; the disk-backed log will route this
/// through the byte-verified canonical codec behind the serialization seam.)
type DeltaLogEntry<'K when 'K : comparison> = DeltaLogEntry<'K, ZSet<'K>>
type IDeltaLog<'K when 'K : comparison> = IDeltaLog<'K, ZSet<'K>>


/// Feedback channel for database and ref operations.
type DbFeedback =
    | ReferenceNotFound of refName: string
    | RemoteNotFound of remoteName: string
    | ConnectionFailed of message: string
    | MergeConflict of message: string
    | InvalidOperation of message: string


/// **Ref-aware Delta Log interface — provides first-class DB verbs for ref operations (081KSXN940008QG0R002FWR9B2).**
/// Extends IDeltaLog to support git-ref branching, checking out, resetting, remote syncing, and status queries.
type IRefDeltaLog<'K when 'K : comparison> =
    inherit IDeltaLog<'K>
    /// The currently active branch/ref name.
    abstract member CurrentRef: string
    /// Create a branch at the current tip.
    abstract member Branch: name: string -> Result<unit, DbFeedback>
    /// Switch the working branch/ref.
    abstract member Checkout: refName: string -> Result<unit, DbFeedback>
    /// Reset the active ref to match another ref.
    abstract member Reset: refName: string -> Result<unit, DbFeedback>
    /// Pull remote changes and fast-forward the active ref.
    abstract member Sync: remote: string -> Result<unit, DbFeedback>
    /// Push the active ref to a remote and return the refspec.
    abstract member Push: remote: string -> Result<string, DbFeedback>
    /// Merge/reconcile another branch's deltas into the active ref.
    abstract member Merge: sourceRef: string -> Result<int64, DbFeedback>
    /// Working-tree status: isClean * pending paths.
    abstract member Status: unit -> bool * string[]
    /// List entries/files at the specified ref (or current HEAD if None).
    abstract member Ls: refName: string option -> Result<string[], DbFeedback>


/// In-memory delta log — the reference implementation + the DST/test substrate.
/// Supports ref-level branching, checkout, status, and listing in-memory.
/// Genuinely synchronous (a list under a lock), so returns completed ValueTasks.
[<Sealed>]
type InMemoryDeltaLog<'K when 'K : comparison>() =
    let branches = Dictionary<string, List<DeltaLogEntry<'K>>>()
    let mutable currentRef = "refs/heads/main"
    let gate = obj ()
    let mutable nextSeq = 0L

    let activeList () =
        match branches.TryGetValue currentRef with
        | true, list -> list
        | false, _ ->
            let list = List<DeltaLogEntry<'K>>()
            branches.[currentRef] <- list
            list

    interface IDeltaLog<'K> with
        member _.AppendAsync(delta, captured, _ct) =
            let seq =
                lock gate (fun () ->
                    nextSeq <- nextSeq + 1L
                    let list = activeList ()
                    list.Add(DeltaLogEntry<'K>(nextSeq, delta, captured))
                    nextSeq)
            ValueTask<int64>(seq)

        member _.ReplayAsync(fromSeqExclusive, _ct) =
            let tail =
                lock gate (fun () ->
                    let list = activeList ()
                    [| for e in list do if e.Seq > fromSeqExclusive then yield e |])
            ValueTask<DeltaLogEntry<'K>[]>(tail)

        member _.HighWater =
            lock gate (fun () ->
                let list = activeList ()
                if list.Count = 0 then 0L
                else list.[list.Count - 1].Seq)

        member _.TruncateAsync(throughSeqInclusive, _ct) =
            // Thermodynamic class: ERASING. `RemoveAll` drops the entries and this backend holds
            // no second copy — see `ErasureProfiles` below, and see `GitDeltaLog` for the same
            // interface method with the opposite class.
            lock gate (fun () ->
                let list = activeList ()
                list.RemoveAll(fun e -> e.Seq <= throughSeqInclusive) |> ignore)
            ValueTask.CompletedTask

    /// **The declaration, beside the operation it classifies** (`ErasureClass`).
    ///
    /// This is the destroying half of the pair that makes the whole point: `TruncateAsync` here
    /// and `TruncateAsync` in `GitDeltaLog` are the same interface method reached from the same
    /// call site (`RecoverableSpine.CommitAsync`), and they have opposite thermodynamic classes.
    /// Which one you get is decided by the injected backend — so the class cannot live on
    /// `IDeltaLog`, and any list keyed by operation *name* is unsound by construction.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "InMemoryDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the log's own read surface (ReplayAsync(0) plus HighWater), at a pinned truncation point"
                RecoveryChannel =
                    "none — RemoveAll drops the entries from the only list that holds them, and an \
                     emptied branch reports HighWater 0, so the sequence counter goes with them"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.BoundedModelSweep("truncate-through pinned at 2 (truncate everything); logs of 0-2 deltas over {empty, +a, -a}", 13, 3_700_440L) }

              // The second observation is the one that keeps this pack honest about its own
              // convention. `WSetHeat` sweeps an operation's ARGUMENTS as part of its input — that
              // is how `plus` was found to erase log2(3) bits by forgetting an ordered pair's split
              // point. Applied here, the truncation POINT is an argument, and a backend that does
              // not record it forgets it. That term is present in every backend that does not write
              // the point down, so pinning it (above) is what isolates the interesting question —
              // what happened to the DATA — from the uninteresting one every implementation shares.
              { Representation = "InMemoryDeltaLog"
                Operation = "IDeltaLog.TruncateAsync"
                Observation = "the log's own read surface (ReplayAsync(0) plus HighWater), including the truncation argument"
                RecoveryChannel =
                    "neither the entries nor the truncation point — nothing in the post-state \
                     records which sequence the caller asked to truncate through, so an operation \
                     that is a no-op for the data still discards its own parameter"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.ExhaustiveSweep("logs of 0-2 deltas over {empty, +a, -a} x truncate-through 0..2", 18, 4_169_925L) }

              { Representation = "InMemoryDeltaLog"
                Operation = "IRefDeltaLog.Reset"
                Observation = "the log's own read surface: ReplayAsync(0) on the active branch after Reset"
                RecoveryChannel =
                    "none for the active branch — Clear() discards it before copying the source \
                     branch in; the source branch is untouched, which is why the class is measured \
                     on the active branch and not on the pair"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.ExhaustiveSweep("branch pairs over logs of 0-2 deltas from {empty, +a, -a}", 13, 3_700_440L) } ]

    interface IRefDeltaLog<'K> with
        member _.CurrentRef = lock gate (fun () -> currentRef)
        member _.Branch(name) =
            lock gate (fun () ->
                let src = activeList ()
                let dest = List<DeltaLogEntry<'K>>(src)
                branches.[name] <- dest
                Ok())
        member _.Checkout(refName) =
            lock gate (fun () ->
                currentRef <- refName
                Ok())
        member _.Reset(refName) =
            lock gate (fun () ->
                match branches.TryGetValue refName with
                | true, src ->
                    let list = activeList ()
                    list.Clear()
                    list.AddRange(src)
                    Ok()
                | false, _ -> Error(ReferenceNotFound refName))
        member _.Sync(_remote) =
            Ok()
        member _.Push(_remote) =
            lock gate (fun () ->
                Ok(sprintf "refs/heads/%s" currentRef))
        member _.Merge(sourceRef) =
            lock gate (fun () ->
                match branches.TryGetValue sourceRef with
                | true, src ->
                    let list = activeList ()
                    let existingSeqs = list |> Seq.map (fun e -> e.Seq) |> Set.ofSeq
                    let toAdd = src |> Seq.filter (fun e -> not (existingSeqs.Contains e.Seq))
                    let mutable lastSeq = nextSeq
                    for e in toAdd do
                        nextSeq <- nextSeq + 1L
                        list.Add(DeltaLogEntry<'K>(nextSeq, e.Delta, e.Captured))
                        lastSeq <- nextSeq
                    Ok lastSeq
                | false, _ -> Error(ReferenceNotFound sourceRef))
        member _.Status() =
            // In-memory working ref status: always clean
            true, [||]
        member _.Ls(refName) =
            lock gate (fun () ->
                let target = defaultArg refName currentRef
                match branches.TryGetValue target with
                | true, list ->
                    Ok [| for e in list do yield sprintf "%d" e.Seq |]
                | false, _ -> Error(ReferenceNotFound target))

