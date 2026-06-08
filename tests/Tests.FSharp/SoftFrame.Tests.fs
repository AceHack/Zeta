module Zeta.Tests.SoftFrameTests

open global.Xunit
open Zeta.Core

// FX15 set delay = VX, then a wait loop on FX07/3X00 would spin without tick.
// 6305 F315 F207 3200 1206 : V3=5; delay=V3; loop: V2=delay; if V2==0 skip; jump back
let private delayWait = [| 0x63uy; 0x05uy; 0xF3uy; 0x15uy; 0xF2uy; 0x07uy; 0x32uy; 0x00uy; 0x12uy; 0x06uy |]
let private start () = Chip8Cow.create 1UL |> Chip8Cow.loadRom delayWait

[<Fact>]
let ``frameStep decrements the delay timer (the 60Hz interrupt fires)`` () =
    let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom delayWait
    // set the delay to 5 first (run the two setup opcodes), then a frameStep must tick it down
    let setup = Chip8Cow.run 2 f // 6305, F315 -> delay = 5
    Assert.Equal(5, int setup.Delay)
    let afterFrame = Chip8Cow.frameStep 4 setup
    Assert.Equal(4, int afterFrame.Delay) // ticked once per frame

[<Fact>]
let ``step-only freezes on a delay wait, frameStep makes progress (the live-by-construction fix)`` () =
    let setup = Chip8Cow.run 2 (start ()) // delay = 5, now in the wait loop
    let stepOnly = Chip8Cow.run 50 setup
    Assert.Equal(5, int stepOnly.Delay) // timer never decrements -> frozen
    let mutable s = setup
    for _ in 1..6 do
        s <- Chip8Cow.frameStep 4 s
    Assert.True(int s.Delay < 5) // the interrupt freed it

[<Fact>]
let ``softFrame ticks the whole ensemble (delay decrements across the superposition)`` () =
    let setup = Chip8Cow.run 2 (start ()) |> SoftEmu.pure1
    let after = SoftEmu.softFrame 4 setup
    Assert.Equal(1.0, after |> List.sumBy snd, 9) // normalized
    Assert.All(after, fun (f, _) -> Assert.True(int f.Delay < 5)) // every branch ticked

[<Fact>]
let ``probLitGrid is a DisplayH x DisplayW grid of probabilities in [0,1]`` () =
    let s = SoftEmu.pure1 (start ())
    let grid = SoftEmu.probLitGrid s
    Assert.Equal(Chip8.DisplayH, grid.Length)
    Assert.Equal(Chip8.DisplayW, grid.[0].Length)
    Assert.All(grid, fun row -> Assert.All(row, fun p -> Assert.True(p >= 0.0 && p <= 1.0)))
