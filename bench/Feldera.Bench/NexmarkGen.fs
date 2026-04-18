module Zeta.Feldera.Bench.NexmarkGen

open System


/// Nexmark event generator — minimal port of the canonical Nexmark
/// event types (Bid, Auction, Person) used by Feldera + Flink for
/// cross-system streaming benchmarks. Single-threaded generator with
/// a deterministic seed so runs are reproducible.
///
/// Reference schema: https://datalab.cs.pdx.edu/niagara/pstream/


type Bid = {
    AuctionId: int64
    BidderId: int64
    Price: int64
    DateTime: int64
}

type Auction = {
    Id: int64
    SellerId: int64
    Category: int32
    ExpiresAt: int64
    DateTime: int64
}

type Person = {
    Id: int64
    Name: string
    State: string
    DateTime: int64
}

type NexmarkEvent =
    | BidEv of Bid
    | AuctionEv of Auction
    | PersonEv of Person


let private states = [| "CA" ; "WA" ; "OR" ; "TX" ; "NY" ; "FL" ; "IL" ; "PA" |]
let private firstNames = [| "Alice" ; "Bob" ; "Carol" ; "Dan" ; "Eve" ; "Frank" |]
let private lastNames = [| "Smith" ; "Jones" ; "Lee" ; "Patel" ; "Kim" ; "Davis" |]


/// Generate `n` events according to the classic Nexmark ratio: 92%
/// bids, 6% auctions, 2% persons. Deterministic for a given seed.
let generate (seed: int) (n: int) : NexmarkEvent seq =
    let rng = Random seed
    seq {
        for i in 0 .. n - 1 do
            let pick = rng.Next 100
            let t = int64 i   // use index as event time so the stream is ordered
            if pick < 92 then
                yield BidEv {
                    AuctionId = int64 (rng.Next 10_000)
                    BidderId = int64 (rng.Next 100_000)
                    Price = int64 (rng.Next 10_000)
                    DateTime = t
                }
            elif pick < 98 then
                yield AuctionEv {
                    Id = int64 i
                    SellerId = int64 (rng.Next 100_000)
                    Category = rng.Next 16
                    ExpiresAt = t + 1000L
                    DateTime = t
                }
            else
                yield PersonEv {
                    Id = int64 i
                    Name = firstNames.[rng.Next firstNames.Length] + " " + lastNames.[rng.Next lastNames.Length]
                    State = states.[rng.Next states.Length]
                    DateTime = t
                }
    }
