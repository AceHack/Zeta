# Four-corner "homoiconicity" — three claimed identities, checked: one analogy, two false

**Shadow, 2026-08-16.** A register audit of one docstring. Code + probes + two filed bugs; no behaviour
changed.

## Verdict, first

`src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts` §Homoiconicity asserts four identities.
Three were put under test independently. **None of the three is an identity.** One is a legitimate
analogy that should be labelled as such; two are false, and the AIMD one is false in the specific way
that hides a live defect.

| # | Claim (verbatim) | Register | The discriminator |
|---|---|---|---|
| 1 | *"The new generator function is the new EP factor (same as the BNN update)"* | **FALSE** | `generatorFn` reaches the EP update through **no path**. `toEpObservation` reads `severity` and `dimension` only. Two envelopes differing only in `generatorFn` produce a **byte-identical posterior** (measured). |
| 2 | *"The quasi-time-crystal detector is the FigureEightEnsemble (same as the tangle detector)"* | **ANALOGY** (both halves overstated) | No shared code, no shared abstraction, no golden vector. Different statistics: this is **temporal self-**agreement of one lane at lags 1..4; `rhoProxy` is **cross-sectional** agreement of three cells at one instant. And `FigureEightEnsemble` is not a tangle detector — λ ≤ 0, `Frozen` (measured, already merged). |
| 3 | *"The time-dilation is the AIMD backoff (same as the UDP transport)"* | **FALSE**, and oppositely so | AIMD steers on **loss rate** and recovers **additively**. `dilationFactor` steers on **pattern regularity** and has **no increase term at all**. A 0%-loss lane and a 100%-loss lane both compute `dilationFactor = 0`; a dilated lane never recovers. |

The fourth line (*"the −1 retraction is the Zeta retraction"*) was not in scope but was measured in
passing and is reported in §5, because the same probe answered it.

Two bugs filed on the way: **081M065HQKT087G0R0033B3GTD** (dilated lane never recovers) and
**081M065HVB5087G0R002N9NPFA** (dilation blind to loss rate).

## What "checked" meant here

Every row above is a run, not a reading. The probes are reproduced inline so the next reader can rerun
them; they were executed against `origin/main` at the time of writing, in a clone, with `bun` and
`dotnet test`.

---

## 1. Claim 1 — "the new generator function is the new EP factor" · **FALSE**

### What `generatorFn` actually is

`teachingRejection` (`four-corner-feedback.ts:155-171`) computes `dimension` from substrings of the
rejection reason, then computes `generatorFn` as a **seven-way lookup on `dimension`** — a fixed English
sentence:

```
dimension === "schema" ? "validate schema before sending; use zod or typebox" : ...
```

Measured: two rejections with different `frameId`, different `reason` text and different lane index
produce the **same string**, because the only input that survives is `dimension`.

### Where it goes

`ZetaTransportCell.send` puts it into `envelope.beacon` and `envelope.mirror.howToFix`
(`zeta-transport-cell.ts:213,217`) and calls `absorbError`. The EP update is:

```ts
// error-envelope.ts toEpObservation
const z = SEVERITY_Z[envelope.mirror.severity];
return { x: z, dimension: envelope.mirror.dimension, ... };
// error-bnn-bridge.ts absorbError
const result = updateStudentT(state, obs.x);
```

`howToFix` and `beacon` are read by neither. Nor by `envelopeId` — the idempotency key is built from
`(correlationId, dimension, what, why)`, so `generatorFn` does not even affect deduplication.

### The measurement

Two fresh `DimensionalBnn`s, identical envelopes except `generatorFn`, one of them deliberately absurd:

```
generatorFn A: "reduce batch size; increase retry interval (AIMD)"
generatorFn B: "DELETE PRODUCTION DATABASE; sacrifice a goat"

envelopeId identical?   true
posterior A: {"mu":0.8283579120816716,"sigma2":0.7152936815226576,"robustnessWeight":0.8, ...}
posterior B: {"mu":0.8283579120816716,"sigma2":0.7152936815226576,"robustnessWeight":0.8, ...}
IDENTICAL POSTERIOR:    true
```

An EP factor that the model cannot distinguish from any other EP factor is not an EP factor. It is a
**display string** — a good one, addressed to a human reading a log.

### The honest neighbouring claim, which IS structural

