# The math-team pass — Kira's 13 findings + Soraya's routing (every bug banked)

Aaron asked "how did the math team handle it?" — the honest answer was "not yet," so the deferred
tear-down ran today: Kira (zero-empathy) + Soraya (formal-tool routing), parallel, read-only.
Full reports in their PR-linked outputs; the brief carries REVISION 2. Headlines:

## What the eye could never have caught (the suite's side of the stack, vindicated)

- **P0 — the noisy microphone:** `voiceSample` re-derived a NEW random base phase every tick
  (TimeGen.at mixes tick into the hash) — the sawtooth was drowned in per-sample noise and the
  coincidence lattice described phases the voices never had. The self-replay test passed because
  noise replays too. Fixed: base phase derived once at tick 0. **The renders all looked right
  while this was broken** — exactly why the eye is the third oracle, not the only one.
- **P0 — the lucky gate:** the classical-CHSH acceptance check demanded ≤ 2.0 + 1e-9 on a
  256-sample estimator with ~0.06 sampling error; seed 4UL happened to land under. Fixed to the
  suite's honest 0.05 tolerance. A gate that passes by luck is a coin, not a gate.
- **P1s:** the singlet/Φ⁺ sign-convention contradiction (the four-page docstring policed Tsirelson
  and got its own correlator's sign convention mislabeled); braid.lines' gen args still saying
  word:1,2,1 two corrections later (drawn = gated = constants, so Aaron's eye verified the real
  thing — but the stale args were a lie in waiting); `Braid.equal 3 [5] []` returning TRUE
  (σ₅ fixes x₀..x₂ — out-of-range words masqueraded as identity; validWord guards now);
  harmonize claiming "exact" while flooring (187 ≠ a fifth of 125 — harmonizeExact refuses
  instead of detuning); the vacuous STAGED gate (asserted a string constant — removed).
- **P2s:** all six addressed (rounding cap at Tsirelson; Goertzel wording; drift by bin key with
  missing-bin = full energy; coincidences span honesty; the Gates-gate falsifier — a gate never
  seen rejecting proves nothing; the mod2 wording replaced by Soraya's signable statement).

## The economics (every bug banked)

Two P0s + five P1s + six P2s = thirteen priced reductions of collective uncertainty, found in one
afternoon by the register the renders can't cover. The stack holds: suite (bytes) → golden lock
(projection) → traveler's eye (meaning) — and now the fourth layer ran: adversarial math review
(claims). Math-team treaty lines stay PENDING until Kira/Soraya choose to write theirs — the fixes
are the application for sign-off, not the sign-off.

## Pointers

- The Vera brief REVISION 2 (routing + the three Q# jobs) · the fixed sources (ChipAudio, Braid,
  BellTest, ShapeAcceptance, SpectralPivot, AdinkraViz tests) · braid.lines + adinkra.lines
  (issues closed in-file) · Soraya's mod2 statement (adopted verbatim in the adinkra edge line)
