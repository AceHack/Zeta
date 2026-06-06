module Zeta.Tests.Storage.DeltaLogTests

open System.Threading
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// DeltaLog — append-only log of input Z-set deltas ("persist inputs,
// recompute derived"). Increment 1: in-memory reference + DST replay.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private empty : Map<string, string> = Map.empty


[<Fact>]
let ``AppendAsync assigns monotonic sequence numbers from 1`` () =
    let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
    let s1 = log.AppendAsync(ZSet.ofKeys [ 1 ], empty, ct).AsTask().Result
    let s2 = log.AppendAsync(ZSet.ofKeys [ 2 ], empty, ct).AsTask().Result
    let s3 = log.AppendAsync(ZSet.ofKeys [ 3 ], empty, ct).AsTask().Result
    [ s1; s2; s3 ] |> should equal [ 1L; 2L; 3L ]
    log.HighWater |> should equal 3L


[<Fact>]
let ``ReplayAsync from 0 returns all entries in seq order`` () =
    let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
    let batches = [ ZSet.ofKeys [ 1; 2 ]; ZSet.ofKeys [ 3 ]; ZSet.ofKeys [ 4; 5 ] ]
    for b in batches do log.AppendAsync(b, empty, ct).AsTask().Wait()
    let replayed = log.ReplayAsync(0L, ct).AsTask().Result
    replayed |> Array.map (fun e -> e.Seq) |> should equal [| 1L; 2L; 3L |]
    replayed |> Array.map (fun e -> e.Delta) |> Array.toList |> should equal batches


[<Fact>]
let ``ReplayAsync from a bound returns only the tail`` () =
    let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
    for i in 1 .. 5 do log.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask().Wait()
    let tail = log.ReplayAsync(3L, ct).AsTask().Result
    tail |> Array.map (fun e -> e.Seq) |> should equal [| 4L; 5L |]


[<Fact>]
let ``captured non-determinism round-trips for deterministic replay`` () =
    let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
    let captured = Map.ofList [ "clock", "1717689600"; "seed", "42" ]
    log.AppendAsync(ZSet.ofKeys [ 7 ], captured, ct).AsTask().Wait()
    let e = (log.ReplayAsync(0L, ct).AsTask().Result).[0]
    e.Captured |> should equal captured


[<Fact>]
let ``DST: fold of replayed deltas reconstructs state exactly (incl retraction)`` () =
    // The persist-inputs/recompute-derived property: replaying the logged input
    // deltas through the deterministic fold reproduces the live state bit-for-bit,
    // including a retraction (+1 then -1 nets to 0 — Z-set group law).
    let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
    // Live: apply deltas as they commit, folding into an accumulator.
    let mutable live = ZSet<int>.Empty
    let commit (d: ZSet<int>) =
        log.AppendAsync(d, empty, ct).AsTask().Wait()
        live <- ZSet.add live d
    commit (ZSet.ofKeys [ 1; 2; 3 ])
    commit (ZSet.ofKeys [ 4 ])
    commit (ZSet.neg (ZSet.ofKeys [ 2 ]))   // retract key 2
    // "Crash": drop live state. Recover by folding the replayed log from scratch.
    let recovered =
        log.ReplayAsync(0L, ct).AsTask().Result
        |> Array.fold (fun acc e -> ZSet.add acc e.Delta) ZSet<int>.Empty
    recovered |> should equal live
    // key 2 fully retracted; 1,3,4 present.
    recovered.[2] |> should equal 0L
    recovered.[1] |> should equal 1L
    recovered.[4] |> should equal 1L
