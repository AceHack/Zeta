module Zeta.Tests.Formal.CoEmpowerGraphTests

open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module G = Zeta.Core.CoEmpowerGraph

// ═══════════════════════════════════════════════════════════════════
// CoEmpowerGraph — CoEmpowerField generalized to a generic
// network<>creator<>audience graph. Same NCI/co-empowerment/DST dynamics
// on an adjacency graph; + the creator/audience role layer (anti-capture).
// ═══════════════════════════════════════════════════════════════════

/// A degree-4 ring (neighbors ±1, ±2), all Audience — the graph analogue of the grid.
let private ring (n: int) (kinds: int) (sd: int) : G.Graph =
    let adj =
        Array.init n (fun i -> [| (i + n - 2) % n; (i + n - 1) % n; (i + 1) % n; (i + 2) % n |])
    G.seed kinds sd adj (Array.create n G.Audience)

/// The 2D grid expressed AS a generic graph — the proven-collapsing topology from `CoEmpowerField`, run
/// through the graph generalization (so the keystone test reproduces the field result on the same topology).
let private gridGraph (w: int) (h: int) (kinds: int) (sd: int) : G.Graph =
    let idx x y = y * w + x
    let adj =
        Array.init (w * h) (fun i ->
            let x = i % w
            let y = i / w
            [| if x > 0 then idx (x - 1) y
               if x < w - 1 then idx (x + 1) y
               if y > 0 then idx x (y - 1)
               if y < h - 1 then idx x (y + 1) |])
    G.seed kinds sd adj (Array.create (w * h) G.Audience)

/// A star: node 0 = Creator (id 1); nodes 1..4 = Audience (id 2); centre joined to every leaf.
let private star () : G.Graph =
    { G.N = 5
      G.Identity = [| 1; 2; 2; 2; 2 |]
      G.Adjacency = [| [| 1; 2; 3; 4 |]; [| 0 |]; [| 0 |]; [| 0 |]; [| 0 |] |]
      G.Role = [| G.Creator; G.Audience; G.Audience; G.Audience; G.Audience |] }

[<Property>]
let ``DST: seed + run is deterministic on a graph`` (sd: int) =
    let a = (ring 12 4 sd |> G.run 1 4).Identity
    let b = (ring 12 4 sd |> G.run 1 4).Identity
    a = b

[<Fact>]
let ``the NCI keystone on a GRAPH: non-coercion blossoms, coercion collapses`` () =
    let g0 = gridGraph 14 14 4 42
    let blossomed = G.run 1 8 g0 |> G.health
    let collapsed = List.fold (fun acc _ -> G.coerce acc) g0 [ 1 .. 12 ] |> G.health
    blossomed.Diversity |> should be (greaterThanOrEqualTo 2)
    blossomed.Blossom |> should be (greaterThan 0.0)
    collapsed.Blossom |> should be (lessThan blossomed.Blossom)

[<Fact>]
let ``role anti-capture: a Creator is NOT captured by its audience; the audience adopts the creator (non-coercive reach)`` () =
    let g1 = G.step 0 (star ())
    g1.Identity.[0] |> should equal 1 // creator held its identity — the audience cannot capture it
    for i in 1..4 do
        g1.Identity.[i] |> should equal 1 // each audience leaf adopted the creator's identity (consent, not capture)

[<Fact>]
let ``contrast: an Audience centre DOES adopt its neighbourhood (no anti-capture for audiences)`` () =
    let g = { star () with G.Role = Array.create 5 G.Audience }
    let g1 = G.step 0 g
    g1.Identity.[0] |> should equal 2 // an audience centre, surrounded by id-2, adopts 2

[<Fact>]
let ``co-empowerment favours a diverse neighbourhood over a monoculture one`` () =
    let mono =
        { G.N = 2; G.Identity = [| 1; 1 |]; G.Adjacency = [| [| 1 |]; [| 0 |] |]; G.Role = Array.create 2 G.Audience }
    G.coEmpowerment mono 0 1 |> should equal 1 // support 1, optionSpace 1 → 1
    let diverse =
        { G.N = 5
          G.Identity = [| 0; 1; 1; 2; 2 |]
          G.Adjacency = [| [| 1; 2; 3; 4 |]; [| 0 |]; [| 0 |]; [| 0 |]; [| 0 |] |]
          G.Role = Array.create 5 G.Audience }
    G.coEmpowerment diverse 0 1 |> should equal 2 // support 2 (two 1s), optionSpace 2 ({1,2}) → 2

[<Fact>]
let ``CreatorReach captures non-coercive creator influence that landed`` () =
    let g1 = G.step 0 (star ()) // audience all adopted the creator's id
    let h = G.health g1
    h.CreatorReach |> should (equalWithin 1e-9) 1.0
