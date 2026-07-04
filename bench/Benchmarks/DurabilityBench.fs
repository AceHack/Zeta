namespace Zeta.Benchmarks

open System
open System.IO
open BenchmarkDotNet.Attributes
open Zeta.Core

[<MemoryDiagnoser>]
type DurabilityBench() =

    let mutable tempDir = ""
    let mutable inMemoryStore = None
    let mutable osBufferedStore = None
    let mutable stableStore = None
    let mutable sampleZSet = ZSet.empty

    [<GlobalSetup>]
    member this.Setup() =
        FileSystem.Reset()
        tempDir <- Path.Combine(Path.GetTempPath(), "durability-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDir |> ignore
        
        let inMem = DurabilityMode.createBackingStore<int64> DurabilityMode.InMemoryOnly "" "" 0L
        let osBuf = DurabilityMode.createBackingStore<int64> DurabilityMode.OsBuffered tempDir "" (1024L * 1024L)
        let stable = DurabilityMode.createBackingStore<int64> DurabilityMode.StableStorage tempDir "" (1024L * 1024L)
        
        inMemoryStore <- Some inMem
        osBufferedStore <- Some osBuf
        stableStore <- Some stable
        
        sampleZSet <- 
            seq {
                for i in 1L..100L do
                    yield (i, int64 i)
            }
            |> ZSet.ofSeq

    [<GlobalCleanup>]
    member this.Cleanup() =
        inMemoryStore <- None
        osBufferedStore <- None
        stableStore <- None
        try Directory.Delete(tempDir, true) with _ -> ()

    [<Benchmark(Baseline = true)>]
    member this.InMemoryOnly() =
        inMemoryStore.Value.Save(0, sampleZSet)

    [<Benchmark>]
    member this.OsBuffered() =
        osBufferedStore.Value.Save(0, sampleZSet)

    [<Benchmark>]
    member this.StableStorage() =
        stableStore.Value.Save(0, sampleZSet)
