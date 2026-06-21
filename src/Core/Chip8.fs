namespace Zeta.Core

/// **`Chip8` — a deterministic CHIP-8 emulator core (Aaron 2026-06-08, shadow*).**
///
/// The first target of the DST-time-emulator vision (the interrupt-as-DST-time-source / timeline-ops design).
/// CHIP-8 is the canonical first emulator — 4 KB memory, 16 registers, 35 opcodes, a 64×32 monochrome display,
/// and a 60 Hz timer pair (delay/sound) that is **the interrupt**. Built deterministic + replayable (DST §7):
/// given `(rom, seed, key-input sequence)` the run is reproducible byte-for-byte — which is exactly what makes
/// `rewind`/`fast-forward`/`fork`/`join` over the emulator possible (save-states / time-travel).
///
/// **DST detail:** the `RND` opcode (`CXNN`) draws from our seeded `SplitMix64` PRNG (`Rng` state), NOT system
/// randomness — so the *only* entropy is the seed (the DST generator). Inject a different seed = a different
/// run; same seed = identical run. The timer pair decrements on `tick` (the interrupt / time source).
///
/// **IP discipline (reference-not-copy):** this is *our* emulator code (no IP issue). Real ROMs stay in the
/// gitignored `references/prior-art/chip8-roms/` (reference-not-copy); tests here use **hand-authored** tiny
/// ROMs (a few opcodes, authored by Otto — no copyright). Atari 2600 is the bigger follow-on (6502 + TIA, and
/// its ROMs need the 081KQ8P5D0008QG0R001590WJ3 safe/unsafe IP handling — copyrighted, reference-not-copy).
///
/// **Honest scope (peel):** a solid opcode subset (control / ALU / memory / draw / keys / timers / DST-RND) —
/// enough to run real programs; `FX0A` (block-on-key) is modelled as a no-advance wait. Mutable arrays for
/// speed with `clone` for snapshots (fork/rewind); determinism holds (same inputs → same state). Not yet
/// wired to the timeline-ops module — that's the next slice.
[<RequireQualifiedAccess>]
module Chip8 =

    [<Literal>]
    let MemSize = 4096

    [<Literal>]
    let ProgramStart = 0x200

    [<Literal>]
    let FontBase = 0x50

    [<Literal>]
    let DisplayW = 64

    [<Literal>]
    let DisplayH = 32

    /// The standard CHIP-8 hex font (0–F), 16 glyphs × 5 bytes.
    let fontSet: byte[] =
        [| 0xF0uy; 0x90uy; 0x90uy; 0x90uy; 0xF0uy // 0
           0x20uy; 0x60uy; 0x20uy; 0x20uy; 0x70uy // 1
           0xF0uy; 0x10uy; 0xF0uy; 0x80uy; 0xF0uy // 2
           0xF0uy; 0x10uy; 0xF0uy; 0x10uy; 0xF0uy // 3
           0x90uy; 0x90uy; 0xF0uy; 0x10uy; 0x10uy // 4
           0xF0uy; 0x80uy; 0xF0uy; 0x10uy; 0xF0uy // 5
           0xF0uy; 0x80uy; 0xF0uy; 0x90uy; 0xF0uy // 6
           0xF0uy; 0x10uy; 0x20uy; 0x40uy; 0x40uy // 7
           0xF0uy; 0x90uy; 0xF0uy; 0x90uy; 0xF0uy // 8
           0xF0uy; 0x90uy; 0xF0uy; 0x10uy; 0xF0uy // 9
           0xF0uy; 0x90uy; 0xF0uy; 0x90uy; 0x90uy // A
           0xE0uy; 0x90uy; 0xE0uy; 0x90uy; 0xE0uy // B
           0xF0uy; 0x80uy; 0x80uy; 0x80uy; 0xF0uy // C
           0xE0uy; 0x90uy; 0x90uy; 0x90uy; 0xE0uy // D
           0xF0uy; 0x80uy; 0xF0uy; 0x80uy; 0xF0uy // E
           0xF0uy; 0x80uy; 0xF0uy; 0x80uy; 0x80uy |] // F

    /// Machine state. Mutable arrays + mutable scalars for speed; `clone` snapshots for fork/rewind.
    type Chip8 =
        { Mem: byte[]
          V: byte[]
          mutable I: uint16
          mutable PC: uint16
          Stack: uint16[]
          mutable SP: int
          mutable Delay: byte
          mutable Sound: byte
          Display: bool[] // DisplayW*DisplayH, row-major
          Keys: bool[] // 16
          mutable Rng: uint64 } // DST seed state (the only entropy source)

    /// Fresh machine with the font loaded and the given DST `seed`. `PC = 0x200`.
    let create (seed: uint64) : Chip8 =
        let mem = Array.zeroCreate MemSize
        System.Array.Copy(fontSet, 0, mem, FontBase, fontSet.Length)
        { Mem = mem
          V = Array.zeroCreate 16
          I = 0us
          PC = uint16 ProgramStart
          Stack = Array.zeroCreate 16
          SP = 0
          Delay = 0uy
          Sound = 0uy
          Display = Array.zeroCreate (DisplayW * DisplayH)
          Keys = Array.zeroCreate 16
          Rng = seed }

    /// Load a ROM into memory at `0x200`.
    let loadRom (rom: byte[]) (c: Chip8) : unit =
        System.Array.Copy(rom, 0, c.Mem, ProgramStart, rom.Length)

    /// A deep snapshot (for fork / rewind / save-state — the timeline ops).
    let clone (c: Chip8) : Chip8 =
        { Mem = Array.copy c.Mem
          V = Array.copy c.V
          I = c.I
          PC = c.PC
          Stack = Array.copy c.Stack
          SP = c.SP
          Delay = c.Delay
          Sound = c.Sound
          Display = Array.copy c.Display
          Keys = Array.copy c.Keys
          Rng = c.Rng }

    /// Next DST random byte (SplitMix64 over the seed state); advances `Rng`.
    let private nextRand (c: Chip8) : byte =
        let s = c.Rng + SplitMix64.GoldenRatio
        c.Rng <- s
        byte (SplitMix64.mix s &&& 0xFFUL)

    /// Decrement the delay/sound timers — **the interrupt / 60 Hz time source**. Call once per frame tick.
    let tick (c: Chip8) : unit =
        if c.Delay > 0uy then c.Delay <- c.Delay - 1uy
        if c.Sound > 0uy then c.Sound <- c.Sound - 1uy

    /// Is the sound timer active (a beep would be playing)?
    let beeping (c: Chip8) : bool = c.Sound > 0uy

    /// Read a display pixel.
    let pixel (x: int) (y: int) (c: Chip8) : bool =
        c.Display.[(y % DisplayH) * DisplayW + (x % DisplayW)]

    /// Execute exactly one instruction (fetch–decode–execute), advancing `PC`. Deterministic.
    let step (c: Chip8) : unit =
        let pc = int c.PC
        let hi = c.Mem.[pc]
        let lo = c.Mem.[pc + 1]
        let op = (int hi <<< 8) ||| int lo
        c.PC <- c.PC + 2us // default advance; jumps overwrite below
        let x = (op &&& 0x0F00) >>> 8
        let y = (op &&& 0x00F0) >>> 4
        let n = op &&& 0x000F
        let nn = byte (op &&& 0x00FF)
        let nnn = uint16 (op &&& 0x0FFF)

        match op &&& 0xF000 with
        | 0x0000 ->
            match op with
            | 0x00E0 -> System.Array.Clear(c.Display, 0, c.Display.Length) // clear screen
            | 0x00EE ->
                c.SP <- c.SP - 1
                c.PC <- c.Stack.[c.SP] // return
            | _ -> () // 0NNN (legacy machine call) — ignored
        | 0x1000 -> c.PC <- nnn // jump
        | 0x2000 ->
            c.Stack.[c.SP] <- c.PC
            c.SP <- c.SP + 1
            c.PC <- nnn // call
        | 0x3000 -> if c.V.[x] = nn then c.PC <- c.PC + 2us
        | 0x4000 -> if c.V.[x] <> nn then c.PC <- c.PC + 2us
        | 0x5000 -> if c.V.[x] = c.V.[y] then c.PC <- c.PC + 2us
        | 0x6000 -> c.V.[x] <- nn
        | 0x7000 -> c.V.[x] <- c.V.[x] + nn // wraps (byte)
        | 0x8000 ->
            match n with
            | 0x0 -> c.V.[x] <- c.V.[y]
            | 0x1 -> c.V.[x] <- c.V.[x] ||| c.V.[y]
            | 0x2 -> c.V.[x] <- c.V.[x] &&& c.V.[y]
            | 0x3 -> c.V.[x] <- c.V.[x] ^^^ c.V.[y]
            // operands PRE-captured, VF LAST (Kira r3 — see Chip8Cow for the full note)
            | 0x4 ->
                let ax, ay = c.V.[x], c.V.[y]
                let sum = int ax + int ay
                c.V.[x] <- byte (sum &&& 0xFF)
                c.V.[0xF] <- (if sum > 0xFF then 1uy else 0uy)
            | 0x5 ->
                let ax, ay = c.V.[x], c.V.[y]
                c.V.[x] <- ax - ay
                c.V.[0xF] <- (if ax >= ay then 1uy else 0uy)
            | 0x6 ->
                let ax = c.V.[x]
                c.V.[x] <- ax >>> 1
                c.V.[0xF] <- ax &&& 1uy
            | 0x7 ->
                let ax, ay = c.V.[x], c.V.[y]
                c.V.[x] <- ay - ax
                c.V.[0xF] <- (if ay >= ax then 1uy else 0uy)
            | 0xE ->
                let ax = c.V.[x]
                c.V.[x] <- ax <<< 1
                c.V.[0xF] <- (ax >>> 7) &&& 1uy
            | _ -> ()
        | 0x9000 -> if c.V.[x] <> c.V.[y] then c.PC <- c.PC + 2us
        | 0xA000 -> c.I <- nnn
        | 0xB000 -> c.PC <- nnn + uint16 c.V.[0]
        | 0xC000 -> c.V.[x] <- nextRand c &&& nn // DST RND
        | 0xD000 ->
            // Draw N-byte sprite at (V[x], V[y]); XOR; VF = collision.
            let vx = int c.V.[x] % DisplayW
            let vy = int c.V.[y] % DisplayH
            c.V.[0xF] <- 0uy
            for row in 0 .. n - 1 do
                let sprite = c.Mem.[int c.I + row]
                for col in 0..7 do
                    if (sprite >>> (7 - col)) &&& 1uy = 1uy then
                        // COSMAC VIP: origin wraps (vx/vy already % above), pixels CLIP (081KTZ4EF0008QG0R002WVTMMJ)
                        let px = vx + col
                        let py = vy + row
                        if px < DisplayW && py < DisplayH then
                            let idx = py * DisplayW + px
                            if c.Display.[idx] then c.V.[0xF] <- 1uy // collision
                            c.Display.[idx] <- not c.Display.[idx]
        | 0xE000 ->
            match op &&& 0x00FF with
            | 0x9E -> if c.Keys.[int c.V.[x] &&& 0xF] then c.PC <- c.PC + 2us
            | 0xA1 -> if not c.Keys.[int c.V.[x] &&& 0xF] then c.PC <- c.PC + 2us
            | _ -> ()
        | 0xF000 ->
            match op &&& 0x00FF with
            | 0x07 -> c.V.[x] <- c.Delay
            | 0x0A ->
                // wait for key: if none pressed, do not advance (re-execute this op next step)
                match Array.tryFindIndex id c.Keys with
                | Some k -> c.V.[x] <- byte k
                | None -> c.PC <- c.PC - 2us
            | 0x15 -> c.Delay <- c.V.[x]
            | 0x18 -> c.Sound <- c.V.[x]
            | 0x1E -> c.I <- c.I + uint16 c.V.[x]
            | 0x29 -> c.I <- uint16 (FontBase + int c.V.[x] * 5)
            | 0x33 ->
                let v = c.V.[x]
                c.Mem.[int c.I] <- v / 100uy
                c.Mem.[int c.I + 1] <- (v / 10uy) % 10uy
                c.Mem.[int c.I + 2] <- v % 10uy
            | 0x55 ->
                for r in 0..x do
                    c.Mem.[int c.I + r] <- c.V.[r]
            | 0x65 ->
                for r in 0..x do
                    c.V.[r] <- c.Mem.[int c.I + r]
            | _ -> ()
        | _ -> ()

    /// Run `n` instructions (deterministic; the cooperative DST loop). Ticking the timers is the caller's
    /// frame cadence (`tick`) — kept separate so the instruction rate and the 60 Hz interrupt are independent.
    let run (n: int) (c: Chip8) : unit =
        for _ in 1 .. max 0 n do
            step c
