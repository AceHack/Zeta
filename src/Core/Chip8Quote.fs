namespace Zeta.Core

/// Chip8Quote — **playable quotes for CHIP-8: our soft version of Tenmile** (Aaron 2026-06-11: "we
/// need this … let's lock it in and build our own soft version, for chip8 first — game boy later").
///
/// Prior art (the lock-in): **"Playable Quotes for Game Boy" — Joël Franušić & Adam M. Smith, Strange
/// Loop 2023 (the Tenmile prototype)**: a quote = a tiny interactive slice of a game — (1) a
/// **masked ROM** (their measurement: a short segment touches ~6% of the game; the rest is zeroed),
/// (2) a **savestate** at the quote's first frame, (3) an **input recording** — replayable as a video,
/// AND live: the viewer can take the controls at any moment. Theirs hides the bundle
/// steganographically in a PNG screenshot.
///
/// **Our soft version differs deliberately (the disciplines decide):**
/// - **TEXT, not PNG-stego** — no binary in the proof lineage: a quote serializes as lines
///   (savestate pointer per `saves/` + the membrane log + the touched-byte mask in hex). A quote you
///   can diff is a quote you can trust; stego stays out of the proof path (a render-layer garnish at
///   most, later, never the carrier of record).
/// - **the input recording IS the membrane log** (`RecordedSource`) — quotes inherit DST: replay is
///   byte-identical by the same machinery as everything else.
/// - **the mask is COMPUTED, not sampled**: we statically decode each step's reads (PC window, I
///   window for DRW/F33/F55/F65, the font when FX29 runs) over the recorded trajectory, so the
///   touched set is exact for the quote's length — and the MASK THEOREM is *tested*: replaying the
///   quote over the masked ROM reproduces the full-ROM trajectory exactly (untouched bytes provably
///   don't matter; Tenmile's 6% insight as a theorem, not a statistic).
/// - **"take the controls" = swap the Source**: a quote replays its recording up to tick t, then any
///   live source continues — the fork is the same banana-split machinery as everything else.
[<RequireQualifiedAccess>]
module Chip8Quote =

    /// A playable quote: the start frame (the savestate), the recorded crossings (the input log),
    /// its tick length, and the touched-address mask of the underlying memory.
    type Quote =
        { Start: Chip8Cow.Frame
          Recording: RecordedSource.Recording
          Ticks: int
          Touched: Set<int> }

    // ── the touched-set computation (exact, per-step static read decode) ──

    /// The memory addresses one step at `f` READS: the 2-byte opcode window at PC, plus the I window
    /// for the memory-reading ops (DRW DXYN reads I..I+n-1; FX65 reads I..I+x; FX33 writes only —
    /// reads nothing beyond PC; FX29 reads the font glyph, which lives in reserved memory we always
    /// keep). Conservative-exact for the supported opcode set.
    let private readsAt (f: Chip8Cow.Frame) : Set<int> =
        let pc = int f.PC
        let op =
            (int (Map.tryFind pc f.Mem |> Option.defaultValue 0uy) <<< 8)
            ||| int (Map.tryFind (pc + 1) f.Mem |> Option.defaultValue 0uy)

        let baseReads = Set.ofList [ pc; pc + 1 ]

        match op &&& 0xF000 with
        | 0xD000 ->
            let n = op &&& 0x000F
            Set.union baseReads (Set.ofList [ for i in 0 .. n - 1 -> int f.I + i ])
        | 0xF000 when op &&& 0x00FF = 0x65 ->
            let x = (op &&& 0x0F00) >>> 8
            Set.union baseReads (Set.ofList [ for i in 0..x -> int f.I + i ])
        | _ -> baseReads

    /// Walk the trajectory (savestate + recording + live stepping like the room loop does at
    /// `cyclesPerTick` per timer tick) and collect every address read. Exact for the quote's length.
    let touchedSet (cyclesPerTick: int) (q0: Chip8Cow.Frame) (rec_: RecordedSource.Recording) (ticks: int) : Set<int> =
        let mutable f = q0
        let mutable touched = Set.empty

        for tick in 0 .. ticks - 1 do
            // inputs first (the crossings of this tick), then the tick's CPU burst — mirrors the
            // SoftChip8Flux room loop ordering (input handler before timer handler).
            for intr in (RecordedSource.replay rec_) tick do
                match intr with
                | OperatorMessageArrived p ->
                    match SoftChip8Flux.parseKey p with
                    | Some (idx, down) -> f <- SoftChip8Flux.applyKey idx down f
                    | None -> ()
                | _ -> ()

            f <- Chip8Cow.tick f

            for _ in 1..cyclesPerTick do
                touched <- Set.union touched (readsAt f)
                f <- Chip8Cow.step f

        touched

    /// Run the same trajectory and return the FINAL frame (the quote's playback endpoint).
    let playback (cyclesPerTick: int) (q0: Chip8Cow.Frame) (rec_: RecordedSource.Recording) (ticks: int) : Chip8Cow.Frame =
        let mutable f = q0

        for tick in 0 .. ticks - 1 do
            for intr in (RecordedSource.replay rec_) tick do
                match intr with
                | OperatorMessageArrived p ->
                    match SoftChip8Flux.parseKey p with
                    | Some (idx, down) -> f <- SoftChip8Flux.applyKey idx down f
                    | None -> ()
                | _ -> ()

            f <- Chip8Cow.tick f
            for _ in 1..cyclesPerTick do f <- Chip8Cow.step f

        f

    // ── quoting and masking ──

    /// Cut a quote from a live moment: savestate + recording + length, with the touched set computed.
    let quote (cyclesPerTick: int) (start: Chip8Cow.Frame) (rec_: RecordedSource.Recording) (ticks: int) : Quote =
        { Start = start
          Recording = rec_
          Ticks = ticks
          Touched = touchedSet cyclesPerTick start rec_ ticks }

    /// The MASKED savestate: every program-memory byte the quote never reads is ZEROED (the Tenmile
    /// move). Reserved memory (interpreter area below 0x200: font, choice cell) is always kept — it
    /// is part of the machine, not the game.
    let mask (q: Quote) : Chip8Cow.Frame =
        let kept =
            q.Start.Mem
            |> Map.filter (fun addr _ -> addr < Chip8.ProgramStart || Set.contains addr q.Touched)

        { q.Start with Mem = kept }

    /// How much of the program survives the mask (the Tenmile "6%" number, measured exactly).
    let keptFraction (q: Quote) : float =
        let prog = q.Start.Mem |> Map.filter (fun a _ -> a >= Chip8.ProgramStart) |> Map.count
        if prog = 0 then 1.0
        else
            let kept =
                q.Start.Mem
                |> Map.filter (fun a _ -> a >= Chip8.ProgramStart && Set.contains a q.Touched)
                |> Map.count
            float kept / float prog

    /// **Take the controls**: a Source that replays the quote for its length, then hands every later
    /// tick to `live` — the viewer becomes the player at the seam, same membrane, no mode switch.
    let takeControls (q: Quote) (live: SoftScheduler.Source) : SoftScheduler.Source =
        fun tick -> if tick < q.Ticks then (RecordedSource.replay q.Recording) tick else live (tick - q.Ticks)
