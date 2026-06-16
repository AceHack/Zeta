module Zeta.Tests.SoftEmuTests

open global.Xunit
open Zeta.Core

// 6A05 7A03 6002 8A04 : VA=5; VA+=3; V0=2; VA+=V0 (all deterministic — must stay a point mass).
let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy |]
let private start () = Chip8Cow.create 7UL |> Chip8Cow.loadRom arith |> SoftEmu.pure1

// EX9E (skip if key VX down) at 0x200 — an input branch.
let private inputRom = [| 0xE0uy; 0x9Euy; 0x60uy; 0x01uy |]
let private inputStart () = Chip8Cow.create 7UL |> Chip8Cow.loadRom inputRom |> SoftEmu.pure1

[<Fact>]
let ``deterministic code stays a point mass (no spurious branching)`` () =
    let s = SoftEmu.softRun 4 (start ())
    Assert.Equal(1, SoftEmu.support s)
    // weight is normalized to 1
    Assert.Equal(1.0, s |> List.sumBy snd, 9)

[<Fact>]
let ``soft state always normalizes to 1`` () =
    let s = SoftEmu.softRun 1 (inputStart ())
    Assert.Equal(1.0, s |> List.sumBy snd, 9)
    Assert.True(SoftEmu.support s >= 2) // an input opcode forks

[<Fact>]
let ``collapse on deterministic code = the concrete run (soft refines hard)`` () =
    let soft = SoftEmu.softRun 4 (start ()) |> SoftEmu.collapse (fun _ -> 1.0)
    let hard = Chip8Cow.create 7UL |> Chip8Cow.loadRom arith |> Chip8Cow.run 4
    match soft with
    | Some f -> Assert.Equal<byte[]>(hard.V, f.V)
    | None -> Assert.True(false, "empty collapse")

[<Fact>]
let ``prune caps ensemble width (the throttle breadth knob)`` () =
    // run several input forks, then cap to 2
    let grown = SoftEmu.softRun 1 (inputStart ())
    let capped = SoftEmu.prune 2 grown
    Assert.True(SoftEmu.support capped <= 2)
    Assert.Equal(1.0, capped |> List.sumBy snd, 9)

[<Fact>]
let ``pruneWithHeat emits dropped branch mass as heat`` () =
    let grown = SoftEmu.softRun 1 (inputStart ())
    let report = SoftEmu.pruneWithHeat 1 grown
    Assert.Equal(1, SoftEmu.support report.State)
    Assert.Equal(1, report.Heat.DroppedSupport)
    Assert.Equal(0.5, report.Heat.DroppedMass, 9)
    Assert.Equal(2.0, report.Heat.RenormalizationGain, 9)
    Assert.Equal(1.0, report.State |> List.sumBy snd, 9)

[<Fact>]
let ``pruneOrBackpressure is the no-forget cold policy`` () =
    let grown = SoftEmu.softRun 1 (inputStart ())
    match SoftEmu.pruneOrBackpressure 1 grown with
    | Ok _ -> Assert.True(false, "cold pruning must not silently drop a branch")
    | Error(SoftEmu.SoftPruneFeedback.SupportExceeded(limit, support)) ->
        Assert.Equal(1, limit)
        Assert.Equal(2, support)

[<Fact>]
let ``throttledStepWithHeat reports branch pruning heat`` () =
    let report = SoftEmu.throttledStepWithHeat 1 (inputStart ())
    Assert.Equal(1, SoftEmu.support report.State)
    Assert.Equal(1, report.Heat.DroppedSupport)
    Assert.Equal(0.5, report.Heat.DroppedMass, 9)

[<Fact>]
let ``pruneWithHeatSink exports CHIP8 heat to an injected host port`` () =
    let grown = SoftEmu.softRun 1 (inputStart ())
    let recorder = RecordingHeatSink()

    match SoftEmu.pruneWithHeatSink "chip8-room" (recorder :> IHeatSink) 1 grown with
    | Error e -> Assert.True(false, sprintf "unexpected heat sink feedback: %A" e)
    | Ok report ->
        Assert.Equal(1, report.Heat.DroppedSupport)
        let signatures = recorder.Signatures |> Seq.toList
        Assert.Single signatures |> ignore
        let heat = signatures.Head
        Assert.Equal("chip8-room", heat.Source)
        Assert.Equal("soft-emu.prune", heat.Kind)
        Assert.Equal(1, heat.Units)
        Assert.Equal(500000L, heat.MassPpm)

[<Fact>]
let ``bounded in-room heat sink backpressures instead of forgetting heat`` () =
    let sink =
        BoundedHeatSink
            { Capacity = 1
              ForgetPolicy = BoundedGSetForgetPolicy.RejectNew }

    let port = sink :> IHeatSink
    let first = HeatSignature.ofMass "chip8-a" "soft-emu.prune" 1 0.5 "a"
    let second = HeatSignature.ofMass "chip8-b" "soft-emu.prune" 1 0.25 "b"

    match port.Emit first with
    | Error e -> Assert.True(false, sprintf "unexpected first heat feedback: %A" e)
    | Ok () -> ()

    match port.Emit second with
    | Ok () -> Assert.True(false, "bounded heat sink must backpressure when full")
    | Error(HeatSinkFeedback.Backpressure(heat, capacity, count)) ->
        Assert.Equal(second, heat)
        Assert.Equal(1, capacity)
        Assert.Equal(2, count)
        Assert.Equal<HeatSignature list>([ first ], sink.Stored)
    | Error e -> Assert.True(false, sprintf "unexpected heat feedback: %A" e)

[<Fact>]
let ``entropy is zero for a point mass, positive once branched`` () =
    Assert.Equal(0.0, SoftEmu.entropy (start ()), 9)
    Assert.True(SoftEmu.entropy (SoftEmu.softRun 1 (inputStart ())) > 0.0)

[<Fact>]
let ``probLit is a probability in [0,1]`` () =
    let s = SoftEmu.softRun 1 (inputStart ())
    let p = SoftEmu.probLit 0 0 s
    Assert.True(p >= 0.0 && p <= 1.0)
