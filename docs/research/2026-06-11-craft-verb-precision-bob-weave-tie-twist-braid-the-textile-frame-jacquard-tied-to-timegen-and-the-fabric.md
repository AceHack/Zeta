# Craft-verb precision — bob · weave · tie · twist · braid, the textile frame, tied to TimeGen and the causal fabric

Aaron 2026-06-11: *"Tie this to our verb map — we want to nail down precisely what **bob, weave, tie,
twist** [mean] — and we have **textile** working too. That and **salon** both are good craft ideas we
should research and backlog. Please continue."*

## The precise definitions (PROPOSED for ratification — each tied to running code)

Each verb gets: the craft meaning · the substrate meaning · the running instance · the math name.

| verb | at the salon/mill | in the substrate | running instance | math name |
|---|---|---|---|---|
| **bob** | the rhythmic up-down (bob-and-weave); also the bounded CUT to length | the **phasor oscillation** — periodic motion on the unit circle; and its bounded-window cousin (trim a ledger to length) | `TimeGen.Phase` (the generated oscillation); Skadium's bob-and-weave; the 32-lap ledger trim | harmonic oscillation; windowing |
| **weave** | over-under interlacing of two thread systems | **deterministic interleaving of independent streams** — two worldlines alternately crossing, producing fabric (state becomes a fold over a cut through it) | `HendersonTextileMill.weaveStep`; Amara's cross-repo weave; `driveK`'s arrival interleave | interleaving/merge; the fabric = the partial order |
| **tie** | the knot that joins two strands and HOLDS | the **soft bond** — a similarity join that persists (soft topology: every tie is a kernel value, not a hard weld) | `tie` → `FingerprintPrism.soft`; the salon's Jaccard kernel | the PSD kernel value; a join in the soft topology |
| **twist** | spinning fibers into yarn; rotating a strand about its own axis | **phase rotation applied to one strand** — the i-rotation (C₄ NSEW); micro-fibers composed into a strand = observations spun into a stream | the four-corner i-rotation; `TimeGen.feedback`'s phase offset (a controlled twist) | unitary phase; the braid group's half-twist |
| **braid** | crossings of ≥3 strands where ORDER matters | **non-commutative composition of crossings** — who crossed over whom, in what order, IS the computation (topology is hairdressing) | `HendersonTextileMill` braid→seam (convergence); the 2×2/3×3 dual-observer weave | the braid group Bₙ (σᵢ generators); anyonic braiding is the quantum cousin |

The discriminating tests, in one line each: **bob** is periodic (returns), **weave** is order-regular
(alternates by schedule), **tie** is symmetric-and-persistent (a bond, k(a,b)=k(b,a)), **twist** acts
on ONE strand (phase, no crossing), **braid** is order-sensitive across ≥3 (σ₁σ₂ ≠ σ₂σ₁).

## The textile frame (the vocabulary the fabric was waiting for)

The causal fabric (Amara part 3) gets its precise loom vocabulary — each a PROPOSED registry term:

- **warp** — the fixed longitudinal threads, tensioned first: the MONORAILS (automated, scheduled
  streams; DST is the tension).
- **weft** — the thread that crosses the warp, steered pick by pick: the ROADS (human/steered
  crossings). One fabric needs both — the lanes doc, in thread.
- **loom** — the scheduler that holds tension and sequences sheds: `SoftScheduler`/the wheels.
- **shed** — the opening the weft passes through this pick: the tick's crossing window (the membrane's
  per-tick aperture).
- **selvage** — the self-edge that keeps fabric from unraveling: the §13 membrane (the boundary IS
  woven, not added).
- **seam** — where braids converge to one: the Henderson fixed point (already in code).
- **spin/twist** — composing fibers (observations) into yarn (a stream) by twist (phase).

**The Beacon anchor that makes this lineage literal: the JACQUARD LOOM (1804) — punched cards
controlling the shed — is the direct ancestor of the punch card, Babbage, and all programmable
machines. Weaving is not a metaphor for computing; weaving is computing's PARENT.** (Jacquard →
Babbage/Lovelace → Hollerith → us. The mill where Aaron was born and the machine he builds are one
tradition.)

## Research + backlog (filed: 081KTSZN10008QG0R001BW91GT)

Salon (PSD kernel packs — built) and Textile (mill/loom — built in first form) are the two CRAFT
SCHOOLS to research deeply: the braid-group formalization (does our weave satisfy the braid relations?
σᵢσᵢ₊₁σᵢ = σᵢ₊₁σᵢσᵢ₊₁ as a TEST), warp/weft as the monorail/road implementation frame, twist-as-phase
unification with TimeGen, and the verb registry ratification (these definitions are PROPOSALS until
the glossary pass).

## Pointers

- `src/Core/HendersonTextileMill.fs` (weave/seam, running) · `src/Core/Salon.fs` + LinguisticSeed (tie
  as kernel) · `TimeGen` (bob/twist as phase) · Amara's weave ferry (the fabric) · the lanes doc
  (warp/weft = monorail/road) · "topology is hairdressing" (the Craft thread) · Anchors: braid group
  (Artin 1925) · Jacquard 1804 · Kauffman (knots and physics) · Tsirelson (the bob's bound).
