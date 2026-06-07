module Zeta.Tests.ZSetMerkleTests

open System
open System.IO
open System.Text
open System.Text.Json
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// Canonical Merkle-over-Z-set (081KTGTJC1Q) — the math leg. The root must be a pure function of the NET
// Z-set state (retraction-native), order-independent (canonical), and hash-parameterized. The universal
// properties use INT keys: int is a clean total order, so ZSet.ofSeq is order-independent on it. (String
// keys go through ZSet's culture-SENSITIVE Comparer<'K>.Default sort — the live B-0969 class — where
// forward-vs-reverse ofSeq of culture-colliding strings yields genuinely DIFFERENT net Z-sets; the Merkle
// then correctly gives different roots. Cross-language STRING byte-lock is a golden-vector concern, not a
// property of this module — see the xUnit anchors for the UTF-8 string encoding.)
let private enc (s: string) : byte[] = Encoding.UTF8.GetBytes s

let private encI (i: int) : byte[] =
    let b = Array.zeroCreate<byte> 4
    System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(Span<byte> b, i)
    b

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

// Weights are bounded to a non-overflowing range: with duplicate keys, ZSet.ofSeq SUMS weights, and int64
// summation overflows order-dependently — an arithmetic-overflow concern of ofSeq, not of the Merkle root
// (which faithfully reflects whatever net Z-set it is handed). Bounding keeps the properties on their
// honest domain.
let private boundW (w: int64) : int64 = w % 1_000_000L

let private zsetOf (pairs: (int * int64) list) : ZSet<int> =
    pairs |> List.map (fun (k, w) -> k, boundW w) |> ZSet.ofSeq

// --- universal properties (FsCheck) ---

[<Property>]
let ``root is order-independent: equal net Z-sets => equal roots`` (pairs: (int * int64) list) =
    let z1 = zsetOf pairs
    let z2 = zsetOf (List.rev pairs)
    ZSetMerkle.root encI z1 = ZSetMerkle.root encI z2

[<Property>]
let ``retraction is a no-op on the root: +w then -w cancels`` (pairs: (int * int64) list) (k: int) (w: int64) =
    let wb = boundW w

    (wb <> 0L)
    ==> lazy
        (let z = zsetOf pairs
         let z' = z + ZSet.singleton k wb + ZSet.singleton k (-wb)
         ZSetMerkle.root encI z = ZSetMerkle.root encI z')

[<Property>]
let ``root is deterministic across repeated computation`` (pairs: (int * int64) list) =
    let z = zsetOf pairs
    ZSetMerkle.root encI z = ZSetMerkle.root encI z

[<Property>]
let ``default root equals rootWith the XxHash128 digest`` (pairs: (int * int64) list) =
    let z = zsetOf pairs
    let xx (b: byte[]) = MerkleHash.ofBytes (ReadOnlySpan<byte> b)
    ZSetMerkle.root encI z = ZSetMerkle.rootWith xx encI z

// --- anchors (xUnit) ---

[<Fact>]
let ``empty root is deterministic and distinct from a singleton`` () =
    let empty = ZSet<string>.Empty
    Assert.Equal(ZSetMerkle.root enc empty, ZSetMerkle.root enc empty)
    Assert.NotEqual(ZSetMerkle.root enc empty, ZSetMerkle.root enc (ZSet.ofSeq [ "a", 1L ]))

[<Fact>]
let ``distinct content yields distinct roots (key and weight sensitivity)`` () =
    let r kvs = ZSetMerkle.root enc (ZSet.ofSeq kvs)
    Assert.NotEqual(r [ "a", 1L ], r [ "a", 2L ]) // weight matters
    Assert.NotEqual(r [ "a", 1L ], r [ "b", 1L ]) // key matters
    Assert.NotEqual(r [ "a", 1L ], r [ "a", 1L; "b", 1L ]) // support matters

[<Fact>]
let ``a different digest yields a different root for non-empty input`` () =
    let z = ZSet.ofSeq [ "a", 1L; "b", 2L ]
    // alternate digest: swap hi/lo of the default — a genuinely different hash function
    let alt (b: byte[]) =
        let h = MerkleHash.ofBytes(ReadOnlySpan<byte> b)
        MerkleHash(h.Lo, h.Hi)
    Assert.NotEqual(ZSetMerkle.root enc z, ZSetMerkle.rootWith alt enc z)

[<Fact>]
let ``Golden treaty: F# reproduces shared ZSetMerkle roots`` () =
    let path = Path.Join(repoRoot (), "src", "Core.TypeScript", "z-set-merkle", "golden-vectors.json")
    Assert.True(File.Exists path, sprintf "seed not found: %s" path)

    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = doc.RootElement.GetProperty("vectors").EnumerateArray() |> Seq.toArray
    Assert.True(vectors.Length >= 6, "expected at least 6 golden vectors")

    for v in vectors do
        let name = v.GetProperty("name").GetString()
        let expectedRoot = v.GetProperty("root").GetString()
        let entries =
            [ for entry in v.GetProperty("entries").EnumerateArray() ->
                entry.GetProperty("key").GetString(), entry.GetProperty("weight").GetInt64() ]

        let actualRoot = (ZSetMerkle.root enc (ZSet.ofSeq entries)).ToHex()
        Assert.Equal(expectedRoot, actualRoot)

    let byName =
        vectors
        |> Array.map (fun v -> v.GetProperty("name").GetString(), v.GetProperty("root").GetString())
        |> Map.ofArray

    Assert.Equal(byName.["order-independence-forward"], byName.["order-independence-reverse"])
