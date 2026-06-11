module Zeta.Tests.SoftTieTests

open System.Text
open global.Xunit
open Zeta.Core

let private b (s: string) = Encoding.UTF8.GetBytes s

[<Fact>]
let ``tieBytes: identical strands tie with strength 1.0`` () =
    match SoftTie.tieBytes 0.6 (b "the quick brown fox jumps over the lazy dog") (b "the quick brown fox jumps over the lazy dog") with
    | Some t -> Assert.Equal(1.0, t.Strength, 10)
    | None -> Assert.Fail "identical strands must tie"

[<Fact>]
let ``tieBytes: a one-region edit still ties, with high strength`` () =
    let a = b "the quick brown fox jumps over the lazy dog twelve times in a row today"
    let c = b "the quick brown fox JUMPED over the lazy dog twelve times in a row today"
    match SoftTie.tieBytes 0.6 a c with
    | Some t -> Assert.True(t.Strength > 0.6, $"expected strength > 0.6, got {t.Strength}")
    | None -> Assert.Fail "a small edit must still tie"

[<Fact>]
let ``tieBytes: disjoint strands do NOT tie (None)`` () =
    let r = SoftTie.tieBytes 0.6 (b "the quick brown fox jumps over the lazy dog") (b "ZZZZ unrelated ZZZZ unrelated ZZZZ 99999")
    Assert.True(r.IsNone)

[<Fact>]
let ``tie wires through FingerprintPrism.soft: Right is the matched strand b`` () =
    // generic tie with an explicit similarity fn; confirms the matched element is b (the rainbow's known).
    let sim (x: int) (y: int) = if x = y then 1.0 else 0.0
    match SoftTie.tie sim 0.5 7 7 with
    | Some t ->
        Assert.Equal(7, t.Right)
        Assert.Equal(1.0, t.Strength, 10)
    | None -> Assert.Fail "equal ints must tie"

[<Fact>]
let ``threshold gates the tie: a low threshold ties, an impossible one (>1) cannot`` () =
    let a = b "alpha bravo charlie delta echo foxtrot golf hotel"
    let c = b "alpha bravo charlie delta echo foxtrot golf INDIA"
    Assert.True(SoftTie.tieBytes 0.01 a c |> Option.isSome) // low bar → tied
    Assert.True(SoftTie.tieBytes 1.01 a c |> Option.isNone) // above any possible similarity → no tie

[<Fact>]
let ``tied is the boolean face of tie`` () =
    let sim (x: int) (y: int) = if x = y then 1.0 else 0.0
    Assert.True(SoftTie.tied sim 0.5 3 3)
    Assert.False(SoftTie.tied sim 0.5 3 4)
