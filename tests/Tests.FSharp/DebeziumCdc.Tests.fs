module Zeta.Tests.DebeziumCdcTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module CDC = Zeta.Core.DebeziumCdc

// Debezium CDC <-> Z-set delta (081KTH0WQ3C): read a Debezium change stream into Z-set deltas and emit our
// deltas as Debezium events. before/after/op IS the delta: c=+after, d=-before, u=-before+after, r=+after.

[<Fact>]
let ``op code round-trips for every op`` () =
    for op in [ CDC.Create; CDC.Update; CDC.Delete; CDC.Read; CDC.Truncate ] do
        Assert.Equal<CDC.Op option>(Some op, CDC.opOfCode (CDC.codeOfOp op))
    Assert.Equal<CDC.Op option>(None, CDC.opOfCode "?")

[<Fact>]
let ``read: each op maps to the right Z-set delta`` () =
    Assert.Equal<ZSet<int>>(ZSet.singleton 7 1L, CDC.toZSetDelta (CDC.create 7))
    Assert.Equal<ZSet<int>>(ZSet.singleton 7 -1L, CDC.toZSetDelta (CDC.delete 7))
    Assert.Equal<ZSet<int>>(ZSet.singleton 7 1L, CDC.toZSetDelta { Op = CDC.Read; Before = None; After = Some 7 })
    // update = retract old + insert new
    Assert.Equal<ZSet<int>>(ZSet.ofSeq [ 1, -1L; 2, 1L ], CDC.toZSetDelta (CDC.update 1 2))
    // truncate can't be a bounded delta -> empty
    Assert.Equal<ZSet<int>>(ZSet.Empty, CDC.toZSetDelta { Op = CDC.Truncate; Before = None; After = None })

[<Fact>]
let ``write: positive weights become creates, negative become deletes (with multiplicity)`` () =
    let delta = ZSet.ofSeq [ 1, 2L; 2, -1L ]
    let events = CDC.ofZSetDelta delta
    Assert.Equal(2, events |> List.filter (fun e -> e.Op = CDC.Create && e.After = Some 1) |> List.length)
    Assert.Equal(1, events |> List.filter (fun e -> e.Op = CDC.Delete && e.Before = Some 2) |> List.length)

[<Property>]
let ``law: read∘write = id at the delta level (sum of emitted events' deltas = original)`` (pairs: (int * int64) list) =
    // bound weights small so the multiplicity expansion stays finite/cheap
    let delta = pairs |> List.map (fun (k, w) -> k, (w % 5L)) |> ZSet.ofSeq
    let roundTrip = CDC.ofZSetDelta delta |> List.map CDC.toZSetDelta |> List.fold (+) ZSet.Empty
    roundTrip = delta
