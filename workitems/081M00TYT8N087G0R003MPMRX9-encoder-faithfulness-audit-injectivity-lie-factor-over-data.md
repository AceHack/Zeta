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

---

## Progress — scope items 3 and 4 DONE (shadow, 2026-08-14, branch `shadow/fix-non-injective-heat-encoders`)

Scope items **1** (encoder registry) and **2** (the audit under `hygiene/`) remain open; this pass
fixed the encoders themselves. All numbers below were produced by running the code, before and after.

### Reproduction of the reported defects — all four confirmed against `origin/main@f63307c17`

| # | reported | reproduced? |
|---|---|---|
| 1 | `heatReceiptPpm` saturates at 16 units, 24 collisions over `1..40`, `LF(16->1000) = 0.0160` | **yes, exactly** — `LF(16->32) = 0.500000`, `LF(16->100) = 0.160000`, `LF(16->1000) = 0.016000`; collisions = `|domain| - |image|` = `40 - 16` = 24 |
| 2 | `temperatureBand` pins at `critical` from 11 units up | **yes** — with the nuance that *two* mechanisms compose: units 11–15 differ in ppm but share the band; from 16 up the ppm is identical too |
| 3 | `blackBodyRadiancePpm` ≡ 0 below 3.162% of scale | **yes** — `radiance == 0` for 31 623 of 1 000 001 temperatures; first non-zero at `T = 31 623` (3.1623%) |
| 4 | `SocietalDoraSvg.fs:22` clamp latent but not live | **yes** — and measured: pre-fix, `render(1.5)`, `render(nan)`, `render(-0.5)` and `render(infinity)` are **byte-identical** to a healthy `render(1.0)` / `render(0.0)` |

### Corrections and additions

- **The reported lie factors are right; a first probe of mine was wrong.** Computing
  `LF(a->b)` as `[e(a)/e(b)] / [a/b]` yields `62.5` and invites the conclusion that `0.0160`
  was mislabelled. Tufte's orientation is `[e(b)/e(a)] / [b/a]`, which reproduces `0.0160`
  exactly. The error was in the measurement, not the report.
- **NEW, and ranked above the reported defects in the fail-dangerous direction:** the clamp
  makes out-of-domain input *reassuring*. Measured pre-fix:
  `temperatureBand(NaN) = "cold"`, `temperatureBand(Infinity) = "cold"`,
  `temperatureBand(-1) = "cold"`; likewise `heatReceiptPpm(NaN) = 0` and
  `heatReceiptPpm(Infinity) = 0`, and in F# `pct(nan) = 0` (a 0% bar) while
  `pct(infinity) = 100` (a full bar). The reported defects **over**-alarm; these
  **under**-alarm — a dead sensor renders as a calm room.
- **NEW:** `heatReceiptPpm` also collided at the bottom — `0`, `-5`, `0.5`, `0.999`, `NaN`
  and `Infinity` all mapped to `0`, so a true "no heat" was indistinguishable from a broken
  counter.
- **NEW:** `blackBodyRadiancePpm` is non-injective across its *whole* range, not only the
  dead zone: 1 000 001 temperatures produce 515 562 distinct radiance values.

### Per-site choice, and why they differ

The three heat sites are NOT alike, and the deciding fact is **who else byte-locks the values**:
`temperatureBand` and `blackBodyRadiancePpm` have F# counterparts (`src/Core/Heat.fs`
`bandOfPpm`, `BlackBodyReadout.radiancePpm` — the identical integer double-floor in `int64`)
plus treaty cases; `heatReceiptPpm` has **no** F#, Q# or treaty counterpart at all.

| site | option taken | why this one |
|---|---|---|
| `heatReceiptPpm` | **1 — widen the channel** | TypeScript-only, nothing cross-oracle to break, so the values are free to move. Now `log1p` with a declared ceiling of `65 536` units (was an implicit linear 16), **verified injective exhaustively**: image 65 537 of 65 537, strictly increasing, tightest realised gap exactly 1 ppm. `131 072` is not injective (image 121 755) — the ceiling is measured, not guessed. |
| `temperatureBand` | **3 — refine the input**, plus **2 — declare the ceiling** | The four band tokens are a four-oracle treaty; widening the band set unilaterally is not available here. `number` is wider than the treaty domain (`int` in `[0, 1e6]`), so the fix relocates the branch into `TemperatureBandReading.verdict` — `in-range` / `over-ceiling` / `out-of-domain`. Band tokens unchanged. |
| `blackBodyRadiancePpm` | **2 — declare the bound** | Values are byte-locked by F# and the treaty, **and the floor is mathematically forced**: a fourth-power law over six decades of input needs twenty-four decades of output and the channel has six. At `T = 31 623` the true radiance is exactly 1.0 ppm; below that it is genuinely sub-ppm. Declared as `BLACK_BODY_RADIANCE_FLOOR_PPM` + `fidelity: "below-resolution"`, which is *not* the same statement as `radiance = 0`. |
| `SocietalDoraSvg.pct` | **3 — refine the input** | Exactly as this work-item proposed: a new `UnitInterval` with a smart constructor. `percent` is now total and branch-free; the branch relocated upstream to one site in `render`, where out-of-range renders a visibly broken dial instead of a plausible bar. |

