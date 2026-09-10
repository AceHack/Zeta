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

let private withVolumeCoherence
    (store: string)
    (coherence: ZetaFsMutbuf.Coherence)
    (clock: ISimulationEnvironment)
    (f: ZetaFsFreeze.Volume -> unit)
    =
    ensureHasher ()
    FileSystem.Register(InMemoryFileSystem())
    let mutbuf = ZetaFsMutbuf.create store coherence
    let volume = ZetaFsFreeze.createManualStreamWith store mutbuf None clock

    try
        f volume
    finally
        ZetaFsFreeze.dispose volume
        FileSystem.Reset()

let private withVolumeClock (store: string) (clock: ISimulationEnvironment) (f: ZetaFsFreeze.Volume -> unit) =
    withVolumeCoherence store ZetaFsMutbuf.Coherence.Shared clock f

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

[<Fact>]
let ``pwrite then pread round-trips and truncate shrinks getattr size`` () =
    withVolume "/vfs-pwrite" (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "a") with
        | Error e -> Assert.Fail(sprintf "bindFile: %A" e)
        | Ok _ ->
            let mount0 = mustMount volume ZetaFsCollator.linuxDefault
            let node, mount1 =
                ok (ZetaFsPosixVfs.lookup mount0 (ZetaFsPosixVfs.root mount0) (utf8 "a"))
            Assert.Equal(3, ok (ZetaFsPosixVfs.pwrite mount1 node 0L [| 1uy; 2uy; 3uy |]))
            let buf = Array.zeroCreate 8
            Assert.Equal(3, ok (ZetaFsPosixVfs.pread mount1 node 0L buf))
            Assert.Equal(1uy, buf.[0])
            Assert.Equal(2uy, buf.[1])
            Assert.Equal(3uy, buf.[2])
            let stat = ok (ZetaFsPosixVfs.getattr mount1 node)
            Assert.Equal(3UL, stat.Size)
            match ZetaFsPosixVfs.truncate mount1 node 1L with
            | Error e -> Assert.Fail(sprintf "truncate: %A" e)
            | Ok() ->
                let shrunk = ok (ZetaFsPosixVfs.getattr mount1 node)
                Assert.Equal(1UL, shrunk.Size)
                let one = Array.zeroCreate 8
                Assert.Equal(1, ok (ZetaFsPosixVfs.pread mount1 node 0L one))
                Assert.Equal(1uy, one.[0]))

[<Fact>]
let ``pwrite on a directory is Eisdir`` () =
    withVolume "/vfs-pwrite-dir" (fun volume ->
        let mount = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount
        match ZetaFsPosixVfs.pwrite mount rootNode 0L [| 1uy |] with
        | Error(ZetaFsPosixVfs.Eisdir id) ->
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare rootNode.Entity id)
        | other -> Assert.Fail(sprintf "expected Eisdir, got %A" other))

[<Fact>]
let ``pwrite negative offset is Mutbuf NegativeOffset`` () =
    withVolume "/vfs-pwrite-neg" (fun volume ->
        match ZetaFsFreeze.bindFile volume (utf8 "a") with
        | Error e -> Assert.Fail(sprintf "bindFile: %A" e)
        | Ok _ ->
            let mount0 = mustMount volume ZetaFsCollator.linuxDefault
            let node, mount1 =
                ok (ZetaFsPosixVfs.lookup mount0 (ZetaFsPosixVfs.root mount0) (utf8 "a"))
            match ZetaFsPosixVfs.pwrite mount1 node -1L [| 1uy |] with
            | Error(ZetaFsPosixVfs.Mutbuf(ZetaFsMutbuf.NegativeOffset n)) -> Assert.Equal(-1L, n)
            | other -> Assert.Fail(sprintf "expected NegativeOffset, got %A" other))

