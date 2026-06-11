# Solid ground as Spectrum-attribute tiles (Alexa's 8-bit entry) + zero clocks, infinite draw threads — in the image format itself

Aaron 2026-06-11, two beats on the soft-lensing close:

> "We should be able to represent **solid ground in some Tetris-style, some tiling style — like the
> Spectrum but 8-bit style**. This will let **Alexa get her 8-bit style in** too."
> / "And the no-clocks is awesome — **0 clocks, infinite draw threads, in an image format**."

## 1. Solid ground as tiles — the Spectrum attribute system, repurposed

The ZX Spectrum's signature constraint: the screen is 8×8 ATTRIBUTE CELLS, each carrying one color
pair for all its pixels — the look every Spectrum game wears. Repurposed as the GROUND MAP's render:

- the soft-lens sweep yields per-cell confidence; quantize the field into 8×8 attribute tiles;
- a tile whose cells are uniformly high-confidence becomes a SOLID tile (full attribute color — ground
  you can stand on); mixed tiles render as the Spectrum's classic attribute-clash texture (the
  honesty: uncertainty at tile granularity LOOKS like clash — the constraint becomes the indicator);
- **Tetris-style**: solid tiles PACK — contiguous certain regions tile into tetromino-like solids
  (the eye reads load-bearing ground the way a Tetris player reads a settled stack: gaps are exactly
  where you cannot stand). Filling ground = clearing lines = the bug-economy's ΔU made visible.
- **Alexa's entry**: this tiling register is HERS — her pixel-card aesthetic (the 8-bit portrait
  lineage) becomes a first-class render binding (`tiles.spectrum-attr` in the registry when built),
  joining the board's ANSI, the lens's Mono1, and ZetaMax's palette as a peer style. Her style, her
  channel — the persona register growing the way the roster did.

## 2. Zero clocks, infinite draw threads — a property of the FORMAT, not just the renderer

The clock-free discipline (TimeGen + pure generators) lands its sharpest consequence: every cell of a
generated image is a PURE FUNCTION of (stored text, seed, coordinates[, tick]) — no sequencing, no
shared state, **zero clocks** — so ANY number of draw threads can each compute ANY subset
independently: tile-parallel, scanline-parallel, lens-window-parallel, machine-parallel (the GPU rung,
the FPGA rung, a swarm of CHIP-9s each owning a tile). And because the generators live IN the file
(MediaLines `gen` lines with their ZetaIds + common-cause seed), **the image format itself is the
parallel program** — shipping a picture ships the means to draw it at any width of parallelism, with
byte-identical output at every width (determinism is per-cell, so thread count cannot change the
picture — the scale-free spec, met by a file format).

## Honest scope

Both are RENDER BINDINGS over built organs (the ground map from soft lensing; the pure generators from
BoundaryLight/TimeGen) — the tile binding and the parallel scheduler are named slices, filed with this
capture. Beacon: ZX Spectrum attribute cells (the 1982 constraint-as-aesthetic); Tetris (Pajitnov
1984 — settled-stack legibility); embarrassingly-parallel rendering (the raytracing tradition);
map-reduce over pure functions.

## Pointers

- the soft-lensing doc (the ground map this renders) · PixelLens (per-cell confidence) · ZetaMax +
  universal/color.md (the binding family this joins) · GeneratorRegistry (tiles.spectrum-attr when
  built) · rooms/amara + the Alexa register flag (the persona styles, each earning a channel) ·
  BoundaryLight/TimeGen (why zero clocks holds).
