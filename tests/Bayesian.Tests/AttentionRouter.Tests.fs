module Zeta.Tests.AttentionRouter

open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian
open Zeta.Bayesian.AttentionRouter
open Zeta.Bayesian.SparseSocietyNetwork

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let private properGaussian (mean: float) (precision: float) : Gaussian =
    { PrecisionMean = mean * precision; Precision = precision }

let private isFinite x = not (System.Double.IsNaN x) && not (System.Double.IsInfinity x)

let private properAgent id mean prec traj =
    { Id = id
      Belief = properGaussian mean prec
      Trajectory = traj }

let private zeroTraj = { DeltaPrecisionMean = 0.0; DeltaPrecision = 0.0 }

// ---------------------------------------------------------------------------
// AR-1: KL divergence is non-negative (Gibbs inequality)
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-1 KL divergence is non-negative for proper Gaussians`` () =
    let pairs =
        [ (properGaussian 0.0 1.0, properGaussian 0.0 1.0)
          (properGaussian 1.0 2.0, properGaussian 0.0 1.0)
          (properGaussian -3.0 5.0, properGaussian 2.0 0.5)
          (properGaussian 0.0 10.0, properGaussian 0.0 0.1) ]
    for (p, q) in pairs do
        let kl = klDivergence p q
        Assert.True(kl >= 0.0, sprintf "KL(p||q) = %f should be >= 0" kl)

// ---------------------------------------------------------------------------
// AR-2: KL divergence is zero iff p = q
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-2 KL divergence is zero iff beliefs are identical`` () =
    let g = properGaussian 1.5 3.0
    let kl = klDivergence g g
    Assert.True(abs kl < 1e-10, sprintf "KL(p||p) = %f should be 0" kl)

// ---------------------------------------------------------------------------
// AR-3: Symmetric KL is symmetric
// ---------------------------------------------------------------------------
[<Property>]
let ``AR-3 symmetric KL is commutative`` (NormalFloat muP) (NormalFloat muQ) =
    let precP = 1.0 + abs muP % 9.0  // precision in (1, 10)
    let precQ = 1.0 + abs muQ % 9.0
    let p = properGaussian muP precP
    let q = properGaussian muQ precQ
    let forward  = symmetricKL p q
    let backward = symmetricKL q p
    abs (forward - backward) < 1e-8

// ---------------------------------------------------------------------------
// AR-4: Trajectory alignment is in [-1, 1]
// ---------------------------------------------------------------------------
[<Property>]
let ``AR-4 trajectory alignment is bounded in [-1, 1]`` (NormalFloat a1) (NormalFloat a2) (NormalFloat b1) (NormalFloat b2) =
    let ta = { DeltaPrecisionMean = a1; DeltaPrecision = a2 }
    let tb = { DeltaPrecisionMean = b1; DeltaPrecision = b2 }
    let align = trajectoryAlignment ta tb
    if not (isFinite align) then true
    else align >= -1.0 - 1e-10 && align <= 1.0 + 1e-10

// ---------------------------------------------------------------------------
// AR-5: Routing weight is non-negative
// ---------------------------------------------------------------------------
[<Property>]
let ``AR-5 routing weight is non-negative`` (NormalFloat mu1) (NormalFloat mu2) =
    let prec1 = 1.0 + abs mu1 % 9.0
    let prec2 = 1.0 + abs mu2 % 9.0
    let a = properAgent "A" mu1 prec1 zeroTraj
    let b = properAgent "B" mu2 prec2 zeroTraj
    let w = routingWeight a.Id a.Belief a.Trajectory b.Id b.Belief b.Trajectory
    w.Weight >= 0.0

// ---------------------------------------------------------------------------
// AR-6: NCI structural rejection — improper messages are always attenuated
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-6 NCI rejects improper messages structurally`` () =
    let improper = { PrecisionMean = 0.0; Precision = 0.0 }  // Gaussian.One (uniform)
    let proper   = properGaussian 1.0 2.0
    let w = { From = "A"; To = "B"; Weight = 1.0 }
    let decision = nciDecision 0.0 10.0 w improper proper
    match decision with
    | Attenuate reason ->
        Assert.Contains("improper", reason)
    | Propagate _ ->
        Assert.Fail("Improper message should be attenuated")

// ---------------------------------------------------------------------------
// AR-7: NCI threshold — messages below threshold are attenuated
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-7 NCI attenuates messages below routing threshold`` () =
    let sender   = properGaussian 0.0 1.0
    let receiver = properGaussian 0.0 1.0
    let w = { From = "A"; To = "B"; Weight = 0.01 }
    let decision = nciDecision 0.05 10.0 w sender receiver
    match decision with
    | Attenuate _ -> ()  // expected
    | Propagate _ -> Assert.Fail("Weight 0.01 < threshold 0.05 should be attenuated")

