[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
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
let ``InMemoryFileSystem delay injection is virtual time not wall clock`` () =
    let fs = InMemoryFileSystem()
    fs.SetFaults(0.0, 250L, 42L)

    let path = "/test/delay.bin"
    let sw = System.Diagnostics.Stopwatch.StartNew()
    use stream = (fs :> IFileSystem).OpenWrite(path, false)
    stream.Write([| 42uy |], 0, 1)
    stream.Close()
    sw.Stop()

    Assert.True(
        fs.VirtualElapsedMs >= 250L,
        sprintf "Expected >= 250 virtual ms, got %d" fs.VirtualElapsedMs
    )
    Assert.True(
        sw.ElapsedMilliseconds < 80L,
        sprintf "wall clock must not sleep the injected latency, got %dms" sw.ElapsedMilliseconds
    )

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

[<Fact>]
let ``InMemoryFileSystem Flush publishes without firing crash-mid-write`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    fs.ArmCrashMidWrite("/flushed", 8)
    let payload = Array.init 100 (fun i -> byte i)
    let stream = ifs.OpenWrite("/flushed", false)
    stream.Write(payload, 0, payload.Length)
    stream.Flush()
    Assert.True(ifs.Exists "/flushed")
    Assert.Equal(100, ifs.ReadAllBytes("/flushed").Length)
    Assert.Equal<byte>(payload, ifs.ReadAllBytes("/flushed"))
    let ex = Assert.Throws<CrashMidWriteException>(fun () -> stream.Dispose())
    Assert.Equal(8, ex.CommittedBytes)
    Assert.Equal(8, ifs.ReadAllBytes("/flushed").Length)
    Assert.Equal<byte>(Array.sub payload 0 8, ifs.ReadAllBytes("/flushed"))

[<Fact>]
let ``InMemoryFileSystem crash-mid-write commits a prefix then throws`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    fs.ArmCrashMidWrite("/torn", 8)
    let payload = Array.init 100 (fun i -> byte i)
    let stream = ifs.OpenWrite("/torn", false)
    stream.Write(payload, 0, payload.Length)
    let ex = Assert.Throws<CrashMidWriteException>(fun () -> stream.Dispose())
    Assert.Equal("/torn", ex.Path)
    Assert.Equal(8, ex.CommittedBytes)
    Assert.Equal(100, ex.AttemptedBytes)
    Assert.Equal<byte>(Array.sub payload 0 8, ifs.ReadAllBytes("/torn"))

[<Fact>]
let ``InMemoryFileSystem crash-mid-write is one-shot and the same arm replays`` () =
    let run () =
        let fs = InMemoryFileSystem()
        let ifs = fs :> IFileSystem
        fs.ArmCrashMidWrite("/torn", 8)
        let payload = Array.init 100 (fun i -> byte (i + 3))
        let stream = ifs.OpenWrite("/torn", false)
        stream.Write(payload, 0, payload.Length)
        Assert.Throws<CrashMidWriteException>(fun () -> stream.Dispose()) |> ignore
        let torn = ifs.ReadAllBytes("/torn")
        let stream2 = ifs.OpenWrite("/torn-full", false)
        stream2.Write(payload, 0, payload.Length)
        stream2.Dispose()
        torn, ifs.ReadAllBytes("/torn-full")

    let tornA, fullA = run ()
    let tornB, fullB = run ()
    Assert.Equal(8, tornA.Length)
    Assert.Equal<byte>(tornA, tornB)
    Assert.Equal(100, fullA.Length)
    Assert.Equal<byte>(fullA, fullB)

[<Fact>]
let ``InMemoryFileSystem corrupt-last-write flips a suffix and still acks`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    fs.ArmCorruptLastWrite("/corrupt", 8)
    let payload = Array.init 100 (fun i -> byte i)
    let stream = ifs.OpenWrite("/corrupt", false)
    stream.Write(payload, 0, payload.Length)
    stream.Dispose()
    let got = ifs.ReadAllBytes("/corrupt")
    Assert.Equal(100, got.Length)
    Assert.Equal(payload.[0], got.[0])
    Assert.Equal(payload.[91], got.[91])
    Assert.Equal(payload.[92] ^^^ 0xA5uy, got.[92])
    Assert.Equal(payload.[99] ^^^ 0xA5uy, got.[99])

[<Fact>]
let ``InMemoryFileSystem corrupt-last-write is one-shot and the same arm replays`` () =
    let run () =
        let fs = InMemoryFileSystem()
        let ifs = fs :> IFileSystem
        fs.ArmCorruptLastWrite("/corrupt", 8)
        let payload = Array.init 100 (fun i -> byte (i + 3))
        let stream = ifs.OpenWrite("/corrupt", false)
        stream.Write(payload, 0, payload.Length)
        stream.Dispose()
        let flipped = ifs.ReadAllBytes("/corrupt")
        let stream2 = ifs.OpenWrite("/corrupt-full", false)
        stream2.Write(payload, 0, payload.Length)
        stream2.Dispose()
        flipped, ifs.ReadAllBytes("/corrupt-full")

    let a, fullA = run ()
    let b, fullB = run ()
    Assert.Equal<byte>(a, b)
    Assert.Equal<byte>(fullA, fullB)
    Assert.Equal(fullA.[99], byte (99 + 3))
    Assert.Equal(a.[99], byte (99 + 3) ^^^ 0xA5uy)

[<Fact>]
let ``InMemoryFileSystem reorder holds the first write until the second commits`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    fs.ArmReorderNextTwo("/pair")
    let aBytes = [| 1uy; 2uy |]
    let bBytes = [| 3uy; 4uy |]
    let streamA = ifs.OpenWrite("/pair/a", false)
    streamA.Write(aBytes, 0, aBytes.Length)
    streamA.Dispose()
    Assert.False(ifs.Exists "/pair/a")
    Assert.Equal(0, fs.CommitOrder.Length)
    let streamB = ifs.OpenWrite("/pair/b", false)
    streamB.Write(bBytes, 0, bBytes.Length)
    streamB.Dispose()
    Assert.True(ifs.Exists "/pair/a")
    Assert.True(ifs.Exists "/pair/b")
    Assert.Equal<byte>(aBytes, ifs.ReadAllBytes "/pair/a")
    Assert.Equal<byte>(bBytes, ifs.ReadAllBytes "/pair/b")
    Assert.Equal<string>([| "/pair/b"; "/pair/a" |], fs.CommitOrder)

[<Fact>]
let ``InMemoryFileSystem reorder is one-shot and the same arm replays`` () =
    let run () =
        let fs = InMemoryFileSystem()
        let ifs = fs :> IFileSystem
        fs.ArmReorderNextTwo("/pair")
        let sa = ifs.OpenWrite("/pair/a", false)
        sa.Write([| 1uy |], 0, 1)
        sa.Dispose()
        let sb = ifs.OpenWrite("/pair/b", false)
        sb.Write([| 2uy |], 0, 1)
        sb.Dispose()
        let sc = ifs.OpenWrite("/pair/c", false)
        sc.Write([| 3uy |], 0, 1)
        sc.Dispose()
        fs.CommitOrder

    let expected = [| "/pair/b"; "/pair/a"; "/pair/c" |]
    Assert.Equal<string>(expected, run ())
    Assert.Equal<string>(expected, run ())

[<Fact>]
let ``FileSystemBlockIo reads back a block written through IFileSystem`` () =
    let mock = InMemoryFileSystem() :> IFileSystem
    let io = FileSystemBlockIo(mock, "/vol/blocks", 4096) :> IBlockIo
    Assert.Equal(4096, io.BlockSize)
    let payload = [| 1uy; 2uy; 3uy; 4uy |]
    Assert.Equal(4, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    io.Flush()
    let dst = Array.zeroCreate<byte> 4
    Assert.Equal(4, io.Read(0UL, System.Memory<byte>.op_Implicit dst))
    Assert.Equal<byte>(payload, dst)

[<Fact>]
let ``FileSystemBlockIo constructor publishes a missing zero-length backing file`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    let path = "/vol/empty-blocks"
    FileSystemBlockIo(ifs, path, 4096) |> ignore
    Assert.True(ifs.Exists path)
    Assert.Empty(ifs.ReadAllBytes path)

[<Fact>]
let ``FileSystemBlockIo constructor publishes before a reorder-arm dispose can hide the backing file`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    let path = "/vol/reordered-empty-blocks"
    fs.ArmReorderNextTwo path
    FileSystemBlockIo(ifs, path, 4096) |> ignore
    Assert.True(ifs.Exists path)
    Assert.Empty(ifs.ReadAllBytes path)

[<Fact>]
let ``FileSystemBlockIo constructor preserves an existing backing file`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    let path = "/vol/existing-blocks"
    let initial = [| 5uy; 8uy; 13uy |]
    ifs.WriteAt(path, 0L, System.ReadOnlyMemory<byte>.op_Implicit initial) |> ignore
    FileSystemBlockIo(ifs, path, 4096) |> ignore
    Assert.Equal<byte>(initial, ifs.ReadAllBytes path)

[<Fact>]
let ``FileSystemBlockIo LbaCount is empty then spans a hole after a high LBA write`` () =
    let mock = InMemoryFileSystem()
    let path = "/vol/lba-count"
    let io = FileSystemBlockIo(mock, path, 4096) :> IBlockIo
    Assert.Equal(0UL, io.LbaCount)
    let block = Array.create 4096 1uy
    Assert.Equal(4096, io.Write(2UL, System.ReadOnlyMemory<byte>.op_Implicit block))
    Assert.Equal(3UL, io.LbaCount)

[<Fact>]
let ``SimulatedBlockIo async door completes synchronously and round-trips`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IAsyncBlockIo
    let payload = [| 1uy; 2uy; 3uy |]
    let write = io.WriteAsync(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload, CancellationToken.None)
    Assert.True(write.IsCompletedSuccessfully)
    Assert.Equal(3, write.Result)
    let dst = Array.zeroCreate<byte> 3
    let read = io.ReadAsync(0UL, System.Memory<byte>.op_Implicit dst, CancellationToken.None)
    Assert.True(read.IsCompletedSuccessfully)
    Assert.Equal(3, read.Result)
    Assert.Equal<byte>(payload, dst)
    let flush = io.FlushAsync CancellationToken.None
    Assert.True(flush.IsCompletedSuccessfully)

[<Fact>]
let ``SimulatedBlockIo default write is durable without Flush`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    let payload = [| 9uy; 8uy; 7uy |]
    Assert.Equal(3, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    let cloned = device.CloneMedia() :> IBlockIo
    let dst = Array.zeroCreate<byte> 3
    Assert.Equal(3, cloned.Read(0UL, System.Memory<byte>.op_Implicit dst))
    Assert.Equal<byte>(payload, dst)

[<Fact>]
let ``SimulatedBlockIo power outage on Flush drops unflushed writes`` () =
    let device = SimulatedBlockIo(4096, volatileUntilFlush = true)
    let io = device :> IBlockIo
    let payload = [| 9uy; 8uy; 7uy |]
    Assert.Equal(3, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    device.ArmPowerOutageOnFlush()
    Assert.Throws<PowerOutageException>(fun () -> io.Flush()) |> ignore
    let empty = [| 0uy; 0uy; 0uy |]
    let lost = Array.zeroCreate<byte> 3
    Assert.Equal(3, io.Read(0UL, System.Memory<byte>.op_Implicit lost))
    Assert.Equal<byte>(empty, lost)
    let cloned = device.CloneMedia() :> IBlockIo
    let remain = Array.zeroCreate<byte> 3
    Assert.Equal(3, cloned.Read(0UL, System.Memory<byte>.op_Implicit remain))
    Assert.Equal<byte>(empty, remain)

[<Fact>]
let ``SimulatedBlockIo bad memory XOR publishes garbage then dies`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    let payload = [| 9uy; 8uy; 7uy |]
    device.ArmBadMemoryOnWrite()
    Assert.Throws<BadMemoryException>(fun () -> io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload) |> ignore)
    |> ignore
    let expected = [| payload.[0]; payload.[1]; payload.[2] ^^^ 0xA5uy |]
    let poisoned = Array.zeroCreate<byte> 3
    Assert.Equal(3, io.Read(0UL, System.Memory<byte>.op_Implicit poisoned))
    Assert.Equal<byte>(expected, poisoned)
    let cloned = device.CloneMedia() :> IBlockIo
    let remain = Array.zeroCreate<byte> 3
    Assert.Equal(3, cloned.Read(0UL, System.Memory<byte>.op_Implicit remain))
    Assert.Equal<byte>(expected, remain)

[<Fact>]
let ``SimulatedBlockIo volatileUntilFlush write is visible then lost on CloneMedia until Flush`` () =
    let device = SimulatedBlockIo(4096, volatileUntilFlush = true)
    let io = device :> IBlockIo
    let payload = [| 9uy; 8uy; 7uy |]
    Assert.Equal(3, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    let seen = Array.zeroCreate<byte> 3
    Assert.Equal(3, io.Read(0UL, System.Memory<byte>.op_Implicit seen))
    Assert.Equal<byte>(payload, seen)
    let crashed = device.CloneMedia() :> IBlockIo
    let lost = Array.zeroCreate<byte> 3
    Assert.Equal(3, crashed.Read(0UL, System.Memory<byte>.op_Implicit lost))
    Assert.Equal(0uy, lost.[0])
    Assert.Equal(0uy, lost.[1])
    Assert.Equal(0uy, lost.[2])
    io.Flush()
    let durable = device.CloneMedia() :> IBlockIo
    let kept = Array.zeroCreate<byte> 3
    Assert.Equal(3, durable.Read(0UL, System.Memory<byte>.op_Implicit kept))
    Assert.Equal<byte>(payload, kept)

[<Fact>]
let ``SimulatedBlockIo volatileUntilFlush FlushAsync persists for CloneMedia`` () =
    let device = SimulatedBlockIo(4096, volatileUntilFlush = true)
    let io = device :> IAsyncBlockIo
    let payload = [| 4uy; 5uy; 6uy |]
    let write =
        io.WriteAsync(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload, CancellationToken.None)

    Assert.True(write.IsCompletedSuccessfully)
    let flush = io.FlushAsync CancellationToken.None
    Assert.True(flush.IsCompletedSuccessfully)
    let durable = device.CloneMedia() :> IBlockIo
    let kept = Array.zeroCreate<byte> 3
    Assert.Equal(3, durable.Read(0UL, System.Memory<byte>.op_Implicit kept))
    Assert.Equal<byte>(payload, kept)

[<Fact>]
let ``SimulatedBlockIo records completed Write then Flush in call order`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    let payload = [| 9uy; 8uy; 7uy |]
    Assert.Equal(3, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    io.Flush()
    let ops = device.RecordedOps
    Assert.Equal(2, ops.Length)

    match Array.get ops 0 with
    | BlockIoOp.Write(lba, data) ->
        Assert.Equal(0UL, lba)
        Assert.Equal<byte>(payload, data)
    | BlockIoOp.Flush -> Assert.Fail("first recorded op must be Write")

    match Array.get ops 1 with
    | BlockIoOp.Flush -> ()
    | BlockIoOp.Write _ -> Assert.Fail("second recorded op must be Flush")

[<Fact>]
let ``SimulatedBlockIo CloneMedia is remain: RecordedOps acts are not copied`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    let payload = [| 1uy; 2uy; 3uy |]
    Assert.Equal(3, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    io.Flush()
    Assert.True(device.RecordedOps.Length > 0)
    let cloned = device.CloneMedia()
    Assert.Equal(0, cloned.RecordedOps.Length)
    let got = Array.zeroCreate<byte> 3
    Assert.Equal(3, (cloned :> IBlockIo).Read(0UL, System.Memory<byte>.op_Implicit got))
    Assert.Equal<byte>(payload, got)

[<Fact>]
let ``SimulatedBlockIo ReplayTo round-trips issued writes onto a fresh device`` () =
    let source = SimulatedBlockIo(4096)
    let io = source :> IBlockIo
    let payload = [| 4uy; 5uy; 6uy |]
    Assert.Equal(3, io.Write(1UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    io.Flush()
    let targetDevice = SimulatedBlockIo(4096)
    let target = targetDevice :> IBlockIo
    source.ReplayTo target
    let got = Array.zeroCreate<byte> 3
    Assert.Equal(3, target.Read(1UL, System.Memory<byte>.op_Implicit got))
    Assert.Equal<byte>(payload, got)

[<Fact>]
let ``SimulatedBlockIo ReplayTo round-trips issued writes onto FileSystemBlockIo`` () =
    let source = SimulatedBlockIo(4096)
    let io = source :> IBlockIo
    let payload = [| 4uy; 5uy; 6uy |]
    Assert.Equal(3, io.Write(1UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    io.Flush()
    let fs = InMemoryFileSystem()
    let path = "/vol/replay-polyfill"
    let target = FileSystemBlockIo(fs, path, 4096) :> IBlockIo
    source.ReplayTo target
    let got = Array.zeroCreate<byte> 3
    Assert.Equal(3, target.Read(1UL, System.Memory<byte>.op_Implicit got))
    Assert.Equal<byte>(payload, got)

[<Fact>]
let ``SimulatedBlockIo crash-mid-write is not recorded as a completed op`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    device.ArmCrashMidWrite(8)
    let payload = Array.init 100 (fun i -> byte i)
    Assert.Throws<CrashMidWriteException>(fun () ->
        io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload) |> ignore)
    |> ignore
    Assert.Equal(0, device.RecordedOps.Length)
    io.Flush()
    let ops = device.RecordedOps
    Assert.Equal(1, ops.Length)

    match Array.get ops 0 with
    | BlockIoOp.Flush -> ()
    | BlockIoOp.Write _ -> Assert.Fail("crash-mid-write must not appear as Write")

[<Fact>]
let ``FileSystemBlockIo async door cancel-before-write does not publish`` () =
    let mock = InMemoryFileSystem()
    let path = "/vol/async-cancel"
    let io = FileSystemBlockIo(mock, path, 4096) :> IAsyncBlockIo
    use cts = new CancellationTokenSource()
    cts.Cancel()
    let payload = Array.create 4096 7uy
    let write = io.WriteAsync(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload, cts.Token)
    Assert.True(write.IsCanceled)
    Assert.Equal(0UL, (FileSystemBlockIo(mock, path, 4096) :> IBlockIo).LbaCount)

[<Fact>]
let ``SimulatedBlockIo LbaCount is unbounded sparse DST`` () =
    let io = SimulatedBlockIo(4096) :> IBlockIo
    Assert.Equal(0UL, io.LbaCount)
    let payload = [| 1uy; 2uy |]
    Assert.Equal(2, io.Write(99UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    Assert.Equal(0UL, io.LbaCount)

[<Fact>]
let ``SimulatedBlockIo bounded RAM namespace rejects LBAs at and past LbaCount`` () =
    let device = SimulatedBlockIo(4096, lbaCount = 4UL)
    let io = device :> IBlockIo
    Assert.Equal(4UL, io.LbaCount)
    let block = Array.create 4096 1uy
    Assert.Equal(4096, io.Write(3UL, System.ReadOnlyMemory<byte>.op_Implicit block))
    Assert.Throws<IOException>(fun () ->
        io.Write(4UL, System.ReadOnlyMemory<byte>.op_Implicit block) |> ignore)
    |> ignore
    Assert.Throws<IOException>(fun () ->
        io.Read(4UL, System.Memory<byte>.op_Implicit (Array.zeroCreate 4096)) |> ignore)
    |> ignore
    let cloned = device.CloneMedia() :> IBlockIo
    Assert.Equal(4UL, cloned.LbaCount)
    Assert.Throws<IOException>(fun () ->
        cloned.Write(4UL, System.ReadOnlyMemory<byte>.op_Implicit block) |> ignore)
    |> ignore

[<Fact>]
let ``SimulatedBlockIo CloneMedia keeps RAM bound and drops unflushed volatile writes`` () =
    let device = SimulatedBlockIo(4096, lbaCount = 4UL, volatileUntilFlush = true)
    let io = device :> IBlockIo
    Assert.Equal(4UL, io.LbaCount)
    let payload = [| 9uy; 8uy; 7uy |]
    Assert.Equal(3, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    let crashed = device.CloneMedia() :> IBlockIo
    Assert.Equal(4UL, crashed.LbaCount)
    let lost = Array.zeroCreate<byte> 3
    Assert.Equal(3, crashed.Read(0UL, System.Memory<byte>.op_Implicit lost))
    Assert.Equal(0uy, lost.[0])
    Assert.Throws<IOException>(fun () ->
        crashed.Write(4UL, System.ReadOnlyMemory<byte>.op_Implicit (Array.create 4096 1uy))
        |> ignore)
    |> ignore
    io.Flush()
    let durable = device.CloneMedia() :> IBlockIo
    Assert.Equal(4UL, durable.LbaCount)
    let kept = Array.zeroCreate<byte> 3
    Assert.Equal(3, durable.Read(0UL, System.Memory<byte>.op_Implicit kept))
    Assert.Equal<byte>(payload, kept)

[<Fact>]
let ``FileSystemBlockIo rejects an invalid block size before creating the backing file`` () =
    let fs = InMemoryFileSystem()
    let ifs = fs :> IFileSystem
    let path = "/vol/invalid-block-size"
    Assert.Throws<ArgumentException>(fun () -> FileSystemBlockIo(ifs, path, 3) |> ignore) |> ignore
    Assert.False(ifs.Exists path)

[<Fact>]
let ``FileSystemBlockIo crash-mid-write tears the LBA and keeps the previous one`` () =
    let mock = InMemoryFileSystem()
    let path = "/vol/lba-crash"
    let io = FileSystemBlockIo(mock, path, 4096) :> IBlockIo
    let first = Array.create 4096 1uy
    let second = Array.create 4096 2uy
    Assert.Equal(4096, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit first))
    mock.ArmCrashMidWrite(path, 8)
    let ex =
        Assert.Throws<CrashMidWriteException>(fun () ->
            io.Write(1UL, System.ReadOnlyMemory<byte>.op_Implicit second)
            |> ignore)

    Assert.Equal(8, ex.CommittedBytes)
    Assert.Equal(4096, ex.AttemptedBytes)
    let got0 = Array.zeroCreate<byte> 4096
    Assert.Equal(4096, io.Read(0UL, System.Memory<byte>.op_Implicit got0))
    Assert.Equal<byte>(first, got0)
    let got1 = Array.zeroCreate<byte> 4096
    Assert.Equal(8, io.Read(1UL, System.Memory<byte>.op_Implicit got1))
    Assert.Equal<byte>(Array.sub second 0 8, Array.sub got1 0 8)

[<Fact>]
let ``FileSystemBlockIo corrupt-last-write flips the new LBA and keeps the previous one`` () =
    let mock = InMemoryFileSystem()
    let path = "/vol/lba-corrupt"
    let io = FileSystemBlockIo(mock, path, 4096) :> IBlockIo
    let first = Array.create 4096 1uy
    let second = Array.init 4096 (fun i -> byte (i % 250))
    Assert.Equal(4096, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit first))
    mock.ArmCorruptLastWrite(path, 8)
    Assert.Equal(4096, io.Write(1UL, System.ReadOnlyMemory<byte>.op_Implicit second))
    let got0 = Array.zeroCreate<byte> 4096
    Assert.Equal(4096, io.Read(0UL, System.Memory<byte>.op_Implicit got0))
    Assert.Equal<byte>(first, got0)
    let got1 = Array.zeroCreate<byte> 4096
    Assert.Equal(4096, io.Read(1UL, System.Memory<byte>.op_Implicit got1))
    Assert.Equal(second.[0], got1.[0])
    Assert.Equal(second.[4087], got1.[4087])
    Assert.Equal(second.[4088] ^^^ 0xA5uy, got1.[4088])
    Assert.Equal(second.[4095] ^^^ 0xA5uy, got1.[4095])

[<Fact>]
let ``FileSystemBlockIo torn-sector keeps the old tail of the LBA and acks`` () =
    let mock = InMemoryFileSystem()
    let path = "/vol/lba-torn"
    let io = FileSystemBlockIo(mock, path, 4096) :> IBlockIo
    let first = Array.create 4096 1uy
    let second = Array.create 4096 2uy
    Assert.Equal(4096, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit first))
    mock.ArmTornSector(path, 512)
    Assert.Equal(4096, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit second))
    let got = Array.zeroCreate<byte> 4096
    Assert.Equal(4096, io.Read(0UL, System.Memory<byte>.op_Implicit got))
    Assert.Equal<byte>(Array.create 512 2uy, Array.sub got 0 512)
    Assert.Equal<byte>(Array.create 3584 1uy, Array.sub got 512 3584)

[<Fact>]
let ``SimulatedBlockIo reads back a write without IFileSystem`` () =
    let io = SimulatedBlockIo(4096) :> IBlockIo
    Assert.Equal(4096, io.BlockSize)
    let payload = [| 1uy; 2uy; 3uy; 4uy |]
    Assert.Equal(4, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    io.Flush()
    let dst = Array.zeroCreate<byte> 4
    Assert.Equal(4, io.Read(0UL, System.Memory<byte>.op_Implicit dst))
    Assert.Equal<byte>(payload, dst)

[<Fact>]
let ``SimulatedBlockIo crash-mid-write commits a prefix then throws`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    device.ArmCrashMidWrite(8)
    let payload = Array.init 100 (fun i -> byte i)
    let ex =
        Assert.Throws<CrashMidWriteException>(fun () ->
            io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload)
            |> ignore)

    Assert.Equal(8, ex.CommittedBytes)
    Assert.Equal(100, ex.AttemptedBytes)
    Assert.Equal(1, device.Writes)
    let dst = Array.zeroCreate<byte> 100
    Assert.Equal(100, io.Read(0UL, System.Memory<byte>.op_Implicit dst))
    Assert.Equal<byte>(Array.sub payload 0 8, Array.sub dst 0 8)
    Assert.Equal(0uy, dst.[8])
    let whole = Array.init 16 (fun i -> byte (200 + i))
    Assert.Equal(16, io.Write(1UL, System.ReadOnlyMemory<byte>.op_Implicit whole))
    let got = Array.zeroCreate<byte> 16
    Assert.Equal(16, io.Read(1UL, System.Memory<byte>.op_Implicit got))
    Assert.Equal<byte>(whole, got)

[<Fact>]
let ``SimulatedBlockIo corrupt-last-write flips a suffix and still acks`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    device.ArmCorruptLastWrite(8)
    let payload = Array.init 100 (fun i -> byte i)
    Assert.Equal(100, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit payload))
    let got = Array.zeroCreate<byte> 100
    Assert.Equal(100, io.Read(0UL, System.Memory<byte>.op_Implicit got))
    Assert.Equal(payload.[0], got.[0])
    Assert.Equal(payload.[91], got.[91])
    Assert.Equal(payload.[92] ^^^ 0xA5uy, got.[92])
    Assert.Equal(payload.[99] ^^^ 0xA5uy, got.[99])

[<Fact>]
let ``SimulatedBlockIo reorder holds the first write until the second commits`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    device.ArmReorderNextTwo()
    let a = [| 1uy; 2uy |]
    let b = [| 3uy; 4uy |]
    Assert.Equal(2, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit a))
    let unseen = Array.zeroCreate<byte> 2
    Assert.Equal(2, io.Read(0UL, System.Memory<byte>.op_Implicit unseen))
    Assert.Equal(0uy, unseen.[0])
    Assert.Equal(0uy, unseen.[1])
    Assert.Equal(2, io.Write(1UL, System.ReadOnlyMemory<byte>.op_Implicit b))
    let gotA = Array.zeroCreate<byte> 2
    let gotB = Array.zeroCreate<byte> 2
    Assert.Equal(2, io.Read(0UL, System.Memory<byte>.op_Implicit gotA))
    Assert.Equal(2, io.Read(1UL, System.Memory<byte>.op_Implicit gotB))
    Assert.Equal<byte>(a, gotA)
    Assert.Equal<byte>(b, gotB)
    Assert.Equal<uint64>([| 1UL; 0UL |], device.CommitOrder)

[<Fact>]
let ``SimulatedBlockIo torn-sector keeps the old tail of the LBA and acks`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    let first = Array.create 4096 1uy
    let second = Array.create 4096 2uy
    Assert.Equal(4096, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit first))
    device.ArmTornSector(512)
    Assert.Equal(4096, io.Write(0UL, System.ReadOnlyMemory<byte>.op_Implicit second))
    let got = Array.zeroCreate<byte> 4096
    Assert.Equal(4096, io.Read(0UL, System.Memory<byte>.op_Implicit got))
    Assert.Equal<byte>(Array.create 512 2uy, Array.sub got 0 512)
    Assert.Equal<byte>(Array.create 3584 1uy, Array.sub got 512 3584)

[<Fact>]
let ``BlockCas Put of an existing key does not rewrite bits`` () =
    let device = SimulatedBlockIo(4096)
    let cas = BlockCas(device)
    cas.Put("aa", [| 1uy; 2uy; 3uy |])
    let writesAfterFirstPut = device.Writes
    // The first Put must have driven at least the payload append and the
    // superblock publish, so the count is strictly positive. Asserting this
    // keeps the idempotency claim below riding on a check that can fail
    // rather than a vacuous self-comparison.
    Assert.True(writesAfterFirstPut > 0, "first Put must issue block writes")
    Assert.Equal(1, cas.Count)
    cas.Put("aa", [| 1uy; 2uy; 3uy |])
    Assert.Equal(1, cas.Count)
    // The idempotent re-Put of an identical key must add exactly zero writes.
    Assert.Equal(0, device.Writes - writesAfterFirstPut)

[<Fact>]
let ``BlockCas Put does not re-read superblock slots`` () =
    let device = SimulatedBlockIo(4096)
    let cas = BlockCas(device)
    cas.Put("aa", [| 1uy |])
    let readsAfterFirst = device.Reads
    cas.Put("bb", [| 2uy |])
    // Payload RMW of a 1-byte append may Read the data LBA once.
    // Must not parseCas both superblock slots (LBA 0 and 1).
    let delta = device.Reads - readsAfterFirst
    Assert.True(delta <= 1, sprintf "second Put read %d times" delta)

[<Fact>]
let ``BlockCas XorLastPayloadByteAll flips the last published byte`` () =
    let device = SimulatedBlockIo(4096)
    let cas = BlockCas(device)
    let payload = [| 1uy; 2uy; 3uy |]
    cas.Put("aa", payload)
    Assert.Equal(1, cas.XorLastPayloadByteAll())
    match cas.TryGet "aa" with
    | None -> Assert.Fail("payload must still be published")
    | Some got ->
        let expected = [| payload.[0]; payload.[1]; payload.[2] ^^^ 0xA5uy |]
        Assert.Equal<byte>(expected, got)

[<Fact>]
let ``BlockCas XorLastPayloadByte flips one key and leaves the other`` () =
    let device = SimulatedBlockIo(4096)
    let cas = BlockCas(device)
    let a = [| 1uy; 2uy; 3uy |]
    let b = [| 9uy; 8uy; 7uy |]
    cas.Put("aa", a)
    cas.Put("bb", b)
    Assert.False(cas.XorLastPayloadByte "missing")
    Assert.True(cas.XorLastPayloadByte "aa")
    match cas.TryGet "aa", cas.TryGet "bb" with
    | Some gotA, Some gotB ->
        let expectedA = [| a.[0]; a.[1]; a.[2] ^^^ 0xA5uy |]
        Assert.Equal<byte>(expectedA, gotA)
        Assert.Equal<byte>(b, gotB)
    | _ -> Assert.Fail("both keys must stay published")

[<Fact>]
let ``BlockCas compact hex index holds 96 ContentAddress128 names and reopens`` () =
    // ZD4: 32 unique 1-byte jumpropes put chunk+leaf+trunk (96 names). UTF-8
    // 32-hex keys overflow one 4096-byte ZCA2 superblock; compact 16-byte
    // payloads must fit and round-trip through CloneMedia.
    let device = SimulatedBlockIo(4096)
    let cas = BlockCas(device)
    let n = 96

    for i in 0 .. n - 1 do
        let key = sprintf "%032x" i
        cas.Put(key, [| byte (i % 256) |])

    Assert.Equal(n, cas.Count)

    for i in 0 .. n - 1 do
        let key = sprintf "%032x" i

        match cas.TryGet key with
        | None -> Assert.Fail(sprintf "missing %s" key)
        | Some got -> Assert.Equal(byte (i % 256), got.[0])

    let cloned = BlockCas(device.CloneMedia())
    Assert.Equal(n, cloned.Count)

    match cloned.TryGet (sprintf "%032x" 0), cloned.TryGet (sprintf "%032x" (n - 1)) with
    | Some first, Some last ->
        Assert.Equal(0uy, first.[0])
        Assert.Equal(byte ((n - 1) % 256), last.[0])
    | _ -> Assert.Fail("compact names must survive CloneMedia")

[<Fact>]
let ``BlockCas Delete unpublishes a key and CloneMedia agrees`` () =
    let device = SimulatedBlockIo(4096)
    let cas = BlockCas(device)
    cas.Put("aa", [| 1uy; 2uy; 3uy |])
    Assert.True(cas.Exists "aa")
    Assert.Equal(1, cas.Count)
    Assert.True(cas.Delete "aa")
    Assert.False(cas.Exists "aa")
    Assert.Equal(0, cas.Count)
    Assert.False(cas.Delete "aa")
    let cloned = BlockCas(device.CloneMedia())
    Assert.False(cloned.Exists "aa")
    Assert.Equal(0, cloned.Count)
    cas.Put("aa", [| 9uy |])
    Assert.True(cas.Exists "aa")
    Assert.Equal(1, cas.Count)

[<Fact>]
let ``BlockSuper log dual slot keeps previous logical after crash-mid-write`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    Assert.Equal(8192L, BlockLog.origin io)
    BlockSuper.writeLog io 100L

    match BlockSuper.tryReadLog io with
    | Some n -> Assert.Equal(100L, n)
    | None -> Assert.Fail("expected logical 100")

    device.ArmCrashMidWrite(8)
    let ex =
        Assert.Throws<CrashMidWriteException>(fun () -> BlockSuper.writeLog io 200L)

    Assert.Equal(8, ex.CommittedBytes)
    let cloned = device.CloneMedia() :> IBlockIo

    match BlockSuper.tryReadLog cloned with
    | Some n -> Assert.Equal(100L, n)
    | None -> Assert.Fail("torn new slot must not hide the previous generation")

[<Fact>]
let ``BlockSuper log dual slot keeps previous logical after corrupt-last-write`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    BlockSuper.writeLog io 100L
    device.ArmCorruptLastWrite(8)
    BlockSuper.writeLog io 200L

    match BlockSuper.tryReadLog io with
    | Some n -> Assert.Equal(100L, n)
    | None -> Assert.Fail("corrupt new slot must not hide the previous generation")

[<Fact>]
let ``BlockSuper log crash on the first slot recovers empty`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    device.ArmCrashMidWrite(8)
    Assert.Throws<CrashMidWriteException>(fun () -> BlockSuper.writeLog io 100L)
    |> ignore

    match BlockSuper.tryReadLog io with
    | Some _ -> Assert.Fail("torn first slot must not parse")
    | None -> ()

[<Fact>]
let ``BlockSuper CAS dual slot keeps previous index after crash-mid-write`` () =
    let device = SimulatedBlockIo(4096)
    let io = device :> IBlockIo
    BlockSuper.writeCas io [| "aa", 8192L, 3 |]

    match BlockSuper.tryReadCas io with
    | Some entries ->
        Assert.Equal(1, entries.Length)

        match entries.[0] with
        | key, _, _ -> Assert.Equal("aa", key)
    | None -> Assert.Fail("expected one CAS entry")

    device.ArmCrashMidWrite(8)

    Assert.Throws<CrashMidWriteException>(fun () ->
        BlockSuper.writeCas io [| "aa", 8192L, 3; "bb", 8195L, 1 |])
    |> ignore

    let cloned = device.CloneMedia() :> IBlockIo

    match BlockSuper.tryReadCas cloned with
    | Some entries ->
        Assert.Equal(1, entries.Length)

        match entries.[0] with
        | key, _, _ -> Assert.Equal("aa", key)
    | None -> Assert.Fail("torn new CAS slot must not hide the previous generation")
