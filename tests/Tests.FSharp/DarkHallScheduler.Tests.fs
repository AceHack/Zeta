module Zeta.Tests.DarkHallSchedulerTests

open System.Diagnostics
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

module Runtime = DarkHallCabinetRuntime
module RoomLoop = DarkHallRoomLoop
module Scheduler = DarkHallScheduler

let private ctx () : IntrCtx =
    { Memetic = "darkhall-scheduler"
      Prompt = ""
      Trust = ""
      Log = ""
      Otel = ActivityContext() }

let private chooseById id (readout: Runtime.ControllerReadout) : RoomLoop.ControllerChoice =
    let cell =
        GridBinding.bound readout.Grid
        |> List.tryFind (fun (_, action) -> action.Id = id)
        |> Option.map fst
        |> Option.defaultValue -1

    { Cell = cell
      Tier = RoomLoop.ChoiceTier.Operator
      Confidence = 1.0
      Reason = "test-selected action id" }

let private timer =
    function
    | TimerElapsed _ -> true
    | _ -> false

[<Fact>]
let ``heat boundary rows render as a host visible CHIP-9 board`` () =
    let row: Scheduler.HeatBoundaryRow =
        { Tick = 7
          RoomName = "darkhall"
          HeatRejected = 2
          Backpressured = 1
          StorageErrors = 1
          HeatKinds = [ "darkhall.machine.denied"; "meta-cart.policy-backpressure" ]
          Reasons = [ "capacity=1"; "child launch denied" ] }

    let frame = Scheduler.heatBoardFrame 99UL [ row ]

    Assert.Equal(7uy, frame.Plane)
    Assert.Equal(1uy, Chip8Cow.colorAt 0 0 frame)
    Assert.Equal(1uy, Chip8Cow.colorAt 1 0 frame)
    Assert.Equal(0uy, Chip8Cow.colorAt 2 0 frame)
    Assert.Equal(3uy, Chip8Cow.colorAt 16 0 frame)
    Assert.Equal(0uy, Chip8Cow.colorAt 17 0 frame)
    Assert.Equal(5uy, Chip8Cow.colorAt 32 0 frame)
    Assert.Equal(0uy, Chip8Cow.colorAt 33 0 frame)
    Assert.Equal(4uy, Chip8Cow.colorAt 48 0 frame)
    Assert.Equal(4uy, Chip8Cow.colorAt 49 0 frame)
    Assert.Equal(0uy, Chip8Cow.colorAt 50 0 frame)

    let rendered = Scheduler.renderHeatBoard 99UL [ row ]
    let firstDisplayRow = rendered.[1]

    Assert.Equal("plane\t7", rendered.[0])
    Assert.Equal("11", firstDisplayRow.Substring(0, 2))
    Assert.Equal("0", firstDisplayRow.Substring(2, 1))
    Assert.Equal("3", firstDisplayRow.Substring(16, 1))
    Assert.Equal("0", firstDisplayRow.Substring(17, 1))
    Assert.Equal("5", firstDisplayRow.Substring(32, 1))
    Assert.Equal("0", firstDisplayRow.Substring(33, 1))
    Assert.Equal("44", firstDisplayRow.Substring(48, 2))
    Assert.Equal("0", firstDisplayRow.Substring(50, 1))

