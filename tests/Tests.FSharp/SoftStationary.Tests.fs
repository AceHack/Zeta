module Zeta.Tests.SoftStationaryTests

open global.Xunit
open Zeta.Core

// 1200: jump to 0x200 (itself) forever — a self-looping frame (PC stays, mem unchanged) = a fixed point.
let private selfLoop = [| 0x12uy; 0x00uy |]
let private loopStart () = Chip8Cow.create 1UL |> Chip8Cow.loadRom selfLoop |> SoftEmu.pure1

[<Fact>]
let ``softDistance: identical distributions = 0, disjoint = 1`` () =
    let a = loopStart ()
    Assert.Equal(0.0, SoftEmu.softDistance a a, 9)
    let b = Chip8Cow.create 99UL |> Chip8Cow.loadRom [| 0x60uy; 0x07uy |] |> Chip8Cow.run 1 |> SoftEmu.pure1
    Assert.Equal(1.0, SoftEmu.softDistance a b, 9) // different frames, disjoint support

[<Fact>]
let ``softDistance is symmetric`` () =
    let a = loopStart ()
    let b = SoftEmu.softFrame 4 a
    Assert.Equal(SoftEmu.softDistance a b, SoftEmu.softDistance b a, 9)

[<Fact>]
let ``stationary converges on a self-looping ROM (t0=t-infinity fixed point reached)`` () =
    let step s = SoftEmu.softFrame 8 s |> SoftEmu.prune 8
    let r = SoftEmu.stationary step 1e-9 64 (loopStart ())
    Assert.True(r.Converged) // the closed-loop self-consistent state exists and is found
    Assert.True(r.Residual < 1e-9)

[<Fact>]
let ``stationary reports non-convergence honestly when no fixed point in budget`` () =
    // a counter ROM: 7001 (V0 += 1) then 1200 loop -> V0 changes every loop, never self-consistent
    let counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |]
    let s0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom counter |> SoftEmu.pure1
    let step s = SoftEmu.softFrame 8 s |> SoftEmu.prune 8
    let r = SoftEmu.stationary step 1e-9 12 s0
    Assert.False(r.Converged) // V0 keeps incrementing -> no fixed point; reported, not faked
