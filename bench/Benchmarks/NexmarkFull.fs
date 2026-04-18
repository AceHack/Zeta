module Zeta.Benchmarks.NexmarkFull

open System
open System.Runtime.CompilerServices
open System.Threading.Tasks
open BenchmarkDotNet.Attributes
open Zeta.Core


/// Full Nexmark query suite Q4-Q8 — complement to the Q1-Q3 in Nexmark.fs.
/// The queries are adapted from the canonical spec at
/// https://github.com/nexmark/nexmark. Each runs against the same
/// synthetic auction / bid / person streams.

[<Struct; IsReadOnly>]
type Bid2 = {
    AuctionId: int64
    BidderId: int64
    PriceCents: int64
    EventTime: int64
    Extra: string
}

[<Struct; IsReadOnly>]
type Auction2 = {
    AuctionId: int64
    SellerId: int64
    Category: int32
    InitialBid: int64
    Expires: int64
    EventTime: int64
}

[<Struct; IsReadOnly>]
type Person2 = {
    PersonId: int64
    Name: string
    EventTime: int64
}


/// Q4: Average price of items in each auction category.
///     `SELECT category, AVG(final) FROM (... winning bids ...) GROUP BY category`
[<MemoryDiagnoser>]
type Q4_AvgFinalByCategory() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private bids: ZSetInputHandle<Bid2>
    [<DefaultValue(false)>] val mutable private auctions: ZSetInputHandle<Auction2>
    [<DefaultValue(false)>] val mutable private bidData: Bid2[]
    [<DefaultValue(false)>] val mutable private auctionData: Auction2[]

    [<Params(5_000, 25_000)>] member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.bids <- this.c.ZSetInput<Bid2>()
        this.auctions <- this.c.ZSetInput<Auction2>()
        let bidRel = this.c.IntegrateZSet this.bids.Stream
        let auctionRel = this.c.IntegrateZSet this.auctions.Stream
        // For each auction, take the max bid as the final price.
        let maxByAuction =
            this.c.GroupByMax(
                bidRel,
                Func<_, _>(fun (b: Bid2) -> b.AuctionId),
                Func<_, _>(fun (b: Bid2) -> b.PriceCents))
        // Join final-prices with auctions to get category, then avg by category.
        let finalsByAuction =
            this.c.Map(maxByAuction, Func<_, _>(fun (aucId, price) -> struct (aucId, price)))
        let auctionCategory =
            this.c.Map(auctionRel, Func<_, _>(fun (a: Auction2) ->
                struct (a.AuctionId, a.Category)))
        let joined =
            this.c.Join(
                finalsByAuction, auctionCategory,
                Func<_, _>(fun (struct (aucId, _)) -> aucId),
                Func<_, _>(fun (struct (aucId, _)) -> aucId),
                Func<_, _, _>(fun (struct (_, price)) (struct (_, cat)) ->
                    struct (cat, price)))
        let avg =
            this.c.GroupByAverage(
                joined,
                Func<_, _>(fun (struct (cat, _)) -> cat),
                Func<_, _>(fun (struct (_, price)) -> price))
        this.c.Output avg |> ignore
        this.c.Build()
        let rng = Random 42
        this.auctionData <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 i
                   SellerId = int64 (rng.Next this.Size)
                   Category = int32 (rng.Next 10)
                   InitialBid = int64 (rng.Next 1000)
                   Expires = int64 i + 1000L
                   EventTime = int64 i } |]
        this.bidData <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 (rng.Next this.Size + 1)
                   BidderId = int64 (rng.Next this.Size)
                   PriceCents = int64 (rng.Next 10000)
                   EventTime = int64 i
                   Extra = "" } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for a in this.auctionData do
                this.auctions.Send(ZSet.singleton a 1L)
            for b in this.bidData do
                this.bids.Send(ZSet.singleton b 1L)
            do! this.c.StepAsync()
        }


/// Q5: Hot items — auctions with the most bids over a sliding window.
///     `SELECT auction, COUNT(*) FROM bids [WINDOW] GROUP BY auction`
[<MemoryDiagnoser>]
type Q5_HotItems() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private bids: ZSetInputHandle<Bid2>
    [<DefaultValue(false)>] val mutable private data: Bid2[]

    [<Params(5_000, 25_000)>] member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.bids <- this.c.ZSetInput<Bid2>()
        let windowed =
            this.c.TumblingWindow(
                this.bids.Stream,
                Func<_, _>(fun (b: Bid2) -> b.EventTime),
                100L)   // 100-unit windows
        let counts =
            this.c.GroupByCount(windowed, Func<_, _>(fun (_w, b) -> b.AuctionId))
        this.c.Output counts |> ignore
        this.c.Build()
        let rng = Random 17
        this.data <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 (rng.Next 100)
                   BidderId = int64 (rng.Next this.Size)
                   PriceCents = int64 (rng.Next 10000)
                   EventTime = int64 i
                   Extra = "" } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for b in this.data do this.bids.Send(ZSet.singleton b 1L)
            do! this.c.StepAsync()
        }


