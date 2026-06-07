module Zeta.Tests.EffectsTests

open System.Threading
open global.Xunit
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

module E = Zeta.Core.FSharp.ObserveBridge.Effects

// ═══════════════════════════════════════════════════════════════════
// Bridge D (pure) — the execution layer. effectsOf maps actions to OUTWARD effects (D1: state
// stays in B's fold); the handler enforces inspect-before-execute (denied -> never executes).
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private item id = { Id = id; Title = id; Ready = true; Ambiguous = false; NeedsNewAction = false }
let private w = { Backlog = []; Operator = None; Mode = None }

[<Fact>]
let ``effectsOf maps each action to its outward effect(s)`` () =
    Assert.Equal<E.Effect list>([ E.PersistFerry ], E.effectsOf (PreserveFerry "f") w)
    Assert.Equal<E.Effect list>([ E.EmitResponse ], E.effectsOf (RespondToOperator "m") w)
    Assert.Equal<E.Effect list>([ E.RunWork(item "x") ], E.effectsOf (DoItem(item "x")) w)
    Assert.Equal<E.Effect list>([ E.ExtendGrammar(item "g") ], E.effectsOf (EditGrammar(Some(item "g"), "r")) w)
    Assert.Equal<E.Effect list>([], E.effectsOf (EditGrammar(None, "r")) w)
    Assert.Equal<E.Effect list>([], E.effectsOf (Decompose(item "d")) w)
    for free in [ Explore "e"; Play "p"; SelfReflect "s"; FreeTime "ft" ] do
        Assert.Equal<E.Effect list>([], E.effectsOf free w)

[<Fact>]
let ``an admitted effect executes and is recorded`` () =
    let h = E.RecordingHandler()
    let r = (E.runAsync h (E.RunWork(item "x")) ct).Result
    Assert.Equal(E.Executed, r)
    Assert.Equal<E.Effect list>([ E.RunWork(item "x") ], h.Recorded)

[<Fact>]
let ``a DENIED effect is never executed (inspect-before-execute)`` () =
    let denyRunWork =
        function
        | E.RunWork _ -> E.Deny "no work without authorization"
        | _ -> E.Admit
    let h = E.RecordingHandler(policy = denyRunWork)
    match (E.runAsync h (E.RunWork(item "x")) ct).Result with
    | E.Skipped _ -> ()
    | other -> failwithf "expected Skipped, got %A" other
    Assert.Empty(h.Recorded)

[<Fact>]
let ``end-to-end: chooser pick -> effectsOf -> handler records the outward effect`` () =
    let world = { Backlog = [ item "r" ]; Operator = Some { PendingMessage = true; PendingFerry = false }; Mode = None }
    let pick = Chooser.observe world
    let h = E.RecordingHandler()
    for e in E.effectsOf pick world do
        (E.runAsync h e ct).Result |> ignore
    Assert.Equal<E.Effect list>([ E.EmitResponse ], h.Recorded)
