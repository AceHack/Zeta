module Zeta.Tests.SimVerbTests

// `sim` as the room runner — the tests that make the claims falsifiable.
//
// Register: the DST claims here are checked by BYTE COMPARISON of the canonical run encoding, not by
// spot-checking a field. A DST assertion that compares one integer is the vacuity class; a byte-lock
// over the whole run is what fails when determinism breaks.
//
// Anchor: the vocabulary (Room as uncertainty engine; the five-way known/unknown/assumed/disputed/
// decided ledger; Z-set as reversible present, G-set as irreversible past) is Addison Cooper's,
// *Genesis Concepts* 2026-06-20 — in-repo at `docs/design/root-site-iris/Genesis Concepts.dc.html`.

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private isTimer =
    function
    | TimerElapsed _ -> true
    | _ -> false

let private isOperator =
    function
    | OperatorMessageArrived _ -> true
    | _ -> false

/// The room's state: how many timer ticks have landed, and how many operator messages arrived.
type private RoomState = { Ticks: int; Messages: int }

/// A small budget so a test run is short and the rails are exercised, not decorative.
let private testBudget =
    SimVerb.inheritedBudget
        "081M08802CZ087G0R0010ZE6FQ"
        "test rails: small enough to run fast, finite by construction"
        { SimLoop.MaxLaps = 8
          SimLoop.MaxTicks = 400
          SimLoop.MaxMillis = 60_000L }

/// The uncertainty lens — the room's five-way claim ledger, read off its state.
///
/// It moves through the states as evidence arrives, and it deliberately holds a `Disputed` claim
/// open rather than resolving it: that is the behaviour Addison's definition requires and the thing
/// a collapsing runner would destroy.
let private ledgerOf (s: RoomState) : SimVerb.Uncertainty<string> =
    let claim (q: string) (st: SimVerb.Epistemic) : SimVerb.Claim<string> * Weight =
        { Question = q; State = st }, 1L

    [ // "has the room started" — Unknown until any tick lands, then Known.
      claim "started" (if s.Ticks > 0 then SimVerb.Known else SimVerb.Unknown)
      // "is the operator present" — Assumed once a message arrives, Unknown before.
      claim "operator-present" (if s.Messages > 0 then SimVerb.Assumed else SimVerb.Unknown)
      // "is the tick rate nominal" — held DISPUTED while evidence conflicts; never auto-resolved.
      claim "tick-rate-nominal" (if s.Ticks > 200 then SimVerb.Decided else SimVerb.Disputed)
      // How many crossings the room has actually seen. The count is in the KEY, not the state, so
      // the Z-set delta is sensitive to the trajectory and not only to a coarse threshold.
      //
      // This claim exists because of a measured failure: without it, a mutant that leaked ambient
      // entropy past the injected membrane did NOT fail the DST byte-lock, because the extra
      // crossings never moved the three threshold-shaped claims above. A byte-lock is only as
      // discriminating as the lens it measures through — a lens that cannot see the mutation makes
      // the DST assertion vacuous. Both mutants kill this suite now; neither killed it before.
      claim (sprintf "crossings-seen-%d" s.Messages) SimVerb.Known ]
    |> ZSet.ofSeq

let private handlers: SoftScheduler.HandlerK<RoomState> list =
    [ SoftScheduler.handlerK "tick" isTimer (fun _ _ s -> Task.FromResult(Ok { s with Ticks = s.Ticks + 1 }))
      SoftScheduler.handlerK "msg" isOperator (fun _ _ s -> Task.FromResult(Ok { s with Messages = s.Messages + 1 })) ]

let private theRoom: SimVerb.Room<RoomState, string> =
    SimVerb.room "uncertainty-room" (fun _ -> { Ticks = 0; Messages = 0 }) handlers ledgerOf 25 testBudget

