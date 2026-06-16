namespace Zeta.Core

open System.Threading.Tasks

/// Arcade — the **door** on the *darkhall* landmark (Aaron 2026-06-10, shadow*: "darkhall next — give the
/// arcade its door"). `DarkHall` is the room: the place that owns cabinets. `Arcade` is the navigable
/// door that lists the cabinets and exposes live entrances into their machines.
///
/// The darkhall is the dim hall of cabinets — the **emulator / VM / games** landmark, where (Aaron +
/// Max 2026-06-10) **programs are decompiled down to MIPS-like primitives** and **rooms are the CPU's
/// micro-operations**: a room/cell is a μop, the program decompiles into rooms, and the soft layer does
/// **branch detection in real time** (the only soft fork is on unknown future input). This door gathers
/// the Dark Hall's cabinets under one name and gives **live entrances** — `play` (a ROM on the soft
/// scheduler), `playMetaCabinet` (a capability-gated multi-cart cabinet), and `host` (the clean-room
/// `DarkHall` CPU) — so you can walk in and run a cabinet.
[<RequireQualifiedAccess>]
module Arcade =

    type MachineCore = DarkHall.MachineCore
    type Machine = DarkHall.Machine
    type Cabinet = DarkHall.Cabinet
    type Room = DarkHall.Room

    let private noCapabilities: Set<Chip9Capabilities.Capability> = Set.empty

    let private softScheduler =
        DarkHall.machine
            "soft-chip8"
            MachineCore.SoftChip8Scheduler
            "run a CHIP-8 ROM on the soft IScheduler for N 60Hz frames"
            "src/Core/SoftChip8Scheduler.fs"
            true
            noCapabilities

    let private chip9Color =
        DarkHall.machine
            "chip9-color"
            MachineCore.Chip9ColorPlanes
            "CHIP-9 color-plane extension, guarded by an explicit room capability"
            "src/Core/Chip9Capabilities.fs + src/Core/Chip8Cow.fs"
            true
            (Set.singleton Chip9Capabilities.Capability.ColorPlanes)

    let private metaCartHost =
        DarkHall.machine
            "meta-cart-host"
            MachineCore.MetaCartHost
            "host-assisted cart-that-can-play-carts boundary, with typed refusals and heat"
            "src/Core/MetaCart.fs"
            true
            (Set.singleton Chip9Capabilities.Capability.HostAssistedChildLaunch)

    let private darkHallCpu =
        DarkHall.machine
            "darkhall-cpu"
            MachineCore.DarkHallCpu
            "clean-room minimal CHIP-8-subset CPU, deterministic and DST-replayable"
            "src/Core/DarkHall.fs"
            true
            noCapabilities

    let private cowStepper =
        DarkHall.machine
            "chip8-cow-step"
            MachineCore.Chip8Cow
            "one pure CHIP-8 instruction transition; parent frame untouched"
            "src/Core/Chip8Cow.fs"
            true
            noCapabilities

    let private predictor =
        DarkHall.machine
            "soft-chip8-predictor"
            MachineCore.SoftChip8Predictor
            "real-time branch detection and funded look-ahead"
            "src/Core/SoftChip8.fs + src/Core/SoftChip8Flux.fs"
            true
            noCapabilities

    let private fingerprint =
        DarkHall.machine
            "game-fingerprint"
            MachineCore.FingerprintPrism
            "hard exact key plus soft game recognition"
            "src/Core/GameFingerprint.fs + src/Core/FingerprintPrism.fs"
            true
            noCapabilities

    let private catalog =
        DarkHall.machine
            "game-catalog"
            MachineCore.GameCatalog
            "per-game soft state keyed by fingerprint"
            "src/Core/GamePortfolio.fs + src/Core/GameCatalog.fs"
            false
            noCapabilities

    let private simLoop =
        DarkHall.machine
            "sim-loop"
            MachineCore.SimLoop
            "the deterministic edge tick the cabinets lift"
            "src/Core/Sim.fs"
            true
            noCapabilities

    /// The Dark Hall's cabinets — emulator fittings gathered under one door.
    /// The `play` cabinet is intentionally multi-machine: classic CHIP-8,
    /// CHIP-9 color, and host-assisted child-cart launch share one cabinet
    /// boundary the way a multi-cart arcade board shares one cabinet shell.
    let cabinets: Cabinet list =
        [ DarkHall.cabinet
              "play"
              "multi-machine CHIP-8/CHIP-9 cabinet: soft scheduler, color-plane extension, and host-assisted child carts"
              (Some "sim")
              "src/Core/SoftChip8Scheduler.fs + src/Core/Chip9Capabilities.fs + src/Core/MetaCart.fs"
              true
              [ softScheduler; chip9Color; metaCartHost ]
          DarkHall.cabinet
              "host"
              "the clean-room minimal CHIP-8-subset CPU cell — deterministic, DST-replayable"
              (Some "sim")
              "src/Core/DarkHall.fs"
              true
              [ darkHallCpu ]
          DarkHall.cabinet
              "step"
              "one pure CHIP-8 instruction (the COW transition; parent untouched)"
              None
              "src/Core/Chip8Cow.fs"
              true
              [ cowStepper ]
          DarkHall.cabinet
              "predict"
              "real-time BRANCH DETECTION — the only soft fork is on unknown future input; batch look-ahead between branches (play∥predict)"
              None
              "src/Core/SoftChip8.fs"
              true
              [ predictor ]
          DarkHall.cabinet
              "fingerprint"
              "identify the game — hard exact key (SHA-256) + soft recognition (FingerprintPrism)"
              None
              "src/Core/GameFingerprint.fs + src/Core/FingerprintPrism.fs"
              true
              [ fingerprint ]
          DarkHall.cabinet
              "catalog"
              "per-game soft state keyed by fingerprint (switch games staying soft)"
              (Some "cla")
              "src/Core/GamePortfolio.fs + src/Core/GameCatalog.fs"
              false
              [ catalog ]
          DarkHall.cabinet
              "sim"
              "the ephemeral void run (the deterministic edge tick the cabinets lift)"
              (Some "sim")
              "src/Core/Sim.fs"
              true
              [ simLoop ] ]

    /// The arcade's name and what work happens here (the signage).
    let private signage =
        "the arcade — emulators / VMs / games; decompile programs to MIPS-like μops; rooms = micro-ops; real-time branch detection"

    let room: Room = DarkHall.createRoom signage cabinets

    let name = room.Name
    let does = room.Does

    let machines: Machine list = DarkHall.machines room
    let liveMachines: Machine list = DarkHall.liveMachines room

    let machinesRequiring (capability: Chip9Capabilities.Capability) : Machine list =
        DarkHall.machinesRequiring capability room

    /// Live entrance: `play` — run a CHIP-8 ROM on the soft scheduler for `frames` 60Hz ticks (delegates
    /// to the working `SoftChip8Scheduler`).
    let play (seed: uint64) (rom: byte[]) (frames: int) : Task<Result<Chip8Cow.Frame, InterruptFeedback>> =
        SoftChip8Scheduler.run seed rom frames

    /// Live entrance: `playMetaCabinet` — run the Dark Hall's multi-cart
    /// cabinet. The parent machine chooses; the room/cabinet capabilities
    /// decide whether the selected child can cross the host boundary.
    let playMetaCabinet
        (source: string)
        (sink: IHeatSink)
        (goal: int)
        (seed: uint64)
        (parentCapabilities: Chip9Capabilities.Manifest)
        (childCapabilitiesBySha: Map<string, Chip9Capabilities.Manifest>)
        (children: Cart.Cart list)
        (parent: Chip8Cow.Frame)
        : Result<MetaCart.ReflectedPlayResult, MetaCart.Feedback> =
        MetaCart.playChosenCarriedWithCapabilities
            source
            sink
            goal
            seed
            parentCapabilities
            childCapabilitiesBySha
            children
            parent

    /// Live entrance: `host` — run a program on the clean-room `DarkHall` CPU to halt or `budget` steps
    /// (deterministic, DST-replayable). The hard cabinet.
    let host (program: byte[]) (budget: int) : DarkHall.EmuState =
        DarkHall.run program budget

    /// The cabinets that are working slices today (Live = true).
    let liveCabinets: Cabinet list = cabinets |> List.filter (fun c -> c.Live)
