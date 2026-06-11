module Zeta.Tests.AdinkraVizTests

// Seeing the adinkra: the gray-code 4x4 is a perfect boson/fermion checkerboard; every edge carries
// exactly one generator's color (four colors = our four channels); the SHINE selects one generator
// out of the superposition (bright in its channel, the rest dimmed) — the prism, working.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``the gray layout is lawful: grid-adjacent nodes differ in exactly one bit (every edge has ONE color)`` () =
    for row in 0..3 do
        for col in 0..2 do
            let d = AdinkraViz.nodeAt col row ^^^ AdinkraViz.nodeAt (col + 1) row
            Assert.Equal(1, System.Numerics.BitOperations.PopCount(uint d))
    for row in 0..2 do
        for col in 0..3 do
            let d = AdinkraViz.nodeAt col row ^^^ AdinkraViz.nodeAt col (row + 1)
            Assert.Equal(1, System.Numerics.BitOperations.PopCount(uint d))

[<Fact>]
let ``the boson/fermion CHECKERBOARD is visible: parity alternates at every step (filled/open)`` () =
    let lines = AdinkraViz.render None
    Assert.Equal(7, List.length lines) // 4 node rows + 3 edge rows
    let parity c r = System.Numerics.BitOperations.PopCount(uint (AdinkraViz.nodeAt c r)) % 2
    for r in 0..3 do
        for c in 0..2 do
            Assert.NotEqual(parity c r, parity (c + 1) r) // one bit flip = parity flip: checkerboard

[<Fact>]
let ``all FOUR generator colors appear (R, G, B, cyan — the N=4 chromotopology on our channels)`` () =
    let all = AdinkraViz.render None |> String.concat "\n"
    for c in [ 1; 2; 4; 6 ] do
        Assert.Contains(sprintf "[3%dm" c, all)

[<Fact>]
let ``THE SHINE: selecting a generator brightens its edges and DIMS the other three (the prism)`` () =
    let shone = AdinkraViz.render (Some 2) |> String.concat "\n"
    Assert.Contains("[34m", shone) // bit 2's color (blue, 4) still bright
    Assert.Contains("[2m", shone) // and dimming exists — the unselected generators recede
    let unshone = AdinkraViz.render None |> String.concat "\n"
    Assert.DoesNotContain("[2m", unshone) // no shine: nothing dimmed, all four live together

[<Fact>]
let ``deterministic + registered + cost-declared (the budget lint holds)`` () =
    Assert.Equal<string list>(AdinkraViz.render (Some 1), AdinkraViz.render (Some 1))
    Assert.True(GeneratorRegistry.byName "viz.adinkra" |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())