// ── DST: the byte-lock ───────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``DST: same room, same seed replays BYTE-IDENTICALLY (the whole run, not one field)`` () =
    task {
        let! a = SimVerb.run theRoom 4L
        let! b = SimVerb.run theRoom 4L
        // The falsifier: the entire canonical encoding, byte for byte.
        Assert.Equal(SimVerb.encodeRun a, SimVerb.encodeRun b)
        // And it is not vacuous — the encoding actually carries the run.
        Assert.Contains("lap:0", SimVerb.encodeRun a, System.StringComparison.Ordinal)
    }

[<Fact>]
let ``DST is DISCRIMINATING: a different seed produces a different run (the byte-lock can fail)`` () =
    task {
        // If this passed for every seed, the equality test above would prove nothing. The seed source
        // derives operator arrivals from (seed, tick), so distinct seeds must diverge.
        let! a = SimVerb.run theRoom 4L
        let! b = SimVerb.run theRoom 99L
        Assert.NotEqual<string>(SimVerb.encodeRun a, SimVerb.encodeRun b)
    }

// ── The seam: real vs simulated, chosen by INJECTION, no flag ────────────────────────────────────

[<Fact>]
let ``the seam: record a LIVE (impure) source, replay it, and the SAME room reproduces the run`` () =
    task {
        // A live source that reads a genuinely ambient, non-deterministic value. This stands in for
        // real I/O — it is exactly what must NOT be allowed to reach the run un-metered.
        let live: SoftScheduler.Source =
            fun n ->
                let ambient = System.Random.Shared.Next(0, 1000)
                [ TimerElapsed 17
                  if n % 7 = 3 then
                      OperatorMessageArrived(sprintf "live-%d-%d" n ambient) ]

        // Metered at the membrane: every crossing recorded as TEXT.
        let recording = RecordedSource.record live 400
        let replayRoom = theRoom |> SimVerb.withSource (fun _ -> RecordedSource.replay recording)

        let! a = SimVerb.run replayRoom 4L
        let! b = SimVerb.run replayRoom 4L

        // DST survives real I/O: record the crossings, replay the crossings.
        Assert.Equal(SimVerb.encodeRun a, SimVerb.encodeRun b)
    }

[<Fact>]
let ``the seam is a SUBSTITUTION: the same room runs on seed and recorded membranes, no flag`` () =
    task {
        // A QUIET membrane: the timer ticks, but the operator never speaks. Under the seed membrane
        // the operator does speak, so the two runs must disagree about `operator-present` — that is
        // what shows the membrane is load-bearing rather than decorative.
        //
        // (First written with a membrane that also delivered an operator message; the two runs then
        // encoded IDENTICALLY and the assertion failed. The lens was too coarse to see the
        // difference, which was a fact about the room, not about the seam. Recorded here because a
        // test that cannot distinguish its two arms is the vacuity class.)
        let quiet = RecordedSource.record (fun _ -> [ TimerElapsed 17 ]) 400

        let simulated = theRoom
        let recorded = theRoom |> SimVerb.withSource (fun _ -> RecordedSource.replay quiet)

        let! s = SimVerb.run simulated 4L
        let! r = SimVerb.run recorded 4L

        // Same room, same code path, different membrane — no flag was consulted anywhere.
        Assert.Equal(s.Room, r.Room)
        Assert.NotEqual<string>(SimVerb.encodeRun s, SimVerb.encodeRun r)

        // And the difference is exactly the evidence the membrane carried: on the quiet membrane the
        // room holds "operator-present" as UNKNOWN rather than assuming it. It does not guess.
        Assert.Equal(0L, r.FinalCensus.Assumed) // quiet membrane: nothing assumed about the operator
        Assert.Equal(1L, r.FinalCensus.Unknown) // it is held UNKNOWN — the room does not guess
        Assert.Equal(1L, s.FinalCensus.Assumed) // seed membrane: the operator spoke, so it is assumed
        Assert.Equal(0L, s.FinalCensus.Unknown)
    }

