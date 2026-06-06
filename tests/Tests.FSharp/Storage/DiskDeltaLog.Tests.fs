module Zeta.Tests.Storage.DiskDeltaLogTests

open System.IO
open System.Threading
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support


// ═══════════════════════════════════════════════════════════════════
// DiskDeltaLog — file-per-entry durable log on the IDeltaCodec seam.
// Proves real on-disk persistence + recovery across a FRESH instance.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private empty : Map<string, string> = Map.empty
let private keyEnc (i: int) : DynamicValue = DynamicValue.Int(int64 i)
let private keyDec (dv: DynamicValue) : int =
    match dv with DynamicValue.Int w -> int w | o -> failwithf "keyDec: %A" o

let private withDir name (f: string -> unit) =
    let dir = DeterministicTestPath.nextDir name
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()


[<Fact>]
let ``append + replay round-trips deltas and captured through disk`` () =
    withDir "ddl-roundtrip" (fun dir ->
        let log = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
        log.AppendAsync(ZSet.ofKeys [ 1; 2 ], empty, ct).AsTask().Wait()
        log.AppendAsync(ZSet.ofKeys [ 3 ], Map.ofList [ "clock", "99" ], ct).AsTask().Wait()
        let entries = log.ReplayAsync(0L, ct).AsTask().Result
        entries |> Array.map (fun e -> e.Seq) |> should equal [| 1L; 2L |]
        entries.[0].Delta |> should equal (ZSet.ofKeys [ 1; 2 ])
        entries.[1].Captured |> should equal (Map.ofList [ "clock", "99" ]))


[<Fact>]
let ``truncate deletes entry files; replay returns the tail; HighWater holds`` () =
    withDir "ddl-truncate" (fun dir ->
        let log = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
        for i in 1 .. 5 do log.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask().Wait()
        log.TruncateAsync(3L, ct).AsTask().Wait()
        log.ReplayAsync(0L, ct).AsTask().Result
        |> Array.map (fun e -> e.Seq) |> should equal [| 4L; 5L |]
        log.HighWater |> should equal 5L)


[<Fact>]
let ``a FRESH instance recovers high-water + entries from disk`` () =
    withDir "ddl-reopen" (fun dir ->
        // First instance writes 3 entries, then "process exits".
        (let log1 = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
         for i in 1 .. 3 do log1.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask().Wait())
        // Fresh instance over the same dir: continues the sequence, sees history.
        let log2 = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
        log2.HighWater |> should equal 3L
        log2.ReplayAsync(0L, ct).AsTask().Result.Length |> should equal 3
        let s4 = log2.AppendAsync(ZSet.ofKeys [ 4 ], empty, ct).AsTask().Result
        s4 |> should equal 4L)


[<Fact>]
let ``disk log works through the canonical CBOR codec`` () =
    withDir "ddl-cbor" (fun dir ->
        let log = DiskDeltaLog<int>(dir, CborDeltaCodec<int>(keyEnc, keyDec)) :> IDeltaLog<int>
        log.AppendAsync(ZSet.ofSeq [ 1, 1L; 2, -3L ], empty, ct).AsTask().Wait()
        let e = (log.ReplayAsync(0L, ct).AsTask().Result).[0]
        e.Delta |> should equal (ZSet.ofSeq [ 1, 1L; 2, -3L ]))


[<Fact>]
let ``fsync-per-append round-trips`` () =
    withDir "ddl-fsync" (fun dir ->
        let log = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>(), fsyncPerAppend = true) :> IDeltaLog<int>
        log.AppendAsync(ZSet.ofKeys [ 7; 8 ], empty, ct).AsTask().Wait()
        (log.ReplayAsync(0L, ct).AsTask().Result).[0].Delta |> should equal (ZSet.ofKeys [ 7; 8 ]))


