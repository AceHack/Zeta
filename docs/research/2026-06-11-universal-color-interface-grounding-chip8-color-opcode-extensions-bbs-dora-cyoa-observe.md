# Universal color interface — Aaron's grounding: CHIP-8 color opcode extensions, BBS-style DORA, the CYOA observe.ts

Aaron 2026-06-11, four signals streamed in sequence (the renderer's grounding I asked for):

> 1. "I want our **universal color interface** to support the **universal TV interface** — not just
>    ASCII art in greyscale but **graph-like nodes of society and self with animated color** in chip8.
>    If chip8 has no color then **not yet** — we want to **push the boundaries of each system and the
>    visuals at the same time**."
> 2. "**chip8 becomes our universal lens**"
> 3. "**until we upgrade**"
> 4. "We can also have **chip8 op code extensions where we add color and stay compatible with the
>    original** if that's possible. I want my **DORA metrics on chip8 to feel BBS style pre-internet —
>    like claude code, that's the feel**.
>    https://www.youtube.com/playlist?list=PL7nj3G6Jpv2G6Gp6NvN1kUtQuW8QshBWE for **observe.ts — the
>    choose-your-own-adventure I'm going for**."

## What this resolves (the renderer's two open questions, now grounded)

The correction doc left two things open. Aaron's answer reframes both:

- **Not a channel-table assignment** of opcode families to R/G/B — the color interface is the **TV's
  pixel contract** (what nodes of society/self emit and retract), and CHIP-8 *binds* to it at whatever
  color capability it honestly has.
- **Not literal ray-casting vs path-tracing as an either/or** — the rendered object is the **graph of
  society and self** (rooms as nodes), animated over ticks. The RGB=emit / CMYK=retract duality stays
  (it's what the colors MEAN); the scene is the social graph.

## The four design decisions

### 1. Honest capability — "if chip8 has no color then not yet"

The interface NEVER fakes a channel. CHIP-8 today is `Mono1` (64×32, 1-bit): it renders the TV in
monochrome — honestly — **until we upgrade**. Pushing the system's boundary and the visuals together is
the point: the *display* grows capability in step with the *VM*, never ahead of it.

### 2. The upgrade: color opcode extensions, original-compatible — "if that's possible"

**It is possible, with strong prior art:** XO-CHIP (John Earnest, 2014, the Octo assembler ecosystem)
extended CHIP-8 with **bit-plane color** — `plane n` selects drawing planes ⇒ 2 planes = 4 colors —
using opcodes in unused encoding space (`F002`, `5XY2`/`5XY3`, …), and **every original CHIP-8 ROM runs
unchanged** (plane 1 is the default; mono behavior is the degenerate case). Super-CHIP did the same for
resolution. So OUR extension follows the proven shape:

- new opcodes only in unused encoding space (original ROMs never hit them);
- mono = the default plane (compatibility is the zero case, not a mode);
- each added plane doubles the palette (1 plane = 2 colors, 2 = 4, 3 = 8 — RGB-per-plane is the natural
  reading: plane≈channel, which puts the universal color interface IN the VM's own opcode space);
- the COW frame already carries `Display: Map<int,bool>` — planes generalize it to `Map<int,byte>`
  (a bitmask per pixel) without touching mono semantics.

This is the "until we upgrade" path made concrete — and it keeps the byte-lock discipline: plane
opcodes get golden vectors like any other treaty surface.

### 3. The DORA board feel: BBS, pre-internet, Claude-Code-like

The DORA metrics surface on CHIP-8/terminal should feel like a **pre-internet BBS** — CP437 box
drawing, ANSI 16-color, door-game energy; "like claude code, that's the feel." This is an aesthetic
**choice, not a limitation**: the terminal binding declares ANSI-16/256 as its capability and STAYS
there on purpose. (Anchors: BBS door games — TradeWars 2002, Legend of the Red Dragon; CP437/ANSI art
scene; the modern TUI lineage that Claude Code itself sits in.)

### 4. observe.ts: the choose-your-own-adventure

The web/observe.ts surface is the **CYOA** — Aaron's reference playlist (preserved):
`https://www.youtube.com/playlist?list=PL7nj3G6Jpv2G6Gp6NvN1kUtQuW8QshBWE`. The TV is not passive:
watching a room comes with CHOICES (which future branch to follow, which door to take) — the
chronovisor's future channel (`conferenceOnFork`) is literally a branch menu. (Anchors: CYOA books —
Packard/Montgomery, Bantam 1979+; interactive fiction / Twine; the FF7 debug-room door list as menu.)

## "chip8 becomes our universal lens"

The lens framing locks in: CHIP-8 is the **focus everything renders through** — the smallest universal
display/compute element. A room, a metric, a society graph: render it to the CHIP-8 surface (at honest
capability) and you have the universal minimum viewing instrument; upgrade the VM's opcodes and EVERY
surface gains color at once. That is `lens/` + `universal/color.md` composed: the lens is the
addressable focus, the color interface is its pixel contract, the TV is the broadcast of it.

## Pointers

- `universal/color.md` — the carved interface (Emit/Absorb/Capability/Animate; bindings table).
- `docs/research/2026-06-11-correction-the-real-build-is-rgb-cmyk-ray-tracing-...md` — RGB=emit/CMYK=retract.
- Moonshot #1 (`...moonshot-1-reticulum-broadcast-dora-over-llmtv-the-chronovisor...`) — the TV itself.
- `lens/README.md` — the lens this completes; `src/Core/SoftChip8Flux.fs` conferenceOnFork — the CYOA branch menu.
- Prior art: XO-CHIP / Octo (John Earnest) · Super-CHIP (Erik Bryntse) · CP437/ANSI BBS scene · CYOA (Packard/Montgomery).
