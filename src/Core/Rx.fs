namespace Zeta.Core

open System
open System.Collections.Generic
open System.Globalization
open System.Reactive.Concurrency
open System.Reactive.Disposables
open System.Reactive.Subjects
open System.Reactive.Linq
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// Rx (System.Reactive) integration: `OutputHandle<'T>` → `IObservable<'T>`
/// and a minimal `IQbservable<'T>` skeleton for expression-tree-based
/// query composition.
///
/// Bart De Smet's duality thesis (*Observations on IQbservable*, Channel 9):
/// `IObservable<'T>` is the push-dual of `IEnumerable<'T>`, and
/// `IQbservable<'T>` is its LINQ-expression-tree queryable form — the
/// dual of `IQueryable<'T>`. DBSP's `Stream<ZSet<'T>>` is morally
/// equivalent to `IObservable<ChangeSet<'T>>`; this file exposes that
/// equivalence without taking on all of Rx as a semantic model.
///
/// References:
///   - Meijer. "Subject/Observer is Dual to Iterator". PLDI FIT 2010.
///   - Meijer. "Your Mouse is a Database". ACM Queue 2012.
///   - Reaqtor project: https://github.com/reaqtive/reaqtor
///   - De Smet blog series on reaqtive.net (2021).
///
/// WHY THERE IS NO SUBSCRIPTION-LEAK DISCIPLINE HERE (081KTSZN10008QG0R002R3RENG rung 3, verified in-tree
/// 2026-06-12 — the answer to Aaron's "I forget why we don't need dispose or risk leaks"):
///   (a) Core's composition is PULL/fold-based — ReactiveSynth's trace is a replayable fold,
///       AnimFlow/SoftIsr observeWith fold generators; no observer REGISTRY exists anywhere in
///       Core for a subscription to dangle in. THIS adapter is the only push surface.
///   (b) At this one push surface, the returned IDisposable tears down the WHOLE pipeline —
///       observer link, pump cancellation, token source, subject — so the subscription's
///       lifetime IS the pipeline's lifetime (the room-scoped insight: dispose-of-the-room
///       is the only dispose anyone needs). Falsifiers: RxAdapter.Tests.fs proves teardown is
///       real (a disposed pipeline refuses new subscribers; notifications stop).
///   (c) The `RxJoin` combinators below (added 2026-08-24) are the second push surface, and
///       they extend (a)/(b) rather than weakening them: every inner subscription an operator
///       opens — both sources, and in `join`/`groupJoin` one duration subscription per live
///       element — is registered in a `CompositeDisposable` owned by the handle the operator
///       returned, and `groupJoin` additionally completes and disposes every open window on
///       teardown. Falsifiers: `RxJoin.Tests.fs` §TEARDOWN proves a disposed combinator stops
///       feeding, closes its windows, and releases both source subscriptions.
/// NOT claimed: "Rx can't leak." Claimed: our lifetimes are bounded above every subscription.
[<RequireQualifiedAccess>]
module RxAdapter =

    /// Drive a circuit and publish each tick's output to an `IObservable`.
    /// Subscribers receive one `OnNext` per circuit tick; completion on
    /// `Dispose` of the returned `IDisposable` (the circuit keeps running
    /// independent of subscribers, so `OnCompleted` fires lazily).
    ///
    /// Use `.ToTask()` / `.ToAsyncEnumerable()` / `.Buffer(TimeSpan)` etc.
    /// to compose with the rest of Rx.
    let asObservable<'T>
        (circuit: Circuit)
        (handle: OutputHandle<'T>)
        (ct: CancellationToken)
        : IObservable<'T> =
        let subject = new Subject<'T>()
        let cts = CancellationTokenSource.CreateLinkedTokenSource ct
        // TEARDOWN OWNERSHIP (falsifier-found race, 2026-06-12): the PUMP owns subject/cts
        // disposal — a subscriber's Dispose only signals cancellation. The previous shape
        // disposed subject+cts inside the subscription's Dispose while the pump was mid-step;
        // the pump then touched disposed objects and the unhandled throw crashed the host
        // (RxAdapter.Tests "TEARDOWN IS REAL" caught it). Signal in, owner out.
        let pump () =
            task {
                try
                    try
                        while not cts.IsCancellationRequested do
                            do! circuit.StepAsync cts.Token
                            if not cts.IsCancellationRequested then
                                subject.OnNext handle.Current
                    with
                    | :? OperationCanceledException -> ()
                    | :? ObjectDisposedException -> ()
                    | ex ->
                        try subject.OnError ex with _ -> ()
                finally
                    (try subject.OnCompleted() with _ -> ())
                    subject.Dispose()
                    cts.Dispose()
            } |> ignore
        pump ()
        { new IObservable<'T> with
            member _.Subscribe observer =
                let d = subject.Subscribe observer
                { new IDisposable with
                    member _.Dispose() =
                        d.Dispose()
                        try cts.Cancel() with :? ObjectDisposedException -> () } }

    /// Same as `asObservable` but drives a fixed number of ticks then
    /// sends `OnCompleted`. Useful for tests and bounded pipelines.
    let asObservableForCount<'T>
        (circuit: Circuit)
        (handle: OutputHandle<'T>)
        (count: int)
        : IObservable<'T> =
        Observable.Create(fun (observer: IObserver<'T>) ->
            let cts = new CancellationTokenSource()
            let pump () =
                task {
                    try
                        for _ in 1 .. count do
                            if cts.IsCancellationRequested then raise (OperationCanceledException())
                            do! circuit.StepAsync cts.Token
                            observer.OnNext handle.Current
                        observer.OnCompleted()
                    with
                    | :? OperationCanceledException ->
                        observer.OnCompleted()
                    | ex ->
                        observer.OnError ex
                } |> ignore
            pump ()
            { new IDisposable with
                member _.Dispose() =
                    cts.Cancel()
                    cts.Dispose() })


/// ═══════════════════════════════════════════════════════════════════════════
/// Stage-one join operators — the ones that need NO query planner.
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Before this module `Rx.fs` had exactly two functions, both channel→observable
/// bridges (`asObservable`, `asObservableForCount`). There was no operator set at
/// all, so this is not "joins added to a combinator library" — it is the first
/// combinator library.
///
/// WHY THESE FOUR AND NOT THE PLANNER JOINS (Aaron 2026-08-24: *"lets start with
/// the simple ones that don't requrie query planners, query planner joins come
/// second but should not be discounted against, just many required ongoing
/// statistics capture about the two streams"*):
///
/// A join needs a planner exactly when its cost depends on statistics the
/// operator would have to INFER from the data. Every operator here has its
/// window/key fixed by the CALLER up front, so there is nothing to infer:
///
///   | operator          | what fixes the cost            | statistic needed |
///   |-------------------|--------------------------------|------------------|
///   | `zip`             | arrival index (pairwise)       | none             |
///   | `combineLatest`   | one slot per side              | none             |
///   | `withLatestFrom`  | one slot on the right          | none             |
///   | `groupJoin`/`join`| caller's duration selectors    | none             |
///
/// NO CLOCK LIVES HERE. `zip` / `combineLatest` / `withLatestFrom` are driven by
/// arrival index only — time is not a term in their definitions. `groupJoin` and
/// `join` take the window as an `IObservable` the CALLER supplies, so this module
/// never reads a clock to decide a window: it only observes the caller's
/// duration stream. That is what `.claude/rules/local-time-never-enters-the-shared-fold.md`
/// requires — a join duration is a CHOICE CONTEXT, and resolving it from a wall
/// clock puts local time inside a shared conclusion.
///
/// The clock CAN still enter one door: a caller who writes
/// `Observable.Timer(ts)` for a duration gets `Scheduler.Default`, which IS a wall
/// clock. `durationAfter` below is the sanctioned form and takes the scheduler
/// explicitly — there is deliberately no overload that defaults it.
///
/// WHAT STAGE TWO NEEDS (named here so it is a build, not a redesign). A planner
/// join (hash/index/symmetric-hash, join reordering, spill decisions) needs
/// CONTINUOUS statistics about BOTH streams, and nothing in this repo collects
/// any of them today:
///   * arrival rate per side (items/phase) — for buffer sizing and ferry DoP
///   * key cardinality + skew per side — to pick hash vs index-nested-loop
///   * join selectivity (matched / offered) — to order multi-way joins
///   * window occupancy over phase (open windows, live rights) — to price memory
///   * retraction ratio for Z-set inputs — DBSP joins pay differently on −1s
/// Where they would have to come from: the metered-crossing channel of §13
/// noninterference (`.claude/rules/dv2-data-split-discipline-activated.md`), i.e.
/// a statistics satellite fed at the membrane — NOT an ambient counter read off a
/// wall clock, which would reintroduce exactly the leak this module avoids. That
/// makes the stats phase-indexed and therefore DST-replayable, which a planner
/// built on wall-clock rates could never be.
///
/// HONEST LIMITS OF STAGE ONE (see the PR for the measurement):
///   * `zip` is planner-free in COST but not in MEMORY: an unbounded buffer grows
///     on whichever side runs faster. `zipBounded` makes the ceiling an explicit
///     caller choice and FAILS LOUDLY at it rather than growing silently. Picking
///     that number *for* the caller would need the arrival-rate statistic above —
///     which is precisely why it is the caller's number in stage one.
///   * `groupJoin`/`join` hold one entry per live element per side; occupancy is
///     data-dependent. Bounding it needs the window-occupancy statistic above.
///
/// REGISTER (`.claude/rules/toy-is-free-metered-must-be-earned.md`): `unmetered`.
/// Implemented and falsified by unit tests; never run against a real workload.
///
/// SUBSCRIPTION LIFETIME (this module must not falsify the claim in the file
/// header). Every inner subscription an operator makes — both sources, and for
/// `join`/`groupJoin` every per-element duration subscription — is registered in
/// a `CompositeDisposable` owned by the subscription this module handed back.
/// Disposing that one handle disposes all of them and completes every open
/// `groupJoin` window. So the header's sentence still holds unchanged: NOT
/// claimed "Rx can't leak"; claimed "our lifetimes are bounded above every
/// subscription."
///
/// References:
///   - Meijer. "Subject/Observer is Dual to Iterator". PLDI FIT 2010.
///   - Rx's `Join`/`GroupJoin` with duration selectors (Erik Meijer, Bart De Smet,
///     Wes Dyer; Rx.NET 2009-) — the classic declared-window join this mirrors.
///   - Selinger et al. "Access Path Selection in a Relational DBMS". SIGMOD 1979
///     — the statistics-driven planner that stage two is, and that this module
///     deliberately is not.
[<RequireQualifiedAccess>]
module RxJoin =

    /// A per-subscription serialized emitter.
    ///
    /// `Gate` is a monitor owned by ONE subscription and reachable from nowhere
    /// else — it is not the shared mutable state discipline #2 (lock/wait-free)
    /// forbids, it is the Rx grammar's serialization requirement for an operator
    /// with two independent sources. At DoP = 1 it is uncontended and every
    /// operator here reduces to a pure fold over the arrival sequence, which is
    /// what makes them DST-replayable.
    [<Sealed>]
    type private Sink<'O>(observer: IObserver<'O>) =
        let gate = obj ()
        let mutable stopped = false
        member _.Gate = gate
        member _.Next(v: 'O) = if not stopped then observer.OnNext v

        member _.Error(e: exn) =
            if not stopped then
                stopped <- true
                observer.OnError e

        member _.Completed() =
            if not stopped then
                stopped <- true
                observer.OnCompleted()

        /// Run `f` under the gate. An exception raised by `f` — including one
        /// thrown by a caller-supplied selector — becomes `OnError`, never a
        /// swallowed failure and never a throw back into the producer.
        member this.Guarded(f: unit -> unit) =
            lock gate (fun () ->
                if not stopped then
                    try
                        f ()
                    with e ->
                        this.Error e)

    let private observerOf (onNext: 'T -> unit) (onError: exn -> unit) (onCompleted: unit -> unit) =
        { new IObserver<'T> with
            member _.OnNext v = onNext v
            member _.OnError e = onError e
            member _.OnCompleted() = onCompleted () }

    let private observableOf (subscribe: IObserver<'O> -> IDisposable) =
        { new IObservable<'O> with
            member _.Subscribe observer = subscribe observer }

    /// The ONLY sanctioned way to build a time-based duration window for
    /// `join` / `groupJoin`. The scheduler is a required parameter and there is
    /// deliberately no overload that defaults it: `Observable.Timer(ts)` resolves
    /// against `Scheduler.Default`, which is a WALL CLOCK, and a wall-clock
    /// window puts local time inside a shared conclusion
    /// (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
    ///
    /// Pass a virtual/historical scheduler for DST replay; pass a real one only
    /// where the window steers a purely LOCAL action.
    let durationAfter (scheduler: IScheduler) (delay: TimeSpan) : IObservable<int64> =
        ArgumentNullException.ThrowIfNull scheduler
        Observable.Timer(delay, scheduler)

    /// Pair the *n*-th element of `left` with the *n*-th element of `right`.
    /// Arrival-index driven: no clock, no statistics, fully deterministic given
    /// the arrival sequence.
    ///
    /// `capacity` bounds the per-side buffer. Exceeding it is an `OnError`
    /// (`InvalidOperationException`), never a silent grow and never a silent
    /// drop — the caller declared the ceiling, so the caller hears about it.
    /// Completes as soon as one side is finished AND its buffer is drained,
    /// because no further pair can exist.
    let zipBounded
        (capacity: int)
        (left: IObservable<'L>)
        (right: IObservable<'R>)
        (selector: 'L -> 'R -> 'O)
        : IObservable<'O> =
        if capacity < 1 then
            invalidArg (nameof capacity) "capacity must be at least 1"

        ArgumentNullException.ThrowIfNull left
        ArgumentNullException.ThrowIfNull right
        ArgumentNullException.ThrowIfNull selector

        observableOf (fun observer ->
            let sink = Sink observer
            let lq = Queue<'L>()
            let rq = Queue<'R>()
            let mutable lDone = false
            let mutable rDone = false
            let group = new CompositeDisposable()

            let overflow (side: string) =
                InvalidOperationException(
                    String.Format(
                        CultureInfo.InvariantCulture,
                        "RxJoin.zipBounded: {0} buffer exceeded the caller-declared capacity of {1}. Sizing this automatically would need the arrival-rate statistic that stage-two planner joins collect.",
                        side,
                        capacity))

            let onLeft (l: 'L) =
                sink.Guarded (fun () ->
                    if rq.Count > 0 then
                        sink.Next(selector l (rq.Dequeue()))
                        if rDone && rq.Count = 0 then sink.Completed()
                    elif lq.Count >= capacity then
                        sink.Error(overflow "left")
                    else
                        lq.Enqueue l)

            let onRight (r: 'R) =
                sink.Guarded (fun () ->
                    if lq.Count > 0 then
                        sink.Next(selector (lq.Dequeue()) r)
                        if lDone && lq.Count = 0 then sink.Completed()
                    elif rq.Count >= capacity then
                        sink.Error(overflow "right")
                    else
                        rq.Enqueue r)

            let onError (e: exn) = sink.Guarded (fun () -> sink.Error e)

            group.Add(
                left.Subscribe(
                    observerOf onLeft onError (fun () ->
                        sink.Guarded (fun () ->
                            lDone <- true
                            if lq.Count = 0 then sink.Completed()))))

            group.Add(
                right.Subscribe(
                    observerOf onRight onError (fun () ->
                        sink.Guarded (fun () ->
                            rDone <- true
                            if rq.Count = 0 then sink.Completed()))))

            group :> IDisposable)

    /// `zipBounded` with no ceiling. Convenient, and honest about the cost: the
    /// faster side's buffer grows without bound. Prefer `zipBounded` anywhere the
    /// two rates are not known to match.
    let zip (left: IObservable<'L>) (right: IObservable<'R>) (selector: 'L -> 'R -> 'O) : IObservable<'O> =
        zipBounded Int32.MaxValue left right selector

    /// Emit on EITHER side, combining the newest value from each. Emits nothing
    /// until both sides have produced at least one value. One slot per side:
    /// O(1) state, no clock, no statistics.
    ///
    /// Completes when both sides complete — or early, when a side completes
    /// having never emitted, since no combination can then ever exist.
    let combineLatest
        (left: IObservable<'L>)
        (right: IObservable<'R>)
        (selector: 'L -> 'R -> 'O)
        : IObservable<'O> =
        ArgumentNullException.ThrowIfNull left
        ArgumentNullException.ThrowIfNull right
        ArgumentNullException.ThrowIfNull selector

        observableOf (fun observer ->
            let sink = Sink observer
            let mutable lv = Unchecked.defaultof<'L>
            let mutable rv = Unchecked.defaultof<'R>
            let mutable hasL = false
            let mutable hasR = false
            let mutable lDone = false
            let mutable rDone = false
            let group = new CompositeDisposable()

            let emit () = if hasL && hasR then sink.Next(selector lv rv)
            let onError (e: exn) = sink.Guarded (fun () -> sink.Error e)

            group.Add(
                left.Subscribe(
                    observerOf
                        (fun l ->
                            sink.Guarded (fun () ->
                                lv <- l
                                hasL <- true
                                emit ()))
                        onError
                        (fun () ->
                            sink.Guarded (fun () ->
                                lDone <- true
                                if not hasL || rDone then sink.Completed()))))

            group.Add(
                right.Subscribe(
                    observerOf
                        (fun r ->
                            sink.Guarded (fun () ->
                                rv <- r
                                hasR <- true
                                emit ()))
                        onError
                        (fun () ->
                            sink.Guarded (fun () ->
                                rDone <- true
                                if not hasR || lDone then sink.Completed()))))

            group :> IDisposable)

    /// Emit on the LEFT only, sampling the right's most recent value. A left
    /// element arriving before the right has ever emitted is DROPPED — that is
    /// the operator's definition, not a failure.
    ///
    /// This is the asymmetric one, and the asymmetry is the whole point: reach
    /// for it when the right stream is a *reference* the left is stamped with,
    /// and for anything else you probably want `combineLatest`. Completes when
    /// the LEFT completes; the right completing is not a terminal event here,
    /// because the right's last value stays valid for later left elements.
    let withLatestFrom
        (left: IObservable<'L>)
        (right: IObservable<'R>)
        (selector: 'L -> 'R -> 'O)
        : IObservable<'O> =
        ArgumentNullException.ThrowIfNull left
        ArgumentNullException.ThrowIfNull right
        ArgumentNullException.ThrowIfNull selector

        observableOf (fun observer ->
            let sink = Sink observer
            let mutable rv = Unchecked.defaultof<'R>
            let mutable hasR = false
            let group = new CompositeDisposable()
            let onError (e: exn) = sink.Guarded (fun () -> sink.Error e)

            group.Add(
                right.Subscribe(
                    observerOf
                        (fun r ->
                            sink.Guarded (fun () ->
                                rv <- r
                                hasR <- true))
                        onError
                        ignore))

            group.Add(
                left.Subscribe(
                    observerOf
                        (fun l -> sink.Guarded (fun () -> if hasR then sink.Next(selector l rv)))
                        onError
                        (fun () -> sink.Guarded sink.Completed)))

            group :> IDisposable)

    /// Rx's classic `GroupJoin`: for each LEFT element emit
    /// `selector left window`, where `window` carries every RIGHT element alive
    /// while that left element is alive.
    ///
    /// Both lifetimes are declared by the CALLER as duration observables — a
    /// window closes on the duration's first `OnNext` or its `OnCompleted`. That
    /// declaration is what makes this planner-free: the operator never infers a
    /// window and never reads a clock to close one. Use `durationAfter` if the
    /// window is time-shaped, so the scheduler stays injected.
    ///
    /// Completes when the LEFT completes. The right completing is not terminal —
    /// already-open windows remain open until their durations close them, and
    /// disposing the returned subscription completes every one of them.
    let groupJoin
        (left: IObservable<'L>)
        (right: IObservable<'R>)
        (leftDuration: 'L -> IObservable<'LD>)
        (rightDuration: 'R -> IObservable<'RD>)
        (selector: 'L -> IObservable<'R> -> 'O)
        : IObservable<'O> =
        ArgumentNullException.ThrowIfNull left
        ArgumentNullException.ThrowIfNull right
        ArgumentNullException.ThrowIfNull leftDuration
        ArgumentNullException.ThrowIfNull rightDuration
        ArgumentNullException.ThrowIfNull selector

        observableOf (fun observer ->
            let sink = Sink observer
            let group = new CompositeDisposable()
            let windows = Dictionary<int, Subject<'R>>()
            let rights = Dictionary<int, 'R>()
            let mutable nextId = 0
            let mutable torndown = false
            let onError (e: exn) = sink.Guarded (fun () -> sink.Error e)

            let onLeft (l: 'L) =
                sink.Guarded (fun () ->
                    let id = nextId
                    nextId <- nextId + 1
                    let w = new Subject<'R>()
                    windows[id] <- w
                    let dsub = new SingleAssignmentDisposable()
                    group.Add dsub

                    let expire () =
                        lock sink.Gate (fun () ->
                            match windows.TryGetValue id with
                            | true, s ->
                                windows.Remove id |> ignore
                                s.OnCompleted()
                                s.Dispose()
                            | _ -> ())

                        group.Remove dsub |> ignore

                    dsub.Disposable <- (leftDuration l).Subscribe(observerOf (fun _ -> expire ()) onError expire)
                    sink.Next(selector l (w.AsObservable()))
                    // A duration that fired synchronously already closed this
                    // window; a zero-length window matches nothing, so re-check.
                    if windows.ContainsKey id then
                        for r in Array.ofSeq rights.Values do
                            w.OnNext r)

            let onRight (r: 'R) =
                sink.Guarded (fun () ->
                    let id = nextId
                    nextId <- nextId + 1
                    rights[id] <- r
                    let dsub = new SingleAssignmentDisposable()
                    group.Add dsub

                    let expire () =
                        lock sink.Gate (fun () -> rights.Remove id |> ignore)
                        group.Remove dsub |> ignore

                    dsub.Disposable <- (rightDuration r).Subscribe(observerOf (fun _ -> expire ()) onError expire)

                    if rights.ContainsKey id then
                        for w in Array.ofSeq windows.Values do
                            w.OnNext r)

            group.Add(left.Subscribe(observerOf onLeft onError (fun () -> sink.Guarded sink.Completed)))
            group.Add(right.Subscribe(observerOf onRight onError ignore))

            { new IDisposable with
                member _.Dispose() =
                    lock sink.Gate (fun () ->
                        if not torndown then
                            torndown <- true
                            // Bound every window's lifetime above by THIS handle:
                            // the file header's claim depends on this loop.
                            for w in Array.ofSeq windows.Values do
                                w.OnCompleted()
                                w.Dispose()

                            windows.Clear()
                            rights.Clear())

                    group.Dispose() })

    /// Rx's classic `Join`: emit `selector l r` for every pair whose declared
    /// lifetimes overlap. Same planner-free property as `groupJoin` and the same
    /// caller-declared windows; this is the flattened form.
    ///
    /// Completes when one side has completed and either the other side has too
    /// or that side has no live elements left — at which point no further pair
    /// can be produced.
    let join
        (left: IObservable<'L>)
        (right: IObservable<'R>)
        (leftDuration: 'L -> IObservable<'LD>)
        (rightDuration: 'R -> IObservable<'RD>)
        (selector: 'L -> 'R -> 'O)
        : IObservable<'O> =
        ArgumentNullException.ThrowIfNull left
        ArgumentNullException.ThrowIfNull right
        ArgumentNullException.ThrowIfNull leftDuration
        ArgumentNullException.ThrowIfNull rightDuration
        ArgumentNullException.ThrowIfNull selector

        observableOf (fun observer ->
            let sink = Sink observer
            let group = new CompositeDisposable()
            let lmap = Dictionary<int, 'L>()
            let rmap = Dictionary<int, 'R>()
            let mutable nextId = 0
            let mutable lDone = false
            let mutable rDone = false
            let onError (e: exn) = sink.Guarded (fun () -> sink.Error e)

            let onLeft (l: 'L) =
                sink.Guarded (fun () ->
                    let id = nextId
                    nextId <- nextId + 1
                    lmap[id] <- l
                    let dsub = new SingleAssignmentDisposable()
                    group.Add dsub

                    let expire () =
                        lock sink.Gate (fun () -> lmap.Remove id |> ignore)
                        group.Remove dsub |> ignore

                    dsub.Disposable <- (leftDuration l).Subscribe(observerOf (fun _ -> expire ()) onError expire)

                    if lmap.ContainsKey id then
                        for r in Array.ofSeq rmap.Values do
                            sink.Next(selector l r))

            let onRight (r: 'R) =
                sink.Guarded (fun () ->
                    let id = nextId
                    nextId <- nextId + 1
                    rmap[id] <- r
                    let dsub = new SingleAssignmentDisposable()
                    group.Add dsub

                    let expire () =
                        lock sink.Gate (fun () -> rmap.Remove id |> ignore)
                        group.Remove dsub |> ignore

                    dsub.Disposable <- (rightDuration r).Subscribe(observerOf (fun _ -> expire ()) onError expire)

                    if rmap.ContainsKey id then
                        for l in Array.ofSeq lmap.Values do
                            sink.Next(selector l r))

            group.Add(
                left.Subscribe(
                    observerOf onLeft onError (fun () ->
                        sink.Guarded (fun () ->
                            lDone <- true
                            if rDone || lmap.Count = 0 then sink.Completed()))))

            group.Add(
                right.Subscribe(
                    observerOf onRight onError (fun () ->
                        sink.Guarded (fun () ->
                            rDone <- true
                            if lDone || rmap.Count = 0 then sink.Completed()))))

            group :> IDisposable)
