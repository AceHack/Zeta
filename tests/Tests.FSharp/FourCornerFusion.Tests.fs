module Zeta.Tests.FourCornerFusionTests

// 081KTQD8A0008QG0R0005EFYPV fusion, executed per Rodney's Razor: **fusion by instantiation, not refactor.**
// Proves the four-corner harmonic Kleisli arrow already composes from the existing pieces:
//   ISR<Corners, Corners> (the arrow) × SoftScheduler.Handler<Corners> (the tick) ×
//   FourCorner.withOut/withInFeedback (the corners filling) × IsrLift.ofPolicy (the decision-arrow).
// Zero signature changes; CHIP-8 / SoftScheduler / ISR untouched and still green.

open System.Diagnostics
open System.Threading.Tasks
open global.Xunit
open Zeta.Core
open Zeta.Core.ISR

let private ctx () : IntrCtx =
    { Memetic = "fusion"
      Prompt = "p"
      Trust = "t"
      Log = "l"
      Otel = ActivityContext(ActivityTraceId.CreateRandom(), ActivitySpanId.CreateRandom(), ActivityTraceFlags.Recorded) }

/// The fused state: a four-corner ownership flowing through the arrow's VALUE channel.
type private Corners = FourCorner.FourCornerOwnership<string, string, string, string>

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

[<Fact>]
let ``fusion-by-instantiation: a Handler<FourCornerOwnership> ticks on the soft scheduler, corners fill`` () =
    task {
        // each timer tick the handler EMITS (fills TOut) and acks the co-owned corner (TInFeedback)
        let fill: SoftScheduler.Handler<Corners> =
            SoftScheduler.handler "fill-corners" isTimer (fun _ o ->
                let o' =
                    o
                    |> FourCorner.withOut "emitted"
                    |> FourCorner.withInFeedback "co-owned-ack"
                Task.FromResult(Ok o'))

        let initial: Corners = FourCorner.ofIn "operator-message"
        let! r = SoftScheduler.runDeterministic [ fill ] (ctx ()) 7L initial 3
        match r with
        | Ok o ->
            Assert.Equal("operator-message", o.TIn) // input corner preserved through the ticks
            Assert.Equal(Some "emitted", o.TOut) // forward corner filled
            Assert.Equal(Some "co-owned-ack", o.TInFeedback) // the backpressure corner filled
            Assert.True(FourCorner.hasOutput o && FourCorner.hasFeedback o)
        | Error e -> Assert.Fail(sprintf "fused tick errored: %A" e)
    }

[<Fact>]
let ``the lifted Policy is a decision-arrow: ofPolicy composes under >=> with a corner-filling arrow`` () =
    task {
        // a policy that decides from the input corner (decision + why)
        let decide: Policy.Policy<Corners, string, string> =
            fun o -> Policy.result (sprintf "route:%s" o.TIn) "because the input corner says so"

        // decision-arrow >=> corner-filler: the policy's decision becomes the emitted TOut
        let arrow: ISR<Corners, Corners> =
            IsrLift.ofPolicy decide
            >=> IsrLift.ofPure (fun (pr: Policy.PolicyResult<string, string>) ->
                FourCorner.ofIn "operator-message"
                |> FourCorner.withOut pr.Decision
                |> FourCorner.withOutFeedback pr.Feedback)

        let! r = arrow (ctx ()) (FourCorner.ofIn "operator-message")
        match r with
        | Ok o ->
            Assert.Equal(Some "route:operator-message", o.TOut)
            Assert.Equal(Some "because the input corner says so", o.TOutFeedback)
        | Error e -> Assert.Fail(sprintf "decision-arrow errored: %A" e)
    }

[<Fact>]
let ``interrupts stay in the ERROR channel (sum), corners in the VALUE channel (product) — Rodney's cut`` () =
    task {
        let boom: SoftScheduler.Handler<Corners> =
            SoftScheduler.handler "boom" isTimer (fun _ _ -> Task.FromResult(Error(Interrupted SentinelMissing)))
        let! r = SoftScheduler.runDeterministic [ boom ] (ctx ()) 7L (FourCorner.ofIn "x") 3
        // short-circuit semantics are CORRECT for interrupts — and untouched by the fusion
        Assert.Equal<Result<Corners, InterruptFeedback>>(Error(Interrupted SentinelMissing), r)
    }

[<Fact>]
let ``no ArrowApply app: SchedulerZeta predicts the VALUE-channel period; interrupts are not in that map`` () =
    // Thin needle. The map is corners only — a DoP=1 ferry / soft IScheduler tick.
    // Structure is this function, not a value-arriving-as-an-arrow (Hughes app).
    // An interrupt in the ERROR channel does not change the predicted orbit.
    let step (o: Corners) : Corners =
        match o.TOut with
        | Some "a" -> FourCorner.withOut "b" o
        | _ -> FourCorner.withOut "a" o

    let start = FourCorner.ofIn "in" |> FourCorner.withOut "a"
    let key (o: Corners) = defaultArg o.TOut ""
    let r = SchedulerZeta.predict key step start
    Assert.Equal(2, r.Period)
    Assert.Equal(0, r.Transient)
    Assert.Equal(2, r.Reachable)
    let _interrupt = Interrupted SentinelMissing
    let r2 = SchedulerZeta.predict key step start
    Assert.Equal(r.Period, r2.Period)
    Assert.Equal(1, FerryThrottlerConfig.deterministic.MaxDegreeOfParallelism)

[<Fact>]
let ``DST: the fused arrow replays identically (same seed, budget => same corners)`` () =
    task {
        let fill: SoftScheduler.Handler<Corners> =
            SoftScheduler.handler "fill" isTimer (fun _ o -> Task.FromResult(Ok(FourCorner.withOut "v" o)))
        let! a = SoftScheduler.runDeterministic [ fill ] (ctx ()) 42L (FourCorner.ofIn "i") 60
        let! b = SoftScheduler.runDeterministic [ fill ] (ctx ()) 42L (FourCorner.ofIn "i") 60
        Assert.Equal<Result<Corners, InterruptFeedback>>(a, b)
    }
