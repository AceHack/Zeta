module Zeta.Bayesian.Tests.FactorGraphTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Bayesian

// The factor graph (081KT2T2J0008QG0R000S7GHQ8 slice 3) — the bipartite data structure
// inference runs on. These tests exercise the topology + the single
// sum-product round (passOnce/passRounds) + the two factor rules
// (prior, equality), grounded on slice 2's message algebra. The
// fixed-point schedule is slice 4. "The compilers don't lie."

// ─── Marginals = product of incoming factor→var messages ───

[<Fact>]
let ``single variable with two Gaussian priors → marginal is their product`` () =
    // two prior factors (0, 1) both on variable 0
    let g =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance 0.0 1.0))
        |> FactorGraph.addFactor 1 (Factor.prior 0 (Gaussian.ofMeanVariance 2.0 1.0))
        |> FactorGraph.passOnce
    let m = FactorGraph.marginal 0 g
    Gaussian.mean m |> should (equalWithin 1e-9) 1.0      // precision-weighted midpoint
    Gaussian.variance m |> should (equalWithin 1e-9) 0.5  // precision adds

[<Fact>]
let ``a lone prior makes the marginal equal the prior`` () =
    let g =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 5 (Gaussian.ofMeanVariance 3.0 2.0))
        |> FactorGraph.passOnce
    let m = FactorGraph.marginal 5 g
    Gaussian.mean m |> should (equalWithin 1e-9) 3.0
    Gaussian.variance m |> should (equalWithin 1e-9) 2.0

// ─── Equality propagates evidence between variables ───

[<Fact>]
let ``equality factor combines both priors into both marginals`` () =
    // var 0 ~ Beta(2,1), var 1 ~ Beta(1,2), and x0 = x1 (equality).
    // each marginal sees both priors → Beta(2,1)·Beta(1,2) = Beta(2,2).
    let g =
        FactorGraph.empty Beta.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Beta.create 2.0 1.0))
        |> FactorGraph.addFactor 1 (Factor.prior 1 (Beta.create 1.0 2.0))
        |> FactorGraph.addFactor 2 (Factor.equality Beta.algebra [ 0; 1 ])
        |> FactorGraph.passRounds 2
    let m0 = FactorGraph.marginal 0 g
    let m1 = FactorGraph.marginal 1 g
    m0.Alpha |> should (equalWithin 1e-9) 2.0
    m0.Beta |> should (equalWithin 1e-9) 2.0
    m1.Alpha |> should (equalWithin 1e-9) 2.0
    m1.Beta |> should (equalWithin 1e-9) 2.0

// ─── The two factor rules (unit) ───

[<Fact>]
let ``Factor.equality sends each neighbor the product of the others`` () =
    let f = Factor.equality Gaussian.algebra [ 0; 1; 2 ]
    let incoming =
        Map.ofList
            [ 0, Gaussian.ofMeanVariance 1.0 1.0
              1, Gaussian.ofMeanVariance 2.0 1.0
              2, Gaussian.ofMeanVariance 3.0 1.0 ]
    let out = f.ComputeMessages incoming
    // message to 0 = product of incoming[1], incoming[2] = N(2,1)·N(3,1)
    Gaussian.mean out.[0] |> should (equalWithin 1e-9) 2.5
    Gaussian.variance out.[0] |> should (equalWithin 1e-9) 0.5

[<Fact>]
let ``Factor.prior sends its fixed message regardless of incoming`` () =
    let f = Factor.prior 7 (Gaussian.ofMeanVariance 4.0 1.0)
    let out = f.ComputeMessages (Map.ofList [ 7, Gaussian.ofMeanVariance 99.0 99.0 ])
    Gaussian.mean out.[7] |> should (equalWithin 1e-9) 4.0
    Gaussian.variance out.[7] |> should (equalWithin 1e-9) 1.0
