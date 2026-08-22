module Zeta.Tests.TickBoundaryProbeTests

// **Measuring `R-1a`'s load-bearing premise: is the tick-boundary trace COMPLETE?**
//
// The four-corner argument does not forbid a backward influence — it forbids a HIDDEN one, on the
// grounds that anything real would have to surface as a declared corner. That is conditional on
// completeness, and completeness is what these tests measure.
//
// The declared channels at `SoftScheduler.drive`/`driveK` are: the seed, the injected `Source`, the
// threaded `'S`, and the `IntrCtx`. `TickBoundaryProbe` pins all four across repeated runs, so a
// difference between runs is a *witness* that something else carried information.
//
// The exhibits below are deliberately built from SHIPPED API only — no straw handler that nobody
// would write. `ReceiptScheduler.wrapHandler`'s `onReceipt: (Receipt -> unit) option` is a real
// parameter of a real `src/Core` module, and `ReceiptScheduler.Tests.fs` already passes it a
// `Some receipts.Add` over a captured `List<>`. That is an EGRESS out of the tick loop that is in
// none of the four channels. TICK-3 turns that same egress into an INGRESS with two lines and shows
// the loop's outcome change while every declared channel is byte-identical.

open System.Threading.Tasks
open Xunit
open Zeta.Core

// ── shared fixtures ────────────────────────────────────────────────────────────────────────────

type Counter = { N: int }

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

/// The honest handler: its next state is a function of its declared argument and nothing else.
let private pureCounter: SoftScheduler.Handler<Counter> =
    SoftScheduler.handler "counter" isTimer (fun _ctx st -> Task.FromResult(Ok { N = st.N + 1 }))

let private timerOnly: SoftScheduler.Source = fun _ -> [ TimerElapsed 17 ]

let private ivFn (prior: Counter) (posterior: Counter) : float =
    if posterior.N > prior.N then 1.0 else 0.0

let private entropyFn (_: Counter) : float = 0.0

// ── TICK-1: the probe's negative control — a room with no captured state does not diverge ──────
// Without this, a green TICK-3 would prove nothing: an instrument that reports a crossing on
// everything measures nothing. This is the assertion that makes TICK-3's positive discriminating.

[<Fact>]
let ``TICK-1: a room whose handlers close over nothing reports DeclaredOnly across 5 repeats`` () =
    task {
        let room =
            SimFramework.room "pure-counter" (fun _ -> { N = 0 }) [ pureCounter ] 10 (fun st -> st.N >= 10)

        let! verdict = TickBoundaryProbe.probeRoom room 7L 5

        match verdict with
        | TickBoundaryProbe.DeclaredOnly(Ok st) -> Assert.Equal(10, st.N)
        | other -> Assert.Fail(sprintf "expected DeclaredOnly, got %A" other)
    }
    :> Task

// ── TICK-2: the four declared channels are genuinely pinned by the probe ───────────────────────
// A cheap way for TICK-1 to be vacuous: the probe could be running the room once and comparing the
// result to itself. It is not — each repeat is a fresh `driveK`/`drive` invocation over a freshly
// built initial state. Proven by a handler that DOES depend on a captured cell: it must diverge.

[<Fact>]
let ``TICK-2: the probe actually re-runs — a handler reading a captured counter diverges`` () =
    task {
        // The minimal undeclared channel: one captured cell, incremented per tick, folded into 'S.
        let cell = ref 0

        let leaky: SoftScheduler.HandlerK<Counter> =
            SoftScheduler.handlerK "leaky" isTimer (fun _intr _ctx st ->
                cell.Value <- cell.Value + 1
                Task.FromResult(Ok { N = st.N + cell.Value }))

        let! verdict = TickBoundaryProbe.probeHandlers "leaky" [ leaky ] timerOnly 7L (fun () -> { N = 0 }) 4 2

        match verdict with
        | TickBoundaryProbe.UndeclaredDetected(i, first, again) ->
            Assert.Equal(1, i)
            // run 1: cell 1,2,3,4 ⇒ 10.  run 2: cell 5,6,7,8 ⇒ 26.  Same seed, same source, same 'S₀.
            Assert.Equal(Ok { N = 10 }, first)
            Assert.Equal(Ok { N = 26 }, again)
        | other -> Assert.Fail(sprintf "expected UndeclaredDetected, got %A" other)
    }
    :> Task

// ── TICK-3: THE EXHIBIT — `ReceiptScheduler.onReceipt` is an undeclared channel, shipped ────────
// `ReceiptScheduler.wrapHandler` accepts `onReceipt : (ComputeReceipt.Receipt -> unit) option`. A
// `-> unit` callback fired inside the tick loop has, by its own type, no way to return its effect
// through `'S`, the `Source`, the seed, the `IntrCtx`, or the `Result`. The module's docstring calls
// this "The four-corner closure: … Feedback (backward): the `ComputeReceipt` emitted by the inner
// handler" — but the receipt does not travel on a corner. It leaves through a hole.
//
// Nothing here is contrived except the sink: `Some receipts.Add` over a captured collection is the
// exact call already in `ReceiptScheduler.Tests.fs` SCHED-1. All this test adds is a second handler
// that READS the collection — which is what makes the egress a channel rather than a leak.

