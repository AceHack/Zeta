module Zeta.Tests.DarkHallSchedulerTests

open System.Diagnostics
open System.Threading.Tasks
open global.Xunit
open Zeta.Core

module Runtime = DarkHallCabinetRuntime
module RoomLoop = DarkHallRoomLoop
module Scheduler = DarkHallScheduler
module RH = RoomHorizon
module PS = ProbabilitySemiring

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

let private budget maxLaps : SimLoop.Budget =
    { MaxLaps = maxLaps
      MaxTicks = 64
      MaxMillis = 1_000L }

let private mustOk =
    function
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private rejectSlots slots : ModuloGSetConfig =
    ModuloGSetConfig.rejectCollision slots

/// Budget is EARNED, not passed in: a peer attests value to `owner`, and the boundary reads the
/// resulting balance out of the book. `RoomBoundary.create` no longer accepts a bare int, so this
/// fixture is what "give this test some budget" now honestly costs.
let private ledgerCrediting (owner: string) (budget: int) : PrivacyLedger.Ledger =
    if budget <= 0 then
        PrivacyLedger.empty
    else
        match
            PrivacyLedger.attest
                ("attestation:" + owner)
                owner
                ("peer-of-" + owner)
                budget
                "test fixture: a peer attests that the owner added value"
                PrivacyLedger.empty
        with
        | Ok ledger -> ledger
        | Error refusal -> failwith (PrivacyLedger.describeRefusal refusal)

let private emptyBoundary source room budget config =
    ModuloGSet.empty<string> config
    |> mustOk
    |> RoomBoundary.create (ledgerCrediting source budget) source source room

let private horizonConfig capacity policy : BoundedGSetConfig =
    BoundedGSetConfig.withPolicy capacity policy

let private horizonCost bytes : Vision.BranchCost =
    { SpaceBytes = bytes
      TimeTicks = 0
      BytesPerTick = 0L
      UncertaintyResolutionBits = 0 }

let private horizonCandidate key label state bytes : RH.Candidate<int, string> =
    { Key = key
      Branch =
        { Label = label
          State = state
          Cost = horizonCost bytes }
      Priority =
        { Attention = PS.one
          Gravity = PS.one } }

let private sampleVault () =
    let v =
        DoorGraph.empty
        |> DoorGraph.addRoom "darkhall"
        |> DoorGraph.addRoom "glass"

    DoorGraph.addDoor (DoorGraph.door "darkhall" "glass" "door-key") v |> mustOk

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
let ``heat transcript summary folds rows without losing distinct heat kinds`` () =
    let rows: Scheduler.HeatBoundaryRow list =
        [ { Tick = 1
            RoomName = "darkhall"
            HeatRejected = 1
            Backpressured = 1
            StorageErrors = 0
            HeatKinds = [ "room-boundary.door-denied" ]
            Reasons = [ "permission denied" ] }
          { Tick = 2
            RoomName = "darkhall"
            HeatRejected = 2
            Backpressured = 1
            StorageErrors = 1
            HeatKinds = [ "room-boundary.door-denied"; "soft-emu.prune" ]
            Reasons = [ "capacity=1"; "pruned branch" ] } ]

    let summary = Scheduler.summarizeHeatRows rows

    Assert.Equal(2, summary.Rows)
    Assert.Equal(3, summary.HeatRejected)
    Assert.Equal(2, summary.Backpressured)
    Assert.Equal(1, summary.StorageErrors)
    Assert.Equal<string list>(
        [ "room-boundary.door-denied"; "soft-emu.prune" ],
        summary.HeatKinds
    )
    Assert.Equal<string list>([ "denied"; "forgotten"; "storage-error" ], summary.Signals)
    Assert.Equal<string list>(
        [ "permission denied"; "capacity=1"; "pruned branch" ],
        summary.Reasons
    )
    Assert.True(Scheduler.transcriptHasHeat summary)

