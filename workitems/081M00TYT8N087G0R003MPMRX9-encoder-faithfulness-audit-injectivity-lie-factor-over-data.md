---
id: 081M00TYT8N087G0R003MPMRX9
type: task
state: backlog
priority: P2
slug: encoder-faithfulness-audit-injectivity-lie-factor-over-data
title: "Encoder faithfulness audit: injectivity + lie factor over data-to-geometry paths (heatReceiptPpm saturates at 16 units)"
created: 2026-08-14T19:11:08.053Z
depends_on: []
composes_with: []
---

# Encoder faithfulness audit: injectivity + lie factor over data-to-geometry paths (heatReceiptPpm saturates at 16 units)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00TYT8N087G0R003MPMRX9-*.md` glob. -->

**Analysis:** `docs/research/2026-08-14-branch-free-visual-encoding-is-the-meaning-junction-lie-factor-injectivity-and-what-the-eye-can-check.md`

## The defect class

A **visual encoder** is a function `data → geometry`. It lies when it is **non-injective** on its
declared domain: two different data states produce the same picture, and no reader — human or agent —
can tell them apart. This is the same defect as a vacuous check (a surface reporting a state it could
not have measured), on a different surface.

Anchor: Tufte's **lie factor** = `(effect shown) / (effect in data)`, which should be 1.0
(*The Visual Display of Quantitative Information*, 1983).

## Live defects found (verified by running, against `origin/main@fd02d1ee1`)

1. **`src/Core.TypeScript/darkhall-ui/heat.ts:237-242` — `heatReceiptPpm` saturates at 16 units.**
   `maxUnits` defaults to 16 and the result is clamped to `MAX_TEMPERATURE_PPM`. Measured lie factors:
   `LF(16→32) = 0.5000`, `LF(16→100) = 0.1600`, `LF(16→1000) = 0.0160`. 24 collisions over units 1..40.

2. **`heat.ts:278-284` — `temperatureBand` pins at `critical` from 11 units upward.** Verified: units
   11, 100, 1000 and 1 000 000 all read `critical`. A stuck gauge and a steady reading are
   indistinguishable — the confirmed instance of *correlated coincidence over time*: it varies plausibly,
   correlates with what you care about, measures nothing above the pin, and repeated observation
   **strengthens** false confidence.

3. **`heat.ts:315-319` — `blackBodyRadiancePpm` has a 3.162% dead zone.** Integer-floor `T⁴`; verified
   that all `T < 31623` ppm map to radiance exactly `0`. Branch-free and still unfaithful — `floor` is a
   branch-free destroyer of information.

4. **`heat.ts:286-288` — `thermalPpm = max(heat, uncertainty, pressure)`** is a non-injective fold; the
   *cause* is unrecoverable from the number. Currently mitigated only because `TemperatureReadout`
   (`:303-312`) carries all three channels alongside it.

5. **`src/Core/SocietalDoraSvg.fs:22` — latent, not live.** The `[0,1]` clamp is dead code for
   `SocietalDora.compute` output (all four rendered fields are fractions or convex means by construction)
   but live for any hand-built `Metrics` record. Its cost is that a future out-of-range regression would
   render as a plausible 100% bar rather than a visible failure.

Clean surfaces (no action): `AdinkraViz.fs` (nominal channel, total injective map), `ZetaIdViz.fs:45`
(bijective), `CoEmpowerGraphSvg.fs:34` / `MetaspaceGraphRender.fs:46` (index branches only).

## Proposed check — and it demonstrably fires

An **encoder registry** — each entry `(function, declared domain, declared origin, declared reading
protocol)` — plus an audit that samples the domain and asserts (a) injectivity, (b) `|LF − 1| < ε`.

Demonstrated in both directions against real code, **mutant not planted — it already exists**:

- **FAIL** on `heatReceiptPpm` (24 collisions, `e(16) == e(17)`)
- **PASS** on a proportional control encoder and on `SocietalDoraSvg.pct` over its declared `[0,1]`
- **FAIL** on `SocietalDoraSvg.pct` over an out-of-range domain (15 collisions, LF 0.8889)

### Constraints the implementation must honour (or it becomes the twelfth vacuous check)

- It can only see encoders exposed as **pure numeric functions**. Encoders inlined in template strings /
  JSX (`src/Renderers/website/`) are invisible — the audit **must display the un-audited set**, per the
  coverage requirement in
  `docs/research/2026-08-13-peer-agents-parallel-experiments-and-why-a-health-dashboard-is-a-check-that-must-not-lie.md`.
- A **truncated baseline** is undetectable without a declared origin. Origin is a declaration, not an
  inference. No declared origin ⇒ `unmetered`, never `pass`.
- Sampling is a regression guard, not a proof. Linearity-through-origin is provable by inspection.
- The audit says nothing about **channel** accuracy (Cleveland–McGill 1984). LF = 1 on an area encoding
  still misleads. That half is design review, not lint.
- Do **not** print a fabricated "worst pair" in the passing case — print *"no violating pair found"*.
  (The exploratory probe had exactly this display vacuity; see §9 of the analysis doc.)

## Scope

1. Register the encoders (the declaration is the forcing function; the linter is secondary).
2. Land the audit under `src/Core.TypeScript/hygiene/` with tests in both directions.
3. Fix `heat.ts` saturation: widen `maxUnits` from an observed maximum, adopt a declared log protocol,
   or render the pinned state **as pinned** — a saturated gauge must be visibly distinct from a high one.
4. Relocate `SocietalDoraSvg`'s clamp into a refined type (`UnitInterval` / the existing `Bound` DU) so
   the renderer is branch-free and out-of-range fails loudly upstream.

## Why this audit is the *second route*, not just a metric

Applying the repo's own homoiconicity falsifier
(`081KX93R6EF08QG0R0020AQQWZ:105` — *"a genuine discriminator must compute … by independent routes"*;
*"the coincidence was built in, not derived"*) to the rendering surfaces:

- **The golden lock is agreement by construction.** `tests/Tests.FSharp/ShapeAcceptance.Tests.fs:59`
  compares the committed golden against `ShapeRender.toSvg d` — the generator's own output — and
  `src/Core.FSharp.Cli/Program.fs:16` confirms goldens are *"regenerated, never edited"*. It proves
  **determinism** and establishes nothing about faithfulness.
- **The geometry gate IS an independent route and it has fired.** `src/Core/ShapeAcceptance.fs:41-478`
  checks mathematical known-answer laws, fail-closed at `:479`; `:48-50` records that bounds joined the
  spiral law *"after Aaron's eye caught the 1100 escape."*
- **The gap:** nothing reads the rendered SVG and asks what data it depicts. The stroke list is the last
  common representation; *strokes → SVG bytes* is checked only by construction.

**Tufte's lie factor measures the effect in the graphic against the effect in the data, computed
separately from the artifact.** That is the missing second route — which is why this audit is a
discharge condition for the faithfulness claim, not a nicety.

## Not in scope

Channel ranking against Cleveland–McGill, and adoption of grammar-of-graphics vocabulary
(Wilkinson 1999 / Wickham 2010) — both tracked as open items in the analysis doc.