// ── The clock is injected, and it is load-bearing ────────────────────────────────────────────────

[<Fact>]
let ``the generator clock is a FIELD: injecting an exhausted clock stops the run on the clock rail`` () =
    task {
        // A synthetic clock that reports the budget as already spent. No wall clock is consulted;
        // there is no `DateTime.Now` reachable from inside a room.
        let exhausted = theRoom |> SimVerb.withClock (fun lap -> int64 lap * 100_000L)
        let! r = SimVerb.run exhausted 4L
        Assert.Equal(SimLoop.ClockBudget, r.Stopped)
    }

[<Fact>]
let ``an ambient wall clock would BREAK the byte-lock (why the clock must stay injected)`` () =
    task {
        // The mutant expressed as a test rather than asserted in prose. `DateTime.Now` is reachable
        // here ONLY because the test wires it in from outside; nothing inside a room can reach it.
        //
        // The falsifiable damage: with the injected synthetic clock, the seed determines the run —
        // two seeds give two different traces. With an ambient wall clock, both seeds give the same
        // degenerate one-lap trace, because wall-time-since-epoch exceeds any budget on the first
        // lap. The seed has stopped mattering, which is exactly what DST guarantees against.
        let ambient = theRoom |> SimVerb.withClock (fun _ -> System.DateTime.Now.Ticks / 10_000L)

        let! injectedA = SimVerb.run theRoom 4L
        let! injectedB = SimVerb.run theRoom 99L
        Assert.NotEqual<string>(SimVerb.encodeRun injectedA, SimVerb.encodeRun injectedB) // seed matters

        let! ambientA = SimVerb.run ambient 4L
        let! ambientB = SimVerb.run ambient 99L
        Assert.Equal(SimLoop.ClockBudget, ambientA.Stopped)
        Assert.Equal(SimLoop.ClockBudget, ambientB.Stopped)
        Assert.Equal(1, List.length ambientA.Laps) // the room never got to do its work
        Assert.Equal(List.length ambientA.Laps, List.length ambientB.Laps) // the seed stopped mattering
    }

// ── The five-way ledger is preserved, not collapsed ──────────────────────────────────────────────

[<Fact>]
let ``the room does NOT collapse uncertainty: Disputed is carried through, uncollapsed`` () =
    task {
        let! r = SimVerb.run theRoom 4L
        // A disputed claim is held open across the run; the runner never resolves it by fiat.
        Assert.True(r.Laps |> List.forall (fun m -> m.Before.Disputed + m.After.Disputed > 0L))
        // And the census is genuinely five-way — the trace carries all five counters.
        let text = SimVerb.encodeRun r
        Assert.Contains("k=", text, System.StringComparison.Ordinal)
        Assert.Contains("x=", text, System.StringComparison.Ordinal)
        Assert.Contains("d=", text, System.StringComparison.Ordinal)
    }

[<Fact>]
let ``the collapse to a verdict is an INJECTED oracle: a different oracle reads the same run`` () =
    task {
        // §11 multi-oracle: the five-way fact is neutral; the reading is chosen. An inverted oracle
        // must be able to reach the opposite verdict from the identical ledger.
        let inverted: SimVerb.ResolutionOracle =
            { Name = "inverted"
              Attribution = "test oracle: the dual reading, to prove the collapse is not baked in"
              Rank =
                fun e ->
                    match e with
                    | SimVerb.Unknown -> 4
                    | SimVerb.Assumed -> 3
                    | SimVerb.Disputed -> 2
                    | SimVerb.Decided -> 1
                    | SimVerb.Known -> 0 }

        let! withDefault = SimVerb.run theRoom 4L
        let! withInverted = SimVerb.run (theRoom |> SimVerb.withOracle inverted) 4L

        Assert.Equal("default", withDefault.Oracle)
        Assert.Equal("inverted", withInverted.Oracle)
        // The neutral fact is identical; only the reading differs.
        Assert.Equal<SimVerb.Census>(withDefault.FinalCensus, withInverted.FinalCensus)
        Assert.NotEqual<SimVerb.DeltaU>(withDefault.Net, withInverted.Net)
    }

