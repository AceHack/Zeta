module Zeta.Tests.SoftScopeTests

open global.Xunit
open Zeta.Core

let private blank () = Chip8Cow.create 1UL |> SoftEmu.pure1

[<Fact>]
let ``intensityChar maps 0 to blank and 1 to the brightest glyph, monotonically`` () =
    Assert.Equal(' ', SoftScope.intensityChar 0.0)
    Assert.Equal('@', SoftScope.intensityChar 1.0)
    Assert.True(SoftScope.intensityChar 0.1 <= SoftScope.intensityChar 0.9) // brighter for higher p (ASCII order)

[<Fact>]
let ``renderGhost is DisplayH lines each DisplayW wide`` () =
    let lines = (SoftScope.renderGhost (blank ())).Split('\n')
    Assert.Equal(Chip8.DisplayH, lines.Length)
    Assert.All(lines, fun l -> Assert.Equal(Chip8.DisplayW, l.Length))

[<Fact>]
let ``a blank display renders all spaces (E[lit] = 0)`` () =
    let s = blank ()
    Assert.Equal(0.0, SoftScope.expectedLitPixels s, 9)
    Assert.True((SoftScope.renderGhost s) |> Seq.forall (fun c -> c = ' ' || c = '\n'))

[<Fact>]
let ``observables reports support and is culture-invariant (uses a dot decimal)`` () =
    let o = SoftScope.observables (blank ())
    Assert.Contains("support=1", o)
    Assert.Contains("entropy=0.000", o) // invariant culture -> dot, not comma

[<Fact>]
let ``a lit pixel shows up bright in the ghost (drawn sprite -> nonzero intensity)`` () =
    // ROM: A200 (I=0x200) D005 draws 5-row sprite at (V0,V1)=(0,0) using bytes at I (the ROM's own bytes)
    let rom = [| 0xA2uy; 0x00uy; 0xD0uy; 0x05uy |]
    let drawn = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom |> Chip8Cow.run 2 |> SoftEmu.pure1
    Assert.True(SoftScope.expectedLitPixels drawn > 0.0) // something got drawn
    Assert.Contains("@", SoftScope.renderGhost drawn) // a definite (p=1) lit pixel renders brightest
