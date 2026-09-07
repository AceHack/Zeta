[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.ZetaFsPosixVfsTests

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

let private mustMount volume collator =
    match ZetaFsPosixVfs.tryCreate volume collator with
    | Some m -> m
    | None -> failwith "volume ROOT missing"

let private ok r =
    match r with
    | Ok v -> v
    | Error e -> failwithf "%A" e

let private withVolumeClock (store: string) (clock: ISimulationEnvironment) (f: ZetaFsFreeze.Volume -> unit) =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let mutbuf = ZetaFsMutbuf.create store ZetaFsMutbuf.Coherence.Shared
    let volume = ZetaFsFreeze.createManualStreamWith store mutbuf None clock

    try
        f volume
    finally
        ZetaFsFreeze.dispose volume
        FileSystem.Reset()

let private withVolume (store: string) (f: ZetaFsFreeze.Volume -> unit) =
    withVolumeClock store (Environment.createVirtual 21L :> ISimulationEnvironment) f

[<Fact>]
let ``readdir synthesizes dot and dotdot then live names`` () =
    withVolume "/vfs-readdir" (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "b") with
        | Error e -> Assert.Fail(sprintf "bindFile b: %A" e)
        | Ok _ ->
            match ZetaFsFreeze.bindFile volume (utf8 "a") with
            | Error e -> Assert.Fail(sprintf "bindFile a: %A" e)
            | Ok _ ->
                let mount = mustMount volume ZetaFsCollator.linuxDefault
                let entries, _ = ok (ZetaFsPosixVfs.readdir mount (ZetaFsPosixVfs.root mount))
                Assert.Equal(4, entries.Length)
                Assert.True(sameBytes ZetaFsPosixVfs.dot entries.[0].Name)
                Assert.True(sameBytes ZetaFsPosixVfs.dotDot entries.[1].Name)
                Assert.True(sameBytes (utf8 "a") entries.[2].Name)
                Assert.True(sameBytes (utf8 "b") entries.[3].Name)
                Assert.Equal(ZetaFsPosixVfs.root(mount).Id, entries.[0].Node.Id)
                Assert.Equal(ZetaFsPosixVfs.root(mount).Id, entries.[1].Node.Id))

[<Fact>]
let ``lookup dot is self and lookup dotdot from a dir is the arrival parent`` () =
    withVolume "/vfs-dotdot" (fun volume ->
        match volume.Root with
        | None -> Assert.Fail("ROOT missing")
        | Some root ->
            match ZetaFsFreeze.bindDirectory volume root (utf8 "dir") with
            | Error e -> Assert.Fail(sprintf "bindDirectory: %A" e)
            | Ok dirId ->
                let mount0 = mustMount volume ZetaFsCollator.linuxDefault
                let self, _ = ok (ZetaFsPosixVfs.lookup mount0 (ZetaFsPosixVfs.root mount0) ZetaFsPosixVfs.dot)
                Assert.Equal(ZetaFsPosixVfs.root(mount0).Id, self.Id)
                let dir, mount1 =
                    ok (ZetaFsPosixVfs.lookup mount0 (ZetaFsPosixVfs.root mount0) (utf8 "dir"))
                Assert.Equal(0, ZetaFsNamespace.EntityId.compare dirId dir.Entity)
                let back, _ = ok (ZetaFsPosixVfs.lookup mount1 dir ZetaFsPosixVfs.dotDot)
                Assert.Equal(ZetaFsPosixVfs.root(mount1).Id, back.Id)
                Assert.Equal(0, ZetaFsNamespace.EntityId.compare root back.Entity))

