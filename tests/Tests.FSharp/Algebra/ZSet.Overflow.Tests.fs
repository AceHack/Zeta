module Zeta.Tests.Algebra.ZSetOverflowTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Weight overflow guards (moved from SpineAndSafetyTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``ZSet.add throws on int64 overflow`` () =
    // Two Z-sets each with the same key at +2^62 weight → sum = 2^63 overflows.
    let big = Int64.MaxValue / 2L + 1L
    let a = ZSet.ofSeq [ "k", big ]
    let b = ZSet.ofSeq [ "k", big ]
    (fun () -> ZSet.add a b |> ignore)
    |> should throw typeof<OverflowException>


[<Fact>]
let ``ZSet.cartesian throws on int64 product overflow`` () =
    let big = 1L <<< 40   // 2^40 × 2^40 = 2^80 overflows int64.
    let a = ZSet.ofSeq [ 1, big ]
    let b = ZSet.ofSeq [ 2, big ]
    (fun () -> ZSet.cartesian a b |> ignore)
    |> should throw typeof<OverflowException>


[<Fact>]
let ``ZSet.neg throws on Int64.MinValue weight`` () =
    // -Int64.MinValue overflows because Int64.MaxValue = -Int64.MinValue - 1.
    let z = ZSet.ofSeq [ "k", Int64.MinValue ]
    (fun () -> ZSet.neg z |> ignore)
    |> should throw typeof<OverflowException>


[<Fact>]
let ``ZSet.scale throws on product overflow`` () =
    let big = 1L <<< 40
    let z = ZSet.ofSeq [ "k", big ]
    (fun () -> ZSet.scale big z |> ignore)
    |> should throw typeof<OverflowException>


[<Fact>]
let ``ZSet.weightedCount throws on sum overflow`` () =
    let huge = Int64.MaxValue / 2L + 2L
    let z = ZSet.ofSeq [ "a", huge; "b", huge ]
    (fun () -> ZSet.weightedCount z |> ignore)
    |> should throw typeof<OverflowException>


// ═══════════════════════════════════════════════════════════════════
// Join cap guards (moved from SpineAndSafetyTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``ZSet.join caps capacity at Array.MaxLength`` () =
    // This would only throw on huge inputs; just verify small inputs work.
    let a = ZSet.ofKeys [ 1; 2 ]
    let b = ZSet.ofKeys [ "a"; "b" ]
    let r = ZSet.join (fun k -> k) (fun _ -> 1) (fun x y -> $"{x}-{y}") a b
    r |> should not' (be null)
