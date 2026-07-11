namespace Zeta.Benchmarks

open System
open System.IO
open BenchmarkDotNet.Attributes
open Zeta.Core
open Zeta.Core.Abstractions

[<MemoryDiagnoser>]
type EncryptedDiskBackingStoreBench() =

    let mutable tempDirPlain = ""
    let mutable tempDirEncrypted = ""
    
    let mutable plainStore : IBackingStore<int> option = None
    let mutable encryptedStore : IBackingStore<int> option = None
    
    let mutable sampleZSet = ZSet.empty

    [<GlobalSetup>]
    member this.Setup() =
        FileSystem.Reset()
        
        tempDirPlain <- Path.Combine(Path.GetTempPath(), "plain-store-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDirPlain |> ignore
        
        tempDirEncrypted <- Path.Combine(Path.GetTempPath(), "encrypted-store-bench-" + Guid.NewGuid().ToString("N"))
        Directory.CreateDirectory tempDirEncrypted |> ignore
        
        let key = Array.zeroCreate<byte> 32
        System.Security.Cryptography.RandomNumberGenerator.Fill key
        let crypto = AesGcmCryptoProvider(key) :> ICryptoProvider
        
        // Quota = 0 forces spill immediately to disk on Save
        plainStore <- Some (DiskBackingStore<int>(tempDirPlain, inMemoryQuotaBytes = 0L) :> IBackingStore<int>)
        encryptedStore <- Some (DiskBackingStore<int>(tempDirEncrypted, inMemoryQuotaBytes = 0L, cryptoProvider = crypto) :> IBackingStore<int>)
        
        sampleZSet <- ZSet.ofKeys [ 1 .. 1000 ]

    [<GlobalCleanup>]
    member this.Cleanup() =
        plainStore <- None
        encryptedStore <- None
        try Directory.Delete(tempDirPlain, true) with _ -> ()
        try Directory.Delete(tempDirEncrypted, true) with _ -> ()

    [<Benchmark(Baseline = true)>]
    member this.PlainStoreSaveAndLoad() =
        let store = plainStore.Value
        let handle = store.Save(0, sampleZSet)
        let loaded = store.Load handle
        store.Release handle
        loaded.Count |> ignore

    [<Benchmark>]
    member this.EncryptedStoreSaveAndLoad() =
        let store = encryptedStore.Value
        let handle = store.Save(0, sampleZSet)
        let loaded = store.Load handle
        store.Release handle
        loaded.Count |> ignore
