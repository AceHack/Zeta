module Zeta.Tests.GlobalsTests

open global.Xunit
open Zeta.Core

module G = Zeta.Core.Globals

let private s (x: string) = DynamicValue.String x

/// patient/1/name=Ada, patient/1/enc/1=visit-a, patient/1/enc/2=visit-b, patient/2/name=Grace
let private sample () =
    G.empty
    |> G.set [ "patient"; "1"; "name" ] (s "Ada")
    |> G.set [ "patient"; "1"; "enc"; "1" ] (s "visit-a")
    |> G.set [ "patient"; "1"; "enc"; "2" ] (s "visit-b")
    |> G.set [ "patient"; "2"; "name" ] (s "Grace")

[<Fact>]
let ``set then get round-trips a value at a subscript path`` () =
    let g = sample ()
    Assert.Equal<DynamicValue option>(Some(s "Ada"), G.get [ "patient"; "1"; "name" ] g)
    Assert.Equal<DynamicValue option>(None, G.get [ "patient"; "1"; "missing" ] g)
    Assert.Equal<DynamicValue option>(None, G.get [ "patient"; "1"; "name"; "deeper" ] g) // through a leaf

[<Fact>]
let ``kill removes the node and all descendants (subtree)`` () =
    let g = sample () |> G.kill [ "patient"; "1" ]
    Assert.Equal<DynamicValue option>(None, G.get [ "patient"; "1"; "name" ] g)
    Assert.Equal<DynamicValue option>(None, G.get [ "patient"; "1"; "enc"; "1" ] g)
    Assert.Equal<DynamicValue option>(Some(s "Grace"), G.get [ "patient"; "2"; "name" ] g) // sibling untouched

[<Fact>]
let ``data reports 0/1/10 by leaf-xor-object status`` () =
    let g = sample ()
    Assert.Equal(0, G.data [ "patient"; "9" ] g) // undefined
    Assert.Equal(1, G.data [ "patient"; "1"; "name" ] g) // scalar leaf
    Assert.Equal(10, G.data [ "patient"; "1"; "enc" ] g) // object node (children)
    Assert.Equal(10, G.data [ "patient"; "1" ] g) // object node

[<Fact>]
let ``nextChild iterates immediate subscripts in ordinal order ($ORDER)`` () =
    let g = sample ()
    Assert.Equal<string option>(Some "1", G.nextChild [ "patient" ] None g) // first child
    Assert.Equal<string option>(Some "2", G.nextChild [ "patient" ] (Some "1") g) // next after "1"
    Assert.Equal<string option>(None, G.nextChild [ "patient" ] (Some "2") g) // end
    Assert.Equal<string option>(Some "1", G.nextChild [ "patient"; "1"; "enc" ] None g)
    Assert.Equal<string option>(Some "2", G.nextChild [ "patient"; "1"; "enc" ] (Some "1") g)

[<Fact>]
let ``nextNode walks every defined leaf depth-first ($QUERY) and terminates`` () =
    let g = sample ()

    let rec walk acc (p: G.Path) =
        match G.nextNode p g with
        | Some n -> walk (n :: acc) n
        | None -> List.rev acc

    let all = walk [] []
    Assert.Equal(4, List.length all)
    // ordinal-path order: "enc" subscripts sort before "name" ('e' < 'n')
    Assert.Equal<G.Path>([ "patient"; "1"; "enc"; "1" ], List.head all)
    Assert.Equal<G.Path>([ "patient"; "2"; "name" ], List.last all)

[<Fact>]
let ``children lists deduped ordinal immediate subscripts; count is leaf count`` () =
    let g = sample ()
    Assert.Equal<string list>([ "1"; "2" ], G.children [ "patient" ] g)
    Assert.Equal<string list>([ "1"; "2" ], G.children [ "patient"; "1"; "enc" ] g)
    Assert.Equal<string list>([], G.children [ "patient"; "1"; "name" ] g) // leaf has no children
    Assert.Equal(4, G.count g)

[<Fact>]
let ``set is leaf-agnostic (heterogeneous leaves) and SET-wins replaces an object with a leaf`` () =
    // leaf-agnostic: an Int leaf and a String leaf coexist (toward SoftValue leaves = soft tensor)
    let g =
        G.empty
        |> G.set [ "w"; "layer0" ] (DynamicValue.Int 42L)
        |> G.set [ "w"; "layer1"; "bias" ] (s "b")

    Assert.Equal<DynamicValue option>(Some(DynamicValue.Int 42L), G.get [ "w"; "layer0" ] g)
    // SET over an object path replaces it with the scalar (MUMPS SET wins)
    let g2 = g |> G.set [ "w"; "layer1" ] (DynamicValue.Int 7L)
    Assert.Equal<DynamicValue option>(Some(DynamicValue.Int 7L), G.get [ "w"; "layer1" ] g2)
    Assert.Equal<DynamicValue option>(None, G.get [ "w"; "layer1"; "bias" ] g2) // children gone
