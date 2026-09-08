namespace Zeta.Benchmarks

open System
open System.IO
open System.Threading
open System.Threading.Tasks
open BenchmarkDotNet.Attributes
open Zeta.Core
open Zeta.Core.FSharp.Blake3

/// ZD4 product-existence harness. Same N=16 small-write storm on host
/// `GroupCommitDiskDeltaLog` and on `.zetafs` FreezeLog (PhysicalFileSystem).
/// N=16 because BlockCas's one-superblock index cannot hold 32 unique
/// 1-byte jumpropes. Not FUSE. Not POSIX. Numbers stay toy until a named
/// run is recorded. Do not copy them into README or claim ZetaFS is faster.
[<MemoryDiagnoser>]
type Zd4ProductExistenceBench() =

    let storm = 16
    let ct = CancellationToken.None
    let empty: Map<string, string> = Map.empty
    let keyEnc (i: int) : DynamicValue = DynamicValue.Int(int64 i)

    let keyDec (dv: DynamicValue) : int =
        match dv with
        | DynamicValue.Int w -> int w
        | o -> failwithf "keyDec: %A" o

    let mintId (seed: int64) =
        let e = Environment.createVirtual seed :> Zeta.Core.ISimulationEnvironment
        let entropy = ZetaFsNamespace.Entropy(fun () -> e.NextInt64())
        let ns = ZetaFsNamespace.create entropy
        let id, _ = ZetaFsNamespace.mint ns ZetaFsNamespace.EntityKind.File entropy
        id

    [<GlobalSetup>]
    member _.Setup() =
        FileSystem.Reset()

        System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(
            typeof<OwnBlake3Hasher>.TypeHandle
        )

    [<Benchmark(Baseline = true)>]
    member _.HostGroupCommitStorm() =
        let dir =
            Path.Combine(Path.GetTempPath(), "zd4-host-" + Guid.NewGuid().ToString("N"))

        Directory.CreateDirectory dir |> ignore

        try
            use log = new GroupCommitDiskDeltaLog<int>(dir, CborEntryCodec<int>(keyEnc, keyDec))
            let dlog = log :> IDeltaLog<int>

            let tasks =
                [| for i in 1..storm -> dlog.AppendAsync(ZSet.ofKeys [ i ], empty, ct).AsTask() |]

            System.Threading.Tasks.Task.WaitAll(
                tasks |> Array.map (fun t -> t :> System.Threading.Tasks.Task)
            )
            dlog.ReplayAsync(0L, ct).AsTask().Result.Length |> ignore
        finally
            try
                Directory.Delete(dir, true)
            with _ ->
                ()

    [<Benchmark>]
    member _.ZetaFsFreezeStorm() =
        let store =
            Path.Combine(Path.GetTempPath(), "zd4-zetafs-" + Guid.NewGuid().ToString("N"))

        Directory.CreateDirectory store |> ignore

        try
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
                        (ZetaFsFreeze.freezeAsync volume id ZetaFsFreeze.Journaled ct).AsTask()
                    )

                ZetaFsFreeze.pumpLog volume ct |> fun t -> t.GetAwaiter().GetResult()

                for t in pending do
                    match t.Result with
                    | Error e -> failwith (ZetaFsFreeze.errorName e)
                    | Ok _ -> ()
            finally
                ZetaFsFreeze.dispose volume
        finally
            try
                Directory.Delete(store, true)
            with _ ->
                ()
