module Zeta.Tests.ObserveBridgeTests

open global.Xunit
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// Bridge A — World/NextAction <-> DynamicValue. Proves round-trip fidelity for all 9 action
// kinds + World shapes, and that the ENCODED event path folds to the same World as
// Observe.Algebra directly (so actions can ride GitDeltaLog without changing semantics).
// ═══════════════════════════════════════════════════════════════════

let private item id =
    { Id = id; Title = id + " t"; Ready = true; Ambiguous = false; NeedsNewAction = false }

let private actionRoundTrips (a: NextAction) =
    match ObserveBridge.nextActionOfDv (ObserveBridge.nextActionToDv a) with
    | Ok a2 -> Assert.Equal(a, a2)
    | Error e -> Assert.True(false, sprintf "round-trip failed for %A: %s" a e)

[<Fact>]
let ``all nine NextAction kinds round-trip through DynamicValue`` () =
    [ PreserveFerry "f"
      RespondToOperator "m"
      DoItem(item "a")
      Decompose(item "b")
      EditGrammar(Some(item "c"), "edit")
      EditGrammar(None, "edit-none")
      Explore "x"
      Play "p"
      SelfReflect "s"
      FreeTime "ft" ]
    |> List.iter actionRoundTrips

[<Fact>]
let ``World round-trips (operator + mode present)`` () =
    let w =
        { Backlog = [ item "1"; { item "2" with Ambiguous = true } ]
          Operator = Some { PendingMessage = true; PendingFerry = false }
          Mode = Some Mode.Explore }
    match ObserveBridge.worldOfDv (ObserveBridge.worldToDv w) with
    | Ok w2 -> Assert.Equal(w, w2)
    | Error e -> Assert.True(false, e)

[<Fact>]
let ``World round-trips (background agent: no operator, no mode)`` () =
    let w = { Backlog = []; Operator = None; Mode = None }
    match ObserveBridge.worldOfDv (ObserveBridge.worldToDv w) with
    | Ok w2 -> Assert.Equal(w, w2)
    | Error e -> Assert.True(false, e)

[<Fact>]
let ``encodeAction/decodeAction (canonical-CBOR hex) round-trips`` () =
    let a = Decompose(item "z")
    Assert.Equal(a, ObserveBridge.decodeAction (ObserveBridge.encodeAction a))

[<Fact>]
let ``the encoded event path folds to the SAME World as Observe.Algebra directly`` () =
    let w0 =
        { Backlog = [ { item "amb" with Ambiguous = true; Ready = false }; item "ready" ]
          Operator = Some { PendingMessage = true; PendingFerry = true }
          Mode = None }
    let actions =
        [ RespondToOperator "hi"
          Decompose { item "amb" with Ambiguous = true; Ready = false }
          DoItem(item "ready")
          Explore "onward" ]
    // Direct fold via the oracle.
    let expected = Algebra.fold w0 actions
    // Encode -> decode (the substrate event path) -> fold. Must match byte-for-byte semantics.
    let viaSubstrate = actions |> List.map (ObserveBridge.encodeAction >> ObserveBridge.decodeAction) |> Algebra.fold w0
    Assert.Equal(expected, viaSubstrate)
    // And the World survives a DynamicValue round-trip too.
    match ObserveBridge.worldOfDv (ObserveBridge.worldToDv expected) with
    | Ok w2 -> Assert.Equal(expected, w2)
    | Error e -> Assert.True(false, e)