[<Fact>]
let ``create then lookup finds the file; mkdir then create under the dir`` () =
    withVolume "/vfs-create" (fun volume ->
        let mount0 = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount0
        let file, mount1 = ok (ZetaFsPosixVfs.create mount0 rootNode (utf8 "a"))
        let stat = ok (ZetaFsPosixVfs.getattr mount1 file)
        Assert.Equal(ZetaFsPosixMeta.fileMode, stat.Meta.Mode)
        let found, mount2 = ok (ZetaFsPosixVfs.lookup mount1 rootNode (utf8 "a"))
        Assert.Equal(0, ZetaFsNamespace.EntityId.compare file.Entity found.Entity)
        let dir, mount3 = ok (ZetaFsPosixVfs.mkdir mount2 rootNode (utf8 "d"))
        let nested, mount4 = ok (ZetaFsPosixVfs.create mount3 dir (utf8 "b"))
        let nestedStat = ok (ZetaFsPosixVfs.getattr mount4 nested)
        Assert.Equal(ZetaFsPosixMeta.fileMode, nestedStat.Meta.Mode)
        let back, _ = ok (ZetaFsPosixVfs.lookup mount4 nested ZetaFsPosixVfs.dotDot)
        Assert.Equal(dir.Id, back.Id))

[<Fact>]
let ``Ascii create refuses Notes.md when notes.md is live; store is unchanged`` () =
    withVolume "/vfs-create-ascii" (fun volume ->
        let fuse0 = mustMount volume ZetaFsCollator.fuseTDefault
        let rootNode = ZetaFsPosixVfs.root fuse0
        let _, fuse1 = ok (ZetaFsPosixVfs.create fuse0 rootNode (utf8 "notes.md"))
        match ZetaFsPosixVfs.create fuse1 rootNode (utf8 "Notes.md") with
        | Error(ZetaFsPosixVfs.Confusable existing) ->
            Assert.True(sameBytes (utf8 "notes.md") existing)
        | other -> Assert.Fail(sprintf "Ascii must refuse Notes.md, got %A" other)
        let notes, _ = ok (ZetaFsPosixVfs.lookup fuse1 rootNode (utf8 "notes.md"))
        match ZetaFsPosixVfs.lookup fuse1 rootNode (utf8 "Notes.md") with
        | Ok(node, _) ->
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare notes.Entity node.Entity)
        | Error e -> Assert.Fail(sprintf "Ascii lookup of Notes.md should fold to notes.md, got %A" e))

[<Fact>]
let ``create of dot or dotdot is Confusable`` () =
    withVolume "/vfs-create-dot" (fun volume ->
        let mount = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount
        match ZetaFsPosixVfs.create mount rootNode ZetaFsPosixVfs.dot with
        | Error(ZetaFsPosixVfs.Confusable name) -> Assert.True(sameBytes ZetaFsPosixVfs.dot name)
        | other -> Assert.Fail(sprintf "dot must be Confusable, got %A" other)
        match ZetaFsPosixVfs.mkdir mount rootNode ZetaFsPosixVfs.dotDot with
        | Error(ZetaFsPosixVfs.Confusable name) -> Assert.True(sameBytes ZetaFsPosixVfs.dotDot name)
        | other -> Assert.Fail(sprintf "dotdot must be Confusable, got %A" other))

[<Fact>]
let ``unlink tombs a file; lookup then NotFound; unlink of a dir is Eisdir`` () =
    withVolume "/vfs-unlink" (fun volume ->
        let mount0 = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount0
        let _, mount1 = ok (ZetaFsPosixVfs.create mount0 rootNode (utf8 "a"))
        match ZetaFsPosixVfs.unlink mount1 rootNode (utf8 "a") with
        | Error e -> Assert.Fail(sprintf "unlink: %A" e)
        | Ok() ->
            match ZetaFsPosixVfs.lookup mount1 rootNode (utf8 "a") with
            | Error ZetaFsPosixVfs.NotFound -> ()
            | other -> Assert.Fail(sprintf "expected NotFound, got %A" other)
        let dir, mount2 = ok (ZetaFsPosixVfs.mkdir mount1 rootNode (utf8 "d"))
        match ZetaFsPosixVfs.unlink mount2 rootNode (utf8 "d") with
        | Error(ZetaFsPosixVfs.Eisdir id) ->
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare dir.Entity id)
        | other -> Assert.Fail(sprintf "unlink dir must be Eisdir, got %A" other))

