[<global.Xunit.Collection("ZetaFsAmbientFileSystem")>]
module Zeta.Tests.ZetaFsFormatTests

open System
open System.IO
open System.Text.Json
open System.Threading
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Blake3

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

let private goldenPath () =
    Path.Join(repoRoot (), "tests", "Tests.FSharp", "testdata", "zetafs-format-golden-vectors.json")

let private nsName (ns: ZetaFsFormat.Namespace) =
    match ns with
    | ZetaFsFormat.Namespace.GitTrees -> "git-trees"
    | ZetaFsFormat.Namespace.Bindings -> "bindings"

let private bodyName (body: ZetaFsFormat.Body) =
    match body with
    | ZetaFsFormat.Body.Blob -> "blob"
    | ZetaFsFormat.Body.Jumprope -> "jumprope"

let private hashName (h: ZetaFsFormat.HashAlg) =
    match h with
    | ZetaFsFormat.HashAlg.Blake3_256 -> "blake3-256"
    | ZetaFsFormat.HashAlg.Unspecified -> ""

let private chunkerName (c: ZetaFsFormat.Chunker) =
    match c with
    | ZetaFsFormat.Chunker.FastCdcV1 -> "fastcdc-v1"
    | ZetaFsFormat.Chunker.FastCdcV1Large -> "fastcdc-v1-large"
    | ZetaFsFormat.Chunker.Unspecified -> ""

let private encName (e: ZetaFsFormat.Enc) =
    match e with
    | ZetaFsFormat.Enc.Off -> "none"
    | ZetaFsFormat.Enc.AesGcmExplicitNonce -> "aes-gcm-explicit-nonce"
    | ZetaFsFormat.Enc.Unspecified -> ""

let private polyfillName (p: ZetaFsFormat.Polyfill) =
    match p with
    | ZetaFsFormat.Polyfill.Single -> "single"
    | ZetaFsFormat.Polyfill.Unspecified -> ""

let private codec =
    CborEntryCodec<string>(
        (fun (s: string) -> DynamicValue.String s),
        (fun (dv: DynamicValue) ->
            match dv with
            | DynamicValue.String s -> s
            | _ -> "")
    )

let private tempParent () =
    let path =
        Path.Combine(Path.GetTempPath(), sprintf "zetafs-fmt-%s" (Guid.NewGuid().ToString("N")))

    Directory.CreateDirectory path |> ignore
    path

[<Fact>]
let ``PR1 canonical FORMAT round-trips`` () =
    let expected = ZetaFsFormat.render ZetaFsFormat.pr1Default
    match ZetaFsFormat.parse expected with
    | Error e -> Assert.Fail(ZetaFsFormat.describe e)
    | Ok m -> Assert.Equal(expected, ZetaFsFormat.render m)

[<Fact>]
let ``PR6 canonical FORMAT round-trips`` () =
    let expected = ZetaFsFormat.render ZetaFsFormat.pr6Default
    match ZetaFsFormat.parse expected with
    | Error e -> Assert.Fail(ZetaFsFormat.describe e)
    | Ok m ->
        Assert.Equal(ZetaFsFormat.Body.Jumprope, m.Body)
        Assert.Equal(expected, ZetaFsFormat.render m)

[<Fact>]
let ``bindingsDefault FORMAT round-trips ns=bindings body=jumprope`` () =
    let expected = ZetaFsFormat.render ZetaFsFormat.bindingsDefault
    match ZetaFsFormat.parse expected with
    | Error e -> Assert.Fail(ZetaFsFormat.describe e)
    | Ok m ->
        Assert.Equal(ZetaFsFormat.Namespace.Bindings, m.Ns)
        Assert.Equal(ZetaFsFormat.Body.Jumprope, m.Body)
        Assert.Equal(expected, ZetaFsFormat.render m)
        match ZetaFsFormat.requireBindings m with
        | Ok accepted -> Assert.Equal(ZetaFsFormat.Namespace.Bindings, accepted.Ns)
        | Error e -> Assert.Fail(ZetaFsFormat.describe e)
        match ZetaFsFormat.requireGitTrees m with
        | Ok _ -> Assert.Fail("git-trees polyfill must not open ns=bindings")
        | Error e -> Assert.Equal("ReaderDoesNotSupport", ZetaFsFormat.errorName e)