[<Fact>]
let ``soft scheduler banks darkhall heat backpressure as a room boundary row`` () =
    task {
        let sink =
            BoundedHeatSink
                { Capacity = 1
                  ForgetPolicy = BoundedGSetForgetPolicy.RejectNew }

        let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"

        match (sink :> IHeatSink).Emit filler with
        | Error feedback -> Assert.Fail(sprintf "expected heat sink prefill, got %A" feedback)
        | Ok() -> ()

        let child = CartFixtures.cart CartFixtures.chip9GreenDot
        let caps = MetaCart.capabilityMap [ child, CartFixtures.chip9GreenDot.Capabilities ]

        let launch: Runtime.MetaCartLaunch =
            { Goal = 3
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.chip8Default
              ChildCapabilitiesBySha = caps
              Children = [ child ]
              Parent = Chip8Cow.create 1UL }

        let requestFor (action: Runtime.CabinetAction) =
            if action.Id = "darkhall.play.meta-cart-host" then
                Some(Runtime.RunMetaCart launch)
            else
                None

        let handler =
            Scheduler.roomTickHandler
                "darkhall-room"
                timer
                "darkhall-scheduler"
                (sink :> IHeatSink)
                requestFor
                (chooseById "darkhall.play.meta-cart-host")

        let source _ = [ TimerElapsed 17 ]
        let initial = Scheduler.initial Arcade.room Chip9Capabilities.chip8Default
        let! result = (SoftScheduler.driveK [ handler ] source).Run(ctx ()) 42L initial 1

        match result with
        | Error feedback -> Assert.Fail(sprintf "heat backpressure should stay in the room readout, got %A" feedback)
        | Ok final ->
            Assert.Equal(1, final.CompletedTicks)
            Assert.True(Scheduler.backpressured final)

            match final.LastTick with
            | None -> Assert.Fail "scheduler should bank the last room tick"
            | Some tick ->
                match tick.Result with
                | Error(RoomLoop.TickFeedback.RuntimeFeedback(Runtime.Feedback.HeatRejected _)) -> ()
                | other -> Assert.Fail(sprintf "expected room tick heat rejection, got %A" other)

            match Scheduler.lastHeatRow final with
            | None -> Assert.Fail "scheduler should expose the latest heat row"
            | Some row ->
                Assert.Equal(1, row.Tick)
                Assert.Equal("darkhall", row.RoomName)
                Assert.Equal(1, row.HeatRejected)
                Assert.Equal(1, row.Backpressured)
                Assert.Equal(0, row.StorageErrors)
                Assert.Equal<string list>([ "darkhall.machine.denied" ], row.HeatKinds)
                Assert.Contains("capacity=1", System.String.Join(";", row.Reasons))

            match Scheduler.heatRows final with
            | [ row ] -> Assert.Equal(1, row.Backpressured)
            | rows -> Assert.Fail(sprintf "expected one scheduler heat row, got %A" rows)
    }

[<Fact>]
let ``heat board sim loop measures backpressure before the cut closes`` () =
    task {
        let sink =
            BoundedHeatSink
                { Capacity = 1
                  ForgetPolicy = BoundedGSetForgetPolicy.RejectNew }

        let filler = HeatSignature.ofMass "test" "heat.fill" 1 1.0 "occupy bounded heat sink"

        match (sink :> IHeatSink).Emit filler with
        | Error feedback -> Assert.Fail(sprintf "expected heat sink prefill, got %A" feedback)
        | Ok() -> ()

        let child = CartFixtures.cart CartFixtures.chip9GreenDot
        let caps = MetaCart.capabilityMap [ child, CartFixtures.chip9GreenDot.Capabilities ]

        let launch: Runtime.MetaCartLaunch =
            { Goal = 3
              Seed = 1UL
              ParentCapabilities = Chip9Capabilities.chip8Default
              ChildCapabilitiesBySha = caps
              Children = [ child ]
              Parent = Chip8Cow.create 1UL }

        let requestFor (action: Runtime.CabinetAction) =
            if action.Id = "darkhall.play.meta-cart-host" then
                Some(Runtime.RunMetaCart launch)
            else
                None

        let budget: SimLoop.Budget =
            { MaxLaps = 4
              MaxTicks = 4
              MaxMillis = 1_000L }

        let! outcome =
            Scheduler.heatBoardSimLoop
                "darkhall-heat-board"
                Arcade.room
                Chip9Capabilities.chip8Default
                timer
                "darkhall-simloop"
                (sink :> IHeatSink)
                requestFor
                (chooseById "darkhall.play.meta-cart-host")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                budget
                (ctx ())
                42L
                1
                (fun _ state -> not (Scheduler.backpressured state))

        match outcome.Stopped with
        | SimLoop.Stopped.CutChoseClose -> ()
        | other -> Assert.Fail(sprintf "expected heat-board cut to close the loop, got %A" other)

        Assert.True(Scheduler.continueHeatBoardAfter "darkhall-heat-board" outcome |> Option.isNone)

        match outcome.Laps with
        | [ lap ] ->
            Assert.Equal(1, lap.State.CompletedTicks)
            Assert.True(Scheduler.backpressured lap.State)

            let firstDisplayRow = lap.Measured.[1]

            Assert.Equal("1", firstDisplayRow.Substring(0, 1))
            Assert.Equal("3", firstDisplayRow.Substring(16, 1))
            Assert.Equal("4", firstDisplayRow.Substring(48, 1))
        | laps -> Assert.Fail(sprintf "expected one measured lap before cut, got %A" laps)
    }

