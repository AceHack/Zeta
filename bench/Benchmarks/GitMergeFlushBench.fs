namespace Zeta.Benchmarks

open System
open System.IO
open BenchmarkDotNet.Attributes
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.FSharp.Git

[<MemoryDiagnoser>]
type GitMergeFlushBench() =

    let mutable tempDir = ""
    let mutable gitRepo = None
    let mutable gitLog : IRefDeltaLog<int64> option = None
    
    let codec = CborEntryCodec<int64>((fun (i: int64) -> DynamicValue.Int i), (function DynamicValue.Int v -> v | o -> failwithf "key not Int: %A" o))
    let emptyMap : Map<string, string> = Map.empty
    let ct = System.Threading.CancellationToken.None
    let sampleZSet = ZSet.ofSeq [ (1L, 1L) ]

    [<GlobalSetup>]
    member this.Setup() =
        FileSystem.Reset()
        tempDir <- Path.Combine(Path.GetTempPath(), "git-merge-flush-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDir |> ignore
        Repository.Init(tempDir, isBare = false) |> ignore
        
        let repo = new Repository(tempDir)
        gitRepo <- Some repo
        let log : IRefDeltaLog<int64> = upcast GitDeltaLog<int64>(repo, codec)
        gitLog <- Some log
        
        // Setup main ref
        log.Checkout("refs/heads/main") |> ignore
        log.AppendAsync(sampleZSet, emptyMap, ct).AsTask().Wait()

    [<GlobalCleanup>]
    member this.Cleanup() =
        gitLog <- None
        match gitRepo with
        | Some repo -> repo.Dispose()
        | None -> ()
        gitRepo <- None
        try Directory.Delete(tempDir, true) with _ -> ()

    [<Benchmark>]
    member this.BranchCommitAndMergeFlush() =
        let log = gitLog.Value
        // Create dev branch from current main tip
        log.Branch("dev") |> ignore
        log.Checkout("refs/heads/dev") |> ignore
        
        // Write a commit to dev
        log.AppendAsync(sampleZSet, emptyMap, ct).AsTask().Wait()
        
        // Checkout main and merge dev (flush)
        log.Checkout("refs/heads/main") |> ignore
        log.Merge("refs/heads/dev") |> ignore
