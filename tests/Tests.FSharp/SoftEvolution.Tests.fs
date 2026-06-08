module Zeta.Tests.SoftEvolutionTests

open global.Xunit
open Zeta.Core

let private selfLoop = [| 0x12uy; 0x00uy |] // 1200: jump-to-self -> fixed point
let private counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |] // 7001;1200: V0 increments forever
let private step s = SoftEmu.softFrame 8 s |> SoftEmu.prune 8

[<Fact>]
let ``trace records one Step per frame`` () =
    let s0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom selfLoop |> SoftEmu.pure1
    let t = SoftEvolution.trace step 5 s0
    Assert.Equal(5, List.length t)
    Assert.Equal<int list>([ 1; 2; 3; 4; 5 ], t |> List.map (fun s -> s.Frame))

[<Fact>]
let ``evolution is always COHERENT (norm = 1 every step)`` () =
    let s0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom counter |> SoftEmu.pure1
    let t = SoftEvolution.trace step 8 s0
    Assert.True(SoftEvolution.coherent t) // coherence holds even when NOT converged
    Assert.All(t, fun s -> Assert.True(abs (s.Norm - 1.0) < 1e-6))

[<Fact>]
let ``a self-looping ROM CONVERGES (residual -> 0, stable)`` () =
    let s0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom selfLoop |> SoftEmu.pure1
    let t = SoftEvolution.trace step 6 s0
    Assert.True(SoftEvolution.converged 1e-9 t)
    Assert.True(SoftEvolution.stable t)
    Assert.Equal(1, SoftEvolution.peakSupport t) // deterministic -> width stays 1

[<Fact>]
let ``stability and coherence are distinct: counter is coherent but not converged`` () =
    let s0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom counter |> SoftEmu.pure1
    let t = SoftEvolution.trace step 8 s0
    Assert.True(SoftEvolution.coherent t) // always a valid distribution
    Assert.False(SoftEvolution.converged 1e-9 t) // ...but V0 keeps changing -> never settles

[<Fact>]
let ``digest summarizes and handles empty`` () =
    Assert.Equal("empty evolution", SoftEvolution.digest [])
    let s0 = Chip8Cow.create 1UL |> Chip8Cow.loadRom selfLoop |> SoftEmu.pure1
    let d = SoftEvolution.digest (SoftEvolution.trace step 4 s0)
    Assert.Contains("coherent=true", d)
