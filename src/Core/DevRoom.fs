namespace Zeta.Core

/// DevRoom — the **harness that hangs all the doors** (Aaron 2026-06-10, shadow*: "build the dev room
/// harness that hangs all the doors").
///
/// The dev room is the FF7-debug-room hub whose **boundary is the union of all the other rooms' boundaries**
/// — the room with all the doors (`docs/research/2026-06-10-the-dev-room-is-the-harness-...`). This is the
/// first slice: a **navigable hub** that gathers every landmark door into one place — `enter` any landmark,
/// see the union of all stations (the boundary), and — the **BigFloat-for-devops** first step — read the
/// room's own **resolution** (live-coverage: how furnished/working it is), so the dev room *carries its own
/// measurement* rather than being outside it.
///
/// Honest scope: this hangs the doors (`Salon`/`Arcade`/`BowlingAlley`/`Skadium`) and self-measures
/// coverage. It is NOT yet the unbounded-pulled-inside, recursive-`sim` self-hosting harness (that arc is
/// the dev-room doc + 081KTQD8A0008QG0R0005EFYPV); it is the hub the future harness drives. Pure module, no classes.
[<RequireQualifiedAccess>]
module DevRoom =

    /// A normalized station — one offering in some room (the common shape behind Salon.Station /
    /// Arcade.Cabinet / BowlingAlley.Lane / Skadium.Rink).
    type Station =
        { Name: string
          Does: string
          Verb: string option
          Module: string
          Live: bool }

    /// A door the dev room hangs — a landmark + its signage + its stations.
    type Door =
        { Landmark: string
          Does: string
          Stations: Station list }

    let private st (n, d, v, m, l) : Station = { Name = n; Does = d; Verb = v; Module = m; Live = l }

    let private salonDoor: Door =
        { Landmark = Salon.name
          Does = Salon.does
          Stations = Salon.stations |> List.map (fun s -> st (s.Name, s.Does, s.Verb, s.Module, s.Live)) }

    let private arcadeDoor: Door =
        { Landmark = Arcade.name
          Does = Arcade.does
          Stations = Arcade.cabinets |> List.map (fun c -> st (c.Name, c.Does, c.Verb, c.Module, c.Live)) }

    let private bowlingDoor: Door =
        { Landmark = BowlingAlley.name
          Does = BowlingAlley.does
          Stations = BowlingAlley.lanes |> List.map (fun l -> st (l.Name, l.Does, l.Verb, l.Module, l.Live)) }

    let private skatiumDoor: Door =
        { Landmark = Skadium.name
          Does = Skadium.does
          Stations = Skadium.rinks |> List.map (fun r -> st (r.Name, r.Does, r.Verb, r.Module, r.Live)) }

    /// All the doors the dev room hangs (the FF7 all-doors hub).
    let doors: Door list = [ salonDoor; arcadeDoor; bowlingDoor; skatiumDoor ]

    /// Open a door by landmark name — "go to the salon" (None if no such landmark).
    let enter (landmark: string) : Door option =
        doors |> List.tryFind (fun d -> d.Landmark = landmark)

    /// The dev room's **boundary = the union of all rooms' stations** (every offering, across every door).
    let boundary: Station list = doors |> List.collect (fun d -> d.Stations)

    /// The stations that are working slices today (across all rooms).
    let liveStations: Station list = boundary |> List.filter (fun s -> s.Live)

    /// **Self-measurement (BigFloat-for-devops, first slice): the dev room's resolution** — the fraction of
    /// its stations that are live (working). The room *carries its own measurement*: it knows how furnished
    /// it is, from inside. (0.0 = empty, 1.0 = every station live.)
    let resolution () : float =
        match boundary with
        | [] -> 0.0
        | all -> float (all |> List.filter (fun s -> s.Live) |> List.length) / float (List.length all)

    /// The landmark names the dev room currently hangs (the navigable index).
    let landmarks: string list = doors |> List.map (fun d -> d.Landmark)

    // ── The door to ITSELF (Aaron 2026-06-11: "our FF7 debug room should have a door to itself") ──
    // Shape A (s = f(s)): the hub contains a pointer to itself. It TERMINATES — the self-door's stations
    // are the landmark NAMES (data), not nested doors, so the boundary never infinitely expands.

    /// The dev room as one of its own doors — the strange loop, made navigable.
    let selfDoor: Door =
        { Landmark = "dev-room"
          Does = "the FF7 debug room — the hub with a door to ITSELF (shape A); hangs every room, including this one"
          Stations =
            landmarks
            |> List.map (fun lm -> { Name = lm; Does = "landmark door"; Verb = None; Module = "DevRoom"; Live = true }) }

    /// Open a door by name, INCLUDING the self-door ("dev-room" returns the hub itself). The terminating
    /// strange loop: enter the dev room from inside the dev room.
    let enterAny (landmark: string) : Door option =
        if landmark = "dev-room" then Some selfDoor else enter landmark

    // ── The TICK (Aaron 2026-06-10, "lets move forward"): the dev room RUNS its rooms, not just lists ──
    // Each landmark gets a deterministic representative run, driven through the ONE soft scheduler
    // (`SoftScheduler.runDeterministic` — DoP=1, seed-deterministic, DST-replayable). Entering a room and
    // ticking it is how a room earns its sign-off (rooms-as-sign-off: run → resolve → report).

    /// The uniform result of ticking a room: which landmark ran, how many 60Hz ticks it was budgeted,
    /// and a deterministic summary of where it landed (replay-equal for equal (landmark, seed, budget)).
    type RoomRun =
        { Landmark: string
          Ticks: int
          Summary: string }

    let private dstCtx: IntrCtx =
        { Memetic = "devroom"
          Prompt = ""
          Trust = ""
          Log = ""
          Otel = System.Diagnostics.ActivityContext() }

    let private isTimer =
        function
        | TimerElapsed _ -> true
        | _ -> false

    /// One deterministic byte-strand pair for the salon's representative run (a near-match pair, so the
    /// soft tie genuinely exercises the MinHash similarity, not just identity).
    let private salonStrands (seed: int64) =
        let a = System.Text.Encoding.UTF8.GetBytes(sprintf "strand-%d the quick brown fox jumps over the lazy dog" seed)
        let b = System.Text.Encoding.UTF8.GetBytes(sprintf "strand-%d the quick brown fox JUMPED over the lazy dog" seed)
        a, b

    /// Tick a landmark's representative workload on the soft scheduler. Deterministic in
    /// (landmark, seed, budget); `None` for an unknown landmark. Each room's run:
    ///   salon — tie two near strands each tick; summary = the tie strength (the soft link held).
    ///   darkhall — play a 2-op clean-room ROM on `SoftChip8Scheduler` (already ON the scheduler).
    ///   bowling alley — roll deterministically (SplitMix from the seed) each tick; summary = the score.
    ///   skatium — bob-and-weave; summary = final lean + openings seen.
    let tick (landmark: string) (seed: int64) (budget: int) : System.Threading.Tasks.Task<Result<RoomRun, InterruptFeedback>> =
        task {
            match landmark with
            | "salon" ->
                let a, b = salonStrands seed
                let handler: SoftScheduler.Handler<SoftTie.SoftTie<byte[]> option> =
                    SoftScheduler.handler "salon-tie" isTimer (fun _ _ ->
                        System.Threading.Tasks.Task.FromResult(Ok(SoftTie.tieBytes 0.5 a b)))
                let! r = SoftScheduler.runDeterministic [ handler ] dstCtx seed None budget
                return
                    r
                    |> Result.map (fun tie ->
                        let s =
                            match tie with
                            | Some t -> sprintf "tied (strength %.3f)" t.Strength
                            | None -> "no tie"
                        { Landmark = landmark; Ticks = budget; Summary = s })
            | "darkhall" ->
                // 6A0C (V[A]=0x0C) ; 1202 (jump loop) — the clean-room 2-op ROM (no copyrighted content).
                let rom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]
                let! r = SoftChip8Scheduler.run (uint64 seed) rom budget
                return
                    r
                    |> Result.map (fun f ->
                        { Landmark = landmark
                          Ticks = budget
                          Summary = sprintf "chip8 ran: PC=0x%04X V[A]=0x%02X delay=%d" f.PC f.V.[0xA] f.Delay })
            | "bowling alley" ->
                let handler: SoftScheduler.Handler<int list> =
                    SoftScheduler.handler "bowl" isTimer (fun _ rolls ->
                        // a deterministic roll 0..10 from the seed + position (SplitMix64 — the one avalanche)
                        let n = List.length rolls
                        let h = SplitMix64.mix (uint64 seed + uint64 n * SplitMix64.GoldenRatio)
                        let roll = int (h % 11UL)
                        System.Threading.Tasks.Task.FromResult(Ok(rolls @ [ roll ])))
                let! r = SoftScheduler.runDeterministic [ handler ] dstCtx seed [] budget
                return
                    r
                    |> Result.map (fun rolls ->
                        { Landmark = landmark
                          Ticks = budget
                          Summary = sprintf "rolled %d, score %d" (List.length rolls) (BowlingAlley.score rolls) })
            | "skatium" ->
                let handler: SoftScheduler.Handler<int * int> = // (step, openings seen)
                    SoftScheduler.handler "weave" isTimer (fun _ (step, opens) ->
                        let opens' = if Skadium.openAt 2 step then opens + 1 else opens
                        System.Threading.Tasks.Task.FromResult(Ok(step + 1, opens')))
                let! r = SoftScheduler.runDeterministic [ handler ] dstCtx seed (0, 0) budget
                return
                    r
                    |> Result.map (fun (step, opens) ->
                        { Landmark = landmark
                          Ticks = budget
                          Summary = sprintf "wove %d steps, lean %A, %d openings" step (Skadium.weave 2 step) opens })
            | _ -> return Error(Failed(sprintf "no such landmark: %s" landmark))
        }

    /// Tick EVERY room the dev room hangs (the register sweep) — sequentially, deterministically.
    let tickAll (seed: int64) (budget: int) : System.Threading.Tasks.Task<RoomRun list> =
        task {
            let mutable acc = []
            for lm in landmarks do
                let! r = tick lm seed budget
                match r with
                | Ok run -> acc <- acc @ [ run ]
                | Error e -> acc <- acc @ [ { Landmark = lm; Ticks = budget; Summary = sprintf "ERROR: %A" e } ]
            return acc
        }
