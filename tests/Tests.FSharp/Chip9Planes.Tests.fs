module Zeta.Tests.Chip9PlanesTests

// CHIP-9 color planes (operator-ratified name): Fn01 plane select, per-plane XOR draw, selected-plane
// CLS — ZERO-CASE STRUCTURAL: mono IS plane 1 (original ROMs bit-identical), and 3 planes = 8 colors =
// exactly the ZX Spectrum palette ("ZetaMax Spectrum color"). Black-and-white to color — the Oz cut.

open global.Xunit
open Zeta.Core

let private frame rom = Chip8Cow.create 7UL |> Chip8Cow.loadRom rom

// sprite: one 8-pixel row at I=0x300 (we poke it via the ROM area + LD I)
// ROM helper: A3 00 (I=0x300) requires sprite bytes AT 0x300 — place program at 0x200, sprite via mem write.
let private withSprite (f: Chip8Cow.Frame) =
    { f with Mem = Map.add 0x300 0xFFuy f.Mem } // 8 solid pixels

[<Fact>]
let ``ZERO CASE: a mono ROM never touches planes — Display semantics and Extra emptiness are bit-identical`` () =
    // classic draw: I=0x300, DRW V0,V0,1
    let rom = [| 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |]
    let f = frame rom |> withSprite |> Chip8Cow.step |> Chip8Cow.step
    Assert.True(Chip8Cow.pixel 0 0 f) // lit, the original path
    Assert.Equal(1uy, f.Plane) // default plane mask untouched
    Assert.True(Map.isEmpty f.Extra) // no high planes ever materialize
    Assert.Equal(1uy, Chip8Cow.colorAt 0 0 f) // color reads { lit => 1 } — mono IS plane 1

[<Fact>]
let ``Fn01 selects planes (masked to 0..7); original decode space untouched`` () =
    let rom = [| 0xF2uy; 0x01uy |] // plane mask = 2 (G)
    let f = frame rom |> Chip8Cow.step
    Assert.Equal(2uy, f.Plane)
    let rom7 = [| 0xF7uy; 0x01uy |]
    Assert.Equal(7uy, (frame rom7 |> Chip8Cow.step).Plane)

[<Fact>]
let ``drawing on the GREEN plane leaves the mono plane untouched — and colorAt sees the channel`` () =
    let rom = [| 0xF2uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |]
    let f = frame rom |> withSprite |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step
    Assert.False(Chip8Cow.pixel 0 0 f) // mono plane: dark (every existing consumer unaffected)
    Assert.Equal(2uy, Chip8Cow.colorAt 0 0 f) // the green channel is lit
    Assert.Equal(0uy, f.V.[0xF]) // no collision on first draw

[<Fact>]
let ``RGB: mask 7 draws all three planes at once — 8-color ZetaMax Spectrum palette reachable`` () =
    let rom = [| 0xF7uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |]
    let f = frame rom |> withSprite |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step
    Assert.Equal(7uy, Chip8Cow.colorAt 0 0 f) // white (R|G|B)
    Assert.True(Chip8Cow.pixel 0 0 f) // mono plane participates (bit 0)

[<Fact>]
let ``XOR cycle on a high plane returns to CANONICAL empty (zero => absent; map equality stays honest)`` () =
    let rom = [| 0xF2uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy; 0xD0uy; 0x01uy |]
    let f = frame rom |> withSprite |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step
    let f2 = Chip8Cow.step f // second draw erases
    Assert.Equal(1uy, f2.V.[0xF]) // collision reported (pixels toggled off)
    Assert.True(Map.isEmpty f2.Extra) // canonical: zero bits => entry removed
    Assert.Equal(0uy, Chip8Cow.colorAt 0 0 f2)

[<Fact>]
let ``CLS clears only the SELECTED planes — green survives a red-plane clear`` () =
    // draw green; select plane 1 (R); CLS
    let rom = [| 0xF2uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy; 0xF1uy; 0x01uy; 0x00uy; 0xE0uy |]
    let f =
        frame rom |> withSprite
        |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step
    Assert.Equal(2uy, Chip8Cow.colorAt 0 0 f) // green untouched by the red clear
    // now clear with mask 7 (everything)
    let romAll = [| 0xF2uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy; 0xF7uy; 0x01uy; 0x00uy; 0xE0uy |]
    let g =
        frame romAll |> withSprite
        |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step |> Chip8Cow.step
    Assert.Equal(0uy, Chip8Cow.colorAt 0 0 g)
    Assert.True(Map.isEmpty g.Extra)
