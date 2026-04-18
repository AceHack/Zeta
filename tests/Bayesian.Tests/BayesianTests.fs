module Zeta.Bayesian.Tests.BayesianTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Bayesian


// ═══════════════════════════════════════════════════════════════════
// Beta-Bernoulli — online success-rate with 95% credible interval.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``BetaBernoulli converges to true rate`` () =
    let bb = BetaBernoulli(1.0, 1.0)   // uniform prior
    // 750 successes out of 1000 trials → true rate = 0.75.
    bb.Observe(750L, 250L)
    bb.Mean |> should (equalWithin 0.02) 0.75


[<Fact>]
let ``BetaBernoulli credible interval shrinks with more data`` () =
    let small = BetaBernoulli(1.0, 1.0)
    small.Observe(5L, 5L)
    let struct (sLo, sHi) = small.CredibleInterval95
    let wide = sHi - sLo
    let large = BetaBernoulli(1.0, 1.0)
    large.Observe(500L, 500L)
    let struct (lLo, lHi) = large.CredibleInterval95
    let narrow = lHi - lLo
    narrow |> should be (lessThan wide)


[<Fact>]
let ``BetaBernoulli prior affects small-sample estimate`` () =
    let optimistic = BetaBernoulli(10.0, 1.0)   // strong success prior
    let pessimistic = BetaBernoulli(1.0, 10.0)  // strong failure prior
    optimistic.Observe(1L, 1L)
    pessimistic.Observe(1L, 1L)
    optimistic.Mean |> should be (greaterThan pessimistic.Mean)


// ═══════════════════════════════════════════════════════════════════
// Normal-Inverse-Gamma — online mean + variance.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``NormalInverseGamma approximates sample mean`` () =
    let nig = NormalInverseGamma(0.0, 1.0, 1.0, 1.0)
    // Feed 100 samples from N(5, 1).
    let rng = Random 42
    for _ in 1 .. 100 do
        let x = 5.0 + rng.NextDouble() * 2.0 - 1.0   // uniform proxy
        nig.Observe x
    nig.Mean |> should (equalWithin 0.5) 5.0


// ═══════════════════════════════════════════════════════════════════
// Dirichlet-Multinomial — categorical posterior.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``DirichletMultinomial rates sum to 1`` () =
    let dm = DirichletMultinomial([| 1.0; 1.0; 1.0 |])
    for _ in 1 .. 30 do dm.Observe 0
    for _ in 1 .. 20 do dm.Observe 1
    for _ in 1 .. 10 do dm.Observe 2
    let rates = dm.Rates
    rates.Length |> should equal 3
    let sum = Array.sum rates
    sum |> should (equalWithin 0.0001) 1.0


[<Fact>]
let ``DirichletMultinomial favours observed category`` () =
    let dm = DirichletMultinomial([| 1.0; 1.0; 1.0 |])
    for _ in 1 .. 100 do dm.Observe 1
    let rates = dm.Rates
    rates.[1] |> should be (greaterThan rates.[0])
    rates.[1] |> should be (greaterThan rates.[2])


// ═══════════════════════════════════════════════════════════════════
// BayesianRateOp — real operator used in a DBSP circuit.
// This is NOT a library sitting idle: it consumes a stream and
// emits (mean, credibleLow, credibleHigh) per tick.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``BayesianRateOp emits posterior rate per tick`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<bool>()
        let rate = c.BayesianRate(input.Stream, alpha = 1.0, beta = 1.0)
        let out = c.Output rate
        // Tick 1: 8 successes, 2 failures.
        input.Send (ZSet.ofSeq [ true, 8L; false, 2L ])
        do! c.StepAsync()
        let struct (mean, lo, hi) = out.Current
        // Mean should be close to 8/10 = 0.8 but with slight shrinkage
        // from the Beta(1,1) prior → (8+1)/(10+2) ≈ 0.75.
        mean |> should be (greaterThan 0.6)
        mean |> should be (lessThan 0.9)
        lo |> should be (lessThan mean)
        hi |> should be (greaterThan mean)
    }


[<Fact>]
let ``BayesianRateOp narrows credible interval as evidence accumulates`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<bool>()
        let rate = c.BayesianRate(input.Stream, alpha = 1.0, beta = 1.0)
        let out = c.Output rate
        // First tick: small sample, wide interval.
        input.Send (ZSet.ofSeq [ true, 2L; false, 1L ])
        do! c.StepAsync()
        let struct (_, sLo, sHi) = out.Current
        let wideWidth = sHi - sLo
        // Subsequent ticks accumulate evidence.
        for _ in 1 .. 50 do
            input.Send (ZSet.ofSeq [ true, 20L; false, 5L ])
            do! c.StepAsync()
        let struct (_, lLo, lHi) = out.Current
        let narrowWidth = lHi - lLo
        narrowWidth |> should be (lessThan wideWidth)
    }
