module Zeta.Tests.Git.GitRecoverableSpineTests

open System
open System.IO
open System.Threading
open FsUnit.Xunit
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.FSharp.Git


// ═══════════════════════════════════════════════════════════════════
// End-to-end: RecoverableSpine over the GIT-NATIVE log + snapshot store.
// This is "the DB running end-to-end with git as its persistence layer":
// commit input deltas → auto-snapshot+GC at cadence → crash (drop the
// in-memory spine) → RecoverAsync from git → consolidated state is exact.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
// Snapshot store still rides the ZSet IDeltaCodec; the delta LOG now rides the canonical whole-entry codec.
let private codec () = CheckpointDeltaCodec<int>() :> IDeltaCodec<int>
let private entryCodec () =
    CborEntryCodec<int>((fun (i: int) -> DynamicValue.Int(int64 i)), (function DynamicValue.Int v -> int v | o -> failwithf "key not Int: %A" o)) :> IEntryCodec<int>

let mutable private counter = 0

let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "spine-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

// Each "process lifetime" gets its own Repository handle over the same on-disk repo.
let private openBackends (dir: string) : IDeltaLog<int> * ISnapshotStore<int> =
    let repo = new Repository(dir)
    GitDeltaLog<int>(repo, entryCodec (), now = fixedClock) :> IDeltaLog<int>,
    GitSnapshotStore<int>(repo, codec (), now = fixedClock) :> ISnapshotStore<int>


[<Fact>]
let ``commit then recover from git rebuilds the exact consolidated state`` () =
    withRepoDir (fun dir ->
        (let log, snap = openBackends dir
         let spine = RecoverableSpine.create log snap
         spine.CommitAsync(ZSet.ofSeq [ 1, 1L ], cancellationToken = ct).Wait()
         spine.CommitAsync(ZSet.ofSeq [ 2, 3L ], cancellationToken = ct).Wait()
         spine.CommitAsync(ZSet.ofSeq [ 1, -1L ], cancellationToken = ct).Wait())  // retract key 1
        // "Crash": discard the spine; recover from the git repo alone.
        let log2, snap2 = openBackends dir
        let recovered = RecoverableSpine<int>.RecoverAsync(log2, snap2).Result
        recovered.Consolidate() |> should equal (ZSet.ofSeq [ 2, 3L ])
        recovered.AppliedSeq |> should equal 3L)


[<Fact>]
let ``auto-snapshot + GC, then recover from snapshot + surviving tail`` () =
    withRepoDir (fun dir ->
        (let log, snap = openBackends dir
         let spine = RecoverableSpine.create log snap
         spine.AutoSnapshotEvery <- 2   // snapshot + GC every 2 commits
         for i in 1..5 do
             spine.CommitAsync(ZSet.ofSeq [ i, 1L ], cancellationToken = ct).Wait()
         // After 5 commits with cadence 2: snapshots at seq 2 and 4; log GC'd through 4.
         spine.Consolidate() |> should equal (ZSet.ofSeq [ 1, 1L; 2, 1L; 3, 1L; 4, 1L; 5, 1L ]))
        // Recover: snapshot(seq4) ∪ tail(seq5).
        let log2, snap2 = openBackends dir
        let recovered = RecoverableSpine<int>.RecoverAsync(log2, snap2).Result
        recovered.AppliedSeq |> should equal 5L
        recovered.Consolidate()
        |> should equal (ZSet.ofSeq [ 1, 1L; 2, 1L; 3, 1L; 4, 1L; 5, 1L ]))


[<Fact>]
let ``recovery on an empty repo yields empty state`` () =
    withRepoDir (fun dir ->
        let log, snap = openBackends dir
        let recovered = RecoverableSpine<int>.RecoverAsync(log, snap).Result
        ZSet.isEmpty (recovered.Consolidate()) |> should equal true
        recovered.AppliedSeq |> should equal 0L)