// ── The G-set: grow-only, idempotent, commutative ────────────────────────────────────────────────

[<Fact>]
let ``mea writes a G-set: the fold is idempotent and order-free (the past cannot be un-happened)`` () =
    task {
        let! r = SimVerb.run theRoom 4L
        let once = r.Ledger
        // Idempotent (§12): merging a ledger with itself changes nothing.
        Assert.Equal<GSet<string>>(once, SimVerb.mergeLedgers once once)
        // Commutative: reversed lap order folds to the same ledger.
        let reversed = SimVerb.ledgerOf (List.rev r.Laps)
        Assert.Equal<GSet<string>>(once, reversed)
        // Grow-only: merging two runs' ledgers never loses an entry.
        let! other = SimVerb.run theRoom 99L
        let merged = SimVerb.mergeLedgers once other.Ledger
        Assert.True(merged.Count >= once.Count)
        Assert.True(merged.Count >= other.Ledger.Count)
    }

// ── Budget attribution (the hidden-oracle guard) ─────────────────────────────────────────────────

[<Fact>]
let ``every budget carries its provenance into the run record — no bare constants`` () =
    task {
        let! r = SimVerb.run theRoom 4L
        let text = SimVerb.encodeRun r
        Assert.Contains("workitem=081M08802CZ087G0R0010ZE6FQ", text, System.StringComparison.Ordinal)

        // And the toy default is legible as a toy at its use site, never as an earned limit.
        let toy = SimVerb.toyBudget "SimLoop.defaultBudget is unattributed on main"
        Assert.Contains("src=toy:", SimVerb.describeBudget toy, System.StringComparison.Ordinal)
    }

// ── The run is bounded by construction ───────────────────────────────────────────────────────────

[<Fact>]
let ``no room runs forever: an always-unresolved room stops on a finite rail, honestly labelled`` () =
    task {
        // A room whose ledger never resolves — the cut would loop forever if the rails were optional.
        let stuck: SimVerb.Claim<string> = { Question = "forever"; State = SimVerb.Unknown }
        let neverResolves = theRoom |> SimVerb.withLedger (fun _ -> ZSet.ofSeq [ stuck, 1L ])

        let! r = SimVerb.run neverResolves 4L

        // Deliberately EXACT, not "any of the three rails". The loose version was written first and a
        // mutant that made the runner read `DateTime.Now` instead of the injected `room.Clock`
        // SURVIVED it: every run then stopped on `ClockBudget` after one lap, which the loose match
        // happily accepted. A test that accepts every outcome the mutation produces is the vacuity
        // class. Pinning the rail AND the lap count is what makes the injected clock falsifiable.
        Assert.Equal(SimLoop.LapBudget, r.Stopped)
        Assert.Equal(8, List.length r.Laps) // ran the full lap budget on the injected zero clock
    }

[<Fact>]
let ``the INJECTED clock, not an ambient one, decides the rail (kills the DateTime.Now mutant)`` () =
    task {
        // Same room, two injected clocks, two different rails. Neither run consults wall time, so
        // this pair is stable on any machine at any hour — and a runner that substituted its own
        // time source could not produce both results.
        let zeroClock = theRoom |> SimVerb.withClock (fun _ -> 0L)
        let spentClock = theRoom |> SimVerb.withClock (fun lap -> int64 lap * 100_000L)

        let! slow = SimVerb.run zeroClock 4L
        let! fast = SimVerb.run spentClock 4L

        Assert.Equal(SimLoop.LapBudget, slow.Stopped)
        Assert.Equal(SimLoop.ClockBudget, fast.Stopped)
        Assert.True(List.length slow.Laps > List.length fast.Laps)
    }