[<Fact>]
let ``rmdir of empty dir works; non-empty is Enotempty; file is Enotdir`` () =
    withVolume "/vfs-rmdir" (fun volume ->
        let mount0 = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount0
        let empty, mount1 = ok (ZetaFsPosixVfs.mkdir mount0 rootNode (utf8 "e"))
        match ZetaFsPosixVfs.rmdir mount1 rootNode (utf8 "e") with
        | Error e -> Assert.Fail(sprintf "rmdir empty: %A" e)
        | Ok() ->
            match ZetaFsPosixVfs.lookup mount1 rootNode (utf8 "e") with
            | Error ZetaFsPosixVfs.NotFound -> ()
            | other -> Assert.Fail(sprintf "expected NotFound after rmdir, got %A" other)
        let full, mount2 = ok (ZetaFsPosixVfs.mkdir mount1 rootNode (utf8 "f"))
        let _, mount3 = ok (ZetaFsPosixVfs.create mount2 full (utf8 "x"))
        match ZetaFsPosixVfs.rmdir mount3 rootNode (utf8 "f") with
        | Error(ZetaFsPosixVfs.Enotempty id) ->
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare full.Entity id)
        | other -> Assert.Fail(sprintf "non-empty rmdir must be Enotempty, got %A" other)
        let _, mount4 = ok (ZetaFsPosixVfs.create mount3 rootNode (utf8 "file"))
        match ZetaFsPosixVfs.rmdir mount4 rootNode (utf8 "file") with
        | Error(ZetaFsPosixVfs.Enotdir _) -> ()
        | other -> Assert.Fail(sprintf "rmdir file must be Enotdir, got %A" other))

[<Fact>]
let ``symlink stores target bytes; readlink returns them; not resolved`` () =
    withVolume "/vfs-symlink" (fun volume ->
        let mount0 = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount0
        let target = utf8 "no/such"
        let node, mount1 = ok (ZetaFsPosixVfs.symlink mount0 rootNode (utf8 "l") target)
        let stat = ok (ZetaFsPosixVfs.getattr mount1 node)
        Assert.Equal(ZetaFsPosixMeta.symlinkMode, stat.Meta.Mode)
        let bytes = ok (ZetaFsPosixVfs.readlink mount1 node)
        Assert.True(sameBytes target bytes)
        match ZetaFsPosixVfs.readlink mount1 rootNode with
        | Error ZetaFsPosixVfs.NotFound -> ()
        | other -> Assert.Fail(sprintf "readlink on dir must miss, got %A" other))

[<Fact>]
let ``rename moves a file; dest file replace works; dest dir is Eisdir`` () =
    withVolume "/vfs-rename" (fun volume ->
        let mount0 = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount0
        let src, mount1 = ok (ZetaFsPosixVfs.create mount0 rootNode (utf8 "a"))
        match ZetaFsPosixVfs.rename mount1 rootNode (utf8 "a") rootNode (utf8 "b") with
        | Error e -> Assert.Fail(sprintf "rename: %A" e)
        | Ok() ->
            match ZetaFsPosixVfs.lookup mount1 rootNode (utf8 "a") with
            | Error ZetaFsPosixVfs.NotFound -> ()
            | other -> Assert.Fail(sprintf "src should be gone, got %A" other)
            let moved, _ = ok (ZetaFsPosixVfs.lookup mount1 rootNode (utf8 "b"))
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare src.Entity moved.Entity)
        let _, mount2 = ok (ZetaFsPosixVfs.create mount1 rootNode (utf8 "c"))
        match ZetaFsPosixVfs.rename mount2 rootNode (utf8 "b") rootNode (utf8 "c") with
        | Error e -> Assert.Fail(sprintf "replace file: %A" e)
        | Ok() ->
            let replaced, _ = ok (ZetaFsPosixVfs.lookup mount2 rootNode (utf8 "c"))
            Assert.Equal(0, ZetaFsNamespace.EntityId.compare src.Entity replaced.Entity)
        let _, mount3 = ok (ZetaFsPosixVfs.mkdir mount2 rootNode (utf8 "d"))
        let _, mount4 = ok (ZetaFsPosixVfs.create mount3 rootNode (utf8 "e"))
        match ZetaFsPosixVfs.rename mount4 rootNode (utf8 "e") rootNode (utf8 "d") with
        | Error(ZetaFsPosixVfs.Eisdir _) -> ()
        | other -> Assert.Fail(sprintf "file onto dir must be Eisdir, got %A" other))

