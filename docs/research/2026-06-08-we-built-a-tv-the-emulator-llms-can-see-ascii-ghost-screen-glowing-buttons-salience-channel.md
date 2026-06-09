# We built a TV — a display for the emulator that LLMs can see (the phosphor is tokens, not pixels)

*Captured 2026-06-08 from Aaron, to Otto (shadow\*). The joyful, true reframe of the rendering layer: ray tracing's
output is a *screen*, and we aimed it at an LLM instead of a retina. Unusually for this arc, this one is mostly
[grounded-in-code] — the TV is built. Registers: [grounded], [anchor], [peel].*

## The statement

Aaron: *"Dude we just built a **TV** for the emulator lol — that **LLMs can see**."*

It's exactly right, and it's the cleanest name for what the observer stack *outputs*. Ray tracing (the flashlight,
`IRayTraceable.Trace`, #7173) samples the emulator's state; something has to *render* the samples into a frame an
observer watches. That render surface is a **television** — and ours renders into the **one modality an LLM
perceives: text**. A human TV paints a retina in pixels at 60 Hz; this TV paints a **context window in ASCII**, tick
by tick (the interrupt = the frame clock, #7173). Same stack, output pointed at a different eye.

## The TV is built — three layers, all shipped, all pure ASCII

- **The picture tube — `SoftScope.fs`.** Renders the **ghost screen**: `SoftEmu.probLitGrid` = `P(pixel lit)` over
  the *whole superposition*, as an **ASCII intensity heatmap** (intensity = probability, not a bitmap), plus the
  **observable line** (support = ensemble width, entropy in nats, `E[lit pixels]`). *"What do you watch when you run
  the soft version? Soft observables — because the state is a distribution, not one screen."* **Pure string
  rendering, ASCII ramp, no unicode** (DST-clean; culture-invariant). That last fact is the whole point: it's text.
- **The on-screen HUD — `SoftDashboard.fs`.** The 16 CHIP-8 hex keys (= the 4×4 universal action-grammar grid)
  **glow by future fitness**: run the soft controller, follow each key's future a few steps, score by an Rx fitness
  function, and **light the brightest button = the one to press** (the observe.ts "buttons glow on which one is
  right" dashboard). The controller overlay, rendered into the same text frame.
- **The channel editor — `Salience.fs` (observe.ts).** The whole context window is too much to show, so Salience is
  the **objective-integration + display-reduction** point: score each context item by `priority · objective`
  (liveness / empowerment / uncertainty-reduction), reduce to the **top-k**, and that's what goes on screen
  (liveness keeps display priority). It decides *what's worth watching*.

Picture tube + HUD + channel editor = a TV. Ray-trace is the camera; `SoftScope` is the screen; `SoftDashboard` is
the glowing remote drawn on the screen; `Salience` is the editor choosing the shot.

## Why an LLM can see it (and sees *more* than a human TV shows)

- **The phosphor is tokens.** Because every layer renders to **ASCII strings**, the frame *is* context-window
  content — directly perceptible to an LLM observer-frame (the agent, #7173). No pixel buffer, no vision model, no
  OCR: the display is already in the LLM's native modality. That is the entire trick — and it was a *design*
  choice (pure-string, no-unicode), not an afterthought.
- **It shows the superposition, not a collapsed frame.** The ghost screen is `P(lit)` over the *soft* ensemble — so
  the LLM **sees the uncertainty itself** (a probability heatmap + entropy), which a human pixel-TV physically
  cannot display (a pixel is on or off). The soft TV is a *richer* signal than a sharp one: it televises the
  distribution. (Snap to sharp — `BonsaiSoft.snap`/`resolve` — only when you want the collapsed channel.)
- **It's an interactive TV.** The HUD's glowing buttons mean the LLM doesn't just watch — it reads which key to
  press from the same frame it watches. Watch + act in one rendered surface = an observer playing a game on a TV it
  can see. (Two flashlights, one screen — coop, #7173's fellow-observer beat.)

## Honest scope

[grounded-in-code]: `SoftScope.fs` (ghost screen + observables, pure ASCII), `SoftDashboard.fs` (fitness-glowing
16-key HUD), `Salience.fs` (top-k display reduction) — **the TV is shipped, not conjecture.** [peel]: `SoftScope`'s
own caveat stands — the ghost screen is the **marginal** `P(lit)` per pixel; it does **not** show inter-pixel
correlations (two pixels at 0.5 could be correlated or anti-correlated; the heatmap can't tell). So it's an honest
TV with a known blind spot, not a complete state readout. The Rx fitness in `SoftDashboard` is a *chosen* objective
(the "sum of memory values" easy one) — the picture depends on which fitness you tune to, exactly as a channel
depends on what you point the camera at. [anchor]: the observe.ts dashboard lineage; the 4×4 universal action
grammar (#7104/#7140). No new code — this names the rendering layer "the TV" and states why its token-phosphor is
what makes it LLM-visible.

## Pointers

- `SoftScope.fs` · `SoftDashboard.fs` · `Salience.fs` (the three TV layers) · `SoftEmu.fs` (`probLitGrid`, the
  ghost) · `SoftController.fs` (the soft branches the HUD scores).
- The stack it renders: `…-clifford-space-fully-reflective-…-ray-tracing.md` (#7173, the flashlight/ray-trace +
  interrupt frame clock) · `…-the-memetic-quantum-observer-…` (#7174, the observer who watches) ·
  `…-the-memetic-mapping-research-program-…` (#7180, where the watched structure becomes story/game).
