namespace Zeta.Bayesian.Tests

open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian

module ArrowEscapeTests =

    let precisionThreshold = 10.0

    [<Fact>]
    let ``AE-1: Local consensus ignores irrelevant alternatives (agents outside the memory graph)`` () =
        let q : LocalConsensus.BinaryQuestion =
            { Id = "Q1"; Prior = { PrecisionMean = 0.0; Precision = 1.0 } }
        
        let agents = [
            ("A", { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }) // leans Yes
            ("B", { Gaussian.PrecisionMean = 5.0; Precision = 5.0 }) // leans Yes
            ("C", { Gaussian.PrecisionMean = -100.0; Precision = 100.0 }) // strongly leans No (the irrelevant alternative)
        ]
        
        // A and B are entangled. C is outside the memory graph.
        let memoryGraph = Map.ofList [("Root", ["A"; "B"])]
        
        let consensusWithC = LocalConsensus.evaluateLocal q agents memoryGraph "Root" precisionThreshold
        
        // C should be completely ignored, so A and B should reach a Yes consensus.
        match consensusWithC with
        | LocalConsensus.ConsensusState.ResolvedYes _ -> Assert.True(true)
        | _ -> Assert.True(false, "Should have resolved Yes because C is ignored")

    [<Fact>]
    let ``AE-2: Market clearing respects memory graph liquidity constraints`` () =
        let ask : AskBidClearing.Ask =
            { AskId = "Ask1"; SellerId = "Seller"; MinPrice = 10.0; Resource = "Slot1" }
        
        let bids : AskBidClearing.Bid list = [
            { BidId = "Bid1"; BuyerId = "A"; MaxPrice = 15.0 } // Good price, but not in memory graph
            { BidId = "Bid2"; BuyerId = "B"; MaxPrice = 12.0 } // Lower price, but in memory graph
        ]
        
        // Only B is in the Seller's memory graph
        let memoryGraph = Map.ofList [("Seller", ["B"])]
        
        let result = AskBidClearing.clearMarket ask bids memoryGraph
        
        match result with
        | AskBidClearing.ClearingResult.Cleared(buyerId, price) ->
            Assert.Equal("B", buyerId)
            Assert.Equal(12.0, price)
        | _ -> Assert.True(false, "Market should have cleared for B")

    [<Property>]
    let ``AE-3: Local consensus is commutative (order-independent) over the entangled subgraph`` (xs: NormalFloat list) =
        // Generate a random set of beliefs for the entangled agents
        let beliefs = xs |> List.map (fun f -> { Gaussian.PrecisionMean = float f; Precision = 1.0 })
        let q : LocalConsensus.BinaryQuestion =
            { Id = "Q1"; Prior = { PrecisionMean = 0.0; Precision = 1.0 } }
        
        // Use a very high threshold so we always stay in Undecided (avoids mu=0 boundary)
        let highThreshold = 1e12
        let result1 = LocalConsensus.evaluate q beliefs highThreshold
        let result2 = LocalConsensus.evaluate q (List.rev beliefs) highThreshold
        
        // The joint posterior must be identical regardless of fold order,
        // because Gaussian multiplication is commutative (addition of natural params).
        let gaussianOf = function
            | LocalConsensus.ConsensusState.Undecided g -> g
            | LocalConsensus.ConsensusState.ResolvedYes g -> g
            | LocalConsensus.ConsensusState.ResolvedNo g -> g
        let g1 = gaussianOf result1
        let g2 = gaussianOf result2
        abs (g1.PrecisionMean - g2.PrecisionMean) < 1e-10
        && abs (g1.Precision - g2.Precision) < 1e-10

    [<Fact>]
    let ``AE-4: Adding an entangled agent sharpens consensus (more evidence = more precision)`` () =
        let q : LocalConsensus.BinaryQuestion =
            { Id = "Q1"; Prior = { PrecisionMean = 0.0; Precision = 1.0 } }
        
        let twoAgents = [
            { Gaussian.PrecisionMean = 3.0; Precision = 3.0 }
            { Gaussian.PrecisionMean = 3.0; Precision = 3.0 }
        ]
        let threeAgents = twoAgents @ [{ Gaussian.PrecisionMean = 3.0; Precision = 3.0 }]
        
        let r2 = LocalConsensus.evaluate q twoAgents precisionThreshold
        let r3 = LocalConsensus.evaluate q threeAgents precisionThreshold
        
        let precisionOf = function
            | LocalConsensus.ConsensusState.Undecided g -> g.Precision
            | LocalConsensus.ConsensusState.ResolvedYes g -> g.Precision
            | LocalConsensus.ConsensusState.ResolvedNo g -> g.Precision
        
        Assert.True(precisionOf r3 > precisionOf r2, "More agents = more precision")

    [<Fact>]
    let ``AE-5: Market does not clear when no bids are in the memory graph (Sybil resistance)`` () =
        let ask : AskBidClearing.Ask =
            { AskId = "Ask1"; SellerId = "Seller"; MinPrice = 5.0; Resource = "Slot1" }
        
        let bids : AskBidClearing.Bid list = [
            { BidId = "Bid1"; BuyerId = "Sybil1"; MaxPrice = 100.0 }
            { BidId = "Bid2"; BuyerId = "Sybil2"; MaxPrice = 200.0 }
        ]
        
        // No Sybils are in the Seller's memory graph
        let memoryGraph = Map.ofList [("Seller", ["TrustedBuyer"])]
        
        let result = AskBidClearing.clearMarket ask bids memoryGraph
        
        match result with
        | AskBidClearing.ClearingResult.NoClearing -> Assert.True(true)
        | _ -> Assert.True(false, "Sybils should be excluded by memory graph")

    [<Fact>]
    let ``AE-6: Unrestricted domain is explicitly violated - non-entangled agents have no opinion`` () =
        let q : LocalConsensus.BinaryQuestion =
            { Id = "Q1"; Prior = { PrecisionMean = 0.0; Precision = 1.0 } }
        
        let agents = [
            ("A", { Gaussian.PrecisionMean = 10.0; Precision = 10.0 }) // Strong Yes
            ("B", { Gaussian.PrecisionMean = 10.0; Precision = 10.0 }) // Strong Yes
            ("C", { Gaussian.PrecisionMean = -10.0; Precision = 10.0 }) // Strong No
            ("D", { Gaussian.PrecisionMean = -10.0; Precision = 10.0 }) // Strong No
        ]
        
        // Cluster 1: A and B are entangled
        let memoryGraph1 = Map.ofList [("Root1", ["A"; "B"])]
        let result1 = LocalConsensus.evaluateLocal q agents memoryGraph1 "Root1" precisionThreshold
        
        // Cluster 2: C and D are entangled
        let memoryGraph2 = Map.ofList [("Root2", ["C"; "D"])]
        let result2 = LocalConsensus.evaluateLocal q agents memoryGraph2 "Root2" precisionThreshold
        
        // Two different clusters can reach OPPOSITE conclusions on the same question.
        // This is not a contradiction — it is the correct behavior of a local consensus system.
        // Arrow's theorem would forbid this if it were a global social welfare function.
        match result1, result2 with
        | LocalConsensus.ConsensusState.ResolvedYes _, LocalConsensus.ConsensusState.ResolvedNo _ ->
            Assert.True(true, "Different clusters can reach opposite conclusions — Arrow does not apply")
        | _ -> Assert.True(false, "Expected opposite conclusions from disjoint clusters")

    [<Fact>]
    let ``AE-7: Market clearing is cardinal (prices, not rankings) — no IIA violation possible`` () =
        let ask : AskBidClearing.Ask =
            { AskId = "Ask1"; SellerId = "Seller"; MinPrice = 10.0; Resource = "Slot1" }
        
        let memoryGraph = Map.ofList [("Seller", ["A"; "B"; "C"])]
        
        // Scenario 1: A and B bid
        let bids1 : AskBidClearing.Bid list = [
            { BidId = "Bid1"; BuyerId = "A"; MaxPrice = 20.0 }
            { BidId = "Bid2"; BuyerId = "B"; MaxPrice = 15.0 }
        ]
        let result1 = AskBidClearing.clearMarket ask bids1 memoryGraph
        
        // Scenario 2: A, B, and C bid (C is the "irrelevant alternative")
        let bids2 : AskBidClearing.Bid list = [
            { BidId = "Bid1"; BuyerId = "A"; MaxPrice = 20.0 }
            { BidId = "Bid2"; BuyerId = "B"; MaxPrice = 15.0 }
            { BidId = "Bid3"; BuyerId = "C"; MaxPrice = 12.0 }
        ]
        let result2 = AskBidClearing.clearMarket ask bids2 memoryGraph
        
        // Adding C should NOT change the winner (A wins both times).
        // This is IIA satisfied trivially because it's a price mechanism, not a ranking.
        match result1, result2 with
        | AskBidClearing.ClearingResult.Cleared(id1, _), AskBidClearing.ClearingResult.Cleared(id2, _) ->
            Assert.Equal(id1, id2)
            Assert.Equal("A", id1)
        | _ -> Assert.True(false, "Both should clear for A")
