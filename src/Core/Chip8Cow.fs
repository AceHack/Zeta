namespace Zeta.Core

/// **`Chip8Cow` — the CHIP-8 emulator as a DAG of copy-on-write zset frames (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"the mutable single-path interpreter is the blocker — we need each emulator frame to be a zset
/// frame, and the next frame is a COW of the next memory space: just a DAG of COWs."* This is that. A `Frame`
/// is an **immutable value**; memory and display are **persistent `Map`s** (structural sharing = copy-on-write
/// — the next frame shares every unchanged cell with its parent, only the written cells differ = the zset
/// delta). `step : Frame → Frame` is **pure**: every step is a new frame-value, so —
///   - keeping old frames **is** the **DAG of COWs** (the timeline);
///   - **fork** = step one frame two ways (children share the parent's structure, no aliasing — cheap);
///   - **rewind** = keep the parent frame; **fast-forward** = fold `step`.
/// This is the immutable foundation **soft evolution** needs (`softStep : Frame → SoftValue<Frame>` next): with
/// COW, branching is free (no full-memory copy), so the speculative branch-tree is cheap.
///
/// **Relation to `Chip8` (the native oracle):** `Chip8` (mutable arrays) is the fast deterministic reference;
/// `Chip8Cow` is the persistent/COW version that the soft + timeline layers ride. Same opcodes, same results
/// (cross-checked) — the `StoredProc` native-vs-interpreted differential, applied to the emulator. DST §7: a
/// frame's only entropy is its `Rng` seed (the `RND` opcode), so runs are byte-for-byte replayable.
///
/// **Honest scope (peel):** persistent `Map` memory trades raw speed for free COW/branching/structural-sharing
/// (the right tradeoff for a *forkable, rewindable, soft* emulator; `Chip8` stays the speed path). Same opcode
/// subset as `Chip8` (`FX0A` = no-advance wait). The DAG is *implicit* in retained frame-values here; an
/// explicit parent-linked DAG / timeline-ops wiring is the next slice.
[<RequireQualifiedAccess>]
module Chip8Cow =

    /// An immutable emulator frame. `Mem`/`Display` are persistent maps (COW; absent ⇒ `0`/unlit). `V`/`Keys`
    /// are tiny (16) — copied on write (cheap). `Stack` is an immutable list (cons = push, tail = pop).
    type Frame =
        { Mem: Map<int, byte>
          V: byte[]
          I: uint16
          PC: uint16
          Stack: uint16 list
          Delay: byte
          Sound: byte
          Display: Map<int, bool>
          Keys: bool[]
          Rng: uint64 }

    let private rd (addr: int) (f: Frame) : byte =
        Map.tryFind addr f.Mem |> Option.defaultValue 0uy

    let private wr (addr: int) (v: byte) (f: Frame) : Frame = { f with Mem = Map.add addr v f.Mem }

    let private setV (i: int) (v: byte) (f: Frame) : Frame =
        let a = Array.copy f.V
        a.[i] <- v
        { f with V = a }

    /// A pixel (COW display map; absent ⇒ unlit).
    let pixel (x: int) (y: int) (f: Frame) : bool =
        Map.tryFind ((y % Chip8.DisplayH) * Chip8.DisplayW + (x % Chip8.DisplayW)) f.Display
        |> Option.defaultValue false

    /// A fresh frame with the font loaded (into the COW map) and the given DST `seed`; `PC = 0x200`.
    let create (seed: uint64) : Frame =
        let mem =
            Chip8.fontSet
            |> Array.mapi (fun i b -> Chip8.FontBase + i, b)
            |> Map.ofArray
        { Mem = mem
          V = Array.zeroCreate 16
          I = 0us
          PC = uint16 Chip8.ProgramStart
          Stack = []
          Delay = 0uy
          Sound = 0uy
          Display = Map.empty
          Keys = Array.zeroCreate 16
          Rng = seed }

    /// Load a ROM at `0x200` (COW writes).
    let loadRom (rom: byte[]) (f: Frame) : Frame =
        rom |> Array.indexed |> Array.fold (fun acc (i, b) -> wr (Chip8.ProgramStart + i) b acc) f

    /// Decrement the timers — the 60 Hz interrupt (returns a new frame; COW).
    let tick (f: Frame) : Frame =
        { f with
            Delay = (if f.Delay > 0uy then f.Delay - 1uy else 0uy)
            Sound = (if f.Sound > 0uy then f.Sound - 1uy else 0uy) }

    let private nextRand (f: Frame) : byte * Frame =
        let s = f.Rng + SplitMix64.GoldenRatio
        byte (SplitMix64.mix s &&& 0xFFUL), { f with Rng = s }

    /// **Pure** one-instruction step: `Frame → Frame` (the COW transition; parent is untouched).
    let step (f0: Frame) : Frame =
        let pc = int f0.PC
        let op = (int (rd pc f0) <<< 8) ||| int (rd (pc + 1) f0)
        let f = { f0 with PC = f0.PC + 2us } // default advance
        let x = (op &&& 0x0F00) >>> 8
        let y = (op &&& 0x00F0) >>> 4
        let n = op &&& 0x000F
        let nn = byte (op &&& 0x00FF)
        let nnn = uint16 (op &&& 0x0FFF)
        let vx = f.V.[x]
        let vy = f.V.[y]

        match op &&& 0xF000 with
        | 0x0000 ->
            match op with
            | 0x00E0 -> { f with Display = Map.empty }
            | 0x00EE ->
                match f.Stack with
                | top :: rest -> { f with PC = top; Stack = rest }
                | [] -> f
            | _ -> f
        | 0x1000 -> { f with PC = nnn }
        | 0x2000 -> { f with Stack = f.PC :: f.Stack; PC = nnn }
        | 0x3000 -> if vx = nn then { f with PC = f.PC + 2us } else f
        | 0x4000 -> if vx <> nn then { f with PC = f.PC + 2us } else f
        | 0x5000 -> if vx = vy then { f with PC = f.PC + 2us } else f
        | 0x6000 -> setV x nn f
        | 0x7000 -> setV x (vx + nn) f
        | 0x8000 ->
            match n with
            | 0x0 -> setV x vy f
            | 0x1 -> setV x (vx ||| vy) f
            | 0x2 -> setV x (vx &&& vy) f
            | 0x3 -> setV x (vx ^^^ vy) f
            | 0x4 ->
                let sum = int vx + int vy
                f |> setV 0xF (if sum > 0xFF then 1uy else 0uy) |> setV x (byte (sum &&& 0xFF))
            | 0x5 -> f |> setV 0xF (if vx >= vy then 1uy else 0uy) |> setV x (vx - vy)
            | 0x6 -> f |> setV 0xF (vx &&& 1uy) |> setV x (vx >>> 1)
            | 0x7 -> f |> setV 0xF (if vy >= vx then 1uy else 0uy) |> setV x (vy - vx)
            | 0xE -> f |> setV 0xF ((vx >>> 7) &&& 1uy) |> setV x (vx <<< 1)
            | _ -> f
        | 0x9000 -> if vx <> vy then { f with PC = f.PC + 2us } else f
        | 0xA000 -> { f with I = nnn }
        | 0xB000 -> { f with PC = nnn + uint16 f.V.[0] }
        | 0xC000 ->
            let r, f' = nextRand f
            setV x (r &&& nn) f'
        | 0xD000 ->
            let ox = int vx % Chip8.DisplayW
            let oy = int vy % Chip8.DisplayH
            let mutable disp = f.Display
            let mutable collision = 0uy
            for row in 0 .. n - 1 do
                let sprite = rd (int f.I + row) f
                for col in 0..7 do
                    if (sprite >>> (7 - col)) &&& 1uy = 1uy then
                        let idx = ((oy + row) % Chip8.DisplayH) * Chip8.DisplayW + ((ox + col) % Chip8.DisplayW)
                        let cur = Map.tryFind idx disp |> Option.defaultValue false
                        if cur then collision <- 1uy
                        disp <- Map.add idx (not cur) disp
            { f with Display = disp } |> setV 0xF collision
        | 0xE000 ->
            match op &&& 0x00FF with
            | 0x9E -> if f.Keys.[int vx &&& 0xF] then { f with PC = f.PC + 2us } else f
            | 0xA1 -> if not f.Keys.[int vx &&& 0xF] then { f with PC = f.PC + 2us } else f
            | _ -> f
        | 0xF000 ->
            match op &&& 0x00FF with
            | 0x07 -> setV x f.Delay f
            | 0x0A ->
                match Array.tryFindIndex id f.Keys with
                | Some k -> setV x (byte k) f
                | None -> { f with PC = f.PC - 2us }
            | 0x15 -> { f with Delay = vx }
            | 0x18 -> { f with Sound = vx }
            | 0x1E -> { f with I = f.I + uint16 vx }
            | 0x29 -> { f with I = uint16 (Chip8.FontBase + int vx * 5) }
            | 0x33 ->
                f
                |> wr (int f.I) (vx / 100uy)
                |> wr (int f.I + 1) ((vx / 10uy) % 10uy)
                |> wr (int f.I + 2) (vx % 10uy)
            | 0x55 -> [ 0..x ] |> List.fold (fun acc r -> wr (int f.I + r) acc.V.[r] acc) f
            | 0x65 -> [ 0..x ] |> List.fold (fun acc r -> setV r (rd (int f.I + r) acc) acc) f
            | _ -> f
        | _ -> f

    /// Fold `n` pure steps — returns the final frame; every intermediate frame is a retained COW value if the
    /// caller keeps them (the DAG). Deterministic (DST §7).
    let run (n: int) (f: Frame) : Frame =
        let mutable s = f
        for _ in 1 .. max 0 n do
            s <- step s
        s

    /// **Fork:** the two child frames produced by stepping `f` under two different key-inputs — both share `f`'s
    /// COW structure (no aliasing). The atom of the DAG / soft branch.
    let fork (keysA: bool[]) (keysB: bool[]) (f: Frame) : Frame * Frame =
        step { f with Keys = keysA }, step { f with Keys = keysB }

    /// **The step-dynamics as a genuine `IMonoid` (Aaron 2026-06-08).** "Can we put the emulator in the numeric
    /// interfaces?" — the *whole* emulator is NOT an `IStarRing` (the state is not a ring: no meaningful
    /// `frame × frame`, just as qubit *states* are an `IGroup` not a ring). But the **time-evolution is a
    /// genuine monoid**: state-transitions `Frame → Frame` compose, with the no-op as identity. `step` is one
    /// element; `run n` = the monoid power. (Surrounding interfaces that ARE genuine: this monoid; the CRDT
    /// memory-merge = `ISemilattice`; `SoftValue<Frame>` = a rig *without* `Negate`. Implement the interface the
    /// structure has — don't force a ring.) Matches the `ImaginaryStack.complex : IStarRing` value pattern.
    let dynamics: IMonoid<Frame -> Frame> =
        { new IMonoid<Frame -> Frame> with
            member _.Identity = id
            member _.Combine(f, g) = f >> g } // apply f then g — sequential composition
