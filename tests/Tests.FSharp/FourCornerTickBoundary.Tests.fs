module Zeta.Tests.FourCornerTickBoundaryTests

// **The fourth corner at the tick boundary — `T In Feedback`, measured.**
//
// Design: `docs/research/2026-08-17-t-feedback-in-the-co-owned-fourth-corner-at-the-tick-boundary.md`
// Work item: 081M08WE9R3087G0R003PAK63F. Predecessor measurement: register row R-1a (PR #11660),
// which found that a tick boundary runs three of the four corners and that `ReceiptScheduler`'s
// `onReceipt : (Receipt -> unit) option` carries information out through a hole.
//
// These are falsifiers, not demonstrations. Each one names the mutation that must break it.

open System.Threading.Tasks
open Xunit
open Zeta.Core

// ── shared fixtures (deliberately the SAME shapes TickBoundaryProbe.Tests.fs uses) ──────────────

type Counter = { N: int }

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

let private timerOnly: SoftScheduler.Source = fun _ -> [ TimerElapsed 17 ]

let private ctx: IntrCtx = TickBoundaryProbe.probeCtx "four-corner"

/// The honest inner handler, arrival-aware: next state is a function of its declared argument.
let private pureCounterK: SoftScheduler.HandlerK<Counter> =
    SoftScheduler.handlerK "counter" isTimer (fun _intr _ctx st -> Task.FromResult(Ok { N = st.N + 1 }))

let private ivFn (prior: Counter) (posterior: Counter) : float =
    if posterior.N > prior.N then 1.0 else 0.0

let private entropyFn (_: Counter) : float = 0.0

// ── FIN-1: THE FALSIFIER THE DESIGN WAS SET ─────────────────────────────────────────────────────
// TICK-3 built a room from shipped API in which `onReceipt`'s sink is READ back by a second handler,
// and the probe convicted it: two runs, every declared channel byte-identical, different outcomes.
//
// This is that room rebuilt on the corner. The receipt now travels on `'F`; the reader handler still
// reads it — same information flow, same reader, same probe. The verdict must flip to DeclaredOnly.
//
// And this must NOT be TICK-4's blindness. TICK-4's `DeclaredOnly` came from nothing reading the
// sink. Here the reader reads it and folds it into `'S`, which the probe compares — so the assertion
// below also pins that the receipts genuinely arrived (`N` grows by the receipt count, and the corner
// holds one receipt per tick).
//
// MUTATION that must break it: make the corner not persist across ticks — e.g. `driveF`'s
// `coOwned <- corner.Merge coOwned contribution` → `coOwned <- contribution`. Then the reader sees at
// most one receipt per tick and `N` changes. Measured both ways in the PR body.

[<Fact>]
let ``FIN-1: the receipt on the co-owned corner reports DeclaredOnly where the callback convicted`` () =
    task {
        let receipted = ReceiptScheduler.wrapHandlerF ivFn 1.0 entropyFn pureCounterK

        // The same reader as TICK-3 — except it reads the CORNER, its declared argument, instead of
        // a collection captured from the enclosing scope.
        let reader: SoftScheduler.HandlerF<ReceiptScheduler.Receipted<Counter>, ComputeReceipt.Receipt list> =
            SoftScheduler.handlerF "reader" isTimer (fun _intr corner _ctx st ->
                Task.FromResult(Ok({ st with Inner = { N = st.Inner.N + List.length corner } }, [])))

        let! verdict =
            TickBoundaryProbe.probeScheduler
                "receipt-corner"
                (fun () -> SoftScheduler.driveF (SoftScheduler.appendCorner ()) [ receipted; reader ] timerOnly)
                7L
                (fun () -> ReceiptScheduler.receipted { N = 0 }, [])
                3
                2

        match verdict with
        | TickBoundaryProbe.DeclaredOnly(Ok(st, corner)) ->
            // Three ticks ran, so three receipts were emitted — onto the corner, where they stayed.
            Assert.Equal(3, st.Tick)
            Assert.Equal(3, List.length corner)
            // The reader actually read them: tick 1 adds 1, tick 2 adds 2, tick 3 adds 3 on top of
            // the counter's own three increments. If the corner were unread this would be 3.
            Assert.Equal(9, st.Inner.N)
        | other -> Assert.Fail(sprintf "expected DeclaredOnly with a full corner, got %A" other)
    }
    :> Task

// ── FIN-1b: the control — the SAME room built on the callback still convicts ────────────────────
// Without this, FIN-1 would only show that some room does not diverge. This pins that the difference
// is the corner and not the rebuild: identical inner handler, identical seed/source/budget, the only
// change is where the receipt travels.

