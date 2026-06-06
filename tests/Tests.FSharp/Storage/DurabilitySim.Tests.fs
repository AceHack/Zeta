module Zeta.Tests.Storage.DurabilitySimTests

open System.IO
open System.Threading
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support


// ═══════════════════════════════════════════════════════════════════
// Deterministic simulation crash harness for the durability subsystem
// (FoundationDB / Will Wilson principle: enumerate crash points
// deterministically; recovery MUST reconstruct the exact committed state
// at EVERY point). This is the §7-DST lock-down of the recovery invariant.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``DST: recovery invariant holds at EVERY crash point (deterministic enumeration)`` () =
    let ct = CancellationToken.None
    // Deterministic op script: adds + retractions interleaved over keys 0..4.
    let ops : ZSet<int> list =
        [ for i in 1 .. 12 ->
            let key = i % 5
            if i % 4 = 0 then ZSet.neg (ZSet.ofKeys [ key ]) else ZSet.ofKeys [ key ] ]

    // Invariant: for EVERY crash point k, recovering from durable state reconstructs
    // exactly fold(ops[0..k-1]) and AppliedSeq = k — across snapshot+GC boundaries.
    for k in 0 .. ops.Length do
        let logDir = DeterministicTestPath.nextDir (sprintf "dst-log-%d" k)
        let snapDir = DeterministicTestPath.nextDir (sprintf "dst-snap-%d" k)
        try
            let mkLog () = DiskDeltaLog<int>(logDir, CheckpointDeltaCodec<int>()) :> IDeltaLog<int>
            let mkSnap () = DiskSnapshotStore<int>(snapDir, CheckpointDeltaCodec<int>()) :> ISnapshotStore<int>
            let expected =
                ops |> List.truncate k |> List.fold (fun acc z -> ZSet.add acc z) ZSet<int>.Empty
            // Run live up to the crash point, with cadence so snapshot + log-GC are
            // exercised before the crash (recovery must cross those boundaries).
            (let s = RecoverableSpine.create (mkLog ()) (mkSnap ())
             s.AutoSnapshotEvery <- 5
             for z in List.truncate k ops do s.CommitAsync(z).Wait())
            // "Crash": abandon the in-mem spine; recover from disk via manifest + tail.
            let recovered = RecoverableSpine<int>.RecoverAsync(mkLog (), mkSnap ()).Result
            recovered.Consolidate()
            |> should equal expected
            recovered.AppliedSeq |> should equal (int64 k)
        finally
            (try Directory.Delete(logDir, true) with _ -> ())
            (try Directory.Delete(snapDir, true) with _ -> ())
