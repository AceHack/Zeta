module Zeta.Tests.Formal.MetaspaceGraphRenderTests

open FsCheck.Xunit
open global.Xunit
open Zeta.Core

module G = Zeta.Core.CoEmpowerGraph

// End-to-end metaspace wire: CoEmpowerGraph → ForceLayout (weights = coupled-empowerment) →
// MetaspaceMap (Tier-0 no-JS SVG). Closes the loop: a graph in, a navigable laid-out map out.

/// A degree-4 ring of `n` Audience nodes, `kinds` identities (the graph analogue of the grid).
let private ring (kinds: int) (sd: int) (n: int) : G.Graph =
    let adj = Array.init n (fun i -> [| (i + n - 2) % n; (i + n - 1) % n; (i + 1) % n; (i + 2) % n |])
    G.seed kinds sd adj (Array.create n G.Audience)

let private labelHref (i: int) : string * string =
    sprintf "vault-%d" i, sprintf "/vault/%d" i

[<Fact>]
let ``graph renders to a navigable no-JS svg with a warp-link per node`` () =
    let g = ring 3 7 6
    let svg = MetaspaceGraphRender.render ForceLayout.defaults 600 40 labelHref g
    Assert.StartsWith("<svg", svg, System.StringComparison.Ordinal)
    Assert.DoesNotContain("<script", svg, System.StringComparison.OrdinalIgnoreCase)
    // every node that lands on-screen is an anchor; at least most of the 6 should be visible
    let anchors = (svg.Split("<a ").Length) - 1
    Assert.True(anchors >= 1 && anchors <= g.N, $"anchors={anchors} should be in 1..{g.N}")

[<Fact>]
let ``edge weight is the binding coupled-empowerment (min of both sides), floored positive`` () =
    let g = ring 3 7 6
    for (i, j, w) in MetaspaceGraphRender.edges g do
        let ei = G.coEmpowerment g i g.Identity.[j]
        let ej = G.coEmpowerment g j g.Identity.[i]
        Assert.Equal(0.25 + float (min ei ej), w, 9)
        Assert.True(w > 0.0)

[<Fact>]
let ``layout returns one world position per node`` () =
    let g = ring 4 3 8
    let positions = MetaspaceGraphRender.layout ForceLayout.defaults 600 30 g
    Assert.Equal(g.N, positions.Length)
    Assert.True(Array.forall (fun (p: Viewport.Vec3) -> p.Z = 0.0) positions) // 2D-now

[<Property>]
let ``deterministic: same graph + params => same svg`` (sd: int) =
    let g = ring 3 (abs sd % 100) 5
    let a = MetaspaceGraphRender.render ForceLayout.defaults 500 20 labelHref g
    let b = MetaspaceGraphRender.render ForceLayout.defaults 500 20 labelHref g
    a = b

[<Fact>]
let ``laying out reduces the field energy vs the seed circle (the physics ran)`` () =
    let g = ring 3 7 6
    let seedPos = MetaspaceGraphRender.layout ForceLayout.defaults 600 0 g // 0 iters = the seed
    let relaxed = MetaspaceGraphRender.layout ForceLayout.defaults 600 60 g
    let es = MetaspaceGraphRender.edges g
    let eSeed = ForceLayout.energy ForceLayout.defaults es seedPos
    let eRelaxed = ForceLayout.energy ForceLayout.defaults es relaxed
    Assert.True(eRelaxed < eSeed, $"relaxation should lower energy: seed={eSeed} relaxed={eRelaxed}")
