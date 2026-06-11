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

[<Fact>]
let ``the hard register is the k->infinity limit: admitHard is the step function the gradient approaches`` () =
    Assert.True(SoftThrottle.admitHard 0.5)
    Assert.False(SoftThrottle.admitHard 1.0)
    Assert.False(SoftThrottle.admitHard 2.0)
    // the soft gradient approaches the step as k grows (sub-nominal -> 1; super-nominal -> 0)
    Assert.True(SoftThrottle.admissionProbability 1000.0 0.9 > 0.999)
    Assert.True(SoftThrottle.admissionProbability 1000.0 1.1 < 0.001)

[<Fact>]
let ``boatBytes: the boat is funded in BYTES by the tank — zero-wait, takes the affordable prefix`` () =
    let items = [ "aaaa"; "bb"; "cccccc"; "d" ] // sizes 4,2,6,1
    let sizeOf (s: string) = s.Length
    // tank holds 7 bytes: funds "aaaa"(4) + "bb"(2) = 6; "cccccc"(6) doesn't fit => stop instantly
    let boat, rest, t' = SoftThrottle.boatBytes sizeOf items (SoftThrottle.tank 7.0 1.0)
    Assert.Equal<string list>([ "aaaa"; "bb" ], boat)
    Assert.Equal<string list>([ "cccccc"; "d" ], rest)
    Assert.Equal(1.0, SoftThrottle.available t', 12) // 7 - 6 = 1 byte left

[<Fact>]
let ``boatBytes: charging the tank lets the next boat carry the rest (the future metered in bytes)`` () =
    let sizeOf (s: string) = s.Length
    let _, rest, t1 = SoftThrottle.boatBytes sizeOf [ "aaaa"; "bb"; "cccccc" ] (SoftThrottle.tank 6.0 3.0)
    let t2 = t1 |> SoftThrottle.charge |> SoftThrottle.charge // bank capacity while idle
    let boat2, rest2, _ = SoftThrottle.boatBytes sizeOf rest t2
    Assert.Equal<string list>([ "cccccc" ], boat2)
    Assert.Empty(rest2)

[<Fact>]
let ``the limiter is Aaron's Itron fold: countLimiter boards exactly batchSize (state < n, state+1 verbatim)`` () =
    let b, rest, n = SoftThrottle.boat (SoftThrottle.countLimiter 3) [ 1; 2; 3; 4; 5 ] 0
    Assert.Equal<int list>([ 1; 2; 3 ], b)
    Assert.Equal<int list>([ 4; 5 ], rest)
    Assert.Equal(3, n) // state advanced once per BOARDED item (0->1->2->3); the refusal probe's state is discarded
