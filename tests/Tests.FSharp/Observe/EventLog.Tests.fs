module Zeta.Tests.FSharp.Observe.EventLogTests

open global.Xunit
open Zeta.Core.FSharp.Observe

// 081KSXN940008QG0R0002287MP (numerics interface-gate), F# slice: the observe event log is an
// additive MONOID via F#'s native `Zero` + `(+)` convention. Pins the monoid laws
// (identity, associativity) AND the load-bearing homomorphism — folding a
// concatenated log == incremental folding — i.e. append-only / DST-replay
// soundness. Additive-monoidal only (operator 2026-05-31). F# records are
// structurally equal, so `Assert.Equal<_>` compares logs/worlds element-wise.

let private alpha: BacklogItem =
    { Id = "a"; Title = "Alpha"; Ready = true; Ambiguous = false; NeedsNewAction = false }

let private beta: BacklogItem =
    { Id = "b"; Title = "Beta"; Ready = false; Ambiguous = true; NeedsNewAction = false }

let private initialWorld () : World =
    { Backlog = [ alpha; beta ]
      Operator = Some { PendingMessage = true; PendingFerry = true }
      Mode = None }

// Three non-trivial logs touching backlog (DoItem/Decompose), mode (Explore/
// SelfReflect) and the operator channel (RespondToOperator), so the homomorphism
// law exercises real transitions, not a no-op.
let private logA () : EventLog = { Events = [ Explore "e"; DoItem alpha ] }
let private logB () : EventLog = { Events = [ Decompose beta; RespondToOperator "r" ] }
let private logC () : EventLog = { Events = [ SelfReflect "s" ] }

[<Fact>]
let ``additive identity is the empty log`` () = Assert.Empty(EventLog.Zero.Events)

[<Fact>]
let ``left identity holds`` () =
    let x = logA ()
    Assert.Equal<EventLog>(x, EventLog.Zero + x)

[<Fact>]
let ``right identity holds`` () =
    let x = logA ()
    Assert.Equal<EventLog>(x, x + EventLog.Zero)

[<Fact>]
let ``append is associative`` () =
    let a, b, c = logA (), logB (), logC ()
    Assert.Equal<EventLog>((a + b) + c, a + (b + c))

[<Fact>]
let ``foldOnto empty log is the initial world`` () =
    let w0 = initialWorld ()
    Assert.Equal<World>(w0, EventLog.Zero.FoldOnto w0)

// The load-bearing law: Fold is the monoid action — folding a joined log = folding
// the second onto the result of folding the first (append-only / DST-replay
// soundness). Checked across three logs (associatively) too.
[<Fact>]
let ``foldOnto is a monoid homomorphism`` () =
    let w0 = initialWorld ()
    let a, b, c = logA (), logB (), logC ()
    Assert.Equal<World>((a + b).FoldOnto w0, b.FoldOnto(a.FoldOnto w0))
    Assert.Equal<World>(((a + b) + c).FoldOnto w0, c.FoldOnto(b.FoldOnto(a.FoldOnto w0)))
