---
id: 081M0DVFPSK087G0R002CRCV6G
type: task
state: backlog
priority: P2
slug: the-singlet-chsh-svg-draws-one-corner-but-ferry-25-claims-it
title: "The singlet-CHSH SVG draws one corner but ferry 25 claims it draws the S=2 vs 2sqrt2 gap, which needs all four"
created: 2026-08-19T20:30:29.171Z
depends_on: []
composes_with: []
---

# The singlet-CHSH SVG draws one corner but ferry 25 claims it draws the S=2 vs 2sqrt2 gap, which needs all four

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DVFPSK087G0R002CRCV6G-*.md` glob. -->

Surfaced while fixing 081M0DN8Y8R087G0R00101VSA2 (two catalogue entries rendering byte-identical
goldens). That fix is landed; **this is the part it did not discharge, and it is stated separately
rather than folded in, because "the pictures now differ" is a weaker claim than "the picture is the
falsifier ferry 25 says it is."**

## The claim on file

`docs/research/2026-06-12-ferry-25-entanglement-as-two-one-bit-adinkras-the-bell-verdict-and-the-repair-one-parity-adinkra-over-two-carriers.md:35`:

> **The falsifier is already rendered in this repo:** `db/shapes/golden/quantum-circuit-singlet-chsh.svg`
> — the CHSH circuit is in-tree precisely to draw the gap between Bertlmann's socks and the singlet.

## Why one corner cannot do that

The gap is `S = 2` (any local-hidden-variable / preassigned-bit model) versus `S = 2*sqrt(2)`
(Tsirelson, the singlet). `S` is a sum over **four** measurement settings:

```
S = E(a0,b0) + E(a0,b1) + E(a1,b0) - E(a1,b1)
```

A single corner `E(a_i, b_j)` has no bound to violate. It is one correlation value, and a
preassigned-bit model reproduces any single corner exactly — that is the whole reason Bell needed
the _combination_. So the current SVG draws a circuit that is **consistent with Bertlmann's socks**,
which is the opposite of drawing the gap.

This was invisible while the file drew `E(a0,b0)`, because that corner is _also_ just a coincidence
measurement, which is what made it collide with `quantum-circuit-bell-coincidence-singlet.svg` in
the first place. Fixing the collision (it now draws `E(a1,b1)`) made the picture honest about being
one corner; it did not make it a falsifier.

## Options

1. **Render all four corners** — four SVGs, or one composite. Then the picture carries the sum and
   ferry 25's sentence becomes true of it. Most faithful; adds catalogue entries.
2. **Render the four corners plus the two bounds** as a value plot rather than a circuit diagram.
   The gap is a _number_, and Cleveland-McGill rank 2 (length on a common baseline) is the metered
   channel for a number. A circuit diagram cannot depict `S` at all, so arguably no circuit SVG can
   ever discharge the claim.
3. **Downgrade the prose in ferry 25** to what the artifact actually shows — one corner of the
   configuration whose _combination_ is the falsifier — and point at
   `quantum-observable.test.ts:37` ("Singlet CHSH corners sum to Tsirelson bound"), which IS the
   executed falsifier and does compute `S`.

Option 3 is cheapest and may be the honest one: **the falsifier already exists and it is a test,
not a picture.** The claim that a rendered SVG is the falsifier looks like the "agreement by
construction" pattern the 2026-08-14 encoding doc names — an artifact credited with a discharge it
never performed.

## Done when

Either the artifact depicts the four-setting combination, or ferry 25's sentence names the test as
the falsifier and the SVG as an illustration of one corner. Not both left as they are.
