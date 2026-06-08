module Zeta.Tests.DeltaPatternTests

open global.Xunit
open Zeta.Core

let private none = SoftController.none
let private counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |] // 7001;1200: V0 grows forever (state infinite)
let private selfLoop = [| 0x12uy; 0x00uy |] // 1200: no change at all
let private mk rom = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom

[<Fact>]
let ``between a frame and itself is the zero delta`` () =
    let f = mk counter |> Chip8Cow.run 3
    let d = DeltaPattern.between f f
    Assert.Equal(0, d.PC)
    Assert.Empty(d.V)
    Assert.Empty(d.DisplayFlipped)

[<Fact>]
let ``the counter: state never repeats but the CHANGE pattern has period 1`` () =
    let f0 = mk counter
    // absolute state is unbounded: StateSpace truncates (infinite)
    let g = StateSpace.explore 8 12 [ none ] f0
    Assert.True(g.Truncated)
    Assert.False(StateSpace.hasCycle g) // no exact-state cycle ever
    // ...but the delta pattern repeats immediately: period 1 (the loop is found in delta-space)
    Assert.Equal(Some 1, DeltaPattern.patternPeriod 8 none 12 f0)

[<Fact>]
let ``a self-loop ROM has a zero, period-1 change pattern`` () =
    Assert.Equal(Some 1, DeltaPattern.patternPeriod 8 none 8 (mk selfLoop))

[<Fact>]
let ``distinctPatterns is finite even when the state trajectory is unbounded`` () =
    let deltas = DeltaPattern.trajectory 8 none 30 (mk counter)
    Assert.True(DeltaPattern.distinctPatterns deltas <= 3) // a handful of change-patterns, not 30 states
