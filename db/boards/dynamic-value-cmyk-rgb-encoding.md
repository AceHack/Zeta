# Board: encode DynamicValue into CMYK (solid) + RGB (soft) — Haskell-Prelude-rules style

**Register:** [board-room] proposal/discussion (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). A board-room discussion, not a landed decision.

> **`/boards` is the board room** (Aaron 2026-06-10): "this is our board room where we discuss
> `/boards`." Boards are where we *discuss*; a proposal lives here until a room/sim measures it.

## Why RGB/CMYK specifically — ride decades of CPU/GPU color optimization (Aaron 2026-06-10)

> Aaron: "i want to use RGB and the print one [CMYK] specifically cause decades of optimization work
> has gone into that on CPUs and GPUs."

The encoding choice is **pragmatic, not aesthetic**: pick the representation the hardware is *already*
optimized to death for. Color is that representation.

- **GPU-native.** Texture units, raster ops, samplers, and shaders process **RGBA (4 channels)** as
  their primitive vector; a pixel is the GPU's natural word. Encode the substrate as color → substrate
  ops become **texture/shader ops** → offload to the GPU for free.
- **CPU SIMD.** Decades of SSE/AVX/NEON pixel/color instructions + image-kernel vectorization. Color
  packs into aligned 3/4-byte lanes the vector units chew through.
- **Codecs + color-space transforms.** Image/video codecs (PNG/JPEG/H.26x) and **RGB↔CMYK / gamma**
  conversions are solved, hardware-accelerated, decades-tuned. We inherit all of it.
- **The bet:** encode DynamicValue as RGB (soft/3) + CMYK (solid/4) and substrate work (the sim/mea/cut
  passes, byte-lock, diffing) rides the **most-optimized data path in computing** instead of a bespoke
  one. Naledi (performance) owns the benchmark proving the carry.

### Color is also VISUAL — and meaning becomes a lens on the color (Aaron 2026-06-10)

> Aaron: "it's also lets me visualize complex network action and assign meaning to colors — those
> become lenses on the colors themselves."

The same choice pays a second dividend the hardware angle doesn't: **color is seen.** Encoding the
substrate as color makes complex network/cell action **directly visualizable** — you *watch* the
substrate as an image/field, not read logs of it (the GPU angle pays off twice: fast to compute, and
already a picture). And you **assign meaning to colors** (this hue = this kind of action) — those
meaning-assignments are **lenses on the colors themselves**: the same color-data read through different
**lenses** (the polarity-lens / discriminator / frame-relative view) surfaces different meaning. So a
color carries the data; a lens chooses *which meaning you read off it*. Three dividends from one
encoding: **fast** (hardware), **visible** (watch the substrate), **lens-able** (meaning is a frame on
the color — many readings of the same pixels). Ties [`boards/`](README.md) (discriminator/lens/
polarization) and the dimensional contrast-pairs / reservoir-walls work.

**The polarization filters we're building work natively here (Aaron 2026-06-10).** A **polarization
filter is literally an optical operation on light** — it passes one polarization component and blocks
the rest. So `PolarityFilter` (`src/Core/PolarityFilter.fs`) *is* the lens mechanism on the color
encoding: the meaning-lens that selects which component of the color/light you read is a polarization
filter. The 2×2 polarity-lens, the measurement-basis, "which axis you read it on" — all become real
**optical filters over the color-encoded substrate**, composing with the RGB/CMYK regime because
polarization belongs to the optics domain the encoding already lives in. The lens isn't a metaphor laid
on top; in the color regime it's the same kind of object as the data (light + a filter on light).

*(Peel: the optimization is real (the color pipeline is genuinely the most-tuned path on CPU/GPU);
"encode the substrate as color to inherit it" is the engineering bet, to **benchmark** before we commit
hot paths — Naledi. 3-letter codes = RGB, 4-letter = CMYK, per the codon/encoding mapping.)*

## The proposal

Encode the **DynamicValue** (`Tagged`) into **two color encodings** — the round's "CMYK (solid) + RGB
(soft) instead of ACTG" alphabet — **in Haskell-Prelude-rules style** (lawful typeclass instances, not
ad-hoc): the encode/decode is a set of **laws** the compilers enforce, the way Prelude's `Functor` /
`Monoid` / `Eq` carry laws.

