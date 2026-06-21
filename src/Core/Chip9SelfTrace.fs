namespace Zeta.Core

/// Chip9SelfTrace — **CHIP-9 ray-traces its OWN instructions onto its OWN planes, in real time**
/// (Aaron 2026-06-11: "we are literally building out chip8 ray tracing of its own instructions — it
/// would be amazing if it could run this on itself at runtime. Our chip9 should be the SMALLEST SYSTEM
/// THAT CAN BE FULLY SELF-REFLECTIVE about its own running instruction set, in real time, in soft
/// mode — full hardware to the bone with qemu/microkernel reflection, tiny").
///
/// Channel assignment — REVISED by a live discovery (the first run had executed=R=mono, and the
/// program's OWN DRW fought the trace for the mono plane: XOR toggled the worldline off — the
/// reflection channel must never be the program's performance channel, the Grok lesson at pixel
/// scale). The trace therefore lives on the planes programs rarely select:
/// - **G (plane 2)** — the EXECUTED path: each step paints the cell of the PC that just ran.
/// - **CYAN (mask 6 = G|B)** — the DATA flow: addresses the step READ (I-window on DRW/FX65).
/// - **B (plane 4)** — the SPECULATED future: the PCs `SoftChip8.lookAhead` would visit next.
/// - **R (mono)** — stays the PROGRAM'S OWN: its display is untouched by reflection.
///
/// Address→pixel: instruction slot (addr−0x200)/2 maps onto the 64×32 grid (2048 cells ≥ 1792 slots —
/// the whole program space fits ON the display; the trace IS the program's worldline drawn over its
/// own address space, Feynman-diagram style).
///
/// **The self-reflective jewel — no new opcodes needed:** the trace lands in the machine's OWN plane
/// memory, and DRW's collision flag (VF) reports XOR hits per selected plane — so a ROM can ASK
/// "have I been here?" by drawing a probe sprite on the R plane at any cell and reading VF. The
/// machine reads its own worldline THROUGH its own instruction set. (081KTZ4EF0008QG0R002WVTMMJ note: DRW now CLIPS
/// at edges, so a probe sprite at columns 57-63 loses its over-edge tail — probe within the court
/// or accept the narrowed read; the clip never wraps a probe onto cells it did not ask about.) Self-reflection in soft mode,
/// full ISA to the bone; the QEMU/microkernel rung gets the same trace surface at metal (named slice).
[<RequireQualifiedAccess>]
module Chip9SelfTrace =

    /// Map a code address to its trace cell on the 64×32 grid (instruction slots; total — wraps).
    let cellOf (addr: int) : int * int =
        let slot = ((max 0 (addr - Chip8.ProgramStart)) / 2) % (Chip8.DisplayW * Chip8.DisplayH)
        slot % Chip8.DisplayW, slot / Chip8.DisplayW

    // paint a plane bit directly into the frame's own plane storage (the HOST half of reflection —
    // the same cells DRW sees; mono Display = plane 1 (R), Extra bits 1-2 = G/B).
    let private paint (mask: byte) ((x, y): int * int) (f: Chip8Cow.Frame) : Chip8Cow.Frame =
        let idx = (y % Chip8.DisplayH) * Chip8.DisplayW + (x % Chip8.DisplayW)
        let f1 =
            if mask &&& 1uy <> 0uy then { f with Display = Map.add idx true f.Display } else f
        let hi = mask &&& 0b110uy
        if hi = 0uy then f1
        else
            let cur = Map.tryFind idx f1.Extra |> Option.defaultValue 0uy
            { f1 with Extra = Map.add idx (cur ||| hi) f1.Extra }

    /// The addresses a step at `f` READS beyond the opcode (the G channel's data flow).
    let private dataReads (f: Chip8Cow.Frame) : int list =
        let pc = int f.PC
        let op =
            (int (Map.tryFind pc f.Mem |> Option.defaultValue 0uy) <<< 8)
            ||| int (Map.tryFind (pc + 1) f.Mem |> Option.defaultValue 0uy)
        match op &&& 0xF000 with
        | 0xD000 -> [ for i in 0 .. (op &&& 0xF) - 1 -> int f.I + i ]
        | 0xF000 when op &&& 0xFF = 0x65 -> [ for i in 0 .. ((op &&& 0x0F00) >>> 8) -> int f.I + i ]
        | _ -> []

    /// One SELF-TRACING step: paint the about-to-execute PC on G, its data reads on CYAN, the speculated
    /// future on B (lookahead PCs) — THEN execute. The machine's worldline accumulates in its own
    /// plane memory as it runs.
    let traceStep (specDepth: int) (f: Chip8Cow.Frame) : Chip8Cow.Frame =
        // G: the executed path (this PC) — the program keeps mono for itself
        let f1 = paint 2uy (cellOf (int f.PC)) f
        // CYAN: the data flow of this step
        let f2 = dataReads f |> List.fold (fun acc a -> paint 6uy (cellOf a) acc) f1
        // B: the speculated future (where lookAhead would walk, fork-honest: stops at input branches)
        let rec spec n (s: Chip8Cow.Frame) (acc: Chip8Cow.Frame) =
            if n <= 0 || SoftChip8.branchesOnInput s then acc
            else
                let s' = Chip8Cow.step s
                spec (n - 1) s' (paint 4uy (cellOf (int s'.PC)) acc)
        let f3 = spec (max 0 specDepth) f2 f2
        Chip8Cow.step f3

    /// Run n self-tracing steps — the program ray-traces itself while running itself.
    let run (specDepth: int) (steps: int) (f: Chip8Cow.Frame) : Chip8Cow.Frame =
        List.fold (fun acc _ -> traceStep specDepth acc) f [ 1 .. max 0 steps ]

    /// THE DEEP VIEW — the SelfTrace × PixelLens composition (the last third of Amara's named proof):
    /// project the traced machine into 32-bit deep pixels so the trace's EPISTEMIC STATUS travels
    /// WITH each pixel. Color = the full plane mask; payload = the instruction slot this cell
    /// projects (the data riding with the pixel); uncertainty = 900 milli where the cell's ONLY
    /// claim is speculation (B set, G clear — the foreseen future), 0 where the claim is executed
    /// past or the program's own drawing. Then `PixelLens.colorize` is the honest projection:
    /// the DRAWN past survives, the FORESEEN future collapses — the display literally cannot
    /// present speculation as fact. (StrokeAnim's Foreseen=(4,900) convention, kept.)
    let deepView (f: Chip8Cow.Frame) : Map<int * int, PixelLens.Cell> =
        Map.ofList
            [ for y in 0 .. Chip8.DisplayH - 1 do
                  for x in 0 .. Chip8.DisplayW - 1 do
                      let mask = Chip8Cow.colorAt x y f
                      if mask <> 0uy then
                          let speculativeOnly = mask &&& 4uy <> 0uy && mask &&& 2uy = 0uy && mask &&& 1uy = 0uy // bit 0 honored (Kira r3: program-drawn + speculated used to read as pure speculation)
                          let u = if speculativeOnly then 900 else 0
                          yield (x, y), PixelLens.pack mask (y * Chip8.DisplayW + x) u ]