[<Fact>]
let ``requireBindings refuses ns=git-trees`` () =
    match ZetaFsFormat.requireBindings ZetaFsFormat.pr6Default with
    | Ok _ -> Assert.Fail("bindings reader must not open ns=git-trees")
    | Error e -> Assert.Equal("ReaderDoesNotSupport", ZetaFsFormat.errorName e)

[<Fact>]
let ``golden vector cases parse as recorded`` () =
    let path = goldenPath ()
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let canonical = doc.RootElement.GetProperty("canonicalPr1").GetString()
    Assert.Equal(canonical, ZetaFsFormat.render ZetaFsFormat.pr1Default)
    let canonicalPr6 = doc.RootElement.GetProperty("canonicalPr6").GetString()
    Assert.Equal(canonicalPr6, ZetaFsFormat.render ZetaFsFormat.pr6Default)

    for v in doc.RootElement.GetProperty("cases").EnumerateArray() do
        let name = v.GetProperty("name").GetString()
        let input = v.GetProperty("input").GetString()
        let ok = v.GetProperty("ok").GetBoolean()

        match ZetaFsFormat.parse input with
        | Ok m when ok ->
            let check (key: string) (actual: string) =
                let mutable el = Unchecked.defaultof<JsonElement>

                if v.TryGetProperty(key, &el) then
                    Assert.Equal(el.GetString(), actual)

            check "ns" (nsName m.Ns)
            check "body" (bodyName m.Body)
            check "hash" (hashName m.Hash)
            check "chunker" (chunkerName m.Chunker)
            check "enc" (encName m.Enc)
            check "polyfill" (polyfillName m.Polyfill)

            let mutable majorEl = Unchecked.defaultof<JsonElement>

            if v.TryGetProperty("major", &majorEl) then
                Assert.Equal(2, majorEl.GetInt32())
        | Error e when not ok ->
            let expectedError = v.GetProperty("error").GetString()
            Assert.True(
                String.Equals(expectedError, ZetaFsFormat.errorName e, StringComparison.Ordinal),
                sprintf "%s: expected %s got %s (%s)" name expectedError (ZetaFsFormat.errorName e) (ZetaFsFormat.describe e)
            )
        | Ok _ -> Assert.Fail(sprintf "%s: expected refuse, parsed" name)
        | Error e -> Assert.Fail(sprintf "%s: expected parse, got %s" name (ZetaFsFormat.describe e))

[<Fact>]
let ``missing FORMAT is v1 implicit git-trees blob`` () =
    let fs = InMemoryFileSystem() :> IFileSystem
    match ZetaFsFormat.tryRead fs "/no-such-store" with
    | Error e -> Assert.Fail(ZetaFsFormat.describe e)
    | Ok m ->
        Assert.Equal(ZetaFsFormat.Major.V1Implicit, m.Major)
        Assert.Equal(ZetaFsFormat.Namespace.GitTrees, m.Ns)
        Assert.Equal(ZetaFsFormat.Body.Blob, m.Body)
        match ZetaFsFormat.requireGitTreesBlob m with
        | Ok _ -> ()
        | Error e -> Assert.Fail(ZetaFsFormat.describe e)

[<Fact>]
let ``PR6 reader accepts body=jumprope under git-trees`` () =
    let text = "zetafs/2\nns=git-trees\nbody=jumprope\nhash=blake3-256\n"

    match ZetaFsFormat.parse text with
    | Error e -> Assert.Fail(ZetaFsFormat.describe e)
    | Ok m ->
        Assert.Equal(ZetaFsFormat.Body.Jumprope, m.Body)
        match ZetaFsFormat.requireGitTrees m with
        | Ok accepted -> Assert.Equal(ZetaFsFormat.Body.Jumprope, accepted.Body)
        | Error e -> Assert.Fail(ZetaFsFormat.describe e)

[<Fact>]
let ``PR1 reader refuses ns=bindings even though FORMAT parses it`` () =
    let text = "zetafs/2\nns=bindings\nbody=blob\nhash=blake3-256\n"

    match ZetaFsFormat.parse text with
    | Error e -> Assert.Fail(ZetaFsFormat.describe e)
    | Ok m ->
        match ZetaFsFormat.requireGitTreesBlob m with
        | Ok _ -> Assert.Fail("git-trees polyfill must not open ns=bindings")
        | Error e -> Assert.Equal("ReaderDoesNotSupport", ZetaFsFormat.errorName e)

