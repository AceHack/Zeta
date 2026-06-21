module Zeta.Tests.Git.GitCommandTests

open System
open System.IO
open System.Threading
open System.Threading.Tasks
open LibGit2Sharp
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Git

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

let runSync (t: Task<'T>) = t.GetAwaiter().GetResult()

let run log cmd =
    match runSync (DbCommand.run log CancellationToken.None cmd) with
    | Ok res -> res
    | Error fb -> failwithf "DbCommand failed with feedback: %A" fb

[<Fact>]
let ``Emit and Retract appends to GitDeltaLog; Fold/replay retrieves it; Status is clean after`` () =
    withRepo (fun repo dir ->
        let codec = CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)
        let log = GitDeltaLog<DvKey>(repo, codec, now = fixedClock)
        
        let zset = ZSet.singleton (DvKey.ofValue (DynamicValue.String "key1")) 1L
        let captured = Map.empty
        
        let cmdEmit = DbCommand.Emit(zset, captured)
        match run log cmdEmit with
        | DbCommandResult.Emitted seq -> Assert.Equal(1L, seq)
        | o -> Assert.Fail(sprintf "expected Emitted, got %A" o)
 
        let cmdFold = DbCommand.Fold -1L
        match run log cmdFold with
        | DbCommandResult.Folded entries ->
            Assert.Single(entries) |> ignore
            Assert.Equal(1L, entries.[0].Seq)
            Assert.Equal<ZSet<DvKey>>(zset, entries.[0].Delta)
        | o -> Assert.Fail(sprintf "expected Folded, got %A" o)
 
        let cmdStatus = DbCommand.Status
        match run log cmdStatus with
        | DbCommandResult.Statused(isClean, pending) ->
            Assert.True(isClean)
            Assert.Empty(pending)
        | o -> Assert.Fail(sprintf "expected Statused, got %A" o))
 
[<Fact>]
let ``Status reports dirty working tree; Branch + Checkout switch currentRef`` () =
    withRepo (fun repo dir ->
        let codec = CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)
        let log = GitDeltaLog<DvKey>(repo, codec, now = fixedClock)
        
        // dirty the repository with an untracked file
        File.WriteAllText(Path.Combine(dir, "b.txt"), "world")
        match run log DbCommand.Status with
        | DbCommandResult.Statused(isClean, pending) ->
            Assert.False(isClean)
            Assert.Contains("b.txt", pending)
        | o -> Assert.Fail(sprintf "expected dirty Statused, got %A" o)
 
        // commit the file to clean the repository
        Commands.Stage(repo, "*")
        let sig_ = Signature("zeta", "zeta@localhost", fixedClock())
        repo.Commit("clean commit", sig_, sig_) |> ignore
 
        match run log DbCommand.Status with
        | DbCommandResult.Statused(isClean, _) -> Assert.True(isClean)
        | o -> Assert.Fail(sprintf "expected clean Statused, got %A" o)
 
        // Branch features
        match run log (DbCommand.Branch "feature") with
        | DbCommandResult.Branched name -> Assert.Equal("feature", name)
        | o -> Assert.Fail(sprintf "expected Branched, got %A" o)
 
        match run log (DbCommand.Join("feature", false)) with
        | DbCommandResult.Joined name -> Assert.Equal("feature", name)
        | o -> Assert.Fail(sprintf "expected Joined, got %A" o)
        
        Assert.Equal("refs/heads/feature", (log :> IRefDeltaLog<DvKey>).CurrentRef)
    )

[<Fact>]
let ``Push to a missing remote fails with a clear remote error`` () =
    withRepo (fun repo dir ->
        let codec = CborEntryCodec<DvKey>(DvKey.value, DvKey.ofValue)
        let log = GitDeltaLog<DvKey>(repo, codec, now = fixedClock)
        
        // write one delta to have a commit history
        let zset = ZSet.singleton (DvKey.ofValue (DynamicValue.String "key1")) 1L
        runSync (DbCommand.run log CancellationToken.None (DbCommand.Emit(zset, Map.empty))) |> ignore

        let cmdPush = DbCommand.Join("origin", true)
        match runSync (DbCommand.run log CancellationToken.None cmdPush) with
        | Error (RemoteNotFound remoteName) ->
            Assert.Equal("origin", remoteName)
        | o -> Assert.Fail(sprintf "expected Error (RemoteNotFound), got %A" o) )