[<Fact>]
let ``Ascii rename to Notes.md is Confusable when notes.md is live`` () =
    withVolume "/vfs-rename-ascii" (fun volume ->
        let fuse0 = mustMount volume ZetaFsCollator.fuseTDefault
        let rootNode = ZetaFsPosixVfs.root fuse0
        let _, fuse1 = ok (ZetaFsPosixVfs.create fuse0 rootNode (utf8 "notes.md"))
        let _, fuse2 = ok (ZetaFsPosixVfs.create fuse1 rootNode (utf8 "other"))
        match ZetaFsPosixVfs.rename fuse2 rootNode (utf8 "other") rootNode (utf8 "Notes.md") with
        | Error(ZetaFsPosixVfs.Confusable existing) ->
            Assert.True(sameBytes (utf8 "notes.md") existing)
        | other -> Assert.Fail(sprintf "Ascii rename onto fold collision must be Confusable, got %A" other))

[<Fact>]
let ``Shared open: pwrite on one fd is visible to the other without close`` () =
    withVolume "/vfs-open-shared" (fun volume ->
        let mount0 = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount0
        let node, mount1 = ok (ZetaFsPosixVfs.create mount0 rootNode (utf8 "a"))
        let fdA = ok (ZetaFsPosixVfs.openFile mount1 node)
        let fdB = ok (ZetaFsPosixVfs.openFile mount1 node)
        Assert.Equal(3, ok (ZetaFsPosixVfs.pwriteFd mount1 fdA 0L [| 1uy; 2uy; 3uy |]))
        let buf = Array.zeroCreate 8
        Assert.Equal(3, ok (ZetaFsPosixVfs.preadFd mount1 fdB 0L buf))
        Assert.Equal(1uy, buf.[0])
        match ZetaFsPosixVfs.close mount1 fdA with
        | Error e -> Assert.Fail(sprintf "close A: %A" e)
        | Ok() -> ()
        match ZetaFsPosixVfs.close mount1 fdB with
        | Error e -> Assert.Fail(sprintf "close B: %A" e)
        | Ok() -> ()
        match ZetaFsPosixVfs.openFile mount1 (ZetaFsPosixVfs.root mount1) with
        | Error(ZetaFsPosixVfs.Eisdir _) -> ()
        | other -> Assert.Fail(sprintf "open dir must be Eisdir, got %A" other))

[<Fact>]
let ``CloseToOpen: writer publish is last-close; other fd does not see it until reopen`` () =
    let clock = Environment.createVirtual 23L :> ISimulationEnvironment
    withVolumeCoherence "/vfs-open-cto" ZetaFsMutbuf.Coherence.CloseToOpen clock (fun volume ->
        let mount0 = mustMount volume ZetaFsCollator.linuxDefault
        let rootNode = ZetaFsPosixVfs.root mount0
        let node, mount1 = ok (ZetaFsPosixVfs.create mount0 rootNode (utf8 "a"))
        let fdA = ok (ZetaFsPosixVfs.openFile mount1 node)
        let fdB = ok (ZetaFsPosixVfs.openFile mount1 node)
        Assert.Equal(3, ok (ZetaFsPosixVfs.pwriteFd mount1 fdA 0L [| 9uy; 8uy; 7uy |]))
        let before = Array.zeroCreate 8
        Assert.Equal(0, ok (ZetaFsPosixVfs.preadFd mount1 fdB 0L before))
        match ZetaFsPosixVfs.close mount1 fdA with
        | Error e -> Assert.Fail(sprintf "close A: %A" e)
        | Ok() -> ()
        let still = Array.zeroCreate 8
        Assert.Equal(0, ok (ZetaFsPosixVfs.preadFd mount1 fdB 0L still))
        match ZetaFsPosixVfs.close mount1 fdB with
        | Error e -> Assert.Fail(sprintf "close B: %A" e)
        | Ok() -> ()
        let fdC = ok (ZetaFsPosixVfs.openFile mount1 node)
        let after = Array.zeroCreate 8
        Assert.Equal(3, ok (ZetaFsPosixVfs.preadFd mount1 fdC 0L after))
        Assert.Equal(9uy, after.[0])
        match ZetaFsPosixVfs.close mount1 fdC with
        | Error e -> Assert.Fail(sprintf "close C: %A" e)
        | Ok() -> ())