[<Fact>]
let ``heat boundary signals classify scheduler rows without caller string parsing`` () =
    let forgotten: Scheduler.HeatBoundaryRow =
        { Tick = 1
          RoomName = "darkhall"
          HeatRejected = 1
          Backpressured = 0
          StorageErrors = 0
          HeatKinds = [ "room-horizon.forgotten"; "soft-emu.prune" ]
          Reasons = [ "forgot materialized keys" ] }

    let noForgetBackpressure: Scheduler.HeatBoundaryRow =
        { Tick = 2
          RoomName = "darkhall"
          HeatRejected = 1
          Backpressured = 1
          StorageErrors = 0
          HeatKinds = [ "room-admission.backpressure" ]
          Reasons = [ "paid candidate could not enter" ] }

    let denied: Scheduler.HeatBoundaryRow =
        { Tick = 3
          RoomName = "darkhall"
          HeatRejected = 1
          Backpressured = 1
          StorageErrors = 0
          HeatKinds = [ "room-boundary.door-denied" ]
          Reasons = [ "permission denied" ] }

    let countOnly: Scheduler.HeatBoundaryRow =
        { Tick = 4
          RoomName = "darkhall"
          HeatRejected = 1
          Backpressured = 1
          StorageErrors = 1
          HeatKinds = [ "custom.heat" ]
          Reasons = [ "bounded sink saturated" ] }

    let invalid: Scheduler.HeatBoundaryRow =
        { Tick = 5
          RoomName = "darkhall"
          HeatRejected = 1
          Backpressured = 0
          StorageErrors = 0
          HeatKinds = [ "llmtv.replay.invalid" ]
          Reasons = [ "artifact decode failed" ] }

    let expired: Scheduler.HeatBoundaryRow =
        { Tick = 6
          RoomName = "darkhall"
          HeatRejected = 1
          Backpressured = 0
          StorageErrors = 0
          HeatKinds = [ "llmtv.replay.expired" ]
          Reasons = [ "ttl elapsed" ] }

    let stale: Scheduler.HeatBoundaryRow =
        { Tick = 7
          RoomName = "darkhall"
          HeatRejected = 1
          Backpressured = 0
          StorageErrors = 0
          HeatKinds = [ "llmtv.replay.stale" ]
          Reasons = [ "frame too old" ] }

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Forgotten ],
        Scheduler.heatBoundarySignals forgotten
    )

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Backpressure ],
        Scheduler.heatBoundarySignals noForgetBackpressure
    )

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Denied ],
        Scheduler.heatBoundarySignals denied
    )

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Other "custom.heat"
          Scheduler.HeatBoundarySignal.Backpressure
          Scheduler.HeatBoundarySignal.StorageError ],
        Scheduler.heatBoundarySignals countOnly
    )

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Invalid ],
        Scheduler.heatBoundarySignals invalid
    )

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Expired ],
        Scheduler.heatBoundarySignals expired
    )

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Stale ],
        Scheduler.heatBoundarySignals stale
    )

    Assert.Equal<string list>([ "invalid" ], Scheduler.heatBoundarySignalTokens invalid)
    Assert.Equal<string list>([ "expired" ], Scheduler.heatBoundarySignalTokens expired)
    Assert.Equal<string list>([ "stale" ], Scheduler.heatBoundarySignalTokens stale)

    Assert.True(Scheduler.rowHasForgettingSignal forgotten)
    Assert.True(Scheduler.rowHasBackpressureSignal noForgetBackpressure)
    Assert.True(Scheduler.rowHasBackpressureSignal denied)
    Assert.True(Scheduler.rowHasStorageErrorSignal countOnly)

    Assert.Equal<Scheduler.HeatBoundarySignal list>(
        [ Scheduler.HeatBoundarySignal.Forgotten
          Scheduler.HeatBoundarySignal.Backpressure
          Scheduler.HeatBoundarySignal.Denied
          Scheduler.HeatBoundarySignal.Other "custom.heat"
          Scheduler.HeatBoundarySignal.StorageError ],
        Scheduler.heatTranscriptSignals [ forgotten; noForgetBackpressure; denied; countOnly ]
    )

    Assert.Equal<string list>(
        [ "forgotten"; "backpressure"; "denied"; "other"; "storage-error"; "invalid"; "expired"; "stale" ],
        Scheduler.heatTranscriptSignalTokens [ forgotten; noForgetBackpressure; denied; countOnly; invalid; expired; stale ]
    )

