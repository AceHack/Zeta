namespace Zeta.Core

open System.Threading
open System.Threading.Tasks


/// A durable pointer to a snapshot: the backing-store handle plus the delta-log
/// sequence number the snapshot covers. In a real deployment this small pair
/// lives in the manifest (a git ref / a tiny durable record); recovery needs
/// only this + the log to rebuild. (It is itself the "manifest" of §3.)
type SnapshotPointer = { Handle: obj; Seq: int64 }


/// **RecoverableSpine** — increment 2 of the durability subsystem: ties an input
/// `IDeltaLog` together with cadenced snapshots (via `IAsyncBackingStore`) and a
/// restore→replay recovery path. Embodies "persist inputs + snapshots, recompute
/// derived": the live state is the fold of committed input deltas; a snapshot is
/// the consolidated fold persisted at a known sequence; recovery loads the latest
/// snapshot and replays the log tail past it.
///
/// v1 keeps the folded state as a single accumulated `ZSet` (snapshot = one
/// consolidated Z-set). A later increment can make the snapshot the levels of a
/// `BackedSpineAsync` and add snapshot cadence + log GC. Single-writer per shard
/// (matches the writer-actor model), so no internal locking.
[<Sealed>]
type RecoverableSpine<'K when 'K : comparison>
    (log: IDeltaLog<'K>, store: IAsyncBackingStore<'K>, initialState: ZSet<'K>, initialSeq: int64) =

    let mutable state = initialState
    let mutable appliedSeq = initialSeq

    /// The current folded state (the "consolidated" view).
    member _.Consolidate() : ZSet<'K> = state
    /// Highest delta-log sequence folded into the current state.
    member _.AppliedSeq : int64 = appliedSeq
    member _.Log = log
    member _.Store = store

    /// Commit one input delta: append it to the durable log, then fold it into
    /// the live state. Returns the assigned sequence number.
    member _.CommitAsync
        (delta: ZSet<'K>, ?captured: Map<string, string>, ?cancellationToken: CancellationToken)
        : Task<int64> =
        let cap = defaultArg captured Map.empty
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! seq = log.AppendAsync(delta, cap, ct)
            state <- ZSet.add state delta
            appliedSeq <- seq
            return seq
        }

    /// Persist the current consolidated state as a snapshot; returns a pointer
    /// (handle + covered sequence) sufficient to recover from.
    member _.SnapshotAsync(?cancellationToken: CancellationToken) : Task<SnapshotPointer> =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! handle = store.SaveAsync(0, state, ct)
            return { Handle = handle; Seq = appliedSeq }
        }

    /// Recover a spine from durable state: restore the latest snapshot (if any)
    /// then replay the log tail past it through the deterministic fold. This is
    /// the crash-recovery path — build a fresh spine from (log, store, pointer).
    static member RecoverAsync
        (log: IDeltaLog<'K>, store: IAsyncBackingStore<'K>,
         ?pointer: SnapshotPointer, ?cancellationToken: CancellationToken)
        : Task<RecoverableSpine<'K>> =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! baseState, baseSeq =
                match pointer with
                | Some p ->
                    task {
                        let! s = store.LoadAsync(p.Handle, ct)
                        return s, p.Seq
                    }
                | None -> Task.FromResult((ZSet<'K>.Empty, 0L))
            let spine = RecoverableSpine<'K>(log, store, baseState, baseSeq)
            let! tail = log.ReplayAsync(baseSeq, ct)
            for e in tail do
                spine.ApplyReplayed(e.Delta, e.Seq)
            return spine
        }

    /// Fold a replayed delta into the state during recovery (internal — the
    /// commit path is `CommitAsync`, which also writes the log).
    member internal _.ApplyReplayed(delta: ZSet<'K>, seq: int64) : unit =
        state <- ZSet.add state delta
        appliedSeq <- seq


[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module RecoverableSpine =

    /// Start a fresh, empty recoverable spine over the given log + snapshot store.
    let create (log: IDeltaLog<'K>) (store: IAsyncBackingStore<'K>) : RecoverableSpine<'K> =
        RecoverableSpine<'K>(log, store, ZSet<'K>.Empty, 0L)
