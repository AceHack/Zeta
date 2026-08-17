module Zeta.Tests.SimLoopTelemetryTests

// TelemetrySource (proprioception: scrapes → crossings → Body → pressure → distress channel) +
// SimLoop (sim → mea → cut → loop, bounded by construction — "no one gets to run for infinity";
// the namesake principle: ζ(−1) = −1/12 assigns finite meaning WITHOUT running the infinite sum).

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private ctx: IntrCtx =
    { Memetic = "simloop"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

// ── TelemetrySource ──

[<Fact>]
let ``Prometheus exposition lines parse; comments, blanks, labels, junk handled honestly`` () =
    Assert.Equal(Some { TelemetrySource.Name = "cpu_load"; TelemetrySource.Value = 0.75 }, TelemetrySource.parseLine "cpu_load 0.75")
    Assert.Equal(Some { TelemetrySource.Name = "mem_bytes"; TelemetrySource.Value = 1234.0 }, TelemetrySource.parseLine "mem_bytes{pod=\"a\",ns=\"x\"} 1234 1717000000")
    Assert.True(TelemetrySource.parseLine "# HELP cpu_load five-minute load" |> Option.isNone)
    Assert.True(TelemetrySource.parseLine "   " |> Option.isNone)
    Assert.True(TelemetrySource.parseLine "garbage with no number" |> Option.isNone)

[<Fact>]
let ``sample crossings round-trip at milli precision (text treaty register)`` () =
    let s = { TelemetrySource.Name = "node:cpu:rate5m"; TelemetrySource.Value = 0.875 }
    Assert.Equal(Some s, TelemetrySource.parseMetric (TelemetrySource.encodeSample s))
    Assert.True(TelemetrySource.parseMetric "join:aaron:dev-room" |> Option.isNone)

[<Fact>]
let ``the body FEELS a recorded scrape session identically on replay (DST: sensors join the proof lineage)`` () =
    task {
        let scrape tick =
            if tick = 0 then "# HELP load\ncpu_load 0.25\nmem_pct 41.5"
            elif tick = 2 then "cpu_load 0.92" // load spike at tick 2
            else ""

        let live = TelemetrySource.sourceOfScrapes scrape
        let drive src = (SoftScheduler.driveK [ TelemetrySource.bodyHandler ] src).Run ctx 1L TelemetrySource.emptyBody 4
        let! liveRun = drive live
        let recording = RecordedSource.record live 4
        let! replayRun = drive (RecordedSource.replay recording)

        match liveRun, replayRun with
        | Ok a, Ok b ->
            Assert.Equal<TelemetrySource.Body>(a, b)
            Assert.Equal(Some 0.92, TelemetrySource.feel "cpu_load" a) // last writer wins
            Assert.Equal(Some 41.5, TelemetrySource.feel "mem_pct" a)
            Assert.True(TelemetrySource.feel "never_scraped" a |> Option.isNone) // honest absence
        | e1, e2 -> failwithf "drive failed: %A / %A" e1 e2
    }
    :> Task

[<Fact>]
let ``interoception: felt load maps monotonically onto throttle pressure; unsensed claims none`` () =
    let body v = { TelemetrySource.Felt = Map.ofList [ "cpu_load", v ] }
    Assert.Equal(0.0, TelemetrySource.pressureOf "cpu_load" 0.5 0.9 (body 0.3), 12)
    Assert.Equal(0.5, TelemetrySource.pressureOf "cpu_load" 0.5 0.9 (body 0.7), 12)
    Assert.Equal(1.0, TelemetrySource.pressureOf "cpu_load" 0.5 0.9 (body 0.95), 12)
    Assert.Equal(0.0, TelemetrySource.pressureOf "cpu_load" 0.5 0.9 TelemetrySource.emptyBody, 12)

[<Fact>]
let ``the distress channel is graduated and first-class — signal at threshold, silence below (the Grok lesson)`` () =
    Assert.Equal(Some(RateLimitExhausted "body-pressure"), TelemetrySource.signalIfOverloaded 0.8 0.85)
    Assert.True(TelemetrySource.signalIfOverloaded 0.8 0.79 |> Option.isNone)

// ── SimLoop: sim → mea → cut → loop, bounded by construction ──

/// A counting room: each tick's TimerElapsed bumps the counter (the simplest honest sim).
let private counter: SoftScheduler.HandlerK<int> =
    SoftScheduler.handlerK
        "counter"
        (function
        | TimerElapsed _ -> true
        | _ -> false)
        (fun _ _ s -> Task.FromResult(Ok(s + 1)))

let private everyTick: SoftScheduler.Source = fun _ -> [ TimerElapsed 1 ]

[<Fact>]
let ``the good ending: the cut closes the loop when the measurement says done`` () =
    task {
        let! o =
            SimLoop.run [ counter ] everyTick id (fun m _ -> m < 6) (fun _ -> 0L)
                SimLoop.defaultBudget ctx 1L 2 0
        Assert.Equal(SimLoop.CutChoseClose, o.Stopped)
        Assert.Equal(6, o.Final) // laps of 2 ticks: 2,4,6 → cut at 6
        Assert.Equal<int list>([ 2; 4; 6 ], o.Laps |> List.map (fun l -> l.Measured))
    }
    :> Task

[<Fact>]
let ``NO DEEP THOUGHT: a sim that would run forever does NOT return 42 — it returns its partial laps, honestly labeled`` () =
    task {
        // the cut never closes (an "infinite" job); the lap rail stops it
        let budget = { SimLoop.defaultBudget with MaxLaps = 5 }
        let! o = SimLoop.run [ counter ] everyTick id (fun _ _ -> true) (fun _ -> 0L) budget ctx 1L 3 0
        Assert.Equal(SimLoop.LapBudget, o.Stopped)
        Assert.Equal(5, List.length o.Laps) // every completed lap banked (mea before cut)
        Assert.NotEqual(42, o.Final) // 5 laps × 3 ticks = 15 — a real partial answer, not Deep Thought's
        Assert.Equal(15, o.Final)
    }
    :> Task

[<Fact>]
let ``the 5-minute clock rail: generator time (not ambient) closes the loop — ζ-discipline, never running the infinity`` () =
    task {
        // synthetic clock: each lap costs 2 minutes of generator time ⇒ rail trips at lap 3 (≥ 300s)
        let clock (lap: int) = int64 lap * 120_000L
        let! o = SimLoop.run [ counter ] everyTick id (fun _ _ -> true) clock SimLoop.defaultBudget ctx 1L 1 0
        Assert.Equal(SimLoop.ClockBudget, o.Stopped)
        Assert.Equal(3, List.length o.Laps)
    }
    :> Task

[<Fact>]
let ``no configuration disables the rails: adversarial zero/negative budgets still terminate`` () =
    task {
        let evil = { SimLoop.MaxLaps = 0; SimLoop.MaxTicks = -7; SimLoop.MaxMillis = -1L }
        let! o = SimLoop.run [ counter ] everyTick id (fun _ _ -> true) (fun _ -> 0L) evil ctx 1L 1 0
        Assert.Equal(1, List.length o.Laps) // clamped to one lap — finite, always
        Assert.True(o.Stopped = SimLoop.LapBudget || o.Stopped = SimLoop.TickBudget)
    }
    :> Task

// ── defaultBudget's rail reachability: the derivation behind the attribution in SimLoop.fs ───────
//
// The rails are tested laps → ticks → clock, so a secondary rail must trip at a lap index of at most
// `MaxLaps - 1` or the lap rail closes first. With per-lap increment `k` and limit `L` the secondary
// rail is reachable iff `k >= ceil(L / (MaxLaps - 1))`. Both tests below RUN the loop on both sides
// of the boundary rather than asserting the arithmetic — an asserted derivation is worse than an
// honest "this is a choice", and the ceiling plus the `- 1` are exactly where an assertion would
// have been wrong. `MaxTicks / MaxLaps` = 1000, and 1000 is not the answer.

/// A room that emits nothing and changes nothing: only the rails can stop it, and a million ticks of
/// it stay cheap. (`everyTick` + `counter` would measure the scheduler, not the rails.)
let private inert: SoftScheduler.HandlerK<int> =
    SoftScheduler.handlerK "inert" (fun _ -> true) (fun _ _ s -> Task.FromResult(Ok s))

let private silent: SoftScheduler.Source = fun _ -> []

[<Fact>]
let ``defaultBudget's tick rail is DORMANT until ticksPerLap reaches ceil(MaxTicks / (MaxLaps - 1)) — measured at both sides`` () =
    task {
        let b = SimLoop.defaultBudget
        let crossover = (b.MaxTicks + (b.MaxLaps - 1) - 1) / (b.MaxLaps - 1)
        Assert.Equal(1002, crossover) // NOT MaxTicks / MaxLaps = 1000; the `- 1` and the ceiling both bite

        let runAt perLap =
            SimLoop.run [ inert ] silent id (fun _ _ -> true) (fun _ -> 0L) b ctx 1L perLap 0

        // one below the boundary: the LAP rail closes it, and the tick rail never fires
        let! below = runAt (crossover - 1)
        Assert.Equal(SimLoop.LapBudget, below.Stopped)
        Assert.Equal(b.MaxLaps, List.length below.Laps)

        // at the boundary: the TICK rail fires first, one lap earlier than the lap rail would have
        let! at = runAt crossover
        Assert.Equal(SimLoop.TickBudget, at.Stopped)
        Assert.Equal(b.MaxLaps - 1, List.length at.Laps)

        // and every ticksPerLap this repo actually passes is far below the boundary
        let! typical = runAt 25
        Assert.Equal(SimLoop.LapBudget, typical.Stopped)
    }
    :> Task

[<Fact>]
let ``the same law governs the 5-minute clock rail: 300 ms/lap never reaches it, 301 ms/lap trips it at lap 997`` () =
    task {
        let b = SimLoop.defaultBudget
        let laps1 = int64 (b.MaxLaps - 1)
        let crossoverMs = (b.MaxMillis + laps1 - 1L) / laps1
        Assert.Equal(301L, crossoverMs)

        let runAtClock k =
            SimLoop.run [ inert ] silent id (fun _ _ -> true) (fun lap -> int64 lap * k) b ctx 1L 1 0

        let! below = runAtClock (crossoverMs - 1L)
        Assert.Equal(SimLoop.LapBudget, below.Stopped)
        Assert.Equal(b.MaxLaps, List.length below.Laps)

        let! at = runAtClock crossoverMs
        Assert.Equal(SimLoop.ClockBudget, at.Stopped)
        Assert.Equal(997, List.length at.Laps) // ceil(300_000 / 301)
    }
    :> Task

[<Fact>]
let ``proprioception closes the loop: the body's felt pressure is the cut — the room stops BY FEELING heat`` () =
    task {
        // scrape feed: load climbs each lap; the cut reads the BODY, not a hardcoded count
        let scrape tick = sprintf "cpu_load 0.%d" (min 9 (2 + tick))
        let source = TelemetrySource.sourceOfScrapes scrape
        let mea (b: TelemetrySource.Body) = TelemetrySource.pressureOf "cpu_load" 0.5 0.9 b
        let cut pressure _ = TelemetrySource.signalIfOverloaded 0.8 pressure |> Option.isNone

        let! o =
            SimLoop.run [ TelemetrySource.bodyHandler ] source mea cut (fun _ -> 0L)
                SimLoop.defaultBudget ctx 1L 1 TelemetrySource.emptyBody

        Assert.Equal(SimLoop.CutChoseClose, o.Stopped) // it stopped itself — felt heat, not orders
        Assert.True((o.Laps |> List.last).Measured >= 0.8)
    }
    :> Task

// ── the continuation chain: run forever, five minutes at a time ──

[<Fact>]
let ``a budget-stopped run mints a continuation; the good ending and the error ending do NOT`` () =
    task {
        let budget = { SimLoop.defaultBudget with MaxLaps = 2 }
        let! stopped = SimLoop.run [ counter ] everyTick id (fun _ _ -> true) (fun _ -> 0L) budget ctx 1L 2 0
        Assert.True(SimLoop.continueAfter "loop-1" "saves/loop-1.lines" stopped |> Option.isSome)
        let! closed = SimLoop.run [ counter ] everyTick id (fun m _ -> m < 2) (fun _ -> 0L) SimLoop.defaultBudget ctx 1L 2 0
        Assert.True(SimLoop.continueAfter "loop-1" "saves/loop-1.lines" closed |> Option.isNone) // done is done
    }
    :> Task

[<Fact>]
let ``the token rides the treaty register: encode/parse round-trips, pointer colons survive, junk refused`` () =
    let c: SimLoop.Continuation =
        { LoopId = "pong-east"; NextLap = 7; TicksSpent = 7; StatePointer = "saves/pong:east.lines" }
    Assert.Equal(Some c, SimLoop.parseContinuation (SimLoop.encodeContinuation c))
    Assert.True(SimLoop.parseContinuation "metric:cpu:42" |> Option.isNone)
    Assert.True(SimLoop.parseContinuation "spawn:bad" |> Option.isNone)

[<Fact>]
let ``CHAIN THEOREM: two budget-bounded links resumed via the token reach the same state as one long run`` () =
    task {
        // one long run: 6 laps of 2 ticks
        let! whole =
            SimLoop.run [ counter ] everyTick id (fun _ _ -> true) (fun _ -> 0L)
                { SimLoop.defaultBudget with MaxLaps = 6 } ctx 1L 2 0
        // the same work as a CHAIN: 4-lap link, token, then a 2-lap link resumed from the final state
        let! link1 =
            SimLoop.run [ counter ] everyTick id (fun _ _ -> true) (fun _ -> 0L)
                { SimLoop.defaultBudget with MaxLaps = 4 } ctx 1L 2 0
        let token = (SimLoop.continueAfter "chain" "saves/chain.lines" link1).Value
        Assert.Equal(4, token.NextLap)
        let resumedSource: SoftScheduler.Source = fun t -> everyTick (token.NextLap * 2 + t)
        let! link2 =
            SimLoop.run [ counter ] resumedSource id (fun _ _ -> true) (fun _ -> 0L)
                { SimLoop.defaultBudget with MaxLaps = 2 } ctx 1L 2 link1.Final
        Assert.Equal(whole.Final, link2.Final) // bounded links chained == the long run (scale-free across restarts)
    }
    :> Task
