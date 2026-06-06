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
     ?itemSizeBytes: 'TItem -> int) =

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

    let runFerry () : Task =
        backgroundTask {
            let reader = inbox.Reader
            let buffer = Array.zeroCreate<'TItem> config.MaxBatchSize
            let ct = cts.Token
            // One-item pushback: an item read but deferred to the NEXT boat because
            // it would have pushed the current boat over its byte budget. Keeps the
            // budget strict without needing a peek the channel doesn't offer.
            let mutable pending: 'TItem voption = ValueNone
            try
                let mutable running = true
                while running do
                    // Only wait for new work when nothing is already deferred.
                    let mutable haveWork = pending.IsSome
                    if not haveWork then
                        let! more = reader.WaitToReadAsync ct
                        haveWork <- more
                        if not more then running <- false
                    if haveWork then
                        // Build one boat from what's queued right now (plus any
                        // deferred item). Closes on item count OR byte budget —
                        // never on a timer.
                        let mutable n = 0
                        let mutable bytes = 0
                        match pending with
                        | ValueSome it ->
                            buffer.[0] <- it
                            n <- 1
                            bytes <- sizeOf it
                            pending <- ValueNone
                        | ValueNone -> ()
                        let mutable draining = true
                        while draining && n < config.MaxBatchSize do
                            match reader.TryRead() with
                            | true, item ->
                                let sz = sizeOf item
                                match byteBudget with
                                | Some cap when n > 0 && bytes + sz > cap ->
                                    // Adding this would overshoot — defer it, close the boat.
                                    pending <- ValueSome item
                                    draining <- false
                                | _ ->
                                    buffer.[n] <- item
                                    n <- n + 1
                                    bytes <- bytes + sz
                            | _ -> draining <- false
                        if n > 0 then
                            do! processBatch (ReadOnlyMemory(buffer, 0, n)) ct
                            // Clear references so a large boat doesn't pin items.
                            Array.Clear(buffer, 0, n)
            with :? OperationCanceledException -> ()
        }

    let ferryTasks : Task array =
        Array.init ferries (fun _ -> runFerry ())

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

    /// Signal that no more items will be enqueued, then await every ferry
    /// draining the queue to completion. After this the throttler is finished.
    member _.CompleteAsync() : Task =
        inbox.Writer.TryComplete() |> ignore
        Task.WhenAll ferryTasks

    interface IDisposable with
        member _.Dispose() =
            inbox.Writer.TryComplete() |> ignore
            cts.Cancel()
            try Task.WaitAll(ferryTasks, 500) |> ignore with _ -> ()
            cts.Dispose()


/// Request/response FerryThrottler arity. Producers submit one item and receive
/// that item's `Task<'TResult>`; the ferry still processes boats in batches and
/// fans aligned results back to the individual callers.
///
/// At `MaxDegreeOfParallelism = 1`, completion order is deterministic for
/// non-cancelled items because one ferry drains boats in FIFO order. With
/// multiple ferries, every item still receives exactly one result/fault/cancel,
/// but cross-ferry completion order is intentionally not specified.
[<Sealed>]
type FerryThrottler<'TItem, 'TResult>
    (config: FerryThrottlerConfig,
     processBatch: ReadOnlyMemory<'TItem> -> CancellationToken -> Task<'TResult array>,
     ?itemSizeBytes: 'TItem -> int) =

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

    let faultBoat (requests: FerryRequest<'TItem, 'TResult> array) (count: int) (ex: exn) =
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
            faultBoat requests count ex
        else
            for i in 0 .. count - 1 do
                requests.[i].TrySetResult results.[i]

    let trySize (req: FerryRequest<'TItem, 'TResult>) =
        try
            Ok(sizeOf req.Item)
        with ex ->
            req.TrySetException ex
            Error()

    let runFerry () : Task =
        backgroundTask {
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
                                faultBoat requests n ex
                            Array.Clear(items, 0, n)
                            Array.Clear(requests, 0, n)
            with :? OperationCanceledException ->
                cancelRemaining reader pending ct
        }

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
            inbox.Writer.TryComplete() |> ignore
            cts.Cancel()
            try Task.WaitAll(ferryTasks, 500) |> ignore with _ -> ()
            cts.Dispose()
