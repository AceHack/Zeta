module Zeta.Tests.WatermarkLegsTests

open System
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// Watermark toward the full PROVEN bar — the serializer/Arrow legs + the homeostat-tie + Bonsai.
//
// A multi-source watermark frontier (source → event-time watermark) bridges to a DynamicValue.Object.
// This completes Watermark's six legs (math = Infra/Watermark.Tests; 4-lang = Watermark.CrossVerify):
//   • 4-ser leg: the frontier round-trips through JSON+CBOR+YAML+XML to the same value;
//   • Arrow leg: round-trips through Arrow IPC;
//   • homeostat-tie (SEMILATTICE class — convergence-to-GLB): `Watermark.combine` is min, a bounded
//     MEET-semilattice (idempotent, commutative, associative, identity = Int64.MaxValue). Merging a set
//     of source watermarks in ANY order reaches ONE downstream frontier (the greatest lower bound — an
//     operator can't progress past its slowest input). This is the meet/GLB dual of TravelerFrame's
//     join/LUB convergence. NB: `combine []` returns Int64.MinValue (the "no upstream → −∞" sentinel),
//     which is NOT the meet identity; the identity for the binary meet is Int64.MaxValue (proved below).
//   • Bonsai leg: the combine (meet) reified as a serializable Bonsai Expr (reify/apply).
// ═══════════════════════════════════════════════════════════════════

// A frontier: named source → its current event-time watermark.
let private genFrontier : Gen<Map<string, int64>> =
    gen {
        let! n = Gen.choose (1, 5)
        let! pairs =
            Gen.listOfLength n (
                gen {
                    let! a = Gen.elements [ "s0"; "s1"; "s2"; "s3"; "s4" ]
                    let! v = Gen.choose (-1000, 1000) |> Gen.map int64
                    return a, v
                })
        return Map.ofList pairs
    }

type FrontierArb() =
    static member F() = Arb.fromGen genFrontier

let private toDV (f: Map<string, int64>) : DynamicValue =
    DynamicValue.Object [ for kv in f -> kv.Key, DynamicValue.Int kv.Value ]

let private fromDV (dv: DynamicValue) : Map<string, int64> =
    match dv with
    | DynamicValue.Object kvs ->
        kvs
        |> List.map (fun (k, v) ->
            match v with
            | DynamicValue.Int i -> k, i
            | _ -> failwith "expected DynamicValue.Int")
        |> Map.ofList
    | _ -> failwith "expected DynamicValue.Object"

// ── 4-ser + Arrow legs ──

[<Property(Arbitrary = [| typeof<FrontierArb> |])>]
let ``a watermark frontier round-trips through all four serializers (4-ser leg)`` (f: Map<string, int64>) =
    SerializerLegs.fourSerAgree (toDV f)

[<Property(Arbitrary = [| typeof<FrontierArb> |])>]
let ``a watermark frontier round-trips through Arrow (Arrow leg)`` (f: Map<string, int64>) =
    SerializerLegs.arrowAgree (toDV f)

[<Property(Arbitrary = [| typeof<FrontierArb> |])>]
let ``a frontier survives the serialization round-trip (value preserved)`` (f: Map<string, int64>) =
    match SerializerLegs.jsonRT (toDV f) with
    | Some dv -> fromDV dv = f
    | None -> false

// ── homeostat-tie: convergence-to-GLB (the meet-semilattice class) ──

let private meet (a: int64) (b: int64) : int64 = Watermark.combine [ a; b ]

[<Property>]
let ``combine is idempotent (meet-semilattice)`` (a: int64) =
    meet a a = a

[<Property>]
let ``combine is commutative`` (a: int64) (b: int64) =
    meet a b = meet b a

[<Property>]
let ``combine is associative`` (a: int64) (b: int64) (c: int64) =
    meet (meet a b) c = meet a (meet b c)

[<Property>]
let ``Int64.MaxValue is the meet identity`` (a: int64) =
    meet a Int64.MaxValue = a && meet Int64.MaxValue a = a

[<Property>]
let ``merging source watermarks is order-independent (homeostat-tie: convergence-to-GLB)``
    (xs: int64 list) =
    match xs with
    | [] | [ _ ] -> true
    | _ ->
        // Fold the binary meet from the identity (Int64.MaxValue) — the downstream frontier is the GLB,
        // reached identically under any ordering.
        let foldMeet order = List.fold meet Int64.MaxValue order
        let forward = foldMeet xs
        let reversed = foldMeet (List.rev xs)
        let rotated = foldMeet (List.tail xs @ [ List.head xs ])
        forward = reversed && forward = rotated && forward = List.min xs

// ── Bonsai leg: the combine (meet) reified as a serializable Bonsai Expr (reify/apply) ──

let rec private applyCombine (env: Map<string, int64>) (e: Bonsai.Expr) : int64 option =
    match e with
    | Bonsai.Param n -> Map.tryFind n env
    | Bonsai.Call ("watermark-combine", [ l; r ]) ->
        match applyCombine env l, applyCombine env r with
        | Some a, Some b -> Some(meet a b)
        | _ -> None
    | _ -> None

let private combineExpr : Bonsai.Expr =
    Bonsai.Call("watermark-combine", [ Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property>]
let ``Watermark × Bonsai: combine reified as an Expr round-trips and applies to the same GLB (Bonsai leg)``
    (a: int64) (b: int64) =
    match bonsaiRT combineExpr with
    | Some e -> applyCombine (Map.ofList [ "a", a; "b", b ]) e = Some(meet a b)
    | None -> false

[<Fact>]
let ``Watermark × Bonsai: the reified combine expression round-trips byte-stably`` () =
    Assert.Equal<Bonsai.Expr option>(Some combineExpr, bonsaiRT combineExpr)
