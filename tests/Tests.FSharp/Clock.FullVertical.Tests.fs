module Zeta.Tests.ClockFullVerticalTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// Clock (Versionstamp) full-vertical — the G-Set TEMPLATE applied to the
// causal-order primitive (PROVEN-CORE-MAP #1). A Versionstamp is an int64
// logical clock; its DynamicValue is simply Int(Version). Legs:
//   4-ser + Arrow : Versionstamp → Int → all serializers recover it.
//   Bonsai        : the clock MERGE (max — the join of the versionstamp
//                   join-semilattice) reified as a Bonsai Expr, round-tripped
//                   + applied to compute the max.
//   homeostat     : max-convergence — replicas converge to the LUB (the max)
//                   regardless of merge order + duplicates (this IS the
//                   heartbeat-homeostat property for clocks: per-actor max).
// math ∧ 4-lang already hold (registry); this adds 4-ser + Arrow + Bonsai +
// homeostat → Clock joins G-Set as a FULL-PROVEN floor primitive.
// ═══════════════════════════════════════════════════════════════════

let private vsToDynamic (v: Versionstamp) : DynamicValue = DynamicValue.Int v.Version

let private dynamicToVs (dv: DynamicValue) : Versionstamp option =
    match dv with
    | DynamicValue.Int i -> Some(Versionstamp.ofInt64 i)
    | _ -> None

/// The clock merge = max (the join of the int64 versionstamp join-semilattice).
let private vsMax (a: Versionstamp) (b: Versionstamp) : Versionstamp =
    if Versionstamp.compare a b >= 0 then a else b

let private genVs : Gen<Versionstamp> =
    Gen.choose (-1000000, 1000000) |> Gen.map (int64 >> Versionstamp.ofInt64)

type VsArb() =
    static member V() = Arb.fromGen genVs

// ── 4-ser + Arrow legs (via the shared SerializerLegs helper) ──

[<Property(Arbitrary = [| typeof<VsArb> |])>]
let ``Clock × 4-ser: JSON+CBOR+YAML+XML all recover the same Versionstamp`` (v: Versionstamp) =
    let dv = vsToDynamic v
    SerializerLegs.fourSerAgree dv && (SerializerLegs.jsonRT dv |> Option.bind dynamicToVs = Some v)

[<Property(Arbitrary = [| typeof<VsArb> |])>]
let ``Clock × Arrow: round-trips through Arrow IPC and recovers the same Versionstamp`` (v: Versionstamp) =
    let dv = vsToDynamic v
    SerializerLegs.arrowAgree dv && (SerializerLegs.arrowRT dv |> Option.bind dynamicToVs = Some v)

// ── Bonsai leg: the clock merge (max) reified, round-tripped, applied ──

let rec private applyVsMax (env: Map<string, Versionstamp>) (e: Bonsai.Expr) : Versionstamp option =
    match e with
    | Bonsai.Param n -> Map.tryFind n env
    | Bonsai.Call ("vs-max", [ l; r ]) ->
        match applyVsMax env l, applyVsMax env r with
        | Some a, Some b -> Some(vsMax a b)
        | _ -> None
    | _ -> None

let private vsMaxExpr : Bonsai.Expr =
    Bonsai.Call("vs-max", [ Bonsai.Param "a"; Bonsai.Param "b" ])

[<Property(Arbitrary = [| typeof<VsArb> |])>]
let ``Clock × Bonsai: max reified as a Bonsai Expr round-trips and applies to the merge`` (a: Versionstamp) (b: Versionstamp) =
    match Bonsai.serialize vsMaxExpr with
    | Ok s ->
        match Bonsai.parse s with
        | Ok e -> applyVsMax (Map.ofList [ "a", a; "b", b ]) e = Some(vsMax a b)
        | Error _ -> false
    | Error _ -> false

// ── homeostat leg: max-convergence (order + duplicate independent, idempotent) ──

[<Property(Arbitrary = [| typeof<VsArb> |])>]
let ``Clock × homeostat: versionstamps converge to the max regardless of merge order + duplicates``
    (a: Versionstamp) (b: Versionstamp) (c: Versionstamp) =
    let lub = vsMax (vsMax a b) c
    let orders =
        [ vsMax (vsMax a b) c; vsMax a (vsMax b c); vsMax (vsMax c a) b; vsMax (vsMax b c) a ]
    let orderIndependent = List.forall (fun x -> x = lub) orders
    let idempotent = vsMax lub a = lub && vsMax lub b = lub && vsMax lub c = lub
    orderIndependent && idempotent
