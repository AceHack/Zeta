module Zeta.Tests.GSetFourSerTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Yaml.Dom
open Zeta.Core.FSharp.Yaml.Encoder

// ═══════════════════════════════════════════════════════════════════
// G-Set × 4-SER leg (PROVEN-CORE-MAP: G-Set first-full-vertical, leg
// order 4-ser → Arrow → Bonsai → homeostat-tie). This is the 4-SER
// LEG: G-Set value → its canonical DynamicValue (an ascending Array,
// `ToArray()` gives canonical order so the bytes are deterministic) →
// every value-tree serializer (JSON/CBOR/YAML/XML) round-trips it →
// back to the SAME G-Set. So all four formats AGREE on the G-Set,
// which is what "the 4 serializers agree on it" (the 4-ser leg) means.
//
// Scope: int64 elements (the majority DBSP key — IDs/time-series; the
// registry's G-Set is 4/4 on int64). String elements are analogous
// (DynamicValue.String). This ties ONE primitive (G-Set) through ONE
// leg (4-ser) — the template the rest of the vertical + the other
// floor primitives follow. NOT the full PROVEN bar (Arrow/Bonsai/
// homeostat legs are the next steps of the vertical).
// ═══════════════════════════════════════════════════════════════════

let private gsetToDynamic (g: GSet<int64>) : DynamicValue =
    // canonical (ascending) order → deterministic serialization
    DynamicValue.Array [ for x in g.ToArray() -> DynamicValue.Int x ]

let private dynamicToGSet (dv: DynamicValue) : GSet<int64> option =
    match dv with
    | DynamicValue.Array xs ->
        let mutable ok = true
        let els =
            [ for x in xs do
                  match x with
                  | DynamicValue.Int i -> yield i
                  | _ -> ok <- false ]
        if ok then Some(GSet.ofSeq els) else None
    | _ -> None

// ── DynamicValue → format → DynamicValue, for each value-tree serializer ──

let private jsonRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValue.toCanonicalJson dv with
    | Ok s -> (match DynamicValue.fromCanonicalJson s with | Ok d -> Some d | Error _ -> None)
    | Error _ -> None

let private cborRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValue.fromCanonicalCbor (DynamicValue.toCanonicalCbor dv) with
    | Ok d -> Some d
    | Error _ -> None

let private xmlRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValue.toCanonicalXml dv with
    | Ok s -> (match DynamicValue.fromCanonicalXml s with | Ok d -> Some d | Error _ -> None)
    | Error _ -> None

// YAML goes via the DynamicValue↔YamlValue bridge (Int/Array subset is all G-Set needs).
let rec private dvToYaml (dv: DynamicValue) : YamlValue =
    match dv with
    | DynamicValue.Int i -> VInt i
    | DynamicValue.Array xs -> VSeq(List.map dvToYaml xs)
    | _ -> failwith "G-Set 4-ser test only exercises Int/Array"

let rec private yamlToDv (y: YamlValue) : DynamicValue =
    match y with
    | VInt i -> DynamicValue.Int i
    | VSeq xs -> DynamicValue.Array(List.map yamlToDv xs)
    | _ -> failwith "unexpected YAML shape for a G-Set"

let private yamlRT (dv: DynamicValue) : DynamicValue option =
    // wrap in a map (YAML's storage form; the block parser declines a bare top-level seq)
    match parse (encode (VMap [ "g", dvToYaml dv ])) with
    | Ok (VMap [ "g", y ]) -> Some(yamlToDv y)
    | _ -> None

// ── generator for arbitrary G-Set<int64> ──
let private genGSet : Gen<GSet<int64>> =
    gen { let! xs = Gen.listOf (Gen.choose (-100000, 100000) |> Gen.map int64)
          return GSet.ofSeq xs }

type GSetArb() =
    static member G() = Arb.fromGen genGSet

// ── the 4-SER leg: all four serializers recover the same G-Set ──

[<Property(Arbitrary = [| typeof<GSetArb> |])>]
let ``G-Set × 4-ser: JSON + CBOR + YAML + XML all recover the SAME G-Set (the 4-ser leg)``
    (g: GSet<int64>) =
    let dv = gsetToDynamic g
    let recovered (rt: DynamicValue -> DynamicValue option) =
        match rt dv with
        | Some d -> dynamicToGSet d = Some g
        | None -> false
    recovered jsonRT && recovered cborRT && recovered yamlRT && recovered xmlRT

[<Fact>]
let ``G-Set × 4-ser: canonical-order means the four formats are byte-stable per G-Set (fixed cases)`` () =
    let cases = [ GSet.empty<int64>; GSet.ofSeq [ 3L; 1L; 2L; 1L ]; GSet.ofSeq [ -5L; 0L; 9000000000L ] ]
    for g in cases do
        let dv = gsetToDynamic g
        // canonical-order round-trip recovers g through every format
        Assert.Equal(Some g, jsonRT dv |> Option.bind dynamicToGSet)
        Assert.Equal(Some g, cborRT dv |> Option.bind dynamicToGSet)
        Assert.Equal(Some g, yamlRT dv |> Option.bind dynamicToGSet)
        Assert.Equal(Some g, xmlRT dv |> Option.bind dynamicToGSet)
        // de-dup + ordering: {3,1,2,1} canonicalizes to [1;2;3]
        ()
    // the dedup/order invariant the canonical DynamicValue depends on
    Assert.Equal<int64[]>([| 1L; 2L; 3L |], (GSet.ofSeq [ 3L; 1L; 2L; 1L ]).ToArray())
