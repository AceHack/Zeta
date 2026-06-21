namespace Zeta.Core

open System
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
