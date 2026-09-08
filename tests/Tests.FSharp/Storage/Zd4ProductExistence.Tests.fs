[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.Storage.Zd4ProductExistenceTests

open System
open System.IO
open System.Threading
open System.Threading.Tasks
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3
open Zeta.Tests.Support

// ZD4 product-existence (ZetaDB D4). Same small-write storm on both legs,
// on PhysicalFileSystem (host APFS/ext4), not InMemory and not FUSE. Host:
// GroupCommitDiskDeltaLog. `.zetafs`: FreezeLog via createManual + pumpLog
// (ZD2). Completing both legs is the falsifier. No Stopwatch. No winner.
// Numbers stay toy.
//
// N=32 matches the GroupCommit one-segment floor in DiskDeltaLog.Tests.
// Compact BlockCas hex keys (081M1ZCE8W0087G0R0028BYWV2) hold the 96
// jumprope objects a 32-freeze 1-byte storm puts.

let private storm = 32
let private ct = CancellationToken.None
let private empty: Map<string, string> = Map.empty

let private keyEnc (i: int) : DynamicValue = DynamicValue.Int(int64 i)

let private keyDec (dv: DynamicValue) : int =
    match dv with
    | DynamicValue.Int w -> int w
    | o -> failwithf "keyDec: %A" o

let private ensureHasher () =
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof<OwnBlake3Hasher>.TypeHandle)

let private mintId (seed: int64) =
    let e = Environment.createVirtual seed :> Zeta.Core.ISimulationEnvironment
    let entropy = ZetaFsNamespace.Entropy(fun () -> e.NextInt64())
    let ns = ZetaFsNamespace.create entropy
    let id, _ = ZetaFsNamespace.mint ns ZetaFsNamespace.EntityKind.File entropy
    id

let private withDir name (f: string -> Task) : Task =
    let dir = DeterministicTestPath.nextDir name

    task {
        try
            do! f dir
        finally
            try
                Directory.Delete(dir, true)
            with _ ->
                ()
    }

[<Fact>]
let ``ZD4 both legs complete the same host-FS small-write storm`` () : Task =
    task {
        FileSystem.Reset()
        ensureHasher ()

        try
            do!
                withDir "zd4-host" (fun hostDir ->
                    task {
                        use log =
                            new GroupCommitDiskDeltaLog<int>(hostDir, CborEntryCodec<int>(keyEnc, keyDec))

                        let dlog = log :> IDeltaLog<int>

                        let tasks =
                            [| for i in 1..storm -> dlog.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask() |]

                        System.Threading.Tasks.Task.WaitAll(
                            tasks |> Array.map (fun t -> t :> System.Threading.Tasks.Task)
                        )

                        Assert.Equal(0, Directory.GetFiles(hostDir, "*.delta").Length)

                        let segment =
                            Directory.GetFiles(hostDir, "delta-*.segment") |> Array.exactlyOne

                        Assert.Equal("delta-00000000000000000001.segment", Path.GetFileName segment)
                        Assert.True(FileInfo(segment).Length > 0L)
                        let! entries = dlog.ReplayAsync(0L, ct).AsTask()
                        Assert.Equal(storm, entries.Length)
                    })

            do!
                withDir "zd4-zetafs" (fun store ->
                    task {
                        let volume =
                            ZetaFsFreeze.createManual
                                store
                                (ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared)
                                None

                        try
                            let pending =
                                ResizeArray<Task<Result<ZetaFsFreeze.FreezeResult, ZetaFsFreeze.FreezeError>>>(
                                    storm
                                )

                            for i in 1..storm do
                                let id = mintId (17L + int64 i)
                                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| byte i |] |> ignore

                                pending.Add(
                                    (ZetaFsFreeze.freezeAsync volume id ZetaFsFreeze.Journaled ct)
                                        .AsTask()
                                )

                            Assert.Equal(0, ZetaFsFreeze.logBoatCount volume)
                            do! (ZetaFsFreeze.pumpLog volume ct).ConfigureAwait(false)
                            Assert.Equal(1, ZetaFsFreeze.logBoatCount volume)
                            Assert.Equal(storm, ZetaFsFreeze.logLastBoatSize volume)

                            for t in pending do
                                let! r = t.ConfigureAwait(false)

                                match r with
                                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                                | Ok ok -> Assert.True(ZetaFsFreeze.isReadable volume ok.Content)

                            let layoutDir = Path.Combine(store, "layout")
                            Assert.False(
                                Directory.Exists layoutDir,
                                "1-byte freeze storm must not persist layout files"
                            )
                        finally
                            ZetaFsFreeze.dispose volume
                    })
        finally
            FileSystem.Reset()
    }

[<Fact>]
let ``ZD4 freeze-storm thread alloc stays under 48 MiB`` () : Task =
    // D10 peels: FastCDC skip + persist-once (081M1ZHZ7EW087G0R00006H4BK);
    // catalog gen in memory (081M1ZMGJ0J087G0R001W8HX2V). Named ShortRun
    // allocated ~94 MiB vs ~351 KiB host. 48 MiB ceiling. Still unmetered.
    task {
        FileSystem.Reset()
        ensureHasher ()

        try
            do!
                withDir "zd4-alloc" (fun store ->
                    task {
                        let volume =
                            ZetaFsFreeze.createManual
                                store
                                (ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared)
                                None

                        try
                            let pending =
                                ResizeArray<Task<Result<ZetaFsFreeze.FreezeResult, ZetaFsFreeze.FreezeError>>>(
                                    storm
                                )

                            // Current-thread alloc. Awaiting ConfigureAwait(false)
                            // hops; ubuntu-24.04 then subtracted this thread's
                            // `before` from another thread's lifetime (~57e9).
                            // Wait/Result keep before and after on one thread.
                            let before = GC.GetAllocatedBytesForCurrentThread()

                            for i in 1..storm do
                                let id = mintId (17L + int64 i)
                                let h = ZetaFsMutbuf.openHandle volume.Mutbuf id
                                ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| byte i |] |> ignore

                                pending.Add(
                                    (ZetaFsFreeze.freezeAsync volume id ZetaFsFreeze.Journaled ct)
                                        .AsTask()
                                )

                            ZetaFsFreeze.pumpLog volume ct |> fun t -> t.Wait(ct)

                            for t in pending do
                                match t.Result with
                                | Error e -> Assert.Fail(ZetaFsFreeze.errorName e)
                                | Ok _ -> ()

                            let n = GC.GetAllocatedBytesForCurrentThread() - before
                            Assert.True(
                                n >= 0L && n < 48L * 1024L * 1024L,
                                sprintf "freeze storm allocated %d bytes" n
                            )
                        finally
                            ZetaFsFreeze.dispose volume
                    })
        finally
            FileSystem.Reset()
    }