[<Fact>]
let ``FIN-1b: the same room with onReceipt instead of the corner is still convicted`` () =
    task {
        let receipts = System.Collections.Generic.List<ComputeReceipt.Receipt>()

        let receipted =
            ReceiptScheduler.wrapHandlerK ivFn 1.0 entropyFn (Some receipts.Add) pureCounterK

        let reader: SoftScheduler.HandlerK<ReceiptScheduler.Receipted<Counter>> =
            SoftScheduler.handlerK "reader" isTimer (fun _intr _ctx st ->
                Task.FromResult(Ok { st with Inner = { N = st.Inner.N + receipts.Count } }))

        let! verdict =
            TickBoundaryProbe.probeHandlers
                "receipt-callback"
                [ receipted; reader ]
                timerOnly
                7L
                (fun () -> ReceiptScheduler.receipted { N = 0 })
                3
                2

        Assert.True(
            TickBoundaryProbe.detected verdict,
            sprintf
                "expected the callback room to still be convicted; got %A. If this now reports DeclaredOnly, `onReceipt` changed and FIN-1's claim needs re-measuring."
                verdict
        )
    }
    :> Task

// ── FIN-2: the migration law — no existing RunK site has to move ────────────────────────────────
// `HandlerK<'S>` is `HandlerF<'S, unit>`. If that is true operationally and not just by type, the
// ~20 shipped `RunK` sites migrate by choosing a corner when they want one, and never otherwise.
//
// MUTATION that must break it: any change to `driveF`'s loop order, arrival order, or stop-on-first-
// Error behaviour relative to `driveK`.

[<Fact>]
let ``FIN-2: driveF over the trivial corner is driveK`` () =
    task {
        let bumpBy (k: int) name =
            SoftScheduler.handlerK name isTimer (fun _intr _ctx st -> Task.FromResult(Ok { N = st.N + k }))

        let hs = [ bumpBy 1 "a"; bumpBy 10 "b"; bumpBy 100 "c" ]

        let! viaK = (SoftScheduler.driveK hs timerOnly).Run ctx 7L { N = 0 } 5

        let! viaF =
            (SoftScheduler.driveF SoftScheduler.unitCorner (List.map SoftScheduler.ofHandlerK hs) timerOnly)
                .Run
                ctx
                7L
                ({ N = 0 }, ())
                5

        Assert.Equal(Ok { N = 555 }, viaK)
        Assert.Equal(Ok({ N = 555 }, ()), viaF)
        Assert.Equal(viaK, viaF |> Result.map fst)
    }
    :> Task

// ── FIN-2b: the error position is unchanged — a corner does not rescue a short-circuit ──────────
// `T Out Feedback` still stops the run. If `driveF` returned a partial corner on Error it would be
// claiming the room got to finish speaking, which it did not.

[<Fact>]
let ``FIN-2b: driveF stops on the first Error and returns it, not a partial corner`` () =
    task {
        let contributor =
            SoftScheduler.handlerF "contributor" isTimer (fun _intr _c _ctx (st: Counter) ->
                Task.FromResult(Ok({ N = st.N + 1 }, [ "tick" ])))

        let failer =
            SoftScheduler.handlerF "failer" isTimer (fun _intr _c _ctx (_st: Counter) ->
                Task.FromResult(Error(Failed "stop")))

        let! outcome =
            (SoftScheduler.driveF (SoftScheduler.appendCorner ()) [ contributor; failer ] timerOnly)
                .Run
                ctx
                7L
                ({ N = 0 }, [])
                5

        Assert.Equal(Error(Failed "stop"), outcome)
    }
    :> Task

// ── FIN-3: the corner is CO-OWNED, not last-writer-wins ─────────────────────────────────────────
// The whole reason the corner needs a monoid: if both sides write, neither may overwrite. Two
// handlers contribute on the same tick and both contributions must survive, in order.
//
// MUTATION that must break it: `cornerOf [] (fun _ right -> right)` (last writer wins) or
// `fun left _ -> left` (first writer wins). Measured both ways in the PR body.

[<Fact>]
let ``FIN-3: two handlers contributing on one tick both survive the merge`` () =
    task {
        let says (word: string) =
            SoftScheduler.handlerF word isTimer (fun _intr _c _ctx (st: Counter) ->
                Task.FromResult(Ok({ N = st.N + 1 }, [ word ])))

        let! outcome =
            (SoftScheduler.driveF (SoftScheduler.appendCorner ()) [ says "room"; says "consumer" ] timerOnly)
                .Run
                ctx
                7L
                ({ N = 0 }, [])
                2

        match outcome with
        | Ok(st, corner) ->
            Assert.Equal(4, st.N)
            Assert.Equal<string list>([ "room"; "consumer"; "room"; "consumer" ], corner)
        | Error e -> Assert.Fail(sprintf "expected Ok, got %A" e)
    }
    :> Task

// ── FIN-4: §4 Claim B — the corner's algebra IS the trace's emission monoid ─────────────────────
// `ICoOwnedCorner` at `Empty = []`, `Merge = WSet.plus >> consolidate` is exactly the operation
// `FourCornerTrace.step` uses to fold a delta into `Emitted` (src/Core/WSet.fs:293). So a handler can
// contribute `[k, -w]` and RETRACT an earlier contribution *in the corner* — the DBSP -1 arriving at
// a tick boundary, which had no route before.
//
// This is the behavioural half of "one object, not two". The type-level half is that
// `SoftScheduler.toFourCorner` and `FourCornerTrace.toFourCorner` return the same
// `FourCorner.FourCornerOwnership` record (checked by FIN-5b below and by the compiler).
//
// MUTATION that must break it: drop the `consolidate` from the merge — then `+w` and `-w` sit side
// by side instead of annihilating, and the corner is a log rather than a Z-set.

