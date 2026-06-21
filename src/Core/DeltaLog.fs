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


/// **Ref-aware Delta Log interface — provides first-class DB verbs for ref operations (B-0956 / 081KTGPC2XP).**
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
            lock gate (fun () ->
                let list = activeList ()
                list.RemoveAll(fun e -> e.Seq <= throughSeqInclusive) |> ignore)
            ValueTask.CompletedTask

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

