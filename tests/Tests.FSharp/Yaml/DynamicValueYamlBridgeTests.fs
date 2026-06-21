module Zeta.Tests.FSharp.Yaml.DynamicValueYamlBridgeTests

open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Yaml.Dom
open Zeta.Core.FSharp.Yaml.Encoder

// 081KT5CF90008QG0R001P4CQ09 format-agreement matrix — the YAML EDGE. The matrix needs all formats to
// agree on the COMMON value (DynamicValue). DynamicValue already round-trips through
// JSON + CBOR; this adds the bridge to YamlValue and proves DynamicValue → YAML →
// DynamicValue preserves (locked shapes). With JSON/CBOR/YAML all round-tripping the
// SAME DynamicValue, the formats commute on it.
//
// Bytes is excluded: YAML's text subset has no native byte type (would need a
// base64-string convention — deferred, like JSON's deferred Bytes/Float in 081KT5CF90008QG0R001P4CQ09).

let rec private dvToYaml (dv: DynamicValue) : YamlValue =
    match dv with
    | DynamicValue.Null -> VNull
    | DynamicValue.Bool b -> VBool b
    | DynamicValue.Int i -> VInt i
    | DynamicValue.Float f -> VFloat f
    | DynamicValue.String s -> VStr s
    | DynamicValue.Array xs -> VSeq(List.map dvToYaml xs)
    | DynamicValue.Object kvs -> VMap(List.map (fun (k, v) -> k, dvToYaml v) kvs)
    | DynamicValue.Bytes _ -> failwith "Bytes not representable in the YAML text subset (use CBOR for binary)"

let rec private yamlToDv (y: YamlValue) : DynamicValue =
    match y with
    | VNull -> DynamicValue.Null
    | VBool b -> DynamicValue.Bool b
    | VInt i -> DynamicValue.Int i
    | VFloat f -> DynamicValue.Float f
    | VStr s -> DynamicValue.String s
    | VSeq xs -> DynamicValue.Array(List.map yamlToDv xs)
    | VMap kvs -> DynamicValue.Object(List.map (fun (k, v) -> k, yamlToDv v) kvs)

let private dvRoundtripsYaml (dv: DynamicValue) : bool =
    match parse (encode (dvToYaml dv)) with
    | Ok y -> yamlToDv y = dv
    | Error _ -> false

[<Fact>]
let ``DynamicValue round-trips through YAML (locked shapes, compound) — the matrix YAML edge`` () =
    let cases =
        [ DynamicValue.Object [ "a", DynamicValue.Int 1L; "b", DynamicValue.String "x"
                                "n", DynamicValue.Null; "f", DynamicValue.Bool true ]
          DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.String "two"; DynamicValue.Bool false ]
          DynamicValue.Object [ "nested", DynamicValue.Object [ "deep", DynamicValue.Array [ DynamicValue.String "x" ] ] ]
          DynamicValue.Object [ "nums", DynamicValue.Array [ DynamicValue.Int 0L; DynamicValue.Int -5L ]
                                "flt", DynamicValue.Float 3.14 ]
          // ambiguous strings stay strings through YAML (not auto-resolved)
          DynamicValue.Object [ "looksInt", DynamicValue.String "123"; "looksBool", DynamicValue.String "true" ] ]
    for dv in cases do
        dvRoundtripsYaml dv |> should equal true

// The format-agreement MATRIX (value-tree formats): JSON, CBOR, and YAML all
// recover the SAME DynamicValue — i.e. all paths commute on the common value.
// Restricted to the locked shapes all three share (null/bool/int/string/array/
// object): JSON defers Float+Bytes, YAML has no Bytes, so the intersection is these.
let private jsonRoundtrips (dv: DynamicValue) : bool =
    match DynamicValue.toCanonicalJson dv with
    | Ok j ->
        match DynamicValue.fromCanonicalJson j with
        | Ok d -> d = dv
        | Error _ -> false
    | Error _ -> false

let private cborRoundtrips (dv: DynamicValue) : bool =
    match DynamicValue.fromCanonicalCbor (DynamicValue.toCanonicalCborOk dv) with
    | Ok d -> d = dv
    | Error _ -> false

let private xmlRoundtrips (dv: DynamicValue) : bool =
    match DynamicValue.toCanonicalXml dv with
    | Ok x ->
        match DynamicValue.fromCanonicalXml x with
        | Ok d -> d = dv
        | Error _ -> false
    | Error _ -> false

let private arrowRoundtrips (dv: DynamicValue) : bool =
    // Arrow is the columnar leg (shredded node-table); round-trip, not byte-lock
    // (Arrow IPC is not byte-identical across language libs — its rigor is
    // round-trip + cross-language semantic interop).
    match Zeta.Core.DynamicValueArrow.fromArrow (Zeta.Core.DynamicValueArrow.toArrowOk dv) with
    | Ok d -> d = dv
    | Error _ -> false

