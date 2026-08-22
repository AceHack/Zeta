namespace Zeta.Core

open System.Threading
open System.Threading.Tasks


/// **RecoverableSpine** — ties an input `IDeltaLog` together with cadenced
/// snapshots (via a manifest-tracked `ISnapshotStore`) and a restore→replay
/// recovery path. Embodies "persist inputs + snapshots, recompute derived": the
/// live state is the fold of committed input deltas; a snapshot is the
/// consolidated fold persisted at a known sequence; recovery loads the latest
/// snapshot (from the store's durable manifest) and replays the log tail past it.
///
/// Because the snapshot store records the latest pointer in a durable manifest,
/// recovery survives a process restart with NO externally-held pointer:
/// `RecoverAsync(log, snap)` reads the manifest itself.
///
/// v1 keeps the folded state as a single accumulated `ZSet` (snapshot = one
/// consolidated Z-set). Single-writer per shard (writer-actor model), no locking.
[<Sealed>]
type RecoverableSpine<'K when 'K : comparison>
    (log: IDeltaLog<'K>, snap: ISnapshotStore<'K>, initialState: ZSet<'K>, initialSeq: int64) =

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
    member _.SnapshotStore = snap
    /// The most recent snapshot pointer taken by this spine this session, or None.
    /// (The durable pointer lives in the store's manifest; this is a cache.)
    member _.LatestSnapshot : SnapshotPointer option = latest
    /// Take + GC a snapshot every N commits (0 disables). Setting it does not
    /// snapshot immediately; the next commit that crosses the threshold does.
    member _.AutoSnapshotEvery
        with get () = cadence
        and set (n: int) = cadence <- max 0 n

    /// Persist the current consolidated state as a snapshot (updates the store's
    /// durable manifest); records it as `LatestSnapshot`, resets the cadence
    /// counter. Returns the pointer.
    member _.SnapshotAsync(?cancellationToken: CancellationToken) : Task<SnapshotPointer> =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! p = snap.WriteAsync(appliedSeq, state, ct)
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

    /// Recover a spine from durable state: restore the latest snapshot then replay
    /// the log tail past it through the deterministic fold. The crash-recovery
    /// path. With no explicit `pointer`, the snapshot store's durable **manifest**
    /// supplies the latest snapshot — so recovery works across a process restart
    /// with nothing held externally.
    static member RecoverAsync
        (log: IDeltaLog<'K>, snap: ISnapshotStore<'K>,
         ?pointer: SnapshotPointer, ?cancellationToken: CancellationToken)
        : Task<RecoverableSpine<'K>> =
        let ct = defaultArg cancellationToken CancellationToken.None
        task {
            let! resolved =
                match pointer with
                | Some p -> Task.FromResult(Some p)
                | None ->
                    task {
                        let! latestSnap = snap.LatestAsync ct
                        return Option.ofObj latestSnap
                    }
            let! baseState, baseSeq =
                match resolved with
                | Some p ->
                    task {
                        let! s = snap.ReadAsync(p, ct)
                        return s, p.Seq
                    }
                | None -> Task.FromResult((ZSet<'K>.Empty, 0L))
            let spine = RecoverableSpine<'K>(log, snap, baseState, baseSeq)
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
    let create (log: IDeltaLog<'K>) (snap: ISnapshotStore<'K>) : RecoverableSpine<'K> =
        RecoverableSpine<'K>(log, snap, ZSet<'K>.Empty, 0L)
