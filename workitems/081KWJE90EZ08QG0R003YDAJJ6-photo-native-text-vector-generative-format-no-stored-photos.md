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