[<Fact>]
let ``init writes FORMAT on a new store and not on a v1 store`` () =
    let parent = tempParent ()

    try
        let dir = ZetaFsStore.init parent
        let formatPath = Path.Combine(dir, ZetaFsFormat.FileName)
        Assert.True(File.Exists formatPath)
        let body = File.ReadAllText formatPath
        Assert.Equal(ZetaFsFormat.render ZetaFsFormat.pr6Default, body)

        let v1Parent = tempParent ()

        try
            let v1Dir = Path.Combine(v1Parent, ZetaFsStore.DirName)
            Directory.CreateDirectory(Path.Combine(v1Dir, "objects")) |> ignore
            Directory.CreateDirectory(Path.Combine(v1Dir, "refs", "heads")) |> ignore
            File.WriteAllText(Path.Combine(v1Dir, "HEAD"), "ref: refs/heads/main")
            ZetaFsStore.init v1Parent |> ignore
            Assert.False(File.Exists(Path.Combine(v1Dir, ZetaFsFormat.FileName)))
            let log = ZetaFsStore.deltaLog v1Dir codec
            Assert.Equal(ZetaFsFormat.Major.V1Implicit, log.Format.Major)
        finally
            Directory.Delete(v1Parent, true)
    finally
        Directory.Delete(parent, true)

[<Fact>]
let ``deltaLog refuses a bindings FORMAT`` () =
    let parent = tempParent ()

    try
        let dir = ZetaFsStore.init parent
        File.WriteAllText(
            Path.Combine(dir, ZetaFsFormat.FileName),
            "zetafs/2\nns=bindings\nbody=blob\nhash=blake3-256\n"
        )

        let ex =
            Assert.Throws<InvalidOperationException>(fun () -> ZetaFsStore.deltaLog dir codec |> ignore)

        Assert.Contains("ns=bindings", ex.Message, StringComparison.Ordinal)
    finally
        Directory.Delete(parent, true)

[<Fact>]
let ``deltaLog append works on IFileSystem in-memory without a host directory`` () =
    let mock = InMemoryFileSystem()
    FileSystem.Register(mock)

    try
        let parent =
            Path.Combine(Path.GetTempPath(), sprintf "zetafs-mem-%s" (Guid.NewGuid().ToString("N")))

        let dir = ZetaFsStore.init parent
        Assert.False(Directory.Exists dir)
        Assert.True((FileSystem.Current).Exists(Path.Combine(dir, ZetaFsFormat.FileName)))

        let log = ZetaFsStore.deltaLog dir codec :> IDeltaLog<string>
        let seq = log.AppendAsync(ZSet.ofSeq [ "k", 1L ], Map.empty, CancellationToken.None).AsTask().Result
        Assert.Equal(1L, seq)
        let replayed = log.ReplayAsync(0L, CancellationToken.None).AsTask().Result
        Assert.Equal(1, replayed.Length)
        Assert.Equal(1L, replayed.[0].Delta.["k"])
    finally
        FileSystem.Reset()

[<Fact>]
let ``object filenames stay 32-hex MerkleHash handles under hash=blake3-256 FORMAT`` () =
    let parent = tempParent ()

    try
        let dir = ZetaFsStore.init parent
        let log = ZetaFsStore.deltaLog dir codec :> IDeltaLog<string>
        log.AppendAsync(ZSet.ofSeq [ "k", 1L ], Map.empty, CancellationToken.None).AsTask().Result
        |> ignore

        let objects = Directory.GetFiles(Path.Combine(dir, "objects"), "*", SearchOption.AllDirectories)
        let hexFiles =
            objects
            |> Array.filter (fun p ->
                let name = Path.GetFileName p
                let parentName = Directory.GetParent(p).Name
                parentName.Length = 2 && name.Length = 30)

        Assert.True(hexFiles.Length > 0, "expected fan-out objects/ab/ + 30 hex chars (128-bit handle)")
        Assert.Equal(ZetaFsFormat.HashAlg.Blake3_256, (ZetaFsStore.deltaLog dir codec).Format.Hash)
    finally
        Directory.Delete(parent, true)