### Evidence that the tests discriminate

A test that passes before *and* after proves nothing, so this was checked rather than assumed.
Six assertions expressible against the **pre-fix** API, run against both modules:

```
check                                                          | pre-fix | post-fix
heatReceiptPpm(16) !== heatReceiptPpm(17)                      | FAIL    | PASS
units {16,17,32,100,1000} give 5 distinct ppm                  | FAIL    | PASS
heatReceiptPpm injective over units 0..40                      | FAIL    | PASS
11 units does NOT read `critical`                              | FAIL    | PASS
units {11,100,1000,1000000} give 4 distinct (ppm,band) pictures | FAIL    | PASS
a 100x climb in units is visible as a band change              | FAIL    | PASS
```

6 of 6 discriminate. The headline defect: units `{11, 100, 1000, 1 000 000}` produced **one**
picture before and **four** after; 11 units now reads `warm`, not `critical`.

On the F# side, all four out-of-range renders were byte-identical to a healthy render pre-fix and
all four differ post-fix, while `render(0.5)` still emits `width="150"` on the 300px track and
remains deterministic.

The remaining fidelity checks are **not expressible against the pre-fix API** — there was no
channel to carry the answer. That absence *is* the defect, and it is recorded as such rather than
dressed up as a passing test.

### Residuals — deliberately not fixed here

Filed as **081M010WYE5087G0R003J89QVF**: no renderer reads `fidelity`/`verdict` yet; TypeScript's
`TemperatureReadout` gained a required `fidelity` field that F#'s has **not**, while both still
declare `zeta.temperature.readout.v1` (a divergence this change introduced, and which no existing
test can see); and `thermalPpm` remains the non-injective fold of defect 4.

Filed as **081M010W1BP087G0R002M2BNVW**: `HeatSignature.isPressureKind` vs `HeatSignal.ofKind`
disagree on dual-token kinds (3 of 6 probed kinds), found in passing and left alone.

## Follow-on (2026-08-15) — the receipt's SIGNAL channel had no denominator

`081M01400RZ087G0R000PS3VJG` was filed by PR #10732 as *"the receipt rails paint a blind counter
as a genuine zero"*. It has two halves and they are held by two changes:

- the **counter** half — `heatRejected: NaN` and `heatRejected: 0` both render `heatPpm: 0` — is
  PR #10742, which publishes one `ChannelFidelity` per rail.
- the **signal** half, fixed here: `heatSignals` returned `[]` both for a producer that reported an
  empty `signals` array and for a producer with **no `signals` key at all**, where the set was
  reconstructed from zero kinds and zero counters, i.e. from no evidence. The receipt published
  `signals: []` either way and the renderer labelled both `cold` — the healthy word on a reading
  nothing produced.

Measured on unmodified `main` over seven genuinely distinct `HeatRow` inputs: **4 distinct
published receipts, two collision groups**. After: **6 distinct, one group** (that one is the
NaN-vs-zero pair, #10742's lane, named rather than absorbed).

The fix is two optional keys with a conservative absent-reading — `signalSource`
(`reported | inferred`) and `signalObservations` (the denominator) — read through
`heatReceiptReading`, which returns `measured | unknown | unreported`. Neither key is derivable
from the other: `signalObservations = 0` occurs under both sources, and `signalSource = reported`
occurs at every observation count, so a single folded verdict would have been a fresh
non-injective encoder.

### Residuals — deliberately not fixed here

- **`DarkHallRoomTranscript.coldHeatRow` fabricates `Signals = []`.** That row is synthesised for a
  resumable continuation with **zero measured ticks**, so on the wire it claims `reported` — a
  measurement it never made. The producer knows and the wire shape gives it no way to say so:
  F#'s `HeatRow.Signals` is `string list`, not an option, so making the absence expressible is a
  change to a shape F# produces and TypeScript consumes, i.e. the same published-schema decision
  PR #10742 settled for `zeta.temperature.readout.v1`. **Not made unilaterally here.** Today's
  mitigation is only that the fabricated row never reaches `Transcript.HeatRows` and so never
  becomes a receipt; that is a property of one call site, not a guarantee.
- **The rails still publish no scale.** `heatReceiptScale` computes `ceilingUnits` and `protocol`
  and `heatReceiptFromRow` discards both, so a reader cannot invert the `log1p` to recover the
  count and the ppm value is a ratio with an unstated denominator. Two receipts produced under
  different `maxUnits` are indistinguishable on the wire and mean different things.
