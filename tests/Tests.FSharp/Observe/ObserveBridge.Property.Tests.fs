module Zeta.Tests.ObserveBridgePropertyTests

open FsCheck
open FsCheck.Xunit
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// Randomized refinement (FsCheck) for the observe<->DynamicValue bridge: round-trip fidelity
// for arbitrary World/NextAction, and that the encoded event path preserves Algebra semantics.
// Plain records/DUs of primitives -> FsCheck's default generators suffice.
// ═══════════════════════════════════════════════════════════════════

[<Property>]
let ``NextAction round-trips through DynamicValue for all generated values`` (a: NextAction) =
    ObserveBridge.nextActionOfDv (ObserveBridge.nextActionToDv a) = Ok a

[<Property>]
let ``NextAction round-trips through canonical-CBOR hex`` (a: NextAction) =
    ObserveBridge.decodeAction (ObserveBridge.encodeAction a) = a

[<Property>]
let ``World round-trips through DynamicValue for all generated values`` (w: World) =
    ObserveBridge.worldOfDv (ObserveBridge.worldToDv w) = Ok w

[<Property>]
let ``the encoded event path preserves Algebra.fold semantics`` (w: World) (actions: NextAction list) =
    let viaSubstrate =
        actions |> List.map (ObserveBridge.encodeAction >> ObserveBridge.decodeAction) |> Algebra.fold w
    viaSubstrate = Algebra.fold w actions
