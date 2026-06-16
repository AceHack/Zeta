module Zeta.Tests.ArcadeTests

open global.Xunit
open Zeta.Core

// ROM at 0x200: 6A 0C (V[A]=0x0C) ; 12 02 (jump 0x202 loop) — the soft-scheduler cabinet.
let private setRegRom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]

[<Fact>]
let ``the arcade door gathers its cabinets (incl. the existing DarkHall + soft scheduler)`` () =
    let names = Arcade.cabinets |> List.map (fun c -> c.Name)
    Assert.Contains("play", names) // soft scheduler
    Assert.Contains("host", names) // the clean-room DarkHall cell
    Assert.Contains("predict", names) // real-time branch detection
    Assert.True(Arcade.cabinets |> List.forall (fun c -> c.Module.Length > 0))

[<Fact>]
let ``DarkHall is the room and Arcade is its door over cabinets`` () =
    Assert.Equal("darkhall", Arcade.room.Name)
    Assert.Equal(Arcade.name, Arcade.room.Name)
    Assert.Equal<string list>(Arcade.cabinets |> List.map (fun c -> c.Name), Arcade.room.Cabinets |> List.map (fun c -> c.Name))
    Assert.True(Arcade.machines.Length > Arcade.cabinets.Length)

[<Fact>]
let ``play cabinet is a multi-machine CHIP8 CHIP9 meta-cart cabinet`` () =
    let playCabinet = Arcade.cabinets |> List.find (fun c -> c.Name = "play")
    let machines = playCabinet.Machines |> List.map (fun m -> m.Name)

    Assert.Contains("soft-chip8", machines)
    Assert.Contains("chip9-color", machines)
    Assert.Contains("meta-cart-host", machines)
    Assert.True(playCabinet.Live)

[<Fact>]
let ``machine capabilities surface room-level CHIP9 grants`` () =
    let colorMachines = Arcade.machinesRequiring Chip9Capabilities.Capability.ColorPlanes |> List.map (fun m -> m.Name)
    let hostMachines = Arcade.machinesRequiring Chip9Capabilities.Capability.HostAssistedChildLaunch |> List.map (fun m -> m.Name)

    Assert.Equal<string list>([ "chip9-color" ], colorMachines)
    Assert.Equal<string list>([ "meta-cart-host" ], hostMachines)

[<Fact>]
let ``the arcade signage names the emulator/decompile-to-micro-ops work`` () =
    Assert.Equal("darkhall", Arcade.name)
    Assert.Contains("MIPS-like", Arcade.does)
    Assert.Contains("rooms = micro-ops", Arcade.does)

[<Fact>]
let ``live entrance: play runs a ROM on the soft scheduler (CPU steps, sets V[A])`` () =
    task {
        let! r = Arcade.play 1UL setRegRom 5
        match r with
        | Ok f -> Assert.Equal(0x0Cuy, f.V.[0xA])
        | Error e -> Assert.Fail(sprintf "play errored: %A" e)
    }

[<Fact>]
let ``live entrance: meta cabinet emits heat when parent lacks launch grant`` () =
    let sink = RecordingHeatSink()
    let loop = CartFixtures.cart CartFixtures.loop
    let inputFork = CartFixtures.cart CartFixtures.inputFork

    let caps =
        MetaCart.capabilityMap
            [ loop, CartFixtures.loop.Capabilities
              inputFork, CartFixtures.inputFork.Capabilities ]

    match
        Arcade.playMetaCabinet
            "darkhall"
            (sink :> IHeatSink)
            10
            1UL
            Chip9Capabilities.chip8Default
            caps
            [ loop; inputFork ]
            (Chip8Cow.create 1UL)
    with
    | Error(MetaCart.Feedback.HostDenied(denied, reason)) ->
        Assert.Equal(MetaCart.slotOfCart inputFork, denied)
        Assert.Contains("meta-cart.host-child-launch", reason)
        Assert.Equal(1, sink.Signatures.Count)
        Assert.Equal("meta-cart.denied", sink.Signatures.[0].Kind)
    | other -> Assert.True(false, sprintf "expected launch denial, got %A" other)

[<Fact>]
let ``live entrance: meta cabinet runs a granted CHIP9 child`` () =
    let sink = RecordingHeatSink()
    let child = CartFixtures.cart CartFixtures.chip9GreenDot
    let caps = MetaCart.capabilityMap [ child, CartFixtures.chip9GreenDot.Capabilities ]

    match
        Arcade.playMetaCabinet
            "darkhall"
            (sink :> IHeatSink)
            3
            1UL
            Chip9Capabilities.chip9MetaHost
            caps
            [ child ]
            (Chip8Cow.create 1UL)
    with
    | Ok result ->
        Assert.Equal(MetaCart.slotOfCart child, result.Play.Slot)
        Assert.Equal(2uy, result.Play.FinalFrame.Plane)
        Assert.Equal(2uy, Chip8Cow.colorAt 0 0 result.Play.FinalFrame)
        Assert.Equal(0, sink.Signatures.Count)
    | Error feedback -> Assert.True(false, sprintf "expected granted CHIP9 child, got %A" feedback)

[<Fact>]
let ``live entrance: host runs the clean-room DarkHall CPU deterministically`` () =
    // 6A 0C (V[A]=0x0C) ; 0000 halt — the hard cabinet.
    let prog = [| 0x6Auy; 0x0Cuy; 0x00uy; 0x00uy |]
    let a = Arcade.host prog 16
    let b = Arcade.host prog 16
    Assert.Equal(0x0C, a.V.[0xA]) // register set
    Assert.True(a.Halted)
    Assert.Equal(a.Steps, b.Steps) // deterministic / DST-replayable

[<Fact>]
let ``liveCabinets are the working slices (play/host/step/predict live; catalog awaits)`` () =
    let live = Arcade.liveCabinets |> List.map (fun c -> c.Name)
    Assert.Contains("play", live)
    Assert.Contains("host", live)
    Assert.DoesNotContain("catalog", live)
