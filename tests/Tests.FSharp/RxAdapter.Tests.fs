module Zeta.Tests.RxAdapterTests

// B-1036 rung 3 falsifiers: the no-subscription-leak claim is MECHANICAL, not a convention.
// The one push surface in Core (RxAdapter) ties every subscription's lifetime to the whole
// pipeline's lifetime — disposing the handle cancels the pump, completes the stream, and
// disposes the subject (a dead pipeline REFUSES new subscribers rather than leaking a live one).

open System
open System.Threading
open global.Xunit
open Zeta.Core

let private identityCircuit () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let out = c.Output input.Stream
    input.Send(ZSet.singleton 1 1L)
    c, out

[<Fact>]
let ``bounded pipeline completes after exactly count ticks and delivers count notifications`` () =
    let c, out = identityCircuit ()
    let observable = RxAdapter.asObservableForCount c out 3
    let mutable received = 0
    use completed = new ManualResetEventSlim(false)
    use _sub =
        observable.Subscribe(
            { new IObserver<_> with
                member _.OnNext _ = Interlocked.Increment &received |> ignore
                member _.OnCompleted() = completed.Set()
                member _.OnError e = raise e })
    Assert.True(completed.Wait(TimeSpan.FromSeconds 10.0), "pipeline must complete")
    Assert.Equal(3, received)

[<Fact>]
let ``TEARDOWN IS REAL: disposing the one handle stops notifications — the count stops moving`` () =
    let c, out = identityCircuit ()
    let observable = RxAdapter.asObservable c out CancellationToken.None
    let mutable received = 0
    let sub =
        observable.Subscribe(
            { new IObserver<_> with
                member _.OnNext _ = Interlocked.Increment &received |> ignore
                member _.OnCompleted() = ()
                member _.OnError _ = () })
    // let the pump deliver something, then tear down the room
    SpinWait.SpinUntil((fun () -> Volatile.Read &received > 0), TimeSpan.FromSeconds 10.0) |> ignore
    sub.Dispose()
    let atDispose = Volatile.Read &received
    // in-flight ticks may land immediately around the dispose; the LAW is that the count STOPS
    Thread.Sleep 150
    let afterGrace = Volatile.Read &received
    Thread.Sleep 150
    Assert.Equal(afterGrace, Volatile.Read &received)
    Assert.True(afterGrace >= atDispose)

[<Fact>]
let ``A DEAD PIPELINE REFUSES NEW SUBSCRIBERS: after teardown the subject is disposed, not leaked`` () =
    let c, out = identityCircuit ()
    let observable = RxAdapter.asObservable c out CancellationToken.None
    let sub = observable.Subscribe({ new IObserver<_> with
                                       member _.OnNext _ = ()
                                       member _.OnCompleted() = ()
                                       member _.OnError _ = () })
    sub.Dispose()
    Assert.Throws<ObjectDisposedException>(fun () ->
        observable.Subscribe({ new IObserver<_> with
                                 member _.OnNext _ = ()
                                 member _.OnCompleted() = ()
                                 member _.OnError _ = () })
        |> ignore)
    |> ignore
