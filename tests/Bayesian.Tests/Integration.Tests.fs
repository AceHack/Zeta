namespace Zeta.Bayesian.Tests

open System
open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian
open Zeta.Core

module IntegrationTests =

    let makeBelief mean = { Gaussian.PrecisionMean = mean * 1.0; Precision = 1.0 }

    [<Fact>]
    let ``RT-1: High RTT yields higher latency map value`` () =
        let fastTelemetry = { MeshLatencyModel.RttSeconds = 0.1; MeshLatencyModel.Snr = 10.0; MeshLatencyModel.Rssi = -50.0; MeshLatencyModel.CapacityBps = 1000.0 }
        let slowTelemetry = { MeshLatencyModel.RttSeconds = 2.5; MeshLatencyModel.Snr = 5.0; MeshLatencyModel.Rssi = -80.0; MeshLatencyModel.CapacityBps = 100.0 }
        
        let snapshot = { 
            MeshLatencyModel.MeshSnapshot.LocalNodeId = "Local"
            MeshLatencyModel.MeshSnapshot.ActiveLinks = 
                Map.ofList [ ("FastRemote", fastTelemetry); ("SlowRemote", slowTelemetry) ] 
        }
        
        let latencyMap = MeshLatencyModel.buildLatencyMap snapshot
        
        let fastLatency = Map.find ("Local", "FastRemote") latencyMap
        let slowLatency = Map.find ("Local", "SlowRemote") latencyMap
        
        Assert.True(slowLatency > fastLatency, "Slower link should map to higher latency")
        Assert.Equal(2.5, slowLatency)
        Assert.Equal(0.1, fastLatency)

    [<Fact>]
    let ``RT-2: Latency map is symmetric`` () =
        let telemetry = { MeshLatencyModel.RttSeconds = 1.5; MeshLatencyModel.Snr = 8.0; MeshLatencyModel.Rssi = -60.0; MeshLatencyModel.CapacityBps = 500.0 }
        
        let snapshot = { 
            MeshLatencyModel.MeshSnapshot.LocalNodeId = "A"
            MeshLatencyModel.MeshSnapshot.ActiveLinks = Map.ofList [ ("B", telemetry) ] 
        }
        
        let latencyMap = MeshLatencyModel.buildLatencyMap snapshot
        
        let ab = Map.find ("A", "B") latencyMap
        let ba = Map.find ("B", "A") latencyMap
        Assert.Equal(ab, ba)

    [<Fact>]
    let ``W3-1: Settlement updates ledger balances correctly`` () =
        let initialLedger: Web3Settlement.Ledger = 
            Map.ofList [
                ("Buyer", { Web3Settlement.AgentId = "Buyer"; Web3Settlement.BalanceIV = 10.0; Web3Settlement.ReputationScore = 5.0 })
                ("Seller", { Web3Settlement.AgentId = "Seller"; Web3Settlement.BalanceIV = 2.0; Web3Settlement.ReputationScore = 1.0 })
            ]
            
        let ask = { AskBidClearing.AskId = "ask1"; AskBidClearing.SellerId = "Seller"; AskBidClearing.MinPrice = 1.0; AskBidClearing.Resource = "attention-slot" }
        let result = AskBidClearing.Cleared ("Buyer", 3.0)
        
        let (newLedger, receiptOpt) = Web3Settlement.settleClearedMarket initialLedger ask result DateTime.UtcNow
        
        Assert.True(receiptOpt.IsSome)
        let receipt = receiptOpt.Value
        Assert.Equal("Buyer", receipt.BuyerId)
        Assert.Equal("Seller", receipt.SellerId)
        Assert.Equal(3.0, receipt.AmountIV)
        
        let newBuyer = Map.find "Buyer" newLedger
        let newSeller = Map.find "Seller" newLedger
        
        Assert.Equal(7.0, newBuyer.BalanceIV)
        Assert.Equal(5.0, newSeller.BalanceIV)
        Assert.Equal(2.0, newSeller.ReputationScore) // Reputation bumped

    [<Fact>]
    let ``W3-2: Full cycle applies AntiSybil cap to clone bids`` () =
        let ledger: Web3Settlement.Ledger = Map.empty
        let ask = { AskBidClearing.AskId = "ask1"; AskBidClearing.SellerId = "Seller"; AskBidClearing.MinPrice = 0.5; AskBidClearing.Resource = "slot" }
        let memoryGraph = Map.ofList [ ("Seller", ["CloneA"; "CloneB"]) ]
        
        // Two clones bidding very high
        let rawBids = [
            { AskBidClearing.BidId = "b1"; AskBidClearing.BuyerId = "CloneA"; AskBidClearing.MaxPrice = 100.0 }
            { AskBidClearing.BidId = "b2"; AskBidClearing.BuyerId = "CloneB"; AskBidClearing.MaxPrice = 100.0 }
        ]
        
        // Their histories are identical (correlation = 1.0)
        let cloneHistory = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0 ]
        let societyHistories = [
            { AntiSybil.StreamHistory.AgentId = "CloneA"; AntiSybil.StreamHistory.Beliefs = cloneHistory }
            { AntiSybil.StreamHistory.AgentId = "CloneB"; AntiSybil.StreamHistory.Beliefs = cloneHistory }
        ]
        
        let prior = makeBelief 0.0
        let newBelief = makeBelief 5.0
        
        let (_, receiptOpt) = 
            Web3Settlement.executeFullMarketCycle ledger ask rawBids memoryGraph societyHistories prior newBelief DateTime.UtcNow
            
        // Because they are clones of each other, their uniqueness discount is 0.
        // Their adjusted bids become 0.0, which is below the minimum price of 0.5.
        // Market should fail to clear.
        Assert.True(receiptOpt.IsNone, "Market should not clear for Sybil clones with 0 adjusted value")

    [<Fact>]
    let ``E2E-1: Full stack integration (Telemetry -> Settlement)`` () =
        // 1. PHYSICAL LAYER: Reticulum Telemetry
        let telemetry = { MeshLatencyModel.RttSeconds = 2.0; MeshLatencyModel.Snr = 10.0; MeshLatencyModel.Rssi = -50.0; MeshLatencyModel.CapacityBps = 1000.0 }
        let snapshot = { 
            MeshLatencyModel.MeshSnapshot.LocalNodeId = "Buyer"
            MeshLatencyModel.MeshSnapshot.ActiveLinks = Map.ofList [ ("Seller", telemetry) ] 
        }
        
        // 2. TRANSPORT: Convert telemetry to latency map
        let latencyMap = MeshLatencyModel.buildLatencyMap snapshot
        Assert.Equal(2.0, Map.find ("Buyer", "Seller") latencyMap)
        
        // 3. COGNITION: Agents have beliefs — need multi-point histories for correlation
        let prior = makeBelief 0.0
        let sellerBelief = makeBelief 5.0
        
        // Buyer's history tracks the seller closely (correlated)
        let buyerBeliefs = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0; makeBelief 5.0 ]
        // Society has both the buyer and a reference agent with the same trajectory
        let buyerHistory = { AntiSybil.StreamHistory.AgentId = "Buyer"; AntiSybil.StreamHistory.Beliefs = buyerBeliefs }
        let sellerHistory = { AntiSybil.StreamHistory.AgentId = "Seller"; AntiSybil.StreamHistory.Beliefs = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0; makeBelief 5.0 ] }
        let societyHistories = [ buyerHistory; sellerHistory ]
        
        // 4. DENOMINATION & MONETARY POLICY: Compute IV and apply AntiSybil
        let baseIv = InformationValue.compute prior sellerBelief
        
        // Buyer tracks seller perfectly (ρ=1), so uniqueness discount = 0 → adjusted IV = 0
        let adjustedIv = AntiSybil.priceAgainstSociety prior sellerBelief buyerBeliefs societyHistories
        // Perfect correlation with seller history → zero IV (the hard money cap in action)
        Assert.Equal(0.0, float adjustedIv)
        
        // 5. MARKET: Ask and Bids
        let ask = { AskBidClearing.AskId = "ask1"; AskBidClearing.SellerId = "Seller"; AskBidClearing.MinPrice = 0.5; AskBidClearing.Resource = "attention" }
        // Memory graph bounds the market (Seller remembers Buyer)
        let memoryGraph = Map.ofList [ ("Seller", ["Buyer"]) ]
        
        // Buyer bids high, but will be capped by AntiSybil true value
        let rawBids = [ { AskBidClearing.BidId = "b1"; AskBidClearing.BuyerId = "Buyer"; AskBidClearing.MaxPrice = 100.0 } ]
        
        // 6. SETTLEMENT: Execute the full cycle
        // Because the buyer is perfectly correlated with the seller, their bid gets capped to 0.
        // This means the market FAILS TO CLEAR (0.0 < MinPrice of 0.5).
        // This is the hard-money cap in action: clones cannot buy attention.
        let initialLedger: Web3Settlement.Ledger = 
            Map.ofList [ ("Buyer", { Web3Settlement.AgentId = "Buyer"; Web3Settlement.BalanceIV = 10.0; Web3Settlement.ReputationScore = 0.0 }) ]
            
        let (newLedger, receiptOpt) = 
            Web3Settlement.executeFullMarketCycle initialLedger ask rawBids memoryGraph societyHistories prior sellerBelief DateTime.UtcNow
            
        // 7. VERIFY: Market does NOT clear because clone's adjusted bid = 0 < MinPrice
        Assert.True(receiptOpt.IsNone, "Market should NOT clear for a perfectly correlated buyer (clone)")
        
        // Ledger unchanged — no money moved
        let buyerWallet = Map.find "Buyer" newLedger
        Assert.Equal(10.0, buyerWallet.BalanceIV)

    [<Fact>]
    let ``W3-3: NoClearing result leaves ledger unchanged`` () =
        let initialLedger: Web3Settlement.Ledger = 
            Map.ofList [
                ("Agent", { Web3Settlement.AgentId = "Agent"; Web3Settlement.BalanceIV = 5.0; Web3Settlement.ReputationScore = 3.0 })
            ]
            
        let ask = { AskBidClearing.AskId = "ask1"; AskBidClearing.SellerId = "Seller"; AskBidClearing.MinPrice = 1.0; AskBidClearing.Resource = "slot" }
        let result = AskBidClearing.NoClearing
        
        let (newLedger, receiptOpt) = Web3Settlement.settleClearedMarket initialLedger ask result DateTime.UtcNow
        
        Assert.True(receiptOpt.IsNone)
        Assert.Equal<Web3Settlement.Ledger>(initialLedger, newLedger)
