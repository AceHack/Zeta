module Zeta.Tests.ZetaFsJumpropeTests

open System
open System.IO
open System.Text
open System.Text.Json
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
    Path.Join(repoRoot (), "tests", "Tests.FSharp", "testdata", "zetafs-jumprope-golden-vectors.json")

/// FORCE the static constructor, do not merely touch the property.
///
/// `ContentHash256.ofBytesHook` is a MUTABLE GLOBAL installed as a SIDE EFFECT of
/// `OwnBlake3Hasher`'s static constructor, so every test that hashes depends on that
/// constructor having already run. This function was `ignore OwnBlake3Hasher.hasher`,
/// which only forces it INCIDENTALLY: a property read whose result is discarded is
/// exactly the shape an optimising Release build may elide, and nothing in the language
/// promises the cctor for a read that got optimised away.
///
/// The two other test files that need the same hook already knew this and both call
/// `RunClassConstructor` -- `ContentHash256.Tests.fs` and `Blake3/CrossVerifyTests.fs`.
/// This file was the odd one out and passed on ordering luck: some earlier test in the
/// assembly happened to initialise the hook first.
///
/// MEASURED 2026-09-01: 9 of the 11 tests in this class fail locally with
/// "ContentHash256.ofBytes hook is not initialized", on stock main, with no edit of
/// mine -- and `build-and-test (ubuntu-24.04)` went red on a PR that only made ONE test
/// in this file slower. Nothing about that change touched hashing; it changed timing.
/// A test that depends on which test ran first is not testing what it claims.
let private ensureHasher () =
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof<OwnBlake3Hasher>.TypeHandle)

