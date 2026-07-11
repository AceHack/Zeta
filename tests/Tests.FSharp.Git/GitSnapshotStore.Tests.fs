module Zeta.Tests.Git.GitSnapshotStoreTests

open System
open System.IO
open System.Threading
open FsUnit.Xunit
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.FSharp.Git


// ═══════════════════════════════════════════════════════════════════
// GitSnapshotStore — consolidated folds as blobs on refs/zeta/snapshots,
// with a committed LATEST.json manifest so LatestAsync survives restart.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
let private codec () = CheckpointDeltaCodec<int>() :> IDeltaCodec<int>

let mutable private counter = 0

let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "snap-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

let private openStore (dir: string) : ISnapshotStore<int> =
    let repo = new Repository(dir)
    GitSnapshotStore<int>(repo, codec (), now = fixedClock) :> ISnapshotStore<int>


[<Fact>]
let ``write + read round-trips a snapshot through git`` () =
    withRepoDir (fun dir ->
        let store = openStore dir
        let state = ZSet.ofSeq [ 1, 3L; 2, -1L; 3, 7L ]
        let p = store.WriteAsync(5L, state, ct).Result
        p.Seq |> should equal 5L
        store.ReadAsync(p, ct).Result |> should equal state)


[<Fact>]
let ``LatestAsync returns null before any write`` () =
    withRepoDir (fun dir ->
        let store = openStore dir
        Assert.Null(store.LatestAsync(ct).Result))


[<Fact>]
let ``LatestAsync tracks the most recent snapshot`` () =
    withRepoDir (fun dir ->
        let store = openStore dir
        store.WriteAsync(2L, ZSet.ofKeys [ 1 ], ct).Result |> ignore
        store.WriteAsync(7L, ZSet.ofKeys [ 1; 2 ], ct).Result |> ignore
        let latest = store.LatestAsync(ct).Result
        Assert.NotNull(latest)
        latest.Seq |> should equal 7L)


[<Fact>]
let ``latest snapshot survives a FRESH Repository instance (durable manifest)`` () =
    withRepoDir (fun dir ->
        let state = ZSet.ofSeq [ 42, 9L ]
        (let s1 = openStore dir
         s1.WriteAsync(11L, state, ct).Result |> ignore)
        // Fresh instance over the same git repo — simulates restart.
        let s2 = openStore dir
        let latest = s2.LatestAsync(ct).Result
        Assert.NotNull(latest)
        latest.Seq |> should equal 11L
        s2.ReadAsync(latest, ct).Result |> should equal state)


[<Fact>]
let ``LatestAsync and ReadAsync correctly recover across multiple commits and restarts`` () =
    withRepoDir (fun dir ->
        // Write snapshot 1
        (let s = openStore dir
         let state1 = ZSet.ofSeq [ 1, 10L ]
         s.WriteAsync(1L, state1, ct).Result |> ignore)
         
        // Write snapshot 2
        (let s = openStore dir
         let state2 = ZSet.ofSeq [ 2, 20L ]
         s.WriteAsync(2L, state2, ct).Result |> ignore)
         
        // Write snapshot 3
        (let s = openStore dir
         let state3 = ZSet.ofSeq [ 3, 30L ]
         s.WriteAsync(3L, state3, ct).Result |> ignore)
         
        // Restart (instantiate new store over repo) and verify recovery of the latest (3)
        let sRecovered = openStore dir
        let latest = sRecovered.LatestAsync(ct).Result
        Assert.NotNull(latest)
        latest.Seq |> should equal 3L
        sRecovered.ReadAsync(latest, ct).Result |> should equal (ZSet.ofSeq [ 3, 30L ])
        
        // Ensure we can still write a new snapshot 4 after recovery
        let state4 = ZSet.ofSeq [ 4, 40L ]
        let p4 = sRecovered.WriteAsync(4L, state4, ct).Result
        p4.Seq |> should equal 4L
        sRecovered.ReadAsync(p4, ct).Result |> should equal state4
        
        // Restart once more and verify 4 is recovered
        let sFinal = openStore dir
        let finalLatest = sFinal.LatestAsync(ct).Result
        Assert.NotNull(finalLatest)
        finalLatest.Seq |> should equal 4L
        sFinal.ReadAsync(finalLatest, ct).Result |> should equal state4)

