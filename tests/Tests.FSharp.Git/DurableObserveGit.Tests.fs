module Zeta.Tests.Git.DurableObserveGitTests

open System
open System.IO
open System.Threading
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.Git
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// The observe controller loop running on the GIT DB: each NextAction is a git commit; crash →
// the World (= Remains) is rebuilt by folding the git event stream. "everything behind the DB."
// ═══════════════════════════════════════════════════════════════════

let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
let private codec () = CborEntryCodec<string>((fun (s: string) -> DynamicValue.String s), (function DynamicValue.String s -> s | o -> failwithf "key not String: %A" o)) :> IEntryCodec<string>
let private item id = { Id = id; Title = id; Ready = true; Ambiguous = false; NeedsNewAction = false }

let mutable private counter = 0
let private withRepoDir (f: string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-git-test", sprintf "observe-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    try f dir
    finally try Directory.Delete(dir, true) with _ -> ()

let private openLog (dir: string) : IDeltaLog<string> =
    let repo = new Repository(dir)
    GitDeltaLog<string>(repo, codec (), now = fixedClock) :> IDeltaLog<string>

[<Fact>]
let ``observe loop runs on git: actions commit, World recovers from git alone`` () =
    withRepoDir (fun dir ->
        let amb = { item "amb" with Ambiguous = true; Ready = false }
        let w0 = { Backlog = [ amb; item "ready" ]; Operator = Some { PendingMessage = true; PendingFerry = false }; Mode = None }
        let actions = [ RespondToOperator "hi"; Decompose amb; DoItem(item "ready"); Explore "onward" ]
        let expected = Algebra.fold w0 actions
        (let log = openLog dir
         let saga = DurableSaga.start log DurableObserve.step w0
         for a in actions do saga.AppendAsync(DurableObserve.event a).Wait()
         Assert.Equal(expected, saga.State))
        // "Crash": rebuild World by folding the git event stream.
        let log2 = openLog dir
        let resumed = DurableSaga<World, string>.ResumeAsync(log2, DurableObserve.step, w0).Result
        Assert.Equal(expected, resumed.State))
