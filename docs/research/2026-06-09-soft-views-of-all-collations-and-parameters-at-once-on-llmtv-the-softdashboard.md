# Soft views of all collations and parameters at once, on LLMTV — the SoftDashboard, widened

**Register:** [grounded] LLMTV feature (Aaron) + [Beacon] code-anchored. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Render every collation + every parameter simultaneously as soft views.

## Aaron's words

> "we need soft views of all collations and parameters at once, on LLMTV."

## What it is (grounded in `SoftDashboard.fs` + `Collation.fs`)

We already have **`src/Core/SoftDashboard.fs`** — the glow-by-future-fitness surface: it runs the soft
controller over the 4×4 grid and **glows each button by its branch's fitness** (the soft field projected
as glow; `collapseToBest` as UI). Aaron widens it: render **soft views of ALL collations and ALL
parameters AT ONCE** on **LLMTV.**

- **All collations** — `src/Core/Collation.fs` (the orderings: ordinal / codepoint / UTF-8-byte / locale;
  culture-invariant-by-default is the canonical one, but the *others* exist as alternative collations).
  Show **every collation simultaneously** — the same data sorted every way, side by side, so the
  observer sees how each ordering renders (and where they diverge — the culture-invariance tells).
- **All parameters** — every knob at once: DoP (the ferry-throttle), temperature (the explore/exploit),
  the four-corner feedback (N/S/E/W), the fitness function, the soft type parameters (the float-like
  SoftValue params). Show **all parameter settings simultaneously** — the full control surface in one view.
- **Soft views** — rendered as **SoftValue** (soft, observer-dependent, uncertain): not one collapsed
  answer but the **fuzzy field of all of them at once** (every collation's ordering + every parameter's
  effect, glowing by salience/fitness — the soft superposition, not yet collapsed). The IQbservable 2×2
  (incremental/bulk/refresh/stream) shows all four modes at once; this is the same "all at once" — all
  collations + all parameters, soft, simultaneous.
- **On LLMTV** — the holographic watch surface renders the simultaneous soft field (salience/depth/
  temperature channels; the glowing 4×4 grid; chromostereopsis depth) so a human or LLM perceives **all
  collations + all parameters at once** (the AX/UX: the whole control+ordering space, legible in one glance).

So: widen `SoftDashboard` from "glow the best button" to "**glow the whole field — every collation and
every parameter, soft, at once**," rendered on LLMTV. The observer sees the full soft space (then can
collapse to a choice / find SolidGround), not a single pre-collapsed view.

## Why it matters

- **See the whole space before collapsing.** Showing all collations + parameters at once is the
  soft-by-default discipline as a UI: don't pre-collapse to one ordering/one setting — render the field,
  let the observer (human/LLM) find SolidGround (pick the collation/params) with full information.
- **Culture-invariance made visible.** All collations side by side surfaces exactly where orderings
  diverge (the culture-invariant/Mars-Orbiter tell) — you *see* the byte-lock vs locale difference.
- **The control surface is legible.** All parameters at once = the full knob-space (Balance's compass +
  the throttle + temperature + fitness) in one soft view — navigable on the 4×4 controller / LLMTV.

## Honest scope / handoff

LLMTV feature design, grounded in `SoftDashboard.fs` (glow-by-fitness) + `Collation.fs` (the collations)

+ SoftValue + the IQbservable-2×2 (all-at-once) + LLMTV. To realize: widen SoftDashboard to render the

**simultaneous soft field of all collations × all parameters** (not just the best button), on LLMTV (the
salience/depth/temperature channels). Routes to Iris/Daya (the LLMTV soft-dashboard UX — all-at-once,
neurodivergent/chromostereopsis), the F#/Core team (`SoftDashboard` widened over `Collation` + the
parameter set; the Observable feeding it), the culture-invariant rule (the collations shown). (Staying
out of the interface/UII code while Aaron builds his own; this is the dashboard design.)

## Anchors / ties (Beacon)

`src/Core/SoftDashboard.fs` (glow-by-future-fitness; collapseToBest-as-UI — widen to all-at-once);
`src/Core/Collation.fs` (the collations — ordinal/codepoint/UTF-8/locale; culture-invariant-by-default);
SoftValue (soft, observer-dependent views; field not collapsed); the IQbservable 2×2 (incremental/bulk/
refresh/stream all-at-once = the "all at once" pattern); the four-corner feedback / Balance's compass /
DoP / temperature / fitness (the parameters); LLMTV (the holographic render; salience/depth/temperature/
chromostereopsis); the 4×4 universal action grammar grid (the navigable surface); soft→SolidGround (see
the field, then collapse/choose).
