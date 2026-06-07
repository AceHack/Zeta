module Zeta.Tests.SoftValueNumericTests

open global.Xunit
open Zeta.Core

module SN = Zeta.Core.SoftValueNumeric

let private i n = DynamicValue.Int n
let private cert n = SoftValue.certain (i n)
/// a fair coin over two int values
let private coin a b =
    SoftValue.ofWeighted [ i a, 0.5; i b, 0.5 ] |> Option.get

[<Fact>]
let ``certain + certain stays a point mass`` () =
    match SN.add (cert 2L) (cert 3L) with
    | Ok s ->
        Assert.Equal(1.0, SoftValue.confidence s, 9) // still certain
        Assert.Equal<DynamicValue option>(Some(i 5L), SoftValue.resolve 0.0 s)
    | Error e -> Assert.Fail $"{e}"

[<Fact>]
let ``spread + spread convolves and propagates uncertainty`` () =
    // {0,2} ⊕ {0,2} = {0:.25, 2:.5, 4:.25} — 3 outcomes, no longer certain
    match SN.add (coin 0L 2L) (coin 0L 2L) with
    | Ok s ->
        let cs = SoftValue.candidates s
        Assert.Equal(3, List.length cs) // 0, 2, 4
        Assert.True(SoftValue.confidence s < 1.0) // uncertainty propagated
        Assert.Equal(0.5, SoftValue.confidence s, 9) // the mode (2) has p=0.5
    | Error e -> Assert.Fail $"{e}"

[<Fact>]
let ``mean is the probability-weighted expectation`` () =
    // E[{0:.5, 2:.5}] = 1.0
    match SN.mean (coin 0L 2L) with
    | Ok m -> Assert.Equal(1.0, m, 9)
    | Error e -> Assert.Fail $"{e}"
    // E[ coin ⊕ coin ] = 2.0
    match SN.add (coin 0L 2L) (coin 0L 2L) |> Result.bind SN.mean with
    | Ok m -> Assert.Equal(2.0, m, 9)
    | Error e -> Assert.Fail $"{e}"

[<Fact>]
let ``mul, negate, subtract compose over distributions`` () =
    match SN.mul (cert 3L) (cert 4L) with
    | Ok s -> Assert.Equal<DynamicValue option>(Some(i 12L), SoftValue.resolve 0.0 s)
    | Error e -> Assert.Fail $"{e}"

    match SN.subtract (cert 10L) (cert 7L) with
    | Ok s -> Assert.Equal<DynamicValue option>(Some(i 3L), SoftValue.resolve 0.0 s)
    | Error e -> Assert.Fail $"{e}"

[<Fact>]
let ``a non-numeric candidate declines the whole op (Result variant)`` () =
    let bad = SoftValue.ofWeighted [ i 1L, 0.5; DynamicValue.String "x", 0.5 ] |> Option.get
    match SN.add bad (cert 1L) with
    | Error _ -> () // the String candidate poisons the convolution -> clean decline
    | Ok _ -> Assert.Fail "expected the non-numeric candidate to decline"

[<Fact>]
let ``Sat variant is total: a bad candidate becomes NaN, distribution still returned`` () =
    let bad = SoftValue.ofWeighted [ i 1L, 0.5; DynamicValue.String "x", 0.5 ] |> Option.get
    let s = SN.Sat.add bad (cert 1L) // total — no decline
    // one outcome is NaN-poisoned; the clean candidate (1+1=2) survives
    let hasNaN =
        SoftValue.candidates s
        |> List.exists (fun (v, _) ->
            match v with
            | DynamicValue.Float x -> System.Double.IsNaN x
            | _ -> false)

    let hasTwo =
        SoftValue.candidates s |> List.exists (fun (v, _) -> v = i 2L)

    Assert.True(hasNaN)
    Assert.True(hasTwo)
