namespace Zeta.Benchmarks

open System
open System.IO
open BenchmarkDotNet.Attributes
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.FSharp.Git

[<MemoryDiagnoser>]
type GitSnapshotBench() =

    let mutable tempDirDisk = ""
    let mutable tempDirGit = ""
    
    let mutable diskStore : ISnapshotStore<int64> option = None
    let mutable gitRepo = None
    let mutable gitStore : ISnapshotStore<int64> option = None
    
    let mutable sampleZSet = ZSet.empty
    let codec = CheckpointDeltaCodec<int64>()
    let ct = System.Threading.CancellationToken.None

    [<GlobalSetup>]
    member this.Setup() =
        FileSystem.Reset()
        
        tempDirDisk <- Path.Combine(Path.GetTempPath(), "disk-snapshot-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDirDisk |> ignore
        
        tempDirGit <- Path.Combine(Path.GetTempPath(), "git-snapshot-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDirGit |> ignore
        Repository.Init(tempDirGit, isBare = true) |> ignore
        
        diskStore <- Some (DiskSnapshotStore<int64>(tempDirDisk, codec) :> ISnapshotStore<int64>)
        
        let repo = new Repository(tempDirGit)
        gitRepo <- Some repo
        gitStore <- Some (GitSnapshotStore<int64>(repo, codec) :> ISnapshotStore<int64>)
        
        sampleZSet <- 
            seq {
                for i in 1L..100L do
                    yield (i, 1L)
            }
            |> ZSet.ofSeq

    [<GlobalCleanup>]
    member this.Cleanup() =
        diskStore <- None
        gitStore <- None
        match gitRepo with
        | Some repo -> repo.Dispose()
        | None -> ()
        gitRepo <- None
        try Directory.Delete(tempDirDisk, true) with _ -> ()
        try Directory.Delete(tempDirGit, true) with _ -> ()

    [<Benchmark(Baseline = true)>]
    member this.DiskSnapshotWrite() =
        diskStore.Value.WriteAsync(1L, sampleZSet, ct).Wait()

    [<Benchmark>]
    member this.GitSnapshotWrite() =
        gitStore.Value.WriteAsync(1L, sampleZSet, ct).Wait()
