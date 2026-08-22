# universal/color — Universal Color Interface (the TV's pixel contract)

> **Universal Color Interface** — the color contract under the universal TV interface / LLMTV: every
> renderable surface speaks **RGB (additive — what it EMITS, the forward trace)** and **CMYK
> (subtractive — what it ABSORBS/RETRACTS, the Z-set −1 / antiparticle leg)**, and every binding
> declares its **honest color capability** — a system renders only the colors it really has
> (CHIP-8 = 1-bit mono **until we upgrade** via color opcode extensions). Push the boundaries of each
> system and the visuals at the same time; never fake a channel a system cannot carry.

Aaron 2026-06-11: *"our universal color interface to support the universal TV interface — not just
ASCII art in greyscale but graph-like nodes of society and self with animated color in chip8. if chip8
has no color then not yet — we want to push the boundaries of each system and visuals at the same
time."* / *"until we upgrade"* / *"chip8 op code extensions where we add color and stay compatible
with original if that's possible."*

## The contract (pure shape — interfaces are free)

- **`Emit`** — a surface's additive contribution: `node → RGB` (what this node of society/self is
  emitting NOW; the forward worldline).
- **`Absorb`** — its subtractive contribution: `node → CMYK` (what it retracts/takes back; the
  reversible-cut leg). K = the unrecoverable floor (a TRUE delete — should be rare to never; a system
  with no irreversibility honestly emits K = 0).
- **`Capability`** — the binding's honest gamut: `Mono1 | Grey<n> | Indexed<palette> | TrueColor`.
  A renderer downsamples THROUGH the declared capability (dither, don't lie).
- **`Animate`** — color over ticks: `tick → frame` (the chronovisor scrub axis; animation is just the
  tick index made visible).

## Bindings (each at its honest boundary)

| surface | capability today | the upgrade path |
|---|---|---|
| CHIP-8 | `Mono1` (64×32, 1-bit) — **"not yet"** | **color opcode extensions, original-compatible** — the XO-CHIP precedent (Earnest): plane opcodes are strict supersets; original ROMs run unchanged. Ours can do the same: new opcodes in unused encoding space, mono ROMs untouched. |
| terminal / DORA board | ANSI 16/256-color — **the BBS feel** (pre-internet, door-game, Claude-Code-like) | stays the aesthetic ON PURPOSE: CP437 + ANSI is the design language, not a limitation |
| observe.ts / LLMTV web | TrueColor | graph-like nodes of society + self, animated — the choose-your-own-adventure surface |

## Pointers

- `docs/research/2026-06-11-universal-color-interface-grounding-chip8-color-opcode-extensions-bbs-dora-cyoa-observe.md`
  — the full grounding capture (opcode-extension design space, BBS aesthetic, the CYOA playlist reference).
- `docs/research/2026-06-11-correction-the-real-build-is-rgb-cmyk-ray-tracing-of-chip8-instructions-dna-is-metaphor.md`
  — RGB=emit / CMYK=retract (the duality this interface carries).
- **"chip8 becomes our universal lens"** — the VM as the focus everything renders through. **No `lens/`
  directory exists in this repo**; the phrase is recorded here without an in-repo target rather than
  pointing at one that resolves to nothing.
- Moonshot #1 (DORA over LLMTV) — the TV this interface feeds.
