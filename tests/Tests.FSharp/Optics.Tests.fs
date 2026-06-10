module Zeta.Tests.OpticsTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Optics

// A sample LENS: focus the first element of a pair (always present = product factor).
let private fstLens : ILens<int * string, int> =
    lens fst (fun p (_, b) -> (p, b))

// A sample PRISM (fingerprintable): focus the Choice1Of2 case of a sum (may not be present).
let private firstPrism : IPrism<Choice<int, string>, int> =
    prism
        (function
            | Choice1Of2 i -> Some i
            | Choice2Of2 _ -> None)
        Choice1Of2

[<Fact>]
let ``lens law get-put: Set (Get w) w = w`` () =
    let w = (7, "x")
    Assert.Equal<int * string>(w, fstLens.Set (fstLens.Get w) w)

[<Fact>]
let ``lens law put-get: Get (Set p w) = p`` () =
    Assert.Equal(42, fstLens.Get(fstLens.Set 42 (7, "x")))

[<Fact>]
let ``lens law put-put: last write wins`` () =
    let w = (7, "x")
    Assert.Equal<int * string>(fstLens.Set 2 w, fstLens.Set 2 (fstLens.Set 1 w))

[<Fact>]
let ``prism law build-match: Match (Build p) = Some p (fingerprint round-trips)`` () =
    Assert.Equal<int option>(Some 5, firstPrism.Match(firstPrism.Build 5))

[<Fact>]
let ``prism law match-build: Match w = Some p => Build p = w`` () =
    let w = Choice1Of2 9
    match firstPrism.Match w with
    | Some p -> Assert.Equal<Choice<int, string>>(w, firstPrism.Build p)
    | None -> Assert.Fail "expected a match"

[<Fact>]
let ``prism Match fingerprints the case: the OTHER case does not match (None)`` () =
    Assert.Equal<int option>(None, firstPrism.Match(Choice2Of2 "not-an-int"))
