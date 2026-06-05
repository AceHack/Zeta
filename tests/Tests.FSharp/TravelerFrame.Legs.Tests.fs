module Zeta.Tests.TravelerFrameLegsTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

module TF = Zeta.Core.TravelerFrame

// ═══════════════════════════════════════════════════════════════════
// TravelerFrame toward FULL PROVEN — the serializer/Arrow legs, the homeostat-tie, and Bonsai.
//
// A Frame (per-actor versionstamp) bridges to a DynamicValue.Object. This proves:
//   • 4-ser leg: a frame round-trips through JSON+CBOR+YAML+XML to the same value;
//   • Arrow leg: round-trips through Arrow IPC;
//   • homeostat-tie (SEMILATTICE class — the genuine convergence class, like G-Set/Clock): `transform`
//     (causal-join = pointwise max) is idempotent+commutative+associative, so replicas merging in ANY
//     order with ANY duplicates CONVERGE to the same LUB (the common frame). Convergence IS homeostasis.
//   • Bonsai leg: the transform operation reified as a serializable Bonsai.Expr (reify/apply).
// (math leg = TravelerFrame.Tests; 4-lang = separate cross-verify.)
// ═══════════════════════════════════════════════════════════════════

let private genFrame : Gen<TF.Frame> =
    gen {
        let! n = Gen.choose (0, 4)
        let! pairs =
            Gen.listOfLength n (
                gen {
                    let! a = Gen.elements [ "a"; "b"; "c"; "d"; "e" ]
                    let! v = Gen.choose (0, 50) |> Gen.map int64
                    return a, Versionstamp.ofInt64 v
                })
        return { TF.Coords = Map.ofList pairs }
    }

type FrameArb() =
    static member F() = Arb.fromGen genFrame

let private toDV (f: TF.Frame) : DynamicValue =
    DynamicValue.Object [ for kv in f.Coords -> kv.Key, DynamicValue.Int kv.Value.Version ]

let private fromDV (dv: DynamicValue) : TF.Frame =
    match dv with
    | DynamicValue.Object kvs ->
        { TF.Coords =
            kvs
            |> List.map (fun (k, v) ->
                match v with
                | DynamicValue.Int i -> k, Versionstamp.ofInt64 i
                | _ -> failwith "expected DynamicValue.Int")
            |> Map.ofList }
    | _ -> failwith "expected DynamicValue.Object"

// ── 4-ser + Arrow legs ──

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``a traveler frame round-trips through all four serializers (4-ser leg)`` (f: TF.Frame) =
    SerializerLegs.fourSerAgree (toDV f)

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``a traveler frame round-trips through Arrow (Arrow leg)`` (f: TF.Frame) =
    SerializerLegs.arrowAgree (toDV f)

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``a frame survives the serialization round-trip (value preserved)`` (f: TF.Frame) =
    match SerializerLegs.jsonRT (toDV f) with
    | Some dv -> fromDV dv = f
    | None -> false

// ── homeostat-tie: convergence-to-LUB (the semilattice class) ──

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``replicas converge to the LUB regardless of merge order + duplicates (convergence IS homeostasis)``
    (a: TF.Frame) (b: TF.Frame) (c: TF.Frame) =
    let lub = TF.transform (TF.transform a b) c
    let orders =
        [ TF.transform a (TF.transform b c)
          TF.transform (TF.transform c a) b
          TF.transform (TF.transform b c) a ]
    let orderIndependent = orders |> List.forall (fun x -> x = lub)
    // idempotent: re-delivering any replica is a no-op (at-least-once delivery suffices)
    let idempotent =
        TF.transform lub a = lub && TF.transform lub b = lub && TF.transform lub c = lub
    orderIndependent && idempotent

// ── Bonsai leg: the transform operation reified as a serializable Bonsai Expr ──

let rec private applyTransform (env: Map<string, TF.Frame>) (e: Bonsai.Expr) : TF.Frame option =
    match e with
    | Bonsai.Param n -> Map.tryFind n env
    | Bonsai.Call ("frame-transform", [ l; r ]) ->
        match applyTransform env l, applyTransform env r with
        | Some a, Some b -> Some(TF.transform a b)
        | _ -> None
    | _ -> None

let private transformExpr : Bonsai.Expr =
    Bonsai.Call("frame-transform", [ Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``TravelerFrame × Bonsai: transform reified as an Expr round-trips and applies to the LUB (Bonsai leg)``
    (a: TF.Frame) (b: TF.Frame) =
    match bonsaiRT transformExpr with
    | Some e -> applyTransform (Map.ofList [ "a", a; "b", b ]) e = Some(TF.transform a b)
    | None -> false

[<Fact>]
let ``TravelerFrame × Bonsai: the reified transform expression round-trips byte-stably`` () =
    Assert.Equal<Bonsai.Expr option>(Some transformExpr, bonsaiRT transformExpr)
