module Zeta.Tests.SoftDashboardTests

open global.Xunit
open Zeta.Core

// FX0A waits for a key into V[0] ; I=0x300 ; store V[0] into mem[0x300]. So the pressed key's VALUE lands in
// memory => sumMemory is highest for the highest key pressed. The dashboard should glow key F (15) brightest.
let private keyToMem = [| 0xF0uy; 0x0Auy; 0xA3uy; 0x00uy; 0xF0uy; 0x55uy |]
let private start () = Chip8Cow.create 1UL |> Chip8Cow.loadRom keyToMem

[<Fact>]
let ``sumMemory fitness rises with the value written; litPixels counts the display`` () =
    let f = start ()
    Assert.True(SoftDashboard.sumMemory f > 0.0) // font + ROM bytes present
    Assert.Equal(0.0, SoftDashboard.litPixels f) // nothing drawn yet

[<Fact>]
let ``buttonGlow returns 16 fitness values, one per key`` () =
    let g = SoftDashboard.buttonGlow SoftDashboard.sumMemory 3 (start ())
    Assert.Equal(16, g.Length)

[<Fact>]
let ``bestButton glows the key whose future maximises the fitness (press F -> most memory)`` () =
    // pressing key k writes k into mem[0x300]; higher k => higher sumMemory => key F (15) is brightest.
    let best = SoftDashboard.bestButton SoftDashboard.sumMemory 3 (start ())
    Assert.Equal(0xF, best)
    let g = SoftDashboard.buttonGlow SoftDashboard.sumMemory 3 (start ())
    Assert.True(g.[0xF] > g.[0x0]) // F brighter than 0

[<Fact>]
let ``the 4x4 keypad grid is the 16 hex keys`` () =
    let keys = SoftDashboard.keypad |> Array.collect id |> Array.sort
    Assert.Equal<int[]>([| 0..15 |], keys)
    Assert.Equal(4, SoftDashboard.keypad.Length)
    Assert.True(SoftDashboard.keypad |> Array.forall (fun row -> row.Length = 4))

[<Fact>]
let ``glowGrid projects the glow onto the 4x4 layout`` () =
    let grid = SoftDashboard.glowGrid SoftDashboard.sumMemory 3 (start ())
    Assert.Equal(4, grid.Length)
    // the (key,glow) for key F should be the brightest cell
    let allCells = grid |> Array.collect id
    let brightest = allCells |> Array.maxBy snd |> fst
    Assert.Equal(0xF, brightest)

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    Assert.Equal<float[]>(
        SoftDashboard.buttonGlow SoftDashboard.sumMemory 3 (start ()),
        SoftDashboard.buttonGlow SoftDashboard.sumMemory 3 (start ()))

[<Fact>]
let ``empowerment (unsupervised): a branchy state has more reachable futures than a halt`` () =
    // branchy: E09E forks the future (input matters) => >1 distinct reachable state.
    let branchy = Chip8Cow.create 1UL |> Chip8Cow.loadRom [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy |] |> Chip8Cow.step
    // halt: 1200 jumps to itself forever => exactly 1 reachable state.
    let halt = Chip8Cow.create 1UL |> Chip8Cow.loadRom [| 0x12uy; 0x00uy |]
    Assert.True(SoftDashboard.empowerment 3 branchy > SoftDashboard.empowerment 3 halt)
    Assert.Equal(1.0, SoftDashboard.empowerment 3 halt) // stuck = zero agency (one reachable state)

[<Fact>]
let ``empowerment works as a no-supplied-fitness dashboard objective`` () =
    let f = Chip8Cow.create 1UL |> Chip8Cow.loadRom [| 0x60uy; 0x00uy; 0xE0uy; 0x9Euy |] |> Chip8Cow.step
    let g = SoftDashboard.buttonGlow (SoftDashboard.empowerment 2) 1 f
    Assert.Equal(16, g.Length) // glows by intrinsic agency, no external reward needed
