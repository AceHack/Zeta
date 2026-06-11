module Zeta.Tests.ZetaMaxTests

// The ZetaMax Spectrum render binding: the ANSI identity (SGR = 30 + colorAt mask), capability-honest
// dispatch (Mono1 white-on-black; Indexed8 literal palette), pixel-doubled ▀ lines, deterministic.

open global.Xunit
open Zeta.Core

let private frame rom =
    Chip8Cow.create 7UL
    |> Chip8Cow.loadRom rom
    |> fun f -> { f with Mem = Map.add 0x300 0xFFuy f.Mem }

let private steps n f = List.fold (fun acc _ -> Chip8Cow.step acc) f [ 1..n ]

[<Fact>]
let ``capability is honest: mono frames bind Mono1; any color plane flips to Indexed8`` () =
    let mono = frame [| 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |] |> steps 2
    Assert.Equal(ZetaMax.Mono1, ZetaMax.capabilityOf mono)
    let color = frame [| 0xF2uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |] |> steps 3
    Assert.Equal(ZetaMax.Indexed8, ZetaMax.capabilityOf color)

[<Fact>]
let ``Mono1 renders the classic look: lit pixels are WHITE (37), never red`` () =
    let mono = frame [| 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |] |> steps 2
    let top = ZetaMax.render mono |> List.head
    Assert.True(top.Contains "\u001b[37m") // white ink
    Assert.False(top.Contains "\u001b[31m") // not red, even though the mono plane is bit 0

[<Fact>]
let ``Indexed8 renders the literal palette: green plane => 32; white mask => 37`` () =
    let green = frame [| 0xF2uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |] |> steps 3
    Assert.True((ZetaMax.render green |> List.head).Contains "\u001b[32m")
    let white = frame [| 0xF7uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |] |> steps 3
    Assert.True((ZetaMax.render white |> List.head).Contains "\u001b[37m")

[<Fact>]
let ``the ZX Spectrum palette names match the mask bits exactly`` () =
    Assert.Equal("black", ZetaMax.colorName 0uy)
    Assert.Equal("red", ZetaMax.colorName 1uy)
    Assert.Equal("green", ZetaMax.colorName 2uy)
    Assert.Equal("yellow", ZetaMax.colorName 3uy)
    Assert.Equal("blue", ZetaMax.colorName 4uy)
    Assert.Equal("magenta", ZetaMax.colorName 5uy)
    Assert.Equal("cyan", ZetaMax.colorName 6uy)
    Assert.Equal("white", ZetaMax.colorName 7uy)

[<Fact>]
let ``pixel doubling: 64x32 renders as 16 lines; dark cells are plain spaces; deterministic`` () =
    let f = frame [| 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |] |> steps 2
    let lines = ZetaMax.render f
    Assert.Equal(16, List.length lines)
    Assert.Equal<string list>(lines, ZetaMax.render f) // same frame, same bytes
    Assert.True(lines |> List.last |> Seq.forall ((=) ' ')) // bottom: all dark, no SGR noise

[<Fact>]
let ``plain is the structural zero case: same layout, SGR stripped`` () =
    let f = frame [| 0xF7uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x01uy |] |> steps 3
    let mono = ZetaMax.plain f
    Assert.Equal(16, List.length mono)
    Assert.False(mono |> String.concat "" |> fun s -> s.Contains "\u001b")
    Assert.Contains("▀", List.head mono) // the lit row survives as shape
