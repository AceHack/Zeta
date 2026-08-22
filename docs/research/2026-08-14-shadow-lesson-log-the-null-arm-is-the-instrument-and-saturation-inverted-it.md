# Shadow lesson log — the null arm IS the instrument, and saturation inverted it

**Date:** 2026-08-14
**Author:** Otto (shadow\*)
**Context:** the backpressure-algebra / bandwidth-isolation study (PR #10693).
**Register:** owned notes; lessons and owned errors.

---

## Lesson 1 — build the null as an ARM, not as a formula

The reflex was to reach for `sigma = 1/sqrt(n-1)` and call anything past 2 sigma a finding. That
would have been wrong here for a reason already written down in this repo: a queue-occupancy series
is autocorrelated, and an i.i.d. null over-convicts on autocorrelated streams — the exact defect
the `DecorrelationExcess` arc had to fix with a block permutation null after a plain permutation
null convicted **42 of 160** strata.

The move that worked was structural rather than statistical: **make the null a third arm of the
experiment.** Same seeds, same per-flow entropy draws, same control law, same autocorrelation, only
the coupling removed. Then no distributional assumption is needed at all, because the comparison is
against the same generator.

Generalisable: when a null is hard to model, look for a way to _run_ it. A null you can execute
beats a null you can derive, and it beats it precisely on the assumptions you would otherwise have
to defend.

## Lesson 2 — the OWNED ERROR: I nearly shipped the saturated regime as the headline

The first sweep I ran went to high offered load, because "more contention should show more
coupling" is obviously true. It produced:

```
shared          meanR -1.000   sd 0.000    16/16 negative
isolated-split  meanR +1.000   sd 0.000
```

Perfect separation. Zero variance. Sixteen out of sixteen. It is the most beautiful table I
produced all day, and **every digit of it is an accounting identity.** The shared link was saturated,
so `d1 = TOTAL - d0` by arithmetic; the isolated links were saturated, so both delivered a constant
and r = +1 came off **one bucket in 190** (the series took exactly two distinct values: 50 ×189,
51 ×1).

Had I read the shared column alone, I would have reported a −1.000 confirmation of Aaron's claim
with a straight face. Had I read both columns, the honest reading is that **isolation makes flows
maximally correlated** — the exact inverse of the truth.

What caught it was not suspicion. It was **looking**: printing the actual bucket arrays instead of
the summary. `SHARED sum: 100 100 100 100 ...` is not a number that needs interpreting.

> **Look, don't infer** is not a slogan about being careful. It is the specific instruction to print
> the row when the aggregate is beautiful.

## Lesson 3 — the "correlated coincidence" shape has a tell: zero variance across seeds

Aaron's diagnosis this morning was a control input that _varies plausibly_ and is therefore trusted
while measuring the wrong quantity. The saturated table is that, and it had a tell I can name:

**sd = 0.000 across 16 independent seeds.** Sixteen different entropy streams producing bit-identical
correlations is not strong evidence — it is evidence that the entropy is not reaching the statistic
at all. A real effect on a stochastic system has scatter. The genuine finding, when it came, read
`−0.240 ± 0.074` — noisy, and _therefore_ believable.

Adding to the checklist: **a statistic that does not move when the seed moves is not measuring the
system.**

## Lesson 4 — the finding that contradicts the claim was the most valuable output

The ask said "the honest possible outcome" includes not unifying. It did not anticipate that the
sharpest result would _invert_ the claim in one regime: two isolated flows correlating at +0.71,
nearly 3× the shared arm, with no channel between them.

I noticed it because I ran the AIMD arm expecting it to _strengthen_ the story (a control loop
should couple flows harder than a bare queue). It did the opposite, and my first instinct was to
look for the bug. There was no bug — both guards passed, all 16 readings usable. Two controllers
running the same law into the same boundary trace the same trajectory. Reichenbach, 1956.

> The reflex "this contradicts the claim, so it is probably my error" is correct **as a first
> hypothesis and wrong as a conclusion.** Spend the check, then let the number stand.

The result is stronger _for_ Aaron's frame than a clean confirmation would have been, because it
tells him where the mechanism stops: isolate identical agents perfectly and their failures correlate
perfectly, since contention was the thing breaking their symmetry.

## Lesson 5 — two derivations of one boundary is the real evidence

I derived "deferral composes, destruction does not" from Kahn determinacy. PR #10640 derived the
same partition, hours earlier, from Landauer reversibility — _negate_ costs 0 bits, _consolidate_
costs 3.459.

I did not know about #10640 until I ran `git log` on `SoftThrottle.fs`. The right move was to cite
it and drop my framing to a second derivation, not to present mine as the account. **When the repo
already reached your boundary from another direction, the finding is the convergence, not your
path to it.**

## Owned errors, listed

1. Ran the headline sweep in the saturated regime first and would have shipped a conservation
   identity as a result. Caught by printing the buckets.
2. Initially set `sendPhaseJitterMs = 1` against a 1.667 ms gap without noticing that _added_
   (not centred) phase noise cuts the offered rate by 22% — so my "1.2C offered" run was actually
   0.92C. The zero-drop columns are what exposed it.
3. Asserted `covarianceLeverage == 1.0` in a test when the measured value is 0.995. A tidy number
   asserted in a file about numbers that lie. Fixed to a bound, with the reason in the comment.

## Pointers

- The study: `docs/research/2026-08-14-backpressure-has-no-single-algebra-deferral-composes-destruction-does-not-and-bandwidth-isolation-decorrelates-the-channel-not-the-common-cause.md`
- The instrument + its three named failure modes: `src/Core.TypeScript/discovery/bandwidth-isolation-decorrelation.ts`
- The pins: `bandwidth-isolation-decorrelation.proof.test.ts` — BID-5/6/7 pin the LIES, BID-11 is the
  falsifier, BID-12 pins the finding that contradicts the claim.
- The convergent derivation: #10640, `src/Core/SchedulerShedHeat.fs`.
- `docs/research/2026-08-04-decorrelation-instrument-arc-capstone-what-survives-is-benign-shared-buses.md`
  — where the autocorrelated-null lesson was already paid for once.
