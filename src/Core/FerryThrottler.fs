namespace Zeta.Core

open System
open System.Threading
open System.Threading.Channels
open System.Threading.Tasks


type private FerryRequest<'TItem, 'TResult>
    (item: 'TItem,
     completion: TaskCompletionSource<'TResult>,
     cancellationRegistration: CancellationTokenRegistration) =

    member _.Item = item
    member _.Completion = completion
    member _.IsCanceled = completion.Task.IsCanceled

    member _.TrySetResult(result: 'TResult) =
        completion.TrySetResult result |> ignore
        cancellationRegistration.Dispose()

    member _.TrySetException(ex: exn) =
        completion.TrySetException ex |> ignore
        cancellationRegistration.Dispose()

    member _.TrySetCanceled(cancellationToken: CancellationToken) =
        completion.TrySetCanceled cancellationToken |> ignore
        cancellationRegistration.Dispose()

    member _.Dispose() =
        cancellationRegistration.Dispose()


/// Configuration for a `FerryThrottler`.
///
/// The defaults are the *deterministic* defaults: one ferry. A throttler
/// built with `FerryThrottlerConfig.deterministic` runs as a single
/// cooperative loop — beautiful on one thread, DST-replayable, the
/// FoundationDB shape — and the SAME code scales to N ferries by raising
/// `MaxDegreeOfParallelism`. See `.claude/rules/async-all-the-way-truthful-signatures.md`.
type FerryThrottlerConfig =
    { /// Number of ferries (concurrent boat processors). **1 ⇒ a single
      /// deterministic cooperative loop** (no cross-ferry interleaving, replays
      /// from a seed); **N ⇒ N ferries** draining the same queue for throughput.
      /// Same code path either way (manifesto §1 scale-free, applied to threads).
      MaxDegreeOfParallelism: int
      /// Maximum items a single boat carries per `processBatch` call. This is a
      /// *capacity cap, not a delay* — a boat sails with whatever is queued right
      /// now, up to this many. It NEVER waits to fill the boat.
      MaxBatchSize: int
      /// Optional *byte budget* per boat. `None` ⇒ count-only batching. `Some b`
      /// ⇒ a boat also closes once adding the next item would exceed `b` bytes, so
      /// boats stay matched to serialization / buffer / wire sizes. Requires an
      /// item-size function at construction (`itemSizeBytes`). A single item larger
      /// than the budget still ships alone — the budget is a target that yields to
      /// progress, never a wall that strands one oversized item.
      MaxBatchBytes: int option
      /// Bounded queue size for backpressure. `None` ⇒ unbounded (enqueue never
      /// blocks). `Some n` ⇒ `EnqueueAsync` asynchronously waits once n items are
      /// in flight (cooperative backpressure, no dropped work).
      MaxQueueSize: int option }


[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module FerryThrottlerConfig =

    /// Deterministic default: one ferry, 256-item boat cap, unbounded queue.
    /// Beautiful on 1 — use this on the simulation / seed / DST path.
    let deterministic =
        { MaxDegreeOfParallelism = 1
          MaxBatchSize = 256
          MaxBatchBytes = None
          MaxQueueSize = None }

    /// Scale-out: `ferries` ferries, otherwise the deterministic defaults.
    /// `ferries` is clamped to at least 1.
    let withFerries (ferries: int) =
        { deterministic with MaxDegreeOfParallelism = max 1 ferries }


/// How a ferry loop is launched — the single source of launch truth for every
/// arity. `None` = production: run on the threadpool with no captured context
/// (awaits resume on the threadpool, equivalent to `backgroundTask`). `Some sc` =
/// Option-A increment 4: launch the WHOLE ferry onto the injected
/// `SynchronizationContext` (via `Post`). It does not begin until the context runs
/// the posted callback, and because a `SynchronizationContext` is current on its
/// own thread *while it runs its callbacks* (the standard message-pump contract —
/// e.g. `DeterministicSyncContext.PumpToIdle` installs itself for the pump's
/// duration), every `await` in the ferry captures `sc` and re-posts there. So the
/// entire ferry lifecycle is pump-gated, race-free, and replayable in the context's
/// run order — the launcher never touches any thread's context itself (which would
/// leak `sc` onto the caller/pump thread and trap its later awaits). This is the
/// noninterference door (manifesto §13): ferry scheduling enters only through the
/// injected context, never the ambient threadpool.
[<RequireQualifiedAccess>]
module private FerryLaunch =

    let launch
        (syncContext: SynchronizationContext option)
        (ferryLoop: unit -> Task)
        : Task =
        match syncContext with
        | None -> Task.Run(fun () -> ferryLoop ())
        | Some sc ->
            let tcs = TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously)
            sc.Post(
                (fun _ ->
                    // Runs inside `sc`'s pump, so `sc` is already current — do NOT
                    // set it here (setting without restoring leaks it onto the pump
                    // thread and deadlocks that thread's own later awaits).
                    let loop = ferryLoop ()
                    loop.ContinueWith(
                        (fun (c: Task) ->
                            if c.IsFaulted then tcs.TrySetException(c.Exception :> exn) |> ignore
                            elif c.IsCanceled then tcs.TrySetCanceled() |> ignore
                            else tcs.TrySetResult() |> ignore),
                        TaskContinuationOptions.ExecuteSynchronously)
                    |> ignore),
                null)
            tcs.Task


/// **FerryThrottler** — a degree-of-parallelism-knobbed work queue whose
/// batching core is the *Flux Capacitor* (Mirror codename): it accumulates
/// queued items and discharges them as a *boat* (batch) the instant a ferry is
/// free, carrying whatever is waiting. This is **self-clocked, anti-Nagle**
/// batching — unlike Nagle's algorithm it adds **no artificial timer/delay**:
/// under slow traffic a boat of one item sails immediately (zero added latency);
/// under bursts boats grow up to `MaxBatchSize`. Self-clocking is Van Jacobson's
/// ACK-clocking idea (TCP congestion avoidance, 1988) applied to work batching.
///
/// At `MaxDegreeOfParallelism = 1` this is a single deterministic ferry — the
/// FoundationDB single-thread run-loop shape — and the same type scales to N.
/// Prior art / human anchor: the maintainer's Itron `Platform.DotNet`
/// `Threading.Tasks.Throttling` (`IThrottler`, `MaxDegreeOfParallelism`).
///
/// Ferries are genuine async loops (no `Task.Run` per item; no blocked threads):
/// each awaits the channel and yields cooperatively while idle.
/// `processBatch` receives each boat; `itemSizeBytes` (optional) measures one
/// item's serialized size so boats can honour `config.MaxBatchBytes`.
[<Sealed>]
type FerryThrottler<'TItem>
    (config: FerryThrottlerConfig,
     processBatch: ReadOnlyMemory<'TItem> -> CancellationToken -> Task,
     ?itemSizeBytes: 'TItem -> int,
     // DST seam (Option B): when true, NO background ferries are started — the
     // caller drives processing synchronously via `PumpToIdleAsync` on its own
     // thread (deterministic, replayable, zero wall-clock). Intended for the
     // DoP=1 simulation / seed / test path. Default false = production background
     // ferries.
     ?manual: bool,
     // DST seam (Option A, increment 4): when provided, the background ferries run
     // *under* this `SynchronizationContext`, so every `await` in the ferry loop
     // (`WaitToReadAsync`, `processBatch`) routes its continuation to it. Inject a
     // deterministic, single-threaded, pumpable context and the BACKGROUND ferries
     // become replayable — without giving up the production code path (the way
     // `?manual` does). Default `None` = today's threadpool path, byte-identical
     // for production. This is the noninterference door (manifesto §13): ferry
     // scheduling enters only through the injected context, never the ambient
     // threadpool. Design: docs/research/2026-06-13-ferrythrottler-background-
     // ferry-replay-injected-synchronizationcontext-increment-4.md.
     ?syncContext: SynchronizationContext) =

    do
        if config.MaxDegreeOfParallelism < 1 then
            invalidArg (nameof config) "MaxDegreeOfParallelism must be >= 1"
        if config.MaxBatchSize < 1 then
            invalidArg (nameof config) "MaxBatchSize must be >= 1"
        match config.MaxQueueSize with
        | Some n when n < 1 -> invalidArg (nameof config) "MaxQueueSize, if set, must be >= 1"
        | _ -> ()
        match config.MaxBatchBytes with
        | Some b when b < 1 -> invalidArg (nameof config) "MaxBatchBytes, if set, must be >= 1"
        | Some _ when itemSizeBytes.IsNone ->
            invalidArg (nameof itemSizeBytes) "itemSizeBytes is required when MaxBatchBytes is set"
        | _ -> ()

    // Default sizer is unused when no byte budget is configured.
    let sizeOf = defaultArg itemSizeBytes (fun _ -> 0)

    let ferries = config.MaxDegreeOfParallelism

    // A bounded queue gives backpressure; unbounded never blocks the producer.
    // `SingleReader = ferries = 1` lets the runtime pick the cheaper path on the
    // deterministic single-ferry configuration.
    let inbox : Channel<'TItem> =
        match config.MaxQueueSize with
        | Some cap ->
            Channel.CreateBounded<'TItem>(
                BoundedChannelOptions(cap,
                    SingleReader = (ferries = 1),
                    SingleWriter = false,
                    FullMode = BoundedChannelFullMode.Wait))
        | None ->
            Channel.CreateUnbounded<'TItem>(
                UnboundedChannelOptions(SingleReader = (ferries = 1), SingleWriter = false))

    let cts = new CancellationTokenSource()

    /// One ferry: await work, drain a boat (everything queued *now*, up to
    /// `MaxBatchSize` — never waiting to fill it), process it, repeat. The
    /// self-clocking lives in `WaitToReadAsync` completing as soon as ≥1 item is
    /// available and the inner `TryRead` loop stopping the moment the queue drains.
    let byteBudget = config.MaxBatchBytes
    let isManual = defaultArg manual false

    // Build ONE boat from what is queued right now (plus a carried-over `pending`
    // item that was deferred to keep within the byte budget). No waiting for new
    // work, no awaiting — pure synchronous draining; returns the boat length and
    // updates `pending`. This is the SINGLE source of boat-building truth: both
    // the background ferry and the deterministic `PumpToIdleAsync` call it, so the
    // DST path builds boats byte-for-byte identically to production.
    let fillBoat (reader: ChannelReader<'TItem>) (buffer: 'TItem array) (pending: 'TItem voption ref) : int =
        let mutable n = 0
        let mutable bytes = 0
        match pending.Value with
        | ValueSome it ->
            buffer.[0] <- it
            n <- 1
            bytes <- sizeOf it
            pending.Value <- ValueNone
        | ValueNone -> ()
        let mutable draining = true
        while draining && n < config.MaxBatchSize do
            match reader.TryRead() with
            | true, item ->
                let sz = sizeOf item
                match byteBudget with
                | Some cap when n > 0 && bytes + sz > cap ->
                    // Adding this would overshoot — defer it, close the boat.
                    pending.Value <- ValueSome item
                    draining <- false
                | _ ->
                    buffer.[n] <- item
                    n <- n + 1
                    bytes <- bytes + sz
            | _ -> draining <- false
        n

    let injectedSyncContext = syncContext

    // The ferry loop body — a context-CAPTURING `task` (unlike `backgroundTask`,
    // its `await`s honour the ambient `SynchronizationContext`). WHERE its
    // continuations resume is therefore decided by the context in effect when it
    // is launched: null on the threadpool (production), or the injected context
    // (Option-A increment 4). The body itself is identical on both paths — the
    // single source of ferry-loop truth, mirroring `fillBoat` for boat-building.
    let ferryLoop () : Task =
        task {
            let reader = inbox.Reader
            let buffer = Array.zeroCreate<'TItem> config.MaxBatchSize
            let ct = cts.Token
            // One-item pushback (see fillBoat): a byte-budget-deferred item carried
            // to the NEXT boat, without a peek the channel doesn't offer.
            let pending: 'TItem voption ref = ref ValueNone
            try
                let mutable running = true
                while running do
                    // Only wait for new work when nothing is already deferred.
                    let mutable haveWork = pending.Value.IsSome
                    if not haveWork then
                        let! more = reader.WaitToReadAsync ct
                        haveWork <- more
                        if not more then running <- false
                    if haveWork then
                        let n = fillBoat reader buffer pending
                        if n > 0 then
                            do! processBatch (ReadOnlyMemory(buffer, 0, n)) ct
                            // Clear references so a large boat doesn't pin items.
                            Array.Clear(buffer, 0, n)
            with :? OperationCanceledException -> ()
        }

    let runFerry () : Task = FerryLaunch.launch injectedSyncContext ferryLoop

    // Production: start `ferries` background ferries now. Manual/DST mode: start
    // none — the caller drives via `PumpToIdleAsync`.
    let ferryTasks : Task array =
        if isManual then [||] else Array.init ferries (fun _ -> runFerry ())

    /// Enqueue one item. Returns a `ValueTask` that completes when the item is
    /// accepted into the queue — on a bounded throttler this cooperatively waits
    /// for room (backpressure); on an unbounded one it completes synchronously.
    /// Does NOT wait for the item to be *processed* (it rides a later boat).
    member _.EnqueueAsync(item: 'TItem, ?cancellationToken: CancellationToken) : ValueTask =
        let ct = defaultArg cancellationToken CancellationToken.None
        inbox.Writer.WriteAsync(item, ct)

    /// Try to enqueue without waiting. Returns false if a bounded queue is full.
    member _.TryEnqueue(item: 'TItem) : bool =
        inbox.Writer.TryWrite item

    /// **Deterministic drive (Option B / manual mode).** Synchronously drains the
    /// queue — building boats with the SAME `fillBoat` the background ferry uses
    /// and processing each on the CALLER'S thread — until the queue is idle. No
    /// background ferry, no wall-clock: awaiting the returned Task on the caller's
    /// own flow IS the whole schedule, so it is fully DST-replayable. Intended for
    /// the DoP=1 simulation / test path (construct with `manual = true`); the
    /// processor should complete synchronously there for true determinism.
    member _.PumpToIdleAsync(?cancellationToken: CancellationToken) : Task =
        task {
            let ct = defaultArg cancellationToken CancellationToken.None
            let reader = inbox.Reader
            let buffer = Array.zeroCreate<'TItem> config.MaxBatchSize
            let pending: 'TItem voption ref = ref ValueNone
            let mutable go = true
            while go do
                ct.ThrowIfCancellationRequested()
                let n = fillBoat reader buffer pending
                if n > 0 then
                    do! processBatch (ReadOnlyMemory(buffer, 0, n)) ct
                    Array.Clear(buffer, 0, n)
                else
                    go <- false // queue drained and nothing deferred — idle
        }

    /// Signal that no more items will be enqueued, then await every ferry
    /// draining the queue to completion. After this the throttler is finished.
    member _.CompleteAsync() : Task =
        inbox.Writer.TryComplete() |> ignore
        Task.WhenAll ferryTasks

    interface IDisposable with
        member _.Dispose() =
            // Best-effort, NON-BLOCKING shutdown. Signal completion + cancel; the
            // ferries observe cancellation and exit on their own. We deliberately
            // do NOT block on the ferry tasks here: a wall-clock
            // `Task.WaitAll(_, 500)` is DST-hostile (a nondeterministic timeout
            // DST cannot replay) AND deadlocks the DoP=1 deterministic path — the
            // injected pump can't run while this thread is blocked, so the ferries
            // never complete and the 500ms timeout abandons them. The CTS is
            // disposed only after the ferries actually finish, via an inline
            // continuation. Callers needing a guaranteed drain use `DisposeAsync`
            // (deterministic) or `CompleteAsync`.
            inbox.Writer.TryComplete() |> ignore
            cts.Cancel()
            (Task.WhenAll ferryTasks).ContinueWith(
                (fun (_: Task) -> cts.Dispose()),
                TaskContinuationOptions.ExecuteSynchronously) |> ignore

    interface IAsyncDisposable with
        member _.DisposeAsync() =
            // Deterministic drain: signal completion, cancel, then AWAIT every
            // ferry to finish — no thread blocked, no wall-clock timeout, fully
            // DST-replayable (on the DoP=1 path the awaited continuations route
            // through the injected pump). This is the preferred disposal path.
            inbox.Writer.TryComplete() |> ignore
            cts.Cancel()
            ValueTask(
                task {
                    try do! Task.WhenAll ferryTasks
                    with _ -> ()
                    cts.Dispose()
                })


/// Request/response FerryThrottler arity. Producers submit one item and receive
/// that item's `Task<'TResult>`; the ferry still processes boats in batches and
/// fans aligned results back to the individual callers.
///
/// At `MaxDegreeOfParallelism = 1`, completion order is deterministic for
/// non-cancelled items because one ferry drains boats in FIFO order. With
/// multiple ferries, every item still receives exactly one result/fault/cancel,
/// but cross-ferry completion order is intentionally not specified.
///
/// **Fault scope today is `WholeBoat`:** `processBatch` throw or result-length
/// mismatch sets the SAME exception on every row (`faultWholeBoat`). `PerRow`
/// FourCorner independence (workitem 081M125DNKK087G0R00292E3ET) is the named
/// gap — `'TItem` is NOT required to be `FourCornerOwnership`. Do not "fix"
/// by wrapping each row in a fresh exception; that still couples siblings.
[<Sealed>]
type FerryThrottler<'TItem, 'TResult>
    (config: FerryThrottlerConfig,
     processBatch: ReadOnlyMemory<'TItem> -> CancellationToken -> Task<'TResult array>,
     ?itemSizeBytes: 'TItem -> int,
     // DST seam (Option A, increment 4): run the background ferries under this
     // `SynchronizationContext` so their `await` continuations route to it. Inject
     // a deterministic pumpable context (`DeterministicSyncContext`) and the
     // request/response ferries become replayable. Default `None` = today's
     // threadpool path, byte-identical for production. See the single-arity seam.
     ?syncContext: SynchronizationContext) =

    do
        if config.MaxDegreeOfParallelism < 1 then
            invalidArg (nameof config) "MaxDegreeOfParallelism must be >= 1"
        if config.MaxBatchSize < 1 then
            invalidArg (nameof config) "MaxBatchSize must be >= 1"
        match config.MaxQueueSize with
        | Some n when n < 1 -> invalidArg (nameof config) "MaxQueueSize, if set, must be >= 1"
        | _ -> ()
        match config.MaxBatchBytes with
        | Some b when b < 1 -> invalidArg (nameof config) "MaxBatchBytes, if set, must be >= 1"
        | Some _ when itemSizeBytes.IsNone ->
            invalidArg (nameof itemSizeBytes) "itemSizeBytes is required when MaxBatchBytes is set"
        | _ -> ()

    let sizeOf = defaultArg itemSizeBytes (fun _ -> 0)
    let ferries = config.MaxDegreeOfParallelism

    let inbox : Channel<FerryRequest<'TItem, 'TResult>> =
        match config.MaxQueueSize with
        | Some cap ->
            Channel.CreateBounded<FerryRequest<'TItem, 'TResult>>(
                BoundedChannelOptions(cap,
                    SingleReader = (ferries = 1),
                    SingleWriter = false,
                    FullMode = BoundedChannelFullMode.Wait))
        | None ->
            Channel.CreateUnbounded<FerryRequest<'TItem, 'TResult>>(
                UnboundedChannelOptions(SingleReader = (ferries = 1), SingleWriter = false))

    let cts = new CancellationTokenSource()
    let byteBudget = config.MaxBatchBytes

    let rec tryTakeActive (reader: ChannelReader<FerryRequest<'TItem, 'TResult>>) =
        match reader.TryRead() with
        | true, req when req.IsCanceled ->
            req.Dispose()
            tryTakeActive reader
        | true, req -> ValueSome req
        | false, _ -> ValueNone

    /// Current contract: WholeBoat — the SAME `ex` is set on every row.
    /// `PerRow` (FourCorner feedback per row; 081M125DNKK087G0R00292E3ET) is
    /// the named gap, not implemented this slice. Wrapping per row without
    /// independence is not a PerRow landing.
    let faultWholeBoat (requests: FerryRequest<'TItem, 'TResult> array) (count: int) (ex: exn) =
        for i in 0 .. count - 1 do
            requests.[i].TrySetException ex

    let cancelBoat
        (requests: FerryRequest<'TItem, 'TResult> array)
        (count: int)
        (cancellationToken: CancellationToken)
        =
        for i in 0 .. count - 1 do
            requests.[i].TrySetCanceled cancellationToken

    let cancelRemaining
        (reader: ChannelReader<FerryRequest<'TItem, 'TResult>>)
        (pending: FerryRequest<'TItem, 'TResult> voption)
        (cancellationToken: CancellationToken)
        =
        match pending with
        | ValueSome req -> req.TrySetCanceled cancellationToken
        | ValueNone -> ()

        let mutable draining = true
        while draining do
            match reader.TryRead() with
            | true, req -> req.TrySetCanceled cancellationToken
            | false, _ -> draining <- false

    let completeBoat
        (requests: FerryRequest<'TItem, 'TResult> array)
        (count: int)
        (results: 'TResult array)
        =
        if results.Length <> count then
            let ex =
                InvalidOperationException(
                    $"FerryThrottler result count mismatch: processor returned {results.Length} results for {count} items.")
            faultWholeBoat requests count ex
        else
            for i in 0 .. count - 1 do
                requests.[i].TrySetResult results.[i]

    let trySize (req: FerryRequest<'TItem, 'TResult>) =
        try
            Ok(sizeOf req.Item)
        with ex ->
            req.TrySetException ex
            Error()

    let injectedSyncContext = syncContext

    // The ferry loop body — a context-CAPTURING `task` (its awaits honour the
    // ambient `SynchronizationContext`), so WHERE its continuations resume is set
    // by the context in effect when it is launched: null on the threadpool
    // (production), or the injected context (Option-A increment 4). Single source
    // of result-arity ferry-loop truth across both launch paths.
    let ferryLoop () : Task =
        task {
            let reader = inbox.Reader
            let items = Array.zeroCreate<'TItem> config.MaxBatchSize
            let requests = Array.zeroCreate<FerryRequest<'TItem, 'TResult>> config.MaxBatchSize
            let ct = cts.Token
            let mutable pending: FerryRequest<'TItem, 'TResult> voption = ValueNone
            try
                let mutable running = true
                while running do
                    let mutable haveWork = pending.IsSome
                    if not haveWork then
                        let! more = reader.WaitToReadAsync ct
                        haveWork <- more
                        if not more then running <- false
                    if haveWork then
                        let mutable n = 0
                        let mutable bytes = 0
                        match pending with
                        | ValueSome req when req.IsCanceled ->
                            req.Dispose()
                            pending <- ValueNone
                        | ValueSome req ->
                            match trySize req with
                            | Ok sz ->
                                items.[0] <- req.Item
                                requests.[0] <- req
                                n <- 1
                                bytes <- sz
                            | Error() -> req.Dispose()
                            pending <- ValueNone
                        | ValueNone -> ()
                        let mutable draining = true
                        while draining && n < config.MaxBatchSize do
                            match tryTakeActive reader with
                            | ValueSome req ->
                                match trySize req with
                                | Ok sz ->
                                    match byteBudget with
                                    | Some cap when n > 0 && bytes + sz > cap ->
                                        pending <- ValueSome req
                                        draining <- false
                                    | _ ->
                                        items.[n] <- req.Item
                                        requests.[n] <- req
                                        n <- n + 1
                                        bytes <- bytes + sz
                                | Error() -> req.Dispose()
                            | ValueNone -> draining <- false
                        if n > 0 then
                            try
                                let! results = processBatch (ReadOnlyMemory(items, 0, n)) ct
                                completeBoat requests n results
                            with
                            | :? OperationCanceledException when ct.IsCancellationRequested ->
                                cancelBoat requests n ct
                            | ex ->
                                faultWholeBoat requests n ex
                            Array.Clear(items, 0, n)
                            Array.Clear(requests, 0, n)
            with :? OperationCanceledException ->
                cancelRemaining reader pending ct
        }

    let runFerry () : Task = FerryLaunch.launch injectedSyncContext ferryLoop

    let ferryTasks : Task array =
        Array.init ferries (fun _ -> runFerry ())

    member _.ProcessAsync(item: 'TItem, ?cancellationToken: CancellationToken) : Task<'TResult> =
        let ct = defaultArg cancellationToken CancellationToken.None
        let completion =
            TaskCompletionSource<'TResult>(TaskCreationOptions.RunContinuationsAsynchronously)

        if ct.IsCancellationRequested then
            completion.TrySetCanceled ct |> ignore
            completion.Task
        else
            let registration =
                if ct.CanBeCanceled then
                    ct.Register(fun () -> completion.TrySetCanceled ct |> ignore)
                else
                    Unchecked.defaultof<CancellationTokenRegistration>
            let request = FerryRequest(item, completion, registration)
            task {
                try
                    do! inbox.Writer.WriteAsync(request, ct).AsTask()
                    return! completion.Task
                with
                | :? OperationCanceledException when ct.IsCancellationRequested ->
                    request.TrySetCanceled ct
                    return! completion.Task
                | ex ->
                    request.TrySetException ex
                    return! completion.Task
            }

    member _.CompleteAsync() : Task =
        inbox.Writer.TryComplete() |> ignore
        Task.WhenAll ferryTasks

    interface IDisposable with
        member _.Dispose() =
            // Best-effort, NON-BLOCKING shutdown. Signal completion + cancel; the
            // ferries observe cancellation and exit on their own. We deliberately
            // do NOT block on the ferry tasks here: a wall-clock
            // `Task.WaitAll(_, 500)` is DST-hostile (a nondeterministic timeout
            // DST cannot replay) AND deadlocks the DoP=1 deterministic path — the
            // injected pump can't run while this thread is blocked, so the ferries
            // never complete and the 500ms timeout abandons them. The CTS is
            // disposed only after the ferries actually finish, via an inline
            // continuation. Callers needing a guaranteed drain use `DisposeAsync`
            // (deterministic) or `CompleteAsync`.
            inbox.Writer.TryComplete() |> ignore
            cts.Cancel()
            (Task.WhenAll ferryTasks).ContinueWith(
                (fun (_: Task) -> cts.Dispose()),
                TaskContinuationOptions.ExecuteSynchronously) |> ignore

    interface IAsyncDisposable with
        member _.DisposeAsync() =
            // Deterministic drain: signal completion, cancel, then AWAIT every
            // ferry to finish — no thread blocked, no wall-clock timeout, fully
            // DST-replayable (on the DoP=1 path the awaited continuations route
            // through the injected pump). This is the preferred disposal path.
            inbox.Writer.TryComplete() |> ignore
            cts.Cancel()
            ValueTask(
                task {
                    try do! Task.WhenAll ferryTasks
                    with _ -> ()
                    cts.Dispose()
                })


/// **ContextualFerryThrottler** — explicit context threading, the Kleisli-Arrow
/// shape. Each item carries the caller's context value, captured AT ENQUEUE and
/// threaded — as DATA, never via an AsyncLocal hidden side channel — to the boat
/// processor. It *composes* the single-arity `FerryThrottler` over
/// `struct('TItem * 'Ctx)`, so all batching / DoP / manual-pump (DST) behaviour is
/// inherited unchanged. Mirrors `ISR` / `Traced.withCtx`: context is a parameter,
/// not ambient state (see `Tracing.fs` on why the explicit Arrow beats the
/// AsyncLocal side channel for legibility + composition).
///
/// First increment of the async-context-threading work: the caller supplies the
/// context explicitly (no ambient capture). Later increments may add a
/// capture-at-the-boundary convenience and extend context to the result arity.
[<Sealed>]
type ContextualFerryThrottler<'TItem, 'Ctx>
    (config: FerryThrottlerConfig,
     processBatch: ReadOnlyMemory<struct ('TItem * 'Ctx)> -> CancellationToken -> Task,
     ?itemSizeBytes: 'TItem -> int,
     ?manual: bool,
     // Capture-at-the-boundary: an ambient-context reader run ON THE ENQUEUER'S
     // flow at each `EnqueueCapturedAsync` call, so the ambient (e.g.
     // `Activity.Current` / `IntrCtx` / a Zeta `AsyncLocal`) is snapshotted at the
     // door and then threaded as DATA — the boundary is the only place the side
     // channel is touched; nothing ambient flows into the background ferry.
     ?capture: unit -> 'Ctx,
     // DST seam (Option A, increment 4): forwarded to the composed core throttler
     // so the BACKGROUND ferries replay under an injected `SynchronizationContext`.
     ?syncContext: SynchronizationContext) =

    // Size the PAYLOAD, not the (payload, ctx) pair — the threaded context is
    // metadata that rides along; it does not count against the byte budget.
    let innerSizer =
        itemSizeBytes |> Option.map (fun f -> fun (struct (item, _ctx): struct ('TItem * 'Ctx)) -> f item)

    let inner =
        new FerryThrottler<struct ('TItem * 'Ctx)>(
            config, processBatch, ?itemSizeBytes = innerSizer, ?manual = manual, ?syncContext = syncContext)

    /// Enqueue one item together with an explicit context value to thread to its boat.
    member _.EnqueueAsync(item: 'TItem, context: 'Ctx, ?cancellationToken: CancellationToken) : ValueTask =
        inner.EnqueueAsync(struct (item, context), ?cancellationToken = cancellationToken)

    /// Capture-at-the-boundary enqueue (the Itron "capture so I can pass it through"
    /// pattern): snapshots the ambient context NOW — via the `capture` reader run on
    /// the caller's flow — and threads that snapshot with the item. Requires a
    /// `capture` reader at construction.
    member _.EnqueueCapturedAsync(item: 'TItem, ?cancellationToken: CancellationToken) : ValueTask =
        match capture with
        | Some readAmbient ->
            inner.EnqueueAsync(struct (item, readAmbient ()), ?cancellationToken = cancellationToken)
        | None -> invalidOp "EnqueueCapturedAsync requires a `capture` reader supplied at construction"

    /// Deterministic manual drive (when constructed with `manual = true`).
    member _.PumpToIdleAsync(?cancellationToken: CancellationToken) : Task =
        inner.PumpToIdleAsync(?cancellationToken = cancellationToken)

    /// Signal completion and await the queue draining.
    member _.CompleteAsync() : Task = inner.CompleteAsync()

    interface IDisposable with
        member _.Dispose() = (inner :> IDisposable).Dispose()


/// **ContextualResultFerryThrottler** — the request/response (result) arity with
/// explicit context threading (Option-A increment 3). Each submitted item carries
/// the caller's context — supplied explicitly or captured at the door — threaded as
/// DATA to the boat processor; the per-item `Task<'TResult>` still fans back to the
/// caller. Composes `FerryThrottler<struct('TItem*'Ctx), 'TResult>`, mirroring
/// `ContextualFerryThrottler` for the result arity. Background ferries replay via
/// the forwarded `?syncContext` (Option-A increment 4b); the synchronous
/// manual-pump (`PumpToIdleAsync`) remains single-arity-only.
[<Sealed>]
type ContextualResultFerryThrottler<'TItem, 'Ctx, 'TResult>
    (config: FerryThrottlerConfig,
     processBatch: ReadOnlyMemory<struct ('TItem * 'Ctx)> -> CancellationToken -> Task<'TResult array>,
     ?itemSizeBytes: 'TItem -> int,
     // Capture-at-the-boundary reader (see ContextualFerryThrottler): snapshots the
     // ambient on the caller's flow at ProcessCapturedAsync time, threaded as data.
     ?capture: unit -> 'Ctx,
     // DST seam (Option A, increment 4): forwarded to the composed core throttler
     // so the request/response BACKGROUND ferries replay under an injected context.
     ?syncContext: SynchronizationContext) =

    let innerSizer =
        itemSizeBytes |> Option.map (fun f -> fun (struct (item, _ctx): struct ('TItem * 'Ctx)) -> f item)

    let inner =
        new FerryThrottler<struct ('TItem * 'Ctx), 'TResult>(
            config, processBatch, ?itemSizeBytes = innerSizer, ?syncContext = syncContext)

    /// Submit one item with an explicit context; returns that item's result task.
    member _.ProcessAsync(item: 'TItem, context: 'Ctx, ?cancellationToken: CancellationToken) : Task<'TResult> =
        inner.ProcessAsync(struct (item, context), ?cancellationToken = cancellationToken)

    /// Capture-at-the-boundary submit: snapshots the ambient context now and threads it.
    member _.ProcessCapturedAsync(item: 'TItem, ?cancellationToken: CancellationToken) : Task<'TResult> =
        match capture with
        | Some readAmbient ->
            inner.ProcessAsync(struct (item, readAmbient ()), ?cancellationToken = cancellationToken)
        | None -> invalidOp "ProcessCapturedAsync requires a `capture` reader supplied at construction"

    /// Signal completion and await the queue draining.
    member _.CompleteAsync() : Task = inner.CompleteAsync()

    interface IDisposable with
        member _.Dispose() = (inner :> IDisposable).Dispose()
