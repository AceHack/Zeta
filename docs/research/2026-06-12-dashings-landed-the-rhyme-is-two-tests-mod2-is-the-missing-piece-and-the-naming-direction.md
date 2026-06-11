# Dashings landed (the rhyme is two tests) · mod2 is the missing piece · the naming direction

Three of Aaron's beats, 2026-06-12, built same-stream.

## The dashings (Gates' condition + the gauge lemma, in code)

`AdinkraViz` now carries the retraction register: a `Dashing` is the set of dashed (−1) edges on
the N=4 hypercube; `standardDashing` is the Clifford sign rule (dash (v,i) iff odd bits below i);
**THE GATES CONDITION** (`allFacesOdd`) — every 2-colored 4-cycle carries an odd number of dashes
(γiγj = −γjγi, drawn) — and **THE GAUGE LEMMA** (`flipVertex` invariance): local sign flips change
the dashing, never the parity. The braid cartridge and this module now point at each other
(`edge same-twist viz.adinkra`): no local move removes the twist — the same sentence as THE STUCK
LAW, with the break stated in both places (their edges are involutions; our generators remember).

## "Are they inverse in some way?" — no: a QUOTIENT

The precise relation: adinkra parity is braid memory **mod 2**. Z (crossing order, Artin) → Z/2
(the dashing bit, Gates): order forgotten, parity kept. A projection, not an inverse — the lens
that completes the flow is the map that forgets exactly the register the sink cannot hear.

## The GraphEdit lens — THE MISSING PIECE, working

`MagneticPorts.Piece` + `findAdapter`: when two ports don't speak the same type, search the
toolbox for the adapter whose in-face matches the source and out-face matches the sink. First
real adapter: **algebra.mod2** (registered, cost-declared) — braid-memory out → mod2 → adinkra
parity in. The test proves the GraphEdit feel: direct connection repels honestly; with the piece
the chain snaps; an empty toolbox reports the gap (named, never force-fit).

## The naming direction (Aaron's call, recorded)

Algebras named RIGHT (Beacon): braid group B₃ / pure braid P₃ (Artin), Brunnian link (Brunn),
Borromean rings, Clifford algebra (the dashing's home). Memory naming in MICROSOFT's register:
majorana-memory — "we are also testing with their Q#, should be a close match" (the Vera brief is
the verification road). Leading shape name unchanged: BORROMEAN BRAID; still provisional in-file.

## Pointers

- `src/Core/AdinkraViz.fs` (Dashing/standardDashing/allFacesOdd/flipVertex) ·
  `src/Core/MagneticPorts.fs` (Piece/findAdapter) · `shapes/cartridges/braid.lines` (same-twist
  edge; naming meta) · `GeneratorRegistry` (algebra.braid-memory / z2-parity / mod2)
- Treaty-lint refinement: `treaty` lines may repeat per oracle (re-ratification is a log, not a dupe)
