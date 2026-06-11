module Zeta.Tests.WeaveFoldTests

// Amara's commuting-diagram-with-a-test: two streams advance independently; folding over the joined
// causal cut yields the SAME view in every valid replay order (the commutative part); concurrent
// unordered writes are PRESERVED as uncertainty (the residue), never silently erased; the weave edge,
// when it arrives, resolves residue as DATA.

open global.Xunit
open Zeta.Core

let private a1 = { WeaveFold.Stream = "A"; WeaveFold.Seq = 1; WeaveFold.Key = "x"; WeaveFold.Value = "a-old" }
let private a2 = { WeaveFold.Stream = "A"; WeaveFold.Seq = 2; WeaveFold.Key = "x"; WeaveFold.Value = "a-new" }
let private b1 = { WeaveFold.Stream = "B"; WeaveFold.Seq = 1; WeaveFold.Key = "x"; WeaveFold.Value = "b-val" }
let private b2 = { WeaveFold.Stream = "B"; WeaveFold.Seq = 1; WeaveFold.Key = "y"; WeaveFold.Value = "only" }

[<Fact>]
let ``COMMUTES: every valid replay order folds to the SAME view (the diagram does not lie)`` () =
    let orders =
        [ [ a1; a2; b1; b2 ]; [ b2; b1; a1; a2 ]; [ a1; b1; a2; b2 ]; [ b1; a1; b2; a2 ] ]
    let views = orders |> List.map WeaveFold.fold
    for v in List.tail views do
        Assert.Equal<WeaveFold.View>(List.head views, v)

[<Fact>]
let ``intra-stream causality holds: A's later write supersedes its own earlier one`` () =
    let v = WeaveFold.fold [ a1; a2; b2 ]
    Assert.Equal(Some "a-new", WeaveFold.certain "x" v) // a-old gone (same worldline), b absent here
    Assert.Equal(Some "only", WeaveFold.certain "y" v)

[<Fact>]
let ``THE RESIDUE IS PRESERVED: concurrent unordered writes stay as candidates — never last-writer-wins`` () =
    let v = WeaveFold.fold [ a1; a2; b1 ]
    Assert.True(WeaveFold.certain "x" v |> Option.isNone) // uncertain, honestly
    Assert.Equal<Set<string>>(Set.ofList [ "a-new"; "b-val" ], Map.find "x" v) // both kept

[<Fact>]
let ``the weave EDGE resolves residue as DATA: the edge arrives, certainty follows`` () =
    let v = WeaveFold.fold [ a1; a2; b1 ]
    let resolved = WeaveFold.resolve [ { Key = "x"; Winner = "a-new"; Superseded = "b-val" } ] v
    Assert.Equal(Some "a-new", WeaveFold.certain "x" resolved)
    // and resolution is order-independent too: resolve after any replay order, same answer
    let v2 = WeaveFold.fold [ b1; a2; a1 ]
    Assert.Equal<WeaveFold.View>(resolved, WeaveFold.resolve [ { Key = "x"; Winner = "a-new"; Superseded = "b-val" } ] v2)
