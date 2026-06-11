module Zeta.Tests.StrokeAnimTests

// The living stroke: the head rides the certain/uncertain edge; the foreseen future is visibly
// provisional; cells recolor foreseen->head->drawn as the wave advances — uncertainty becoming
// certain pixel by pixel, deterministically.

open global.Xunit
open Zeta.Core

let private curve: BoundaryLight.Curve =
    [ for i in 0..9 -> BoundaryLight.p i (i * 2) ]

let private phases tick =
    StrokeAnim.strokeAt 1 tick curve |> List.map snd

[<Fact>]
let ``exactly ONE head at every tick — the wave front is a single riding edge`` () =
    for t in 0..12 do
        Assert.Equal(1, phases t |> List.filter ((=) StrokeAnim.Head) |> List.length)

[<Fact>]
let ``the wave advances: drawn grows, foreseen shrinks, and the end is fully committed`` () =
    let drawn t = phases t |> List.filter ((=) StrokeAnim.Drawn) |> List.length
    let foreseen t = phases t |> List.filter ((=) StrokeAnim.Foreseen) |> List.length
    Assert.Equal(0, drawn 0)
    Assert.Equal(9, foreseen 0) // at t0 the whole future is provisional
    Assert.True(drawn 5 > drawn 2 && foreseen 5 < foreseen 2) // the recoloring wave moves
    Assert.Equal(9, drawn 20) // past the end: everything committed
    Assert.Equal(0, foreseen 20) // no future left — uncertainty fully became certain

[<Fact>]
let ``recoloring is honest: the past keeps full color at certainty; the future is blue and provisional`` () =
    Assert.Equal((6uy, 0), StrokeAnim.recolor 6uy StrokeAnim.Drawn) // committed cyan, certain
    Assert.Equal((7uy, 0), StrokeAnim.recolor 6uy StrokeAnim.Head) // the edge burns white
    Assert.Equal((4uy, 900), StrokeAnim.recolor 6uy StrokeAnim.Foreseen) // the future: visibly uncertain

[<Fact>]
let ``stroked cells pack into deep pixels: provenance in the payload, honesty in the uncertainty`` () =
    let c = StrokeAnim.toCell 6uy 7 StrokeAnim.Foreseen
    Assert.Equal(4uy, PixelLens.color.Get c)
    Assert.Equal(7, PixelLens.payload.Get c) // the curve index rides the pixel
    Assert.Equal(900, PixelLens.uncertainty.Get c)
    // and as the wave passes, the SAME cell recolors to committed
    let after = StrokeAnim.toCell 6uy 7 StrokeAnim.Drawn
    Assert.Equal(6uy, PixelLens.color.Get after)
    Assert.Equal(0, PixelLens.uncertainty.Get after)

[<Fact>]
let ``deterministic at every tick (replayable; two watchers see the same wave)`` () =
    for t in [ 0; 3; 9; 15 ] do
        Assert.Equal<(BoundaryLight.P * StrokeAnim.Phase) list>(StrokeAnim.strokeAt 2 t curve, StrokeAnim.strokeAt 2 t curve)

// ── index formats: ZetaId-defined, each with a visualization ──

[<Fact>]
let ``every index format is ZetaId-defined, distinct, and resolvable by id`` () =
    let ids = IndexFormat.known |> List.map (fun f -> f.Entry.ZetaId)
    Assert.Equal(5, List.length ids)
    Assert.Equal(List.length ids, List.distinct ids |> List.length)
    for f in IndexFormat.known do
        Assert.Equal(Some f.Entry.Name, IndexFormat.byId f.Entry.ZetaId |> Option.map (fun x -> x.Entry.Name))

[<Fact>]
let ``every index format has a visualization — an 8-row glyph, distinct per structure`` () =
    for f in IndexFormat.known do
        Assert.Equal(8, f.Glyph.Length)
    let glyphs = IndexFormat.known |> List.map (fun f -> f.Glyph |> Array.toList)
    Assert.Equal(List.length glyphs, List.distinct glyphs |> List.length) // each structure its own face

[<Fact>]
let ``a format drops into any surface as MediaLines (glyph + zetaid meta) and passes the lint`` () =
    let entries = IndexFormat.toMediaLines IndexFormat.zset
    let doc: MediaLines.Doc = { Entries = entries }
    Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint doc)
    Assert.Equal("glyph", entries.[0].Kind)
    Assert.Equal(32, entries.[1].Fields.Head.Length)