[<Fact>]
let ``two parents yield two dotdot values and one st_ino`` () =
    withVolume "/vfs-two-parents" (fun volume ->
        match volume.Root with
        | None -> Assert.Fail("ROOT missing")
        | Some root ->
            match ZetaFsFreeze.bindDirectory volume root (utf8 "a") with
            | Error e -> Assert.Fail(sprintf "bindDirectory a: %A" e)
            | Ok aId ->
                match ZetaFsFreeze.bindDirectory volume root (utf8 "b") with
                | Error e -> Assert.Fail(sprintf "bindDirectory b: %A" e)
                | Ok bId ->
                    match ZetaFsFreeze.bindFile volume (utf8 "file") with
                    | Error e -> Assert.Fail(sprintf "bindFile: %A" e)
                    | Ok fileId ->
                        match ZetaFsFreeze.bindName volume aId (utf8 "file") fileId with
                        | Error e -> Assert.Fail(sprintf "bindName a: %A" e)
                        | Ok() ->
                            match ZetaFsFreeze.bindName volume bId (utf8 "file") fileId with
                            | Error e -> Assert.Fail(sprintf "bindName b: %A" e)
                            | Ok() ->
                                let mount0 = mustMount volume ZetaFsCollator.linuxDefault
                                let nodeA, mount1 =
                                    ok (ZetaFsPosixVfs.lookup mount0 (ZetaFsPosixVfs.root mount0) (utf8 "a"))
                                let nodeB, mount2 =
                                    ok (ZetaFsPosixVfs.lookup mount1 (ZetaFsPosixVfs.root mount1) (utf8 "b"))
                                let viaA, mount3 = ok (ZetaFsPosixVfs.lookup mount2 nodeA (utf8 "file"))
                                let viaB, mount4 = ok (ZetaFsPosixVfs.lookup mount3 nodeB (utf8 "file"))
                                Assert.Equal(viaA.Ino, viaB.Ino)
                                Assert.NotEqual(viaA.Id, viaB.Id)
                                let upA, _ = ok (ZetaFsPosixVfs.lookup mount4 viaA ZetaFsPosixVfs.dotDot)
                                let upB, _ = ok (ZetaFsPosixVfs.lookup mount4 viaB ZetaFsPosixVfs.dotDot)
                                Assert.Equal(nodeA.Id, upA.Id)
                                Assert.Equal(nodeB.Id, upB.Id)
                                Assert.Equal(0, ZetaFsNamespace.EntityId.compare aId upA.Entity)
                                Assert.Equal(0, ZetaFsNamespace.EntityId.compare bId upB.Entity))

[<Fact>]
let ``Ascii lookup folds case; Ordinal does not; imported collision is Confusable`` () =
    withVolume "/vfs-collator" (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "foo") with
        | Error e -> Assert.Fail(sprintf "bindFile foo: %A" e)
        | Ok fooId ->
            let linux = mustMount volume ZetaFsCollator.linuxDefault
            match ZetaFsPosixVfs.lookup linux (ZetaFsPosixVfs.root linux) (utf8 "FOO") with
            | Error ZetaFsPosixVfs.NotFound -> ()
            | other -> Assert.Fail(sprintf "ordinal FOO must miss foo, got %A" other)

            let fuse0 = mustMount volume ZetaFsCollator.fuseTDefault
            let found, _ = ok (ZetaFsPosixVfs.lookup fuse0 (ZetaFsPosixVfs.root fuse0) (utf8 "FOO"))
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare fooId found.Entity)

            match volume.Root with
            | None -> Assert.Fail("ROOT missing")
            | Some root ->
                match ZetaFsFreeze.bindName volume root (utf8 "Foo") fooId with
                | Error e -> Assert.Fail(sprintf "bindName Foo: %A" e)
                | Ok() ->
                    let fuse1 = mustMount volume ZetaFsCollator.fuseTDefault
                    match ZetaFsPosixVfs.lookup fuse1 (ZetaFsPosixVfs.root fuse1) (utf8 "FOO") with
                    | Error(ZetaFsPosixVfs.Confusable existing) ->
                        Assert.True(
                            sameBytes (utf8 "Foo") existing
                            || sameBytes (utf8 "foo") existing
                        )
                    | other -> Assert.Fail(sprintf "imported collision must be Confusable, got %A" other))

