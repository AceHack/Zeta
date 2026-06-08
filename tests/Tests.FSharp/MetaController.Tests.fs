module Zeta.Tests.MetaControllerTests

open global.Xunit
open Zeta.Core

let private trav name cost reduction : Traversal.Traversal<int> =
    { Name = name; Target = name; Cost = cost; Lenses = []; ExpectedReduction = reduction; Run = fun _ -> 0 }

let private moves = [ SoftController.none; SoftController.singleKey 6 ]

[<Fact>]
let ``available assembles affordable traversals (by VOI) + the map moves`` () =
    let cheap = trav "cheap" 2.0 10.0 // voi 5, fits budget 3
    let costly = trav "costly" 5.0 5.0 // voi 1, would overflow budget 3
    let menu = MetaController.available 3.0 [ costly; cheap ] moves
    Assert.Equal(1, MetaController.senses menu |> List.length) // only the affordable traversal
    Assert.Equal("cheap", (MetaController.senses menu |> List.head).Name)
    Assert.Equal(2, MetaController.moves menu |> List.length) // both directional moves available

[<Fact>]
let ``senses and moves partition the menu`` () =
    let menu = MetaController.available 100.0 [ trav "t" 1.0 1.0 ] moves
    Assert.Equal(1, MetaController.senses menu |> List.length)
    Assert.Equal(2, MetaController.moves menu |> List.length)
    Assert.Equal(3, List.length menu) // 1 traverse + 2 moves

[<Fact>]
let ``zero budget -> only ambient (free) traversals, still all moves`` () =
    let ambient = trav "ambient" 0.0 1.0
    let costly = trav "costly" 1.0 5.0
    let menu = MetaController.available 0.0 [ costly; ambient ] moves
    Assert.Equal<string list>([ "ambient" ], MetaController.senses menu |> List.map (fun t -> t.Name))
    Assert.Equal(2, MetaController.moves menu |> List.length)

[<Fact>]
let ``no traversals and no moves -> empty menu`` () =
    Assert.Empty(MetaController.available 10.0 ([]: Traversal.Traversal<int> list) [])