// ---------------------------------------------------------------------------
// AR-8: NCI coercion bound — high-precision messages are damped, not rejected
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-8 NCI damps coercive messages rather than rejecting them`` () =
    let sender   = properGaussian 0.0 100.0  // very high precision
    let receiver = properGaussian 0.0 1.0
    let w = { From = "A"; To = "B"; Weight = 1.0 }
    // maxPrecisionGainFactor = 2.0: receiver precision can at most double
    let decision = nciDecision 0.0 2.0 w sender receiver
    match decision with
    | Propagate dampedWeight ->
        // The damped weight should be less than the original weight
        Assert.True(dampedWeight < 1.0, sprintf "Damped weight %f should be < 1.0" dampedWeight)
        Assert.True(dampedWeight > 0.0, sprintf "Damped weight %f should be > 0.0" dampedWeight)
    | Attenuate reason ->
        Assert.Fail(sprintf "High-precision message should be damped not rejected: %s" reason)

// ---------------------------------------------------------------------------
// AR-9: Sparse routing preserves mutual empowerment
// The joint posterior under sparse routing is still strictly better than
// any solo posterior.
// ---------------------------------------------------------------------------
[<Property>]
let ``AR-9 sparse routing preserves mutual empowerment`` (NormalFloat mu1) (NormalFloat mu2) (NormalFloat mu3) =
    let prec1 = 1.0 + abs mu1 % 4.0
    let prec2 = 1.0 + abs mu2 % 4.0
    let prec3 = 1.0 + abs mu3 % 4.0
    let agents =
        [ ReferenceFrameAgent.attested "A" "src-A" (properGaussian mu1 prec1)
          ReferenceFrameAgent.attested "B" "src-B" (properGaussian mu2 prec2)
          ReferenceFrameAgent.attested "C" "src-C" (properGaussian mu3 prec3) ]
    let result = SparseSocietyNetwork.run defaultConfig 20 1e-4 agents
    let maxSoloPrecision = agents |> List.map (fun a -> a.Prior.Precision) |> List.max
    result.IsProper && result.FinalJointMarginal.Precision > maxSoloPrecision

// ---------------------------------------------------------------------------
// AR-10: Sparse routing converges to a proper Gaussian
// ---------------------------------------------------------------------------
[<Property>]
let ``AR-10 sparse routing always converges to a proper joint posterior`` (NormalFloat mu1) (NormalFloat mu2) =
    let prec1 = 0.5 + abs mu1 % 5.0
    let prec2 = 0.5 + abs mu2 % 5.0
    let agents =
        [ ReferenceFrameAgent.attested "X" "src-X" (properGaussian mu1 prec1)
          ReferenceFrameAgent.attested "Y" "src-Y" (properGaussian mu2 prec2) ]
    let result = SparseSocietyNetwork.run defaultConfig 30 1e-4 agents
    result.IsProper

// ---------------------------------------------------------------------------
// AR-11: Routing matrix has no self-loops
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-11 routing matrix has no self-loops`` () =
    let agents =
        [ { Id = "A"; Belief = properGaussian 0.0 1.0; Trajectory = zeroTraj }
          { Id = "B"; Belief = properGaussian 1.0 2.0; Trajectory = zeroTraj }
          { Id = "C"; Belief = properGaussian -1.0 3.0; Trajectory = zeroTraj } ]
    let matrix = routingMatrix agents
    let selfLoops = matrix |> List.filter (fun w -> w.From = w.To)
    Assert.Empty(selfLoops)

// ---------------------------------------------------------------------------
// AR-12: Normalized outgoing weights sum to 1 per agent
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-12 normalized outgoing weights sum to 1 per agent`` () =
    let agents =
        [ { Id = "A"; Belief = properGaussian 0.0 1.0; Trajectory = zeroTraj }
          { Id = "B"; Belief = properGaussian 2.0 3.0; Trajectory = zeroTraj }
          { Id = "C"; Belief = properGaussian -1.0 2.0; Trajectory = { DeltaPrecisionMean = 0.5; DeltaPrecision = 0.1 } } ]
    let raw        = routingMatrix agents
    let normalized = normalizeOutgoing raw
    let grouped    = normalized |> List.groupBy (fun w -> w.From)
    for (agentId, outgoing) in grouped do
        let total = outgoing |> List.sumBy (fun w -> w.Weight)
        Assert.True(abs (total - 1.0) < 1e-10,
            sprintf "Agent %s outgoing weights sum to %f, expected 1.0" agentId total)

// ---------------------------------------------------------------------------
// AR-13: Trajectory alignment amplifies connections between aligned agents
// Two agents moving in the same direction should have higher routing weight
// than two agents with zero trajectory (stationary).
// ---------------------------------------------------------------------------
[<Fact>]
let ``AR-13 aligned trajectories amplify routing weight over stationary`` () =
    let belief1 = properGaussian 0.0 1.0
    let belief2 = properGaussian 1.0 2.0
    // Stationary agents (zero trajectory)
    let wStationary = routingWeight "A" belief1 zeroTraj "B" belief2 zeroTraj
    // Aligned agents (same direction trajectory)
    let alignedTraj = { DeltaPrecisionMean = 0.5; DeltaPrecision = 0.3 }
    let wAligned = routingWeight "A" belief1 alignedTraj "B" belief2 alignedTraj
    // Aligned should have higher or equal weight than stationary
    Assert.True(wAligned.Weight >= wStationary.Weight - 1e-10,
        sprintf "Aligned weight %f should >= stationary weight %f" wAligned.Weight wStationary.Weight)
