module Zeta.Tests.Simulation.CartelToyTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support.CartelInjector


/// **Toy cartel detector — Amara Otto-122 validation bar.**
///
/// The test that closes the theory-cathedral-prevention loop:
/// if the Graph substrate design is RIGHT, a dumb detector
/// using only `largestEigenvalue` should catch a dumb 5-node
/// cartel among 50 baseline validators at high detection rate
/// across many seeds. If it fails, the ADR is wrong.
///
/// Detection rule (MVP; single-signal):
///   detected = lambda_attacked >= detectionMultiplier * lambda_baseline
///
/// Real-world detection uses composite scores + null-baseline
/// calibration; this MVP establishes that the PRIMITIVE WORKS.


/// Parameters matching Amara's 15th/16th ferry prescription:
/// 50 validators + 5-node cartel + ~3 average degree per node.
let private nodeCount = 50
let private cartelSize = 5
let private avgDegree = 3
let private cartelWeight = 10L
let private detectionMultiplier = 2.0
let private eigenIter = 500
let private eigenTol = 1e-9


/// Single trial: generate baseline + attacked variants with a
/// fresh RNG seeded by `seed`; compute eigenvalues; return true
/// iff attacked-lambda crossed the `detectionMultiplier * baseline-
/// lambda` threshold.
let private runTrial (seed: int) : bool =
    let rng = System.Random(seed)
    let baseline = buildBaseline rng nodeCount avgDegree
    let attacked, _cartelNodes =
        injectCartel rng baseline cartelSize cartelWeight nodeCount
    let baselineLambda =
        Graph.largestEigenvalue eigenTol eigenIter baseline
        |> Option.defaultValue 0.0
    let attackedLambda =
        Graph.largestEigenvalue eigenTol eigenIter attacked
        |> Option.defaultValue 0.0
    attackedLambda >= detectionMultiplier * baselineLambda


[<Fact>]
let ``toy cartel detector — 100 seeds, detection rate >= 90%`` () =
    // 100-seed MVP. Target 90% detection rate per Amara Otto-122
    // validation bar (1000-seed scaled-up run is a follow-up
    // bench-project, not a unit-test obligation).
    let trials = 100
    let hits =
        [| 0 .. trials - 1 |]
        |> Array.map runTrial
        |> Array.filter id
        |> Array.length
    let rate = double hits / double trials
    rate |> should (be greaterThanOrEqualTo) 0.9


[<Fact>]
let ``toy cartel detector — clean baseline rarely triggers (false-positive rate <= 20%)`` () =
    // Sanity check: run detection on baseline vs baseline (no
    // cartel injection). The rule compares `baseline-lambda vs
    // 2*baseline-lambda-of-another-seed`. Because baseline is
    // synthetic-random, two independent baselines can have
    // mildly different lambdas; we allow up to 20% false-
    // positive rate as a generous upper bound. Real null-
    // baseline calibration (per Amara 14th ferry) would set
    // thresholds from percentile-of-baseline-distribution;
    // this MVP verifies the order-of-magnitude is right.
    let trials = 100
    let falsePositives =
        [| 0 .. trials - 1 |]
        |> Array.map (fun seed ->
            let rng1 = System.Random(seed * 2)
            let rng2 = System.Random(seed * 2 + 1)
            let baseline1 = buildBaseline rng1 nodeCount avgDegree
            let baseline2 = buildBaseline rng2 nodeCount avgDegree
            let lambda1 =
                Graph.largestEigenvalue eigenTol eigenIter baseline1
                |> Option.defaultValue 0.0
            let lambda2 =
                Graph.largestEigenvalue eigenTol eigenIter baseline2
                |> Option.defaultValue 0.0
            lambda2 >= detectionMultiplier * lambda1)
        |> Array.filter id
        |> Array.length
    let rate = double falsePositives / double trials
    rate |> should (be lessThanOrEqualTo) 0.2
