module Zeta.Tests.SoftValueInfoTests

open global.Xunit
open Zeta.Core

module SI = Zeta.Core.SoftValueInfo

let private i n = DynamicValue.Int n
let private dist xs = SoftValue.ofWeighted xs |> Option.get

[<Fact>]
let ``crossEntropy of a distribution with itself equals its entropy`` () =
    let p = dist [ i 0L, 0.25; i 1L, 0.25; i 2L, 0.5 ]
    Assert.Equal(SoftValue.entropy p, SI.crossEntropy p p, 9)

[<Fact>]
let ``KL divergence is zero iff the distributions are equal`` () =
    let p = dist [ i 0L, 0.5; i 1L, 0.5 ]
    Assert.Equal(0.0, SI.klDivergence p p, 9)
    let q = dist [ i 0L, 0.9; i 1L, 0.1 ]
    Assert.True(SI.klDivergence p q > 0.0) // Gibbs: strictly positive when p ≠ q

[<Fact>]
let ``KL is non-negative and asymmetric`` () =
    let p = dist [ i 0L, 0.7; i 1L, 0.3 ]
    let q = dist [ i 0L, 0.4; i 1L, 0.6 ]
    Assert.True(SI.klDivergence p q >= 0.0)
    Assert.True(SI.klDivergence q p >= 0.0)
    Assert.NotEqual(SI.klDivergence p q, SI.klDivergence q p) // D(p‖q) ≠ D(q‖p) in general

[<Fact>]
let ``cross-entropy diverges when q misses an outcome p supports`` () =
    let p = dist [ i 0L, 0.5; i 1L, 0.5 ]
    let q = dist [ i 0L, 1.0 ] // assigns 0 to outcome 1, which p supports
    Assert.True(System.Double.IsPositiveInfinity(SI.crossEntropy p q))
    Assert.True(System.Double.IsPositiveInfinity(SI.klDivergence p q))

[<Fact>]
let ``cross-entropy matches the closed form on a known example`` () =
    // p = {0:.5, 1:.5}, q = {0:.25, 1:.75}; H(p,q) = -.5 ln .25 - .5 ln .75
    let p = dist [ i 0L, 0.5; i 1L, 0.5 ]
    let q = dist [ i 0L, 0.25; i 1L, 0.75 ]
    let expected = -0.5 * log 0.25 - 0.5 * log 0.75
    Assert.Equal(expected, SI.crossEntropy p q, 9)
