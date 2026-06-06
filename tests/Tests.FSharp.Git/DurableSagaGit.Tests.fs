module Zeta.Tests.Git.DurableSagaGitTests

open System
open System.IO
open System.Threading
open FsUnit.Xunit
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.Git


// ═══════════════════════════════════════════════════════════════════
// DurableSaga (the evolution engine, vision §5c) running on the
// GIT-NATIVE delta log — zero new production code: GitDeltaLog<'E> IS an
// IDeltaLog<'E>, so the saga's events ride git commits. Proves signed-weight
// apply(+1)/compensate(-1) and crash→ResumeAsync from git alone.
//
// Saga model: a running balance. step state event weight = state + weight*event.
// So AppendAsync amount = deposit (+1); RetractAsync amount = compensating
// withdrawal (-1) — the Z-set retraction IS the saga compensation.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
let private codec () = CheckpointDeltaCodec<int>() :> IDeltaCodec<int>

let private step (state: int64) (event: int) (weight: int64) : int64 =
    state + weight * int64 event

let mutable private counter = 0

let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "saga-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

let private openLog (dir: string) : IDeltaLog<int> =
    let repo = new Repository(dir)
    GitDeltaLog<int>(repo, codec (), now = fixedClock) :> IDeltaLog<int>


[<Fact>]
let ``saga applies + compensates through git, then resumes to the same state`` () =
    withRepoDir (fun dir ->
        (let log = openLog dir
         let saga = DurableSaga.start log step 0L
         saga.AppendAsync(100).Wait()    // +100
         saga.AppendAsync(50).Wait()     // +150
         saga.RetractAsync(30).Wait()    // compensate -30 -> 120
         saga.State |> should equal 120L
         saga.AppliedSeq |> should equal 3L)
        // "Crash": discard the saga; resume from the git log alone.
        let log2 = openLog dir
        let resumed = DurableSaga<int64, int>.ResumeAsync(log2, step, 0L).Result
        resumed.State |> should equal 120L
        resumed.AppliedSeq |> should equal 3L)


[<Fact>]
let ``a fully-compensated saga resumes to the initial state`` () =
    withRepoDir (fun dir ->
        (let log = openLog dir
         let saga = DurableSaga.start log step 0L
         saga.AppendAsync(42).Wait()
         saga.RetractAsync(42).Wait()    // exact compensation -> 0
         saga.State |> should equal 0L)
        let log2 = openLog dir
        let resumed = DurableSaga<int64, int>.ResumeAsync(log2, step, 0L).Result
        resumed.State |> should equal 0L
        resumed.AppliedSeq |> should equal 2L)
