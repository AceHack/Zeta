module Zeta.Tests.GridBindingTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``ofLabels binds cells in order; labelAt reads them back`` () =
    let g = GridBinding.ofLabels [ "a"; "b"; "c" ]
    Assert.Equal(Some "a", GridBinding.labelAt 0 g)
    Assert.Equal(Some "b", GridBinding.labelAt 1 g)
    Assert.Equal(None, GridBinding.labelAt 5 g)
    Assert.Equal(3, GridBinding.count g)

[<Fact>]
let ``bind/labelAt roundtrip; out-of-range is ignored`` () =
    let g = GridBinding.empty |> GridBinding.bind 7 "x" |> GridBinding.bind 99 "ignored"
    Assert.Equal(Some "x", GridBinding.labelAt 7 g)
    Assert.Equal(1, GridBinding.count g)

[<Fact>]
let ``atGrid uses the same 4x4 index transform as ActionGrammar (the homoiconic geometry)`` () =
    // cell index 6 = grid (row 1, col 2) per ActionGrammar.ofGrid; the transform is shared
    let g = GridBinding.bind (ActionGrammar.ofGrid 1 2) "here" GridBinding.empty
    Assert.Equal(Some "here", GridBinding.atGrid 1 2 g)

[<Fact>]
let ``homoiconic: the SAME grid type/geometry labels game keys OR meta-actions`` () =
    // game binding: cells -> key indices
    let game: GridBinding.GridBinding<int> = GridBinding.ofLabels [ 0; 1; 2; 3 ]
    // dashboard binding: cells -> meta-action labels (strings here) — same type, same index transforms
    let dash: GridBinding.GridBinding<string> = GridBinding.ofLabels [ "traverse-x"; "move-up" ]
    // cell 0 transforms identically in both spaces (the index is the invariant)
    Assert.Equal(Some 0, GridBinding.labelAt 0 game)
    Assert.Equal(Some "traverse-x", GridBinding.labelAt 0 dash)
    Assert.Equal(GridBinding.atGrid 0 0 game |> Option.isSome, GridBinding.atGrid 0 0 dash |> Option.isSome)

[<Fact>]
let ``bindSalient lays the top-k salient items onto the controller (observe.ts dashboard)`` () =
    let item p objs : Salience.Item<string> = { Payload = p; LivenessCritical = false; Objectives = Map.ofList objs }
    let items = [ item "low" [ "u", 1.0 ]; item "high" [ "u", 9.0 ]; item "mid" [ "u", 5.0 ] ]
    let g = GridBinding.bindSalient 2 (Map.ofList [ "u", 1.0 ]) items
    Assert.Equal(2, GridBinding.count g)
    Assert.Equal(Some "high", GridBinding.labelAt 0 g) // highest salience on the first cell
    Assert.Equal(Some "mid", GridBinding.labelAt 1 g)

[<Fact>]
let ``ofLabels truncates to the 16-cell grid`` () =
    let g = GridBinding.ofLabels [ for i in 1..30 -> string i ]
    Assert.Equal(GridBinding.Size, GridBinding.count g)
