namespace Zeta.Bayesian

/// **`AskBidClearing` — the cardinal market mechanism for resource allocation.**
///
/// In Web3, resource allocation (e.g., "who gets this attention slot?", "who executes this task?")
/// is often handled by token-weighted voting. This is a dictatorial social welfare function
/// and is fully subject to Arrow's Impossibility Theorem.
///
/// Zeta escapes this by replacing collective preference aggregation with a **market**.
/// Asks and bids are cardinal numbers (prices). The market clears arithmetically.
/// There is no collective ranking to compute.
///
/// The market is bounded by the **memory graph**: an agent can only bid on an ask
/// if it is in the reachability subgraph of the asking agent. This provides the
/// Sybil-resistance and liquidity constraints naturally, without global consensus.
[<RequireQualifiedAccess>]
module AskBidClearing =

    type Ask =
        { AskId: string
          SellerId: string
          /// The minimum price the seller will accept.
          MinPrice: float
          /// The resource being sold (e.g., an attention slot, compute time).
          Resource: string }

    type Bid =
        { BidId: string
          BuyerId: string
          /// The maximum price the buyer is willing to pay.
          MaxPrice: float }

    type ClearingResult =
        | /// The market cleared. The buyer pays the clearing price.
          Cleared of buyerId: string * price: float
        | /// No valid bids met the minimum price within the reachable subgraph.
          NoClearing

    /// Clear a single ask against a list of bids, restricted by the memory graph.
    /// 
    /// Arrow escape: This is a standard first-price sealed-bid auction (or similar mechanism),
    /// which maps cardinal bids to a single allocation. It does not attempt to rank
    /// all buyers collectively.
    let clearMarket (ask: Ask) (allBids: Bid list) (memoryGraph: Map<string, string list>) : ClearingResult =
        // 1. Filter to only reachable buyers (the "entangled subgraph" constraint)
        let reachableBids =
            allBids
            |> List.filter (fun bid ->
                // The seller must "remember" (or be able to reach) the buyer.
                // This prevents global Sybil attacks by bounding the market to the local trust graph.
                match Map.tryFind ask.SellerId memoryGraph with
                | Some neighbors -> List.contains bid.BuyerId neighbors
                | None -> false)

        // 2. Filter to bids that meet the reserve price
        let validBids =
            reachableBids
            |> List.filter (fun bid -> bid.MaxPrice >= ask.MinPrice)

        // 3. Find the highest bid
        match validBids |> List.sortByDescending (fun b -> b.MaxPrice) with
        | highestBid :: _ ->
            // Clear at the highest bid price (or second-price, depending on mechanism design).
            // Here we use first-price for simplicity.
            Cleared (highestBid.BuyerId, highestBid.MaxPrice)
        | [] ->
            NoClearing
