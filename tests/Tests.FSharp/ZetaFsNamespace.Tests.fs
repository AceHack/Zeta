module Zeta.Tests.ZetaFsNamespaceTests

open System
open System.IO
open System.Text
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3
open Zeta.Core.FSharp.ZetaId

let private utf8 (s: string) = Encoding.UTF8.GetBytes s

let private namesEqual (a: byte[]) (b: byte[]) =
    a.Length = b.Length
    && MemoryExtensions.SequenceEqual(ReadOnlySpan<byte> a, ReadOnlySpan<byte> b)

let private rng () =
    let e = Environment.createVirtual 7L :> Zeta.Core.ISimulationEnvironment
    ZetaFsNamespace.Entropy(fun () -> e.NextInt64())

let private asserter = ZetaFsNamespace.ActorId "test"

let private tempParent () =
    let path =
        Path.Combine(Path.GetTempPath(), sprintf "zetafs-ns-%s" (Guid.NewGuid().ToString("N")))

    Directory.CreateDirectory path |> ignore
    path

[<Fact>]
let ``minted EntityId unpacks as StoreEntity category 13`` () =
    let id = ZetaFsNamespace.EntityId.mint (rng ())
    let _, cat, _ = ZetaIdCodec.unpackGeneric id.Raw
    Assert.Equal(Category.StoreEntity, cat)
    Assert.Equal(13uy, byte cat)
    Assert.Equal(26, id.Format().Length)

[<Fact>]
let ``create mints a Directory root that is never reused`` () =
    let next = rng ()
    let ns = ZetaFsNamespace.create next
    Assert.Equal(ZetaFsNamespace.EntityKind.Directory, ns.Entities.[ns.Root])
    let child, ns2 = ZetaFsNamespace.mint ns ZetaFsNamespace.EntityKind.File next
    Assert.NotEqual(ns.Root, child)
    Assert.True(Map.containsKey child ns2.Entities)

[<Fact>]
let ``bind a file does not change the parent Directory EntityId`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let file, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File next
    match ZetaFsNamespace.bind ns1 ns0.Root (utf8 "a") file asserter with
    | Error err -> Assert.Fail(sprintf "%A" err)
    | Ok ns2 ->
        Assert.Equal(ns0.Root, ns2.Root)
        Assert.Equal(Some file, ZetaFsNamespace.liveResolve ns2.Root (utf8 "a") ns2.Bindings)

[<Fact>]
let ``git-tree updatePath rewrites the parent directory object; bindings do not`` () =
    let hashVal (s: string) = MerkleHash.ofBytes (ReadOnlySpan<byte>(Encoding.UTF8.GetBytes s))
    let tree = ZetaFs.create hashVal
    let fileHash = hashVal "body"
    let dirHash, store1 =
        ZetaFs.updatePath [ "dir" ] (Some(FsEntry.DirEntry tree.root)) tree.root tree.store
    let afterFile, _ =
        ZetaFs.updatePath [ "dir"; "f" ] (Some(FsEntry.FileEntry fileHash)) dirHash store1
    Assert.NotEqual(dirHash, afterFile)

    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let dir, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.Directory next
    let ns2 =
        match ZetaFsNamespace.bind ns1 ns0.Root (utf8 "dir") dir asserter with
        | Ok s -> s
        | Error err -> failwithf "%A" err
    let file, ns3 = ZetaFsNamespace.mint ns2 ZetaFsNamespace.EntityKind.File next
    match ZetaFsNamespace.bind ns3 dir (utf8 "f") file asserter with
    | Error err -> Assert.Fail(sprintf "%A" err)
    | Ok ns4 ->
        Assert.Equal(Some dir, ZetaFsNamespace.liveResolve ns0.Root (utf8 "dir") ns4.Bindings)
        Assert.Equal(Some file, ZetaFsNamespace.liveResolve dir (utf8 "f") ns4.Bindings)
        Assert.Equal(dir, ns2.Root |> fun _ -> dir)

[<Fact>]
let ``unlink tombstone wins liveResolve; resolveAt prior phase still sees Live`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let file, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File next
    let ns2 =
        match ZetaFsNamespace.bind ns1 ns0.Root (utf8 "a") file asserter with
        | Ok s -> s
        | Error err -> failwithf "%A" err
    let boundPhase = ns2.Bindings.Head.Phase.Stamp
    match ZetaFsNamespace.unlink ns2 ns0.Root (utf8 "a") asserter with
    | Error err -> Assert.Fail(sprintf "%A" err)
    | Ok ns3 ->
        Assert.Equal(None, ZetaFsNamespace.liveResolve ns0.Root (utf8 "a") ns3.Bindings)
        match ZetaFsNamespace.resolveAt ns0.Root (utf8 "a") boundPhase ns3.Bindings with
        | Some(ZetaFsNamespace.Live id) -> Assert.Equal(file, id)
        | other -> Assert.Fail(sprintf "expected Live, got %A" other)
        Assert.True(ns3.Bindings.Length > 1)
        Assert.True(
            ns3.Bindings
            |> List.exists (fun b ->
                match b.Target with
                | ZetaFsNamespace.Live id -> id = file
                | _ -> false)
        )

