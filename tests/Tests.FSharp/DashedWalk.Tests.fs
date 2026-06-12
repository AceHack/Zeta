module Zeta.Tests.DashedWalkTests

// REPORT #5's restricted span, executable — the falsifiers the math team priced at days:
// (a) the codimension-17 theorem computed exactly (rank 17, solution dim 15);
// (b) Eulerian serializations of valid dashings round-trip under forget-order;
// (c) the H₁(Bₙ)=ℤ collapse witnessed (equal braids, different sign multisets — word data).

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

[<Fact>]
let ``THE CODIMENSION-17 THEOREM: the face system has GF(2) rank exactly 17 (solution dim 15 ⇒ 2^15 dashings)`` () =
    Assert.Equal(17, DashedWalk.faceSystemRank)
    Assert.Equal(15, 32 - DashedWalk.faceSystemRank)

[<Fact>]
let ``the 24 faces are enumerated exactly`` () =
    Assert.Equal(24, List.length DashedWalk.faces)

[<Fact>]
let ``ROUND-TRIP: serialize(standardDashing) covers all 32 edges once, walks clean, and recovers the dashing`` () =
    let word = DashedWalk.serialize AdinkraViz.standardDashing
    Assert.Equal(32, List.length word)
    match DashedWalk.walk word with
    | Error e -> failwith e
    | Ok(finalVertex, assignment) ->
        Assert.Equal(0, finalVertex) // Eulerian CIRCUIT: returns to start
        match DashedWalk.toDashing assignment with
        | Error e -> failwith e
        | Ok d ->
            Assert.Equal<Set<AdinkraViz.Edge>>(AdinkraViz.standardDashing, d)
            Assert.True(AdinkraViz.allFacesOdd d)

[<Fact>]
let ``CONFLICT REFUSAL: a word revisiting an edge with the opposite sign is declined, not coerced`` () =
    // 1 then back with -1: same edge (0, bit0), opposite signs
    match DashedWalk.walk [ 1; -1 ] with
    | Error msg -> Assert.Contains("conflict", msg)
    | Ok _ -> failwith "opposite-sign revisit must refuse"

[<Fact>]
let ``the H1 collapse, witnessed: Artin-equal braids carry DIFFERENT signed pair-loads (sign record is word data)`` () =
    let b1 = [ 1; 2; 1 ]
    let b2 = [ 2; 1; 2 ]
    Assert.True(Braid.equal 5 b1 b2) // equal as braids (the Artin relation)
    Assert.NotEqual<Map<int, int * int>>(Braid.signedPairLoad 5 b1, Braid.signedPairLoad 5 b2)

[<Fact>]
let ``signedPairLoad refines pairLoad and recovers the writhe`` () =
    let b = [ 1; -2; 3; 3; -1; 4 ]
    let signed = Braid.signedPairLoad 5 b
    let unsigned = Braid.pairLoad 5 b
    for KeyValue(i, (p, n)) in signed do
        Assert.Equal(unsigned.[i], p + n)
    Assert.Equal(Braid.writhe b, signed |> Map.toList |> List.sumBy (fun (_, (p, n)) -> p - n))

[<Property>]
let ``gauge moves preserve membership in the dashing family (the 2^15 coset is gauge-closed)`` (v: int) =
    let d = AdinkraViz.flipVertex (abs v % 16) AdinkraViz.standardDashing
    AdinkraViz.allFacesOdd d

[<Property>]
let ``serialize round-trips from any gauge transform of the standard dashing`` (v1: int) (v2: int) =
    let d =
        AdinkraViz.standardDashing
        |> AdinkraViz.flipVertex (abs v1 % 16)
        |> AdinkraViz.flipVertex (abs v2 % 16)
    let word = DashedWalk.serialize d
    match DashedWalk.walk word with
    | Error _ -> false
    | Ok(_, a) ->
        match DashedWalk.toDashing a with
        | Error _ -> false
        | Ok d2 -> d2 = d