Four lines above the false one, the same docstring already says the true thing:

> *"3. The error dimension: 'which BNN factor to update'"*

That one is **structural**: `obs.dimension` selects the `StudentTState` out of `bnn.states`, so the
teaching ack and the BNN cannot disagree about which factor moved — there is one map and one key. The
claim that failed is the *upgrade* of that true statement from `dimension` to `generatorFn`.

Worth stating plainly, because it is the actual finding rather than a scold: on this path the only thing
that varies per rejection is `dimension`; `severity` is hardcoded `"error"` at
`zeta-transport-cell.ts:219`, so **every transport rejection is the same observation `x = 2`**. The
teaching content is real to a human and invisible to the posterior.

---

## 2. Claim 2 — "the quasi-time-crystal detector is the FigureEightEnsemble" · **ANALOGY**

Three separate things had to hold for this to be an identity. None does, and the third was already
settled in-repo before I looked.

### (a) No shared object

`four-corner-feedback.ts` imports exactly two symbols, both types (`BatchAck`, `ErrorDimension`).
`FigureEightEnsemble` is F# in `src/Bayesian/`. There is no shared function, no shared abstraction, no
cross-language golden vector tying the two. They cannot diverge by construction because nothing joins
them by construction. So: not structural.

### (b) Different statistics, not the same statistic renamed

This is the discriminating evidence, and it is the reason "analogy" rather than "verified":

| | quasi detector | `FigureEightEnsemble.rhoProxy` |
|---|---|---|
| domain | 16 booleans from **one** lane | 3 Gaussian belief means from **three** cells |
| axis | **time** (lags τ = 1..4) | **population**, at a single tick |
| formula | `matches / comparisons` | `1 − variance / maxPossibleVariance` |
| answers | "does this lane repeat itself?" | "do these three agree with each other?" |

Autocorrelation and cross-sectional dispersion are not the same measurement wearing two names. One asks
whether a series is periodic; the other asks whether a population has collapsed. A system can be maximal
in either while minimal in the other.

### (c) `FigureEightEnsemble` is not a tangle detector — already measured

The claim borrows authority from "the tangle detector", and that identification was itself refuted on
2026-08-14 by `tests/Bayesian.Tests/FigureEightTangleClass.Tests.fs`, which is merged and which I ran:

```
Passed!  - Failed: 0, Passed: 3, Skipped: 0, Total: 3 - Bayesian.Tests.dll
```

Its content: a homoclinic tangle is a **saddle** with λ > 0 (Poincaré/Smale); the figure-8 measures
λ ≤ 1e-6 and classifies `Frozen`, not `Trapped`. Collapse is not chaos. So claim 2 identifies one thing
that is misnamed with another thing that is misnamed — and the fact that both are misnamed is not
evidence that they are each other.

### (d) The detector's own name — already filed, not re-filed

`Orbit.fs` is the repo's own taxonomy: `Crystal n` = period n ≤ maxPeriod (commensurate);
`Quasiperiodic` = **no** period ≤ maxPeriod (the quasicrystal regime). The four-corner detector fires
**iff** an approximate period ≤ 4 exists, i.e. exactly on `Crystal n` — the complement of the class its
name and its own definition claim. Filed 2026-08-14 as `081M00SW8YJ087G0R002J1WFFE`; this doc adds only
that the same inversion is what makes claim 2 unrescuable even in principle.

### What survives, and it is not nothing

The shape being pointed at is real: *a closed feedback loop can lock into a repeating state, and a
scalar in [0,1] with a threshold is how you notice.* That is a genuine and generative observation. It is
an analogy between two thresholded agreement statistics, and labelled as one it costs nothing and keeps
its value.

---

## 3. Claim 3 — "the time-dilation is the AIMD backoff" · **FALSE**

The brief asked specifically whether these share an implementation or merely both reduce a rate. The
answer is worse than "merely both reduce a rate": **they do not both reduce a rate.**

### No shared implementation

`udp-lossy-transport.ts` owns `AimdState` / `onSend` / `onLoss` / `updateAimd` / `retractLoss`.
`four-corner-feedback.ts` imports none of them and duplicates nothing from them. Not structural.

### Different control variable

AIMD's input is `congestionSuspectRate(state) = (congestion + unknown) / sentCount` — a **rate**.
`dilationFactor`'s input is `bestCorr` over lags — a **regularity**. Measured, 16-sample windows:

