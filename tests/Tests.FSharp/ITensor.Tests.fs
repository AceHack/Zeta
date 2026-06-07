module Zeta.Tests.ITensorTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Abstractions

module WS = Zeta.Core.WeightedSet

let private sr = IntegerRing.Instance

[<Fact>]
let ``WeightedSet satisfies the ITensor contract (sparse, stored support)`` () =
    let ws = WS.ofSeq sr [ "a", 1L; "b", 2L; "c", 0L ] // c pruned (Zero)
    let t = ws :> ITensor<string, int64>
    Assert.True(t.IsSparse)
    Assert.Equal(2L, t.StoredCount) // only nonzero support stored
    let entries = t.StoredEntries |> Seq.map (fun kv -> kv.Key, kv.Value) |> List.ofSeq
    Assert.Equal<(string * int64) list>([ "a", 1L; "b", 2L ], entries) // ordinal by coordinate

[<Fact>]
let ``ITensor view reflects retraction (zeroed coordinates leave the support)`` () =
    let a = WS.ofSeq sr [ "x", 5L; "y", 3L ]
    let afterRetract = WS.add sr a (WS.ofSeq sr [ "x", -5L ]) // x cancels
    let t = afterRetract :> ITensor<string, int64>
    Assert.Equal(1L, t.StoredCount)
    Assert.Equal<string list>([ "y" ], t.StoredEntries |> Seq.map (fun kv -> kv.Key) |> List.ofSeq)
