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
        let pump () =
            task {
                try
                    while not cts.IsCancellationRequested do
                        do! circuit.StepAsync cts.Token
                        subject.OnNext handle.Current
                    subject.OnCompleted()
                with
                | :? OperationCanceledException ->
                    subject.OnCompleted()
                | ex ->
                    subject.OnError ex
            } |> ignore
        pump ()
        { new IObservable<'T> with
            member _.Subscribe observer =
                let d = subject.Subscribe observer
                { new IDisposable with
                    member _.Dispose() =
                        d.Dispose()
                        cts.Cancel()
                        cts.Dispose()
                        subject.Dispose() } }

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