| pattern | loss rate | dilationFactor |
|---|---|---|
| all rejected | 1.00 | **0.000** |
| all received | 0.00 | **0.000** |
| alternating | 0.50 | 0.000 |
| one-in-four | 0.25 | 0.000 |

A controller that assigns the identical maximal throttle to a 0%-loss lane and a 100%-loss lane is not
implementing congestion control. (Filed: `081M065HVB5087G0R002N9NPFA`.)

### No increase term — the half that defines AIMD

AIMD is **A**dditive **I**ncrease, Multiplicative **D**ecrease. `udp-lossy-transport.ts:1063-1066` has
both halves; the four-corner path has only a decrease. Same loss sequence — 16 losses, then a healed
link — fed to both:

```
       i= 15   aimd gapMs=500   quasi dilation=0.000
       i= 79   aimd gapMs=498   quasi dilation=0.000
       i=143   aimd gapMs=496   quasi dilation=0.000
       i=207   aimd gapMs=494   quasi dilation=0.000
```

AIMD walks the gap back down, one `GAP_STEP_MS` per clean window, and would return to `MIN_GAP_MS`. The
dilation does not move — and in `ZetaTransportCell` it cannot, because `dilationFactor` is written at
exactly one site (`zeta-transport-cell.ts:231`), inside the `catch`. A lane at `dilationFactor = 0` is
filtered out of `send` at `:167`, so it is never attempted, so it never fails, so its dilation is never
recomputed. End to end:

```
after 16 failures  -> dilation: 0    frames delivered: 0
network healed, 200 sends attempted:
  dilation: 0    frames actually delivered: 0
  => lane recovered? false
```

(Filed: `081M065HQKT087G0R0033B3GTD`.)

### The AIMD analogue in this system exists — it is the other one