/// Q6: Average selling price by seller.
///     `SELECT seller, AVG(final) FROM (... winning bids ...) GROUP BY seller`
[<MemoryDiagnoser>]
type Q6_AvgBySeller() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private bids: ZSetInputHandle<Bid2>
    [<DefaultValue(false)>] val mutable private auctions: ZSetInputHandle<Auction2>

    [<Params(5_000)>] member val Size = 0 with get, set
    [<DefaultValue(false)>] val mutable private bData: Bid2[]
    [<DefaultValue(false)>] val mutable private aData: Auction2[]

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.bids <- this.c.ZSetInput<Bid2>()
        this.auctions <- this.c.ZSetInput<Auction2>()
        let bidRel = this.c.IntegrateZSet this.bids.Stream
        let auctionRel = this.c.IntegrateZSet this.auctions.Stream
        let maxByAuction =
            this.c.GroupByMax(bidRel,
                Func<_, _>(fun (b: Bid2) -> b.AuctionId),
                Func<_, _>(fun (b: Bid2) -> b.PriceCents))
        let mBA =
            this.c.Map(maxByAuction, Func<_, _>(fun (aId, p) -> struct (aId, p)))
        let aBySeller =
            this.c.Map(auctionRel, Func<_, _>(fun (a: Auction2) ->
                struct (a.AuctionId, a.SellerId)))
        let joined =
            this.c.Join(mBA, aBySeller,
                Func<_, _>(fun (struct (a, _)) -> a),
                Func<_, _>(fun (struct (a, _)) -> a),
                Func<_, _, _>(fun (struct (_, p)) (struct (_, s)) -> struct (s, p)))
        let avg =
            this.c.GroupByAverage(joined,
                Func<_, _>(fun (struct (s, _)) -> s),
                Func<_, _>(fun (struct (_, p)) -> p))
        this.c.Output avg |> ignore
        this.c.Build()
        let rng = Random 99
        this.aData <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 i
                   SellerId = int64 (rng.Next (this.Size / 10))
                   Category = int32 (rng.Next 10)
                   InitialBid = 0L
                   Expires = int64 (i + 1000)
                   EventTime = int64 i } |]
        this.bData <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 (rng.Next this.Size + 1)
                   BidderId = int64 i
                   PriceCents = int64 (rng.Next 10000)
                   EventTime = int64 i
                   Extra = "" } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for a in this.aData do this.auctions.Send(ZSet.singleton a 1L)
            for b in this.bData do this.bids.Send(ZSet.singleton b 1L)
            do! this.c.StepAsync()
        }


/// Q7: Highest bid in each window.
///     `SELECT MAX(price) FROM bids [WINDOW]`
[<MemoryDiagnoser>]
type Q7_HighestBidPerWindow() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private bids: ZSetInputHandle<Bid2>
    [<DefaultValue(false)>] val mutable private data: Bid2[]

    [<Params(5_000, 25_000)>] member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.bids <- this.c.ZSetInput<Bid2>()
        let windowed =
            this.c.TumblingWindow(this.bids.Stream,
                Func<_, _>(fun (b: Bid2) -> b.EventTime),
                100L)
        let maxByWindow =
            this.c.GroupByMax(windowed,
                Func<_, _>(fun (w, _) -> w),
                Func<_, _>(fun (_, b: Bid2) -> b.PriceCents))
        this.c.Output maxByWindow |> ignore
        this.c.Build()
        let rng = Random 11
        this.data <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 (rng.Next this.Size)
                   BidderId = int64 i
                   PriceCents = int64 (rng.Next 100000)
                   EventTime = int64 i
                   Extra = "" } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for b in this.data do this.bids.Send(ZSet.singleton b 1L)
            do! this.c.StepAsync()
        }


/// Q8: Monitor new users — semi-join of Person and Auction streams per window.
///     `SELECT P.id, P.name, A.reserve FROM persons P JOIN auctions A ON P.id = A.seller [WINDOW]`
[<MemoryDiagnoser>]
type Q8_NewUsersAuctioning() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private persons: ZSetInputHandle<Person2>
    [<DefaultValue(false)>] val mutable private auctions: ZSetInputHandle<Auction2>
    [<DefaultValue(false)>] val mutable private pData: Person2[]
    [<DefaultValue(false)>] val mutable private aData: Auction2[]

    [<Params(5_000)>] member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.persons <- this.c.ZSetInput<Person2>()
        this.auctions <- this.c.ZSetInput<Auction2>()
        let pRel = this.c.IntegrateZSet this.persons.Stream
        let aRel = this.c.IntegrateZSet this.auctions.Stream
        let joined =
            this.c.Join(pRel, aRel,
                Func<_, _>(fun (p: Person2) -> p.PersonId),
                Func<_, _>(fun (a: Auction2) -> a.SellerId),
                Func<_, _, _>(fun (p: Person2) (a: Auction2) ->
                    struct (p.PersonId, p.Name, a.InitialBid)))
        this.c.Output joined |> ignore
        this.c.Build()
        let rng = Random 3
        this.pData <-
            [| for i in 1 .. this.Size ->
                 { PersonId = int64 i ; Name = $"u{i}" ; EventTime = int64 i } |]
        this.aData <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 i
                   SellerId = int64 (rng.Next this.Size + 1)
                   Category = int32 (rng.Next 10)
                   InitialBid = int64 (rng.Next 1000)
                   Expires = int64 (i + 1000)
                   EventTime = int64 i } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for p in this.pData do this.persons.Send(ZSet.singleton p 1L)
            for a in this.aData do this.auctions.Send(ZSet.singleton a 1L)
            do! this.c.StepAsync()
        }
