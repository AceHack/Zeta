module Zeta.Tests.FrameDeltaLegsTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

module FD = Zeta.Core.FrameDelta

// ═══════════════════════════════════════════════════════════════════
// FrameDelta toward the full PROVEN bar — the serializer/Arrow legs + the homeostat-tie.
//
// A Delta (per-actor int64 shift) bridges to a DynamicValue.Object. This proves:
//   • 4-ser leg: the delta round-trips through JSON+CBOR+YAML+XML to the same value;
//   • Arrow leg: round-trips through Arrow IPC;
//   • homeostat-tie (MONOID class — same as ByteCost): `compose` is a commutative monoid, so folding a
//     set of deltas in ANY order yields the same total transformation (order-independent aggregation —
//     the path-independent total). NB: this is the monoid homeostat class, NOT convergence-to-LUB
//     (a group has inverses, it does not converge) — FrameDelta is mergeable as an aggregate, not as a
//     semilattice.
// (math leg = FrameDelta.Tests; 4-lang + Bonsai legs are separate.)
// ═══════════════════════════════════════════════════════════════════

let private genDelta : Gen<FD.Delta> =
    gen {
        let! n = Gen.choose (0, 4)
        let! pairs =
            Gen.listOfLength n (
                gen {
                    let! a = Gen.elements [ "a"; "b"; "c"; "d"; "e" ]
                    let! v = Gen.choose (-50, 50) |> Gen.map int64
                    return a, v
                })
        return { FD.Shifts = (Map.ofList pairs) |> Map.filter (fun _ v -> v <> 0L) }
    }

type DeltaArb() =
    static member D() = Arb.fromGen genDelta

let private toDV (d: FD.Delta) : DynamicValue =
    DynamicValue.Object [ for kv in d.Shifts -> kv.Key, DynamicValue.Int kv.Value ]

let private fromDV (dv: DynamicValue) : FD.Delta =
    match dv with
    | DynamicValue.Object kvs ->
        { FD.Shifts =
            kvs
            |> List.map (fun (k, v) ->
                match v with
                | DynamicValue.Int i -> k, i
                | _ -> failwith "expected DynamicValue.Int")
            |> Map.ofList }
    | _ -> failwith "expected DynamicValue.Object"

// ── 4-ser + Arrow legs ──

[<Property(Arbitrary = [| typeof<DeltaArb> |])>]
let ``a frame delta round-trips through all four serializers (4-ser leg)`` (d: FD.Delta) =
    SerializerLegs.fourSerAgree (toDV d)

[<Property(Arbitrary = [| typeof<DeltaArb> |])>]
let ``a frame delta round-trips through Arrow (Arrow leg)`` (d: FD.Delta) =
    SerializerLegs.arrowAgree (toDV d)

[<Property(Arbitrary = [| typeof<DeltaArb> |])>]
let ``a delta survives the serialization round-trip (value preserved)`` (d: FD.Delta) =
    match SerializerLegs.jsonRT (toDV d) with
    | Some dv -> fromDV dv = d
    | None -> false

// ── homeostat-tie: order-independent aggregation (the commutative-monoid class) ──

[<Property(Arbitrary = [| typeof<DeltaArb> |])>]
let ``composing a set of deltas is order-independent (homeostat-tie: path-independent total)``
    (ds: FD.Delta list) =
    match ds with
    | [] | [ _ ] -> true
    | _ ->
        let fold order = List.fold FD.compose FD.identity order
        let forward = fold ds
        let reversed = fold (List.rev ds)
        let rotated = fold (List.tail ds @ [ List.head ds ])
        forward = reversed && forward = rotated

[<Property(Arbitrary = [| typeof<DeltaArb> |])>]
let ``identity is the aggregation unit`` (d: FD.Delta) =
    FD.compose d FD.identity = d && FD.compose FD.identity d = d