let private intStar: IStarRing<int64> =
    { new IStarRing<int64> with
        member _.Zero = 0L
        member _.One = 1L
        member _.Add(a, b) = a + b
        member _.Mul(a, b) = a * b
        member _.Negate a = -a
        member _.Conj a = a }

let private isZeroI (w: int64) = w = 0L

/// The corner over a Z-set: the trace's own emission monoid, used as a tick-boundary corner.
let private zsetCorner: SoftScheduler.CoOwnedCorner<WSet.WSet<int, int64>> =
    SoftScheduler.cornerOf [] (fun left right -> WSet.plus left right |> WSet.consolidate intStar isZeroI)

[<Fact>]
let ``FIN-4: a WSet corner carries a retraction — the later contribution annihilates the earlier`` () =
    task {
        // Tick 0 emits (7, +1). Tick 1 retracts it with (7, -1). The corner must consolidate to empty.
        let emitter =
            SoftScheduler.handlerF "emitter" isTimer (fun _intr _c _ctx (st: Counter) ->
                let contribution: WSet.WSet<int, int64> =
                    if st.N = 0 then [ 7, 1L ] else [ 7, -1L ]

                Task.FromResult(Ok({ N = st.N + 1 }, contribution)))

        let! afterOne = (SoftScheduler.driveF zsetCorner [ emitter ] timerOnly).Run ctx 7L ({ N = 0 }, []) 1
        let! afterTwo = (SoftScheduler.driveF zsetCorner [ emitter ] timerOnly).Run ctx 7L ({ N = 0 }, []) 2

        match afterOne, afterTwo with
        | Ok(_, one), Ok(_, two) ->
            Assert.Equal<WSet.WSet<int, int64>>([ 7, 1L ], one)
            // Annihilated, not merely paired: `consolidate` drops the zero row entirely.
            Assert.Empty two
        | _ -> Assert.Fail(sprintf "expected two Ok outcomes, got %A / %A" afterOne afterTwo)
    }
    :> Task

// ── FIN-5: the consumer's OPENING contribution is a declared parameter ──────────────────────────
// This is what collapses TICK-3's divergence for the right reason rather than by silencing a sink:
// the corner's initial value arrives through `initial`, so it is declared, DST-replayable, and reset
// per run by construction. A handler must see it on the very first tick.

[<Fact>]
let ``FIN-5: a non-empty opening corner is visible to the first handler`` () =
    task {
        let echoes =
            SoftScheduler.handlerF "echoes" isTimer (fun _intr corner _ctx (st: Counter) ->
                Task.FromResult(Ok({ N = st.N + List.length corner }, [])))

        let! outcome =
            (SoftScheduler.driveF (SoftScheduler.appendCorner ()) [ echoes ] timerOnly)
                .Run
                ctx
                7L
                ({ N = 0 }, [ "budget-revision"; "ack" ])
                1

        match outcome with
        | Ok(st, _) -> Assert.Equal(2, st.N)
        | Error e -> Assert.Fail(sprintf "expected Ok, got %A" e)
    }
    :> Task

// ── FIN-5b: ONE four-corner object, not two ─────────────────────────────────────────────────────
// The design's hardest constraint: introducing a second four-corner notion would be a failure. This
// pins that `SoftScheduler.toFourCorner` returns the very record `FourCorner` defines and
// `FourCornerTrace.toFourCorner` also returns — same type constructor, two instantiations — and that
// the tick's corners land in the right slots.

[<Fact>]
let ``FIN-5b: a tick packages into the same FourCorner.FourCornerOwnership the trace uses`` () =
    let intr = TimerElapsed 17
    let ok: Result<Counter * string list, InterruptFeedback> = Ok({ N = 3 }, [ "receipt" ])

    let corners: FourCorner.FourCornerOwnership<InterruptKind, Counter, InterruptFeedback, string list> =
        SoftScheduler.toFourCorner intr ok

    Assert.Equal<InterruptKind>(intr, corners.TIn)
    Assert.Equal(Some { N = 3 }, corners.TOut)
    Assert.Equal(Some [ "receipt" ], corners.TInFeedback)
    Assert.True(corners.TOutFeedback.IsNone)
    Assert.True(FourCorner.hasOutput corners)
    Assert.True(FourCorner.hasFeedback corners)

    // The error case fills the OTHER feedback corner and no output corner — `T Out Feedback` is the
    // room authoring control-flow, and it short-circuits, so there is no state to emit.
    let failed: Result<Counter * string list, InterruptFeedback> = Error(Failed "stop")
    let errCorners = SoftScheduler.toFourCorner intr failed
    Assert.True(errCorners.TOut.IsNone)
    Assert.Equal(Some(Failed "stop"), errCorners.TOutFeedback)
    Assert.True(errCorners.TInFeedback.IsNone)
