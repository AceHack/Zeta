module Zeta.Bayesian.Tests.BpTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Bayesian

// Sum-product belief propagation to a fixed point (B-1000 slice 4):
// FactorGraph.runToFixpoint iterates passOnce until the messages stop
// moving (per-family distance < tol) or the round cap is hit — the
// factor-graph analog of the DBSP NestedCircuit capped LFP iteration.
// On a tree BP reaches the exact marginals. "The compilers don't lie."

[<Fact>]
let ``runToFixpoint reaches the exact product marginal and reports converged`` () =
    let g0 =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Gaussian.ofMeanVariance 0.0 1.0))
        |> FactorGraph.addFactor 1 (Factor.prior 0 (Gaussian.ofMeanVariance 2.0 1.0))
    let g, _rounds, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 20 g0
    converged |> should equal true
    let m = FactorGraph.marginal 0 g
    Gaussian.mean m |> should (equalWithin 1e-9) 1.0
    Gaussian.variance m |> should (equalWithin 1e-9) 0.5

[<Fact>]
let ``BP propagates evidence along an equality chain to every marginal`` () =
    // x0 = x1 = x2 (two equality factors), with a Beta prior on each.
    // every marginal must combine ALL three priors:
    //   Beta(2,1)·Beta(1,2)·Beta(3,1) = Beta(4,2)  (α-1 sum = 3, β-1 sum = 1)
    let g0 =
        FactorGraph.empty Beta.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Beta.create 2.0 1.0))
        |> FactorGraph.addFactor 1 (Factor.prior 1 (Beta.create 1.0 2.0))
        |> FactorGraph.addFactor 2 (Factor.prior 2 (Beta.create 3.0 1.0))
        |> FactorGraph.addFactor 3 (Factor.equality Beta.algebra [ 0; 1 ])
        |> FactorGraph.addFactor 4 (Factor.equality Beta.algebra [ 1; 2 ])
    let g, _rounds, converged = FactorGraph.runToFixpoint Beta.distance 1e-9 50 g0
    converged |> should equal true
    for v in [ 0; 1; 2 ] do
        let m = FactorGraph.marginal v g
        m.Alpha |> should (equalWithin 1e-6) 4.0
        m.Beta |> should (equalWithin 1e-6) 2.0

[<Fact>]
let ``runToFixpoint respects the round cap (not converged when capped too low)`` () =
    let g0 =
        FactorGraph.empty Beta.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 (Beta.create 2.0 1.0))
        |> FactorGraph.addFactor 1 (Factor.prior 1 (Beta.create 1.0 2.0))
        |> FactorGraph.addFactor 2 (Factor.prior 2 (Beta.create 3.0 1.0))
        |> FactorGraph.addFactor 3 (Factor.equality Beta.algebra [ 0; 1 ])
        |> FactorGraph.addFactor 4 (Factor.equality Beta.algebra [ 1; 2 ])
    let _g, rounds, converged = FactorGraph.runToFixpoint Beta.distance 1e-9 1 g0
    rounds |> should equal 1
    converged |> should equal false   // one round can't cross the whole chain

[<Fact>]
let ``message distance is zero for equal messages and abs-difference otherwise`` () =
    Gaussian.distance (Gaussian.ofMeanVariance 0.0 1.0) (Gaussian.ofMeanVariance 0.0 1.0)
    |> should (equalWithin 1e-12) 0.0
    Beta.distance (Beta.create 2.0 3.0) (Beta.create 2.5 3.0) |> should (equalWithin 1e-9) 0.5
    Bernoulli.distance (Bernoulli.create 0.3) (Bernoulli.create 0.5) |> should (equalWithin 1e-9) 0.2

[<Fact>]
let ``non-finite messages count as moved (no false convergence on overflow)`` () =
    // an infinite-precision message (via record literal, bypassing the
    // validated constructor) must NOT be silently reported as converged:
    // distance returns infinity, and `moved` treats NaN/∞ residual as moved.
    Gaussian.distance { PrecisionMean = 0.0; Precision = infinity } { PrecisionMean = 0.0; Precision = infinity }
    |> System.Double.IsFinite |> should equal false
    let g0 =
        FactorGraph.empty Gaussian.algebra
        |> FactorGraph.addFactor 0 (Factor.prior 0 { PrecisionMean = 0.0; Precision = infinity })
        |> FactorGraph.addFactor 1 (Factor.prior 0 { PrecisionMean = 0.0; Precision = infinity })
    let _g, _rounds, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 5 g0
    converged |> should equal false
