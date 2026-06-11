namespace Zeta.Core

open System.Threading.Tasks

/// Arcade — the **door** on the *darkhall* landmark (Aaron 2026-06-10, shadow*: "darkhall next — give the
/// arcade its door"). Named `Arcade` because `DarkHall` (`DarkHall.fs`) is already the clean-room CHIP-8
/// emulator *cell* — it's a **cabinet**, not the door. The landmark is "darkhall"; its door module is
/// `Arcade` (the place's nature). (Rename if you'd rather flip them.)
///
/// The darkhall is the dim hall of cabinets — the **emulator / VM / games** landmark, where (Aaron +
/// Max 2026-06-10) **programs are decompiled down to MIPS-like primitives** and **rooms are the CPU's
/// micro-operations**: a room/cell is a μop, the program decompiles into rooms, and the soft layer does
/// **branch detection in real time** (the only soft fork is on unknown future input). This door gathers
/// the arcade's cabinets under one name and gives **live entrances** — `play` (a ROM on the soft
/// scheduler) and `host` (the clean-room `DarkHall` CPU) — so you can walk in and run a cabinet.
[<RequireQualifiedAccess>]
module Arcade =

    /// A cabinet in the arcade — one named offering.
    type Cabinet =
        { Name: string
          Does: string
          Verb: string option
          Module: string
          Live: bool }

    /// The arcade's cabinets — the emulator/VM/game fittings gathered under one door.
    let cabinets: Cabinet list =
        [ { Name = "play"
            Does = "run a CHIP-8 ROM on the soft IScheduler for N 60Hz frames (the soft cabinet)"
            Verb = Some "sim"
            Module = "src/Core/SoftChip8Scheduler.fs"
            Live = true }
          { Name = "host"
            Does = "the clean-room minimal CHIP-8-subset CPU cell — deterministic, DST-replayable"
            Verb = Some "sim"
            Module = "src/Core/DarkHall.fs"
            Live = true }
          { Name = "step"
            Does = "one pure CHIP-8 instruction (the COW transition; parent untouched)"
            Verb = None
            Module = "src/Core/Chip8Cow.fs"
            Live = true }
          { Name = "predict"
            Does = "real-time BRANCH DETECTION — the only soft fork is on unknown future input; batch look-ahead between branches (play∥predict)"
            Verb = None
            Module = "src/Core/SoftChip8.fs"
            Live = true }
          { Name = "fingerprint"
            Does = "identify the game — hard exact key (SHA-256) + soft recognition (FingerprintPrism)"
            Verb = None
            Module = "src/Core/GameFingerprint.fs + src/Core/FingerprintPrism.fs"
            Live = true }
          { Name = "catalog"
            Does = "per-game soft state keyed by fingerprint (switch games staying soft)"
            Verb = Some "cla"
            Module = "src/Core/GamePortfolio.fs + src/Core/GameCatalog.fs"
            Live = false }
          { Name = "sim"
            Does = "the ephemeral void run (the deterministic edge tick the cabinets lift)"
            Verb = Some "sim"
            Module = "src/Core/Sim.fs"
            Live = true } ]

    /// The arcade's name and what work happens here (the signage).
    let name = "darkhall"
    let does = "the arcade — emulators / VMs / games; decompile programs to MIPS-like μops; rooms = micro-ops; real-time branch detection"

    /// Live entrance: `play` — run a CHIP-8 ROM on the soft scheduler for `frames` 60Hz ticks (delegates
    /// to the working `SoftChip8Scheduler`).
    let play (seed: uint64) (rom: byte[]) (frames: int) : Task<Result<Chip8Cow.Frame, InterruptFeedback>> =
        SoftChip8Scheduler.run seed rom frames

    /// Live entrance: `host` — run a program on the clean-room `DarkHall` CPU to halt or `budget` steps
    /// (deterministic, DST-replayable). The hard cabinet.
    let host (program: byte[]) (budget: int) : DarkHall.EmuState =
        DarkHall.run program budget

    /// The cabinets that are working slices today (Live = true).
    let liveCabinets: Cabinet list = cabinets |> List.filter (fun c -> c.Live)
