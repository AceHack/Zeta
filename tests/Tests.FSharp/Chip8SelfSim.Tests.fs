module Zeta.Tests.Chip8SelfSimTests

// STAGE 1 of the self-simulation program (Aaron 2026-06-11: "can we prove the chip8 system can simulate
// its own future outside of itself ... realistic timeline"): proven at the hosted level, as theorems-
// shaped tests. Stage 2 = the same loop in chip8 asm (the interpreter ROM); stage 3 = dotnet/IL; then
// treaty outwards. Four theorems:
//   T1 prediction = future (the simulation IS the timeline, byte-equal, on deterministic segments)
//   T2 fork coverage (at the only genuine branch — input — the actual future ∈ the speculated set)
//   T3 realistic timeline (the future is simulated within a metered budget — the funded tank)
//   T4 outside of itself (speculation never mutates the live present — COW)

open global.Xunit
open Zeta.Core

// deterministic line: 6A0C (V[A]=0x0C); 7A01 (V[A]+=1); 1202 (jump to the += loop) — state evolves forever.
let private loopRom = [| 0x6Auy; 0x0Cuy; 0x7Auy; 0x01uy; 0x12uy; 0x02uy |]
// branches on input after 1 op: 6A0C; EA9E (skip if key V[A] pressed); 1202; 1200
let private forkRom = [| 0x6Auy; 0x0Cuy; 0xEAuy; 0x9Euy; 0x12uy; 0x02uy; 0x12uy; 0x00uy |]

let private frameWith rom = Chip8Cow.create 7UL |> Chip8Cow.loadRom rom

let private future (n: int) (f: Chip8Cow.Frame) =
    let mutable s = f
    for _ in 1..n do s <- Chip8Cow.step s
    s

[<Fact>]
let ``T1 prediction = future: lookAhead n IS the real timeline n steps later, byte-equal (many n)`` () =
    let f = frameWith loopRom
    for n in [ 0; 1; 2; 5; 17; 100; 357 ] do
        let predicted, hitBranch = SoftChip8.lookAhead n f
        Assert.False(hitBranch)
        Assert.Equal(future n f, predicted) // the system's simulation of its own future = the future

[<Fact>]
let ``T2 fork coverage: at the input branch, the ACTUAL future is in the speculated set (both worlds)`` () =
    // run to the fork (1 op), then forkOnInput speculates both key-worlds; whichever key state actually
    // happens, the realized next frame equals one of the speculated branches.
    let atFork, hit = SoftChip8.lookAhead 99 (frameWith forkRom)
    Assert.True(hit)
    let speculated = SoftChip8.forkOnInput atFork |> List.map fst
    for down in [ true; false ] do
        let realized = Chip8Cow.step (SoftChip8Flux.applyKey 0xC down atFork)
        Assert.Contains(realized, speculated)

[<Fact>]
let ``T3 realistic timeline: the future is simulated within a METERED budget (funded steps only)`` () =
    let f = frameWith loopRom
    let _, _, steps, tank' = SoftChip8Flux.lookAheadFunded 1.0 (SoftThrottle.tank 42.0 0.0) f
    Assert.Equal(42, steps) // exactly what the budget affords — no free time travel
    Assert.Equal(0.0, SoftThrottle.available tank', 12)

[<Fact>]
let ``T4 outside of itself: simulating the future never mutates the live present (COW)`` () =
    let f = frameWith loopRom
    let before = Chip8Cow.step f // a reference computation from the SAME present
    let _ = SoftChip8.lookAhead 500 f // deep speculation...
    let after = Chip8Cow.step f // ...and the present still steps to the identical next frame
    Assert.Equal(before, after)
