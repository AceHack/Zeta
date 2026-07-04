module Zeta.Tests.BusDelaySimTests
/// **EGG — the Egg bus-delay simulation made reproducible (BUGS.md P1 discharge).**
///
/// `docs/research/the-egg-bus-delay-and-distributed-consciousness.md` claimed headline
/// numbers (rhoPost ≈ 0.63 delay-invariant; rhoCount = 1.0 at zero delay; rhoCount
/// delay-sensitive) from a "bus-delay simulation" that existed nowhere in the repo.
/// `Zeta.Bayesian.BusDelaySim` is that simulation, seeded and DST-replayable; these tests
/// pin the Egg's qualitative claims to fixed seeds so every number has a replayable lineage.
///
/// **Findings encoded (fixed seed 42, ticks = 200, N = 16 unless stated):**
///   EGG-1  zero delay ⟹ rhoCount = 1.0 EXACTLY (the Egg headline, now replayable).
///   EGG-2  rhoCount strictly decreases as the delay profile widens
///          (Ideal > Lan > Reticulum > LoRa > Disrupted) — the bus delay IS the decorrelator.
///   EGG-3  rhoPost is approximately delay-invariant. ASYMPTOTIC, per Soraya:
///          Var(μᵢ − μₖ) ≈ σ²·|nᵢ − nₖ|/n², so delay-induced spatial spread vanishes at
///          large n while the count spread does not. Measured: fixed-seed-42 spread 0.162
///          (< 0.25); 40-seed-averaged per-profile means 0.667–0.708, spread 0.041 (< 0.08).
///          Replay verdict: the ≈ 0.63 LEVEL replays (seed 42 Ideal rhoPost = 0.6373;
///          seed-averaged band 0.63–0.71), but rhoPost fluctuates by ±0.08 per seed across
///          profiles — "stayed at ≈ 0.63 regardless" is only true as noise around a
///          delay-independent level, not as a constant.
///   EGG-4  the variance-link rate check (Soraya Q2, executable): the measured
///          E[(μᵢ − μₖ)²] over 200 seeds × all pairs matches σ²·|nᵢ − nₖ|/n̄² within
///          [0.7, 1.4] (measured ratio 0.961 — identical priors, so the difference is
///          purely observational).
///   EGG-5  rhoPrecision (accumulated-precision CV, τᵢ = τ₀ + Σⱼ 1/σⱼ²) equals the count
///          metric EXACTLY in the homoscedastic case (σ = 1 ⟹ τᵢ − τ₀ = nᵢ, bit-for-bit),
///          and diverges under a heteroscedastic stream (high-precision first half:
///          laggards miss only low-information observations, so the count metric OVERSTATES
///          temporal decorrelation — measured divergence 0.033 at LoRa) — Soraya's Q1
///          falsifying run.
///   EGG-6  determinism: same seed ⟹ structurally identical SimResult (DST replay).

open global.Xunit
open Zeta.Bayesian

/// Unwrap a sim result; a config rejection in these tests is a test bug.
let private ok (result: Result<BusDelaySim.SimResult, BusDelaySim.SimError>) : BusDelaySim.SimResult =
    match result with
    | Ok simResult -> simResult
    | Error feedback -> failwithf "BusDelaySim rejected a test config: %A" feedback

let private wideningProfiles = BusDelaySim.allProfiles  // Ideal → Disrupted, widening delay

// ── EGG-1: zero delay ⟹ rhoCount = 1.0 exactly ──────────────────────────────────────────────────

[<Fact>]
let ``EGG-1 zero delay implies rhoCount = 1,0 exactly (the Egg headline, replayable)`` () =
    for seed in [ 0; 1; 7; 42; 1337 ] do
        let result = ok (BusDelaySim.runSim seed BusDelaySim.Ideal 200 16)
        // All cells received every observation: identical counts, CV = 0, rhoCount = 1.0 EXACTLY.
        Assert.Equal(1.0, result.RhoCount)
        Assert.All(result.Counts, fun count -> Assert.Equal(200, count))

