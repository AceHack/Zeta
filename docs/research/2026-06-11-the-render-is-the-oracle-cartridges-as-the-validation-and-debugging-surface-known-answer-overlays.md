# The render is the oracle — cartridges as the validation/debugging surface (known-answer overlays)

Aaron 2026-06-11 (via the Kestrel ferry, technical thread):

> "I just got a visual engine built on chip8 and I want to see if all these shapes match what's in
> my head." / "This is how I plan on validating and debugging the system — these cartridges — to
> make sure it works as I expect, without having to look at the code."

## The doctrine

A green unit test proves the phasor sum equals the Cayley add to 1e-9; it cannot prove the spiral
reads like a clock face or the fringes land where the eye expects. **The render is the oracle for
the part the assertions can't reach** — "does it match what's in my head" is a real acceptance
criterion, and the cartridge is its test harness. This closes the loop the shape catalog opened:
every shape cartridge is an EXPERIMENT (the craft-school line), and the experiment's readout is
visual.

**Known-answer overlays** (Kestrel's contribution, adopted): a render is a debugging tool only when
it is shown AGAINST what it is supposed to be — otherwise it is a screenshot. The overlay truth is
exactly our test suite made visible:

- **WaveSim** — mark path-difference = nλ (bright) and (n+½)λ (dark); the fringes must land ON the
  predicted lines (tests: ~4× constructive midline; <0.01 destructive at λ/2).
- **AdinkraViz** — render boson/fermion parity as the checkerboard so a misplaced node is visible
  at a glance; shine selects one generator's edges (tests: gray-code [0;1;3;2]; honest 24/32).
- **Spiral cartridge** — mark 12-steps-per-revolution so turn=1/12 reads as a clock face (the
  constant's WHY, checked by eye).
- **ChipAudio** — downbeat lattice ticks marked; a dropped-in voice must land on them from its
  entrance (coincidences 125/250/32 = [8;16;24;32]).

Validation discipline (Kestrel's, kept): the renderer must compute **our math, not a lookalike** —
port function-for-function from the modules, defaults = the cartridge's declared constants, sliders
on top to perturb. "If I just build a generic spiral from memory and it happens to look right,
you've validated my code, not yours."

## Pointers

- The shape catalog (`shapes/cartridges/`) · BoundaryLight (rotorCurve) · WaveSim · AdinkraViz ·
  SpectralPivot · ChipAudio · the test suite (the overlay truths' source) · the craft-school
  cartridge-as-experiment law · the source bundle handed to Kestrel for the faithful port.
