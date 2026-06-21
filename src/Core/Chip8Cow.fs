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
          Rng: uint64
          /// CHIP-9 (the Zeta color-extension dialect, operator-ratified 2026-06-11): the SELECTED
          /// plane mask (bit0=R/mono, bit1=G, bit2=B). Default 1uy — original ROMs never change it,
          /// so the zero case is structural: mono IS plane 1, not a mode.
          Plane: byte
          /// CHIP-9: the higher planes' per-pixel bitmask (bits 1-2; plane 0 lives in `Display`,
          /// untouched, so every existing mono consumer is unaffected). Canonical: zero ⇒ absent.
          Extra: Map<int, byte>
          /// THE FAULT REGISTER (greenfield right-thing 2026-06-13): None = healthy. A machine
          /// fault (stack underflow on 00EE, …) is RECORDED here instead of silently swallowed —
          /// the trace/DAG/honest-register layers can see it (no secrets in that area). Set-once
          /// per fault; the program keeps running (a ROM bug should be visible, not fatal).
          Fault: string option }

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

    /// CHIP-9: the full color mask at a pixel — bit0 (R/mono) from `Display`, bits 1-2 (G,B) from
    /// `Extra`. A mono frame reads exactly { lit ⇒ 1uy; unlit ⇒ 0uy } — the zero case.
    let colorAt (x: int) (y: int) (f: Frame) : byte =
        let idx = (y % Chip8.DisplayH) * Chip8.DisplayW + (x % Chip8.DisplayW)
        let mono = if Map.tryFind idx f.Display |> Option.defaultValue false then 1uy else 0uy
        let hi = Map.tryFind idx f.Extra |> Option.defaultValue 0uy
        mono ||| hi

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
          Rng = seed
          Plane = 1uy
          Extra = Map.empty
          Fault = None }

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
            | 0x00E0 ->
                // CHIP-9: clear the SELECTED planes only (zero case: mask=1 ⇒ exactly the original
                // mono clear). Canonical Extra: zero ⇒ absent (Map equality stays meaningful).
                let d = if f.Plane &&& 1uy <> 0uy then Map.empty else f.Display
                let keepMask = ~~~f.Plane &&& 0b110uy
                let e =
                    if keepMask = 0b110uy then f.Extra
                    else
                        f.Extra
                        |> Map.toSeq
                        |> Seq.choose (fun (k, m) ->
                            let m' = m &&& keepMask
                            if m' = 0uy then None else Some(k, m'))
                        |> Map.ofSeq
                { f with Display = d; Extra = e }
            | 0x00EE ->
                match f.Stack with
                | top :: rest -> { f with PC = top; Stack = rest }
                | [] when f.Fault = None -> { f with Fault = Some "stack underflow: 00EE (RET) on empty stack" }
                | [] -> f
            | _ -> f
        | 0x1000 -> { f with PC = nnn }
        | 0x2000 ->
            // STACK-DEPTH FAULT (shadow*, 2026-06-11 — completing the underflow's pair): classic
            // CHIP-8 caps nesting at 16 frames; ours is a heap list, so without this cap a
            // runaway CALL loop grows memory silently forever. At depth 16 the CALL is REFUSED
            // (fall through to the next instruction) and the fault is RECORDED — visible to the
            // trace layers, never fatal, same register discipline as 00EE underflow.
            if List.length f.Stack >= 16 then
                if f.Fault = None then { f with Fault = Some "stack overflow: CALL (2NNN) at depth 16 refused" } else f
            else
                { f with Stack = f.PC :: f.Stack; PC = nnn }
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
            // VF writes LAST, from PRE-captured operands (Kira r3: with x=F or y=F the old order
            // let the result clobber the flag — spec says the flag write wins; the mutable oracle
            // additionally read operands AFTER writing VF, so the two machines diverged exactly
            // on the registers the cross-check claim covered).
            | 0x4 ->
                let sum = int vx + int vy
                f |> setV x (byte (sum &&& 0xFF)) |> setV 0xF (if sum > 0xFF then 1uy else 0uy)
            | 0x5 -> f |> setV x (vx - vy) |> setV 0xF (if vx >= vy then 1uy else 0uy)
            | 0x6 -> f |> setV x (vx >>> 1) |> setV 0xF (vx &&& 1uy)
            | 0x7 -> f |> setV x (vy - vx) |> setV 0xF (if vy >= vx then 1uy else 0uy)
            | 0xE -> f |> setV x (vx <<< 1) |> setV 0xF ((vx >>> 7) &&& 1uy)
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
            let mutable extra = f.Extra
            let mutable collision = 0uy
            let hiSel = f.Plane &&& 0b110uy

            for row in 0 .. n - 1 do
                let sprite = rd (int f.I + row) f
                for col in 0..7 do
                    if (sprite >>> (7 - col)) &&& 1uy = 1uy then
                        // COSMAC VIP edge semantics (081KTZ4EF0008QG0R002WVTMMJ): the ORIGIN wraps (ox/oy above), but
                        // pixels CLIP at the right/bottom edge — they are not wrapped around. A
                        // clipped pixel is never written AND never collision-checked (VF counts
                        // collisions only on drawn pixels — Kira's review condition, free here).
                        let px = ox + col
                        let py = oy + row
                        if px < Chip8.DisplayW && py < Chip8.DisplayH then
                            let idx = py * Chip8.DisplayW + px
                            // plane 0 (R/mono) — the original path, untouched when unselected (CHIP-9)
                            if f.Plane &&& 1uy <> 0uy then
                                let cur = Map.tryFind idx disp |> Option.defaultValue false
                                if cur then collision <- 1uy
                                disp <- Map.add idx (not cur) disp
                            // planes 1-2 (G,B) — XOR the selected high bits; canonical zero ⇒ absent
                            if hiSel <> 0uy then
                                let cur = Map.tryFind idx extra |> Option.defaultValue 0uy
                                if cur &&& hiSel <> 0uy then collision <- 1uy
                                let nxt = cur ^^^ hiSel
                                extra <- if nxt = 0uy then Map.remove idx extra else Map.add idx nxt extra

            { f with Display = disp; Extra = extra } |> setV 0xF collision
        | 0xE000 ->
            match op &&& 0x00FF with
            | 0x9E -> if f.Keys.[int vx &&& 0xF] then { f with PC = f.PC + 2us } else f
            | 0xA1 -> if not f.Keys.[int vx &&& 0xF] then { f with PC = f.PC + 2us } else f
            | _ -> f
        | 0xF000 ->
            match op &&& 0x00FF with
            | 0x01 ->
                // CHIP-9 plane select `Fn01` (XO-CHIP lineage, widened to 3 planes = RGB): n = the
                // X nibble, masked to 0..7. Unused encoding space — original ROMs never emit it.
                { f with Plane = byte x &&& 0b111uy }
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

    /// **One frame = `cyclesPerFrame` CPU steps, then the 60 Hz `tick` (the interrupt).** This is the *live*
    /// unit of execution. `step`/`run` alone never `tick`, so a ROM that waits on the delay timer (set `FX15`,
    /// loop on `FX07`/`3XNN` until it hits 0 — a very common pattern) **spins forever** because the timer never
    /// decrements. Empirically (the `SoftEmu` run, 2026-06-08) a step-only soft run froze at one reachable state
    /// (empowerment collapsed to 1); interleaving `tick` released it and the game animated. `cyclesPerFrame ≈ 8`
    /// matches the classic ~500 Hz CPU / 60 Hz timer ratio. The keys held are whatever is on the frame.
    let frameStep (cyclesPerFrame: int) (f: Frame) : Frame =
        let mutable s = f
        for _ in 1 .. max 1 cyclesPerFrame do
            s <- step s
        tick s
