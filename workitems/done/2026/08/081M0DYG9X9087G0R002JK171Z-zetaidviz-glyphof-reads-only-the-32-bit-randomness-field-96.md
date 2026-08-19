---
id: 081M0DYG9X9087G0R002JK171Z
type: bug
state: done
priority: P2
slug: zetaidviz-glyphof-reads-only-the-32-bit-randomness-field-96
title: "ZetaIdViz.glyphOf reads only the 32-bit Randomness field — 96 structured bits never reach the identicon"
created: 2026-08-19T21:23:14.473Z
completed: 2026-08-19T21:35:15.401Z
depends_on: []
composes_with: []
---

# ZetaIdViz.glyphOf reads only the 32-bit Randomness field — 96 structured bits never reach the identicon

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DYG9X9087G0R002JK171Z-*.md` glob. -->

**CONFIRMED (truncation), then CONFIRMED AGAIN (the first repair was linear).** Two defects, one
surface. The truncation was reported by Iris 2026-08-19 and fixed in #12533 while this review was
running; the second finding is against #12533 itself.

## Defect 1 — the truncation (fixed upstream in #12533, independently confirmed here)

`glyphOf` v1 built each of its 8 rows from `(id >>> row*4) &&& 0xF` — bits 0..31 of a 128-bit
ZetaId. Bits 0..31 are **exactly the `Randomness` field** (`BitLayout`: offset 0, width 32; written
by `ZetaIdCodec.pack`). The identicon drew the nonce and nothing else.

Measured against compiled `Zeta.Core`:

| experiment | v1 |
|---|---|
| 1000 ids differing **only** by timestamp | 1000 distinct ids -> **1 glyph** |
| 7 Category x 2 Persona x 3 Location, one timestamp | 42 -> **1 glyph** |
| 65 536 random-suffix ids | 0 collisions |
| 131 072 | 2, first at 77 994 |
| 262 144 | 10, first at 78 231 |

**The reported threshold is wrong by ~20% and it is worth correcting because it keeps being
quoted.** "Birthday collision at roughly 65 536" uses `sqrt(N)`, which is not the expected-first-
collision statistic. Expected first collision is `sqrt(pi*N/2) ~= 82 137`; the 50% point is
`~= 77 163`. Measured first collisions: 77 994 and 78 231 over two independent draws. At
n = 65 536, **zero** — P(>=1) there is 39.3%, not ~1. #12533's own docstring and its test comment
both repeat the 2^16 figure.

## Defect 2 — the repair XOR-ed four lanes, and XOR is linear (this work-item's contribution)

#12533 fixed it with `lane 0 ^^^ lane 32 ^^^ lane 64 ^^^ lane 96`. That removes the truncation and
does not remove the structure. XOR over GF(2) is **linear**: `a` and `b` collide iff
`fold(a XOR b) = 0`, so the colliding deltas form a 96-dimensional subspace — and because every
ZetaId field is a **contiguous bit-range**, that subspace is aligned with the field boundaries.
Any two bit positions exactly 32 apart cancel exactly.

Measured on the landed XOR fold, via `ZetaIdCodec.pack` with a fixed nonce:

- Two ids identical in **every** field but timestamp, `1 + 2^32` ms apart (49.7 days and one
  millisecond) -> **byte-identical glyph**. 16 of 16 tested deltas of the form `2^f | 2^(f+32)`
  collided. Not a sample: all of them.
- An **Observation** and an **Emission** — different `Category`, the field whose whole job is
  "WHAT KIND of thing this is" — -> **byte-identical glyph**, when the category delta was cancelled
  by one timestamp bit (global bit 97, inside the 48-bit Timestamp field).

These are constructible from the layout, field-aligned, and reachable by ordinary minting. No
birthday argument covers them; they are not the declared residual.

The stated reason for choosing XOR over a hash — *"a hash would need a fourth byte-lock"* — is
false on the facts. `hash.fmix64` is already a registered generator with an IR row in
`GeneratorIrRegistry` and an existing cross-oracle byte-lock at `tests/cross-verification/fmix64`.
There was no fourth lock to build.

Worse, #12533's test `the 32-bit bound is exact — a collision can be constructed on demand`
asserts `glyphOf a = glyphOf (a XOR (k<<<32) XOR (k<<<64))`. That is not the 32-bit bound; it is
the linear cancellation, pinned as a requirement. The test named for the pigeonhole would have
**blocked** the repair of the linearity. Replaced here with a search-based exhibition of the real
bound (first collision found at n = 91 570 on a fixed SplitMix64 stream — zero by 65 536).

## The fix

`foldTo32` now folds both 64-bit halves through MurmurHash3's `fmix64` (Appleby, public domain;
already byte-locked) to the 32-bit digest. Still O(1), still allocation-free (five shifts, two
multiplies, no array). `GlyphSpaceBits = 32` and the mirror-symmetric face are untouched — 32 bits
is a **ceiling**, not a fix target: 8 free nibbles, right half is the bit-reverse of the left.

`GeneratorRegistry` bumps `zetaid.glyph` 1 -> 2. #12533 changed the pixels and left the version at
1, which contradicts the registry's own contract (*"bumping a version = a new id (so a change is
never silent)"*) — for one commit a registered generator's content-address claimed output it no
longer produced. `zetaid.glyph@2` is added to the `generator-registry-id` cross-verify vectors; TS
and F# independently agree on `f42314cf4d9df1441cf5025a4509f484`.

## Blast radius (not inflated)

`glyphOf` / `toMediaLines` have **zero production call sites** — only `ZetaIdViz.Tests.fs`. No
golden vector, snapshot or `db/` row pins glyph pixels (`generator-registry-id` pins the registry
*id*, not the bytes). Latent, not live. **P1, not P0.**

## The 2026-08-14 survey erred, and the error is a class

`docs/research/2026-08-14-branch-free-visual-encoding-...md` cleared this twice (`:126`, `:196`) as
`ZetaIdViz.fs:45 | nibble -> glyph, bit-reversed | bijective, harmless`. Line 45 is the **inner**
nibble->byte bit-reversal and the survey is right about it: 16 nibbles -> 16 distinct bytes.

Line 45 is not the encoder. Line 41 was — `(id >>> row*4) &&& 0xF`, a 2^96-to-1 projection running
**before** the bijection. `bijective(g)` does not give `injective(g . f)` for lossy `f`; a bijection
applied after a projection is still a projection.

**The class: inner-map injectivity verified, composition injectivity asserted.** Same vacuity shape
as an assertion that cannot fail — the check ran, it just was not checking the thing the verdict
named. Any audit citing a `file:line` *inside* an encoder rather than the encoder's own
domain->range is exposed to it. The survey's own standard (*"total, injective from the data's
actual domain"*) is the right test and would have caught it; it was not applied, because the domain
examined was the nibble, not the id. Correction appended to that doc.

Register per `toy-is-free-metered-must-be-earned`: **metered** — every number above is measured
over compiled code, and three tests go red on the XOR fold and green on the avalanche fold
(verified by reverting `ZetaIdViz.fs` alone: 3 failed / 9 passed).