[<Fact>]
let ``TICK-3: onReceipt carries information across a tick boundary outside every declared channel`` () =
    task {
        // The sink the shipped test already uses.
        let receipts = System.Collections.Generic.List<ComputeReceipt.Receipt>()

        let receipted =
            ReceiptScheduler.wrapHandler ivFn 1.0 entropyFn (Some receipts.Add) pureCounter

        // The reader: folds how many receipts the *process* has seen into the room's own state.
        // It closes over `receipts`; its type still claims `'S -> 'S`.
        let reader: SoftScheduler.Handler<ReceiptScheduler.Receipted<Counter>> =
            SoftScheduler.handler "reader" isTimer (fun _ctx st ->
                Task.FromResult(Ok { st with Inner = { N = st.Inner.N + receipts.Count } }))

        let room =
            SimFramework.room
                "receipt-egress"
                (fun _ -> ReceiptScheduler.receipted { N = 0 })
                [ receipted; reader ]
                3
                (fun _ -> true)

        let! verdict = TickBoundaryProbe.probeRoom room 7L 2

        match verdict with
        | TickBoundaryProbe.UndeclaredDetected(_, Ok first, Ok again) ->
            // Every declared channel was identical. The outcome was not.
            Assert.NotEqual(first.Inner.N, again.Inner.N)
            // And it moved in the direction the undeclared channel carries: run 2 starts from a
            // sink that run 1 already filled, so it can only be larger.
            Assert.True(
                again.Inner.N > first.Inner.N,
                sprintf "run1=%d run2=%d — expected the second run to inherit run 1's receipts" first.Inner.N again.Inner.N
            )
            // Both runs are internally consistent: 3 ticks, receipts counted per tick.
            Assert.Equal(3, first.Tick)
            Assert.Equal(3, again.Tick)
        | other -> Assert.Fail(sprintf "expected UndeclaredDetected, got %A" other)
    }
    :> Task

// ── TICK-4: the same egress, made INVISIBLE — the probe's blind spot, exhibited ─────────────────
// The instrument must not be trusted further than it reaches. Here the identical `onReceipt` egress
// is present and firing, and the probe reports `DeclaredOnly` — because nothing reads the sink back.
// The channel is no less real; it is only quiet. This is why `DeclaredOnly` is named "not detected"
// and why the module docstring lists idempotent leaks as blind spot #1.

[<Fact>]
let ``TICK-4: an unread onReceipt sink is an undeclared channel the probe cannot see`` () =
    task {
        let receipts = System.Collections.Generic.List<ComputeReceipt.Receipt>()

        let receipted =
            ReceiptScheduler.wrapHandler ivFn 1.0 entropyFn (Some receipts.Add) pureCounter

        let room =
            SimFramework.room
                "receipt-egress-unread"
                (fun _ -> ReceiptScheduler.receipted { N = 0 })
                [ receipted ]
                3
                (fun _ -> true)

        let! verdict = TickBoundaryProbe.probeRoom room 7L 2

        // The crossing HAPPENED — 6 receipts escaped the loop across two runs of 3 ticks …
        Assert.Equal(6, receipts.Count)
        // … and the probe saw nothing.
        Assert.False(
            TickBoundaryProbe.detected verdict,
            "the probe is expected to be blind here; if this now detects, the blind-spot note is stale"
        )
    }
    :> Task

// ── TICK-5: `CelegansController.Controller` is not a function of its declared argument ──────────
// The continuation-boundary audit (#11563) named this UNPROVEN: `CelegansController.fs:243` closes a
// `let mutable osc` into a `BeliefEstimator` that gets installed into a `RoomK` handler list, so the
// oscillator crosses tick boundaries outside `'S` — but `CelegansChip8Room.wormRoom` never completes
// a tick, so no harm was demonstrable. That was the right classification for HARM. It is the wrong
// one for the CROSSING, which is exhibitable directly and is exhibited here: the estimator's type is
// `InterruptKind -> Chip8Cow.Frame -> Belief`, and applying it twice to the SAME arguments yields
// different answers. Whatever it is, it is not that function.
//
// The connectome is built in-memory (`buildConnectome` is public), so this needs no CSV fixture and
// no 302-neuron load — the defect is in the closure, not in the biology.

[<Fact>]
let ``TICK-5: the worm's BeliefEstimator returns different beliefs for identical arguments`` () =
    let synapses: CelegansController.Synapse[] =
        [| { Pre = "AFDL"; Post = "AIYL"; Weight = 3.0; IsElectrical = false }
           { Pre = "AIYL"; Post = "VA1"; Weight = 2.0; IsElectrical = false }
           { Pre = "VA1"; Post = "VB1"; Weight = 1.0; IsElectrical = true }
           { Pre = "VB1"; Post = "AFDL"; Weight = 1.0; IsElectrical = false } |]

    let connectome = CelegansController.buildConnectome synapses
    let controller = CelegansController.Controller(connectome, 42UL)
    let estimator = controller.BeliefEstimator

    let frame = Chip8Cow.create 1UL
    let intr = TimerElapsed 17

    let verdict = TickBoundaryProbe.probeEstimator (fun (i, f) -> estimator i f) (intr, frame) 4

    match verdict with
    | TickBoundaryProbe.UndeclaredDetected(_, first, again) ->
        Assert.NotEqual(first, again)
    | other ->
        Assert.Fail(
            sprintf
                "expected the worm's oscillator to leak across calls; got %A. If this is now stable, the mutable `osc` at CelegansController.fs:243 was closed and R-1a's inventory needs updating."
                other
        )

// ── TICK-6: the same shape, stated as the general property a leak-free estimator has ───────────
// The control for TICK-5: a `BeliefEstimator`-shaped function with no captured mutable state is
// stable under the identical probe. Without this, TICK-5 would only show that `probeEstimator`
// reports divergence, not that the worm is the reason.

[<Fact>]
let ``TICK-6: a stateless estimator over the same arguments reports DeclaredOnly`` () =
    let stateless (_intr: InterruptKind) (f: Chip8Cow.Frame) = f.PC

    let frame = Chip8Cow.create 1UL
    let verdict = TickBoundaryProbe.probeEstimator (fun (i, f) -> stateless i f) (TimerElapsed 17, frame) 4

    Assert.False(TickBoundaryProbe.detected verdict)
