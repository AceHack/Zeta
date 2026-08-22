module Zeta.Bayesian.Tests.SocietyBootstrapTests

open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Make a proper Gaussian from mean and variance (both > 0).
let private gaussian (mean: float) (variance: float) : Gaussian =
    { PrecisionMean = mean / variance; Precision = 1.0 / variance }

/// Three reference-frame agents with distinct, proper priors.
/// Agent A: confident near 0.0 (low variance)
/// Agent B: confident near 2.0 (low variance)
/// Agent C: uncertain (high variance) — the "weak" agent
let private threeAgents () : ReferenceFrameAgent list =
    [ { Id = "Agent-A"; Prior = gaussian 0.0 1.0;  VarIndex = 0 }
      { Id = "Agent-B"; Prior = gaussian 2.0 1.0;  VarIndex = 0 }
      { Id = "Agent-C"; Prior = gaussian 1.0 4.0;  VarIndex = 0 } ]

// ---------------------------------------------------------------------------
// SB-1: The joint posterior is proper (soft-mode invariant holds at runtime)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-1 joint marginal is always proper`` () =
    let result = SocietyNetwork.run 100 1e-6 (threeAgents ())
    Assert.True(result.IsProper,
        sprintf "Joint marginal is improper: τ=%.4f" result.JointMarginal.Precision)

// ---------------------------------------------------------------------------
// SB-2: The joint posterior is strictly more precise than any single agent
//        (Condorcet observable at runtime)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-2 joint precision strictly dominates every solo posterior`` () =
    let agents = threeAgents ()
    let result = SocietyNetwork.run 100 1e-6 agents
    let jointPrecision = result.JointMarginal.Precision
    for KeyValue(id, solo) in result.SoloPosteriors do
        Assert.True(jointPrecision > solo.Precision,
            sprintf "Joint τ=%.4f did not dominate %s solo τ=%.4f"
                jointPrecision id solo.Precision)

// ---------------------------------------------------------------------------
// SB-3: Every agent has a positive precision gain (every frame is load-bearing)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-3 every agent has positive precision gain from joining the society`` () =
    let result = SocietyNetwork.run 100 1e-6 (threeAgents ())
    for KeyValue(id, gain) in result.PrecisionGains do
        Assert.True(gain > 0.0,
            sprintf "%s has non-positive precision gain: %.4f" id gain)

// ---------------------------------------------------------------------------
// SB-4: Removing any agent degrades the joint (mutual empowerment observable)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-4 removing any agent degrades the joint posterior`` () =
    let agents = threeAgents ()
    let full = SocietyNetwork.run 100 1e-6 agents
    let fullPrecision = full.JointMarginal.Precision
    for agent in agents do
        let reduced = SocietyNetwork.runWithout 100 1e-6 agent.Id agents
        Assert.True(reduced.Precision < fullPrecision,
            sprintf "Removing %s did not degrade joint: full τ=%.4f, reduced τ=%.4f"
                agent.Id fullPrecision reduced.Precision)

// ---------------------------------------------------------------------------
// SB-5: The mutual empowerment score is positive
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-5 mutual empowerment score is positive`` () =
    let score = SocietyNetwork.mutualEmpowermentScore 100 1e-6 (threeAgents ())
    Assert.True(score > 0.0,
        sprintf "Mutual empowerment score is non-positive: %.4f" score)

// ---------------------------------------------------------------------------
// SB-6: The network converges (runToFixpoint terminates before maxRounds)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-6 network converges within 100 rounds`` () =
    let result = SocietyNetwork.run 100 1e-6 (threeAgents ())
    Assert.True(result.Rounds < 100,
        sprintf "Network did not converge: %d rounds" result.Rounds)

// ---------------------------------------------------------------------------
// SB-7: The joint mean is a precision-weighted average of the agent priors
//        (the Bayesian fusion formula — the algebraic correctness check)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-7 joint mean is the precision-weighted average of agent priors`` () =
    let agents = threeAgents ()
    let result = SocietyNetwork.run 100 1e-6 agents
    // Analytic: joint PrecisionMean = sum(τ_i * μ_i), joint Precision = sum(τ_i)
    let totalPM = agents |> List.sumBy (fun a -> a.Prior.PrecisionMean)
    let totalP  = agents |> List.sumBy (fun a -> a.Prior.Precision)
    let expectedMean = totalPM / totalP
    let actualMean   = result.JointMarginal.PrecisionMean / result.JointMarginal.Precision
    Assert.True(abs (actualMean - expectedMean) < 1e-4,
        sprintf "Joint mean mismatch: expected %.4f, got %.4f" expectedMean actualMean)

// ---------------------------------------------------------------------------
// SB-8 (FsCheck): For any 2 proper agents, the joint is more precise
//                 than every solo — Condorcet holds universally
// ---------------------------------------------------------------------------
[<Property(MaxTest = 200)>]
let ``SB-8 Condorcet holds for any 2 proper agents``
    (PositiveInt p1raw) (NormalFloat pm1raw)
    (PositiveInt p2raw) (NormalFloat pm2raw) =
    let p1 = float (max 1 p1raw)
    let p2 = float (max 1 p2raw)
    let agents =
        [ { Id = "A0"; Prior = { PrecisionMean = pm1raw * p1; Precision = p1 }; VarIndex = 0 }
          { Id = "A1"; Prior = { PrecisionMean = pm2raw * p2; Precision = p2 }; VarIndex = 0 } ]
    let result = SocietyNetwork.run 200 1e-6 agents
    let jointP = result.JointMarginal.Precision
    result.IsProper &&
    (result.SoloPosteriors |> Map.forall (fun _ solo -> jointP > solo.Precision))

// ---------------------------------------------------------------------------
// SB-9 (FsCheck): Mutual empowerment score is always positive for 2 agents
// ---------------------------------------------------------------------------
[<Property(MaxTest = 200)>]
let ``SB-9 mutual empowerment score is always positive for 2 agents``
    (PositiveInt p1raw) (NormalFloat pm1raw)
    (PositiveInt p2raw) (NormalFloat pm2raw) =
    let p1 = float (max 1 p1raw)
    let p2 = float (max 1 p2raw)
    let agents =
        [ { Id = "A0"; Prior = { PrecisionMean = pm1raw * p1; Precision = p1 }; VarIndex = 0 }
          { Id = "A1"; Prior = { PrecisionMean = pm2raw * p2; Precision = p2 }; VarIndex = 0 } ]
    let score = SocietyNetwork.mutualEmpowermentScore 200 1e-6 agents
    score > 0.0

// ---------------------------------------------------------------------------
// SB-10: Demo output — print the society result to stdout for human inspection
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-10 demo: 3-agent society bootstrap output`` () =
    let agents = threeAgents ()
    let result = SocietyNetwork.run 100 1e-6 agents
    let description = SocietyNetwork.describe result
    // Print for human inspection (xUnit captures stdout)
    printfn "%s" description
    // The demo always passes — it is a legibility test, not a correctness test
    Assert.True(true)
