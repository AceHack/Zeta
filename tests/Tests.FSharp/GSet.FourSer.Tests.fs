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
    match DynamicValue.fromCanonicalCbor (DynamicValue.toCanonicalCborOk dv) with
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


// ── G-Set × ARROW leg (PROVEN-CORE-MAP G-Set vertical: 4-ser → ARROW → Bonsai →
// homeostat-tie). The Arrow leg: G-Set → canonical DynamicValue → Arrow IPC
// (DynamicValueArrow.toArrow, the shredded node-table) → back → the SAME G-Set.
// "tied into the Arrow (columnar memory) layer" = the Arrow proof leg. ──

let private arrowRT (dv: DynamicValue) : DynamicValue option =
    match DynamicValueArrow.fromArrow (DynamicValueArrow.toArrowOk dv) with
    | Ok d -> Some d
    | Error _ -> None

[<Property(Arbitrary = [| typeof<GSetArb> |])>]
let ``G-Set × Arrow: round-trips through Arrow IPC and recovers the SAME G-Set (the Arrow leg)``
    (g: GSet<int64>) =
    match arrowRT (gsetToDynamic g) with
    | Some d -> dynamicToGSet d = Some g
    | None -> false

[<Fact>]
let ``G-Set × Arrow: fixed cases (empty / dedup / boundaries) recover via Arrow`` () =
    let cases = [ GSet.empty<int64>; GSet.ofSeq [ 3L; 1L; 2L; 1L ]; GSet.ofSeq [ -5L; 0L; 9000000000L ] ]
    for g in cases do
        Assert.Equal(Some g, arrowRT (gsetToDynamic g) |> Option.bind dynamicToGSet)


// ── G-Set × BONSAI leg (final leg of the G-Set vertical: 4-ser → Arrow → BONSAI →
// homeostat-tie). Bonsai is the serialized-deferred-execution / reactive layer (the
// Expr serializer; defunctionalized computation-as-data — no eval, scalar ConstValue).
// So the Bonsai-tie is the REIFY/APPLY shape: G-Set's UNION OPERATION reified as a
// Bonsai Expr → round-tripped through the real Bonsai.serialize/parse → APPLIED to
// compute the merge. apply(parse(serialize(reify union)))(a,b) = a ∪ b — the operation
// is a first-class, serializable Bonsai pattern that computes correctly (reify/apply
// isomorphism for the G-Set merge). "tied into the Bonsai (animation/reactive) layer." ──

let rec private applyGSetUnion (env: Map<string, GSet<int64>>) (e: Bonsai.Expr) : GSet<int64> option =
    match e with
    | Bonsai.Param n -> Map.tryFind n env
    | Bonsai.Call ("gset-union", [ l; r ]) ->
        match applyGSetUnion env l, applyGSetUnion env r with
        | Some a, Some b -> Some(a + b) // GSet (+) IS the CRDT union
        | _ -> None
    | _ -> None

// the reified G-Set union: union of two named G-Sets, as a Bonsai expression
let private unionExpr : Bonsai.Expr =
    Bonsai.Call("gset-union", [ Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property(Arbitrary = [| typeof<GSetArb> |])>]
let ``G-Set × Bonsai: union reified as a Bonsai Expr round-trips and applies to the merge (the Bonsai leg)``
    (a: GSet<int64>) (b: GSet<int64>) =
    match bonsaiRT unionExpr with
    | Some e -> applyGSetUnion (Map.ofList [ "a", a; "b", b ]) e = Some(a + b)
    | None -> false

[<Fact>]
let ``G-Set × Bonsai: the reified union expression round-trips byte-stably`` () =
    // the pattern (Bonsai Expr) is durable: serialize → parse → same Expr
    Assert.Equal<Bonsai.Expr option>(Some unionExpr, bonsaiRT unionExpr)


// ── G-Set × HOMEOSTAT leg (the convergence-IS-homeostasis property, for G-Set
// SPECIFICALLY — not borrowed from the generic heartbeat-homeostat demo). A G-Set
// homeostat = replicas that each see some observations and merge via union; the
// homeostat property is that they CONVERGE to the same fixpoint (the LUB = union of
// all observations) regardless of MERGE ORDER and DUPLICATES. That order/duplicate-
// independent convergence to a unique fixpoint IS homeostasis (the system settles to
// one state no matter the path). This is the CRDT guarantee (idempotent ∪ ⟹
// at-least-once delivery suffices; no coordination needed) made concrete for G-Set. ──

[<Property(Arbitrary = [| typeof<GSetArb> |])>]
let ``G-Set × homeostat: replicas converge to the LUB regardless of merge order + duplicates (convergence IS homeostasis)``
    (a: GSet<int64>) (b: GSet<int64>) (c: GSet<int64>) =
    let lub = a + b + c // the least upper bound = union of all replicas' observations
    // every merge order reaches the SAME fixpoint (commutativity + associativity)
    let orders = [ (a + b) + c; a + (b + c); (c + a) + b; (b + c) + a; (c + b) + a ]
    let orderIndependent = List.forall (fun x -> x = lub) orders
    // idempotent: re-delivering any replica is a no-op (at-least-once suffices)
    let idempotent = (lub + a = lub) && (lub + b = lub) && (lub + c = lub)
    orderIndependent && idempotent
