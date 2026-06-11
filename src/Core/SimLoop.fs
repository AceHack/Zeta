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

    /// The default: ~5 minutes of generator clock, generous-but-finite lap/tick rails.
    let defaultBudget: Budget =
        { MaxLaps = 1_000
          MaxTicks = 1_000_000
          MaxMillis = 300_000L }

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