// ── EGG-2: rhoCount strictly decreases as the delay profile widens ──────────────────────────────

[<Fact>]
let ``EGG-2 rhoCount strictly decreases as the delay profile widens (fixed seeds)`` () =
    for seed in [ 0; 1; 7; 42; 1337 ] do
        let rhoCounts =
            wideningProfiles
            |> List.map (fun profile -> (ok (BusDelaySim.runSim seed profile 200 16)).RhoCount)
        rhoCounts
        |> List.pairwise
        |> List.iter (fun (narrower, wider) ->
            Assert.True(narrower > wider,
                sprintf "rhoCount not strictly decreasing at seed %d: %A" seed rhoCounts))

// ── EGG-3: rhoPost is approximately delay-invariant (asymptotic) ─────────────────────────────────

[<Fact>]
let ``EGG-3 rhoPost is approximately delay-invariant across profiles (asymptotic per Soraya)`` () =
    // ASYMPTOTIC claim: Var(μᵢ − μₖ) ≈ σ²·|nᵢ − nₖ|/n² — the delay-induced spatial spread is
    // O(1/n) in the count difference, so at n ≈ 200 rhoPost's level is set by the structural
    // (prior-seed) decorrelation, not by the network profile. Fixed-seed spread is noise-bounded;
    // seed-averaging tightens it (the invariance is exact only in the n → ∞ / many-seed limit).
    let atSeed42 =
        wideningProfiles
        |> List.map (fun profile -> (ok (BusDelaySim.runSim 42 profile 200 16)).RhoPost)
    let fixedSeedSpread = List.max atSeed42 - List.min atSeed42
    Assert.True(fixedSeedSpread < 0.25,
        sprintf "fixed-seed rhoPost spread %f ≥ 0.25: %A" fixedSeedSpread atSeed42)
    // Seed-averaged per-profile levels (40 seeds): measured 0.667–0.708, spread 0.041.
    let averagedPerProfile =
        wideningProfiles
        |> List.map (fun profile ->
            [ 0 .. 39 ]
            |> List.averageBy (fun seed -> (ok (BusDelaySim.runSim seed profile 200 16)).RhoPost))
    let averagedSpread = List.max averagedPerProfile - List.min averagedPerProfile
    Assert.True(averagedSpread < 0.08,
        sprintf "seed-averaged rhoPost spread %f ≥ 0.08: %A" averagedSpread averagedPerProfile)
    // The Egg's ≈ 0.63 LEVEL replays as the band the averaged levels live in.
    averagedPerProfile
    |> List.iter (fun level -> Assert.InRange(level, 0.55, 0.80))

// ── EGG-4: the variance-link rate check (Soraya Q2, executable) ──────────────────────────────────

[<Fact>]
let ``EGG-4 Var(mu_i - mu_k) scales like sigma^2 |n_i - n_k| / n^2 (variance link, loose)`` () =
    // Identical priors (PriorSpread = 0) so μᵢ − μₖ is purely observational; truth = 0 and the
    // delivered sets are prefixes, so E[μᵢ − μₖ] = 0 and (μᵢ − μₖ)² is an unbiased one-sample
    // variance estimate. Aggregate over 200 seeds × all C(8,2) pairs and compare against the
    // predicted σ²·|nᵢ − nₖ|/n̄² rate. Measured ratio: 0.961.
    let mutable measuredSum = 0.0
    let mutable predictedSum = 0.0
    for seed in 0 .. 199 do
        let config =
            { BusDelaySim.defaultConfig seed BusDelaySim.LoRa 200 8 with PriorSpread = 0.0 }
        let result = ok (BusDelaySim.run config)
        let meanCount = result.Counts |> Array.averageBy float
        for i in 0 .. result.Means.Length - 2 do
            for k in i + 1 .. result.Means.Length - 1 do
                let meanDiff = result.Means.[i] - result.Means.[k]
                measuredSum <- measuredSum + meanDiff * meanDiff
                predictedSum <-
                    predictedSum + float (abs (result.Counts.[i] - result.Counts.[k])) / (meanCount * meanCount)
    let ratio = measuredSum / predictedSum  // σ² = 1 in the default config
    Assert.InRange(ratio, 0.7, 1.4)

