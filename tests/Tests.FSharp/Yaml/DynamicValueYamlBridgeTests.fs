module Zeta.Tests.FSharp.Yaml.DynamicValueYamlBridgeTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Yaml.Dom
open Zeta.Core.FSharp.Yaml.Encoder

// B-1011 format-agreement matrix — the YAML EDGE. The matrix needs all formats to
// agree on the COMMON value (DynamicValue). DynamicValue already round-trips through
// JSON + CBOR; this adds the bridge to YamlValue and proves DynamicValue → YAML →
// DynamicValue preserves (locked shapes). With JSON/CBOR/YAML all round-tripping the
// SAME DynamicValue, the formats commute on it.
//
// Bytes is excluded: YAML's text subset has no native byte type (would need a
// base64-string convention — deferred, like JSON's deferred Bytes/Float in B-1011).

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
    match DynamicValue.fromCanonicalCbor (DynamicValue.toCanonicalCbor dv) with
    | Ok d -> d = dv
    | Error _ -> false

[<Fact>]
let ``format-agreement matrix: JSON + CBOR + YAML all commute on DynamicValue (locked shapes)`` () =
    let cases =
        [ DynamicValue.Object [ "a", DynamicValue.Int 1L; "b", DynamicValue.String "x"
                                "n", DynamicValue.Null; "f", DynamicValue.Bool true ]
          DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.String "two"; DynamicValue.Bool false ]
          DynamicValue.Object [ "nested", DynamicValue.Object [ "deep", DynamicValue.Array [ DynamicValue.String "x" ] ] ]
          DynamicValue.Object [ "looksInt", DynamicValue.String "123"; "looksBool", DynamicValue.String "true" ] ]
    for dv in cases do
        // each format round-trips dv to itself → all three recover the SAME value (commute)
        jsonRoundtrips dv |> should equal true
        cborRoundtrips dv |> should equal true
        dvRoundtripsYaml dv |> should equal true