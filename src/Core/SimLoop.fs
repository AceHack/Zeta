namespace Zeta.Core

/// SimLoop — **the room that loops `sim → mea → cut → loop`, BOUNDED BY CONSTRUCTION** (Aaron
/// 2026-06-11: "do we have a room we can sim loop = room > mea > cut > loop?" + "default timeout 5
/// minutes or something" + "no one gets to run for infinity" + "no sim infinity that returns 42").
///
/// The lap: **sim** (drive the room's handlers for a bounded burst of ticks) → **mea** (commit a
/// measurement of the state — the lap's ΔU, never skipped) → **cut** (the boundary decision: continue
/// or close) → loop. Three budgets gate every lap and ALL are finite — laps, total ticks, and
/// generator-clock milliseconds (default 5 minutes). There is no configuration in which the loop is
/// unbounded: `Budget` fields are clamped to ≥1 lap/tick/ms, so even adversarial inputs terminate.
///
/// **Time is a GENERATOR FUNCTION, not ambient** (the bounded-DST base): the wall-clock bound reads
/// `clock: lap → elapsedMillis`, injected — tests use synthetic time, production injects a monotonic
/// stopwatch. Same code path (DoP=1 discipline), replayable either way.
///
/// **No Deep Thought:** a sim that would run forever doesn't "eventually return 42" — it returns its
/// PARTIAL measurements at the cut, honestly labeled with why it stopped (`Stopped`). Every run yields
/// the lap ledger (mea is per-lap, so even a budget-killed run banked every lap it completed).
[<RequireQualifiedAccess>]
module SimLoop =

    /// Why the loop closed — always one of these; "still running" is not a final state.
    type Stopped =
        | CutChoseClose // the cut decided the work is done (the good ending)
        | LapBudget // max laps reached
        | TickBudget // max total ticks reached
        | ClockBudget // max generator-clock millis reached (default: the 5 minutes)
        | RoomError of InterruptFeedback // the room's drive returned Error

    /// The three finite gates. Clamped at use: no field can disable its bound.
    type Budget =
        { MaxLaps: int
          MaxTicks: int
          MaxMillis: int64 }

    /// The default rails — **three numbers with three different provenances, each now on the record.**
    ///
    /// A budget is not a defect: §4 bounded mobility and this module's own "no one gets to run for
    /// infinity" both REQUIRE one. **The discriminator is attribution** (Aaron 2026-08-17: *"always be
    /// on the lookout where the measurement or the limit/budget becomes the oracle silently — this is
    /// accidental hierarchy or control"*). These three shipped in #7646 with only one of them chosen by
    /// anyone on the record; the other two were the implementing agent's, unexplained. That is the
    /// hidden-oracle class, and this block is the repair. **No value changed** — a default is behaviour,
    /// and re-picking numbers to make a story tidy would be the same defect with better prose.
    ///
    /// **THE REACHABILITY LAW (derived, then measured).** The rails are tested in a fixed order — laps,
    /// then ticks, then clock — so a secondary rail must trip at a lap index of at most `MaxLaps - 1` or
    /// the lap rail gets there first. With per-lap increment `k` and limit `L`, the secondary rail is
    /// reachable iff `(MaxLaps - 1) * k >= L`, i.e. iff `k >= ceil(L / (MaxLaps - 1))`. The `- 1` and the
    /// ceiling are both load-bearing; the naive `L / MaxLaps` is wrong, and it is wrong by two here.
    /// `MaxLaps` is therefore the PRIMARY rail: it is the one that binds unless a caller drives the
    /// secondary rate above its threshold. Falsifier for all of it — the two "rail-reachability" tests in
    /// `tests/Tests.FSharp/SimLoopTelemetry.Tests.fs`, which RUN this loop at both sides of each boundary.
    ///
    /// **`MaxMillis = 300_000L` — an inherited HUMAN choice, and the only one of the three that had a
    /// name attached before today.** Aaron 2026-06-11: *"default timeout 5 minutes or something"*, quoted
    /// in this module's header and carried in #7646's own signature as
    /// `authorization: aaron-authored (… 5-min default)`. The *"or something"* is part of the
    /// attribution rather than noise: the maintainer declared a dial, and it stays his to retune.
    /// Measured consequence at this default: a clock advancing 300 ms/lap never reaches it (the lap rail
    /// closes first), 301 ms/lap trips it at lap 997 — `ceil(300_000 / 999) = 301`.
    ///
    /// **`MaxLaps = 1_000` — a CHOICE, and there is no derivation available to replace it.** Said
    /// plainly because the alternative is manufacturing one: `SimLoop.run` is universally quantified over
    /// the room state `'S`, and `cut` / `mea` / `ticksPerLap` are all caller-supplied, so there is no
    /// state machine to walk and no longest-advancing-path to measure. Contrast the case where that
    /// derivation *was* available — `src/Core.TypeScript/observe/tick-budget.ts` (#11539) walked a closed
    /// 115-state machine, measured a diameter of 6, and set the budget to 6 exactly. Nothing of that kind
    /// exists here, and #11539 left `ARC_SWARM_TICK_BUDGET` unmoved for the same reason: refusing to
    /// derive a number that cannot be derived is the correct outcome. Chosen by the implementing agent in
    /// #7646 with no reason recorded; a retunable policy dial, inherited unchanged, now labelled as one.
    ///
    /// **`MaxTicks = 1_000_000` — a choice whose entire effect IS derivable, and it is measured.** By the
    /// law above it can only fire when `ticksPerLap >= ceil(1_000_000 / 999) = 1002`. Measured: at 1001
    /// the run stops on `LapBudget` after 1000 laps; at 1002 it stops on `TickBudget` after 999. Every
    /// `ticksPerLap` this repo actually passes is between 1 and 25, so under this default the tick rail is
    /// **dormant** — real, clamped, and never the rail that fires. That is a fact about the default, not a
    /// defect in the rail: a caller passing a large burst re-arms it immediately, which is what it is for.
    ///
    /// Note for anyone re-running `bun src/Core.TypeScript/hygiene/audit-hidden-oracles.ts` against this
    /// block: the detector cannot see these three fields, and could not before this comment existed. Its
    /// gating test looks for the declared name in a relational comparison, and `run` compares the *clamped
    /// locals* (`maxLaps` / `maxTicks` / `maxMillis`), never the record fields. That is the declared
    /// "F# COVERAGE IS DECLARATION-LEVEL ONLY" limit, not a bug to route around — this attribution is
    /// owed to the reader, not to the linter.
    let defaultBudget: Budget =
        { MaxLaps = 1_000 // PRIMARY rail. A choice (#7646), not derivable: 'S is universally quantified.
          MaxTicks = 1_000_000 // Dormant below ticksPerLap = 1002 = ceil(MaxTicks / (MaxLaps - 1)). Measured.
          MaxMillis = 300_000L } // Aaron 2026-06-11, "default timeout 5 minutes or something" (#7646).

    /// One lap's banked record: which lap, the measurement, the state it measured.
    type Lap<'S, 'M> = { N: int; Measured: 'M; State: 'S }

    /// The run's full, honest result: every completed lap + why it stopped + the final state.
    type Outcome<'S, 'M> =
        { Laps: Lap<'S, 'M> list
          Stopped: Stopped
          Final: 'S }

    /// Run the loop. `sim` = `driveK` over the handlers/source for `ticksPerLap` ticks; `mea` =
    /// measure the state (committed into the lap ledger BEFORE the cut — a lap is never unmeasured);
    /// `cut` = continue? (false ⇒ close). `clock lap` = elapsed generator-millis at that lap.
    let run
        (handlers: SoftScheduler.HandlerK<'S> list)
        (source: SoftScheduler.Source)
        (mea: 'S -> 'M)
        (cut: 'M -> 'S -> bool)
        (clock: int -> int64)
        (budget: Budget)
        (ctx: IntrCtx)
        (seed: int64)
        (ticksPerLap: int)
        (initial: 'S)
        : System.Threading.Tasks.Task<Outcome<'S, 'M>> =
        task {
            // No infinity: every rail is clamped ON, regardless of caller input.
            let maxLaps = max 1 budget.MaxLaps
            let maxTicks = max 1 budget.MaxTicks
            let maxMillis = max 1L budget.MaxMillis
            let perLap = max 1 ticksPerLap

            let mutable state = initial
            let mutable laps: Lap<'S, 'M> list = []
            let mutable n = 0
            let mutable ticksSpent = 0
            let mutable stopped: Stopped option = None

            while Option.isNone stopped do
                // the offset source: lap n sees ticks [n*perLap, ...) of the shared timeline
                let baseTick = n * perLap
                let lapSource: SoftScheduler.Source = fun t -> source (baseTick + t)

                // sim — one bounded burst
                let! r = (SoftScheduler.driveK handlers lapSource).Run ctx seed state perLap

                match r with
                | Error e -> stopped <- Some(RoomError e)
                | Ok s' ->
                    state <- s'
                    ticksSpent <- ticksSpent + perLap
                    // mea — committed BEFORE the cut; a lap is never unmeasured
                    let m = mea state
                    laps <- { N = n; Measured = m; State = state } :: laps
                    n <- n + 1

                    // cut — the boundary decision, then the three rails (all finite)
                    if not (cut m state) then stopped <- Some CutChoseClose
                    elif n >= maxLaps then stopped <- Some LapBudget
                    elif ticksSpent >= maxTicks then stopped <- Some TickBudget
                    elif clock n >= maxMillis then stopped <- Some ClockBudget

            return
                { Laps = List.rev laps
                  Stopped = stopped |> Option.defaultValue CutChoseClose
                  Final = state }
        }

    // ── the continuation: run forever, five minutes at a time (Aaron 2026-06-11: "it can run forever —
    // each loop has 5 minutes but can schedule its own continuation by committing to main before it's
    // done, under /spawn"). A budget-stopped run mints a TOKEN; the runner commits it under spawn/
    // before closing; the next runner picks it up through the ferry throttle. Infinity by CHAINING
    // finite links — each link finite, visible (a main commit), consented (pickup is opt-in), and
    // idempotent (keyed by loop id). ──

    /// A continuation token: enough to resume the chain. The STATE itself lives in saves/ as a
    /// recording (reference-not-copy — the token carries the pointer, never the payload).
    type Continuation =
        { LoopId: string
          NextLap: int
          TicksSpent: int
          StatePointer: string }

    /// Mint a continuation IFF the run stopped on a budget rail. The good ending (CutChoseClose) and
    /// the error ending (RoomError) do NOT continue — done is done, and a broken room respawning
    /// unexamined is how runaways happen.
    let continueAfter (loopId: string) (statePointer: string) (o: Outcome<'S, 'M>) : Continuation option =
        match o.Stopped with
        | LapBudget
        | TickBudget
        | ClockBudget ->
            Some
                { LoopId = loopId
                  NextLap = List.length o.Laps
                  TicksSpent = o.Laps |> List.sumBy (fun _ -> 1) // laps; ticks recomputed by runner × perLap
                  StatePointer = statePointer }
        | CutChoseClose
        | RoomError _ -> None

    /// One text line (the treaty register): `spawn:<loop-id>:<next-lap>:<ticks>:<state-pointer>`.
    /// The pointer may contain ':' (a path) — it is the final field, parsed greedily.
    let encodeContinuation (c: Continuation) : string =
        sprintf "spawn:%s:%d:%d:%s" c.LoopId c.NextLap c.TicksSpent c.StatePointer

    /// Parse a token line (None = not a token / malformed — honest refusal).
    let parseContinuation (line: string) : Continuation option =
        if line.StartsWith "spawn:" then
            match line.Substring(6).Split(':', 4) with
            | [| id; lap; ticks; ptr |] when id.Length > 0 && ptr.Length > 0 ->
                match System.Int32.TryParse lap, System.Int32.TryParse ticks with
                | (true, l), (true, t) when l >= 0 && t >= 0 ->
                    Some { LoopId = id; NextLap = l; TicksSpent = t; StatePointer = ptr }
                | _ -> None
            | _ -> None
        else
            None