[<Fact>]
let ``end-to-end: RecoverableSpine recovers from the disk log across a fresh instance`` () =
    withDir "ddl-spine" (fun dir ->
        let store = InMemorySnapshotStore<int>() :> ISnapshotStore<int>
        // Live spine on a durable disk log.
        let live =
            let log1 = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
            let s = RecoverableSpine.create log1 store
            for i in 1 .. 6 do s.CommitAsync(ZSet.ofKeys [ i ]).Wait()
            s.CommitAsync(ZSet.neg (ZSet.ofKeys [ 3 ])).Wait()   // retract 3
            s
        // "Restart": fresh log over the same dir, recover by full replay (no snapshot).
        let log2 = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
        let recovered = RecoverableSpine<int>.RecoverAsync(log2, store).Result
        recovered.Consolidate() |> should equal (live.Consolidate())
        recovered.AppliedSeq |> should equal 7L
        (recovered.Consolidate()).[3] |> should equal 0L)        // retraction survived the round-trip


[<Fact>]
let ``end-to-end: snapshot+tail recovery survives a restart via the manifest`` () =
    withDir "ddl-snap-log" (fun logDir ->
        withDir "ddl-snap-store" (fun snapDir ->
            let mkLog () = DiskDeltaLog<int>(logDir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
            let mkSnap () = DiskSnapshotStore<int>(snapDir, CheckpointDeltaCodec<int>()) :> ISnapshotStore<int>
            // Live: commit, snapshot (manifest → seq 5), commit more.
            let live =
                let s = RecoverableSpine.create (mkLog ()) (mkSnap ())
                for i in 1 .. 5 do s.CommitAsync(ZSet.ofKeys [ i ]).Wait()
                s.SnapshotAsync().Wait()
                for i in 6 .. 8 do s.CommitAsync(ZSet.ofKeys [ i ]).Wait()
                s
            // Restart: FRESH log + snapshot store over the same dirs; recover via the
            // manifest alone (no externally-held pointer) — snapshot(1..5) + tail(6..8).
            let recovered = RecoverableSpine<int>.RecoverAsync(mkLog (), mkSnap ()).Result
            recovered.Consolidate() |> should equal (live.Consolidate())
            recovered.AppliedSeq |> should equal 8L))


[<Fact>]
let ``orphan .tmp from a crashed append is ignored on recovery`` () =
    withDir "ddl-orphan" (fun dir ->
        (let log = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
         log.AppendAsync(ZSet.ofKeys [ 1 ], empty, ct).AsTask().Wait()
         log.AppendAsync(ZSet.ofKeys [ 2 ], empty, ct).AsTask().Wait())
        // Simulate a crash mid-append: a leftover, torn .delta.tmp.
        File.WriteAllText(Path.Combine(dir, "00000000000000000003.delta.tmp"), "torn-garbage")
        // Fresh instance: orphan ignored, history intact, sequence continues at 3.
        let log2 = DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
        log2.HighWater |> should equal 2L
        log2.ReplayAsync(0L, ct).AsTask().Result.Length |> should equal 2
        log2.AppendAsync(ZSet.ofKeys [ 3 ], empty, ct).AsTask().Result |> should equal 3L)


[<Fact>]
let ``recovery invariant holds over a long deterministic add/retract sequence`` () =
    withDir "ddl-invariant" (fun dir ->
        let snap = InMemorySnapshotStore<int>() :> ISnapshotStore<int>
        // 200 deterministic ops: ~1/3 are retractions, keys cycle through 0..16.
        let live =
            let s = RecoverableSpine.create (DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>) snap
            for i in 1 .. 200 do
                let key = i % 17
                let z = if i % 3 = 0 then ZSet.neg (ZSet.ofKeys [ key ]) else ZSet.ofKeys [ key ]
                s.CommitAsync(z).Wait()
            s
        // Recover from a FRESH disk log (full replay): recovered == live, exactly.
        let recovered =
            RecoverableSpine<int>.RecoverAsync(
                DiskDeltaLog<int>(dir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>, snap).Result
        recovered.Consolidate() |> should equal (live.Consolidate())
        recovered.AppliedSeq |> should equal 200L)
