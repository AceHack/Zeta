namespace Zeta.Bayesian.Tests

open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core
open Zeta.Bayesian
open Zeta.Bayesian.AttentionRouter

module ReticulumRouterTests =

    let mkAgent id pMean prec tMean tPrec =
        { Id = id
          Belief = { PrecisionMean = pMean; Precision = prec }
          Trajectory = { DeltaPrecisionMean = tMean; DeltaPrecision = tPrec } }

    [<Fact>]
    let ``RR-1: High-delay connections get higher weight than low-delay connections with same KL`` () =
        // Agent A has something to say to B and C.
        // A -> B and A -> C have the exact same KL divergence and alignment.
        // But A -> C goes over a high-delay Reticulum link.
        let a = mkAgent "A" 2.0 1.0 1.0 0.1
        let b = mkAgent "B" 0.0 1.0 1.0 0.1
        let c = mkAgent "C" 0.0 1.0 1.0 0.1

        let agents = [a; b; c]
        
        let latencyMap = 
            Map.ofList [
                ("A", "B"), 0.0 // Instant / Correlated
                ("A", "C"), 10.0 // High delay / Independent
            ]

        // Don't normalize so we can see the raw weights
        let config = { AttentionRouter.defaultConfig with NormalizeOutgoing = false }
        
        let decisions = AttentionRouter.routeWithReticulum config agents latencyMap
        
        let aToB = decisions |> List.find (fun d -> d.Weight.From = "A" && d.Weight.To = "B")
        let aToC = decisions |> List.find (fun d -> d.Weight.From = "A" && d.Weight.To = "C")
        
        Assert.True(aToC.Weight.Weight > aToB.Weight.Weight, "High delay should provide a Condorcet bonus")

    [<Fact>]
    let ``RR-2: routeWithReticulum without latency map behaves exactly like route`` () =
        let a = mkAgent "A" 2.0 1.0 1.0 0.1
        let b = mkAgent "B" 0.0 1.0 1.0 0.1
        let c = mkAgent "C" 0.0 1.0 1.0 0.1

        let agents = [a; b; c]
        let config = AttentionRouter.defaultConfig

        let decisionsBase = AttentionRouter.route config agents
        let decisionsRet = AttentionRouter.routeWithReticulum config agents Map.empty

        Assert.Equal(decisionsBase.Length, decisionsRet.Length)
        
        for i in 0 .. decisionsBase.Length - 1 do
            Assert.Equal(decisionsBase.[i].Weight.From, decisionsRet.[i].Weight.From)
            Assert.Equal(decisionsBase.[i].Weight.To, decisionsRet.[i].Weight.To)
            Assert.Equal(decisionsBase.[i].Weight.Weight, decisionsRet.[i].Weight.Weight, 9)
