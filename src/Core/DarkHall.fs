namespace Zeta.Core

/// **The Dark Hall cell — host of a deterministic emulator (the arcade hosting the arcade games).**
///
/// The "Dark Hall" (Aaron's childhood neon arcade) is a Zeta cell metaphor (#6985): a hidden-door, glows-on-
/// entry, liminal space. Here it hosts an **emulator** — poetic-becomes-literal (the arcade runs the games).
///
/// This is a **clean-room, minimal CHIP-8-SUBSET CPU** (public opcode conventions; original implementation, NO
/// ROMs / no copyrighted content) — a *deterministic* stepper proving the load-bearing property: **a cell hosts
/// an emulator whose execution is a pure function of (program, budget) ⇒ DST-replayable** (the test seam,
/// #6958; the ARC-AGI chip8/atari DBSP-replay curriculum). NOT a full Atari 2600 / not CHIP-8 display, timers,
/// input, or self-modifying memory — just the deterministic CPU core, the vertical slice. F# reference oracle.
module DarkHall =

    open ZetaCli

    /// Emulator/device cores hosted inside the Dark Hall. This is deliberately
    /// MAME-shaped at the boundary: a room contains cabinets, and cabinets
    /// contain one or more machines/devices. The cores stay Zeta-owned.
    [<RequireQualifiedAccess>]
    type MachineCore =
        | DarkHallCpu
        | Chip8Cow
        | SoftChip8Scheduler
        | SoftChip8Predictor
        | Chip9ColorPlanes
        | MetaCartHost
        | FingerprintPrism
        | GameCatalog
        | SimLoop

    /// One emulator/device mounted inside a cabinet.
    type Machine =
        { Name: string
          Core: MachineCore
          Does: string
          Module: string
          Live: bool
          RequiredCapabilities: Set<Chip9Capabilities.Capability> }

    /// A cabinet is a durable host object in the Dark Hall. Some cabinets carry
    /// a single hard machine; others are multi-machine cabinets like a
    /// cartridge board plus display/input/audio devices.
    type Cabinet =
        { Name: string
          Does: string
          Verb: string option
          Module: string
          Live: bool
          Machines: Machine list }

    /// The Dark Hall room: the place that owns cabinets. Door modules can
    /// expose entrances, but the room is the stable substrate.
    type Room =
        { Name: string
          Does: string
          Cabinets: Cabinet list }

    let machine
        (name: string)
        (core: MachineCore)
        (does: string)
        (modulePath: string)
        (live: bool)
        (requiredCapabilities: Set<Chip9Capabilities.Capability>)
        : Machine =
        { Name = name
          Core = core
          Does = does
          Module = modulePath
          Live = live
          RequiredCapabilities = requiredCapabilities }

    let cabinet
        (name: string)
        (does: string)
        (verb: string option)
        (modulePath: string)
        (live: bool)
        (machines: Machine list)
        : Cabinet =
        { Name = name
          Does = does
          Verb = verb
          Module = modulePath
          Live = live
          Machines = machines }

    let createRoom (does: string) (cabinets: Cabinet list) : Room =
        { Name = "darkhall"
          Does = does
          Cabinets = cabinets }

    let machines (room: Room) : Machine list =
        room.Cabinets |> List.collect (fun cabinet -> cabinet.Machines)

    let liveMachines (room: Room) : Machine list =
        machines room |> List.filter (fun machine -> machine.Live)

    let machinesRequiring
        (capability: Chip9Capabilities.Capability)
        (room: Room)
        : Machine list =
        machines room
        |> List.filter (fun machine -> machine.RequiredCapabilities |> Set.contains capability)

    /// Emulator CPU state. Immutable (functional step) ⇒ every run replays identically.
    type EmuState =
        { V: int[]      // 16 registers, byte-valued (0..255); VF is the carry/flag register
          I: int        // index register
          PC: int       // program counter (byte offset into the program)
          Halted: bool
          Steps: int }

    /// Fresh CPU: registers zeroed, PC at program start (offset 0 — this slice's convention).
    let init () : EmuState =
        { V = Array.zeroCreate 16; I = 0; PC = 0; Halted = false; Steps = 0 }

    /// One deterministic step over the program memory (read-only; this subset has no self-modifying writes).
    /// Supported opcodes (clean-room CHIP-8 subset): `0000` halt · `1NNN` jump · `3XNN` skip-if-Vx=NN ·
    /// `6XNN` Vx=NN · `7XNN` Vx+=NN (byte-wrap) · `ANNN` I=NNN · `8XY0` Vx=Vy · `8XY4` Vx+=Vy (VF=carry).
    /// Unknown opcodes halt safely. Out-of-range PC halts.
    let step (mem: byte[]) (s: EmuState) : EmuState =
        if s.Halted || s.PC < 0 || s.PC + 1 >= mem.Length then
            { s with Halted = true }
        else
            let op = (int mem.[s.PC] <<< 8) ||| int mem.[s.PC + 1]
            let x = (op >>> 8) &&& 0xF
            let y = (op >>> 4) &&& 0xF
            let nn = op &&& 0xFF
            let nnn = op &&& 0xFFF
            let advanced = { s with PC = s.PC + 2; Steps = s.Steps + 1 }
            let withV (f: int[] -> unit) =
                let v = Array.copy s.V in f v
                { advanced with V = v }

            match op >>> 12, op &&& 0xF with
            | _ when op = 0x0000 -> { s with Halted = true }                 // 0000 halt
            | 0x1, _ -> { advanced with PC = nnn }                            // 1NNN jump
            | 0x3, _ -> if s.V.[x] = nn then { advanced with PC = s.PC + 4 } else advanced // 3XNN skip-if-eq
            | 0x6, _ -> withV (fun v -> v.[x] <- nn)                          // 6XNN Vx=NN
            | 0x7, _ -> withV (fun v -> v.[x] <- (s.V.[x] + nn) &&& 0xFF)     // 7XNN Vx+=NN
            | 0xA, _ -> { advanced with I = nnn }                             // ANNN I=NNN
            | 0x8, 0x0 -> withV (fun v -> v.[x] <- s.V.[y])                   // 8XY0 Vx=Vy
            | 0x8, 0x4 ->                                                     // 8XY4 Vx+=Vy, VF=carry
                withV (fun v ->
                    let sum = s.V.[x] + s.V.[y]
                    v.[0xF] <- (if sum > 0xFF then 1 else 0)
                    v.[x] <- sum &&& 0xFF)
            | _ -> { s with Halted = true }                                  // unknown ⇒ halt safely

    /// Run a program in the Dark Hall to halt or `budget` steps. Pure ⇒ deterministic ⇒ DST-replayable.
    let run (mem: byte[]) (budget: int) : EmuState =
        let rec loop s n = if s.Halted || n <= 0 then s else loop (step mem s) (n - 1)
        loop (init ()) budget

    /// The full execution trace (state after each step, including the start). Identical across runs (replay).
    let trace (mem: byte[]) (budget: int) : EmuState list =
        let rec loop s n acc =
            if s.Halted || n <= 0 then List.rev (s :: acc) else loop (step mem s) (n - 1) (s :: acc)
        loop (init ()) budget []

    // ── Cell wiring (#6957/#6985): the Dark Hall is addressed as a cell via the ZetaCli grammar ──

    /// The ZetaCli noun this cell hosts under: `zeta run dark-hall`.
    [<Literal>]
    let CellName = "dark-hall"

    /// True when a parsed command addresses the Dark Hall cell to run (`zeta run dark-hall`).
    let isAddressed (cmd: ZetaCommand) : bool = cmd.Verb = "run" && cmd.Noun = CellName

    /// Host a program in the Dark Hall cell (the verb "run" on this cell). Deterministic.
    let host (program: byte[]) (budget: int) : EmuState = run program budget
