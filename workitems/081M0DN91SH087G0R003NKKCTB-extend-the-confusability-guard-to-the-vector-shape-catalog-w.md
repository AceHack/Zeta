---
id: 081M0DN91SH087G0R003NKKCTB
type: task
state: backlog
priority: P2
slug: extend-the-confusability-guard-to-the-vector-shape-catalog-w
title: "Extend the confusability guard to the vector shape catalog with a low-pass occupancy skeleton"
created: 2026-08-19T18:41:59.601Z
depends_on: []
composes_with: []
---

# Extend the confusability guard to the vector shape catalog with a low-pass occupancy skeleton

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DN91SH087G0R003NKKCTB-*.md` glob. -->

Analysis: `docs/design/2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md` §12 item 3.

## What exists

`audit-visual-confusability.ts` TIER 0 catches only **byte-identical** catalog entries. That is the
degenerate case. Two shapes that differ in a few coordinates and read identically at a glance are
invisible to it.

## What to build

A low-pass occupancy skeleton — the designer's squint test, made mechanical, and the direct
generalisation of the UTS #39 skeleton to vector marks:

1. Parse the golden SVG. **21 of the 23 goldens are pure `<polyline>`** (`grep -o '<[a-z]*'` over
   `db/shapes/golden/`), so an exact rasteriser is ~50 lines and needs no dependency. The two
   exceptions are the quantum-circuit family (`line`/`rect`/`circle`/`ellipse`/`text`).
2. Normalise to the `viewBox`, rasterise strokes into an N x N occupancy grid (N ~ 16-32 — the
   choice IS the quotient and must be declared, like the two quotients in `visual-skeleton.ts`).
3. Collide on grid equality; report near-misses by Jaccard above a **declared** threshold.

Must obey the same discipline as the existing tiers: an unparseable shape is reported **UNAUDITED**,
never passed, and the check must be demonstrated firing on a control in both directions.

## Pairs to examine first (from element-count structure, not yet rasterised)

- **`braid` / `plait-move`** — highest prior probability. They share literal strand coordinates
  (`strand-0` is byte-identical between the two files); one is a braid move applied to the other, so
  the similarity is _intentional_ and therefore exactly the case where a reader is most likely to
  carry the wrong one forward.
- `spiral` / `worldline` — one polyline each.
- `crossing` / `dynamicvalue` — three polylines each.
- `shadow-loop` / `fourcorner` — two polylines each.

## Note on scope

This is layer-4 (perception) for the vector catalog. It does **not** subsume
`src/Core/ShapeAcceptance.fs`, which checks whether a shape's geometry satisfies its known-answer
law — a different and stronger question, asked per shape. This asks whether two shapes are
_distinguishable from each other_, which no existing check asks.
