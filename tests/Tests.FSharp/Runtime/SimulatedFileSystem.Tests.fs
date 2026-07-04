module Zeta.Tests.Runtime.SimulatedFileSystemTests

open System
open System.IO
open System.Threading
open System.Threading.Tasks
open Xunit
open Zeta.Core

[<Fact>]
let ``InMemoryFileSystem read, write, move, exists, and delete work correctly`` () =
    let fs = InMemoryFileSystem() :> IFileSystem
    let path = "/test/data.bin"
    let bytes = [| 1uy; 2uy; 3uy; 4uy |]

    // 1. Exists is false initially
    Assert.False(fs.Exists path)

    // 2. Write file
    use stream = fs.OpenWrite(path, false)
    stream.Write(bytes, 0, bytes.Length)
    stream.Close()

    // 3. Exists is true, ReadAllBytes matches
    Assert.True(fs.Exists path)
    let readBytes = fs.ReadAllBytes path
    Assert.Equal<byte>(bytes, readBytes)

    // 4. Move file
    let newPath = "/test/data_new.bin"
    fs.Move(path, newPath, true)
    Assert.False(fs.Exists path)
    Assert.True(fs.Exists newPath)
    Assert.Equal<byte>(bytes, fs.ReadAllBytes newPath)

    // 5. Delete file
    fs.Delete newPath
    Assert.False(fs.Exists newPath)

[<Fact>]
let ``InMemoryFileSystem GetFiles correctly filters by suffix and path`` () =
    let fs = InMemoryFileSystem() :> IFileSystem
    fs.OpenFile("/root/segment1.delta", FileMode.Create, FileAccess.Write, FileShare.None).Close()
    fs.OpenFile("/root/segment2.delta", FileMode.Create, FileAccess.Write, FileShare.None).Close()
    fs.OpenFile("/root/manifest.meta", FileMode.Create, FileAccess.Write, FileShare.None).Close()
    fs.OpenFile("/other/other1.delta", FileMode.Create, FileAccess.Write, FileShare.None).Close()

    let deltaFiles = fs.GetFiles("/root", "*.delta")
    Assert.Equal(2, deltaFiles.Length)
    Assert.Contains("/root/segment1.delta", deltaFiles)
    Assert.Contains("/root/segment2.delta", deltaFiles)
    Assert.DoesNotContain("/root/manifest.meta", deltaFiles)
    Assert.DoesNotContain("/other/other1.delta", deltaFiles)

[<Fact>]
let ``InMemoryFileSystem error injection is deterministic per seed`` () =
    let runSim seed =
        let fs = InMemoryFileSystem()
        let ifs = fs :> IFileSystem
        fs.SetFaults(0.3, 0L, seed) // 30% error rate
        
        let mutable successCount = 0
        let mutable failureCount = 0
        
        for i in 1 .. 50 do
            try
                fs.Files.[sprintf "/file-%d" i] <- [| byte i |]
                let _ = ifs.Exists(sprintf "/file-%d" i)
                successCount <- successCount + 1
            with
            | _ -> failureCount <- failureCount + 1
            
        successCount, failureCount

    let s1, f1 = runSim 42L
    let s2, f2 = runSim 42L
    let s3, f3 = runSim 99L

    // Replay determinism
    Assert.Equal(s1, s2)
    Assert.Equal(f1, f2)
    // Distinct seed produces distinct trace (probabilistically)
    Assert.NotEqual(s1, s3)
    Assert.True(f1 > 0, "Expected some failures to be injected")

[<Fact>]
let ``InMemoryFileSystem delay injection simulates latency`` () =
    let fs = InMemoryFileSystem()
    fs.SetFaults(0.0, 20L, 42L) // 20ms write latency
    
    let path = "/test/delay.bin"
    let sw = System.Diagnostics.Stopwatch.StartNew()
    use stream = (fs :> IFileSystem).OpenWrite(path, false)
    stream.Write([| 42uy |], 0, 1)
    stream.Close()
    sw.Stop()
    
    Assert.True(sw.ElapsedMilliseconds >= 20L, sprintf "Expected >= 20ms write latency, got %dms" sw.ElapsedMilliseconds)

[<Fact>]
let ``DiskSpine store runs successfully under InMemoryFileSystem`` () =
    // Register simulated filesystem globally
    let mockFs = InMemoryFileSystem()
    FileSystem.Register(mockFs)
    
    try
        let key = 1L
        let z = ZSet.ofKeys [ key ]
        
        let rootPath = "/spine_test_root"
        // inMemoryQuotaBytes = 0L forces direct spill to files
        let store = DiskBackingStore<int64>(rootPath, inMemoryQuotaBytes = 0L) :> IBackingStore<int64>
        
        // Save and load batch
        let handle = store.Save(0, z)
        let loaded = store.Load(handle)
        
        let eq = (z = loaded)
        Assert.True(eq)
        
        // Check that files are written in memory only (no real directories created)
        Assert.NotEmpty(mockFs.Files.Keys)
        Assert.False(System.IO.Directory.Exists rootPath)
        
        store.Release handle
        
    finally
        // Ensure registry is cleaned up
        FileSystem.Reset()

[<Fact>]
let ``InMemoryFileSystem swarm stress test scenario`` () =
    let seed = ChaosEnvironment.getSeedFromEnv(12345L)
    
    // Seed 999L is configured as a deterministic failure trigger for Swarm Testing validation
    if seed = 999L then
        failwith "Simulated deterministic swarm stress test failure under seed 999"
        
    let mockFs = InMemoryFileSystem()
    mockFs.SetFaults(0.01, 2L, seed)
    FileSystem.Register(mockFs)
    
    try
        let store = DiskBackingStore<int64>("/swarm_stress_root", inMemoryQuotaBytes = 0L) :> IBackingStore<int64>
        let z = ZSet.ofKeys [ 42L ]
        let h = store.Save(0, z)
        let loaded = store.Load(h)
        Assert.Equal<ZSet<int64>>(z, loaded)
        store.Release h
    finally
        FileSystem.Reset()
