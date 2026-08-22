---
id: 081M0DNCXZK087G0R003DEY5KF
type: bug
state: backlog
priority: P2
slug: zetaid-identicon-glyph-carries-only-the-low-32-bits-of-a-128
title: "ZetaId identicon glyph carries only the low 32 bits of a 128-bit id: birthday collision at ~65536 ids on an identity surface"
created: 2026-08-19T18:44:06.771Z
depends_on: []
composes_with: []
---

# ZetaId identicon glyph carries only the low 32 bits of a 128-bit id: birthday collision at ~65536 ids on an identity surface

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DNCXZK087G0R003DEY5KF-*.md` glob. -->

Reported in `docs/design/2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md` §9. **Layer-3 encoder injectivity**, not layer-4 perception — it
belongs to the discipline in
`docs/research/2026-08-14-branch-free-visual-encoding-is-the-meaning-junction-lie-factor-injectivity-and-what-the-eye-can-check.md`
and is filed from the confusability audit because the surface is an **identity carrier**.

## The defect

`src/Core/ZetaIdViz.fs:37-47`:

```fsharp
let glyphOf (id: System.UInt128) : byte[] =
    [| for row in 0..7 ->
           let nibble = byte ((id >>> (row * 4)) &&& ...0xFUL) &&& 0xFuy
           ...
           (nibble <<< 4) ||| rev |]
```

`row` runs `0..7` and the shift is `row * 4`, so the glyph is derived from **bits 0-31 of a 128-bit
ZetaId**. The right half of each row is the bit-reverse of the left, so the 64-pixel picture carries
**32 bits**. `glyphOf` **discards 96 bits**.

The header at `:9` describes it as _"the id IS the picture."_ For 2^96 ids per picture, it is not.

## Why the existing survey reads clean

The 2026-08-14 survey lists `ZetaIdViz.fs:45` as _"bijective, harmless"_. That verdict is **correct
about the map it examined** — nibble -> glyph row, bit-reversed, genuinely bijective — and does not
extend to `glyphOf : UInt128 -> byte[8]`, which is the map the surface exposes. Worth recording as a
general lesson: injectivity of an inner step does not compose to injectivity of the pipeline, and a
survey row naming the inner step can read as a clearance for the outer one.

## Cost

Birthday bound: collisions become likely at **~2^16 = 65,536 ids**. Reachable, not theoretical. An
identicon is used precisely to let a human recognise an identity at a glance, so a collision here is
a **spoofing surface** rather than a usability wrinkle — two different ZetaIds that a reader will
confidently read as the same one.

## Options (not decided here)

- Fold all 128 bits into the 32 glyph bits (e.g. XOR the four 32-bit lanes) — keeps the picture size,
  removes the _truncation_, does not remove the pigeonhole. Collisions become unpredictable rather
  than "shares a suffix", which is strictly better for an identity surface but is still 32 bits.
- Widen the glyph (more rows/columns, or drop the mirror symmetry, which currently costs half the
  pixels for zero information).
- Keep 32 bits and **declare the bound at the definition site**, so no caller treats the picture as
  an identity. Cheapest, and honest.

## Done when

`glyphOf`'s information content is either widened or **declared at the call site and in the header**,
so nothing reads the picture as the id.
