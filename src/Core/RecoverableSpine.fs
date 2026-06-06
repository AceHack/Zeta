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
    // Snapshot cadence: take a snapshot (and GC the log through it) every N
    // commits. 0 = disabled (manual snapshots only).
    let mutable cadence = 0
    let mutable commitsSinceSnapshot = 0
    let mutable latest : SnapshotPointer option = None

    /// The current folded state (the "consolidated" view).
    member _.Consolidate() : ZSet<'K> = state
    /// Highest delta-log sequence folded into the current state.
    member _.AppliedSeq : int64 = appliedSeq
    member _.Log = log
    member _.Store = store
    /// The most recent snapshot pointer taken by this spine (manual or cadenced),
    /// or None. This is the durable recovery pointer (lives in the manifest).
    member _.LatestSnapshot : SnapshotPointer option = latest
    /// Take + GC a snapshot every N commits (0 disables). Setting it does not
    /// snapshot immediately; the next commit that crosses the threshold does.
    member _.AutoSnapshotEvery
        with get () = cadence
        and set (n: int) = cadence <- max 0 n

    /// Persist the current consolidated state as a snapshot; records it as
    /// `LatestSnapshot` and resets the cadence counter. Returns the pointer.
    member _.SnapshotAsync(?cancellationToken: CancellationToken) : Task<SnapshotPointer> =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! handle = store.SaveAsync(0, state, ct)
            let p = { Handle = handle; Seq = appliedSeq }
            latest <- Some p
            commitsSinceSnapshot <- 0
            return p
        }

    /// Commit one input delta: append it to the durable log, then fold it into
    /// the live state. If cadence is set and the threshold is crossed, take a
    /// snapshot and GC the log through it. Returns the assigned sequence number.
    member this.CommitAsync
        (delta: ZSet<'K>, ?captured: Map<string, string>, ?cancellationToken: CancellationToken)
        : Task<int64> =
        let cap = defaultArg captured Map.empty
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! seq = log.AppendAsync(delta, cap, ct)
            state <- ZSet.add state delta
            appliedSeq <- seq
            commitsSinceSnapshot <- commitsSinceSnapshot + 1
            if cadence > 0 && commitsSinceSnapshot >= cadence then
                let! p = this.SnapshotAsync(ct)        // sets latest, resets counter
                do! log.TruncateAsync(p.Seq, ct)       // GC the absorbed tail
            return seq
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