let private mustOk (r: Result<'a, ZetaFsJumprope.JumpropeError>) : 'a =
    match r with
    | Ok v -> v
    | Error e ->
        Assert.Fail(sprintf "%s" (ZetaFsJumprope.errorName e))
        Unchecked.defaultof<'a>

[<Fact>]
let ``empty file is a single-leaf Jumprope and round-trips`` () =
    ensureHasher ()
    let rope = ZetaFsJumprope.buildV1 Array.empty
    Assert.Equal(0UL, rope.Span)
    Assert.Equal(1, rope.Leaves.Length)
    let got = mustOk (ZetaFsJumprope.materialize rope)
    Assert.Equal<byte>(Array.empty, got)

[<Fact>]
let ``small file below min-chunk is one leaf`` () =
    ensureHasher ()
    let bytes = Encoding.UTF8.GetBytes "hello jumprope"
    let rope = ZetaFsJumprope.buildV1 bytes
    Assert.Equal(uint64 bytes.Length, rope.Span)
    Assert.Equal(1, rope.Leaves.Length)
    let got = mustOk (ZetaFsJumprope.materialize rope)
    Assert.Equal<byte>(bytes, got)

[<Fact>]
let ``thirty-two 1-byte Jumpropes do not pay FastCDC max-chunk buffers`` () =
    ensureHasher ()
    let before = GC.GetAllocatedBytesForCurrentThread()

    for i in 1 .. 32 do
        let rope = ZetaFsJumprope.buildV1 [| byte i |]
        Assert.Equal(1, rope.Leaves.Length)

    let n = GC.GetAllocatedBytesForCurrentThread() - before
    Assert.True(n < 1L * 1024L * 1024L, sprintf "32 one-byte Jumpropes allocated %d bytes" n)

[<Fact>]
let ``multi-chunk file round-trips and seek hits the right byte`` () =
    ensureHasher ()
    let bytes = Array.init 200_000 (fun i -> byte (i % 251))
    let rope = ZetaFsJumprope.buildV1 bytes
    Assert.True(rope.Leaves.Length > 1, sprintf "expected several FastCDC chunks, got %d" rope.Leaves.Length)
    Assert.Equal(uint64 bytes.Length, rope.Span)
    let got = mustOk (ZetaFsJumprope.materialize rope)
    Assert.Equal<byte>(bytes, got)

    for off in [| 0; 1; 2047; 2048; 8192; 50_000; 199_999 |] do
        let hit = mustOk (ZetaFsJumprope.seek rope (uint64 off))
        Assert.Equal(bytes.[off], hit.Payload.Span.[int hit.OffsetInChunk])
        let viaTrunk = mustOk (ZetaFsJumprope.seekEncoded rope (uint64 off))
        Assert.Equal(hit.Chunk.ToHex(), viaTrunk.Chunk.ToHex())
        Assert.Equal(hit.OffsetInChunk, viaTrunk.OffsetInChunk)

[<Fact>]
// TWO FILES, NOT ONE FILE TWICE. This test's name is the claim -- IDENTICAL FILES
// share chunk ids -- and content-addressing is the property that makes it true: equal
// bytes must produce equal ids no matter which array object carries them.
//
// It previously passed the SAME array to both calls, so both sides normalised to one
// expression and it asserted `f(x) = f(x)`. That is strictly weaker than its name: it
// could only ever have caught NONDETERMINISM (an ambient seed or clock inside
// `buildV1`), and would have passed unchanged against an implementation that keyed on
// array identity or memoised per object -- which is precisely the bug that would break
// dedup across two genuinely distinct files.
//
// `Array.copy` is what closes that gap: a separate allocation with equal contents, so
// the assertion now tests the claim its name makes. Caught by `audit-check-arity` R2
// on 2026-09-01 (main went red on f83701a62); strengthened rather than adjudicated,
// because `--accept-raises` would have recorded "the two executions really do differ"
// and that was not true of the original -- both sides read one array.
let ``identical files share every chunk ContentId`` () =
    ensureHasher ()
    let bytes = Array.init 90_000 (fun i -> byte (i % 199))
    let sameBytesDistinctArray = Array.copy bytes
    Assert.False(obj.ReferenceEquals(bytes, sameBytesDistinctArray), "the two inputs must be distinct objects, or this is one file twice")
    Assert.Equal<byte>(bytes, sameBytesDistinctArray)
    let a = ZetaFsJumprope.buildV1 bytes
    let b = ZetaFsJumprope.buildV1 sameBytesDistinctArray
    Assert.Equal(a.Content.ToHex(), b.Content.ToHex())
    let idsA = a.Leaves |> Array.map (fun (id, _) -> id.ToHex())
    let idsB = b.Leaves |> Array.map (fun (id, _) -> id.ToHex())
    Assert.Equal<string>(idsA, idsB)

[<Fact>]
let ``two files with a shared prefix share prefix chunk ids`` () =
    ensureHasher ()
    let prefix = Array.init 80_000 (fun i -> byte (i % 223))
    let a = Array.append prefix [| 1uy; 2uy; 3uy |]
    let b = Array.append prefix [| 9uy; 8uy; 7uy |]
    let ra = ZetaFsJumprope.buildV1 a
    let rb = ZetaFsJumprope.buildV1 b
    Assert.True(ra.Leaves.Length > 1)
    Assert.True(rb.Leaves.Length > 1)
    let firstA, _ = ra.Leaves.[0]
    let firstB, _ = rb.Leaves.[0]
    Assert.Equal(firstA.ToHex(), firstB.ToHex())
    Assert.NotEqual<string>(ra.Content.ToHex(), rb.Content.ToHex())

[<Fact>]
let ``coverage offsets are cumulative and match leaf spans`` () =
    ensureHasher ()
    let bytes = Array.init 40_000 (fun i -> byte i)
    let rope = ZetaFsJumprope.buildV1 bytes
    let cov = ZetaFsJumprope.asCoverage rope
    Assert.Equal(rope.Leaves.Length, cov.Length)
    Assert.Equal(0UL, fst cov.[0])
    let mutable off = 0UL

    for i in 0 .. rope.Leaves.Length - 1 do
        let chunk, len = rope.Leaves.[i]
        Assert.Equal(off, fst cov.[i])
        Assert.Equal(chunk.ToHex(), (snd cov.[i]).ToHex())
        off <- off + len

    Assert.Equal(rope.Span, off)

[<Fact>]
let ``seek past end is OffsetOutOfRange`` () =
    ensureHasher ()
    let rope = ZetaFsJumprope.buildV1 [| 1uy; 2uy; 3uy |]
    match ZetaFsJumprope.seek rope rope.Span with
    | Error e -> Assert.Equal("OffsetOutOfRange", ZetaFsJumprope.errorName e)
    | Ok _ -> Assert.Fail("seek at span must fail")

[<Fact>]
let ``unknown major tag is refused`` () =
    ensureHasher ()
    let dv =
        DynamicValue.Object [ "t", DynamicValue.String "delta/1"; "x", DynamicValue.Int 1L ]
    let bytes = DynamicValue.toCanonicalCborOk dv

    match ZetaFsJumprope.decodeObject bytes with
    | Error e -> Assert.Equal("UnknownTag", ZetaFsJumprope.errorName e)
    | Ok _ -> Assert.Fail("delta/1 must be refused")

[<Fact>]
let ``one-byte edit remaps the trunk and reuses most chunk ContentIds`` () =
    // D9 / ReFS-shaped: a small overwrite is a pointer update (new trunk +
    // the mutated FastCDC chunks), not a second copy of the file. FastCDC
    // can shift a neighbour boundary, so the bound is "not 2× leaves", not
    // "exactly one new chunk".
    ensureHasher ()
    let before = Array.init 500_000 (fun i -> byte (i % 251))
    let after = Array.copy before
    after.[250_000] <- after.[250_000] ^^^ 1uy
    let ra = ZetaFsJumprope.buildV1 before
    let rb = ZetaFsJumprope.buildV1 after
    Assert.True(ra.Leaves.Length > 6, sprintf "need several chunks, got %d" ra.Leaves.Length)
    Assert.NotEqual<string>(ra.Content.ToHex(), rb.Content.ToHex())
    let ids (r: ZetaFsJumprope.Rope) =
        r.Leaves |> Array.map (fun (id, _) -> id.ToHex()) |> Set.ofArray

    let shared = Set.intersect (ids ra) (ids rb)
    Assert.True(
        shared.Count >= ra.Leaves.Length - 3,
        sprintf "shared %d of %d leaves — a 1-byte edit copied too much of the file" shared.Count ra.Leaves.Length
    )
    let combined = Set.union (ids ra) (ids rb)
    Assert.True(
        combined.Count < 2 * ra.Leaves.Length,
        sprintf "union %d vs 2× %d — bit-copy, not pointer-not-copy" combined.Count ra.Leaves.Length
    )


[<Fact>]
let ``pread copies into a caller buffer without a full materialize`` () =
    ensureHasher ()
    let bytes = Array.init 50_000 (fun i -> byte (i % 251))
    let rope = ZetaFsJumprope.buildV1 bytes
    let dst = Array.zeroCreate 100
    match ZetaFsJumprope.pread rope 10_000UL (System.Memory<byte>.op_Implicit dst) with
    | Error e -> Assert.Fail(ZetaFsJumprope.errorName e)
    | Ok n ->
        Assert.Equal(100, n)
        Assert.Equal<byte>(bytes.[10_000 .. 10_099], dst)

[<Fact>]
let ``dump jumprope goldens when ZETA_DUMP_JUMPROPE=1`` () =
    ensureHasher ()

    if not (String.Equals(Environment.GetEnvironmentVariable("ZETA_DUMP_JUMPROPE"), "1", StringComparison.Ordinal)) then
        ()
    else
        let cases =
            [ "empty", Array.empty
              "hello", Encoding.UTF8.GetBytes "hello jumprope"
              "zeros-64", Array.zeroCreate 64 ]

        let sb = StringBuilder()
        sb.AppendLine("{") |> ignore
        sb.AppendLine("  \"description\": \"ZetaFS Jumprope encodings (PR6). hex-in-JSON. ContentId is BLAKE3-256 of the canonical rope-trunk/1 object. FastCdc.v1. Seek does not ToArray payloads.\",") |> ignore
        sb.AppendLine("  \"chunker\": \"fastcdc-v1\",") |> ignore
        sb.AppendLine("  \"cases\": [") |> ignore
        let last = cases.Length - 1

        cases
        |> List.iteri (fun i (name, bytes) ->
            let rope = ZetaFsJumprope.buildV1 bytes
            let trunk =
                match ZetaFsJumprope.tryGet rope.Cas rope.Content with
                | Some t -> Convert.ToHexString(t).ToLowerInvariant()
                | None -> ""

            sb.AppendLine("    {") |> ignore
            sb.Append("      \"name\": \"").Append(name).AppendLine("\",") |> ignore
            sb.Append("      \"inputHex\": \"").Append(Convert.ToHexString(bytes).ToLowerInvariant()).AppendLine("\",") |> ignore
            sb.Append("      \"contentId\": \"").Append(rope.Content.ToHex()).AppendLine("\",") |> ignore
            sb.Append("      \"span\": ").Append(rope.Span.ToString(Globalization.CultureInfo.InvariantCulture)).AppendLine(",") |> ignore
            sb.Append("      \"leafCount\": ").Append(rope.Leaves.Length.ToString(Globalization.CultureInfo.InvariantCulture)).AppendLine(",") |> ignore
            sb.Append("      \"trunkHex\": \"").Append(trunk).AppendLine("\"") |> ignore
            if i = last then sb.AppendLine("    }") |> ignore
            else sb.AppendLine("    },") |> ignore)

        sb.AppendLine("  ]") |> ignore
        sb.AppendLine("}") |> ignore
        File.WriteAllText(goldenPath (), sb.ToString())
        Assert.True(File.Exists(goldenPath ()))

[<Fact>]
let ``golden vectors lock empty and small encodings`` () =
    ensureHasher ()
    let path = goldenPath ()
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)

    for v in doc.RootElement.GetProperty("cases").EnumerateArray() do
        let name = v.GetProperty("name").GetString()
        let inputHex = v.GetProperty("inputHex").GetString()
        let input =
            if String.IsNullOrEmpty inputHex then
                Array.empty
            else
                Convert.FromHexString inputHex

        let rope = ZetaFsJumprope.buildV1 input
        let contentId = v.GetProperty("contentId").GetString()
        Assert.True(
            String.Equals(contentId, rope.Content.ToHex(), StringComparison.Ordinal),
            sprintf "%s: contentId expected %s got %s" name contentId (rope.Content.ToHex())
        )
        Assert.Equal(uint64 (v.GetProperty("span").GetInt64()), rope.Span)
        Assert.Equal(v.GetProperty("leafCount").GetInt32(), rope.Leaves.Length)
        let trunkHex = v.GetProperty("trunkHex").GetString()
        match ZetaFsJumprope.tryGet rope.Cas rope.Content with
        | None -> Assert.Fail(sprintf "%s: missing trunk" name)
        | Some trunk ->
            Assert.True(
                String.Equals(trunkHex, Convert.ToHexString(trunk).ToLowerInvariant(), StringComparison.Ordinal),
                sprintf "%s: trunk encoding drifted" name
            )