[<Fact>]
let ``heat signature classifier is the shared pressure and forgetting rule`` () =
    let nullKind: string = null

    Assert.False(HeatSignature.isBackpressureKind nullKind)
    Assert.False(HeatSignature.isDeniedKind nullKind)
    Assert.False(HeatSignature.isPressureKind nullKind)
    Assert.False(HeatSignature.isForgettingKind nullKind)
    Assert.False(HeatSignature.isInvalidKind nullKind)
    Assert.False(HeatSignature.isExpiredKind nullKind)
    Assert.False(HeatSignature.isStaleKind nullKind)
    Assert.True(HeatSignature.isBackpressureKind "room-admission.backpressure")
    Assert.True(HeatSignature.isBackpressureKind "ROOM-ADMISSION.BACKPRESSURE")
    Assert.False(HeatSignature.isBackpressureKind "room-boundary.door-denied")
    Assert.True(HeatSignature.isDeniedKind "room-boundary.door-denied")
    Assert.True(HeatSignature.isDeniedKind "llmtv.replay.rejected")
    Assert.True(HeatSignature.isPressureKind "room-boundary.door-denied")
    Assert.True(HeatSignature.isPressureKind "meta-cart.policy-backpressure")
    Assert.True(HeatSignature.isForgettingKind "room-horizon.forgotten")
    Assert.True(HeatSignature.isForgettingKind "soft-emu.prune")
    Assert.True(HeatSignature.isStorageErrorKind "bounded.storage-error")
    Assert.True(HeatSignature.isInvalidKind "llmtv.replay.invalid")
    Assert.True(HeatSignature.isExpiredKind "llmtv.replay.expired")
    Assert.True(HeatSignature.isStaleKind "llmtv.replay.stale")
    Assert.False(HeatSignature.isPressureKind "soft-emu.prune")

    Assert.Equal(HeatSignal.Backpressure, HeatSignal.ofKind "meta-cart.policy-backpressure")
    Assert.Equal(HeatSignal.Denied, HeatSignal.ofKind "room-boundary.door-denied")
    Assert.Equal(HeatSignal.Forgotten, HeatSignal.ofKind "soft-emu.prune")
    Assert.Equal(HeatSignal.StorageError, HeatSignal.ofKind "bounded.storage-error")
    Assert.Equal(HeatSignal.Invalid, HeatSignal.ofKind "llmtv.replay.invalid")
    Assert.Equal(HeatSignal.Expired, HeatSignal.ofKind "llmtv.replay.expired")
    Assert.Equal(HeatSignal.Stale, HeatSignal.ofKind "llmtv.replay.stale")
    Assert.Equal("backpressure", HeatSignal.tokenOfKind "meta-cart.policy-backpressure")

    let signature = HeatSignature.ofMass "darkhall-host" "room-horizon.forgotten" 1 1.0 "forgot branch"

    Assert.Equal(HeatSignal.Forgotten, HeatSignal.ofSignature signature)
    Assert.Equal("forgotten", HeatSignal.tokenOfSignature signature)

    Assert.Equal(
        Scheduler.HeatBoundarySignal.Backpressure,
        Scheduler.heatBoundarySignalOfKind "meta-cart.policy-backpressure"
    )

    Assert.Equal(
        Scheduler.HeatBoundarySignal.Denied,
        Scheduler.heatBoundarySignalOfKind "room-boundary.door-denied"
    )

    Assert.Equal(
        Scheduler.HeatBoundarySignal.Forgotten,
        Scheduler.heatBoundarySignalOfKind "soft-emu.prune"
    )

    Assert.True(
        match Scheduler.heatBoundarySignalOfKind nullKind with
        | Scheduler.HeatBoundarySignal.Other value -> isNull value
        | _ -> false
    )

[<Fact>]
let ``heat pressure classifiers agree on live kinds and on dual-token kinds`` () =
    // 081M010W1BP. The two routes used to disagree whenever a kind carried both a
    // forgetting token and a pressure token: isPressureKind said yes, ofKind said
    // Forgotten so isPressure said no. TemperatureReadout then read cold for a
    // room under genuine backpressure. Both routes now read classifyKind.
    //
    // Live kinds (enumerated in ShedDisposition.Property.Tests L7 corpus) all
    // carry one token class. Dual-token kinds are constructed by concatenation
    // so a kind-literal lint that refuses them in source does not fire here.
    let live =
        [ "room-admission.backpressure"
          "room-horizon.backpressure"
          "room-boundary.privacy-backpressure"
          "meta-cart.policy-backpressure"
          "darkhall.backpressure"
          "room-boundary.door-denied"
          "meta-cart.denied"
          "darkhall.machine.denied"
          "room-horizon.forgotten"
          "room-admission.forgotten"
          "wset.consolidate.forgotten"
          "soft-emu.prune"
          "darkhall.storage-error"
          "invalid"
          "forgotten"
          "backpressure"
          "reject-cache.overwritten"
          "denied-list.compacted"
          "rejection-sampler.evicted"
          "backpressure-meter.erased" ]

    let forgetTokens = [ "forgotten"; "forget"; "prune" ]
    let pressureTokens = [ "backpressure"; "denied"; "reject" ]

    let dual =
        [ for f in forgetTokens do
              for p in pressureTokens do
                  yield f + "-" + p
                  yield p + "-" + f ]

    for kind in live @ dual do
        let fromKind = HeatSignature.isPressureKind kind
        let fromSignal = HeatSignal.ofKind kind |> HeatSignal.isPressure
        Assert.True((fromKind = fromSignal), sprintf "disagree on %s: isPressureKind=%b ofKind|>isPressure=%b" kind fromKind fromSignal)

    // The workitem's measured table: dual-token kinds are pressure, explicitly.
    // Built by concatenation so the dual-token kind-literal lint does not fire.
    let forgetBackpressure = "forget" + "-" + "backpressure"
    let pruneRejected = "prune" + "-" + "rejected"
    let boundedForgetDenied = "bounded" + "-" + "forget" + "-" + "denied"

    Assert.True(HeatSignature.isPressureKind forgetBackpressure)
    Assert.Equal(HeatSignal.Backpressure, HeatSignal.ofKind forgetBackpressure)
    Assert.True(HeatSignature.isPressureKind pruneRejected)
    Assert.Equal(HeatSignal.Denied, HeatSignal.ofKind pruneRejected)
    Assert.True(HeatSignature.isPressureKind boundedForgetDenied)
    Assert.Equal(HeatSignal.Denied, HeatSignal.ofKind boundedForgetDenied)

    // Fail-safe: a dual-token signature reports full pressure, not a cold room.
    let dualSig = HeatSignature.ofMass "test" forgetBackpressure 1 1.0 "dual-token probe"
    Assert.Equal(TemperatureReadout.MaxPpm, TemperatureReadout.ofHeatSignature(dualSig).PressurePpm)

