namespace Zeta.Core

open System
open System.Collections.Generic
open System.Threading
open System.Threading.Tasks


/// Delivery guarantee negotiated with a sink. DBSP's internal
/// consistency is exactly-once by construction — this enum governs
/// **external** delivery (i.e., what a downstream Kafka / DB / file
/// observer sees).
[<RequireQualifiedAccess>]
type DeliveryMode =
    /// At-most-once: emit as soon as the tick completes, no staging,
    /// no retry. Cheapest. Use for logs/telemetry where loss is fine.
    | AtMostOnce
    /// At-least-once: emit at commit time; on restart, replay from the
    /// last checkpoint — duplicates possible.
    | AtLeastOnce
    /// Exactly-once: two-phase commit. On tick `t`:
    ///   1. `BeginTx(t)` → handle
    ///   2. `Write(handle, delta)` for every tick output
    ///   3. `PreCommit(handle)` (fsync / stage / Kafka produce tx)
    ///   4. After tick's checkpoint is durable, `Commit(handle)`
    /// Any crash before `Commit` triggers `Abort(handle)` on restart.
    | ExactlyOnce


/// A sink that accepts per-tick Z-set deltas with a configurable
/// delivery guarantee. `'T : comparison` because it's embedded in a
/// `ZSet<'T>`.
type ISink<'T when 'T : comparison> =
    /// Open a new transaction for tick-epoch `epoch`. Same epoch means
    /// retry of the same tick — implementation deduplicates.
    abstract BeginTx: epoch: int64 * ct: CancellationToken -> ValueTask<obj>
    /// Stage a delta into the in-flight tx.
    abstract Write: handle: obj * delta: ZSet<'T> * ct: CancellationToken -> ValueTask
    /// Stage all writes durably (fsync / Kafka produce to tx topic).
    /// After PreCommit, the tx is guaranteed to be recoverable on
    /// restart even if Commit hasn't yet been called.
    abstract PreCommit: handle: obj * ct: CancellationToken -> ValueTask
    /// Make the tx visible to downstream readers. Idempotent by `epoch`.
    abstract Commit: handle: obj * ct: CancellationToken -> ValueTask
    /// Discard the tx. Idempotent.
    abstract Abort: handle: obj * ct: CancellationToken -> ValueTask
    /// Which mode is this sink configured for?
    abstract Mode: DeliveryMode


/// In-memory sink that records every delta, for tests. All methods are
/// no-ops on the transaction lifecycle (commit just flips a flag), so
/// `Committed` lets tests assert exactly-once vs duplicate behaviour.
[<Sealed>]
type InMemorySink<'T when 'T : comparison>(mode: DeliveryMode) =
    let committed = List<ZSet<'T>>()
    let inFlight = Dictionary<int64, struct (ResizeArray<ZSet<'T>> * bool)>()
    let lockObj = obj ()
    member _.Committed : IReadOnlyList<ZSet<'T>> = upcast committed
    member _.InFlightCount = lock lockObj (fun () -> inFlight.Count)
    interface ISink<'T> with
        member _.Mode = mode
        member _.BeginTx(epoch, _ct) =
            lock lockObj (fun () ->
                if not (inFlight.ContainsKey epoch) then
                    inFlight.[epoch] <- struct (ResizeArray(), false))
            ValueTask<obj>(box epoch)
        member _.Write(handle, delta, _ct) =
            let epoch = unbox<int64> handle
            lock lockObj (fun () ->
                let struct (buf, _) = inFlight.[epoch]
                buf.Add delta)
            ValueTask.CompletedTask
        member _.PreCommit(handle, _ct) =
            let epoch = unbox<int64> handle
            lock lockObj (fun () ->
                let struct (buf, _) = inFlight.[epoch]
                inFlight.[epoch] <- struct (buf, true))
            ValueTask.CompletedTask
        member _.Commit(handle, _ct) =
            let epoch = unbox<int64> handle
            lock lockObj (fun () ->
                match inFlight.TryGetValue epoch with
                | true, struct (buf, _) ->
                    for z in buf do committed.Add z
                    inFlight.Remove epoch |> ignore
                | _ -> ())   // idempotent — already committed
            ValueTask.CompletedTask
        member _.Abort(handle, _ct) =
            let epoch = unbox<int64> handle
            lock lockObj (fun () ->
                inFlight.Remove epoch |> ignore)
            ValueTask.CompletedTask


/// **Non-exceptional append outcome** — inspired by EventStoreDB /
/// Kurrent's `WrongExpectedVersionResult` design. Return `Conflict`
/// when the caller's expected revision doesn't match the sink's;
/// never throw for ordinary concurrency races. Throw only for
/// programmer error or catastrophic I/O failure.
///
/// The user called this out: EventStoreDB's exception-based conflict
/// path was the part they disliked; we adopt the `Result`-shaped
/// alternative explicitly so the common concurrency case never
/// allocates an exception object.
[<RequireQualifiedAccess>]
type AppendResult =
    /// Append succeeded; new durable revision.
    | Ok of revision: int64
    /// Expected-revision mismatch. Carry the actual observed revision
    /// so the caller can re-read + retry without a second round-trip.
    | Conflict of actualRevision: int64
    /// Sink is temporarily unavailable (e.g. failover). Retry with
    /// backoff; not a conflict.
    | Unavailable of message: string


/// Expected-revision matcher for append semantics. Mirrors
/// `EventStore.Client.ExpectedRevision` but encoded as a DU so F#
/// callers get exhaustive match checks.
[<RequireQualifiedAccess>]
type ExpectedRevision =
    /// Any revision — append unconditionally.
    | Any
    /// Stream must not exist yet.
    | NoStream
    /// Stream must exist (any revision).
    | StreamExists
    /// Must match exactly this revision.
    | Exact of revision: int64


/// A sink that supports append-with-expected-revision semantics —
/// suitable for event-sourced pipelines. Unlike `ISink` (which is
/// designed for per-tick 2PC), `IAppendSink` is for the upstream
/// *event producer* path where ordering + de-dup matter more than
/// atomicity across multiple sinks.
type IAppendSink<'T when 'T : comparison> =
    /// Append a delta with an expected-revision check. Returns an
    /// `AppendResult` — never throws for concurrency conflicts.
    abstract AppendAsync:
        delta: ZSet<'T>
        * expected: ExpectedRevision
        * ct: CancellationToken
        -> ValueTask<AppendResult>


/// No-op sink — discards every write. Useful when wiring a pipeline
/// for testing or when downstream isn't ready yet.
[<Sealed>]
type NullSink<'T when 'T : comparison>() =
    interface ISink<'T> with
        member _.Mode = DeliveryMode.AtMostOnce
        member _.BeginTx(_, _) = ValueTask<obj>(box 0)
        member _.Write(_, _, _) = ValueTask.CompletedTask
        member _.PreCommit(_, _) = ValueTask.CompletedTask
        member _.Commit(_, _) = ValueTask.CompletedTask
        member _.Abort(_, _) = ValueTask.CompletedTask
