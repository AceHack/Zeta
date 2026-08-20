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
    // The erasure CHARGE, not merely the classification. `ErasureProfiles` below says what this
    // spine destroys; this is what it has destroyed so far, posted per invocation and keyed by the
    // declared observation so figures measured against different observers are never summed.
    // Immutable value, replaced on each post — nothing ambient, nothing captured (§13, §3).
    let mutable erasure = ErasureCharge.Account.Empty

    /// The truncation rows inherited from the injected backend. Computed once: `log` is fixed for
    /// the life of the spine, so its declared class cannot change under us.
    let inheritedTruncationProfiles : ErasureClass.Profile list =
        match box log with
        | :? IErasureDeclaring as declaring ->
            declaring.ErasureProfiles
            |> List.filter (fun p ->
                p.Operation.EndsWith("TruncateAsync", System.StringComparison.Ordinal)
                // A backend may also declare a row measured over the truncation ARGUMENT. That
                // row does not transfer: the composite supplies the argument itself (the
                // snapshot's sequence number), so it is not an input to `CommitAsync` and its
                // fibre is not the composite's to inherit.
                && not (p.Observation.Contains("including the truncation argument", System.StringComparison.Ordinal)))
            |> List.map (fun p ->
                { p with
                    Representation = "RecoverableSpine over " + p.Representation
                    Operation = "CommitAsync (snapshot-triggered log truncation)"
                    RecoveryChannel = "inherited from the injected backend: " + p.RecoveryChannel })
        | _ ->
            [ { Representation = "RecoverableSpine over an undeclared IDeltaLog"
                Operation = "CommitAsync (snapshot-triggered log truncation)"
                Observation = "the log's own read surface: ReplayAsync(0) plus HighWater"
                RecoveryChannel =
                    "unknown — the injected backend does not implement IErasureDeclaring, so \
                     nothing here can say whether the truncated tail survives"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "the injected IDeltaLog declares no erasure profile; the composite inherits the hole rather than inventing a zero" } ]

    /// The fold's own row. Separate from the truncation rows because it fires on a different
    /// cadence — every commit, not every snapshot — and against a different observation.
    let foldProfile : ErasureClass.Profile =
        { Representation = "RecoverableSpine"
          Operation = "CommitAsync / ApplyReplayed (the fold: ZSet.add into state)"
          Observation = "the folded state returned by Consolidate()"
          RecoveryChannel =
            "none from the state alone — ZSet.add consolidates, so a delta and its retraction \
             annihilate and the result is byte-identical to never having applied either. The \
             deltas are recoverable only from the LOG, which is a different representation \
             with its own row above"
          Classification = ErasureClass.ThermodynamicClass.Erasing
          Evidence = ErasureClass.Evidence.ExhaustiveSweep("commit sequences of 0-2 deltas over {empty, +a, -a}", 5, 2_321_928L) }


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
            // The fold itself erases: `ZSet.add` consolidates, so a delta and its retraction
            // annihilate. Charged on EVERY commit, which is the §11a headline — the bits are in
            // the ordinary arithmetic, not at the GC boundary.
            erasure <- erasure.Post foldProfile
            commitsSinceSnapshot <- commitsSinceSnapshot + 1
            if cadence > 0 && commitsSinceSnapshot >= cadence then
                let! p = this.SnapshotAsync(ct)        // sets latest, resets counter
                // The one snapshot-supersedes-log site in the repo. Its thermodynamic class is
                // NOT a property of this line: `log` is injected, and `TruncateAsync` is Erasing
                // under `InMemoryDeltaLog`, Reversible under `GitDeltaLog`, and
                // Reversible-because-unimplemented under `GroupCommitDiskDeltaLog`. This code path
                // is byte-identical in all three cases. See `ErasureProfiles` below, which reads
                // the class off the injected backend rather than asserting one.
                do! log.TruncateAsync(p.Seq, ct)       // GC the absorbed tail
                // …and charge it, at the class the injected backend declares. Over
                // `InMemoryDeltaLog` this posts 3.700 bits; over `GroupCommitDiskDeltaLog` it
                // posts a measured zero; over a backend that declares nothing it posts a HOLE,
                // which turns the reading into a `LowerBound` naming the hole. Never a silent 0.
                erasure <- erasure.PostAll inheritedTruncationProfiles
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
        // Same fold, same erasure. Recovery replaying N deltas costs what committing them cost;
        // charging only the commit path would make crash recovery look thermodynamically free.
        erasure <- erasure.Post foldProfile

    /// **What this spine has actually destroyed so far**, posted per invocation and settled per
    /// observation. `ErasureProfiles` is the diagnosis; this is the bill.
    ///
    /// Read it as `Readings` (one per observation) or `IncompleteObservations` (the holes). There
    /// is no accessor that returns a single number, because over an undeclared backend part of the
    /// cost is genuinely unknown and a single number could not say so.
    member _.ErasureAccount: ErasureCharge.Account = erasure

    /// **The declaration — and the interesting one, because it is DERIVED rather than asserted.**
    ///
    /// A composite has no thermodynamic class of its own. `CommitAsync`'s truncation is whatever
    /// the injected `IDeltaLog` makes it, so this member *reads* the backend's declaration instead
    /// of restating one. Three consequences worth the design:
    ///
    /// 1. **The same spine measures differently under different backends**, which is the fact that
    ///    killed the name-keyed list. The law pack runs this exact type over `InMemoryDeltaLog`
    ///    and over `GitDeltaLog` and gets opposite classes from identical code.
    /// 2. **An undeclared backend makes the spine `Unmeasured`, never free.** A third-party
    ///    `IDeltaLog` that does not implement `IErasureDeclaring` produces a row saying so — a
    ///    visible hole rather than a silent zero. This is the drift guard at runtime, where a
    ///    reflection test cannot reach a caller-supplied type.
    /// 3. **The fold is declared separately and is erasing on its own.** `ZSet.add` consolidates,
    ///    so a `+1` followed by a `-1` leaves nothing — indistinguishable from never-present. That
    ///    erasure is in the ordinary arithmetic of the fold, not at the GC boundary, and it fires
    ///    on every commit rather than once per snapshot cadence.
    /// **The declaration — and the interesting one, because it is DERIVED rather than asserted.**
    ///
    /// A composite has no thermodynamic class of its own. `CommitAsync`'s truncation is whatever
    /// the injected `IDeltaLog` makes it, so this member *reads* the backend's declaration instead
    /// of restating one. Three consequences worth the design:
    ///
    /// 1. **The same spine measures differently under different backends**, which is the fact that
    ///    killed the name-keyed list. The law pack runs this exact type over `InMemoryDeltaLog`
    ///    and over `GitDeltaLog` and gets opposite classes from identical code.
    /// 2. **An undeclared backend makes the spine `Unmeasured`, never free.** A third-party
    ///    `IDeltaLog` that does not implement `IErasureDeclaring` produces a row saying so — a
    ///    visible hole rather than a silent zero. This is the drift guard at runtime, where a
    ///    reflection test cannot reach a caller-supplied type.
    /// 3. **The fold is declared separately and is erasing on its own.** `ZSet.add` consolidates,
    ///    so a `+1` followed by a `-1` leaves nothing — indistinguishable from never-present. That
    ///    erasure is in the ordinary arithmetic of the fold, not at the GC boundary, and it fires
    ///    on every commit rather than once per snapshot cadence.
    ///
    /// `ErasureAccount` is the charge these rows imply, posted per invocation.
    member _.ErasureProfiles: ErasureClass.Profile list =
        inheritedTruncationProfiles @ [ foldProfile ]

    interface IErasureDeclaring with
        member this.ErasureProfiles = this.ErasureProfiles


[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module RecoverableSpine =

    /// Start a fresh, empty recoverable spine over the given log + snapshot store.
    let create (log: IDeltaLog<'K>) (snap: ISnapshotStore<'K>) : RecoverableSpine<'K> =
        RecoverableSpine<'K>(log, snap, ZSet<'K>.Empty, 0L)
