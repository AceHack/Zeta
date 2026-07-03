namespace Zeta.Bayesian

open System
open Zeta.Core

/// **`Web3Settlement` — The Token Layer of the Attention Economy.**
///
/// This module connects the pure Information Value (IV) and AntiSybil pricing 
/// mechanisms to a concrete settlement layer. It takes the output of `AskBidClearing`
/// and executes the token transfer.
///
/// Denomination: The token is pegged 1:1 to Information Value (nats of KL divergence).
/// Hard Cap: The total token supply an agent can earn is bounded by the AntiSybil 
/// entropy budget.
[<RequireQualifiedAccess>]
module Web3Settlement =

    /// Represents an agent's on-chain or off-chain wallet.
    type Wallet =
        { AgentId: string
          BalanceIV: float
          ReputationScore: float }

    /// A ledger tracking all balances.
    type Ledger = Map<string, Wallet>

    /// A settled transaction in the attention economy.
    type TransactionReceipt =
        { BuyerId: string
          SellerId: string
          AmountIV: float
          Timestamp: DateTime }

    /// Processes a cleared market result and updates the ledger.
    let settleClearedMarket 
        (ledger: Ledger) 
        (ask: AskBidClearing.Ask)
        (result: AskBidClearing.ClearingResult) 
        (timestamp: DateTime) : Ledger * TransactionReceipt option =
        
        match result with
        | AskBidClearing.NoClearing -> (ledger, None)
        | AskBidClearing.Cleared (buyerId, price) ->
            let sellerId = ask.SellerId
            
            // Fetch or initialize wallets
            let buyerWallet = 
                match Map.tryFind buyerId ledger with
                | Some w -> w
                | None -> { AgentId = buyerId; BalanceIV = 0.0; ReputationScore = 0.0 }
                
            let sellerWallet = 
                match Map.tryFind sellerId ledger with
                | Some w -> w
                | None -> { AgentId = sellerId; BalanceIV = 0.0; ReputationScore = 0.0 }
                
            let newBuyerWallet = { buyerWallet with BalanceIV = buyerWallet.BalanceIV - price }
            let newSellerWallet = { sellerWallet with 
                                        BalanceIV = sellerWallet.BalanceIV + price
                                        ReputationScore = sellerWallet.ReputationScore + 1.0 }
                                        
            let newLedger = 
                ledger 
                |> Map.add buyerId newBuyerWallet
                |> Map.add sellerId newSellerWallet
                
            let receipt = 
                { BuyerId = buyerId
                  SellerId = sellerId
                  AmountIV = price
                  Timestamp = timestamp }
                  
            (newLedger, Some receipt)

    /// End-to-end settlement: takes raw bids, applies AntiSybil uniqueness discount,
    /// clears the market, and settles the ledger.
    let executeFullMarketCycle
        (ledger: Ledger)
        (ask: AskBidClearing.Ask)
        (rawBids: AskBidClearing.Bid list)
        (memoryGraph: Map<string, string list>)
        (societyHistories: AntiSybil.StreamHistory list)
        (prior: Gaussian)
        (newBelief: Gaussian)
        (timestamp: DateTime) : Ledger * TransactionReceipt option =
        
        // 1. Apply AntiSybil pricing to cap bids based on uniqueness
        let adjustedBids =
            rawBids |> List.map (fun bid ->
                let senderHistory = 
                    societyHistories 
                    |> List.tryFind (fun h -> h.AgentId = bid.BuyerId)
                    |> Option.map (fun h -> h.Beliefs)
                    |> Option.defaultValue []
                    
                let adjustedIv = AntiSybil.priceAgainstSociety prior newBelief senderHistory societyHistories
                // The bid amount cannot exceed the AntiSybil-adjusted true value
                let finalMaxPrice = min bid.MaxPrice (float adjustedIv)
                { bid with MaxPrice = finalMaxPrice }
            )
            
        // 2. Clear the market (Arrow-escape via cardinal clearing + memory graph bound)
        let result = AskBidClearing.clearMarket ask adjustedBids memoryGraph
        
        // 3. Settle the ledger
        settleClearedMarket ledger ask result timestamp
