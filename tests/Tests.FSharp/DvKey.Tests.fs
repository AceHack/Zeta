module Zeta.Tests.DvKeyTests

open global.Xunit
open Zeta.Core
open System
open System.IO
open System.Text.Json
open System.Globalization
open System.Collections.Immutable

module CDC = Zeta.Core.DebeziumCdc

type private Marker = class end

let private repoRoot () : string =
    let assembly = typeof<Marker>.Assembly
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        raise (InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location."))
    dir.FullName

let rec private buildValue (el: JsonElement) : DynamicValue =
    let tag = el.GetProperty("t").GetString()
    match tag with
    | "null" -> DynamicValue.Null
    | "bool" -> DynamicValue.Bool(el.GetProperty("v").GetBoolean())
    | "int" -> DynamicValue.Int(int64 (el.GetProperty("v").GetString()))
    | "float" ->
        let bits = UInt64.Parse(el.GetProperty("v").GetString(), NumberStyles.HexNumber, CultureInfo.InvariantCulture)
        DynamicValue.Float(BitConverter.UInt64BitsToDouble(bits))
    | "str" -> DynamicValue.String(el.GetProperty("v").GetString())
    | "bytes" ->
        let hexStr = el.GetProperty("v").GetString()
        DynamicValue.Bytes(ImmutableArray.Create<byte>(Convert.FromHexString(hexStr)))
    | "arr" ->
        let arr = el.GetProperty("v").EnumerateArray() |> Seq.map buildValue |> Seq.toList
        DynamicValue.Array(arr)
    | "obj" ->
        let obj =
            el.GetProperty("v").EnumerateArray()
            |> Seq.map (fun pair ->
                let parts = pair.EnumerateArray() |> Seq.toArray
                parts.[0].GetString(), buildValue parts.[1]
            )
            |> Seq.toList
        DynamicValue.Object(obj)
    | _ -> failwithf "unsupported tag: %s" tag

let private row (kvs: (string * DynamicValue) list) = DvKey.ofValue (DynamicValue.Object kvs)

[<Fact>]
let ``equal DynamicValue rows give equal keys; distinct give distinct keys`` () =
    let a = row [ "id", DynamicValue.Int 1L; "name", DynamicValue.String "x" ]
    let a2 = row [ "id", DynamicValue.Int 1L; "name", DynamicValue.String "x" ]
    let b = row [ "id", DynamicValue.Int 2L; "name", DynamicValue.String "x" ]
    Assert.Equal<DvKey>(a, a2)
    Assert.Equal(a.GetHashCode(), a2.GetHashCode())
    Assert.NotEqual<DvKey>(a, b)

[<Fact>]
let ``DvKey rows work as ZSet keys (DynamicValue rows in a Z-set)`` () =
    let z = ZSet.ofSeq [ row [ "id", DynamicValue.Int 1L ], 1L; row [ "id", DynamicValue.Int 2L ], 1L ]
    Assert.Equal(2, z.Count)
    Assert.Equal(1L, ZSet.lookup (row [ "id", DynamicValue.Int 1L ]) z)

[<Fact>]
let ``Debezium change events over DynamicValue rows convert to Z-set deltas (end-to-end)`` () =
    let before = row [ "id", DynamicValue.Int 1L; "v", DynamicValue.String "old" ]
    let after = row [ "id", DynamicValue.Int 1L; "v", DynamicValue.String "new" ]
    // an update of a DynamicValue row = retract old + insert new
    Assert.Equal<ZSet<DvKey>>(ZSet.ofSeq [ before, -1L; after, 1L ], CDC.toZSetDelta (CDC.update before after))
    // and the delta round-trips at the delta level
    let delta = CDC.toZSetDelta (CDC.create after)
    let rt = CDC.ofZSetDelta delta |> List.map CDC.toZSetDelta |> List.fold (+) ZSet.Empty
    Assert.Equal<ZSet<DvKey>>(delta, rt)

[<Fact>]
let ``CrossVerifyDvKeyVectorsMatchExpected`` () =
    let root = repoRoot ()
    let jsonPath = Path.Combine(root, "tests", "cross-verification", "dv-key-cloud-events", "vectors.json")
    Assert.True(File.Exists(jsonPath), sprintf "vectors.json not found: %s" jsonPath)

    use doc = JsonDocument.Parse(File.ReadAllText(jsonPath))
    let vectors = doc.RootElement.GetProperty("dv_key_vectors").EnumerateArray()

    for v in vectors do
        let expectedCborHex = v.GetProperty("expected_cbor_hex").GetString()
        let expectedHash = v.GetProperty("expected_hash").GetString()
        let valEl = v.GetProperty("value")
        let value = buildValue valEl

        let key = DvKey.ofValue value
        let actualCborHex = Convert.ToHexString(DvKey.canonical key).ToLowerInvariant()
        let actualHash = string (key.GetHashCode())

        Assert.Equal(expectedCborHex, actualCborHex)
        Assert.Equal(expectedHash, actualHash)
