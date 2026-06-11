# Correction — the real build is RGB/CMYK ray-tracing of CHIP-8 instructions; DNA (ACTG) is a metaphor

Aaron 2026-06-11 (feedback, correcting my over-weighting of the ACTG framing):

> "This is metaphor. We are building **ray tracing of CHIP-8 instructions using RGB and CMYK**. DNA is a
> metaphor."

## The demotion (honest register)

The prior ferry doc
(`2026-06-11-ferry-grok-actg-chip8-digital-citizens-...`) recorded the ACTG ↔ {Autonomy, Crypto-identity,
Treaty, Goal} mapping and *peeled* it as a mnemonic — but it still let the four-letter biological frame
sit too close to the center. **This correction demotes it fully:** DNA/ACTG is a **metaphor only** — a
funny coincidence of initials, carrying *no* structure (no base-pairing, no transcription, nothing). It
is not a design surface. Aaron earlier: *"I'll stay on RGB/CMYK instead of ACTG"* — the color channels
are the real frame; ACTG was the joke.

The citizenship checklist (the VM must be able to decide / have identity / agree to terms / hold a goal)
**still stands** — but it stands on its own anchors (no-directives, SSI/Reticulum, Promise-Theory,
goal-directed agency), NOT on the DNA letters. Drop the letters; keep the checklist.

## The real build: ray tracing CHIP-8 instructions through RGB and CMYK

What we are actually building is a **renderer of CHIP-8 *instruction execution* as ray-traced color** —
the instructions are the scene; the trace is the light. Two complementary color models, deliberately
both:

- **RGB — additive** (emitted light, the screen): what a source **emits**. The natural channel for the
  *forward* trace — an instruction executing emits its effect.
- **CMYK — subtractive** (pigment/absorption, print): what a surface **absorbs / removes**. The natural
  channel for the *reverse* — retraction, the antiparticle leg (Z-set −1), what the cut *takes back*.

So additive/subtractive is not decoration: it is the **emit/retract duality** the substrate already runs
on (observe/emit primitives; Z-set retraction = antiparticle; reversible cut). RGB renders the forward
worldline; CMYK renders the retraction. This is the chronovisor's actual pixel: a CHIP-8 instruction's
execution **ray-traced** into a color that says *what it emitted and what it took back*.

### Where it connects (Mirror, plausible — needs Aaron's grounding on the exact channel semantics)

- **Feynman diagrams of distributed systems** (Aaron's root anchor): instructions are worldlines;
  ray-tracing them is literally drawing the diagram. Forward = particle/RGB-emit; retraction =
  antiparticle/CMYK-subtract.
- **The chronovisor / LLMTV** (Moonshot #1): "watch any room past/current/future" becomes literal once
  an instruction trace renders to color — you *see* the execution, channel by channel.
- **The light-cone / Markov boundary**: a ray is bounded by what the room can causally reach — the same
  tight boundary that makes the broadcast honest.

### Open (do NOT invent — grounding needed from Aaron)

- The exact channel assignment (which instruction classes map to which of R/G/B and C/M/Y/K, and what K
  carries) — I have the additive/subtractive ⇒ emit/retract intuition, not the precise table.
- Whether "ray tracing" here means literal geometric ray casting over a scene built from instructions, or
  the path-tracing-as-execution-trace reading. Both are coherent; Aaron's picture decides.

## Pointers

- `docs/research/2026-06-11-ferry-grok-actg-chip8-digital-citizens-...` — the ferry this corrects (ACTG now demoted to metaphor there too, via this doc).
- `user_aaron_feynman_is_the_root_anchor_...` (memory) — Feynman diagrams of distributed systems; retraction = antiparticle.
- Moonshot #1 (`...moonshot-1-reticulum-broadcast-dora-over-llmtv-the-chronovisor...`) — where the rendered trace is watched.
- Z-set retraction / reversible cut — the emit/retract duality RGB/CMYK renders.
