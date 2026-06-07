module Zeta.Tests.Git.GitCommandTests

open System
open System.IO
open System.Threading
open LibGit2Sharp
open global.Xunit
open Zeta.Core.Git

// Git-ref command verbs (roadmap #1, no-git-CLI) — branch/checkout/commit/log/status over a real working
// repo via LibGit2Sharp. The CLI + MCP thin-wrap GitCommand.run; these tests drive it directly.

let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
let mutable private counter = 0

let private withRepo (f: Repository -> string -> unit) =
    let id = Interlocked.Increment(&counter)
    let dir = Path.Combine(Path.GetTempPath(), "zeta-gitcmd-test", sprintf "gc-%04d" id)
    if Directory.Exists dir then Directory.Delete(dir, true)
    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = false) |> ignore
    use repo = new Repository(dir)
    try f repo dir
    finally
        repo.Dispose()
        try Directory.Delete(dir, true) with _ -> ()

[<Fact>]
let ``Commit stages+commits; Log returns it; Status is clean after`` () =
    withRepo (fun repo dir ->
        File.WriteAllText(Path.Combine(dir, "a.txt"), "hello")
        match GitCommand.run repo fixedClock (GitCommand.Commit "first") with
        | Committed sha -> Assert.False(String.IsNullOrEmpty sha)
        | o -> Assert.Fail(sprintf "expected Committed, got %A" o)

        match GitCommand.run repo fixedClock (GitCommand.Log 10) with
        | Logged entries ->
            Assert.Single(entries) |> ignore
            Assert.Equal("first", snd entries.[0])
        | o -> Assert.Fail(sprintf "expected Logged, got %A" o)

        match GitCommand.run repo fixedClock GitCommand.Status with
        | Statused(isClean, pending) ->
            Assert.True(isClean)
            Assert.Empty(pending)
        | o -> Assert.Fail(sprintf "expected Statused, got %A" o))

[<Fact>]
let ``Status reports pending changes; Branch + Checkout switch the working tree`` () =
    withRepo (fun repo dir ->
        File.WriteAllText(Path.Combine(dir, "a.txt"), "hello")
        GitCommand.run repo fixedClock (GitCommand.Commit "first") |> ignore

        // an untracked file makes the tree dirty
        File.WriteAllText(Path.Combine(dir, "b.txt"), "world")
        match GitCommand.run repo fixedClock GitCommand.Status with
        | Statused(isClean, pending) ->
            Assert.False(isClean)
            Assert.Contains("b.txt", pending)
        | o -> Assert.Fail(sprintf "expected dirty Statused, got %A" o)

        match GitCommand.run repo fixedClock (GitCommand.Branch "feature") with
        | Branched name -> Assert.Equal("feature", name)
        | o -> Assert.Fail(sprintf "expected Branched, got %A" o)

        match GitCommand.run repo fixedClock (GitCommand.Checkout "feature") with
        | CheckedOut name -> Assert.Equal("feature", name)
        | o -> Assert.Fail(sprintf "expected CheckedOut, got %A" o))