// ── EGG-5: rhoPrecision vs rhoCount — homoscedastic agreement, heteroscedastic divergence ────────

[<Fact>]
let ``EGG-5a rhoPrecision equals rhoCount exactly in the homoscedastic case (sigma = 1)`` () =
    // σ = 1 ⟹ τᵢ − τ₀ = nᵢ exactly (sums of 1.0 are exact), and CV is scale-invariant, so the
    // two metrics coincide bit-for-bit — the ordering across profiles trivially agrees.
    for profile in wideningProfiles do
        let result = ok (BusDelaySim.runSim 42 profile 200 16)
        Assert.Equal(result.RhoCount, result.RhoPrecision)

[<Fact>]
let ``EGG-5b rhoPrecision diverges from rhoCount under a heteroscedastic stream (Soraya Q1)`` () =
    // High-precision first half (σ = 0.2, precision 25), low-precision second half (σ = 2.0,
    // precision 0.25): laggards miss only low-information tail observations, so their
    // accumulated precision barely lags while their raw count does — the count metric
    // OVERSTATES temporal decorrelation. Measured divergence at seed 42 / LoRa: 0.033.
    let heteroscedastic =
        { BusDelaySim.defaultConfig 42 BusDelaySim.LoRa 200 16 with
            ObsSigma = (fun tick -> if tick < 100 then 0.2 else 2.0) }
    let result = ok (BusDelaySim.run heteroscedastic)
    Assert.True(result.RhoPrecision - result.RhoCount > 0.01,
        sprintf "expected rhoPrecision ≫ rhoCount under low-information tail; got count=%f precision=%f"
            result.RhoCount result.RhoPrecision)

// ── EGG-6: determinism (DST replay) ──────────────────────────────────────────────────────────────

[<Fact>]
let ``EGG-6 same seed implies identical SimResult (DST replay)`` () =
    for profile in wideningProfiles do
        let first = ok (BusDelaySim.runSim 7 profile 300 16)
        let second = ok (BusDelaySim.runSim 7 profile 300 16)
        Assert.True((first = second), sprintf "replay diverged for %A" profile)
    // And different seeds actually move the run (the RNG is live, not vestigial).
    let seedA = ok (BusDelaySim.runSim 7 BusDelaySim.Disrupted 300 16)
    let seedB = ok (BusDelaySim.runSim 8 BusDelaySim.Disrupted 300 16)
    Assert.False((seedA = seedB))

// ── Config validation (Result-over-exception) ────────────────────────────────────────────────────

[<Fact>]
let ``EGG-guard invalid configs are rejected as Error, not exceptions`` () =
    Assert.Equal(Error (BusDelaySim.TooFewCells 1), BusDelaySim.runSim 1 BusDelaySim.Ideal 10 1)
    Assert.Equal(Error (BusDelaySim.NoTicks 0), BusDelaySim.runSim 1 BusDelaySim.Ideal 0 4)
    let badSigma =
        { BusDelaySim.defaultConfig 1 BusDelaySim.Ideal 10 4 with ObsSigma = (fun _ -> 0.0) }
    Assert.Equal(Error (BusDelaySim.NonPositiveSigma (0, 0.0)), BusDelaySim.run badSigma)
    let badPrior =
        { BusDelaySim.defaultConfig 1 BusDelaySim.Ideal 10 4 with PriorPrecision = 0.0 }
    Assert.Equal(Error (BusDelaySim.NonPositivePriorPrecision 0.0), BusDelaySim.run badPrior)