[<Fact>]
let ``HeatSignal.classOf inverts ofKind on every class, so the one pressure table is read correctly`` () =
    // 081M07Z23EX. `HeatSignal.isPressure` no longer enumerates the pressure bit; it recovers
    // the KindClass with `classOf` and reads `HeatSignature.isPressureClass`. That removes the
    // membership split and leaves exactly one residual the COMPILER CANNOT SEE: `classOf` is
    // exhaustive whatever it maps to, so a miswired arm (`Denied -> KindClass.Forgotten`) type-
    // checks and silently answers the pressure question wrong. This is that falsifier.
    //
    // The law is stated through the real string chain rather than as `classOf x = <literal>`,
    // which would only restate `classOf`'s own table back at itself:
    //
    //     for every kind k:  classOf (ofKind k) = classifyKind k
    //
    // One representative kind per class, Other included (no vocabulary token appears in it).
    let perClass =
        [ "backpressure", HeatSignature.KindClass.Backpressure
          "denied", HeatSignature.KindClass.Denied
          "forgotten", HeatSignature.KindClass.Forgotten
          "storage", HeatSignature.KindClass.StorageError
          "invalid", HeatSignature.KindClass.Invalid
          "expired", HeatSignature.KindClass.Expired
          "stale", HeatSignature.KindClass.Stale
          "hall.opened", HeatSignature.KindClass.Other ]

    // Every class is covered — a shrunk list would make the loop below pass by not looking.
    Assert.Equal(8, perClass |> List.map snd |> List.distinct |> List.length)

    for kind, expectedClass in perClass do
        Assert.Equal(expectedClass, HeatSignature.classifyKind kind)

        let roundTripped = kind |> HeatSignal.ofKind |> HeatSignal.classOf

        Assert.True(
            (roundTripped = expectedClass),
            sprintf "classOf (ofKind %s) = %A, expected %A — the correspondence is miswired" kind roundTripped expectedClass
        )

        // The consequence that matters: the derived signal route reads the one table correctly.
        Assert.Equal(
            HeatSignature.isPressureKind kind,
            kind |> HeatSignal.ofKind |> HeatSignal.isPressure
        )

    // The payload-carrying case is a correspondence too, and its payload is irrelevant to it.
    Assert.Equal(HeatSignature.KindClass.Other, HeatSignal.classOf(HeatSignal.Other "anything at all"))

