module Zeta.Tests.ReconcileLegsTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

module PS = Zeta.Core.ProbabilitySemiring
module RC = Zeta.Core.Reconcile

// ═══════════════════════════════════════════════════════════════════
// Reconcile toward the full PROVEN bar — the serializer/Arrow legs + the homeostat-tie + Bonsai.
// A belief (exact-rational vector over a candidate set) bridges to a DynamicValue.Array of {n,d}. Math
// leg = Reconcile.Tests (commutative, order-independent, ancestor-identity, observe-equivalence). This
// adds: 4-ser, Arrow, homeostat-tie (convergence-to-one-frame = order-independent reconciliation), and
// Bonsai (the 3-way merge reified). 4-lang leg is separate (extends the probability-semiring oracles).
// ═══════════════════════════════════════════════════════════════════

let private genBelief : Gen<PS.Rational[]> =
    gen {
        let! n = Gen.choose (1, 4)
        return!
            Gen.arrayOfLength n (
                gen {
                    let! num = Gen.choose (1, 10) |> Gen.map int64
                    let! den = Gen.choose (1, 5) |> Gen.map int64
                    return PS.rat num den
                })
    }

type BeliefArb() =
    static member B() = Arb.fromGen genBelief

let private toDV (b: PS.Rational[]) : DynamicValue =
    DynamicValue.Array [ for r in b -> DynamicValue.Object [ "n", DynamicValue.Int r.Num; "d", DynamicValue.Int r.Den ] ]

let private fromDV (dv: DynamicValue) : PS.Rational[] =
    match dv with
    | DynamicValue.Array xs ->
        [| for x in xs ->
             match x with
             | DynamicValue.Object kvs ->
                 let find k = kvs |> List.pick (fun (key, v) -> if key = k then Some v else None)
                 match find "n", find "d" with
                 | DynamicValue.Int n, DynamicValue.Int d -> PS.rat n d
                 | _ -> failwith "expected Int n/d"
             | _ -> failwith "expected Object" |]
    | _ -> failwith "expected Array"

// ── 4-ser + Arrow legs ──

[<Property(Arbitrary = [| typeof<BeliefArb> |])>]
let ``a belief round-trips through all four serializers (4-ser leg)`` (b: PS.Rational[]) =
    SerializerLegs.fourSerAgree (toDV b)

[<Property(Arbitrary = [| typeof<BeliefArb> |])>]
let ``a belief round-trips through Arrow (Arrow leg)`` (b: PS.Rational[]) =
    SerializerLegs.arrowAgree (toDV b)

[<Property(Arbitrary = [| typeof<BeliefArb> |])>]
let ``a belief survives the serialization round-trip (value preserved)`` (b: PS.Rational[]) =
    match SerializerLegs.jsonRT (toDV b) with
    | Some dv -> fromDV dv = b
    | None -> false

// ── homeostat-tie: convergence-to-one-frame (order-independent reconciliation, the meet/aggregate) ──

[<Property(Arbitrary = [| typeof<BeliefArb> |])>]
let ``reconciliation is order-independent — all relative observers reach ONE frame (homeostat-tie)``
    (anc: PS.Rational[]) (a: PS.Rational[]) (b: PS.Rational[]) (c: PS.Rational[]) =
    // align lengths to the ancestor; require positive ancestor (division)
    let n = anc.Length
    if n = 0 then true
    else
        let fit (v: PS.Rational[]) = Array.init n (fun i -> if i < v.Length then v.[i] else PS.rat 1L 1L)
        let a, b, c = fit a, fit b, fit c
        let branches = [ a; b; c ]
        let forward = RC.reconcileAll anc branches
        let reversed = RC.reconcileAll anc (List.rev branches)
        let rotated = RC.reconcileAll anc (List.tail branches @ [ List.head branches ])
        forward = reversed && forward = rotated

// ── Bonsai leg: the 3-way merge reified as a serializable Bonsai Expr (reify/apply) ──

let rec private applyMerge3 (env: Map<string, PS.Rational[]>) (e: Bonsai.Expr) : PS.Rational[] option =
    match e with
    | Bonsai.Param p -> Map.tryFind p env
    | Bonsai.Call ("reconcile-merge3", [ anc; a; b ]) ->
        match applyMerge3 env anc, applyMerge3 env a, applyMerge3 env b with
        | Some ancv, Some av, Some bv -> Some(RC.merge3 ancv av bv)
        | _ -> None
    | _ -> None

let private merge3Expr : Bonsai.Expr =
    Bonsai.Call("reconcile-merge3", [ Bonsai.Param "anc"; Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property(Arbitrary = [| typeof<BeliefArb> |])>]
let ``Reconcile × Bonsai: merge3 reified as an Expr round-trips and applies to the same frame (Bonsai leg)``
    (anc: PS.Rational[]) =
    let n = anc.Length
    if n = 0 then true
    else
        let v x = Array.init n (fun i -> PS.rat (int64 (x + i + 1)) 1L)
        let a, b = v 1, v 2
        match bonsaiRT merge3Expr with
        | Some e -> applyMerge3 (Map.ofList [ "anc", anc; "a", a; "b", b ]) e = Some(RC.merge3 anc a b)
        | None -> false

[<Fact>]
let ``Reconcile × Bonsai: the reified merge3 expression round-trips byte-stably`` () =
    Assert.Equal<Bonsai.Expr option>(Some merge3Expr, bonsaiRT merge3Expr)
