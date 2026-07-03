---
id: 081KWJE90EZ08QG0R003YDAJJ6
type: task
state: backlog
priority: P2
slug: photo-native-text-vector-generative-format-no-stored-photos
title: "Photo -> native text/vector generative format (no stored photos): capture compiles to a program that redraws itself — target: renderable as a chip9 cart (upgraded res/processing; runs itself, draws itself, predicts itself; hosts incl. CSS)"
created: 2026-07-02T22:13:03.071Z
depends_on: []
composes_with: ["081KTH5N5ZJ08QG0R002JDT704"]
---

# Photo -> native text/vector generative format (no stored photos): capture compiles to a program that redraws itself — target: renderable as a chip9 cart (upgraded res/processing; runs itself, draws itself, predicts itself; hosts incl. CSS)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWJE90EZ08QG0R003YDAJJ6-*.md` glob. -->

## Origin

> **Aaron 2026-07-02 (Cowork, during the inventory git-pivot):** "one thing we really need is some
> photo -> native text vector format... we don't want to have photos, really. In a perfect world this
> would be renderable as a chip9 cart with upgraded resolution and processing — chip9 can run itself
> and draw itself and predict itself, and run in CSS and quantum physics lol."

## The idea

Store NO raster photos in the substrate. A capture (paper inventory sheet, whiteboard, hardware
photo) is **compiled into a text-native generative representation** — a program/vector form that
REDRAWS the content on demand. The stored artifact is diffable, mergeable, byte-lockable TEXT
(no-binary-in-proof-lineage applies to captures too); the pixels are a render, never the source
of truth. End-state target: the representation IS a **chip9 cartridge** — the capture becomes a
small program a chip9 host executes to draw (and predict) itself, with CSS as one host among many.

## Why chip9 carts — the load-bearing rationale (Aaron 2026-07-02, follow-up)

> "chip9 carts as the capture format isn't a joke. It's so we can **exhaustively,
> superdeterministically search memory space like Cheat Engine**."

The cart target is not aesthetics — it is **searchability**. A capture stored as a chip9 cart is a
program in a TINY, fully deterministic VM: bounded memory, bounded instruction set, seeded execution
(DST). That makes the space of captures a **memory space you can scan the way Cheat Engine scans
RAM** — exhaustive enumeration, find-what-writes/antecedent tracing, conditional triggers, diffing
two carts as diffing two runs — the `hooks/README.md` Cheat-Engine-method common ground applied to
CONTENT, not just the .NET runtime. Superdeterminism is what makes the search COMPLETE: every cart
replays identically from its seed, so a scan over cart-space misses nothing and every hit is
reproducible. A photo stored as pixels is opaque to this; a photo stored as a cart is queryable
program-matter. (Composes: DST §7 · noninterference §13 (all entropy via the seed) ·
only-the-irreducible-is-primitive (gen(gen)==gen — regenerating IS verifying) · the R4
observation-log-as-generator residual split.)

## Status — layer-4 first slice landed (Otto 2026-07-03, cowork)

`src/Core.TypeScript/chip9-cart/` — the cart END of the pipeline, working: `compile` takes a
hex color grid (0-7, the 3-plane gamut) and emits a **self-verifying chip9 cartridge** — a
straight-line blit program the treaty VM executes to redraw the capture exactly. The cart is
TEXT (hex-in-JSON shape; no-binary-in-proof-lineage) and carries its own golden render;
`verify` re-executes the ROM and byte-compares — **regenerating IS the check** (gen(gen)==gen).
6 tests: round-trip byte-lock (every pixel), worst-case seeded-random 64x32 full grid fits the
NNN ceiling, content-proportional size (empty tiles emit nothing; sparse cart <10% of dense),
tamper-detection both directions (ROM flip and golden-row flip caught), determinism, honest
bounds. Demo: `bun src/Core.TypeScript/chip9-cart/run-demo.ts`.

Honest peels: (a) v1's generator is the DEGENERATE one — a blit list, the identity generator;
it redraws itself but does not predict itself. 081KTH5N5ZJ is the upgrade that replaces blits
with smaller real generators. (b) For tiny dense images the program overhead loses to raw
pixels (47-byte cart vs 21-byte raw for the 8x7 demo glyph); content-proportionality wins on
sparse/structured captures, which is what paper sheets are. (c) The photo->grid front end
(layers 1-3) is untouched by this slice; input is already-digitized grid text.

## Layered scope (razored)

1. **Semantic layer (already real, $0):** vision-model transcription photo -> structured text
   (the inventory paper register -> `inventory/items/` files). Ship first; no new machinery.
2. **Vector layer:** photo -> SVG-class vector text (trace + segment). Deterministic, diffable;
   good for diagrams/labels/layout, not photoreal.
3. **Generative layer (the real item):** capture -> PROGRAM that regenerates it — the
   compile-to-generator compressor (081KTH5N5ZJ08QG0R002JDT704) applied to images; store generator + seed,
   render on demand; residual (what the generator can't predict) stored as bounded text per
   R4's compressible-generator + Bayesian-surprise-residual framing.
4. **chip9 cart target:** the generator emits as a chip9 cartridge (gen/ already emits CHIP-8
   asm from pure interfaces); "upgraded resolution and processing" = the chip9 extension surface;
   self-running/self-drawing/self-predicting = the generator-as-ECC property (gen(gen)==gen).

## Anchors (Beacon, to check not just cite)

Potrace (Selinger 2003) raster->vector tracing · SVG (W3C) · program synthesis from images
(Ellis et al., DreamCoder 2021; graphics-program induction) · implicit neural representations
(SIREN, Sitzmann et al. 2020) as generative-not-stored images · Kolmogorov complexity /
MDL (the stored thing = shortest program that redraws) · demoscene procedural carts (the
existence proof that KB-scale programs draw rich scenes) · GAN inversion (image -> latent code)
as the learned variant.

## Honest seams

- Photoreal fidelity vs text-size tradeoff is REAL: bound the residual budget, don't promise
  lossless photoreal in KB.
- "Quantum physics host" is Mirror-register color, not a deliverable; the deliverable hosts are
  chip9/CSS/SVG renderers.
- GAN/learned encoders introduce weights (weight-free tension) — prefer the program-synthesis /
  procedural route first; learned only as an adapter behind a port.
- Near-term inventory need is served by layer 1 alone; layers 2-4 are the research arc.
