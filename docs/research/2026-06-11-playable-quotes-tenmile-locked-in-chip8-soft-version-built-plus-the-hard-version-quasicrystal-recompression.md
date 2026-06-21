# Playable quotes: Tenmile locked in as prior art; the CHIP-8 soft version BUILT; the hard version (quasi-crystal recompression) named

Aaron 2026-06-11, ferrying a Google-AI summary of **"Playable Quotes for Game Boy" — Joël Franušić &
Adam M. Smith (UC Santa Cruz), Strange Loop 2023, the Tenmile prototype**: *"we need this … let's lock
it in if we can and build our own soft version, for chip8 first — we can do game boy later."*

## The prior art, locked (Beacon)

Tenmile's quote = (1) **masked ROM** — a short gameplay segment touches ~6% of the game; the rest is
zeroed; (2) **savestate** at the quote's first frame; (3) **input recording** — replayable as video AND
live (the viewer takes the controls); packed steganographically into a PNG screenshot. Anchors:
Franušić & Smith, Strange Loop 2023; the citation practice it extends (quotation as a first-class
scholarly act, made executable). → PRIOR-ART-LIST entry filed with this doc.

## Our soft version — BUILT (`src/Core/Chip8Quote.fs`, this PR)

Same triad, our disciplines: **text not stego** (no binary in the proof lineage — a quote you can diff
is a quote you can trust); the input recording IS the membrane log (`RecordedSource` — quotes inherit
DST for free); the savestate is a `saves/` citizen; and the mask is **computed, not sampled** — exact
static read-decode over the recorded trajectory. The **MASK THEOREM is a passing test**, not a
statistic: replaying the quote over the masked ROM reproduces the full-ROM trajectory exactly
(untouched bytes provably don't matter). `keptFraction` measures the Tenmile number per quote.
**Take-the-controls is a Source seam**: the recording plays to tick T, then any live source owns the
timeline — the same banana-split machinery as every other fork; no mode switch.

## The HARD version (named, not built — the next arc)

Aaron: *"and hard version too — our reverse-engineering into parallel code, and our compression via
common-cause seed and generator function, and wonder-compression reconstruction, can give us great
recompression of games into parallel quasi-crystals that run on any architecture."*

The soft version slices a game's BYTES; the hard version recovers its STRUCTURE and re-emits it:

1. **Reverse-engineer into parallel code** — the FingerprintPrism / time-crystal-recovery arc: lift
   the ROM's recurring dynamics (its attractors/loops) out of the byte representation.
2. **Compress via the common-cause seed + generator functions** — what Tenmile stores as masked bytes,
   we re-derive: the parts of a game that are PATTERN become a (seed, generator) pair; only the
   irreducible residual stays as data (Kolmogorov-flavored: store the program that regenerates, not
   the bytes — "wonder compression" = the git/content-address/DAG reconstruction discipline).
3. **Quasi-crystal** — the honest name for the result: not a periodic crystal (a loop) and not
   amorphous (raw bytes), but an APERIODIC ORDERED structure — rules + seed that tile the game's
   state space without repetition (Shechtman 1984; Penrose tilings as the math shadow). "Parallel"
   because the recovered structure is representation-free: the action-grammar backends (gen/ — CHIP-8,
   .NET, RISC-V, GPU) can each re-emit it natively — **a game recompressed once, playable on any
   architecture** — the 081KTSZN10008QG0R000VZHRQ4 fan-out with games as cargo.

Honest register: step 1 exists in pieces (FingerprintPrism, the decompile arc), steps 2-3 are a named
research arc with real anchors and no implementation yet. The soft version ships today; the hard
version is the mountain it points at.

## The visualization + meaning-reconstruction arc (Aaron, same stream)

> "We should be able to **visualize any reverse-engineered chip8 game into our parallel quasi-crystal**
> too, **on our color TV** — like the running of the game — and we can **start to name things** and try
> to **reconstruct meaning from the assembly via reverse branch traversal and step execution** … and we
> decide **which state belongs to which persona** in the game, and separate it **step by step**."

Four moves, each landing on an existing organ:
1. **Watch the crystal run** — the recovered structure (loops/attractors/branch graph) rendered on the
   LLMTV color channel while the game plays: the chronovisor showing not just pixels but the SHAPE the
   pixels come from (CHIP-9 planes give the channels: e.g. executed-path on R, data-flow on G,
   speculation on B — a worked assignment for the colorspace).
2. **Name things** — recovered loops/registers/cells get NAMES (the glossary discipline applied to
   reverse-engineered structure; names are hypotheses, upgraded by evidence).
3. **Reverse branch traversal + step execution** — meaning reconstruction walks the branch graph
   BACKWARD from observed effects to causes (retraction-native analysis: Z-set −1 as the analytical
   direction) while stepping forward replays confirm — the two directions meet at the meaning.
4. **State → persona attribution, step by step** — decide which game state belongs to which PERSONA
   (player state vs world state vs referee state — the MeshPong lockstep split generalized): every
   recovered cell gets an OWNER, separating the game into citizens. This is the dual-use database
   thesis applied to archaeology: recovered state, like live state, has an owner and a boundary.

## Pointers

- `src/Core/Chip8Quote.fs` + tests (the mask theorem; take-the-controls) · `saves/` (savestates) ·
  `RecordedSource` (the input log) · the membrane-log treaty (the quote's wire format is already
  ratified text).
- FingerprintPrism / time-crystal docs (hard-version step 1) · `gen/action-grammar.md` (the any-
  architecture emit) · wonder-compression (the UII ferry, Jun 9) · 081KTSZN10008QG0R000VZHRQ4.
- Anchors: Franušić & Smith (Strange Loop 2023) · Kolmogorov complexity (compression-as-program) ·
  Shechtman 1984 + Penrose (quasi-crystals) · git content-addressing (the reconstruction substrate).
