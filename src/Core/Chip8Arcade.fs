namespace Zeta.Core

open System.Threading.Tasks

/// Chip8Arcade — **the CHIP-8 chooses which game it plays** (Aaron 2026-06-11: "can chip8 play games with
/// the ability to choose which game in chip8? once we have DI and effects we can figure out how much to
/// put where and what needs to be externalized and injected so it can play with itself") — escalated in
/// the same breath to **full autonomy with self and societal reflection**.
///
/// **The DI inventory (what lives where — the §13 membrane drawn explicitly):**
///
/// | concern                | placement | why |
/// |------------------------|-----------|-----|
/// | game logic             | in-VM     | the game IS the room's state |
/// | choice logic (menu)    | in-VM     | autonomy means the VM decides — it writes its choice to the CHOICE CELL |
/// | self-reflection        | host, ABOUT the VM | `speculateToward` simulates the VM's own future; the report is returned to it |
/// | ROM bytes (the load)   | INJECTED  | the VM cannot read files; a `load:` crossing carries the ROM over the membrane |
/// | keys / 60Hz / display  | INJECTED  | crossings (already: `SoftChip8Flux.inputHandler`/`timerHandler`) |
/// | RNG seed               | INJECTED at `create` | DST: the frame's only entropy is its seed |
/// | crypto / Reticulum     | INJECTED  | the ratified verdict: primitives cross the membrane, never in-VM |
/// | peer reports (society) | INJECTED  | `reflect:` crossings — other rooms' self-knowledge arriving |
///
/// **The autonomy loop ("plays with itself"):** reflect over the library (simulate each candidate's
/// future under the flux tank) → choose (its OWN confidence-ranked pick, written via the choice
/// protocol) → load (the one injected effect) → play → broadcast its reflection → hear peers' →
/// society-adjust the next choice (division of labor: prefer the knowable game no peer already covers).
/// Self-reflection = the machine simulating itself (T1–T4 self-sim + `SpeculationReport` self-knowledge);
/// societal reflection = the same reports as membrane crossings between rooms.
[<RequireQualifiedAccess>]
module Chip8Arcade =

    /// The game library — ORDERED, so an index IS a valid in-VM choice (a byte the VM can hold).
    type Library = (string * byte[]) list

    /// **The CHOICE CELL treaty**: memory address `0x1FF` (below `ProgramStart` 0x200, above the font) —
    /// the VM writes the INDEX of the game it wants there. The host reads it; the VM has spoken.
    /// This is the autonomy boundary made one byte wide: choice happens INSIDE; loading happens OUTSIDE.
    let choiceCell = 0x1FF

    /// Read the VM's own choice from the choice cell (None = it has not chosen / index out of library).
    let readChoice (lib: Library) (f: Chip8Cow.Frame) : (string * byte[]) option =
        Map.tryFind choiceCell f.Mem |> Option.bind (fun b -> List.tryItem (int b) lib)

    /// Boot a fresh frame with a ROM (seed = the injected entropy; DST-replayable).
    let boot (seed: uint64) (rom: byte[]) : Chip8Cow.Frame =
        Chip8Cow.create seed |> Chip8Cow.loadRom rom

    /// The LOAD crossing: `load:<name>` → a fresh frame running that game (the ROM bytes cross the
    /// membrane; the VM never reads a file). Unknown names are skipped unchanged (honest refusal).
    let loadHandler (seed: uint64) (lib: Library) : SoftScheduler.HandlerK<Chip8Cow.Frame> =
        SoftScheduler.handlerK
            "arcade-load"
            (function
            | OperatorMessageArrived (p: string) -> p.StartsWith "load:"
            | _ -> false)
            (fun intr _ctx f ->
                match intr with
                | OperatorMessageArrived p ->
                    match lib |> List.tryFind (fun (n, _) -> n = p.Substring 5) with
                    | Some (_, rom) -> Task.FromResult(Ok(boot seed rom))
                    | None -> Task.FromResult(Ok f)
                | _ -> Task.FromResult(Ok f))

    // ── SELF-reflection: the machine simulating its own candidate futures ──

    /// One game's reflection: the machine's self-knowledge about playing it (how far it could see, and
    /// whether the limit was a genuine unknowable (input fork) or its own power (starved)).
    type Reflection =
        { Game: string
          Report: SoftChip8Flux.SpeculationReport }

    /// Reflect over the whole library: simulate each candidate's future under the SAME flux tank
    /// (fair comparison — equal funding). Pure self-knowledge: nothing is loaded for real.
    let reflect
        (goal: int)
        (costPerStep: float)
        (tank: SoftThrottle.Tank)
        (seed: uint64)
        (lib: Library)
        : Reflection list =
        lib
        |> List.map (fun (name, rom) ->
            let _, report, _ = SoftChip8Flux.speculateToward goal costPerStep tank (boot seed rom)
            { Game = name; Report = report })

    /// The AUTONOMOUS choice: the index of the game whose knowable future it sees best — max confidence,
    /// ties broken by depth achieved, then by library order (deterministic). None on an empty library.
    let choose (rs: Reflection list) : int option =
        if List.isEmpty rs then
            None
        else
            rs
            |> List.indexed
            |> List.maxBy (fun (i, r) -> r.Report.Confidence, r.Report.Achieved, -i)
            |> fst
            |> Some

    /// Commit a choice the way the treaty says: the VM-side write into the choice cell (this is what an
    /// in-VM menu program would do with its own STORE — the host-side helper for tests/bootstraps).
    let commitChoice (idx: int) (f: Chip8Cow.Frame) : Chip8Cow.Frame =
        { f with Mem = Map.add choiceCell (byte idx) f.Mem }

    // ── SOCIETAL reflection: the same self-knowledge as membrane crossings between rooms ──

    /// Encode a reflection for the wire (text — the treaty register): `reflect:<game>:<achieved>:<conf-millis>`.
    let encodeReflection (r: Reflection) : string =
        sprintf "reflect:%s:%d:%d" r.Game r.Report.Achieved (int (r.Report.Confidence * 1000.0))

    /// Parse a peer's reflection crossing (None = not a reflection / malformed — honest refusal).
    let parseReflection (payload: string) : (string * int * float) option =
        if payload.StartsWith "reflect:" then
            match payload.Substring(8).Split(':') with
            | [| game; a; c |] ->
                match System.Int32.TryParse a, System.Int32.TryParse c with
                | (true, ach), (true, cm) when ach >= 0 && cm >= 0 && cm <= 1000 ->
                    Some(game, ach, float cm / 1000.0)
                | _ -> None
            | _ -> None
        else
            None

    /// The SOCIETY-adjusted choice — division of labor: among games whose confidence is within `slack`
    /// of my best, prefer one NO peer already covers (peer coverage = a reflection crossing I heard).
    /// If peers cover everything I can see, fall back to my own best (society informs, never vetoes —
    /// the room stays autonomous; a peer report is an observation, not a directive).
    let chooseInSociety (slack: float) (peerGames: Set<string>) (rs: Reflection list) : int option =
        match choose rs with
        | None -> None
        | Some myBest ->
            let bestConf = rs.[myBest].Report.Confidence

            let uncovered =
                rs
                |> List.indexed
                |> List.filter (fun (_, r) ->
                    r.Report.Confidence >= bestConf - slack
                    && not (Set.contains r.Game peerGames))

            match uncovered with
            | [] -> Some myBest
            | xs -> xs |> List.maxBy (fun (i, r) -> r.Report.Confidence, r.Report.Achieved, -i) |> fst |> Some
