# Sub-pixel cells + lens overlays — and the CRT/FPGA corner stays open

Aaron 2026-06-11, two beats:

> "Lens overlays will allow shifting of this and revealing of **sub-pixel data** where applicable — I
> see lots of useful things, like **data storage in sub-pixel data**… **data and uncertainty can travel
> with the pixels** in a way our soft side can understand and predict with, and **colorize** too."
> / "Imagine the **CRT effects** and all the awesome shit emulators do — even the **FPGA ones** that
> are trying to emulate old hardware perfectly. **We don't want to paint ourselves out of that
> corner. I have FPGAs.**"

## 1. Sub-pixel cells — BUILT (`src/Core/PixelLens.fs`, 6/6 green)

The room was already there: the physics runs 65,536× finer than the display (Chip9Phys 16.16), so a
pixel's color is a PROJECTION of a deeper cell. Now addressable: a 32-bit cell = color (3 bits, what
the display shows) + payload (13 bits of data riding WITH the pixel) + uncertainty (16-bit milli).
Three LAWFUL lenses (get-put/put-get tested) focus the fields; `softRead` gives the SoftValue-shaped
(value, confidence); `colorize` renders uncertainty HONESTLY — an uncertain pixel visibly collapses
toward mono ("don't lean on me") instead of being silently painted; the overlay `shift` slides the
focus. The zero case holds: a mono consumer reads bits 0-2 and never sees the rest.

## 2. The CRT/FPGA corner — held open BY the same architecture

The constraint named: nothing in the pipeline may preclude (a) CRT-physics post-effects or (b)
cycle-accurate FPGA emulation. The audit says we're clean, and WHY:

- **`colorAt` is the canonical seam** — every renderer (ZetaMax ANSI, future shaders, a CRT filter, an
  FPGA pixel clock) binds at that one read. CRT effects are POST-GENERATORS over it (registry entries
  when built: `crt.scanline`, `crt.phosphor`, `crt.curvature`, `crt.ntsc` — each versioned/ZetaId'd
  like every generator).
- **The glow already IS phosphor physics** — BoundaryLight's exp(−d²/σ²) is the phosphor-bloom kernel;
  a CRT binding reuses the same generator with the electron-spot σ.
- **Sub-pixel cells map to CRT reality** — a real CRT pixel IS sub-structured (RGB phosphor triads,
  beam spot, persistence); our 32-bit cell is the honest digital cousin (and the uncertainty field can
  carry PERSISTENCE — phosphor decay as confidence decay: the soft side predicting what the beam left).
- **FPGA = the 081KTSZN10008QG0R000VZHRQ4 Verilog rung, already on the ladder** — and the fidelity bar is named by its
  champion: **MiSTer** (cycle-accurate FPGA re-implementation of old hardware). Our clock-free math +
  TimeGen generated time is FPGA-friendly BY construction (a pixel clock is just another clock
  generator; fix16 is synthesizable arithmetic; no floats on the hot path). Aaron HAS FPGAs — the
  bench's Verilog rung has hardware waiting like the 4090s do.
- **Spec-speed mode** (the constraints observation) is the same door: period-authentic pacing is a
  generator choice, so CRT-era timing quirks (raster chase, beam racing) remain expressible.

## Anchors (Beacon)

MiSTer / FPGA re-implementation lineage · CRT shader literature (Lottes' scanline shaders; RetroArch
filter chains) · phosphor persistence physics · Park identicons (the viz lineage) · Chip9Phys/TimeGen
(the in-house halves that keep the corner open).

## Pointers

- `src/Core/PixelLens.fs` + tests (the cell + lenses) · `BoundaryLight.glow` (the phosphor kernel) ·
  GeneratorRegistry (where crt.* land) · 081KTSZN10008QG0R000VZHRQ4 (the Verilog rung; hardware in hand) ·
  `universal/color.md` (capability honesty governs CRT bindings too).