`ferry-throttler/heat-aware-scheduler.ts` has `HOT_FACTOR = 0.5`, `CRITICAL_FACTOR = 0.1`,
`RECOVERY_STEP = 0.05` (additive increase per successful drain) and `MIN_WEIGHT = 0.05` ("never fully
starve a lane — prevents deadlock"). It calls itself *"the same principle as TCP AIMD … but driven by
thermodynamic heat"* — an **analogy, labelled**, with both AIMD halves actually present and a floor that
makes the latch impossible.

`ZetaTransportCell` uses both mechanisms side by side. The one that says "analogue" behaves like AIMD;
the one that says "is" does not. That is the whole lesson of this audit in one file.

---

## 4. The strategy paragraph

> *"the lane is 'time-dilated' … and treated as a 0-energy bottom state — the ferry stops fighting it and
> lets it idle. This is the Chip-8 quasi-time-crystal survival strategy: collapse the loop because it is
> super-predictable and costs 0 energy to maintain."*

Two separable parts.

**The strategy as an idea is sound and needs no physics.** "Stop retrying a lane whose failure is
perfectly predictable" is circuit-breaking (Nygard, *Release It!*, 2007) and it does not require a
time-crystal, a ground state, or an energy argument to be right.

**The strategy as implemented is not the strategy as described.** "Lets it idle" implies a lane that is
resting and will be picked up again. What the code does is retire it permanently (§3). *Idle* and
*deleted* differ precisely in whether there is a way back, and there is not one.

**"0-energy bottom state" remains unanchored** — the 2026-08-14 audit searched and found no in-repo
definition, listed three incompatible candidate referents, and declined to mint one. I did not re-mint
it either. The energy claim also has no meter: nothing in this module measures a cost, so "costs 0
energy to maintain" is not a measurement that could come out otherwise.

---

## 5. The fourth line, measured in passing

*"The −1 retraction is the Zeta retraction (same as the Z-set retraction)"* — out of scope, but the
claim-1 probe answers it, so withholding the answer would be the worse choice.

`absorbError` returns `isRetraction` and **does not use it**. Measured: an envelope with
`retractableBeliefId` set and the same envelope with it removed leave the posterior byte-identical. The
retraction is *reported*, never *applied* — no sign flip, no contraction, no different update.

The contrast is instructive rather than damning, because a real one exists twenty files away:
`udp-lossy-transport.retractLoss` removes the sequence numbers from the window, **recomputes the
decision without the retracted evidence**, and restores the gap only if the decision would not have
fired — with an explicit guard against writing a stale value. That is an AGM contraction with teeth.
The four-corner one is a flag. **ANALOGY** on this path.

---

## 6. Vacuous and mislabelled tests found

The suite is 14/14 green. Green is not the question.

| test | status | why |
|---|---|---|
| `FC-7`, assertion `expect(state.period).toBeLessThanOrEqual(4)` | **cannot fail** | `bestPeriod` is assigned only inside `for (tau = 1; tau <= QUASI_MAX_PERIOD)`. Measured max period over **all 65536** 16-sample windows: **4**. The assertion restates the loop bound. (`FC-7`'s other two assertions are real.) |
| `FC-8`, named *"(negative): quasi-crystal not detected for random pattern"* | **mislabelled** | Its body asserts `isQuasi === true`. The comment calls all-rejected "no pattern"; a constant sequence is the *most* regular input the detector accepts. A reader scanning names sees a negative test that is not one. |
| `FC-9`, named *"(negative): all-received is quasi-crystalline but healthy"* | **mislabelled**, and it documents the bug instead of failing on it | Asserts `isQuasi === true` and `dilationFactor < 1` for a **perfect** lane, with a comment delegating the repair to the caller. This is a defect pinned as expected behaviour. |
| the detector's negative branch | **untested** | No test in the file asserts `isQuasi === false` on a full window. It is not unreachable — measured, **3224/65536 (4.92%)** of windows are flagged, so 95% are not; the first non-quasi window is `0000000000011010` at corr 0.786. The branch discriminates; nothing checks that it does. |

`FC-1`..`FC-5`, `FC-6`, `FC-10`..`FC-14` are genuine (each fails under an obvious mutation). `ZTC-5`
(`dilationFactor < 1` after 16 failures) is genuine. The suite's problem is not that it is weak
everywhere; it is that the two tests wearing "(negative)" are the two that record defects as
expectations.

---

## 7. What was changed

One docstring block, relabelled in place. The claims are **kept verbatim** and a register verdict is
attached to each, per the Mirror→Beacon discipline: peel the hype, not the truth. Nothing was deleted,
no behaviour was touched, and neither `FigureEightEnsemble` nor its pending decision was touched.

## 8. What I could not determine

- **Whether the four-corner module has a live production caller** other than `ZetaTransportCell` /
  `zeta-agent`. I found no other, but "no rg hit" is not "no caller" for a dynamically-dispatched path.
- **What "0-energy bottom state" is supposed to name.** Same answer as 2026-08-14: three candidate
  referents, none confirmed, not minting one.
- **Whether the Chip-8 lineage claim has a source.** I found no Chip-8 code in this repo that collapses
  a predictable loop, and did not search outside it.
- **Whether `severity` being hardcoded `"error"` at `zeta-transport-cell.ts:219` is deliberate.** It
  makes every transport rejection the same EP observation. It reads like a default that was never
  revisited, but I did not find an argument either way and did not file it as a bug.

## Pointers

- `src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts` — the docstring under test
- `src/Core.TypeScript/discovery/zeta-transport-cell.ts:167,196,231` — the single write site and the filter
- `src/Core.TypeScript/discovery/udp-lossy-transport.ts:1045-1067` — real AIMD, both halves
- `src/Core.TypeScript/ferry-throttler/heat-aware-scheduler.ts` — the AIMD **analogue**, labelled, with recovery
- `src/Core.TypeScript/planning/error-bnn-bridge.ts` · `src/Core.TypeScript/protocol/error-envelope.ts:246` — the EP update's actual inputs
- `src/Core/Orbit.fs` — `Crystal n` vs `Quasiperiodic`, the in-repo taxonomy the detector inverts
- `tests/Bayesian.Tests/FigureEightTangleClass.Tests.fs` — λ ≤ 0, `Frozen`; the tangle identification already measured false
- `docs/research/2026-08-14-one-word-four-referents-time-crystal-is-not-the-shared-shape-derived-state-is-droppable-is.md` — the prior audit; `081M00SW8YJ087G0R002J1WFFE`
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `numerology-vs-number-theory.md` · `anchor-to-human-prior-art.md` — the three rules this audit is an instance of
- Work-items filed: `081M065HQKT087G0R0033B3GTD` (latch), `081M065HVB5087G0R002N9NPFA` (loss-rate-blind)