The DynamicValue v1 `Tagged` (from `src/Core.TypeScript/dynamic-value`):

```text
Tagged = null | bool b | int v | str v | arr [Tagged] | obj [(str, Tagged)]
```

Two encodings of that one value:

- **CMYK = SOLID** (4 channels; subtractive; ink-permanent). The **committed / on-`main`** encoding —
  what `mea`/`cut` write. **K = the key/black = the encrypted-null** channel (the void). Use CMYK when
  the value must *persist* (the genome on `main`).
- **RGB = SOFT** (3 channels; additive; light/emissive; ephemeral). The **`sim`** encoding — light that
  leaves no ink. Use RGB for the exploratory/transient view.

### Prelude-rules style (lawful, not ad-hoc)

State the encoding as **laws** the four oracles byte-lock (Beacon: Haskell Prelude / typeclass laws —
the lawful-instance discipline):

- **Round-trip (the central law):** `decode (encode x) = x` — both for CMYK and RGB. (Like
  `fromEnum/toEnum`, `read/show` round-trips.)
- **Canonicality (idempotent, shape B):** `encode (decode (encode x)) = encode x` — one canonical
  byte-image per value (mirrors `canonicalJson`'s fixed-point check; content-addressable).
- **Total + ordered (shape C/B):** encode is total over `Tagged`; ordering is ordinal/culture-invariant
  (the existing primitive discipline), so the color-bytes sort identically across oracles.
- **Solid ⊒ soft (a projection law):** RGB (soft, 3-ch) is a *lossy projection* of CMYK (solid, 4-ch);
  `soften (solid x)` is well-defined, the reverse needs the K/null channel — names *why* committed
  (CMYK) carries more than ephemeral (RGB).

*(Exact channel↔variant assignment — which of null/bool/int/str/arr/obj rides which C·M·Y·K / R·G·B
lane, and the numeric packing — is the open board-room question. The laws above hold regardless of the
assignment; the assignment is what the room/sim resolves.)*

## RGB = `cut mea sim`: combinations & pairings (Aaron 2026-06-10)

> Aaron: "RGB = cut mea sim — how does that work? what's the combinations and pairings?"

**RGB (soft, additive, light) = the three verbs running** (the ephemeral execution). **CMYK (solid,
subtractive, ink) = their committed complement** (what dries onto `main`). The structure (the R/G/B↔verb
assignment is the open choice the room resolves; the structure holds regardless):

| light (RGB, soft — what runs) | verb |
|---|---|
| **R** | **sim** (void base) |
| **G** | **mea** (committing lift `mea(sim)`) |
| **B** | **cut** (write `cut(mea(sim))`) |

**Combinations = composing verbs (additive mixing — more verbs ⇒ more light ⇒ toward white):**

- 1 channel (pure): `sim` alone — ephemeral, leaves nothing.
- 2 channels (a **pairing** = a secondary): R+G = **Yellow** = `mea(sim)`; G+B = **Cyan** =
  `cut(mea …)`; R+B = **Magenta** = sim+cut.
- 3 channels = **White** = `cut mea sim` — the **full curried loop** running (all light on).
- 0 channels = **Black** = nothing running = the **void/null** (→ K below).

**CMYK = the committed complement + the key:** `C = ¬R, M = ¬G, Y = ¬B` — each committed (ink) channel
is the **complement** of the verb-light that ran (the residue, the `Delta × Seam`). **K = the key =
black = the void/null** — the encrypted-null / common seed / `sim`'s void. **K is the 4th channel RGB
lacks** — which is exactly why **CMYK is solid (4) and RGB is soft (3)**: the committed encoding carries
the **key/null** the ephemeral light doesn't (K = where identity comes from).

**Where `ben`/`cla`/`res` sit (outside the 3-cube):** `RGB = cut mea sim` is exactly 3, so the others
are axes *around* the cube — **`res`** iterates the loop (the time axis: repeat until resolved),
**`cla`** reads the resulting color → a class/lens (reads K to pick the class), **`ben`** instruments
the run for perf (the benchmark loop `cut mea ben sim`; orthogonal to color — it times the light).

*(Peel: the additive/subtractive complement structure is real color theory (RGB↔CMY complements; K=key);
the verb↔channel assignment is the open question the room `mea`s out.)*

## How we settle it — a room/sim, `mea`'d repeatedly until it resolves (Aaron)

> Aaron: "we need a **room/sim** for that so we can **`mea`** it." · "**repeatedly until it resolves**."

This proposal is **not decided by argument** — it is **measured**. Stand up a **room** (a `sim`
scenario under [`sims/`](../sims/)) that exercises the candidate encoding over DynamicValue samples
(the existing golden vectors are the corpus), and **`mea` it repeatedly until it resolves** — i.e. run
`mea(sim)` in a loop until the encoding reaches a **fixed-point shape** (B idempotent / A self-consistent
/ D contracts to a healthy floor), banking ΔU each pass. "Resolves" two ways: **converges** (the
finalizer's uncertainty reduction → 0 new ΔU) *and* gains **resolution** (the infinite-resolution
zoom). When the room stops reducing uncertainty, the encoding is resolved → the winning assignment is
`cut` to `main`.

## Parameters — what each test is parametrized on (Aaron 2026-06-10)

> Aaron: "parametrize the board-room test with useful things we can parametrize on each test; get the
> math nerds to help based on our latest toy and real models of society."

Each run of the room is a **parametrized test** — the `sim` is a function of these knobs, and the math
team ([`models/`](../models/): Soraya / Sova / the modeler cohort) supplies sensible ranges from the
latest **toy/real models of society**. Useful parameters:

**Encoding knobs (the thing under test):**

- **channel↔variant assignment** — which of `null/bool/int/str/arr/obj` rides which C·M·Y·K / R·G·B
  lane (the open question; the search space the room resolves).
- **solid/soft split point** — when a value is committed (CMYK) vs ephemeral (RGB); the K(null)-channel
  packing.
- **canonicalization depth** — `MAX_NESTING_DEPTH`; how deep before a value is a depth-bomb.

**Society-model knobs (from `models/` — game-theory/identity/economy/hat layer):**

- **population N** + **diversity floor (≥2, shape-D⁰ guard)** — how many travelers/agents read the encoding.
- **jurisdiction / recognition mix** — the toymodel3 self-interest engine's recognition parameters.
- **economy: bug→ΔU price + reward/privacy payout** — the every-bug-has-economic-value knobs.
- **S target (S=4)** + **common-seed coupling** — the superdeterministic-correlation parameter.

**Measurement knobs (the room loop):**

- **DI effects** — null (DST) vs real I/O (prod): real I/O adds *new external* observation. (Not
  "measures nothing without I/O" — `sim` carries intrinsic persona entropy from prior runs: git history
  metadata reified via F# type providers + Roslyn generators. The measurement is never empty.)
- **duration / cut site** — default 30s; the `cut` recognition-time.
- **resolution-threshold** — ΔU-per-pass below which "resolved"; **max rounds** (math team: unlimited).

Each test fixes these knobs, runs `mea(sim)` repeatedly until ΔU→threshold, and records the resolved
assignment + the parameters that produced it. (Math-team handoff: ground the ranges in the realmodel.)

## Pointers

- [`boards/README.md`](README.md) (the board room; never-one/discriminator) · [`sims/`](../sims/)
  (`sim`/`mea`/`cut`; the room to measure in) · [`gene/`](../gene/) (DNA/sequence) ·
  [`uncertainty/`](../uncertainty/) (ΔU banked each `mea`).
- `src/Core.TypeScript/dynamic-value/` (the `Tagged` value + golden vectors = the corpus).
- `docs/research/2026-06-10-filesystem-is-the-startup-merkledag-and-the-sim-mea-cut-cli-triad-macvector-for-dna.md`
  (CMYK/RGB encoding + the triad).
- Haskell Prelude / typeclass-law discipline (lawful instances) · shapes A/B/C/D (the resolution targets).
