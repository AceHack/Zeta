module Zeta.Tests.RetractionReadingTests

open global.Xunit
open FsCheck.Xunit
open Zeta.Core

// Dual readings of retraction (081M10BD9BM087G0R001SGDRXT).
// Full −1 as one op erases the view; widen does not drop candidates;
// negate alone is an involution (Bennett-free). DST: no clock, no IO.

module SV = SoftValue

let private boundW (w: int64) : int64 = w % 1_000_000L

let private zInt (pairs: (int * int64) list) : ZSet<int> =
    pairs |> List.map (fun (k, w) -> k, boundW w) |> ZSet.ofSeq

let private cand i = DynamicValue.Int(int64 i)

[<Fact>]
let ``full -1 retraction erases the materialized view`` () =
    let z = ZSet.ofSeq [ 1, 3L; 2, -1L ]
    Assert.False(z.IsEmpty)
    Assert.True(RetractionReading.fullErasesView z)
    Assert.Equal(ErasureClass.ThermodynamicClass.Erasing, ErasureClass.ofLargestFibre 2)

[<Fact>]
let ``negate alone is an involution (Bennett-free, not the erasure)`` () =
    let z = ZSet.ofSeq [ 7, 4L; 8, -2L ]
    Assert.True(RetractionReading.negateIsInvolution z)
    Assert.Equal(ErasureClass.ThermodynamicClass.Reversible, ErasureClass.ofLargestFibre 1)

[<Fact>]
let ``uncertainty widening is non-erasing of support`` () =
    match SV.ofWeighted [ cand 0, 0.9; cand 1, 0.1 ] with
    | None -> failwith "expected a distribution"
    | Some sv ->
        Assert.Equal(2, List.length (SV.candidates sv))
        Assert.True(RetractionReading.widenKeepsSupport 0.2 sv)
        let widened = SV.widen 0.2 sv
        Assert.Equal(2, List.length (SV.candidates widened))
        Assert.True(SV.weightOf (cand 0) widened > 0.0)
        Assert.True(SV.weightOf (cand 1) widened > 0.0)

[<Property>]
let ``full retraction erases every int Z-set view`` (pairs: (int * int64) list) =
    RetractionReading.fullErasesView (zInt pairs)

[<Property>]
let ``negate is an involution on every int Z-set`` (pairs: (int * int64) list) =
    RetractionReading.negateIsInvolution (zInt pairs)
