module Zeta.Tests.Algebra.BoundedGSetTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

let private keepLowest3 =
    { Capacity = 3
      Retention = BoundedGSetRetention.KeepLowest }

let private keepHighest3 =
    { Capacity = 3
      Retention = BoundedGSetRetention.KeepHighest }

let private unwrap =
    function
    | Ok value -> value
    | Error error -> failwithf "unexpected bounded GSet error: %A" error

let private ofInts config values =
    BoundedGSet.ofSeq<int> config values |> unwrap

[<Fact>]
let ``invalid capacity returns feedback instead of throwing`` () =
    let config =
        { Capacity = 0
          Retention = BoundedGSetRetention.KeepHighest }

    match BoundedGSet.empty<int> config with
    | Error(BoundedGSetError.NonPositiveCapacity 0) -> ()
    | other -> failwithf "expected NonPositiveCapacity feedback, got %A" other

[<Fact>]
let ``bounded projection keeps the configured side of canonical GSet order`` () =
    let values = [ 5; 1; 4; 2; 3; 3 ]

    ofInts keepLowest3 values
    |> BoundedGSet.toList
    |> should equal [ 1; 2; 3 ]

    ofInts keepHighest3 values
    |> BoundedGSet.toList
    |> should equal [ 3; 4; 5 ]

[<Fact>]
let ``rolling add reports admission rejection and eviction`` () =
    let full = ofInts keepHighest3 [ 3; 4; 5 ]

    let low = BoundedGSet.add 2 full |> unwrap
    low.Admission |> should equal BoundedGSetAdmission.RejectedByBound
    low.State |> BoundedGSet.toList |> should equal [ 3; 4; 5 ]
    Assert.Equal<int list>([], GSet.toList low.Evicted)

    let high = BoundedGSet.add 6 full |> unwrap
    high.Admission |> should equal BoundedGSetAdmission.Admitted
    high.State |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    high.Evicted |> GSet.toList |> should equal [ 3 ]

    let duplicate = BoundedGSet.add 5 high.State |> unwrap
    duplicate.Admission |> should equal BoundedGSetAdmission.AlreadyPresent
    duplicate.State |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    Assert.Equal<int list>([], GSet.toList duplicate.Evicted)

[<Fact>]
let ``bounded union is idempotent and associative for one projection policy`` () =
    let a = ofInts keepHighest3 [ 1; 5 ]
    let b = ofInts keepHighest3 [ 2; 4 ]
    let c = ofInts keepHighest3 [ 3; 6 ]

    BoundedGSet.union a a
    |> unwrap
    |> should equal a

    let left =
        BoundedGSet.union a b
        |> unwrap
        |> fun ab -> BoundedGSet.union ab c |> unwrap

    let right =
        BoundedGSet.union b c
        |> unwrap
        |> fun bc -> BoundedGSet.union a bc |> unwrap

    left |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    right |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    left |> should equal right

[<Fact>]
let ``bounded union rejects mismatched projection policies`` () =
    let low = ofInts keepLowest3 [ 1; 2; 3 ]
    let high = ofInts keepHighest3 [ 4; 5; 6 ]

    match BoundedGSet.union low high with
    | Error(BoundedGSetError.ConfigMismatch(left, right)) ->
        left |> should equal keepLowest3
        right |> should equal keepHighest3
    | other -> failwithf "expected ConfigMismatch feedback, got %A" other
