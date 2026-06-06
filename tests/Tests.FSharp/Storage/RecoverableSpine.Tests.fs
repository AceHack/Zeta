module Zeta.Tests.Storage.RecoverableSpineTests

open System.Threading
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// RecoverableSpine — delta-log + snapshot + restore→replay recovery.
// Increment 2. The DST property: recovered state == live state, with or
// without a snapshot, including retractions across the snapshot boundary.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private fresh () =
    let log = InMemoryDeltaLog<int>() :> IDeltaLog<int>
    let store = InMemoryAsyncBackingStore<int>() :> IAsyncBackingStore<int>
    log, store


[<Fact>]
let ``CommitAsync folds deltas and tracks applied sequence`` () =
    let log, store = fresh ()
    let spine = RecoverableSpine.create log store
    spine.CommitAsync(ZSet.ofKeys [ 1; 2 ]).Wait()
    spine.CommitAsync(ZSet.ofKeys [ 3 ]).Wait()
    spine.AppliedSeq |> should equal 2L
    spine.Consolidate() |> should equal (ZSet.ofKeys [ 1; 2; 3 ])


[<Fact>]
let ``recover with NO snapshot replays the whole log`` () =
    let log, store = fresh ()
    let live = RecoverableSpine.create log store
    for i in 1 .. 6 do live.CommitAsync(ZSet.ofKeys [ i ]).Wait()
    // Crash: fresh spine, no snapshot — replay everything.
    let recovered = RecoverableSpine<int>.RecoverAsync(log, store).Result
    recovered.Consolidate() |> should equal (live.Consolidate())
    recovered.AppliedSeq |> should equal 6L


[<Fact>]
let ``recover from a snapshot + tail equals live state (DST crash recovery)`` () =
    let log, store = fresh ()
    let live = RecoverableSpine.create log store
    for i in 1 .. 5 do live.CommitAsync(ZSet.ofKeys [ i ]).Wait()
    let pointer = live.SnapshotAsync().Result      // snapshot covers seq 5
    for i in 6 .. 9 do live.CommitAsync(ZSet.ofKeys [ i ]).Wait()
    // Crash: rebuild from (log, store, pointer) — restore snapshot, replay tail 6..9.
    let recovered = RecoverableSpine<int>.RecoverAsync(log, store, pointer).Result
    recovered.Consolidate() |> should equal (live.Consolidate())
    recovered.AppliedSeq |> should equal 9L


[<Fact>]
let ``retraction across the snapshot boundary recovers correctly`` () =
    let log, store = fresh ()
    let live = RecoverableSpine.create log store
    live.CommitAsync(ZSet.ofKeys [ 1; 2; 3 ]).Wait()
    live.CommitAsync(ZSet.neg (ZSet.ofKeys [ 2 ])).Wait()   // retract 2 BEFORE snapshot
    let pointer = live.SnapshotAsync().Result
    live.CommitAsync(ZSet.ofKeys [ 4 ]).Wait()
    live.CommitAsync(ZSet.neg (ZSet.ofKeys [ 1 ])).Wait()   // retract 1 AFTER snapshot
    let recovered = RecoverableSpine<int>.RecoverAsync(log, store, pointer).Result
    recovered.Consolidate() |> should equal (live.Consolidate())
    // net: 1 retracted, 2 retracted, 3 and 4 present.
    let r = recovered.Consolidate()
    r.[1] |> should equal 0L
    r.[2] |> should equal 0L
    r.[3] |> should equal 1L
    r.[4] |> should equal 1L


[<Fact>]
let ``snapshot-then-recover with no further commits is identity`` () =
    let log, store = fresh ()
    let live = RecoverableSpine.create log store
    for i in 1 .. 4 do live.CommitAsync(ZSet.ofKeys [ i ]).Wait()
    let pointer = live.SnapshotAsync().Result
    let recovered = RecoverableSpine<int>.RecoverAsync(log, store, pointer).Result
    recovered.Consolidate() |> should equal (live.Consolidate())
    recovered.AppliedSeq |> should equal 4L
