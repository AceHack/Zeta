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

// ─── THE HEXAGONAL PORT, ADAPTER A (B-1033): conformance through IInferenceEngine ───
// Cases are hand-checkable: combining Gaussians under equality = precision-weighted product
// (tau = tau1 + tau2; mean = (tau1*mu1 + tau2*mu2)/tau). The same cases run through Adapter B
// (dotnet/infer) in Tests.CSharp — theirs tests ours across the port WE own.

open Zeta.Core.Abstractions

[<Fact>]
let ``PORT C1: a single prior round-trips — the marginal IS the prior`` () =
    let engine = Zeta.Bayesian.ZetaBayesianEngine() :> IInferenceEngine
    let model = GaussianModel(1, [| GaussianPrior(0, 3.0, 2.0) |], [||])
    let r = engine.RunGaussian(model, 50, 1e-9)
    Assert.True r.Converged
    Assert.Equal(3.0, r.Marginals.[0].Mean, 9)
    Assert.Equal(2.0, r.Marginals.[0].Variance, 9)

[<Fact>]
let ``PORT C2: two priors on one variable fuse as the precision-weighted product (the analytic oracle)`` () =
    let engine = Zeta.Bayesian.ZetaBayesianEngine() :> IInferenceEngine
    // N(0, 1) * N(4, 1) -> tau = 2, mean = 2, variance = 0.5
    let model = GaussianModel(1, [| GaussianPrior(0, 0.0, 1.0); GaussianPrior(0, 4.0, 1.0) |], [||])
    let r = engine.RunGaussian(model, 50, 1e-9)
    Assert.True r.Converged
    Assert.Equal(2.0, r.Marginals.[0].Mean, 9)
    Assert.Equal(0.5, r.Marginals.[0].Variance, 9)

[<Fact>]
let ``PORT C3: an equality chain carries belief — var0's prior meets var2's prior and ALL marginals agree`` () =
    let engine = Zeta.Bayesian.ZetaBayesianEngine() :> IInferenceEngine
    // priors on 0 and 2; equality (0,1,2): every marginal = N(0,1)*N(4,1) fused = mean 2, var 0.5
    let model =
        GaussianModel(
            3,
            [| GaussianPrior(0, 0.0, 1.0); GaussianPrior(2, 4.0, 1.0) |],
            [| EqualityFactor([| 0; 1; 2 |]) |])
    let r = engine.RunGaussian(model, 100, 1e-9)
    Assert.True r.Converged
    for v in 0 .. 2 do
        Assert.Equal(2.0, r.Marginals.[v].Mean, 6)
        Assert.Equal(0.5, r.Marginals.[v].Variance, 6)

[<Fact>]
let ``PORT determinism: same model, same marginals, byte-stable order (the DST clause of the port contract)`` () =
    let run () =
        let engine = Zeta.Bayesian.ZetaBayesianEngine() :> IInferenceEngine
        let model = GaussianModel(2, [| GaussianPrior(0, 1.0, 2.0); GaussianPrior(1, 5.0, 3.0) |], [| EqualityFactor([| 0; 1 |]) |])
        (engine.RunGaussian(model, 100, 1e-9)).Marginals |> Seq.map (fun m -> m.Variable, m.Mean, m.Variance) |> List.ofSeq
    Assert.Equal<(int * float * float) list>(run (), run ())

// ─── the inference LADDER (universal/port's first customer — B-1033 follow-up) ───

[<Fact>]
let ``LADDER: a live engine binds Live with its light ON; an absent one binds the HONEST Mock (rehearsal, Converged=false)`` () =
    let zid = GeneratorRegistry.idOf "engine.zeta-bayesian" 1
    let live = Map.ofList [ zid, fun () -> Zeta.Bayesian.ZetaBayesianEngine() :> IInferenceEngine ]
    match InferenceLadder.resolve live Map.empty zid with
    | InferenceLadder.Live(_, e) ->
        Assert.Equal("zeta-bayesian", e.Name)
        Assert.Contains("[REC ●]", InferenceLadder.light (InferenceLadder.resolve live Map.empty zid))
    | other -> Assert.True(false, sprintf "expected Live, got %A" other)
    // absent everywhere: the rehearsal engine — flat marginals, NEVER converged
    let wanted = GeneratorRegistry.idOf "engine.infer-net" 1
    match InferenceLadder.resolve live Map.empty wanted with
    | InferenceLadder.Mock(_, e) ->
        let r = e.RunGaussian(GaussianModel(2, [| GaussianPrior(0, 3.0, 1.0) |], [||]), 10, 1e-9)
        Assert.False r.Converged // the mock cannot masquerade as inference
        Assert.Contains("[off ○]", InferenceLadder.light (InferenceLadder.resolve live Map.empty wanted))
    | other -> Assert.True(false, sprintf "expected Mock, got %A" other)
    // and all three engine ids are minted on the shelf, collision-free
    for name in [ "engine.zeta-bayesian"; "engine.infer-net"; "engine.mock-flat" ] do
        Assert.True(GeneratorRegistry.byName name |> Option.isSome)