[<Fact>]
let ``budget stopped heat board sim loop mints a continuation token`` () =
    task {
        let budget: SimLoop.Budget =
            { MaxLaps = 2
              MaxTicks = 16
              MaxMillis = 1_000L }

        let! outcome =
            Scheduler.heatBoardSimLoop
                "darkhall-heat-board"
                Arcade.room
                Chip9Capabilities.chip8Default
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                budget
                (ctx ())
                42L
                1
                (fun _ _ -> true)

        Assert.Equal(SimLoop.Stopped.LapBudget, outcome.Stopped)
        Assert.Equal(2, outcome.Final.CompletedTicks)

        let expectedPointer = "saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board"
        Assert.Equal(expectedPointer, Scheduler.heatBoardStatePointer "darkhall-heat-board" outcome)

        match Scheduler.continueHeatBoardAfter "darkhall-heat-board" outcome with
        | None -> Assert.Fail "budget-stopped heat-board loops should schedule a continuation"
        | Some token ->
            Assert.Equal("darkhall-heat-board", token.LoopId)
            Assert.Equal(2, token.NextLap)
            Assert.Equal(2, token.TicksSpent)
            Assert.Equal(expectedPointer, token.StatePointer)

            let encoded = SimLoop.encodeContinuation token
            Assert.Equal(Some token, SimLoop.parseContinuation encoded)
            Assert.Equal(Some encoded, Scheduler.encodeHeatBoardContinuation "darkhall-heat-board" outcome)

            match Scheduler.admitHeatBoardContinuation "darkhall-heat-board" 3 encoded with
            | Error feedback -> Assert.Fail(sprintf "expected heat-board continuation admission, got %A" feedback)
            | Ok admission ->
                Assert.Equal(token, admission.Token)
                Assert.Equal(expectedPointer, admission.StatePointer)
                Assert.Equal(6, admission.ResumeBaseTick)

                let resumed = Scheduler.resumeHeatBoardSource admission (fun tick -> [ TimerElapsed tick ])
                Assert.Equal<InterruptKind list>([ TimerElapsed 11 ], resumed 5)

        match Scheduler.continueHeatBoardAfter "" outcome with
        | None -> Assert.Fail "empty loop ids should normalize into a parseable continuation"
        | Some token ->
            Assert.Equal("darkhall", token.LoopId)
            Assert.Equal("saves/darkhall/darkhall/lap-2-tick-2.heat-board", token.StatePointer)
            Assert.Equal(Some token, SimLoop.parseContinuation (SimLoop.encodeContinuation token))

        match Scheduler.continueHeatBoardAfter "darkhall:heat/board" outcome with
        | None -> Assert.Fail "unsafe loop ids should normalize into a parseable continuation"
        | Some token ->
            Assert.Equal("darkhall-heat-board", token.LoopId)
            Assert.Equal("saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board", token.StatePointer)
            Assert.Equal(Some token, SimLoop.parseContinuation (SimLoop.encodeContinuation token))
    }

[<Fact>]
let ``heat board continuation admission refuses malformed and foreign spawn tokens`` () =
    let admit = Scheduler.admitHeatBoardContinuation "darkhall-heat-board" 2

    match admit "not-a-spawn-token" with
    | Error(Scheduler.HeatBoardContinuationFeedback.MalformedContinuation token) ->
        Assert.Equal("not-a-spawn-token", token)
    | other -> Assert.Fail(sprintf "expected malformed token refusal, got %A" other)

    match admit "spawn:other-loop:2:2:saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board" with
    | Error(Scheduler.HeatBoardContinuationFeedback.LoopIdMismatch(expected, actual)) ->
        Assert.Equal("darkhall-heat-board", expected)
        Assert.Equal("other-loop", actual)
    | other -> Assert.Fail(sprintf "expected loop mismatch refusal, got %A" other)

    match admit "spawn:darkhall-heat-board:2:2:saves/other/darkhall-heat-board/lap-2-tick-2.heat-board" with
    | Error(Scheduler.HeatBoardContinuationFeedback.StatePointerMismatch(expectedPrefix, actual)) ->
        Assert.Equal("saves/darkhall/darkhall-heat-board/", expectedPrefix)
        Assert.Equal("saves/other/darkhall-heat-board/lap-2-tick-2.heat-board", actual)
    | other -> Assert.Fail(sprintf "expected state-pointer mismatch refusal, got %A" other)

    match admit "spawn:darkhall-heat-board:2147483647:0:saves/darkhall/darkhall-heat-board/lap-max.heat-board" with
    | Error(Scheduler.HeatBoardContinuationFeedback.ResumeTickOverflow(nextLap, ticksPerLap)) ->
        Assert.Equal(System.Int32.MaxValue, nextLap)
        Assert.Equal(2, ticksPerLap)
    | other -> Assert.Fail(sprintf "expected overflow refusal, got %A" other)
