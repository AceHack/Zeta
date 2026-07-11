namespace Zeta.Benchmarks

open System
open System.IO
open System.Collections.Generic
open BenchmarkDotNet.Attributes
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.FSharp.Git

[<MemoryDiagnoser>]
type PersistenceFormatsBench() =

    let mutable tempDirDisk = ""
    let mutable tempDirGit = ""
    
    let mutable diskLog : IDeltaLog<int64> option = None
    let mutable gitRepo = None
    let mutable gitLog : IDeltaLog<int64> option = None
    
    let mutable sampleZSet = ZSet.empty
    let emptyMap : Map<string, string> = Map.empty

    [<Params(10, 100)>]
    member val KeyCount = 0 with get, set

    [<GlobalSetup>]
    member this.Setup() =
        FileSystem.Reset()
        
        tempDirDisk <- Path.Combine(Path.GetTempPath(), "disk-format-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDirDisk |> ignore
        
        tempDirGit <- Path.Combine(Path.GetTempPath(), "git-format-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDirGit |> ignore
        Repository.Init(tempDirGit, isBare = true) |> ignore
        
        let codec = CborEntryCodec<int64>((fun (i: int64) -> DynamicValue.Int i), (function DynamicValue.Int v -> v | o -> failwithf "key not Int: %A" o))
        
        diskLog <- Some (DiskDeltaLog<int64>(tempDirDisk, codec) :> IDeltaLog<int64>)
        
        let repo = new Repository(tempDirGit)
        gitRepo <- Some repo
        gitLog <- Some (GitDeltaLog<int64>(repo, codec) :> IDeltaLog<int64>)
        
        sampleZSet <- 
            seq {
                for i in 1L..(int64 this.KeyCount) do
                    yield (i, 1L)
            }
            |> ZSet.ofSeq

    [<GlobalCleanup>]
    member this.Cleanup() =
        diskLog <- None
        gitLog <- None
        match gitRepo with
        | Some repo -> repo.Dispose()
        | None -> ()
        gitRepo <- None
        try Directory.Delete(tempDirDisk, true) with _ -> ()
        try Directory.Delete(tempDirGit, true) with _ -> ()

    [<Benchmark(Baseline = true)>]
    member this.DiskDeltaLogAppend() =
        diskLog.Value.AppendAsync(sampleZSet, emptyMap, System.Threading.CancellationToken.None).AsTask().Wait()

    [<Benchmark>]
    member this.GitDeltaLogAppend() =
        gitLog.Value.AppendAsync(sampleZSet, emptyMap, System.Threading.CancellationToken.None).AsTask().Wait()