[<Fact>]
let ``heat rows export through an injected host heat sink`` () =
    let rows: Scheduler.HeatBoundaryRow list =
        [ { Tick = 1
            RoomName = "darkhall"
            HeatRejected = 2
            Backpressured = 1
            StorageErrors = 0
            HeatKinds = [ "room-boundary.door-denied"; "soft-emu.prune" ]
            Reasons = [ "permission denied"; "branch pruned" ] }
          { Tick = 2
            RoomName = "darkhall"
            HeatRejected = 1
            Backpressured = 0
            StorageErrors = 1
            HeatKinds = []
            Reasons = [ "heat sink storage failed" ] } ]

    let sink = RecordingHeatSink()

    Scheduler.emitHeatRows (sink :> IHeatSink) "darkhall-host" rows |> mustOk

    let signatures = sink.Signatures |> Seq.toList

    Assert.Equal<string list>(
        [ "room-boundary.door-denied"; "soft-emu.prune"; "darkhall.storage-error" ],
        signatures |> List.map _.Kind
    )
    Assert.Equal<string list>(
        [ "denied"; "forgotten"; "storage-error" ],
        signatures |> List.map HeatSignal.tokenOfSignature
    )
    Assert.All(signatures, fun signature -> Assert.Equal("darkhall-host", signature.Source))
    Assert.Contains("room=darkhall tick=1", signatures.[0].Detail)
    Assert.Contains("room=darkhall tick=2", signatures.[2].Detail)