[<Fact>]
let ``refuseCreate Ascii blocks Notes.md when notes.md is live; Ordinal allows it`` () =
    withVolume "/vfs-refuse" (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "notes.md") with
        | Error e -> Assert.Fail(sprintf "bindFile: %A" e)
        | Ok _ ->
            let linux = mustMount volume ZetaFsCollator.linuxDefault
            match ZetaFsPosixVfs.refuseCreate linux (ZetaFsPosixVfs.root linux) (utf8 "Notes.md") with
            | Ok() -> ()
            | Error e -> Assert.Fail(sprintf "ordinal must allow Notes.md, got %A" e)

            let fuse = mustMount volume ZetaFsCollator.fuseTDefault
            match ZetaFsPosixVfs.refuseCreate fuse (ZetaFsPosixVfs.root fuse) (utf8 "Notes.md") with
            | Error(ZetaFsPosixVfs.Confusable existing) ->
                Assert.True(sameBytes (utf8 "notes.md") existing)
            | other -> Assert.Fail(sprintf "Ascii must refuse Notes.md, got %A" other))

[<Fact>]
let ``tombstone is omitted from Fake VFS readdir`` () =
    withVolume "/vfs-tombstone" (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "gone") with
        | Error e -> Assert.Fail(sprintf "bindFile: %A" e)
        | Ok _ ->
            match ZetaFsFreeze.unlinkFile volume (utf8 "gone") with
            | Error e -> Assert.Fail(sprintf "unlinkFile: %A" e)
            | Ok() ->
                let mount = mustMount volume ZetaFsCollator.linuxDefault
                let entries, _ = ok (ZetaFsPosixVfs.readdir mount (ZetaFsPosixVfs.root mount))
                Assert.Equal(2, entries.Length)
                Assert.True(sameBytes ZetaFsPosixVfs.dot entries.[0].Name)
                Assert.True(sameBytes ZetaFsPosixVfs.dotDot entries.[1].Name))

[<Fact>]
let ``getattr stamps from the injected clock and setattr caller times persist`` () =
    let clock =
        Environment.createVirtualAt (DateTimeOffset.FromUnixTimeSeconds 1L) 22L
        :> ISimulationEnvironment

    withVolumeClock "/vfs-getattr" clock (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "a") with
        | Error e -> Assert.Fail(sprintf "bindFile: %A" e)
        | Ok id ->
            let mount0 = mustMount volume ZetaFsCollator.linuxDefault
            let node, mount1 =
                ok (ZetaFsPosixVfs.lookup mount0 (ZetaFsPosixVfs.root mount0) (utf8 "a"))
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare id node.Entity)
            let stat = ok (ZetaFsPosixVfs.getattr mount1 node)
            Assert.Equal(1_000_000_000L, stat.Meta.MtimeNs)
            Assert.Equal(1_000_000_000L, stat.Meta.CtimeNs)
            Assert.Equal(ZetaFsPosixMeta.fileMode, stat.Meta.Mode)
            Assert.Equal(1L, stat.Nlink)
            Assert.Equal(0UL, stat.Size)
            match
                ZetaFsPosixVfs.setattr
                    mount1
                    node
                    { ZetaFsPosixMeta.emptyPatch with
                        MtimeNs = Some 42L
                        CtimeNs = Some 43L }
            with
            | Error e -> Assert.Fail(sprintf "setattr: %A" e)
            | Ok() ->
                let again = ok (ZetaFsPosixVfs.getattr mount1 node)
                Assert.Equal(42L, again.Meta.MtimeNs)
                Assert.Equal(43L, again.Meta.CtimeNs))

[<Fact>]
let ``getattr size is dirty mutbuf length`` () =
    withVolume "/vfs-getattr-size" (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "b") with
        | Error e -> Assert.Fail(sprintf "bindFile: %A" e)
        | Ok _ ->
            let mount0 = mustMount volume ZetaFsCollator.linuxDefault
            let node, mount1 =
                ok (ZetaFsPosixVfs.lookup mount0 (ZetaFsPosixVfs.root mount0) (utf8 "b"))
            let h = ZetaFsMutbuf.openHandle volume.Mutbuf node.Entity
            ZetaFsMutbuf.pwrite volume.Mutbuf h 0L [| 1uy; 2uy; 3uy |] |> ignore
            let stat = ok (ZetaFsPosixVfs.getattr mount1 node)
            Assert.Equal(3UL, stat.Size)
            Assert.Equal(0UL, stat.Meta.Size))