// ── calculus riding the wave: derivative + integral at the head, one tick at a time ──

[<Fact>]
let ``the derivative rides the head: y = 2x has constant slope (1,2); before drawing, honestly None`` () =
    let line: BoundaryLight.Curve = [ for x in 0..8 -> BoundaryLight.p x (2 * x) ]
    Assert.Equal(None, StrokeAnim.derivativeAt 1 0 line) // one point: no slope yet
    for t in 1..8 do
        Assert.Equal(Some(1, 2), StrokeAnim.derivativeAt 1 t line) // the cursor reads dy/dx = 2, every tick

[<Fact>]
let ``the integral accumulates as the wave commits: 2×area under y=2x from 0..n is exactly 2n²`` () =
    let line: BoundaryLight.Curve = [ for x in 0..8 -> BoundaryLight.p x (2 * x) ]
    for t in 1..8 do
        Assert.Equal(2 * t * t, StrokeAnim.integralTo 1 t line) // trapezoid-exact, integer, tickwise
    Assert.Equal(0, StrokeAnim.integralTo 1 0 line) // nothing drawn, nothing integrated

[<Fact>]
let ``no peeking past the wave: the integral at tick t ignores the foreseen future entirely`` () =
    let bent: BoundaryLight.Curve = [ BoundaryLight.p 0 0; BoundaryLight.p 2 4; BoundaryLight.p 4 0; BoundaryLight.p 6 100 ]
    Assert.Equal(2 * 4, StrokeAnim.integralTo 1 1 bent) // only the first segment counts (2×trap = 2*(0+4)/2*2)
    let atTwo = StrokeAnim.integralTo 1 2 bent
    Assert.True(atTwo < StrokeAnim.integralTo 1 3 bent) // the wild future lands only when committed

// ── layout engines: ZetaId'd; the treemap tiles the boundary exactly ──

[<Fact>]
let ``the layout shelf is ZetaId'd and distinct (treemap/defrag/dag/timeline/force)`` () =
    let ids = LayoutEngine.known |> List.map (fun e -> e.ZetaId)
    Assert.Equal(5, List.length (List.distinct ids))

[<Fact>]
let ``slice-and-dice tiles the boundary EXACTLY: no pixel lost, no pixel invented, weights honored`` () =
    let rects = LayoutEngine.treemap 0 0 64 32 true [ "merkle", 3; "saves", 1; "quotes", 4 ]
    Assert.Equal(64, rects |> List.sumBy (fun r -> r.W)) // the boundary is tiled, exactly
    Assert.True(rects |> List.forall (fun r -> r.H = 32))
    let q = rects |> List.find (fun r -> r.Name = "quotes")
    let s = rects |> List.find (fun r -> r.Name = "saves")
    Assert.True(q.W > s.W) // weight shows as area (the WinDirStat truth)
    // adjacency: each box starts where the last ended (boundary-aware, no gaps)
    let sorted = rects |> List.sortBy (fun r -> r.X)
    for (a, b) in List.pairwise sorted do
        Assert.Equal(a.X + a.W, b.X)

// ── Big-O required: proven or derived, never unstated (the budget lint) ──

[<Fact>]
let ``THE REQUIREMENT HOLDS: no registered artifact has entirely unstated complexity`` () =
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())

[<Fact>]
let ``costs carry provenance — first pass is Derived; the math team's docket upgrades to Proven`` () =
    let treemap = Map.find ("layout.treemap", "treemap") ComplexityRegistry.declared
    Assert.Equal("O(n)", treemap.Time)
    Assert.Equal(ComplexityRegistry.Derived, treemap.By) // honest: derived by inspection, not yet proven

[<Fact>]
let ``entropy-held is optional and declared: saves holds state, persona rooms hold identity, absence = none`` () =
    Assert.True(Map.containsKey "saves" ComplexityRegistry.entropyHeld)
    Assert.True(Map.containsKey "rooms.persona" ComplexityRegistry.entropyHeld)
    Assert.False(Map.containsKey "audio.saw" ComplexityRegistry.entropyHeld) // a pure waveform holds nothing