[<Fact>]
let ``room horizon forgetting renders on the DarkHall heat board`` () =
    let current =
        BoundedGSet.ofSeq<int> (horizonConfig 2 BoundedGSetForgetPolicy.ForgetLowest) [ 1; 2 ]
        |> mustOk
        |> fun projection -> projection.State

    let report =
        [ horizonCandidate 3 "newer" "C" 1L ]
        |> RH.update current (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    let row = Scheduler.heatRowOfHorizonReport 11 "darkhall" "darkhall-horizon" report

    Assert.Equal(11, row.Tick)
    Assert.Equal("darkhall", row.RoomName)
    Assert.Equal(1, row.HeatRejected)
    Assert.Equal(0, row.Backpressured)
    Assert.Equal<string list>([ "room-horizon.forgotten" ], row.HeatKinds)
    Assert.Contains("forgot materialized keys", System.String.Join(";", row.Reasons))

    let frame = Scheduler.heatBoardFrame 99UL [ row ]

    Assert.Equal(1uy, Chip8Cow.colorAt 0 0 frame)
    Assert.Equal(0uy, Chip8Cow.colorAt 16 0 frame)
    Assert.Equal(4uy, Chip8Cow.colorAt 48 0 frame)

[<Fact>]
let ``room horizon no-forget backpressure renders on the DarkHall heat board`` () =
    let current =
        BoundedGSet.ofSeq<int> (BoundedGSetConfig.noForgetBackpressure 1) [ 1 ]
        |> mustOk
        |> fun projection -> projection.State

    let report =
        [ horizonCandidate 2 "second" "B" 1L ]
        |> RH.update current (SoftThrottle.tank 1.0 0.0)
        |> mustOk

    let row = Scheduler.heatRowOfHorizonReport 12 "darkhall" "darkhall-horizon" report

    Assert.Equal(1, row.HeatRejected)
    Assert.Equal(1, row.Backpressured)
    Assert.Equal<string list>([ "room-horizon.backpressure" ], row.HeatKinds)
    Assert.Contains("paid futures could not enter", System.String.Join(";", row.Reasons))

    let frame = Scheduler.heatBoardFrame 99UL [ row ]

    Assert.Equal(1uy, Chip8Cow.colorAt 0 0 frame)
    Assert.Equal(3uy, Chip8Cow.colorAt 16 0 frame)
    Assert.Equal(4uy, Chip8Cow.colorAt 48 0 frame)

[<Fact>]
let ``soft scheduler banks darkhall heat backpressure as a room boundary row`` () =
    task {
        let sink =
            BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

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
let ``boundary room handler records door denial heat as a host visible row`` () =
    task {
        let sink = RecordingHeatSink()
        let boundary = emptyBoundary "darkhall-boundary-scheduler" "darkhall" 5 (rejectSlots 2)
        let vault = sampleVault ()

        let boundaryFor (action: Runtime.CabinetAction) =
            if action.Id = "darkhall.edit-grammar" then
                Some(RoomLoop.BoundaryCommand.Traverse(Set.empty, "glass", vault))
            else
                None

        let handler =
            Scheduler.boundaryRoomTickHandler
                "darkhall-boundary-room"
                timer
                "darkhall-boundary-scheduler"
                (sink :> IHeatSink)
                (fun _ -> None)
                boundaryFor
                (chooseById "darkhall.edit-grammar")

        let source _ = [ TimerElapsed 17 ]

        let initial =
            Scheduler.initialWithBoundary Arcade.room Chip9Capabilities.chip8Default boundary

        let! result = (SoftScheduler.driveK [ handler ] source).Run(ctx ()) 42L initial 1

        match result with
        | Error feedback -> Assert.Fail(sprintf "boundary handler should report through room state, got %A" feedback)
        | Ok final ->
            Assert.Equal(1, final.CompletedTicks)
            Assert.True(Scheduler.boundaryBackpressured final)
            Assert.Equal("darkhall", final.Boundary.CurrentRoom)
            Assert.Equal(1, sink.Signatures.Count)
            Assert.Equal("room-boundary.door-denied", sink.Signatures.[0].Kind)

            match final.LastTick with
            | None -> Assert.Fail "scheduler should bank the boundary tick"
            | Some tick ->
                match tick.Result with
                | Error(RoomLoop.TickFeedback.BoundaryFeedback(RoomBoundary.Feedback.DoorDenied(fromRoom, toRoom, reason))) ->
                    Assert.Equal("darkhall", fromRoom)
                    Assert.Equal("glass", toRoom)
                    Assert.Contains("permission denied", reason)
                | other -> Assert.Fail(sprintf "expected door-denial boundary feedback, got %A" other)

            match Scheduler.lastBoundaryHeatRow final with
            | None -> Assert.Fail "scheduler should expose the latest boundary heat row"
            | Some row ->
                Assert.Equal(1, row.Tick)
                Assert.Equal("darkhall", row.RoomName)
                Assert.Equal(1, row.HeatRejected)
                Assert.Equal(1, row.Backpressured)
                Assert.Equal(0, row.StorageErrors)
                Assert.Equal<string list>([ "room-boundary.door-denied" ], row.HeatKinds)
                Assert.Contains("permission denied", System.String.Join(";", row.Reasons))

            match Scheduler.boundaryHeatRows final with
            | [ row ] -> Assert.Equal(1, row.Backpressured)
            | rows -> Assert.Fail(sprintf "expected one boundary heat row, got %A" rows)
    }

[<Fact>]
let ``heat board sim loop measures backpressure before the cut closes`` () =
    task {
        let sink =
            BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

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
        Assert.Equal(2, outcome.Final.CompletedLaps)

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

[<Fact>]
let ``saved heat board state resumes as the next finite sim loop link`` () =
    task {
        let store = Scheduler.InMemoryHeatBoardStateStore() :> Scheduler.IHeatBoardStateStore
        let source absoluteTick =
            if absoluteTick >= 2 && absoluteTick <= 5 then
                [ TimerElapsed absoluteTick ]
            else
                []

        let! first =
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
                (budget 2)
                (ctx ())
                42L
                1
                (fun _ _ -> true)

        Assert.Equal(SimLoop.Stopped.LapBudget, first.Stopped)
        Assert.Equal(2, first.Final.CompletedTicks)
        Assert.Equal(2, first.Final.CompletedLaps)

        let! pointerResult =
            Scheduler.saveHeatBoardStateAsync
                store
                "darkhall-heat-board"
                first
                System.Threading.CancellationToken.None

        let pointer =
            match pointerResult with
            | Ok pointer -> pointer
            | Error feedback ->
                Assert.Fail(sprintf "expected saved state pointer, got %A" feedback)
                ""

        let tokenLine =
            match Scheduler.encodeHeatBoardContinuation "darkhall-heat-board" first with
            | Some token -> token
            | None ->
                Assert.Fail "budget-stopped heat-board run should encode a continuation"
                ""

        let! resumed =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                source
                int64
                (budget 2)
                (ctx ())
                42L
                1
                (fun _ _ -> true)
                tokenLine
                System.Threading.CancellationToken.None

        let second =
            match resumed with
            | Error feedback ->
                Assert.Fail(sprintf "expected resumed heat-board link, got %A" feedback)
                Unchecked.defaultof<_>
            | Ok outcome ->
                Assert.Equal(SimLoop.Stopped.LapBudget, outcome.Stopped)
                Assert.Equal(4, outcome.Final.CompletedTicks)
                Assert.Equal(4, outcome.Final.CompletedLaps)
                Assert.Equal(pointer, Scheduler.heatBoardStatePointer "darkhall-heat-board" first)
                Assert.Equal(2, outcome.Laps.Length)
                Assert.Equal<int list>([ 3; 4 ], outcome.Laps |> List.map (fun lap -> lap.State.CompletedTicks))
                Assert.Equal<int list>([ 3; 4 ], outcome.Laps |> List.map (fun lap -> lap.State.CompletedLaps))
                outcome

        let! secondPointerResult =
            Scheduler.saveHeatBoardStateAsync
                store
                "darkhall-heat-board"
                second
                System.Threading.CancellationToken.None

        let secondPointer =
            match secondPointerResult with
            | Ok pointer -> pointer
            | Error feedback ->
                Assert.Fail(sprintf "expected saved second state pointer, got %A" feedback)
                ""

        Assert.Equal("saves/darkhall/darkhall-heat-board/lap-4-tick-4.heat-board", secondPointer)

        let secondTokenLine =
            match Scheduler.encodeHeatBoardContinuation "darkhall-heat-board" second with
            | Some token -> token
            | None ->
                Assert.Fail "second budget-stopped heat-board run should encode a continuation"
                ""

        match SimLoop.parseContinuation secondTokenLine with
        | Some token ->
            Assert.Equal(4, token.NextLap)
            Assert.Equal(2, token.TicksSpent)
            Assert.Equal(secondPointer, token.StatePointer)
        | None -> Assert.Fail(sprintf "expected parseable second continuation, got %s" secondTokenLine)

        let! third =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                source
                int64
                (budget 2)
                (ctx ())
                42L
                1
                (fun _ _ -> true)
                secondTokenLine
                System.Threading.CancellationToken.None

        match third with
        | Error feedback -> Assert.Fail(sprintf "expected second resumed heat-board link, got %A" feedback)
        | Ok outcome ->
            Assert.Equal(SimLoop.Stopped.LapBudget, outcome.Stopped)
            Assert.Equal(6, outcome.Final.CompletedTicks)
            Assert.Equal(6, outcome.Final.CompletedLaps)
            Assert.Equal(2, outcome.Laps.Length)
            Assert.Equal<int list>([ 5; 6 ], outcome.Laps |> List.map (fun lap -> lap.State.CompletedTicks))
            Assert.Equal<int list>([ 5; 6 ], outcome.Laps |> List.map (fun lap -> lap.State.CompletedLaps))
    }

[<Fact>]
let ``resumed heat board cut observes cumulative lap boundaries`` () =
    task {
        let store = Scheduler.InMemoryHeatBoardStateStore() :> Scheduler.IHeatBoardStateStore
        let source absoluteTick =
            if absoluteTick >= 2 && absoluteTick <= 5 then
                [ TimerElapsed absoluteTick ]
            else
                []

        let! first =
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
                (budget 2)
                (ctx ())
                42L
                1
                (fun _ _ -> true)

        let! pointerResult =
            Scheduler.saveHeatBoardStateAsync
                store
                "darkhall-heat-board"
                first
                System.Threading.CancellationToken.None

        match pointerResult with
        | Error feedback -> Assert.Fail(sprintf "expected saved state pointer, got %A" feedback)
        | Ok _ -> ()

        let tokenLine =
            match Scheduler.encodeHeatBoardContinuation "darkhall-heat-board" first with
            | Some token -> token
            | None ->
                Assert.Fail "budget-stopped heat-board run should encode a continuation"
                ""

        let! resumed =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                source
                int64
                (budget 4)
                (ctx ())
                42L
                1
                (fun _ state -> state.CompletedLaps < 4)
                tokenLine
                System.Threading.CancellationToken.None

        match resumed with
        | Error feedback -> Assert.Fail(sprintf "expected resumed heat-board link, got %A" feedback)
        | Ok outcome ->
            Assert.Equal(SimLoop.Stopped.CutChoseClose, outcome.Stopped)
            Assert.Equal(4, outcome.Final.CompletedLaps)
            Assert.Equal(4, outcome.Final.CompletedTicks)
            Assert.Equal<int list>([ 3; 4 ], outcome.Laps |> List.map (fun lap -> lap.State.CompletedLaps))
    }

[<Fact>]
let ``resume refuses a valid continuation when the state snapshot is missing`` () =
    task {
        let missingPointer = "saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board"
        let tokenLine = sprintf "spawn:darkhall-heat-board:2:2:%s" missingPointer
        let store = Scheduler.InMemoryHeatBoardStateStore() :> Scheduler.IHeatBoardStateStore

        let! resumed =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                (budget 1)
                (ctx ())
                42L
                1
                (fun _ _ -> true)
                tokenLine
                System.Threading.CancellationToken.None

        match resumed with
        | Error(Scheduler.HeatBoardContinuationFeedback.SnapshotMissing pointer) ->
            Assert.Equal(missingPointer, pointer)
        | other -> Assert.Fail(sprintf "expected missing snapshot feedback, got %A" other)
    }

[<Fact>]
let ``resume refuses a token whose lap does not match the loaded snapshot`` () =
    task {
        let store = Scheduler.InMemoryHeatBoardStateStore() :> Scheduler.IHeatBoardStateStore

        let! first =
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
                (budget 2)
                (ctx ())
                42L
                1
                (fun _ _ -> true)

        let! pointerResult =
            Scheduler.saveHeatBoardStateAsync
                store
                "darkhall-heat-board"
                first
                System.Threading.CancellationToken.None

        let pointer =
            match pointerResult with
            | Ok pointer -> pointer
            | Error feedback ->
                Assert.Fail(sprintf "expected saved state pointer, got %A" feedback)
                ""

        let tokenLine = sprintf "spawn:darkhall-heat-board:4:2:%s" pointer

        let! resumed =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                (budget 2)
                (ctx ())
                42L
                1
                (fun _ _ -> true)
                tokenLine
                System.Threading.CancellationToken.None

        match resumed with
        | Error(Scheduler.HeatBoardContinuationFeedback.SnapshotLapMismatch(expected, actual)) ->
            Assert.Equal(4, expected)
            Assert.Equal(2, actual)
        | other -> Assert.Fail(sprintf "expected snapshot lap mismatch feedback, got %A" other)
    }

[<Fact>]
let ``resume refuses a token whose tick boundary does not match the loaded snapshot`` () =
    task {
        let store = Scheduler.InMemoryHeatBoardStateStore() :> Scheduler.IHeatBoardStateStore

        let! first =
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
                (budget 2)
                (ctx ())
                42L
                2
                (fun _ _ -> true)

        let! pointerResult =
            Scheduler.saveHeatBoardStateAsync
                store
                "darkhall-heat-board"
                first
                System.Threading.CancellationToken.None

        let pointer =
            match pointerResult with
            | Ok pointer -> pointer
            | Error feedback ->
                Assert.Fail(sprintf "expected saved state pointer, got %A" feedback)
                ""

        let tokenLine = sprintf "spawn:darkhall-heat-board:2:2:%s" pointer

        let! resumed =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                (budget 1)
                (ctx ())
                42L
                1
                (fun _ _ -> true)
                tokenLine
                System.Threading.CancellationToken.None

        match resumed with
        | Error(Scheduler.HeatBoardContinuationFeedback.SnapshotTickMismatch(expected, actual)) ->
            Assert.Equal(2, expected)
            Assert.Equal(4, actual)
        | other -> Assert.Fail(sprintf "expected snapshot tick mismatch feedback, got %A" other)
    }

[<Fact>]
let ``resume refuses a finite link whose offset would overflow after the first lap`` () =
    task {
        let pointer = "saves/darkhall/darkhall-heat-board/lap-max.heat-board"
        let tokenLine = sprintf "spawn:darkhall-heat-board:%d:0:%s" System.Int32.MaxValue pointer
        let store = Scheduler.InMemoryHeatBoardStateStore() :> Scheduler.IHeatBoardStateStore

        let! resumed =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                (budget 2)
                (ctx ())
                42L
                1
                (fun _ _ -> true)
                tokenLine
                System.Threading.CancellationToken.None

        match resumed with
        | Error(Scheduler.HeatBoardContinuationFeedback.ResumeTickOverflow(nextLap, ticksPerLap)) ->
            Assert.Equal(System.Int32.MaxValue, nextLap)
            Assert.Equal(1, ticksPerLap)
        | other -> Assert.Fail(sprintf "expected resumed-link overflow feedback, got %A" other)
    }

[<Fact>]
let ``resume refuses a one-lap link whose completed lap would overflow`` () =
    task {
        let pointer = "saves/darkhall/darkhall-heat-board/lap-max.heat-board"
        let tokenLine = sprintf "spawn:darkhall-heat-board:%d:0:%s" System.Int32.MaxValue pointer
        let store = Scheduler.InMemoryHeatBoardStateStore() :> Scheduler.IHeatBoardStateStore

        let! resumed =
            Scheduler.resumeHeatBoardSimLoop
                "darkhall-heat-board"
                store
                "darkhall-heat-board"
                timer
                "darkhall-simloop"
                (NullHeatSink() :> IHeatSink)
                (fun _ -> None)
                (chooseById "darkhall.edit-grammar")
                (fun _ -> [ TimerElapsed 17 ])
                int64
                (budget 1)
                (ctx ())
                42L
                1
                (fun _ _ -> true)
                tokenLine
                System.Threading.CancellationToken.None

        match resumed with
        | Error(Scheduler.HeatBoardContinuationFeedback.ResumeTickOverflow(nextLap, ticksPerLap)) ->
            Assert.Equal(System.Int32.MaxValue, nextLap)
            Assert.Equal(1, ticksPerLap)
        | other -> Assert.Fail(sprintf "expected one-lap completed-lap overflow feedback, got %A" other)
    }
