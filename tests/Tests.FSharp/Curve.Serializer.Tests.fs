module Zeta.Tests.CurveSerializerTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// Curve × serializer + Arrow legs (toward the PROVEN bar).
// A Curve signal is an int64[] → a DynamicValue.Array of Int. This proves the 4-ser leg (the signal
// round-trips through JSON+CBOR+YAML+XML to the same value) and the Arrow leg (round-trips through Arrow
// IPC), and that the operation SURVIVES THE WIRE (rate/curvature on a rehydrated signal == on the
// original). Honest scope: Curve clears math + 4-lang + 4-ser + Arrow; the Bonsai (reify-as-reactive) and
// homeostat (convergence) legs are floor-shaped for MERGEABLE summaries and do NOT map to a derivative
// operator — named N/A, not forced.
// ═══════════════════════════════════════════════════════════════════

let private toDV (s: int64[]) : DynamicValue =
    DynamicValue.Array [ for x in s -> DynamicValue.Int x ]

let private fromDV (dv: DynamicValue) : int64[] =
    match dv with
    | DynamicValue.Array xs ->
        [| for x in xs ->
             match x with
             | DynamicValue.Int i -> i
             | _ -> failwith "expected DynamicValue.Int" |]
    | _ -> failwith "expected DynamicValue.Array"

[<Property>]
let ``a curve signal round-trips through all four serializers (4-ser leg)`` (s: int64[]) =
    SerializerLegs.fourSerAgree (toDV s)

[<Property>]
let ``a curve signal round-trips through Arrow (Arrow leg)`` (s: int64[]) =
    SerializerLegs.arrowAgree (toDV s)

[<Property>]
let ``rate and curvature survive the serialization round-trip`` (s: int64[]) =
    match SerializerLegs.jsonRT (toDV s) with
    | Some dv ->
        let rehydrated = fromDV dv
        Curve.differentiate rehydrated = Curve.differentiate s
        && Curve.curvature rehydrated = Curve.curvature s
        && Curve.integrate rehydrated = Curve.integrate s
    | None -> false
