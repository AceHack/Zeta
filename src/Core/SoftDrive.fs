namespace Zeta.Core

/// **`SoftDrive` — the soft layer drives the hard emulator via the control interface (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"can the soft version drive the hard DynamicValue version via the control interface, so it's kind of
/// recursive?"* — yes, and this is it. The pattern has a name: **Model Predictive Control** (receding-horizon).
/// Each `controlStep`:
///   1. **plan (soft):** for each candidate immediate control input, roll out `SoftEmu` `depth` steps (throttled
///      to `width`) and score the rollout by `value` (a fitness / empowerment objective);
///   2. **commit (hard):** apply the *best* first action to ONE real `Chip8Cow.step` (the hard deterministic plant);
///   3. **re-plan** from the new hard state.
///
/// **Why it's recursive (three senses):**
///   - **plan→act→replan** — the MPC loop itself.
///   - **self-similar** (manifesto §9/§10) — the soft model *is* the hard `Chip8Cow.step` lifted to a distribution
///     (`SoftEmu`); the **control interface is the collapse boundary** where soft becomes hard — exactly
///     `SoftValue.resolve → DynamicValue`, lifted to the whole machine.
///   - **stackable** — soft can drive soft can drive hard; same interface at every level.
///
/// **The honest good property:** unlike a *learned* world model (Dreamer/MuZero), the soft model here is the
/// *exact* emulator lifted, so **MPC has zero model-mismatch** — the only cost is rollout width (`prune`/`width`).
/// Think expensively (soft, throttled), act cheaply (hard, one step). Deterministic (DST §7): same seed ⇒ same
/// driven trajectory, byte-for-byte replayable.
///
/// **Honest scope (peel):** the candidate action set is `none` + each single hex key (17 actions) — a greedy
/// first-action search, not full tree search (MCTS would deepen it). `value` defaults to `SoftDashboard.sumMemory`
/// (a toy objective; `SoftDashboard.empowerment` is the unsupervised one). On a no-input ROM the control is inert
/// (keys only matter at input opcodes), so `drive` degenerates to `Chip8Cow.run` — the correct degenerate case.
[<RequireQualifiedAccess>]
module SoftDrive =

    /// The candidate immediate actions: do-nothing plus each single hex key held (17 total).
    let private actions: bool[] list =
        SoftController.none :: [ for k in 0..15 -> SoftController.singleKey k ]

    let private collectResults (results: Result<'a, 'e> list) : Result<'a list, 'e> =
        let rec loop acc rest =
            match rest with
            | [] -> Ok(List.rev acc)
            | Ok value :: tail -> loop (value :: acc) tail
            | Error e :: _ -> Error e

        loop [] results

    /// **The planner:** the best immediate control input from the hard state `hard`, chosen by soft rollout.
    /// For each candidate action, commit it once, roll out `depth` soft steps (capped to `width`), and take the
    /// expected `value` over the resulting ensemble; return the action whose rollout scores highest.
    let bestAction (value: Chip8Cow.Frame -> float) (depth: int) (width: int) (hard: Chip8Cow.Frame) : bool[] =
        actions
        |> List.maxBy (fun keys ->
            let started = Chip8Cow.step { hard with Keys = keys }
            SoftEmu.pure1 started |> SoftEmu.softRun depth |> SoftEmu.prune width |> SoftEmu.expect value)

    /// **One control step:** plan the best action (soft), then commit it to ONE hard `Chip8Cow.step`. The soft
    /// layer drives the hard plant through the key (control) interface.
    let controlStep (value: Chip8Cow.Frame -> float) (depth: int) (width: int) (hard: Chip8Cow.Frame) : Chip8Cow.Frame =
        let keys = bestAction value depth width hard
        Chip8Cow.step { hard with Keys = keys }

    /// **Drive the hard emulator for `steps` control steps** (the receding-horizon loop). Deterministic.
    let drive (value: Chip8Cow.Frame -> float) (depth: int) (width: int) (steps: int) (hard: Chip8Cow.Frame) : Chip8Cow.Frame =
        let mutable cur = hard
        for _ in 1 .. max 0 steps do
            cur <- controlStep value depth width cur
        cur

    /// Convenience: drive toward maximal memory sum (the toy objective).
    let driveSumMemory (depth: int) (width: int) (steps: int) (hard: Chip8Cow.Frame) : Chip8Cow.Frame =
        drive SoftDashboard.sumMemory depth width steps hard

    /// Convenience: drive toward maximal *empowerment* (the unsupervised objective — agency / forward momentum).
    let driveEmpowerment (lookahead: int) (depth: int) (width: int) (steps: int) (hard: Chip8Cow.Frame) : Chip8Cow.Frame =
        drive (SoftDashboard.empowerment lookahead) depth width steps hard

    // ---- frame-aware (LIVE) variants — the step-based ones above never tick, so they freeze on delay loops ----
    // (the 2026-06-08 run). These interleave the 60 Hz tick (`Chip8Cow.frameStep` / `SoftEmu.softFrame`) so the
    // MPC driver actually works on real ROMs. `cyclesPerFrame ≈ 8`. `depth` is now in FRAMES, not CPU steps.

    /// **Frame-aware planner:** best action chosen by a `depth`-FRAME soft rollout (each rollout step a full frame
    /// with the tick). The live analog of `bestAction`.
    let bestFrameAction (value: Chip8Cow.Frame -> float) (cyclesPerFrame: int) (depth: int) (width: int) (hard: Chip8Cow.Frame) : bool[] =
        actions
        |> List.maxBy (fun keys ->
            let started = Chip8Cow.frameStep cyclesPerFrame { hard with Keys = keys }
            let mutable s = SoftEmu.pure1 started
            for _ in 1 .. max 0 depth do
                s <- SoftEmu.softFrame cyclesPerFrame s |> SoftEmu.prune width
            SoftEmu.expect value s)

    /// Frame-aware planner with heat exported through an injected boundary.
    /// Use a host sink to pass heat outside the tiny CHIP-8 room, or a
    /// `BoundedHeatSink` to measure how much heat the room can carry before
    /// the heat channel itself backpressures.
    let bestFrameActionWithHeatSink
        (source: string)
        (sink: IHeatSink)
        (value: Chip8Cow.Frame -> float)
        (cyclesPerFrame: int)
        (depth: int)
        (width: int)
        (hard: Chip8Cow.Frame)
        : Result<bool[], HeatSinkFeedback> =

        actions
        |> List.map (fun keys ->
            let started = Chip8Cow.frameStep cyclesPerFrame { hard with Keys = keys }
            let mutable s = SoftEmu.pure1 started
            let mutable error: HeatSinkFeedback option = None
            for _ in 1 .. max 0 depth do
                if Option.isNone error then
                    match SoftEmu.softFrame cyclesPerFrame s |> SoftEmu.pruneWithHeatSink source sink width with
                    | Ok report -> s <- report.State
                    | Error e -> error <- Some e

            match error with
            | Some e -> Error e
            | None -> Ok(keys, SoftEmu.expect value s))
        |> collectResults
        |> Result.map (List.maxBy snd >> fst)

    /// **One live control step:** plan the best action, commit it to one full `frameStep` (steps + tick). Unlike
    /// `controlStep` this keeps timers advancing, so delay-wait ROMs don't freeze.
    let frameControlStep (value: Chip8Cow.Frame -> float) (cyclesPerFrame: int) (depth: int) (width: int) (hard: Chip8Cow.Frame) : Chip8Cow.Frame =
        let keys = bestFrameAction value cyclesPerFrame depth width hard
        Chip8Cow.frameStep cyclesPerFrame { hard with Keys = keys }

    /// One live control step with pruning heat routed through an injected sink.
    let frameControlStepWithHeatSink
        (source: string)
        (sink: IHeatSink)
        (value: Chip8Cow.Frame -> float)
        (cyclesPerFrame: int)
        (depth: int)
        (width: int)
        (hard: Chip8Cow.Frame)
        : Result<Chip8Cow.Frame, HeatSinkFeedback> =
        bestFrameActionWithHeatSink source sink value cyclesPerFrame depth width hard
        |> Result.map (fun keys -> Chip8Cow.frameStep cyclesPerFrame { hard with Keys = keys })

    /// **Drive the hard emulator for `frames` live control frames** (the live receding-horizon loop). Deterministic.
    let driveFrames (value: Chip8Cow.Frame -> float) (cyclesPerFrame: int) (depth: int) (width: int) (frames: int) (hard: Chip8Cow.Frame) : Chip8Cow.Frame =
        let mutable cur = hard
        for _ in 1 .. max 0 frames do
            cur <- frameControlStep value cyclesPerFrame depth width cur
        cur

    /// Drive live control frames while exporting pruning heat. A sink failure
    /// stops the run with feedback instead of letting the tiny CHIP-8 room
    /// pretend erased futures were free.
    let driveFramesWithHeatSink
        (source: string)
        (sink: IHeatSink)
        (value: Chip8Cow.Frame -> float)
        (cyclesPerFrame: int)
        (depth: int)
        (width: int)
        (frames: int)
        (hard: Chip8Cow.Frame)
        : Result<Chip8Cow.Frame, HeatSinkFeedback> =
        let mutable cur = hard
        let mutable error: HeatSinkFeedback option = None
        for _ in 1 .. max 0 frames do
            if Option.isNone error then
                match frameControlStepWithHeatSink source sink value cyclesPerFrame depth width cur with
                | Ok next -> cur <- next
                | Error e -> error <- Some e

        match error with
        | Some e -> Error e
        | None -> Ok cur
