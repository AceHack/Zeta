module Zeta.Tests.ChooserTests

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// Chooser.observe — the deterministic v0 controller. Priority:
// operator(ferry>message) > persisted free mode > ready > ambiguous > needs-action > explore.
// Plus: the chooser drives the DURABLE loop autonomously (choose -> commit -> fold -> choose).
// ═══════════════════════════════════════════════════════════════════

let private item id ready amb needs =
    { Id = id; Title = id; Ready = ready; Ambiguous = amb; NeedsNewAction = needs }

let private world backlog op mode = { Backlog = backlog; Operator = op; Mode = mode }

[<Fact>]
let ``pendingFerry outranks everything`` () =
    let w = world [ item "r" true false false ] (Some { PendingMessage = true; PendingFerry = true }) None
    match Chooser.observe w with
    | PreserveFerry _ -> ()
    | other -> failwithf "expected PreserveFerry, got %A" other

[<Fact>]
let ``pendingMessage (no ferry) -> RespondToOperator`` () =
    let w = world [ item "r" true false false ] (Some { PendingMessage = true; PendingFerry = false }) None
    match Chooser.observe w with
    | RespondToOperator _ -> ()
    | other -> failwithf "expected RespondToOperator, got %A" other

[<Fact>]
let ``a persisted FREE mode is kept even when ready work exists (work is offered, not forced)`` () =
    let w = world [ item "r" true false false ] None (Some Mode.Play)
    match Chooser.observe w with
    | Play _ -> ()
    | other -> failwithf "expected Play (mode persistence), got %A" other

[<Fact>]
let ``ready item is the deterministic work default`` () =
    match Chooser.observe (world [ item "amb" false true false; item "r" true false false ] None None) with
    | DoItem i -> Assert.Equal("r", i.Id)
    | other -> failwithf "expected DoItem r, got %A" other

[<Fact>]
let ``ambiguous (no ready) -> Decompose; needs-action (no ready/amb) -> EditGrammar`` () =
    match Chooser.observe (world [ item "a" false true false ] None None) with
    | Decompose i -> Assert.Equal("a", i.Id)
    | other -> failwithf "expected Decompose, got %A" other
    match Chooser.observe (world [ item "n" false false true ] None None) with
    | EditGrammar(Some i, _) -> Assert.Equal("n", i.Id)
    | other -> failwithf "expected EditGrammar n, got %A" other

[<Fact>]
let ``empty backlog defaults to explore (forward motion, not idle)`` () =
    match Chooser.observe (world [] None None) with
    | Explore _ -> ()
    | other -> failwithf "expected Explore, got %A" other

[<Fact>]
let ``the chooser drives the DURABLE loop autonomously: choose -> commit -> fold`` () =
    // No actions supplied: each tick reads the folded World, the chooser picks, we commit + fold.
    let w0 = world [ item "ready" true false false ] (Some { PendingMessage = true; PendingFerry = false }) None
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let saga = DurableSaga.start log DurableObserve.step w0
    // Tick 1: operator pending -> RespondToOperator (clears the message).
    let a1 = Chooser.observe saga.State
    saga.AppendAsync(DurableObserve.event a1).Wait()
    // Tick 2: operator clear, ready item -> DoItem (drops it, enters work mode).
    let a2 = Chooser.observe saga.State
    saga.AppendAsync(DurableObserve.event a2).Wait()
    // Tick 3: backlog empty -> explore (forward default).
    let a3 = Chooser.observe saga.State
    (match a1 with RespondToOperator _ -> () | o -> failwithf "tick1 %A" o)
    (match a2 with DoItem _ -> () | o -> failwithf "tick2 %A" o)
    (match a3 with Explore _ -> () | o -> failwithf "tick3 %A" o)
    // The durable World reflects the run: message cleared, backlog empty.
    Assert.Equal(true, List.isEmpty saga.State.Backlog)