[<Fact>]
let ``format-agreement matrix: JSON + CBOR + YAML + XML + Arrow all commute on DynamicValue (locked shapes)`` () =
    let cases =
        [ DynamicValue.Object [ "a", DynamicValue.Int 1L; "b", DynamicValue.String "x"
                                "n", DynamicValue.Null; "f", DynamicValue.Bool true ]
          DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.String "two"; DynamicValue.Bool false ]
          DynamicValue.Object [ "nested", DynamicValue.Object [ "deep", DynamicValue.Array [ DynamicValue.String "x" ] ] ]
          DynamicValue.Object [ "looksInt", DynamicValue.String "123"; "looksBool", DynamicValue.String "true" ] ]
    for dv in cases do
        // each format round-trips dv to itself → all FIVE recover the SAME value (commute)
        jsonRoundtrips dv |> should equal true
        cborRoundtrips dv |> should equal true
        dvRoundtripsYaml dv |> should equal true
        xmlRoundtrips dv |> should equal true
        arrowRoundtrips dv |> should equal true

// ── PROPERTY-BASED matrix (FsCheck) — generalize the fixed cases above ──
// The YAML leg is the storage of record (081KT5CF90008QG0R001P4CQ09) but only had example-based tests
// while JSON/CBOR have the universal round-trip law (DynamicValue.Canonical.Tests).
// These close that gap: FsCheck generates arbitrary trees over the matrix's LOCKED
// SUBSET — null/bool/int/string/array/object (the intersection all three share;
// JSON defers Float+Bytes, YAML has no Bytes) — and proves YAML round-trip + the
// full three-format commute over that subset, not just hand-picked shapes.
//
// Generated values are wrapped as a single-key MAP ({"v": dv}) so every case is a
// valid top-level document for all three codecs (the YAML parser rejects bare scalar
// documents — the real storage case is always a value inside a map/seq anyway).

let private genCharY = Gen.elements [ 'a'; 'Z'; '0'; '"'; '\\'; '\n'; '\t'; '/'; ' '; 'é'; '☃' ]

let private genStrY =
    gen { let! n = Gen.choose (0, 6)
          let! cs = Gen.listOfLength n genCharY
          return System.String(List.toArray cs) }

let private genInt64Y =
    Gen.oneof
        [ Gen.choose (-100000, 100000) |> Gen.map int64
          Gen.elements [ 0L; 1L; -1L; System.Int64.MaxValue; System.Int64.MinValue ] ]

// the matrix's locked subset (no Float/Bytes — JSON defers them, YAML has no Bytes)
let private matrixLeaf =
    Gen.oneof
        [ Gen.constant DynamicValue.Null
          Gen.map DynamicValue.Bool (Gen.elements [ true; false ])
          Gen.map DynamicValue.Int genInt64Y
          Gen.map DynamicValue.String genStrY ]

// Collections are generated INCLUDING EMPTY (n ≥ 0): 081KT7YW00008QG0R002T1XNWT landed flow `{}` / `[]`
// across all four languages, so empty Object/Array now round-trip distinct from null
// (never-collapse). The round-trip LAW therefore covers the full domain, empties
// included; the explicit never-collapse fact below proves the empty case directly.
let private buildMatrix : Gen<DynamicValue> =
    let rec aux (size: int) : Gen<DynamicValue> =
        if size <= 0 then
            matrixLeaf
        else
            Gen.oneof
                [ matrixLeaf
                  gen { let! n = Gen.choose (0, 3)
                        let! items = Gen.listOfLength n (aux (size / 2))
                        return DynamicValue.Array items }
                  gen { let! n = Gen.choose (0, 3)
                        let! rawKeys = Gen.listOfLength n genStrY
                        // Object is order-significant with UNIQUE keys.
                        let keys = List.distinct rawKeys
                        let! vals = Gen.listOfLength keys.Length (aux (size / 2))
                        return DynamicValue.Object(List.zip keys vals) } ]
    Gen.sized aux

type MatrixDvArb() =
    static member Dv() = Arb.fromGen buildMatrix

[<Property(Arbitrary = [| typeof<MatrixDvArb> |])>]
let ``YAML round-trip LAW: ∀ dv (locked subset) — parse ∘ encode = id (storage of record)``
    (v: DynamicValue) =
    dvRoundtripsYaml (DynamicValue.Object [ "v", v ])

