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
let ``entropy is zero for a point mass, positive once branched`` () =
    Assert.Equal(0.0, SoftEmu.entropy (start ()), 9)
    Assert.True(SoftEmu.entropy (SoftEmu.softRun 1 (inputStart ())) > 0.0)

[<Fact>]
let ``probLit is a probability in [0,1]`` () =
    let s = SoftEmu.softRun 1 (inputStart ())
    let p = SoftEmu.probLit 0 0 s
    Assert.True(p >= 0.0 && p <= 1.0)