[<Fact>]
let ``cycle guard refuses a Directory bound under its own descendant`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let a, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.Directory next
    let b, ns2 = ZetaFsNamespace.mint ns1 ZetaFsNamespace.EntityKind.Directory next
    let ns3 =
        match ZetaFsNamespace.bind ns2 ns0.Root (utf8 "a") a asserter with
        | Ok s -> s
        | Error err -> failwithf "%A" err
    let ns4 =
        match ZetaFsNamespace.bind ns3 a (utf8 "b") b asserter with
        | Ok s -> s
        | Error err -> failwithf "%A" err
    match ZetaFsNamespace.bind ns4 b (utf8 "back") a asserter with
    | Error(ZetaFsNamespace.Cycle(parent, target)) ->
        Assert.Equal(b, parent)
        Assert.Equal(a, target)
    | other -> Assert.Fail(sprintf "expected Cycle, got %A" other)

[<Fact>]
let ``cycle guard test fails if the check is deleted — self-parent is a cycle`` () =
    let ns0 = ZetaFsNamespace.create (rng ())
    Assert.True(ZetaFsNamespace.wouldCycle ns0 ns0.Root ns0.Root)

let private mustBind state parent name target =
    match ZetaFsNamespace.bind state parent name target asserter with
    | Ok s -> s
    | Error e -> failwithf "%A" e

[<Fact>]
let ``rename dest directory and source file is Eisdir and does not tombstone`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let file, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File next
    let dir, ns2 = ZetaFsNamespace.mint ns1 ZetaFsNamespace.EntityKind.Directory next
    let ns3 = mustBind ns2 ns0.Root (utf8 "a") file
    let ns4 = mustBind ns3 ns0.Root (utf8 "d") dir
    match ZetaFsNamespace.rename ns4 ns0.Root (utf8 "a") ns0.Root (utf8 "d") asserter with
    | Error(ZetaFsNamespace.Eisdir dest) ->
        Assert.Equal(0, ZetaFsNamespace.EntityId.compare dir dest)
        Assert.Equal(Some file, ZetaFsNamespace.liveResolve ns0.Root (utf8 "a") ns4.Bindings)
        Assert.Equal(Some dir, ZetaFsNamespace.liveResolve ns0.Root (utf8 "d") ns4.Bindings)
    | other -> Assert.Fail(sprintf "expected Eisdir, got %A" other)

[<Fact>]
let ``rename dest file and source directory is Enotdir and does not tombstone`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let dir, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.Directory next
    let file, ns2 = ZetaFsNamespace.mint ns1 ZetaFsNamespace.EntityKind.File next
    let ns3 = mustBind ns2 ns0.Root (utf8 "d") dir
    let ns4 = mustBind ns3 ns0.Root (utf8 "a") file
    match ZetaFsNamespace.rename ns4 ns0.Root (utf8 "d") ns0.Root (utf8 "a") asserter with
    | Error(ZetaFsNamespace.Enotdir dest) ->
        Assert.Equal(0, ZetaFsNamespace.EntityId.compare file dest)
        Assert.Equal(Some dir, ZetaFsNamespace.liveResolve ns0.Root (utf8 "d") ns4.Bindings)
        Assert.Equal(Some file, ZetaFsNamespace.liveResolve ns0.Root (utf8 "a") ns4.Bindings)
    | other -> Assert.Fail(sprintf "expected Enotdir, got %A" other)

[<Fact>]
let ``rename dest non-empty directory is Enotempty and does not tombstone`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let dest, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.Directory next
    let child, ns2 = ZetaFsNamespace.mint ns1 ZetaFsNamespace.EntityKind.File next
    let src, ns3 = ZetaFsNamespace.mint ns2 ZetaFsNamespace.EntityKind.Directory next
    let ns4 = mustBind ns3 ns0.Root (utf8 "dest") dest
    let ns5 = mustBind ns4 dest (utf8 "c") child
    let ns6 = mustBind ns5 ns0.Root (utf8 "src") src
    match ZetaFsNamespace.rename ns6 ns0.Root (utf8 "src") ns0.Root (utf8 "dest") asserter with
    | Error(ZetaFsNamespace.Enotempty id) ->
        Assert.Equal(0, ZetaFsNamespace.EntityId.compare dest id)
        Assert.Equal(Some src, ZetaFsNamespace.liveResolve ns0.Root (utf8 "src") ns6.Bindings)
        Assert.Equal(Some dest, ZetaFsNamespace.liveResolve ns0.Root (utf8 "dest") ns6.Bindings)
    | other -> Assert.Fail(sprintf "expected Enotempty, got %A" other)

