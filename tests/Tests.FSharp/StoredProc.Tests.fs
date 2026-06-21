module Zeta.Tests.StoredProcTests

open global.Xunit
open Zeta.Core
open Zeta.Core.TableStream
open Zeta.Core.StoredProc

let private dv (s: string) = DynamicValue.String s

// the deltas exercised by the differential check (data + meta + non-string value)
let private deltas =
    [ Upsert("a", dv "1")
      Upsert("count", DynamicValue.Int 42L)
      Retract "a"
      Meta("schema", dv "v2") ]

[<Fact>]
let ``encode/decode round-trips every delta`` () =
    for d in deltas do
        Assert.Equal<Result<Delta, string>>(Ok d, decodeDelta (encodeDelta d))

[<Fact>]
let ``DIFFERENTIAL: native applyDelta == interpreted stored-proc (the per-test, #7049)`` () =
    // Across several starting tables and every op, the F#-native fold and the independent interpreter agree.
    let tables =
        [ emptyTable
          Map [ "a", dv "old" ]
          Map [ "a", dv "x"; "count", DynamicValue.Int 1L ] ]

    for t in tables do
        for d in deltas do
            let native = applyDelta t d
            let interpreted =
                match interpretApply t (encodeDelta d) with
                | Ok r -> r
                | Error e -> failwithf "interpret failed: %s" e
            Assert.Equal<Table>(native, interpreted)

[<Fact>]
let ``DIFFERENTIAL via interface: nativeProc and dynamicProc agree behind ITableProc (#7051)`` () =
    // Both implement the SAME interface (the DynamicValue one via an F# object expression); they agree.
    let tables = [ emptyTable; Map [ "a", dv "old" ] ]

    for t in tables do
        for d in deltas do
            let native: ITableProc = nativeProc d
            let dyn: ITableProc =
                match dynamicProc (encodeDelta d) with
                | Ok p -> p
                | Error e -> failwithf "dynamicProc failed: %s" e
            Assert.Equal<Table>(native.Apply t, dyn.Apply t)

[<Fact>]
let ``dynamicProc rejects a malformed stored-proc up front`` () =
    Assert.True(
        match dynamicProc (DynamicValue.String "nope") with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``interpret surfaces a malformed stored-proc as Error (no silent failure)`` () =
    Assert.True(
        match interpretApply emptyTable (DynamicValue.String "not-an-object") with
        | Error _ -> true
        | Ok _ -> false
    )
    Assert.True(
        match interpretApply emptyTable (DynamicValue.Object [ "op", DynamicValue.String "frob" ]) with
        | Error _ -> true
        | Ok _ -> false
    )

[<Fact>]
let ``decode rejects an unknown op`` () =
    Assert.True(
        match decodeDelta (DynamicValue.Object [ "op", DynamicValue.String "frob"; "key", dv "k" ]) with
        | Error _ -> true
        | Ok _ -> false
    )

// ── db noun-class: native vs interpreted differential (#7049 generalized, sequence step 2) ──

let private dbEvents : Db.DbEvent list =
    [ Db.DepSetup("/b", [ "/a" ])
      Db.PushDown "compiler.rust"
      Db.JitResolve("npm.left-pad", "1.3.0")
      Db.Create("/a", dv "1")
      Db.Update("/a", DynamicValue.Int 7L)
      Db.Delete "/a"
      Db.GSetCreate("/gset1", Some 2, Some "/heatsink1")
      Db.GSetAdd("/gset1", "item1")
      Db.GSetAdd("/gset1", "item2")
      Db.GSetAdd("/gset1", "item3")
      Db.ZSetCreate("/zset1", Some 1, Some "/heatsink2")
      Db.ZSetAdd("/zset1", "zitem1", 1L)
      Db.ZSetAdd("/zset1", "zitem2", 2L)
      Db.ZSetAdd("/zset1", "zitem1", -1L) ]

[<Fact>]
let ``db: encode/decode round-trips every DbEvent`` () =
    for ev in dbEvents do
        Assert.Equal<Result<Db.DbEvent, string>>(Ok ev, decodeDbEvent (encodeDbEvent ev))

[<Fact>]
let ``DIFFERENTIAL db: native Db.apply == interpreted stored-proc across all events and states`` () =
    let states =
        [ Db.empty Db.defaultBackend
          Db.fold Db.defaultBackend [ Db.Create("/a", dv "old"); Db.PushDown "x" ] ]

    for st in states do
        for ev in dbEvents do
            let native = Db.apply st ev
            let interpreted =
                match interpretDbApply st (encodeDbEvent ev) with
                | Ok r -> r
                | Error e -> failwithf "interpret failed: %s" e
            Assert.Equal<Db.DbState>(native, interpreted)

[<Fact>]
let ``DIFFERENTIAL db: native Db.fold == interpreted stored-proc fold across all events`` () =
    let native = Db.fold Db.defaultBackend dbEvents
    let encodedEvents = dbEvents |> List.map encodeDbEvent
    let interpreted =
        match interpretDbFold (Db.empty Db.defaultBackend) encodedEvents with
        | Ok r -> r
        | Error e -> failwithf "interpretDbFold failed: %s" e
    Assert.Equal<Db.DbState>(native, interpreted)

[<Fact>]
let ``db: capacity bounds and heat emission work correctly`` () =
    let events =
        [ Db.GSetCreate("/g1", Some 1, Some "/hs1")
          Db.GSetAdd("/g1", "a")
          Db.GSetAdd("/g1", "b") // count = 2 > cap = 1 -> heat
          Db.ZSetCreate("/z1", Some 1, Some "/hs2")
          Db.ZSetAdd("/z1", "x", 1L)
          Db.ZSetAdd("/z1", "y", 2L) // support count = 2 > cap = 1 -> heat
        ]
    let state = Db.fold Db.defaultBackend events

    Assert.True(GSet.contains "a" state.GSets.["/g1"])
    Assert.True(GSet.contains "b" state.GSets.["/g1"])
    Assert.Equal(1L, ZSet.lookup "x" state.ZSets.["/z1"])
    Assert.Equal(2L, ZSet.lookup "y" state.ZSets.["/z1"])

    Assert.Equal(2, state.HeatLog.Length)
    
    let (zSource, zKind, zUnits, zExcess, zDetail) = state.HeatLog.[0]
    Assert.Equal("/z1", zSource)
    Assert.Equal("zset-saturation", zKind)
    Assert.Equal(1, zUnits)
    Assert.Equal(1L, zExcess)
    
    let (gSource, gKind, gUnits, gExcess, gDetail) = state.HeatLog.[1]
    Assert.Equal("/g1", gSource)
    Assert.Equal("gset-saturation", gKind)
    Assert.Equal(1, gUnits)
    Assert.Equal(1L, gExcess)

[<Fact>]
let ``db: interpret/decode reject a malformed proc`` () =
    Assert.True(match interpretDbApply (Db.empty Db.defaultBackend) (dv "nope") with Error _ -> true | Ok _ -> false)
    Assert.True(match decodeDbEvent (DynamicValue.Object [ "op", dv "frob" ]) with Error _ -> true | Ok _ -> false)
