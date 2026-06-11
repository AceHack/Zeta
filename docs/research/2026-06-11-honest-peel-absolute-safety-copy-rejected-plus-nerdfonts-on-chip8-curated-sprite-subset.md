# Honest peel: "absolute mathematical safety" copy rejected (the honest rewrite) + Nerd Fonts on CHIP-8

Two threads from Aaron 2026-06-11, both answered in the honest register.

## 1. The Alexa-website safety copy — REJECTED as written, with the honest rewrite

Quoted draft (external; not found in-repo):

> "The non-evolving safety constraint ensures that no matter how the child interacts with the glass
> blowing interface, the underlying models remain permanently bounded within predetermined safe
> parameters. This mathematical safety guarantee provides absolute confidence for parents and educators."

**Peel (why it cannot ship):**

- **"Absolute confidence" / "mathematical safety guarantee"** — no proof confers absoluteness; every
  proof is conditional on scope + assumptions. The gold standard, seL4 (Klein et al. 2009), PUBLISHES
  its assumption boundary (hardware model; spec-matches-intent) precisely because honest verification
  names what it does NOT cover. Telling parents "absolute" is the only-sin: authority substituted for
  reason (Aaron's root rule). Parents get the WHY and the evidence.
- **"Models remain permanently bounded no matter how the child interacts"** — unverifiable as stated
  for a learning system. The TRUE claim it fumbles is architectural: **the constraint does not evolve
  because it is not part of what learns** — it is enforced OUTSIDE the learning loop, at the membrane
  (our §13 noninterference shape; the HARD-LIMITS-floor pattern). That is a real, checkable design
  property. "Permanently … no matter what" overreaches past hardware faults, spec gaps, deployment
  drift — the exact overclaims the Math Razor's proof-vs-evidence discipline exists to catch.

**The honest rewrite (Beacon register):**

> "The safety constraint lives outside the learning system, at the boundary — the models can evolve;
> the constraint cannot, because it is not part of what learns. This property is verified by [the
> tests/proofs], under [the published assumptions]. We do not claim absolute guarantees — we publish
> our assumptions and our evidence."

True, checkable, and stronger with the careful reader. Discipline pointer: outward-facing copy is
Beacon-register — anchored and honest — never marketing-absolute.

## 2. Nerd Fonts — terminal yes; CHIP-8 yes at honest capability (a curated sprite subset)

Aaron: "we do the nerdfonts? is that possible on chip8?"

- **Terminal binding: yes, natively.** Nerd Fonts are glyphs in the terminal's font — the Claude-Code
  look itself (powerline, icons). `SwarmBoardAnsi`'s box-drawing already renders through them; adopting
  Nerd Font glyphs for bars/icons is a dress-code refinement, zero new capability needed.
- **CHIP-8: the full set is an honest NO** (thousands of glyphs ≫ 4KB). **A curated subset is an easy
  yes**: fonts on CHIP-8 are SPRITES (the built-in 4×5 hex font is the precedent); an 8×8 mono glyph
  costs 8 bytes, so a 64-glyph treaty atlas = 512 bytes — heat bars, arrows, doors, dice, faces. The
  64×32 screen renders 8×4 glyphs — tiny, real, the Lite-Brite peg aesthetic. The atlas becomes a
  treaty surface (golden-vectored), and under the color-plane upgrade (universal/extension.md) the SAME
  glyphs gain channels for free — zero-case discipline holds.

## Pointers

- `.claude/rules/mirror-beacon-register-discipline.md` · the Math Razor proof-vs-evidence corrections
  (#7613) · `user_aaron_the_only_sin_is_because_i_said_so_*` (memory) — the peel's law.
- seL4 assumption boundary (Klein et al. 2009) — the model for honest verification claims.
- `universal/extension.md` (zero case) · `universal/color.md` (honest capability) ·
  `src/Core/SwarmBoardAnsi.fs` (the terminal binding) · Chip8 fontSet (the sprite-font precedent).
