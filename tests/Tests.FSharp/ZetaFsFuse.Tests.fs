[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.ZetaFsFuseTests

open System
open System.Text
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

let private utf8 (s: string) = Encoding.UTF8.GetBytes s

let private sameBytes (a: byte[]) (b: byte[]) =
    a.Length = b.Length
    && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a, ReadOnlySpan<byte> b)

let private ensureHasher () =
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof<OwnBlake3Hasher>.TypeHandle)

let private withSession (store: string) (f: ZetaFsFuse.Session -> unit) =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let clock = Environment.createVirtual 24L :> ISimulationEnvironment
    let volume = ZetaFsFreeze.createManualStreamWith store mutbuf None clock

    try
        match ZetaFsPosixVfs.linux volume with
        | None -> failwith "volume ROOT missing"
        | Some mount -> f (ZetaFsFuse.create mount)
    finally
        ZetaFsFreeze.dispose volume
        FileSystem.Reset()

[<Fact>]
let ``errno codes are the Linux values`` () =
    Assert.Equal(2, ZetaFsFuse.code ZetaFsFuse.ENOENT)
    Assert.Equal(17, ZetaFsFuse.code ZetaFsFuse.EEXIST)
    Assert.Equal(20, ZetaFsFuse.code ZetaFsFuse.ENOTDIR)
    Assert.Equal(21, ZetaFsFuse.code ZetaFsFuse.EISDIR)
    Assert.Equal(22, ZetaFsFuse.code ZetaFsFuse.EINVAL)
    Assert.Equal(39, ZetaFsFuse.code ZetaFsFuse.ENOTEMPTY)

[<Fact>]
let ``lookup missing is ENOENT; create then getattr is a file`` () =
    withSession "/fuse-lookup" (fun session ->
        let root = session.Mount.Cache.Root.Id
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Lookup(root, utf8 "missing")) with
        | ZetaFsFuse.Fail ZetaFsFuse.ENOENT -> ()
        | other -> Assert.Fail(sprintf "expected ENOENT, got %A" other)
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Create(root, utf8 "a")) with
        | ZetaFsFuse.Node node ->
            match ZetaFsFuse.dispatch session (ZetaFsFuse.Getattr node.Id) with
            | ZetaFsFuse.Stat(stat, ino) ->
                Assert.Equal(ZetaFsPosixMeta.fileMode, stat.Meta.Mode)
                Assert.Equal(node.Ino, ino)
            | other -> Assert.Fail(sprintf "getattr: %A" other)
        | other -> Assert.Fail(sprintf "create: %A" other))

[<Fact>]
let ``readdir synthesizes dot and dotdot`` () =
    withSession "/fuse-readdir" (fun session ->
        let root = session.Mount.Cache.Root.Id
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Create(root, utf8 "a")) with
        | ZetaFsFuse.Node _ -> ()
        | other -> Assert.Fail(sprintf "create: %A" other)
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Readdir root) with
        | ZetaFsFuse.Dirents entries ->
            Assert.True(entries.Length >= 3)
            Assert.True(sameBytes ZetaFsPosixVfs.dot entries.[0].Name)
            Assert.True(sameBytes ZetaFsPosixVfs.dotDot entries.[1].Name)
        | other -> Assert.Fail(sprintf "readdir: %A" other))

[<Fact>]
let ``open write read release round-trips; write on a dir is EISDIR`` () =
    withSession "/fuse-rw" (fun session ->
        let root = session.Mount.Cache.Root.Id
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Open root) with
        | ZetaFsFuse.Fail ZetaFsFuse.EISDIR -> ()
        | other -> Assert.Fail(sprintf "open dir must be EISDIR, got %A" other)
        match ZetaFsFuse.dispatch session (ZetaFsFuse.Create(root, utf8 "a")) with
        | ZetaFsFuse.Node node ->
            match ZetaFsFuse.dispatch session (ZetaFsFuse.Open node.Id) with
            | ZetaFsFuse.Fh fh ->
                match ZetaFsFuse.dispatch session (ZetaFsFuse.Write(fh, 0L, [| 1uy; 2uy; 3uy |])) with
                | ZetaFsFuse.Written 3 -> ()
                | other -> Assert.Fail(sprintf "write: %A" other)
                match ZetaFsFuse.dispatch session (ZetaFsFuse.Read(fh, 0L, 8)) with
                | ZetaFsFuse.Bytes b ->
                    Assert.Equal(3, b.Length)
                    Assert.Equal(1uy, b.[0])
                | other -> Assert.Fail(sprintf "read: %A" other)
                match ZetaFsFuse.dispatch session (ZetaFsFuse.Release fh) with
                | ZetaFsFuse.Released -> ()
                | other -> Assert.Fail(sprintf "release: %A" other)
                match ZetaFsFuse.dispatch session (ZetaFsFuse.Read(fh, 0L, 8)) with
                | ZetaFsFuse.Fail ZetaFsFuse.ENOENT -> ()
                | other -> Assert.Fail(sprintf "read after release must miss, got %A" other)
            | other -> Assert.Fail(sprintf "open: %A" other)
        | other -> Assert.Fail(sprintf "create: %A" other))
