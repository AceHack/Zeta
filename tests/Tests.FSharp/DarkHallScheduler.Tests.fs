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
