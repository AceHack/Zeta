module Zeta.Tests.ZSetRxTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// Bonsai Rx query connecting +1 and −1 (081M109WG5S087G0R0021E5MPT).
// The tree is generic: same bytes over ZSet<int> and ZSet<string>.
// DST: no clock, no IO.

let private boundW (w: int64) : int64 = w % 1_000_000L

let private zInt (pairs: (int * int64) list) : ZSet<int> =
    pairs |> List.map (fun (k, w) -> k, boundW w) |> ZSet.ofSeq

let private roundTrip (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s ->
        match Bonsai.parse s with
        | Ok e2 -> Some e2
        | Error _ -> None
    | Error _ -> None

[<Fact>]
let ``connectQuery round-trips as Bonsai bytes`` () =
    Assert.Equal<Bonsai.Expr option>(Some ZSetRx.connectQuery, roundTrip ZSetRx.connectQuery)
    Assert.Equal<Bonsai.Expr option>(Some ZSetRx.integrateQuery, roundTrip ZSetRx.integrateQuery)
    Assert.Equal<Bonsai.Expr option>(Some ZSetRx.retractQuery, roundTrip ZSetRx.retractQuery)

[<Fact>]
let ``connect of a delta and its retraction is empty (ping returns)`` () =
    let d = ZSet.ofSeq [ 1, 1L; 2, 4L ]
    match ZSetRx.connect d (ZSet.neg d) with
    | Ok view -> Assert.True(view.IsEmpty)
    | Error err -> failwith err

[<Fact>]
let ``the same connect query interprets over string keys (generic ZSet)`` () =
    let d = ZSet.ofSeq [ "a", 1L; "b", -3L ]
    match ZSetRx.apply1 ZSetRx.retractQuery d with
    | Ok retracted ->
        match ZSetRx.connect d retracted with
        | Ok view -> Assert.True(view.IsEmpty)
        | Error err -> failwith err
    | Error err -> failwith err

[<Fact>]
let ``integrateQuery unfolded over deltas is I`` () =
    let d1 = ZSet.ofSeq [ 1, 1L ]
    let d2 = ZSet.ofSeq [ 1, -1L; 2, 5L ]
    match ZSetRx.integrate [ d1; d2 ] with
    | Ok view -> Assert.Equal<ZSet<int>>(ZSet.ofSeq [ 2, 5L ], view)
    | Error err -> failwith err

[<Fact>]
let ``unknown Call declines rather than throwing`` () =
    let bogus = Bonsai.Lambda([ "x" ], Bonsai.Call("zset.not-a-fn", [ Bonsai.Param "x" ]))
    match ZSetRx.apply1 bogus (ZSet.ofSeq [ 1, 1L ]) with
    | Error msg -> Assert.Contains("unknown zset-rx fn", msg)
    | Ok _ -> failwith "expected decline"

[<Property>]
let ``connect(d, neg d) is empty for any int Z-set`` (pairs: (int * int64) list) =
    let d = zInt pairs
    match ZSetRx.connect d (ZSet.neg d) with
    | Ok view -> view.IsEmpty
    | Error _ -> false

[<Property>]
let ``Bonsai round-trip of connectQuery still annihilates`` (pairs: (int * int64) list) =
    let d = zInt pairs
    match roundTrip ZSetRx.connectQuery with
    | Some q ->
        match ZSetRx.apply2 q d (ZSet.neg d) with
        | Ok view -> view.IsEmpty
        | Error _ -> false
    | None -> false
