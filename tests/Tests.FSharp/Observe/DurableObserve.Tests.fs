module Zeta.Tests.DurableObserveTests

open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// Bridge B — the observe controller loop running DURABLY: World = Remains, each NextAction is
// a delta-log event, step = Observe.Algebra.simulate; DurableSaga.ResumeAsync folds the stream
// back to the exact World. The controller loop on the (in-memory here) substrate.
// ═══════════════════════════════════════════════════════════════════

let private item id =
    { Id = id; Title = id; Ready = true; Ambiguous = false; NeedsNewAction = false }

[<Fact>]
let ``durable observe loop folds + resumes to the same World as Algebra.fold`` () =
    let amb = { item "amb" with Ambiguous = true; Ready = false }
    let w0 = { Backlog = [ amb; item "ready" ]; Operator = Some { PendingMessage = true; PendingFerry = true }; Mode = None }
    let actions = [ RespondToOperator "hi"; Decompose amb; DoItem(item "ready"); Explore "onward" ]
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let saga = DurableSaga.start log DurableObserve.step w0
    for a in actions do
        saga.AppendAsync(DurableObserve.event a).Wait()
    Assert.Equal(Algebra.fold w0 actions, saga.State)
    // Recover from the event stream alone.
    let resumed = DurableSaga<World, string>.ResumeAsync(log, DurableObserve.step, w0).Result
    Assert.Equal(Algebra.fold w0 actions, resumed.State)

[<Fact>]
let ``a fresh durable observe loop is the initial World`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let resumed = DurableSaga<World, string>.ResumeAsync(log, DurableObserve.step, DurableObserve.emptyWorld).Result
    Assert.Equal(DurableObserve.emptyWorld, resumed.State)
