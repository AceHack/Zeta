module Zeta.Tests.Crdt.OrSetTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// OR-Set (moved from Round7Tests / Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``OrSet add + remove + merge`` () =
    let a = OrSet<int>.Empty.Add(1).Add(2)
    let b = OrSet<int>.Empty.Add(3)
    let merged = OrSet.Merge a b
    let values = merged.Value |> Seq.toList |> List.sort
    values |> should equal [ 1; 2; 3 ]


// ─── OrSet remove semantics (moved from Round8Tests) ─

[<Fact>]
let ``OrSet remove only retracts observed tags`` () =
    let orig = OrSet<int>.Empty.Add 1
    let after = orig.Remove 1
    after.Value |> Seq.toList |> should equal List.empty<int>