[<Fact>]
let ``rename dest absent binds the same EntityId and tombstones the source name`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let file, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File next
    let ns2 = mustBind ns1 ns0.Root (utf8 "a") file
    match ZetaFsNamespace.rename ns2 ns0.Root (utf8 "a") ns0.Root (utf8 "b") asserter with
    | Error e -> Assert.Fail(sprintf "%A" e)
    | Ok ns3 ->
        Assert.Equal(None, ZetaFsNamespace.liveResolve ns0.Root (utf8 "a") ns3.Bindings)
        Assert.Equal(Some file, ZetaFsNamespace.liveResolve ns0.Root (utf8 "b") ns3.Bindings)

[<Fact>]
let ``rename same parent and name is a no-op`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let file, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File next
    let ns2 = mustBind ns1 ns0.Root (utf8 "a") file
    match ZetaFsNamespace.rename ns2 ns0.Root (utf8 "a") ns0.Root (utf8 "a") asserter with
    | Error e -> Assert.Fail(sprintf "%A" e)
    | Ok ns3 -> Assert.Equal(Some file, ZetaFsNamespace.liveResolve ns0.Root (utf8 "a") ns3.Bindings)

[<Fact>]
let ``readdir lists live names without dot or dot-dot and skips tombstones`` () =
    let next = rng ()
    let ns0 = ZetaFsNamespace.create next
    let a, ns1 = ZetaFsNamespace.mint ns0 ZetaFsNamespace.EntityKind.File next
    let b, ns2 = ZetaFsNamespace.mint ns1 ZetaFsNamespace.EntityKind.File next
    let ns3 = mustBind ns2 ns0.Root (utf8 "b") b
    let ns4 = mustBind ns3 ns0.Root (utf8 "a") a
    match ZetaFsNamespace.readdir ns4 ns0.Root with
    | Error e -> Assert.Fail(sprintf "%A" e)
    | Ok names ->
        Assert.Equal(2, names.Length)
        Assert.True(namesEqual (utf8 "a") (fst names.[0]))
        Assert.True(namesEqual (utf8 "b") (fst names.[1]))
        Assert.Equal(0, ZetaFsNamespace.EntityId.compare a (snd names.[0]))
        Assert.Equal(0, ZetaFsNamespace.EntityId.compare b (snd names.[1]))
        for name, _ in names do
            Assert.False(namesEqual (utf8 ".") name)
            Assert.False(namesEqual (utf8 "..") name)
    match ZetaFsNamespace.unlink ns4 ns0.Root (utf8 "a") asserter with
    | Error e -> Assert.Fail(sprintf "%A" e)
    | Ok ns5 ->
        match ZetaFsNamespace.readdir ns5 ns0.Root with
        | Error e -> Assert.Fail(sprintf "%A" e)
        | Ok names ->
            Assert.Equal(1, names.Length)
            Assert.True(namesEqual (utf8 "b") (fst names.[0]))

[<Fact>]
let ``init writes ROOT Crockford-26 and does not flip FORMAT to bindings`` () =
    let parent = tempParent ()

    try
        let dir = ZetaFsStore.init parent
        let rootPath = Path.Combine(dir, ZetaFsNamespace.RootFileName)
        Assert.True(File.Exists rootPath)
        let text = File.ReadAllText(rootPath).Trim()
        Assert.Equal(26, text.Length)
        match ZetaFsNamespace.EntityId.tryParse text with
        | None -> Assert.Fail("ROOT must parse as Crockford-26")
        | Some id ->
            let _, cat, _ = ZetaIdCodec.unpackGeneric id.Raw
            Assert.Equal(Category.StoreEntity, cat)
        let format = File.ReadAllText(Path.Combine(dir, ZetaFsFormat.FileName))
        Assert.Contains("ns=git-trees", format, StringComparison.Ordinal)
        Assert.DoesNotContain("ns=bindings", format, StringComparison.Ordinal)
    finally
        Directory.Delete(parent, true)
