module Zeta.Tests.SoftThrottleTests

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

let private ctx () : IntrCtx =
    { Memetic = "t"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

[<Fact>]
let ``admission is a smooth gradient: ~1 when idle, exactly half at nominal, low when overloaded — never a wall`` () =
    Assert.True(SoftThrottle.admissionProbability 8.0 0.0 > 0.99)
    Assert.Equal(0.5, SoftThrottle.admissionProbability 8.0 1.0, 12)
    let p3 = SoftThrottle.admissionProbability 8.0 3.0
    Assert.True(p3 < 0.01 && p3 > 0.0) // soft: small, never zero

[<Fact>]
let ``admit is deterministic (DST) and its rate tracks the probability`` () =
    let admitted pressure =
        [ 0..999 ] |> List.filter (fun t -> SoftThrottle.admit 8.0 42L t pressure) |> List.length
    Assert.Equal(admitted 0.5, admitted 0.5) // replay-equal
    Assert.True(admitted 0.2 > 900) // near-idle ⇒ nearly all
    Assert.True(admitted 2.0 < 100) // overloaded ⇒ few
    let half = admitted 1.0
    Assert.True(half > 400 && half < 600) // ≈ p=0.5

[<Fact>]
let ``the tank charges while idle, funds bursts, and offers a sip instead of a wall when low`` () =
    let t = SoftThrottle.tank 10.0 2.0
    Assert.Equal(10.0, SoftThrottle.available t, 12) // starts charged
    match SoftThrottle.discharge 7.0 t with
    | Some t' ->
        Assert.Equal(3.0, SoftThrottle.available t', 12)
        Assert.True((SoftThrottle.discharge 7.0 t').IsNone) // can't fund another 7
        let charged = SoftThrottle.charge t'
        Assert.Equal(5.0, SoftThrottle.available charged, 12) // +2 per idle tick, capped at 10 later
    | None -> Assert.Fail "tank should fund the first burst"

[<Fact>]
let ``step serves, sips, or charges — and replays identically`` () =
    let run () =
        let mutable t = SoftThrottle.tank 5.0 1.0
        let mutable served = []
        for tick in 0..19 do
            let s, t' = SoftThrottle.step 8.0 7L tick 0.5 2.0 t
            served <- served @ [ s ]
            t <- t'
        served
    Assert.Equal<float list>(run (), run ()) // DST
    Assert.True(run () |> List.sum > 0.0) // it actually serves under mild pressure

[<Fact>]
let ``scheduler tie-in: a wrapped handler runs throttled — admitted ticks served, the rest softly skipped`` () =
    task {
        let inner: SoftScheduler.Handler<int> =
            SoftScheduler.handler "count" isTimer (fun _ n -> Task.FromResult(Ok(n + 1)))
        // heavy pressure ⇒ most arrivals softly skipped; tank ample so the gradient is the limiter
        let wrapped = SoftThrottle.wrapHandler 8.0 42L 1.0 (fun _ -> 2.0) inner
        let initial = SoftThrottle.throttled 0 (SoftThrottle.tank 1000.0 1.0)
        let! r = SoftScheduler.runDeterministic [ wrapped ] (ctx ()) 42L initial 100
        match r with
        | Ok st ->
            Assert.Equal(st.Served, st.Inner) // inner ran exactly when served
            Assert.Equal(100, st.Served + st.Skipped) // every arrival accounted (timer fires each tick)
            Assert.True(st.Skipped > st.Served) // overloaded ⇒ mostly soft skips
        | Error e -> Assert.Fail(sprintf "throttled run errored: %A" e)
    }

[<Fact>]
let ``scheduler tie-in DST: the throttled run replays identically`` () =
    task {
        let inner: SoftScheduler.Handler<int> =
            SoftScheduler.handler "count" isTimer (fun _ n -> Task.FromResult(Ok(n + 1)))
        let mk () =
            SoftScheduler.runDeterministic
                [ SoftThrottle.wrapHandler 8.0 9L 1.0 (fun _ -> 1.0) inner ]
                (ctx ())
                9L
                (SoftThrottle.throttled 0 (SoftThrottle.tank 50.0 0.5))
                60
        let! a = mk ()
        let! b = mk ()
        Assert.Equal<Result<SoftThrottle.Throttled<int>, InterruptFeedback>>(a, b)
    }
