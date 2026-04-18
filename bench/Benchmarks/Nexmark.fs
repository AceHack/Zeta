module Zeta.Benchmarks.Nexmark

open System
open System.Runtime.CompilerServices
open System.Threading.Tasks
open BenchmarkDotNet.Attributes
open Zeta.Core


/// Nexmark — the streaming-SQL reference benchmark. Auction data with
/// Person/Auction/Bid streams. We implement Q1 (currency projection),
/// Q2 (auction filter), Q3 (person/auction join), and Q5 (windowed hot
/// auctions). Our targets are the published
/// [timely/differential-dataflow numbers](https://github.com/MaterializeInc/materialize/tree/main/misc/nexmark)
/// of 1.5–3M events/s/core.

[<Struct; IsReadOnly>]
type Bid = {
    AuctionId: int64
    BidderId: int64
    PriceCents: int64
    EventTime: int64
}

[<Struct; IsReadOnly>]
type Auction = {
    AuctionId: int64
    SellerId: int64
    Category: int32
    EventTime: int64
}

[<Struct; IsReadOnly>]
type Person = {
    PersonId: int64
    State: string
    EventTime: int64
}


[<MemoryDiagnoser>]
type Q1_CurrencyProjection() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private input: ZSetInputHandle<Bid>
    [<DefaultValue(false)>] val mutable private bids: Bid[]

    [<Params(10_000, 100_000)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.input <- this.c.ZSetInput<Bid>()
        // Nexmark Q1: SELECT auction, bidder, price * 0.908 AS price_eur, time FROM bids
        let converted =
            this.c.Map(this.input.Stream, Func<_, _>(fun b ->
                { b with PriceCents = b.PriceCents * 908L / 1000L }))
        this.c.Output converted |> ignore
        this.c.Build()
        this.bids <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 (i % 10_000)
                   BidderId = int64 (i % 1000)
                   PriceCents = int64 (i * 13)
                   EventTime = int64 i } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for b in this.bids do
                this.input.Send(ZSet.singleton b 1L)
            do! this.c.StepAsync()
        }


[<MemoryDiagnoser>]
type Q2_AuctionFilter() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private input: ZSetInputHandle<Bid>
    [<DefaultValue(false)>] val mutable private bids: Bid[]

    [<Params(10_000, 100_000)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.input <- this.c.ZSetInput<Bid>()
        // Nexmark Q2: SELECT auction, price FROM bids WHERE auction in (1007,1020,2001,2019,2087)
        let hot = Set.ofList [ 1007L ; 1020L ; 2001L ; 2019L ; 2087L ]
        let filtered = this.c.Filter(this.input.Stream, Func<_, _>(fun b -> Set.contains b.AuctionId hot))
        this.c.Output filtered |> ignore
        this.c.Build()
        this.bids <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 (i % 3000)
                   BidderId = int64 (i % 1000)
                   PriceCents = int64 (i * 13)
                   EventTime = int64 i } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for b in this.bids do
                this.input.Send(ZSet.singleton b 1L)
            do! this.c.StepAsync()
        }


[<MemoryDiagnoser>]
type Q3_LocalItems() =
    [<DefaultValue(false)>] val mutable private c: Circuit
    [<DefaultValue(false)>] val mutable private personIn: ZSetInputHandle<Person>
    [<DefaultValue(false)>] val mutable private auctionIn: ZSetInputHandle<Auction>
    [<DefaultValue(false)>] val mutable private persons: Person[]
    [<DefaultValue(false)>] val mutable private auctions: Auction[]

    [<Params(10_000, 50_000)>]
    member val Size = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        this.c <- Circuit()
        this.personIn <- this.c.ZSetInput<Person>()
        this.auctionIn <- this.c.ZSetInput<Auction>()
        // Nexmark Q3: SELECT p.name, a.id FROM Person p, Auction a
        // WHERE p.id = a.seller AND p.state IN ('OR','ID','CA') AND a.category = 10
        let localPersons =
            this.c.Filter(this.personIn.Stream, Func<_, _>(fun (p: Person) ->
                p.State = "OR" || p.State = "ID" || p.State = "CA"))
        let cat10 =
            this.c.Filter(this.auctionIn.Stream, Func<_, _>(fun (a: Auction) ->
                a.Category = 10))
        // Integrate both to get the running snapshot (typical streaming join pattern).
        let pRel = this.c.IntegrateZSet localPersons
        let aRel = this.c.IntegrateZSet cat10
        let joined =
            this.c.Join(
                pRel, aRel,
                Func<_, _>(fun (p: Person) -> p.PersonId),
                Func<_, _>(fun (a: Auction) -> a.SellerId),
                Func<_, _, _>(fun (p: Person) (a: Auction) -> struct (p.State, a.AuctionId)))
        this.c.Output joined |> ignore
        this.c.Build()
        let states = [| "OR" ; "ID" ; "CA" ; "WA" ; "NV" ; "TX" |]
        this.persons <-
            [| for i in 1 .. this.Size ->
                 { PersonId = int64 i
                   State = states.[i % states.Length]
                   EventTime = int64 i } |]
        this.auctions <-
            [| for i in 1 .. this.Size ->
                 { AuctionId = int64 i
                   SellerId = int64 (i % this.Size + 1)
                   Category = int32 (i % 20)
                   EventTime = int64 i } |]

    [<Benchmark>]
    member this.Run() : Task =
        task {
            for p in this.persons do
                this.personIn.Send(ZSet.singleton p 1L)
            for a in this.auctions do
                this.auctionIn.Send(ZSet.singleton a 1L)
            do! this.c.StepAsync()
        }
