module Zeta.Bayesian.Tests.BpTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Bayesian

// Sum-product belief propagation to a fixed point (081KT2T2J0008QG0R000S7GHQ8 slice 4):
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

// ═══════════════════════════════════════════════════════════════════
// C5 (081KT2T2J0008QG0R000YZ3NMY P1) — BP `runToFixpoint` is EXACT ON TREES and TERMINATES.
// Companion to the `BpExactOnTree` TLA+ spec (TLC proves the synchronous
// schedule + termination on the abstract 3-tree). This is the FsCheck
// half of the BP-16 cross-check: the REAL float marginal on RANDOM trees
// of Gaussian priors equals the product of ALL priors (the exact marginal
// — the equality factors make every variable one effective variable), and
// `runToFixpoint` reports `converged` (terminates strictly within the
// cap). KFL 2001, sum-product exact on trees.
// ═══════════════════════════════════════════════════════════════════

let private clampMeanC5 (x: float) = max -50.0 (min 50.0 x)
let private clampVarC5 (x: float) = max 0.05 (min 20.0 (abs x))

[<Property>]
let ``C5 BP runToFixpoint is exact on random trees and terminates (marginal = product of all priors)``
    (meanRaw: NormalFloat[]) (varRaw: NormalFloat[]) =
    let n = min (min meanRaw.Length varRaw.Length) 8
    if n < 2 then true else  // need >= 2 variables to form a tree edge
    let priors =
        Array.init n (fun i ->
            let (NormalFloat m) = meanRaw.[i]
            let (NormalFloat vr) = varRaw.[i]
            Gaussian.ofMeanVariance (clampMeanC5 m) (clampVarC5 vr))
    // a RANDOM tree: variable i (i>=1) attaches to a parent in 0..i-1
    // derived deterministically from the data (the shape varies run to
    // run, exercising branching trees, not just chains).
    let parent i = (abs (int (Gaussian.mean priors.[i]))) % i
    // priors are factors 0..n-1; the n-1 equality edges are factors n..2n-2.
    let mutable g = FactorGraph.empty Gaussian.algebra
    for i in 0 .. n - 1 do
        g <- FactorGraph.addFactor i (Factor.prior i priors.[i]) g
    for i in 1 .. n - 1 do
        g <- FactorGraph.addFactor (n - 1 + i) (Factor.equality Gaussian.algebra [ parent i; i ]) g
    let gf, _rounds, converged = FactorGraph.runToFixpoint Gaussian.distance 1e-9 (8 * n) g
    // exact marginal at EVERY variable = product of ALL priors (one tree
    // component via the equality factors) — folded independently of BP.
    let exact = priors |> Array.fold (fun acc m -> Gaussian.product acc m) Gaussian.One
    let em, ev = Gaussian.mean exact, Gaussian.variance exact
    let close a b = abs (a - b) <= 1e-6 + 1e-6 * abs b
    converged
    && Array.init n (fun v -> FactorGraph.marginal v gf)
       |> Array.forall (fun m -> close (Gaussian.mean m) em && close (Gaussian.variance m) ev)

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
