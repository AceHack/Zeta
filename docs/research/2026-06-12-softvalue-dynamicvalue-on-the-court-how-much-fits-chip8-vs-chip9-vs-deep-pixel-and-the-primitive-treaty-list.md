# SoftValue / DynamicValue on the court — how much fits CHIP-8 vs CHIP-9 vs deep pixel; the primitive treaty list

Aaron 2026-06-12: "is it possible to visualize DynamicValue and SoftValue, and how much of that
can make it inside chip8? chip9 I assume more, with capability upgrades. Also the primitive list
— ours, our wish list, and dotnet and cross-language primitives in treaty."

## SoftValue on the court (the ladder, honest at every rung)

SoftValue = (value, confidence). The display ladder:

| rung | channel budget | what a SoftValue looks like | honest limit |
|---|---|---|---|
| **CHIP-8 (mono)** | 1 bit/cell | the VALUE only — lit or unlit; confidence has NO channel | the zero case: a mono consumer sees the value and nothing else (it cannot even know it is missing confidence — which is why mono consumers must never be fed soft claims as hard) |
| **CHIP-9 (3 planes)** | 3 bits/cell | value on one plane, confidence QUANTIZED to the remaining levels (bright = sure, dim/mono = unsure — PixelLens.colorize is exactly this projection) | 8 levels total; confidence gets at most 2 bits — a sketch, honestly coarse |
| **Deep pixel (PixelLens 32-bit)** | 3+13+16 bits | the FULL SoftValue per cell: color (3) + payload (13) + uncertainty (16, milli) — `softRead` returns (value, confidence) directly | the substrate rung: this IS a SoftValue field; CHIP-9 is its display projection |

So: SoftValue does not "fit inside" CHIP-8 — its VALUE does (the zero case, structural); the
confidence needs the first capability upgrade (CHIP-9 planes, coarse) and lives fully one rung
deeper (the deep pixel, which the planes project). The capability ladder IS the visualization
answer: each upgrade buys channels, and what you cannot carry you must not claim.

## DynamicValue on the court

DynamicValue is a typed TREE (scalars/lists/maps), not a field — so its court form is not pixels
but STRUCTURE: the treemap (LayoutEngine slice-and-dice — tiles the boundary exactly, value =
area), the index-format glyphs, and MediaLines itself (a DynamicValue serialization with kinds).
Named slice: `shape-dynamicvalue` — a small tree drawn as a treemap with constants stating the
tree, in-file law = areas sum exactly to the court (integer tiling, provable). SoftValue ENTERS
DynamicValue as the deep-pixel payload does: any node may carry (value, confidence) — rendered as
brightness over the tile (the same colorize law, lifted from pixels to tiles).

## Animation (landed this PR)

Every cartridge's HTML now DRAWS ITSELF tick by tick — pure CSS (stroke-dashoffset keyframes,
per-stroke integer delays in document order = the generator's order), zero JavaScript (the
HtmlCssBinding law holds; the no-script test still passes on all 13). Semantically-dashed strokes
(the sign register) fade in instead — the two meanings never fight over one attribute. Hover
brightens a stroke (JS-free interactivity); prefers-reduced-motion is honored (consent-first at
the CSS layer — the traveler's motion preference is a boundary). The SVG golden stays the STATIC
truth; animation is the HTML projection's layer.

## The primitive treaty list (where it lives, what's missing)

- **The ledger:** `docs/PRIMITIVE-REGISTRY.md` — the standing source of truth for which
  primitives exist in which oracle languages and their golden-vector status. This doc does not
  duplicate it (DV2: one hub).
- **Already cross-language in-tree** (by the src/ layout): DynamicValue (C#/Rust/TS), TriBoolean
  (C#/F#/Rust/TS), ZetaId, Sha256/Blake3, Merkle, RangeSet, Metric, Clock, Resume, Observe,
  FourCorner (Rust), SoftValue (Rust), CHIP-9 (all four — the ratified treaty).
- **The wish list (treaty-pending, from this stream):** SoftValue to all four (Rust-only today —
  the deep-pixel ladder above needs it everywhere); MediaLines parsers (TS/C#/Rust — the named
  slice; the cartridges are the database default atom); ShapeRender conformance (the SVG goldens
  are the treaty surface, first-run byte-lock); CartridgeLaw evaluator (a screen of code per
  language, by design); TimeGen (structure-level treaty; float kernels stay outside the
  byte-lock); Braid (exact integers — byte-lockable as-is); the chip9 cartridge LOADER (.lines
  into the machine — the homoiconic close).
- Process: each wish-list row enters via the backlog start gate; goldens locked by F# first, the
  other oracles conform first-run (the standing discipline).

## Pointers

- PixelLens (softRead/colorize — the ladder's middle rungs) · LayoutEngine (the DynamicValue
  court form) · ShapeRender.toHtml (the animation layer) · docs/PRIMITIVE-REGISTRY.md (the ledger)
- Named slices: shape-dynamicvalue (treemap, integer-tiling law) · shape-softvalue (the ladder
  drawn: one value at three rungs) · MediaLines + ShapeRender oracle ports
