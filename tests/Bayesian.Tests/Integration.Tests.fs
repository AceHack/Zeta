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
        let fastTelemetry = { ReticulumTransport.RttSeconds = 0.1; ReticulumTransport.Snr = 10.0; ReticulumTransport.Rssi = -50.0; ReticulumTransport.CapacityBps = 1000.0 }
        let slowTelemetry = { ReticulumTransport.RttSeconds = 2.5; ReticulumTransport.Snr = 5.0; ReticulumTransport.Rssi = -80.0; ReticulumTransport.CapacityBps = 100.0 }
        
        let snapshot = { 
            ReticulumTransport.MeshSnapshot.LocalNodeId = "Local"
            ReticulumTransport.MeshSnapshot.ActiveLinks = 
                Map.ofList [ ("FastRemote", fastTelemetry); ("SlowRemote", slowTelemetry) ] 
        }
        
        let latencyMap = ReticulumTransport.buildLatencyMap snapshot
        
        let fastLatency = Map.find ("Local", "FastRemote") latencyMap
        let slowLatency = Map.find ("Local", "SlowRemote") latencyMap
        
        Assert.True(slowLatency > fastLatency, "Slower link should map to higher latency")
        Assert.Equal(2.5, slowLatency)
        Assert.Equal(0.1, fastLatency)

    [<Fact>]
    let ``RT-2: Latency map is symmetric`` () =
        let telemetry = { ReticulumTransport.RttSeconds = 1.5; ReticulumTransport.Snr = 8.0; ReticulumTransport.Rssi = -60.0; ReticulumTransport.CapacityBps = 500.0 }
        
        let snapshot = { 
            ReticulumTransport.MeshSnapshot.LocalNodeId = "A"
            ReticulumTransport.MeshSnapshot.ActiveLinks = Map.ofList [ ("B", telemetry) ] 
        }
        
        let latencyMap = ReticulumTransport.buildLatencyMap snapshot
        
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
