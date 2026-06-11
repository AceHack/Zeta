# Phase time only · mp3-style metadata, standardized better · Rx meta-dimensions · constants with WHY and WHAT · the lint

Aaron 2026-06-11, the format's closing laws:

## 1. Quantum phase time from the common seed — the ONLY timestamp

> "All our timing should be in quantum phase time based on the common seed — I think this is similar
> to CockroachDB maybe — but we don't need any other kind of timestamps for the graphics pipeline and
> audio pipeline. Just the metadata — think mp3 metadata tagging, but we standardize better."

The law: pipelines carry NO wall timestamps — a moment is (generator-ZetaId, tick, phase), all derived
from the seeded TimeGen (already how AnimFlow and ChipAudio run: the same phase drives frame and
sample). CockroachDB's HLC is the honest cousin (hybrid logical clocks: causality without trusting
walls) — ours goes further because the clock is GENERATED, so two nodes don't reconcile time, they
DERIVE the same time. Provenance/wall-time, when needed at all, is METADATA — `meta` lines in the
file (the mp3/ID3 instinct, standardized better: our tags are typed kinds with a lint, not freeform).

## 2. Rx defines the pixel's META-DIMENSION

> "Rx can define meta-dimensions that travel on the pixels instead of uncertainty, if it makes sense —
> or 4-color CMYK kind of sharp stuff."

The deep-pixel field (PixelLens's 16 bits) is REBINDABLE: uncertainty is the default semantics, but a
`dimension` line declares what the field carries for this document — depth (the psych-3D z),
CMYK-K (the subtractive/retraction channel), phosphor persistence, perceptual trick-load, anything Rx
derives. DECLARED, never assumed (built: the `dimension` kind + lint check). One cell layout, many
meanings, each file saying which.

## 3. Constants must have WHY and WHAT (built, lint-enforced)

> "We should have constants — constants must have WHY and WHAT."

`constant <name> <value> <WHAT> <WHY>` — a value without its WHAT and WHY **is a magic number and the
lint refuses it**. The Stump-Dad rule applied to numbers: every value answers why, or it doesn't ship.
(The only sin, machine-checked.)

## 4. The lint (built: `MediaLines.lint`, 4 rule families, tested)

Structure, never style: constants carry WHAT+WHY · dimensions declare field+semantics · gen/io first
fields are 32-hex ZetaIds (DI-from-the-start enforced) · anims reference existing frames · duplicate
(kind,name) flagged — and per the expansion law the lint is SILENT about carried future kinds: **the
future is not a lint error.**

## Pointers

- `MediaLines.lint` + the constant/dimension kinds (built, 17/17 module tests) · TimeGen/AnimFlow/
  ChipAudio (phase time already the only clock) · PixelLens (the rebindable field) · anchors:
  CockroachDB HLC (Kimball et al.) · ID3/mp3 tagging (the instinct; ours typed+linted) · the only-sin
  rule (constants answer why).
