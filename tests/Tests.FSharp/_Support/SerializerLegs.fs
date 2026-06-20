module Zeta.Tests.Support.SerializerLegs

// Reusable proof-leg helpers for the PROVEN-CORE-MAP full-verticals: round-trip a
// primitive's canonical DynamicValue through each serializer leg (4-ser + Arrow). Each
// primitive's full-vertical test bridges its value ↔ DynamicValue, then uses these to
// prove the 4-ser + Arrow legs (JSON/CBOR/YAML/XML/Arrow all recover the same value).
// G-Set was the first FULL-PROVEN primitive (its test inlined these); this factors them
// so clock/identity/serialization-seed/… reuse one implementation.

open Zeta.Core
open Zeta.Core.FSharp.Yaml.Dom
open Zeta.Core.FSharp.Yaml.Encoder

// DynamicValue ↔ YamlValue over the locked value-tree subset (Bytes excluded — not in
// YAML's text subset; CBOR/Arrow carry Bytes).
let rec private dvToYaml (dv: DynamicValue) : YamlValue =
    match dv with
    | DynamicValue.Null -> VNull
    | DynamicValue.Bool b -> VBool b
    | DynamicValue.Int i -> VInt i
    | DynamicValue.Float f -> VFloat f
    | DynamicValue.String s -> VStr s
    | DynamicValue.Array xs -> VSeq(List.map dvToYaml xs)
    | DynamicValue.Object kvs -> VMap(List.map (fun (k, v) -> k, dvToYaml v) kvs)
    | DynamicValue.Bytes _ -> failwith "Bytes is not in the YAML text subset"

let rec private yamlToDv (y: YamlValue) : DynamicValue =
    match y with
    | VNull -> DynamicValue.Null
    | VBool b -> DynamicValue.Bool b
    | VInt i -> DynamicValue.Int i
    | VFloat f -> DynamicValue.Float f
    | VStr s -> DynamicValue.String s
    | VSeq xs -> DynamicValue.Array(List.map yamlToDv xs)
    | VMap kvs -> DynamicValue.Object(List.map (fun (k, v) -> k, yamlToDv v) kvs)

/// JSON round-trip (Some dv' if it decodes back, else None).
let jsonRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValue.toCanonicalJson dv with
    | Ok s -> (match DynamicValue.fromCanonicalJson s with | Ok d -> Some d | Error _ -> None)
    | Error _ -> None

/// CBOR round-trip.
let cborRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValue.fromCanonicalCbor (DynamicValue.toCanonicalCborOk dv) with
    | Ok d -> Some d
    | Error _ -> None

/// XML round-trip.
let xmlRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValue.toCanonicalXml dv with
    | Ok s -> (match DynamicValue.fromCanonicalXml s with | Ok d -> Some d | Error _ -> None)
    | Error _ -> None

/// YAML round-trip (wrapped as a single-key map — the real storage form; the block
/// parser declines a bare top-level scalar/seq).
let yamlRT (dv: DynamicValue) : DynamicValue option =
    match parse (encode (VMap [ "v", dvToYaml dv ])) with
    | Ok (VMap [ "v", y ]) -> Some(yamlToDv y)
    | _ -> None

/// Arrow round-trip (shredded node-table IPC).
let arrowRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk dv) with
    | Ok d -> Some d
    | Error _ -> None

/// The 4-SER leg: JSON + CBOR + YAML + XML all recover `dv` (they agree on it).
let fourSerAgree (dv: DynamicValue) : bool =
    [ jsonRT; cborRT; yamlRT; xmlRT ] |> List.forall (fun rt -> rt dv = Some dv)

/// The ARROW leg: Arrow IPC recovers `dv`.
let arrowAgree (dv: DynamicValue) : bool = arrowRT dv = Some dv
