[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.ZetaFsMutbufTests

open System
open System.IO
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

let private rng () =
    let e = Environment.createVirtual 11L :> Zeta.Core.ISimulationEnvironment
    ZetaFsNamespace.Entropy(fun () -> e.NextInt64())

let private mintId () =
    let entropy = rng ()
    let ns = ZetaFsNamespace.create entropy
    let id, _ = ZetaFsNamespace.mint ns ZetaFsNamespace.EntityKind.File entropy
    id

let private tempStore () =
    let path =
        Path.Combine(Path.GetTempPath(), sprintf "zetafs-mutbuf-%s" (Guid.NewGuid().ToString("N")))
    Directory.CreateDirectory path |> ignore
    path

[<Fact>]
let ``pwrite does not change EntityId`` () =
    FileSystem.Register(InMemoryFileSystem())
    try
        let id = mintId ()
        let catalog = ZetaFsMutbuf.create "/mutbuf-mem" ZetaFsMutbuf.Coherence.Shared
        let h = ZetaFsMutbuf.openHandle catalog id
        match ZetaFsMutbuf.pwrite catalog h 0L [| 1uy; 2uy; 3uy |] with
        | Error e -> Assert.Fail(sprintf "%A" e)
        | Ok n ->
            Assert.Equal(3, n)
            Assert.Equal(id, h.Entity)
    finally
        FileSystem.Reset()

[<Fact>]
let ``two writes to the same range: last store wins`` () =
    FileSystem.Register(InMemoryFileSystem())
    try
        let id = mintId ()
        let catalog = ZetaFsMutbuf.create "/mutbuf-mem" ZetaFsMutbuf.Coherence.Shared
        let a = ZetaFsMutbuf.openHandle catalog id
        let b = ZetaFsMutbuf.openHandle catalog id
        ZetaFsMutbuf.pwrite catalog a 0L [| 10uy; 10uy |] |> ignore
        ZetaFsMutbuf.pwrite catalog b 0L [| 20uy; 20uy |] |> ignore
        let dst = Array.zeroCreate 2
        match ZetaFsMutbuf.pread catalog a 0L dst with
        | Ok n ->
            Assert.Equal(2, n)
            Assert.Equal<byte>([| 20uy; 20uy |], dst)
        | Error e -> Assert.Fail(sprintf "%A" e)
    finally
        FileSystem.Reset()

[<Fact>]
let ``shared handles see the same live bytes`` () =
    FileSystem.Register(InMemoryFileSystem())
    try
        let id = mintId ()
        let catalog = ZetaFsMutbuf.create "/mutbuf-mem" ZetaFsMutbuf.Coherence.Shared
        let a = ZetaFsMutbuf.openHandle catalog id
        let b = ZetaFsMutbuf.openHandle catalog id
        ZetaFsMutbuf.pwrite catalog a 0L [| 7uy |] |> ignore
        let dst = Array.zeroCreate 1
        match ZetaFsMutbuf.pread catalog b 0L dst with
        | Ok n ->
            Assert.Equal(1, n)
            Assert.Equal(7uy, dst.[0])
        | Error e -> Assert.Fail(sprintf "%A" e)
    finally
        FileSystem.Reset()

[<Fact>]
let ``snapshot G is unchanged by a later pwrite on G+1`` () =
    FileSystem.Register(InMemoryFileSystem())
    try
        let id = mintId ()
        let catalog = ZetaFsMutbuf.create "/mutbuf-mem" ZetaFsMutbuf.Coherence.Shared
        let h = ZetaFsMutbuf.openHandle catalog id
        ZetaFsMutbuf.pwrite catalog h 0L [| 1uy; 2uy; 3uy; 4uy |] |> ignore
        let snap = ZetaFsMutbuf.snapshot catalog id
        ZetaFsMutbuf.pwrite catalog h 0L [| 9uy; 9uy; 9uy; 9uy |] |> ignore
        Assert.Equal<byte>([| 1uy; 2uy; 3uy; 4uy |], snap.Bytes)
        let dst = Array.zeroCreate 4
        match ZetaFsMutbuf.pread catalog h 0L dst with
        | Ok _ -> Assert.Equal<byte>([| 9uy; 9uy; 9uy; 9uy |], dst)
        | Error e -> Assert.Fail(sprintf "%A" e)
        Assert.Equal(snap.Generation + 1UL, ZetaFsMutbuf.generation catalog id)
    finally
        FileSystem.Reset()

[<Fact>]
let ``append is serialized at the end and truncate shortens`` () =
    FileSystem.Register(InMemoryFileSystem())
    try
        let id = mintId ()
        let catalog = ZetaFsMutbuf.create "/mutbuf-mem" ZetaFsMutbuf.Coherence.Shared
        let h = ZetaFsMutbuf.openHandle catalog id
        ZetaFsMutbuf.append catalog h [| 1uy; 2uy |] |> ignore
        ZetaFsMutbuf.append catalog h [| 3uy |] |> ignore
        Assert.Equal(3L, ZetaFsMutbuf.length catalog h)
        match ZetaFsMutbuf.truncate catalog h 1L with
        | Error e -> Assert.Fail(sprintf "%A" e)
        | Ok () ->
            Assert.Equal(1L, ZetaFsMutbuf.length catalog h)
            let dst = Array.zeroCreate 1
            match ZetaFsMutbuf.pread catalog h 0L dst with
            | Ok _ -> Assert.Equal(1uy, dst.[0])
            | Error e -> Assert.Fail(sprintf "%A" e)
    finally
        FileSystem.Reset()

[<Fact>]
let ``persist and reload round-trips bytes via IFileSystem`` () =
    FileSystem.Register(InMemoryFileSystem())
    try
        let id = mintId ()
        let catalog = ZetaFsMutbuf.create "/mutbuf-store" ZetaFsMutbuf.Coherence.Shared
        let h = ZetaFsMutbuf.openHandle catalog id
        ZetaFsMutbuf.pwrite catalog h 0L [| 5uy; 6uy; 7uy |] |> ignore
        ZetaFsMutbuf.persist catalog id
        let catalog2 = ZetaFsMutbuf.create "/mutbuf-store" ZetaFsMutbuf.Coherence.Shared
        let h2 = ZetaFsMutbuf.openHandle catalog2 id
        let dst = Array.zeroCreate 3
        match ZetaFsMutbuf.pread catalog2 h2 0L dst with
        | Ok n ->
            Assert.Equal(3, n)
            Assert.Equal<byte>([| 5uy; 6uy; 7uy |], dst)
        | Error e -> Assert.Fail(sprintf "%A" e)
    finally
        FileSystem.Reset()

[<Fact>]
let ``init creates mutbuf directory`` () =
    let parent = tempStore ()
    try
        let dir = ZetaFsStore.init parent
        Assert.True(Directory.Exists(Path.Combine(dir, ZetaFsMutbuf.DirName)))
    finally
        Directory.Delete(parent, true)

[<Fact>]
let ``namespace bind then mutbuf write leaves the hub unchanged`` () =
    FileSystem.Register(InMemoryFileSystem())
    try
        let entropy = rng ()
        let ns0 = ZetaFsNamespace.create entropy
        let file, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File entropy
        let ns2 =
            match ZetaFsNamespace.bind ns1 ns0.Root (Text.Encoding.UTF8.GetBytes "a") file (ZetaFsNamespace.ActorId "t") with
            | Ok s -> s
            | Error e -> failwithf "%A" e
        let catalog = ZetaFsMutbuf.create "/mutbuf-hub" ZetaFsMutbuf.Coherence.Shared
        let h = ZetaFsMutbuf.openHandle catalog file
        ZetaFsMutbuf.pwrite catalog h 0L [| 42uy |] |> ignore
        Assert.Equal(Some file, ZetaFsNamespace.liveResolve ns0.Root (Text.Encoding.UTF8.GetBytes "a") ns2.Bindings)
        Assert.Equal(file, h.Entity)
    finally
        FileSystem.Reset()

[<Fact>]
let ``crash-mid-write during mutbuf persist keeps prior bytes after reopen`` () =
    let mock = InMemoryFileSystem()
    FileSystem.Register mock
    let store = "/mutbuf-crash-persist"

    try
        let id = mintId ()
        let catalog = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let h = ZetaFsMutbuf.openHandle catalog id
        ZetaFsMutbuf.pwrite catalog h 0L [| 1uy; 2uy; 3uy |] |> ignore
        ZetaFsMutbuf.persist catalog id
        ZetaFsMutbuf.pwrite catalog h 0L [| 9uy; 9uy; 9uy |] |> ignore
        mock.ArmCrashMidWrite("mutbuf-crash-persist", 1)
        let ex = Assert.Throws<CrashMidWriteException>(fun () -> ZetaFsMutbuf.persist catalog id)
        Assert.Equal(1, ex.CommittedBytes)
        let reopened = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
        let h2 = ZetaFsMutbuf.openHandle reopened id
        let dst = Array.zeroCreate 3

        match ZetaFsMutbuf.pread reopened h2 0L dst with
        | Error e -> Assert.Fail(sprintf "%A" e)
        | Ok n ->
            Assert.Equal(3, n)
            Assert.Equal<byte>([| 1uy; 2uy; 3uy |], dst)
    finally
        FileSystem.Reset()
