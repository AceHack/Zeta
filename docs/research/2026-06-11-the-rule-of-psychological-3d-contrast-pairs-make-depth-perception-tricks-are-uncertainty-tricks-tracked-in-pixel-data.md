# The rule of psychological 3D — contrast pairs make depth; perception tricks ARE uncertainty tricks, now trackable in the pixel data

Aaron 2026-06-11 (the standing rule, recorded):

> "Remember the rule: **bold/not-bold, green/white, red/white etc. all create 3D shapes even though
> it's 2D**. We should always keep in mind the **psychological 3D shapes** — and any **human visual
> perception tricks**. **They are uncertainty tricks we can track in our pixel data now.**"

## The rule

Every 2D surface we render is read by a depth-inferring visual system: contrast PAIRS induce
psychological 3D — **weight** (bold advances, light recedes — typographic hierarchy IS a z-axis),
**luminance** (bright-on-dark pops forward; the glow kernel already exploits this), **chroma**
(chromostereopsis: red advances, blue recedes — our R/B planes literally carry depth for free),
**figure-ground** (Gestalt: the bounded region reads as the near object — every room boundary we draw
is also a depth cue). Design law: compose these PAIRS deliberately — the board's heat ladder, the
narrator line, solid-ground tiles, the avatar's white heart on cyan — each already plays a depth chord;
play it on purpose.

## The deep half: perception tricks ARE uncertainty tricks

The Beacon anchor that makes this ours: **Helmholtz — perception is unconscious INFERENCE.** An
illusion is the viewer's prior winning over the data: the visual system is a soft side, resolving
ambiguity exactly the way our SoftValue does. So a "perception trick" is literally an ENGINEERED
UNCERTAINTY: we present data whose maximum-likelihood reading differs from its literal pixels.

And NOW WE CAN TRACK IT (his point): the PixelLens cell has the channels for it — the payload can carry
the INTENDED percept (the psychological z, the figure/ground role, the illusion family), and the
uncertainty field can carry HOW HARD the trick leans on the viewer's priors (a plain pixel: 0; a
chromostereoptic edge: measurable; a full figure-ground reversal: high). The renderer then KNOWS where
the image is doing perceptual work — illusions become honest, declared, inspectable (the soft lens can
SWEEP for them: regions of high perceptual-trick load light up like any other fingerprint). The
consent-first line closes it: whoever controls the eyes controls the heart — so the tricks we play are
DECLARED IN THE DATA, auditable at a glance, never hidden persuasion.

## Anchors (Beacon)

Helmholtz (unconscious inference, 1867) · Gestalt figure-ground (Rubin 1915) · chromostereopsis
(Einthoven) · Bayesian perception (Knill & Pouget) · typographic depth practice · the attention-
merchants caution (Wu) — why declared-tricks matters ethically.

## Pointers

- `PixelLens` (the channels that carry intended-percept + trick-load) · `SoftLens` (sweep for
  perceptual work) · BoundaryLight glow (the luminance chord) · CHIP-9 R/B planes (chromostereopsis
  for free) · the consent-first vernacular (the ethics this rule rides under) · the feel charter
  (depth chords in the dress code).