[<Property(Arbitrary = [| typeof<MatrixDvArb> |])>]
let ``format-agreement matrix LAW: ∀ dv (locked subset) — JSON + CBOR + YAML + XML + Arrow all commute``
    (v: DynamicValue) =
    let wrapped = DynamicValue.Object [ "v", v ]
    jsonRoundtrips wrapped && cborRoundtrips wrapped && dvRoundtripsYaml wrapped && xmlRoundtrips wrapped
    && arrowRoundtrips wrapped

// XML round-trip LAW + injectivity (parity with the CBOR / YAML laws). The matrix
// subset's generated strings (genStrY) contain only XML-1.0-representable chars (no
// NUL / forbidden C0), so the law holds on the full subset INCLUDING empties — XML's
// typed elements make empty {} <arr></arr> / <obj></obj> / null distinct by
// construction (never-collapse free; 081KT7YW00008QG0R002T1XNWT's invariant, native to XML).
[<Property(Arbitrary = [| typeof<MatrixDvArb> |])>]
let ``XML round-trip LAW: ∀ dv (locked subset) — fromCanonicalXml ∘ toCanonicalXml = id``
    (v: DynamicValue) =
    xmlRoundtrips (DynamicValue.Object [ "v", v ])

[<Property(Arbitrary = [| typeof<MatrixDvArb> |])>]
let ``XML never-collapse: canonical encoding is INJECTIVE on the locked subset (distinct values never share bytes)``
    (a: DynamicValue) (b: DynamicValue) =
    // corollary of round-trip, stated directly (parity with the CBOR/YAML injectivity).
    match DynamicValue.toCanonicalXml (DynamicValue.Object [ "v", a ]),
          DynamicValue.toCanonicalXml (DynamicValue.Object [ "v", b ]) with
    | Ok xa, Ok xb -> (xa = xb) = (a = b)
    | _ -> false

// never-collapse stated DIRECTLY for YAML — parity with the proven CBOR injectivity
// (`canonical CBOR encoding is INJECTIVE`). YAML is the STORAGE OF RECORD, so its
// byte-lock is only a FAITHFUL identity if distinct values never share canonical
// bytes. Formally a corollary of the round-trip LAW above (parse ∘ encode = id ⇒
// encode injective), made explicit because never-collapse is the load-bearing
// requirement (081KT7YW00008QG0R002T1XNWT is the empty-collection case that currently violates it; this
// proves it holds on the non-empty locked subset).
[<Property(Arbitrary = [| typeof<MatrixDvArb> |])>]
let ``YAML never-collapse: canonical encoding is INJECTIVE on the locked subset (distinct values never share bytes)``
    (a: DynamicValue) (b: DynamicValue) =
    // Tested as map VALUES (the storage domain), matching the round-trip LAW. A
    // top-level BARE empty `{}` / `[]` both render to a bare document (the reader
    // rejects bare-scalar/bare-empty top-level documents — the same pre-existing
    // top-level-bare-document gap noted in EncoderRoundTripTests, orthogonal to
    // 081KT7YW00008QG0R002T1XNWT which is about empties as VALUES). Wrapping isolates injectivity to the
    // real storage case, where empty `{}` / `[]` / null are three distinct bytes.
    let wa = DynamicValue.Object [ "v", a ]
    let wb = DynamicValue.Object [ "v", b ]
    (encode (dvToYaml wa) = encode (dvToYaml wb)) = (wa = wb)

// never-collapse (081KT7YW00008QG0R002T1XNWT, LANDED) — serialization must NEVER collapse two states
// that are actually different (SQL-null-as-monad-propagator; tri-boolean everywhere;
// `Some [] ≠ None`): empty `[]`, empty `{}`, and `null` are THREE distinct states and
// round-trip distinctly — canonical encode is INJECTIVE (parity with CBOR; JSON+CBOR
// goldens carry array-empty/object-empty). 081KT7YW00008QG0R002T1XNWT landed canonical YAML flow `{}` /
// `[]` across all four oracles (TS reference + F#/Rust/C# ports + cross-verify), so
// block YAML no longer collapses empties to a bare `"key":` → null. This proves it.
[<Fact>]
let ``never-collapse (081KT7YW00008QG0R002T1XNWT): empty {} and [] round-trip DISTINCT from null and from each other`` () =
    let rt (dv: DynamicValue) =
        match parse (encode (dvToYaml dv)) with
        | Ok y -> Some(yamlToDv y)
        | Error _ -> None
    let emptyObj = DynamicValue.Object [ "v", DynamicValue.Object [] ]
    let emptyArr = DynamicValue.Object [ "v", DynamicValue.Array [] ]
    let isNull = DynamicValue.Object [ "v", DynamicValue.Null ]
    // each round-trips to ITSELF (never collapsing to null or to each other)
    rt emptyObj |> should equal (Some emptyObj)
    rt emptyArr |> should equal (Some emptyArr)
    rt isNull |> should equal (Some isNull)