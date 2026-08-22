module Zeta.Tests.ZetaIdVizTests

// Every ZetaId category is visible: category -> CHIP-9 color (the at-a-glance channel), id bits ->
// a mirror-symmetric identicon glyph (the id IS the picture). Deterministic everywhere; registered
// as a generator (zetaid.glyph) so filetypes reference the visualizer by ZetaId too.

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.ZetaId

[<Fact>]
let ``every registered category has a color — none invisible (total, at a glance)`` () =
    let cats =
        [ Category.Observation; Category.Emission; Category.Workflow; Category.Heartbeat
          Category.Batch; Category.FrictionTelemetry; Category.Bus; Category.Spawn
          Category.WorkItem; Category.ContentAddress; Category.Extended ]
    for c in cats do
        let m = ZetaIdViz.colorOf c
        Assert.True(m >= 1uy && m <= 7uy) // a real CHIP-9 color, never black/invisible

[<Fact>]
let ``the glyph is deterministic and mirror-symmetric (the id IS the picture; the face reads as a face)`` () =
    let id = System.UInt128.op_Implicit 0xDEADBEEFCAFEUL
    let g1 = ZetaIdViz.glyphOf id
    Assert.Equal<byte[]>(g1, ZetaIdViz.glyphOf id)
    Assert.Equal(8, g1.Length)
    // mirror symmetry: bit i of the left half equals bit (7-i) overall
    for row in g1 do
        for b in 0..7 do
            let l = (row >>> (7 - b)) &&& 1uy
            let r = (row >>> b) &&& 1uy
            Assert.Equal(l, r)

[<Fact>]
let ``distinct ids draw distinct glyphs (the discriminating pair)`` () =
    Assert.NotEqual<byte[]>(
        ZetaIdViz.glyphOf (System.UInt128.op_Implicit 0x12345678UL),
        ZetaIdViz.glyphOf (System.UInt128.op_Implicit 0x87654321UL))

[<Fact>]
let ``the visualizer is itself a registered generator — referenceable by ZetaId (shape A)`` () =
    let e = GeneratorRegistry.byName "zetaid.glyph" |> Option.get
    Assert.Equal(32, e.ZetaId.Length)
    Assert.Equal(Some e, GeneratorRegistry.byId e.ZetaId)

[<Fact>]
let ``toMediaLines emits the consumable artifact: a glyph row + the category's palette row`` () =
    let entries = ZetaIdViz.toMediaLines "bus-7" Category.Bus (System.UInt128.op_Implicit 0xC0FFEEUL)
    Assert.Equal(2, List.length entries)
    Assert.Equal("glyph", entries.[0].Kind)
    Assert.Equal(16, entries.[0].Fields.Head.Length) // 8 bytes hex
    Assert.Equal("4", entries.[1].Fields.Head) // Bus = blue
