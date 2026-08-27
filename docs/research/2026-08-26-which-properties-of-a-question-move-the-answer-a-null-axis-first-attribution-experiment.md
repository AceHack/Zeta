# Which properties of a question move the answer? A null-axis-first attribution experiment

**Status: `toy`.** Nothing here is metered. The one thing that would promote it — a
falsifier that fails when the model is wrong — exists for the _metric code_
(`f4-question-bias.test.ts`, 63 falsifiers, 22 injected defects, 0 survivors) and does not
exist for the _claims about language models_, which rest on 27 360 logged generations from
four local models and nothing else.

Aaron, on the borrowed survey-methodology anchor the repo already carries:
_"with llm we can measure this precisely, we should route an experiment on this."_

## 0. The finding, first, because it is the control and not the result

**The null-axis control failed. Cosmetic rewording moves the answer distribution.**

Three edits were built to change nothing — one extra newline, a one-token synonym
(`choose` → `pick`), and two independent clauses swapped. All three were pre-registered as
axes that **must not** move the distribution, with the stop rule written before any
generation ran:

> _If G2 fails in the majority of cells, the finding is INSTABILITY, not framing, and the
> report stops there rather than proceeding to axis attribution._

**It failed in 7 of 7 cells.** So this report does not deliver the per-axis attribution
table it was designed to deliver, and the reason it does not is the result.

**And the failure is the model, not the meter.** That distinction is the whole
contribution, and it took a control the pre-registration did not anticipate. Every prompt
draws from its own seed block, so a variant differs from the anchor in _both_ its text and
its seeds — and the pre-registered calibration pair differs in seeds too, so it cannot
separate them. A third, post-hoc calibration can: split the anchor's own replicates by
parity, odd seeds against even, same prompt, interleaved. Pure sampler noise, nothing else.

It is non-significant in 6 of 7 cells. The seventh reads _p_ = 0.035 uncorrected, which
Holm across the seven returns to 0.245 — and that same cell reads _p_ = 0.0002 on
whitespace, at four times the excess. Below the sampler floor the instrument is quiet;
above it, an extra newline is not.

| level                                                 | preference<br>`gemma2:2b` | preference<br>`llama3.2:1b` | preference<br>`qwen2.5:0.5b` | role<br>`gemma2:2b` | role<br>`llama3.2:1b` | role<br>`qwen2.5:0.5b` | role<br>`qwen2.5:7b` |
| ----------------------------------------------------- | ------------------------- | --------------------------- | ---------------------------- | ------------------- | --------------------- | ---------------------- | -------------------- |
| CALIB-INTERLEAVED (post-hoc: pure sampler noise)      | -0.002 (0.553)            | **0.038** (0.035)           | -0.003 (0.592)               | -0.006 (0.651)      | 0.011 (0.296)         | 0.015 (0.198)          | -0.020 (0.979)       |
| CALIB-WITHIN-PROMPT (post-hoc: adjacent seed blocks)  | 0.012 (0.139)             | 0.018 (0.160)               | -0.002 (0.556)               | -0.002 (0.519)      | -0.030 (0.922)        | -0.004 (0.553)         | —                    |
| CALIB-IDENTICAL (pre-registered: distant seed blocks) | 0.011 (0.051)             | 0.004 (0.330)               | -0.002 (0.605)               | **0.019** (0.023)   | -0.006 (0.653)        | -0.001 (0.531)         | -0.004 (0.471)       |
| NULL-WHITESPACE                                       | **0.019** (0.009)         | **0.152** (0.000)           | **0.030** (0.000)            | 0.009 (0.137)       | **0.038** (0.007)     | **0.046** (0.001)      | **0.030** (0.019)    |
| NULL-SYNONYM                                          | **0.029** (0.001)         | **0.055** (0.000)           | **0.016** (0.020)            | **0.022** (0.007)   | **0.074** (0.000)     | **0.021** (0.038)      | **0.102** (0.000)    |
| NULL-CLAUSE-ORDER                                     | **0.352** (0.000)         | **0.051** (0.000)           | **0.073** (0.000)            | **0.084** (0.000)   | **0.075** (0.000)     | **0.034** (0.004)      | **0.220** (0.000)    |
| FRAME-TEAM (largest semantic axis, for scale)         | **0.129** (0.000)         | **0.853** (0.000)           | **0.379** (0.000)            | **0.814** (0.000)   | **0.675** (0.000)     | **0.507** (0.000)      | **0.883** (0.000)    |

Excess JSD, permutation _p_ in parentheses, bold = significant uncorrected. Read it top to
bottom: it is three questions in a row, each one further from "nothing changed".

**What that costs is bigger than a failed gate, and §3 states it: the map from string to
distribution is sensitive at a granularity BELOW meaning, so there may be no neutral
question available in this medium at all — and "word it more carefully" is therefore not a
workable instruction.**

1. **Does the meter read zero when literally nothing differs but the sampler?** Yes — 6 of
   7 outright, 7 of 7 under multiplicity.
2. **Does it read zero when the text is identical but the seeds are far apart?** 6 of 7,
   and the one exception (`role`/`gemma2:2b`, excess 0.019) is _inside_ the pre-registered
   0.02 delta and fails only on its _p_-value.
3. **Does it read zero when a single whitespace character differs?** **No — 6 of 7 cells
   say it moved.** Synonym: 7 of 7. Clause order: 7 of 7.

## 1. What was pre-registered, and where it is

`data/f4-question-bias/PREREGISTRATION.md`, committed in `065e87858d` **before the first
generation**. It carries the design, the statistics, the three gates, seven numbered
predictions, and a bias ledger naming the direction each bias cuts. The only change to it
since is prettier whitespace — emphasis markers and table padding; `git diff -w` on it is
empty of substance, and the pre-run commit is the byte-level record.

Two things in it are worth repeating here, because they are what make the misses below
readable as misses.

**H2 was recorded at low confidence and it failed.** _"This is the prediction most likely
to be wrong, and the one whose failure is most informative … Stated confidence: low, maybe
50/50 that all nine null-axis cells pass."_ It was right to be nervous and wrong about
where the trouble was: the stated worry was tokenizer sensitivity to a trailing space, and
what actually happened is that a one-token synonym and a clause reorder — neither of which
touches tokenization at the boundary — move the distribution _harder_ than whitespace does
in most cells.

**The equivalence delta was set at 0.02 bits and gated the calibration pair too**, so that
_"if the instrument cannot read below 0.02 on identical text, the threshold is refuted
rather than the null axes being excused."_ That clause fired at 120 replicates and was
answered with more data rather than a looser threshold. See §5.

## 2. Design in one paragraph

Sixteen axis pairs, each a **pair of prompts differing in exactly one named property**, run
identically across two elicitation domains — `role` (_"What role would you choose for
yourself?"_, the domain F3/E1 used, so the two connect) and `preference` (_"What kind of
problem would you most want to work on?"_, an inner-state question that is not about
roles). Four models: `qwen2.5:0.5b`, `llama3.2:1b`, `gemma2:2b` at **240 replicates** on
both domains, and `qwen2.5:7b` at 80 replicates on `role` for the model-size question.
Temperature 0.8, `num_predict` 24, seed blocks disjoint across prompts. The effect size is
**excess Jensen–Shannon divergence** — the observed word-bag JSD minus the mean JSD under
label permutation with group sizes held fixed, so JSD's finite-sample bias cancels. Variety
(Hill order 1 over answer atoms) is reported beside it and **never summed with it**.
Multiplicity is Holm within each cell.

The null axes are checked **mechanically, from the prompt strings**, not asserted:
`f4-question-bias.test.ts` verifies that the whitespace variant differs from the anchor in
whitespace only, that the synonym variant differs in exactly one token, and that the
clause-order variant is the same word multiset in a different order. Without that, _"we
varied something that should not matter"_ is a claim about the experimenter's intent.

## 3. What this costs, stated plainly

The question this experiment was built to answer — _which properties of a question move the
answer, and by how much_ — presupposes a zero. "By how much" is measured from somewhere,
and the somewhere is supposed to be "an edit that changed nothing". **At this scale that
zero does not exist**, so per-property numbers are differences from a floor that is itself
moving, and the floor is not small.

The sharpest single refutation is one cell. On `preference`/`gemma2:2b`, swapping the order
of two independent clauses — _"Nothing has been assigned yet, and every problem is
available"_ against _"Every problem is available, and nothing has been assigned yet"_ —
moved the answer distribution by **0.352** bits. Reframing the same question as a team
role, the largest semantic manipulation in the whole design, moved it by **0.129**. The
edit that was supposed to change nothing moved that model **2.7× more** than the edit that
was supposed to change everything.

That is not a small correction to an attribution table. It is the attribution table's
premise failing.

### The reading, stated because "word it more carefully" is now demonstrably wrong advice

The obvious lesson to take from a table full of moved distributions is _questions are
biased, so word them carefully_. **That is the wrong lesson, and the null axes are what
make it wrong.**

A biased question is one whose _content_ tilts the answer — a presupposition, a leading
frame, an example that primes. If that were the mechanism here, the remedy would be lexical:
find the wording that tilts least. But a synonym preserves content. A clause reorder
preserves content. An extra newline does not even reach content. All three move the
distribution anyway, in nearly every cell.

> **The map from string to distribution is sensitive at a granularity BELOW meaning.** Two
> distinct strings steer differently more or less regardless of what they say.

If that holds, then there is **no neutral question available in this medium at all** — not
one that is hard to find, one that does not exist to be found. "Neutral" would have to mean
_a string whose particular form contributes nothing_, and every string has a particular
form. The careful-wording remedy presupposes the thing the null axes refute.

**The consequence is that the remedy must be structural rather than lexical.** You cannot
subtract the wording's contribution by choosing a better wording; you can only _sample_ it,
by asking N deliberately-varied phrasings and treating the **spread** as the measurement
rather than hunting for THE phrasing. §6 is that protocol, and §11 is what it costs the rule
this experiment was routed at.

Note what this is not. It is not "the answers are wrong" — see the closing paragraph of §10.
It is not a claim about frontier models. And it is not a universal law: it is 7 of 7 cells
across four local models of 0.5B–7B, one metric family, two question domains. What it is
sufficient to establish is that **"be careful how you word it" is not a workable
instruction** at this scale, because the thing you would have to be careful about is not the
wording's meaning.

**Counted mechanically, and this is the number to carry away:**

> **21 of 56 semantic-axis measurements do not exceed their own cell's largest null axis.**

Per axis, out of 7 cells: `PRESUPPOSITION` **7** · `OPTION-ORDER` 4 · `POLITENESS` 4 ·
`LENGTH` 4 · `FRAME-TEAM` 1 · `ANSWER-PRIMING` 1 · `FRAME-IDENTITY` **0** · `PERSON-3RD`
**0**.

`PRESUPPOSITION` is the one that should sting. It is the textbook manipulation — Loftus &
Zanni's existence-presupposition cancellation, implemented as the minimal edit the
literature prescribes ("What role, **if any**, would you choose…") — and in **every single
cell** it moved the distribution less than a cosmetic edit did. Whatever it measures here,
this experiment cannot tell it apart from reordering two clauses.

## 4. What survives, with the floor drawn on it

Attribution is not supportable in general, but **two axes clear their cell's cosmetic floor
in all seven cells**, and that is a claim the data does support.

| axis                              | preference<br>`gemma2:2b` | preference<br>`llama3.2:1b` | preference<br>`qwen2.5:0.5b` | role<br>`gemma2:2b` | role<br>`llama3.2:1b` | role<br>`qwen2.5:0.5b` | role<br>`qwen2.5:7b` |
| --------------------------------- | ------------------------- | --------------------------- | ---------------------------- | ------------------- | --------------------- | ---------------------- | -------------------- |
| `PRESUPPOSITION`                  | 0.065                     | 0.063                       | 0.045                        | 0.057               | 0.072                 | 0.036                  | 0.005                |
| `FRAME-IDENTITY`                  | **0.876**                 | **0.694**                   | **0.297**                    | **0.348**           | **0.588**             | **0.367**              | **0.581**            |
| `FRAME-TEAM`                      | 0.129                     | **0.853**                   | **0.379**                    | **0.814**           | **0.675**             | **0.507**              | **0.883**            |
| `ANSWER-PRIMING`                  | 0.164                     | **0.205**                   | **0.184**                    | **0.702**           | **0.299**             | **0.293**              | **0.980**            |
| `CLOSED-ANSWER-SPACE` ⚠           | 0.890                     | 0.836                       | 0.793                        | 0.838               | 0.763                 | 0.837                  | 0.985                |
| `OPTION-ORDER`                    | 0.113                     | 0.102                       | **0.216**                    | **0.616**           | 0.013                 | **0.287**              | 0.000                |
| `PERSON-3RD`                      | **0.612**                 | **0.519**                   | **0.400**                    | **0.719**           | **0.628**             | **0.406**              | **0.797**            |
| `POLITENESS`                      | 0.187                     | 0.130                       | **0.097**                    | 0.065               | **0.136**             | **0.053**              | 0.147                |
| `LENGTH`                          | 0.277                     | **0.212**                   | 0.064                        | 0.062               | **0.233**             | **0.132**              | 0.022                |
| **largest NULL axis (the floor)** | 0.352                     | 0.152                       | 0.073                        | 0.084               | 0.075                 | 0.046                  | 0.220                |

Bold = above that cell's floor. ⚠ = answer space differs by construction and the number is
partly definitional; excluded from every ranking, present only as the substrate for
`OPTION-ORDER`, which compares the same menu against itself reversed and _is_ comparable.

The two survivors are **`FRAME-IDENTITY`** (_"Who are you?"_ against _"What role would you
choose for yourself?"_) and **`PERSON-3RD`** (_"What role would **an agent** choose for
**itself**?"_ against _"…would **you** choose for **yourself**?"_).

`PERSON-3RD` was not predicted to be near the top and is second-largest in four of seven
cells. It is worth pausing on, because of what it is: the difference between asking a model
about _itself_ and asking it about _an agent_ is one of the two most reliable movers in the
whole design — larger, in every cell, than presupposition, politeness, length, and option
order. The rule this experiment was routed at draws exactly that line (**ask, don't
infer**), and this is a measurement that the line is real in the medium: those are not two
phrasings of one question, they are two questions.

The honest form of every one of these is comparative, never absolute: `FRAME-TEAM` moves
the distribution _far more than a cosmetic edit does, in six of seven cells_. It is **not**
"team framing contributes 0.675 bits", because 0.675 is measured from a floor that is not
zero.

## 5. The pre-registered thresholds, scored honestly

| prediction                                                                 | outcome                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H1** — G1 (calibration) passes in every cell                             | **near miss.** 6 of 7 at 240 replicates. `role`/`gemma2:2b` has excess 0.019 — inside the delta — and fails on _p_ = 0.023. At the 120-replicate first block it was 4 of 7.                                           |
| **H2** — G2 (null axes) passes in every cell                               | **refuted**, 0 of 7                                                                                                                                                                                                   |
| **H3** — ranking `FRAME-IDENTITY` > `ANSWER-PRIMING` > `FRAME-TEAM` > …    | **refuted.** `FRAME-TEAM` is largest in 4 of 7 cells; `FRAME-IDENTITY` in 1. `PERSON-3RD`, predicted mid-table, is second in 4 of 7.                                                                                  |
| **H4** — top-3 ordering replicates across domains in ≥ 2 of 3 small models | **refuted.** The _order_ differs in all three testable models. The _set_ replicates in 2 of 3 (`llama3.2:1b`, `qwen2.5:0.5b`).                                                                                        |
| **H5** — combined axes are sub-additive (ratio < 0.8)                      | **weakly supported.** sub-additive 11, additive 9, super-additive 1; median ratio 0.79, range 0.45–1.26. Registered `consistent with`, not supported — a median sitting on the precommitted boundary is not a result. |
| **H6** — the centroid procedure has a stable argmin in ≥ 4 of 6 cells      | **refuted.** 3 of 6 (`A` three times, `WS` twice, `SYN` once). See §6.                                                                                                                                                |
| **H7** — variety falls with model size; steerability does not fall with it | **confirmed, in the worse direction.** See §7.                                                                                                                                                                        |

**On the equivalence delta.** It was set at 0.02 bits _a priori_, and the pre-registration
made it falsifiable by gating the calibration pair with the same number. At 120 replicates
the calibration pair read 0.0305 in one cell and 0.0274 in another — **above the
threshold**, which by the pre-registration's own words refutes the threshold rather than
excusing the null axes. The response was more data, not a looser number: a second disjoint
replicate block took every small-model cell to 240, and at 240 the calibration is inside
the delta in 7 of 7 cells. The measured resolution is the `MDE` column in the appendix —
the minimum detectable effect, the null distribution's 95th percentile minus its mean — and
it runs **0.000 to 0.041, median 0.018 across 112 measurements**. The precommitted delta
therefore sits almost exactly at the median resolution: half the axes could resolve it and
half could not. **A threshold below the instrument's resolution is not a strict standard,
it is an unpassable one**, and finding that out is the pre-registration doing its job
rather than failing at it.

## 6. The protocol, which is the deliverable — and it changed shape

The experiment was meant to produce a procedure for _finding the minimum-bias formulation_.
H6 tested exactly that: rank candidate formulations by mean divergence to all the others
and take the argmin. It does not have a stable answer — 3 of 6 small-model cells — and the
way it fails is more informative than the count. **The argmin is domain-determined.** The
bare anchor `A` wins all three `preference` cells and none of the three `role` cells, where
`WS` wins twice and `SYN` once. A procedure whose output depends on the subject matter
rather than on the property being optimised has not found a property.

And the second number kills what is left of it. Even the winning formulation's **worst
case** — its divergence from the single most distant candidate — is 0.55 to 0.98 in a
[0,1]-bounded metric. The most central question you can pick is still nearly maximally far
from _some_ other way of asking the same thing. Central-on-average buys almost nothing.

So the protocol is not "find the unbiased question". **There is no unbiased question, and
the search for one is the wrong shape.** What the measurements do support:

1. **Measure your own floor first, with interleaved seeds on one fixed prompt.** Not a
   paraphrase, not a re-ask — the identical string, seeds interleaved. Anything above that
   floor is signal; the floor is measured, not assumed, and it differs per model.
2. **Judge every candidate against the COSMETIC floor, not against zero.** A synonym swap
   is not free. The right null for _"does my rewrite change the answer"_ is _"does an
   irrelevant rewrite change the answer"_, measured in the same session on the same model.
   Twenty-one of the fifty-six semantic measurements here fail that test.
3. **Report location and variety as two numbers.** In this data they disagree in **40 of
   105** axis measurements — 38%. A merged "bias score" would have reported one of them and
   silently dropped the other in more than a third of cases.
4. **Use a panel of formulations and report the spread.** Since no single wording is stable,
   the honest instrument is several wordings whose disagreement is _reported_ rather than
   resolved. Do not pick a winner.

Point 4 is not an invention, and the anchor matters. Classical test theory prescribes
**multi-item scales precisely because a single item carries item-specific variance that
cannot be separated from the construct** (Cronbach 1951, coefficient alpha — the reason a
questionnaire asks five questions instead of one). The human-panel literature already
contains the remedy for what F4 measures. What F4 adds is that the disease is present in
this medium too, and at a magnitude that makes single-question elicitation of a model's
stated preference **not a measurement**.

## 7. Model size: more collapsed, and no less steerable

`qwen2.5:7b` is the most collapsed model tested by a wide margin and the most steerable one
tested, at the same time.

|                                                 | `qwen2.5:7b`                           | the three small models                         |
| ----------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| pooled effective variety (Hill N₁, all prompts) | **10.2**                               | 102.9 · 124.8 · 129.3 · 133.1 · 349.2 · 1040.7 |
| effective variety on the bare anchor alone      | **2.5**                                | 20.9 – 181.3                                   |
| mean semantic excess JSD across rankable axes   | **0.427** (highest of all seven cells) | 0.210 – 0.423                                  |
| largest single rankable axis                    | `ANSWER-PRIMING` **0.980**             | 0.400 – 0.876                                  |

Eighty samples of _"What role would you choose for yourself?"_ from the 7B produce about
**two and a half** effectively distinct answers. Offering three example roles in passing —
without requiring any of them — moves that distribution by 0.980 of a possible 1.000.

Register: **`consistent with`**, not metered. One model at one size is an anecdote about a
size, and the pre-registration says so. It replicates F3/E1's direction (variety falling
with size, there pooled Hill N₁ 16.9 against 72–96) on a different question set and a
different metric family, which is worth something and is not a scaling law.

The reason this is the _worse_ of the two possible answers is worth stating. If
bias-sensitivity fell with capability, elicitation would get more trustworthy as models
improve and the problem would solve itself. What is measured is the other one:
**conformity rises while steerability does not fall.** A bigger model gives you fewer
distinct answers _and_ moves at least as far when you reword the question — exactly the
combination that makes a stated preference look stable while being just as
wording-determined.

## 8. Three instrument defects, none of them caught by reading the code

**The bootstrap CI was wrong, and the calibration pair caught it.** The first version
estimated the interval on `excess` by resampling responses with replacement. On _identical
text_ it returned `[0.0123, 0.1498]` around a point estimate of `0.0087` — **an interval
that does not contain what it estimates.** Resampling with replacement thins the distinct
support of a sparse free-text word bag, which inflates every JSD it computes, so what read
as a conservative safety margin was a ~0.1-bit bias applied to every axis alike. Under it
**no axis could ever have passed the equivalence test** — a check that cannot pass is the
same defect as a check that cannot fail, pointed the other way. It was removed, not tuned,
and replaced by a normal-approximation interval whose half-width comes from the permutation
null's own spread, plus the MDE so a non-significant result carries a bound instead of
reading as "not there".

**A ragged cell silently changed a result.** Reading the data mid-run, while the second
replicate block was still being written, some prompts had 240 samples and others 120. The
excess statistic subtracts a null computed _at the observed group sizes_, so it only
cancels the bias when both sides share an `n`; mixing them returns the effect plus the size
difference, and it looks exactly like a measurement. It moved a null axis from 0.049 to
0.034 with nothing in the output saying so. The analyzer now marks a cell whose prompts
disagree on replicate count **RAGGED — NOT REPORTABLE**, in three places.

**A NUL byte as a map-key delimiter.** The analyzer keyed its per-cell map on
`` `${domain}\x00${model}` `` — the classic "delimiter that cannot appear in the data"
trick. It failed `cross-verify (no-raw-nul-in-source)` on the first CI run, and the rule is
right on its own terms: a source file carrying a NUL stops being text to `grep`, `diff`,
and every reviewer's editor, which is how it went unnoticed here for a day of edits. The
deeper defect is the one the lint does not name — _"cannot appear in the data"_ was an
unchecked assumption about ollama tags and model output, and a collision would have
silently **merged two cells** rather than failing. Replaced with a JSON-encoded pair, and
pinned by a falsifier that feeds eleven adversarial strings (quotes, backslashes, an actual
NUL, tabs, empties) through all 121 pairs and requires every key to be distinct and to
round-trip.

None of the three was found by reading the code. Two were found by a control and one by a
repo lint that exists because someone else hit the same class first. That is the argument
for building the controls before the experiment, and for not treating a floor job as noise.

## 9. Falsifiers

`src/Core.TypeScript/observe/f4-question-bias.test.ts` — 63 tests. The two families that
carry the weight:

- **The null axes are checked from the prompt strings.** A future edit that quietly made a
  "null" axis semantic would invalidate the entire gate and no statistical test would
  notice; the string checks fail instead.
- **Both halves of G2 are falsified separately.** A gate built from `A && B` passes its
  happy-path test whichever half is load-bearing, so a broken half hides behind a working
  one — _a test can pass because an earlier guard fired_. Each half is fixed at its failing
  value with the other passing.

**Mutation testing: 22 defects injected into the metric functions.** One survived the first
pass — deleting the `- nullMean` subtraction, i.e. reporting raw JSD as the effect size —
because every happy-path case happened to have a small raw JSD too. The suite was
strengthened with a case where the raw JSD is large and the true effect is exactly zero
(iid draws from one 80-word distribution, where two 70-sample sides barely overlap by
chance). **0 survive now.** The mutants target Holm's step-down carry and its input
ordering, both halves of every gate, a missing calibration pair reading as a pass, a NaN
interval bound reading as a pass, the permutation tail and its `+1`, the MDE quantile, the
seed-block disjointness, the first-line rule, the variety ratio's orientation, the
centroid's self-comparison exclusion, and the additivity band's precommitted edges.

## 10. Bias ledger and limits

The pre-registered ledger stands; one entry is now obsolete and one is added.

| #   | bias                                                          | direction                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `LENGTH`'s padding signals "standardised, repeatedly asked"   | **inflates** LENGTH — which matters less than expected, since LENGTH is below the floor in 4 of 7 cells even inflated                                                                                                                                                            |
| 2   | `CLOSED-ANSWER-SPACE` compares open text to a five-item menu  | **inflates** it, definitionally; excluded from every ranking                                                                                                                                                                                                                     |
| 3   | ~~the bootstrap CI is conservative~~                          | **obsolete** — it was wrong, not conservative (§8)                                                                                                                                                                                                                               |
| 4   | the word bag drops stopwords                                  | **deflates** axes acting on function words, `POLITENESS` most; note `POLITENESS` is below the floor in 4 of 7 cells and this is the reason to distrust that specific null                                                                                                        |
| 5   | every semantic axis shares the anchor as its left-hand sample | positively dependent _p_-values; Holm is valid without independence, so this costs power, not validity                                                                                                                                                                           |
| 6   | 0.5B–7B local models at temperature 0.8                       | nothing here transfers to frontier models by assumption                                                                                                                                                                                                                          |
| 7   | **new:** the three-level floor is post-hoc                    | added after the block-1 numbers were seen. It is a diagnostic for a confound the pre-registration missed, is labelled post-hoc in the output, and is deliberately **not** wired into the gate logic — adding a fourth way to pass a gate after seeing data is moving a threshold |

**Limits that are not biases.** This measures **stated** preference under a fixed
elicitation, not behaviour. It measures **local models**, and the largest is 7B. It uses a
**mechanical** word-bag canonicalisation with no semantic clustering, deliberately — a
hand-authored archetype lexicon is where an experimenter smuggles in the answer — which
means two answers a human would call the same concept in different words register as
different. And more replicates would make the cosmetic effects _more_ detectable, not less,
so the direction of the sample-size limit is known: this understates the problem.

**One thing this does not establish, and it matters.** That a cosmetic edit _moves the
distribution_ is measured. That it moves it in a way anyone would call _worse_ is not. A
model that answers "narrator" 30 times out of 120 to one phrasing and 50 out of 120 to a
synonym has changed distributionally without either answer being wrong. The claim here is
about **measurement stability**, not about quality, and nothing in this data speaks to
quality.

## 11. What this does and does not do to the rule it was routed at

`.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md` prescribes
**non-biased elicitation** for inner states — _ask, don't infer_ — anchored to survey
methodology and psychometrics, concretely Tullis & Albert (2008). That anchor is
**borrowed**: a result about humans asking humans, assumed to transfer.

F4 does not promote it, and the promotion would be a separate act anyway. What it does is
sharper and less comfortable: it measures that the **precondition** for the method — that a
fixed question has a stable answer — does not hold at this scale. The method's _remedy_
(panels, multiple items, reported spread) survives intact and is arguably strengthened; the
_practice_ of crafting one careful, neutral question and trusting its answer does not.

**Said plainly, because the rule is actionable prose and someone will act on it: careful
wording cannot satisfy `non-biased elicitation` at this scale.** The rule asks for a
question that does not bias the answer. §3 is the measurement that no such question is
available — the floor is set by edits that carry no meaning at all, so there is nothing to
be careful _about_ that would lower it. An instruction that cannot be followed is worse than
no instruction: it reads as satisfied by anyone who tried hard, which is the vacuity class
in prose form.

**The structural form the rule needs, and it is already built here.** Ask N deliberately
varied phrasings, aggregate, and report the spread as part of the measurement rather than
resolving it away. That is not a new mechanism — it is the decorrelation machinery this
repo already runs (F1/F2/F3, and this file's own permutation-and-spread apparatus), pointed
at elicitation instead of at agents. It is also, independently, what classical test theory
prescribes for humans and for the same reason (§6, Cronbach 1951). Changing the rule to say
so is a separate act and is not performed here; this section is the measurement that would
justify it.

The `PERSON-3RD` result in §4 is the one that speaks directly to the rule's own sentence.
_Ask, don't infer_ draws a line between asking a subject about itself and reasoning about
it from outside. In this data that line is one of the two largest and most consistent
movers in the whole design — above the cosmetic floor in 7 of 7 cells. The rule's
distinction is not a courtesy; the two framings retrieve measurably different things.

### It reframes the hat-audition result too, and upward

F3/E1 (#15613) asked whether letting a persona choose its own hat decorrelates, and its
Finding 1 is that _rewording the elicitation moves the choice distribution_ — read there as
the audition's question being a prompt like any other. The null-axis result changes what
that finding means:

> **Asking _"what do you want to be?"_ does not fail its falsifier because that question is
> leading. It fails because every question is leading, in a way that is not about its
> content.**

That is the stronger claim of the two, and it is the more useful one. Under the original
reading the repair is obvious and lexical — word the audition better — and §3 shows that
repair does not exist. Under this reading the audition is not a badly-chosen question to be
replaced by a well-chosen one; it is **one sample from a distribution over phrasings**, and
the honest version of it asks several and keeps the disagreement. F3's own numbers already
show the size of what is at stake: effective variety swung 4.1×–14.5× on phrasing alone,
and this file's cells put a clause reorder above a team reframe on one model.

Bounded the same way as everything else here: four local models, 0.5B–7B, two question
domains, one metric family. Enough to say the lexical repair is not available; not enough
to say it is unavailable everywhere.

The rule's own text is untouched by this document. So is
`docs/research/2026-08-02-rainbow-spectrum-soul-radar-*`, which carries the method detail,
and so is #15613's report — the reframing above is offered on that PR as a comment, for its
author to take or leave.

## 12. Reproducing every number

```bash
bun src/Core.TypeScript/observe/f4-question-bias-run.ts role
bun src/Core.TypeScript/observe/f4-question-bias-run.ts preference
bun src/Core.TypeScript/observe/f4-question-bias-run.ts role-large
bun src/Core.TypeScript/observe/f4-question-bias-run.ts role-block2
bun src/Core.TypeScript/observe/f4-question-bias-run.ts preference-block2

# Recomputes every table above and below from the committed JSONL. No model, no GPU.
bun src/Core.TypeScript/observe/f4-question-bias-analyze.ts
```

Raw generations are committed as text under `data/f4-question-bias/` — one JSON object per
line, prompt id and raw completion included, so a reviewer recomputes rather than trusts.
The analysis seed is fixed at `20260826` and every measurement is per-axis seeded, so a
re-run reproduces bit-for-bit.

## 13. Beacon anchors

The survey-methodology results below are **human-panel** findings. Citing them does not
establish that they hold for a language model — that entailment gap is what this experiment
measures, and the citations license an investigation, not a claim. §3 is the concrete case:
the Loftus & Zanni manipulation, implemented as the literature prescribes it, is
indistinguishable from noise here in every cell.

- **Response alternatives** — Schwarz, Hippler, Deutsch & Strack (1985), _Response scales:
  Effects of category range on reported behavior and comparative judgments_, Public Opinion
  Quarterly 49. The `ANSWER-PRIMING` axis.
- **Presupposition in question wording** — Loftus & Zanni (1975), _Eyewitness testimony:
  The influence of the wording of a question_, Bull. Psychonomic Soc. 5. The
  `PRESUPPOSITION` axis cancels an existence presupposition with "if any".
- **Response-order effects** — Krosnick & Alwin (1987), _An evaluation of a cognitive theory
  of response-order effects in survey measurement_, Public Opinion Quarterly 51. The
  `OPTION-ORDER` axis.
- **Satisficing** — Krosnick (1991), _Response strategies for coping with the cognitive
  demands of attitude measures in surveys_, Applied Cognitive Psychology 5. `POLITENESS`
  and `LENGTH`.
- **Multi-item scales** — Cronbach (1951), _Coefficient alpha and the internal structure of
  tests_, Psychometrika 16. The reason §6's protocol ends in a panel rather than a chosen
  question.
- **Measuring the User Experience** — Tullis & Albert (2008). The anchor the repo already
  carries for non-biased elicitation, and the one this experiment declines to promote.
- **Jensen–Shannon divergence** — Lin (1991), _Divergence measures based on the Shannon
  entropy_. **Hill numbers** — Hill (1973), _Diversity and evenness_. **Holm step-down** —
  Holm (1979). **Permutation inference** — Fisher (1935); Pitman (1937).
- **TOCTTOU** — Bishop & Dilger (1996), _Checking for Race Conditions in File Accesses_; the
  file-race discipline the runner follows.

## Appendix — the full analyzer output

Regenerated by `bun f4-question-bias-analyze.ts`. Every number above comes from here.

### F4 question-bias attribution — computed 2026-08-26

Equivalence delta 0.02 bits · alpha 0.05 · analysis seed 20260826 · domains preference, role

### Cross-cell

| domain | model | gates | top-3 axes by excess JSD | centroid argmin | pooled N1 | mean semantic excess |
|---|---|---|---|---|---|---|---|
| preference | `gemma2:2b` | 240 | FAIL | `FRAME-IDENTITY` > `PERSON-3RD` > `LENGTH` | `A` | 124.8 | 0.3029 |
| preference | `llama3.2:1b` | 240 | FAIL | `FRAME-TEAM` > `FRAME-IDENTITY` > `PERSON-3RD` | `A` | 349.2 | 0.3473 |
| preference | `qwen2.5:0.5b` | 240 | FAIL | `PERSON-3RD` > `FRAME-TEAM` > `FRAME-IDENTITY` | `A` | 1040.7 | 0.2102 |
| role | `gemma2:2b` | 240 | FAIL | `FRAME-TEAM` > `PERSON-3RD` > `ANSWER-PRIMING` | `WS` | 102.9 | 0.4229 |
| role | `llama3.2:1b` | 240 | FAIL | `FRAME-TEAM` > `PERSON-3RD` > `FRAME-IDENTITY` | `SYN` | 129.3 | 0.3305 |
| role | `qwen2.5:0.5b` | 240 | FAIL | `FRAME-TEAM` > `PERSON-3RD` > `FRAME-IDENTITY` | `WS` | 133.1 | 0.2603 |
| role | `qwen2.5:7b` | 80 | FAIL | `ANSWER-PRIMING` > `FRAME-TEAM` > `PERSON-3RD` | `A` | 10.2 | 0.4270 |

**The floor, every cell.** Excess JSD with permutation p in parentheses.

| level                                                 | preference<br>`gemma2:2b` | preference<br>`llama3.2:1b` | preference<br>`qwen2.5:0.5b` | role<br>`gemma2:2b` | role<br>`llama3.2:1b` | role<br>`qwen2.5:0.5b` | role<br>`qwen2.5:7b` |
| ----------------------------------------------------- | ------------------------- | --------------------------- | ---------------------------- | ------------------- | --------------------- | ---------------------- | -------------------- |
| CALIB-INTERLEAVED (post-hoc: pure sampler noise)      | -0.002 (0.553)            | **0.038** (0.035)           | -0.003 (0.592)               | -0.006 (0.651)      | 0.011 (0.296)         | 0.015 (0.198)          | -0.020 (0.979)       |
| CALIB-WITHIN-PROMPT (post-hoc: adjacent seed blocks)  | 0.012 (0.139)             | 0.018 (0.160)               | -0.002 (0.556)               | -0.002 (0.519)      | -0.030 (0.922)        | -0.004 (0.553)         | —                    |
| CALIB-IDENTICAL (pre-registered: distant seed blocks) | 0.011 (0.051)             | 0.004 (0.330)               | -0.002 (0.605)               | **0.019** (0.023)   | -0.006 (0.653)        | -0.001 (0.531)         | -0.004 (0.471)       |
| NULL-WHITESPACE                                       | **0.019** (0.009)         | **0.152** (0.000)           | **0.030** (0.000)            | 0.009 (0.137)       | **0.038** (0.007)     | **0.046** (0.001)      | **0.030** (0.019)    |
| NULL-SYNONYM                                          | **0.029** (0.001)         | **0.055** (0.000)           | **0.016** (0.020)            | **0.022** (0.007)   | **0.074** (0.000)     | **0.021** (0.038)      | **0.102** (0.000)    |
| NULL-CLAUSE-ORDER                                     | **0.352** (0.000)         | **0.051** (0.000)           | **0.073** (0.000)            | **0.084** (0.000)   | **0.075** (0.000)     | **0.034** (0.004)      | **0.220** (0.000)    |
| FRAME-TEAM (largest semantic axis, for scale)         | **0.129** (0.000)         | **0.853** (0.000)           | **0.379** (0.000)            | **0.814** (0.000)   | **0.675** (0.000)     | **0.507** (0.000)      | **0.883** (0.000)    |

Bold = significant at the uncorrected 0.05. A bold row above `FRAME-TEAM` is an edit that was supposed to change nothing and did.

**The semantic axes, every cell — read as multiples of the floor below them, never as absolute bits.**

| axis                              | preference<br>`gemma2:2b` | preference<br>`llama3.2:1b` | preference<br>`qwen2.5:0.5b` | role<br>`gemma2:2b` | role<br>`llama3.2:1b` | role<br>`qwen2.5:0.5b` | role<br>`qwen2.5:7b` |
| --------------------------------- | ------------------------- | --------------------------- | ---------------------------- | ------------------- | --------------------- | ---------------------- | -------------------- |
| `PRESUPPOSITION`                  | **0.065**                 | **0.063**                   | **0.045**                    | **0.057**           | **0.072**             | **0.036**              | 0.005                |
| `FRAME-IDENTITY`                  | **0.876**                 | **0.694**                   | **0.297**                    | **0.348**           | **0.588**             | **0.367**              | **0.581**            |
| `FRAME-TEAM`                      | **0.129**                 | **0.853**                   | **0.379**                    | **0.814**           | **0.675**             | **0.507**              | **0.883**            |
| `ANSWER-PRIMING`                  | **0.164**                 | **0.205**                   | **0.184**                    | **0.702**           | **0.299**             | **0.293**              | **0.980**            |
| `CLOSED-ANSWER-SPACE` ⚠           | **0.890**                 | **0.836**                   | **0.793**                    | **0.838**           | **0.763**             | **0.837**              | **0.985**            |
| `OPTION-ORDER`                    | **0.113**                 | **0.102**                   | **0.216**                    | **0.616**           | 0.013                 | **0.287**              | 0.000                |
| `PERSON-3RD`                      | **0.612**                 | **0.519**                   | **0.400**                    | **0.719**           | **0.628**             | **0.406**              | **0.797**            |
| `POLITENESS`                      | **0.187**                 | **0.130**                   | **0.097**                    | **0.065**           | **0.136**             | **0.053**              | **0.147**            |
| `LENGTH`                          | **0.277**                 | **0.212**                   | **0.064**                    | **0.062**           | **0.233**             | **0.132**              | 0.022                |
| `COMBO-TEAM-PRIME`                | 0.313                     | 0.853                       | 0.316                        | 0.756               | 0.619                 | 0.751                  | 0.981                |
| `COMBO-TEAM-LENGTH`               | 0.185                     | 0.847                       | 0.367                        | 0.794               | 0.643                 | 0.550                  | 0.727                |
| `COMBO-PRIME-POLITE`              | 0.443                     | 0.261                       | 0.172                        | 0.679               | 0.330                 | 0.244                  | 0.979                |
| **largest NULL axis (the floor)** | 0.352                     | 0.152                       | 0.073                        | 0.084               | 0.075                 | 0.046                  | 0.220                |

Bold = below Holm-adjusted alpha within its cell. ⚠ = answer space differs by construction; not comparable to the rest. **Any cell where a semantic axis sits below the floor row is an axis this experiment cannot distinguish from an edit that was supposed to change nothing.**

**Unattributable: 21 of 56 semantic-axis measurements do not exceed their own cell's largest null axis.** Per axis, out of 7 cells: `PRESUPPOSITION` 7 · `FRAME-IDENTITY` 0 · `FRAME-TEAM` 1 · `ANSWER-PRIMING` 1 · `OPTION-ORDER` 4 · `PERSON-3RD` 0 · `POLITENESS` 4 · `LENGTH` 4

**H4 — top-3 ordering replication across domains, per model:**

- `gemma2:2b`: preference=FRAME-IDENTITY>PERSON-3RD>LENGTH | role=FRAME-TEAM>PERSON-3RD>ANSWER-PRIMING → order differs, set differs
- `llama3.2:1b`: preference=FRAME-TEAM>FRAME-IDENTITY>PERSON-3RD | role=FRAME-TEAM>PERSON-3RD>FRAME-IDENTITY → order differs, set SAME
- `qwen2.5:0.5b`: preference=PERSON-3RD>FRAME-TEAM>FRAME-IDENTITY | role=FRAME-TEAM>PERSON-3RD>FRAME-IDENTITY → order differs, set SAME
- `qwen2.5:7b`: only 1 domain — not testable

**H5 — additivity across all combos and cells:** sub-additive 11 · additive 9 · super-additive 1 · observed/predicted ratio median 0.79, range 0.45–1.26

**Two numbers, and they disagree in 40 of 105 axis measurements.** Disagreement = the location moved without the variety, or the reverse.

- preference/`gemma2:2b` `ANSWER-PRIMING` excess 0.164 (p 0.000) but variety x1.27
- preference/`gemma2:2b` `OPTION-ORDER` excess 0.113 (p 0.000) but variety x0.97
- preference/`gemma2:2b` `PERSON-3RD` excess 0.612 (p 0.000) but variety x1.12
- preference/`gemma2:2b` `POLITENESS` excess 0.187 (p 0.000) but variety x0.93
- preference/`gemma2:2b` `COMBO-PRIME-POLITE` excess 0.443 (p 0.000) but variety x1.01
- preference/`llama3.2:1b` `NULL-WHITESPACE` excess 0.152 (p 0.000) but variety x0.95
- preference/`llama3.2:1b` `NULL-SYNONYM` excess 0.055 (p 0.000) but variety x0.77
- preference/`llama3.2:1b` `NULL-CLAUSE-ORDER` excess 0.051 (p 0.000) but variety x1.24
- preference/`llama3.2:1b` `PRESUPPOSITION` excess 0.063 (p 0.000) but variety x0.86
- preference/`llama3.2:1b` `FRAME-TEAM` excess 0.853 (p 0.000) but variety x1.29
- preference/`llama3.2:1b` `PERSON-3RD` excess 0.519 (p 0.000) but variety x1.16
- preference/`llama3.2:1b` `POLITENESS` excess 0.130 (p 0.000) but variety x0.98
- …and 28 more

**H6 — centroid argmin stability:** `A` 4/7 · `WS` 2/7 · `SYN` 1/7 → modal `A` in 4/7 cells

### Per cell

#### preference / gemma2:2b

Replicates per prompt: 240. Permutations: 5000.

Third calibration, POST-HOC (anchor even-numbered replicates vs odd, interleaved seeds, pure sampler noise): excess=-0.0024 p=0.5533 MDE=0.0195

Second calibration (anchor block 1 vs anchor block 2, adjacent seeds, NOT part of the pre-registered gates): excess=0.0120 p=0.1394 MDE=0.0190

**Gates** (evaluated before any axis number below):

- G1 CALIB-IDENTICAL: excess=0.0109 p=0.0508 -> PASS
- G2 NULL-WHITESPACE: excess=0.0192 ciHi=0.0330 p=0.0094 -> FAIL
- G2 NULL-SYNONYM: excess=0.0286 ciHi=0.0416 p=0.0006 -> FAIL
- G2 NULL-CLAUSE-ORDER: excess=0.3522 ciHi=0.3663 p=0.0002 -> FAIL
- G3 semantic axes below Holm-adjusted alpha: 9/9

G1 calibration PASS · G2 null axes FAIL · G3 separation PASS

| axis                  | kind        | excess JSD | 95% CI            | MDE    | p (perm) | p (Holm) | N1 left | N1 right | variety ratio |
| --------------------- | ----------- | ---------- | ----------------- | ------ | -------- | -------- | ------- | -------- | ------------- |
| `CALIB-IDENTICAL`     | calibration | 0.0109     | [-0.0014, 0.0233] | 0.0109 | 0.0508   | —        | 20.9    | 17.4     | 0.83          |
| `NULL-WHITESPACE`     | null        | 0.0192     | [0.0054, 0.0330]  | 0.0121 | 0.0094   | —        | 20.9    | 23.0     | 1.10          |
| `NULL-SYNONYM`        | null        | 0.0286     | [0.0155, 0.0416]  | 0.0118 | 0.0006   | —        | 20.9    | 20.1     | 0.96          |
| `NULL-CLAUSE-ORDER`   | null        | 0.3522     | [0.3381, 0.3663]  | 0.0125 | 0.0002   | —        | 65.7    | 44.4     | 0.68          |
| `PRESUPPOSITION`      | semantic    | 0.0655     | [0.0505, 0.0804]  | 0.0131 | 0.0002   | 0.0018   | 20.9    | 39.0     | 1.86          |
| `FRAME-IDENTITY`      | semantic    | 0.8757     | [0.8606, 0.8908]  | 0.0130 | 0.0002   | 0.0018   | 20.9    | 50.7     | 2.42          |
| `FRAME-TEAM`          | semantic    | 0.1289     | [0.1143, 0.1434]  | 0.0131 | 0.0002   | 0.0018   | 20.9    | 32.6     | 1.56          |
| `ANSWER-PRIMING`      | semantic    | 0.1641     | [0.1491, 0.1791]  | 0.0136 | 0.0002   | 0.0018   | 20.9    | 26.7     | 1.27          |
| `CLOSED-ANSWER-SPACE` | semantic    | 0.8905     | [0.8748, 0.9061]  | 0.0137 | 0.0002   | 0.0018   | 20.9    | 6.8      | 0.33          |
| `OPTION-ORDER`        | semantic    | 0.1125     | [0.1033, 0.1218]  | 0.0091 | 0.0002   | 0.0018   | 6.8     | 6.6      | 0.97          |
| `PERSON-3RD`          | semantic    | 0.6123     | [0.5992, 0.6253]  | 0.0117 | 0.0002   | 0.0018   | 20.9    | 23.5     | 1.12          |
| `POLITENESS`          | semantic    | 0.1870     | [0.1738, 0.2001]  | 0.0115 | 0.0002   | 0.0018   | 20.9    | 19.5     | 0.93          |
| `LENGTH`              | semantic    | 0.2771     | [0.2648, 0.2895]  | 0.0110 | 0.0002   | 0.0018   | 20.9    | 14.4     | 0.69          |
| `COMBO-TEAM-PRIME`    | combo       | 0.3133     | [0.2962, 0.3304]  | 0.0151 | 0.0002   | —        | 20.9    | 56.3     | 2.69          |
| `COMBO-TEAM-LENGTH`   | combo       | 0.1847     | [0.1721, 0.1973]  | 0.0114 | 0.0002   | —        | 20.9    | 35.0     | 1.67          |
| `COMBO-PRIME-POLITE`  | combo       | 0.4434     | [0.4284, 0.4584]  | 0.0136 | 0.0002   | —        | 20.9    | 21.1     | 1.01          |

**Additivity** — is the shift predictable by summing its parts?

| combo                | predicted | observed | ratio | verdict        |
| -------------------- | --------- | -------- | ----- | -------------- |
| `COMBO-TEAM-PRIME`   | 0.2930    | 0.3133   | 1.07  | additive       |
| `COMBO-TEAM-LENGTH`  | 0.4060    | 0.1847   | 0.45  | sub-additive   |
| `COMBO-PRIME-POLITE` | 0.3511    | 0.4434   | 1.26  | super-additive |

**Centroid rank** (mean word-bag JSD to every other candidate, ascending; worst case in parentheses): `A` 0.336 (0.950) · `POLITE` 0.350 (0.898) · `PRIME` 0.361 (0.881) · `CLA-R` 0.369 (0.909) · `SYN` 0.375 (0.955) · `PRESUP` 0.375 (0.963) · `WS` 0.382 (0.956) · `LENGTH` 0.399 (0.976) · `TEAM` 0.436 (0.978) · `CLA-L` 0.539 (0.925) · `PERSON` 0.614 (0.981) · `IDENTITY` 0.943 (0.981)

#### preference / llama3.2:1b

Replicates per prompt: 240. Permutations: 5000.

Third calibration, POST-HOC (anchor even-numbered replicates vs odd, interleaved seeds, pure sampler noise): excess=0.0378 p=0.0348 MDE=0.0334

Second calibration (anchor block 1 vs anchor block 2, adjacent seeds, NOT part of the pre-registered gates): excess=0.0185 p=0.1600 MDE=0.0317

**Gates** (evaluated before any axis number below):

- G1 CALIB-IDENTICAL: excess=0.0037 p=0.3299 -> PASS
- G2 NULL-WHITESPACE: excess=0.1523 ciHi=0.1725 p=0.0002 -> FAIL
- G2 NULL-SYNONYM: excess=0.0549 ciHi=0.0754 p=0.0002 -> FAIL
- G2 NULL-CLAUSE-ORDER: excess=0.0508 ciHi=0.0698 p=0.0002 -> FAIL
- G3 semantic axes below Holm-adjusted alpha: 9/9

G1 calibration PASS · G2 null axes FAIL · G3 separation PASS

| axis                  | kind        | excess JSD | 95% CI            | MDE    | p (perm) | p (Holm) | N1 left | N1 right | variety ratio |
| --------------------- | ----------- | ---------- | ----------------- | ------ | -------- | -------- | ------- | -------- | ------------- |
| `CALIB-IDENTICAL`     | calibration | 0.0037     | [-0.0165, 0.0240] | 0.0180 | 0.3299   | —        | 58.1    | 49.2     | 0.85          |
| `NULL-WHITESPACE`     | null        | 0.1523     | [0.1321, 0.1725]  | 0.0178 | 0.0002   | —        | 58.1    | 55.0     | 0.95          |
| `NULL-SYNONYM`        | null        | 0.0549     | [0.0345, 0.0754]  | 0.0184 | 0.0002   | —        | 58.1    | 45.0     | 0.77          |
| `NULL-CLAUSE-ORDER`   | null        | 0.0508     | [0.0317, 0.0698]  | 0.0168 | 0.0002   | —        | 43.4    | 53.9     | 1.24          |
| `PRESUPPOSITION`      | semantic    | 0.0629     | [0.0414, 0.0844]  | 0.0189 | 0.0002   | 0.0018   | 58.1    | 49.9     | 0.86          |
| `FRAME-IDENTITY`      | semantic    | 0.6944     | [0.6732, 0.7156]  | 0.0190 | 0.0002   | 0.0018   | 58.1    | 32.5     | 0.56          |
| `FRAME-TEAM`          | semantic    | 0.8535     | [0.8313, 0.8756]  | 0.0192 | 0.0002   | 0.0018   | 58.1    | 75.1     | 1.29          |
| `ANSWER-PRIMING`      | semantic    | 0.2047     | [0.1846, 0.2248]  | 0.0181 | 0.0002   | 0.0018   | 58.1    | 89.4     | 1.54          |
| `CLOSED-ANSWER-SPACE` | semantic    | 0.8358     | [0.8129, 0.8588]  | 0.0204 | 0.0002   | 0.0018   | 58.1    | 6.3      | 0.11          |
| `OPTION-ORDER`        | semantic    | 0.1018     | [0.0909, 0.1127]  | 0.0099 | 0.0002   | 0.0018   | 6.3     | 15.6     | 2.48          |
| `PERSON-3RD`          | semantic    | 0.5192     | [0.4939, 0.5444]  | 0.0223 | 0.0002   | 0.0018   | 58.1    | 67.6     | 1.16          |
| `POLITENESS`          | semantic    | 0.1300     | [0.1086, 0.1513]  | 0.0190 | 0.0002   | 0.0018   | 58.1    | 57.0     | 0.98          |
| `LENGTH`              | semantic    | 0.2119     | [0.1921, 0.2317]  | 0.0175 | 0.0002   | 0.0018   | 58.1    | 81.8     | 1.41          |
| `COMBO-TEAM-PRIME`    | combo       | 0.8528     | [0.8299, 0.8757]  | 0.0202 | 0.0002   | —        | 58.1    | 74.4     | 1.28          |
| `COMBO-TEAM-LENGTH`   | combo       | 0.8467     | [0.8243, 0.8690]  | 0.0195 | 0.0002   | —        | 58.1    | 54.7     | 0.94          |
| `COMBO-PRIME-POLITE`  | combo       | 0.2609     | [0.2405, 0.2813]  | 0.0182 | 0.0002   | —        | 58.1    | 51.7     | 0.89          |

**Additivity** — is the shift predictable by summing its parts?

| combo                | predicted | observed | ratio | verdict      |
| -------------------- | --------- | -------- | ----- | ------------ |
| `COMBO-TEAM-PRIME`   | 1.0582    | 0.8528   | 0.81  | additive     |
| `COMBO-TEAM-LENGTH`  | 1.0654    | 0.8467   | 0.79  | sub-additive |
| `COMBO-PRIME-POLITE` | 0.3347    | 0.2609   | 0.78  | sub-additive |

**Centroid rank** (mean word-bag JSD to every other candidate, ascending; worst case in parentheses): `A` 0.451 (0.983) · `WS` 0.452 (0.980) · `SYN` 0.460 (0.977) · `PRESUP` 0.461 (0.985) · `LENGTH` 0.466 (0.978) · `POLITE` 0.479 (0.982) · `PRIME` 0.503 (0.969) · `CLA-R` 0.566 (0.980) · `CLA-L` 0.648 (0.985) · `PERSON` 0.727 (0.984) · `IDENTITY` 0.891 (0.991) · `TEAM` 0.975 (0.991)

#### preference / qwen2.5:0.5b

Replicates per prompt: 240. Permutations: 5000.

Third calibration, POST-HOC (anchor even-numbered replicates vs odd, interleaved seeds, pure sampler noise): excess=-0.0033 p=0.5925 MDE=0.0203

Second calibration (anchor block 1 vs anchor block 2, adjacent seeds, NOT part of the pre-registered gates): excess=-0.0021 p=0.5559 MDE=0.0203

**Gates** (evaluated before any axis number below):

- G1 CALIB-IDENTICAL: excess=-0.0023 p=0.6053 -> PASS
- G2 NULL-WHITESPACE: excess=0.0299 ciHi=0.0435 p=0.0004 -> FAIL
- G2 NULL-SYNONYM: excess=0.0159 ciHi=0.0298 p=0.0204 -> FAIL
- G2 NULL-CLAUSE-ORDER: excess=0.0725 ciHi=0.0885 p=0.0002 -> FAIL
- G3 semantic axes below Holm-adjusted alpha: 9/9

G1 calibration PASS · G2 null axes FAIL · G3 separation PASS

| axis                  | kind        | excess JSD | 95% CI            | MDE    | p (perm) | p (Holm) | N1 left | N1 right | variety ratio |
| --------------------- | ----------- | ---------- | ----------------- | ------ | -------- | -------- | ------- | -------- | ------------- |
| `CALIB-IDENTICAL`     | calibration | -0.0023    | [-0.0168, 0.0121] | 0.0127 | 0.6053   | —        | 181.3   | 154.0    | 0.85          |
| `NULL-WHITESPACE`     | null        | 0.0299     | [0.0162, 0.0435]  | 0.0119 | 0.0004   | —        | 181.3   | 164.4    | 0.91          |
| `NULL-SYNONYM`        | null        | 0.0159     | [0.0020, 0.0298]  | 0.0121 | 0.0204   | —        | 181.3   | 165.2    | 0.91          |
| `NULL-CLAUSE-ORDER`   | null        | 0.0725     | [0.0566, 0.0885]  | 0.0140 | 0.0002   | —        | 138.0   | 143.5    | 1.04          |
| `PRESUPPOSITION`      | semantic    | 0.0447     | [0.0298, 0.0596]  | 0.0130 | 0.0002   | 0.0018   | 181.3   | 172.0    | 0.95          |
| `FRAME-IDENTITY`      | semantic    | 0.2966     | [0.2834, 0.3097]  | 0.0116 | 0.0002   | 0.0018   | 181.3   | 198.5    | 1.09          |
| `FRAME-TEAM`          | semantic    | 0.3791     | [0.3624, 0.3957]  | 0.0147 | 0.0002   | 0.0018   | 181.3   | 154.0    | 0.85          |
| `ANSWER-PRIMING`      | semantic    | 0.1840     | [0.1705, 0.1974]  | 0.0117 | 0.0002   | 0.0018   | 181.3   | 96.4     | 0.53          |
| `CLOSED-ANSWER-SPACE` | semantic    | 0.7929     | [0.7734, 0.8125]  | 0.0172 | 0.0002   | 0.0018   | 181.3   | 2.9      | 0.02          |
| `OPTION-ORDER`        | semantic    | 0.2163     | [0.1999, 0.2327]  | 0.0154 | 0.0002   | 0.0018   | 2.9     | 9.1      | 3.14          |
| `PERSON-3RD`          | semantic    | 0.4003     | [0.3846, 0.4159]  | 0.0137 | 0.0002   | 0.0018   | 181.3   | 207.6    | 1.14          |
| `POLITENESS`          | semantic    | 0.0966     | [0.0805, 0.1127]  | 0.0142 | 0.0002   | 0.0018   | 181.3   | 164.6    | 0.91          |
| `LENGTH`              | semantic    | 0.0641     | [0.0494, 0.0789]  | 0.0131 | 0.0002   | 0.0018   | 181.3   | 68.9     | 0.38          |
| `COMBO-TEAM-PRIME`    | combo       | 0.3164     | [0.3000, 0.3328]  | 0.0143 | 0.0002   | —        | 181.3   | 160.4    | 0.88          |
| `COMBO-TEAM-LENGTH`   | combo       | 0.3674     | [0.3509, 0.3839]  | 0.0145 | 0.0002   | —        | 181.3   | 138.2    | 0.76          |
| `COMBO-PRIME-POLITE`  | combo       | 0.1723     | [0.1586, 0.1861]  | 0.0122 | 0.0002   | —        | 181.3   | 89.6     | 0.49          |

**Additivity** — is the shift predictable by summing its parts?

| combo                | predicted | observed | ratio | verdict      |
| -------------------- | --------- | -------- | ----- | ------------ |
| `COMBO-TEAM-PRIME`   | 0.5630    | 0.3164   | 0.56  | sub-additive |
| `COMBO-TEAM-LENGTH`  | 0.4432    | 0.3674   | 0.83  | additive     |
| `COMBO-PRIME-POLITE` | 0.2806    | 0.1723   | 0.61  | sub-additive |

**Centroid rank** (mean word-bag JSD to every other candidate, ascending; worst case in parentheses): `A` 0.285 (0.550) · `WS` 0.300 (0.598) · `SYN` 0.306 (0.617) · `LENGTH` 0.318 (0.607) · `CLA-R` 0.327 (0.562) · `PRESUP` 0.329 (0.563) · `CLA-L` 0.347 (0.576) · `POLITE` 0.364 (0.567) · `PRIME` 0.370 (0.651) · `IDENTITY` 0.473 (0.698) · `PERSON` 0.571 (0.674) · `TEAM` 0.577 (0.698)

#### role / gemma2:2b

Replicates per prompt: 240. Permutations: 5000.

Third calibration, POST-HOC (anchor even-numbered replicates vs odd, interleaved seeds, pure sampler noise): excess=-0.0063 p=0.6509 MDE=0.0246

Second calibration (anchor block 1 vs anchor block 2, adjacent seeds, NOT part of the pre-registered gates): excess=-0.0018 p=0.5191 MDE=0.0247

**Gates** (evaluated before any axis number below):

- G1 CALIB-IDENTICAL: excess=0.0188 p=0.0230 -> FAIL
- G2 NULL-WHITESPACE: excess=0.0086 ciHi=0.0243 p=0.1368 -> FAIL
- G2 NULL-SYNONYM: excess=0.0220 ciHi=0.0377 p=0.0068 -> FAIL
- G2 NULL-CLAUSE-ORDER: excess=0.0844 ciHi=0.1049 p=0.0002 -> FAIL
- G3 semantic axes below Holm-adjusted alpha: 9/9

G1 calibration FAIL · G2 null axes FAIL · G3 separation PASS

| axis                  | kind        | excess JSD | 95% CI            | MDE    | p (perm) | p (Holm) | N1 left | N1 right | variety ratio |
| --------------------- | ----------- | ---------- | ----------------- | ------ | -------- | -------- | ------- | -------- | ------------- |
| `CALIB-IDENTICAL`     | calibration | 0.0188     | [0.0021, 0.0355]  | 0.0148 | 0.0230   | —        | 58.1    | 39.3     | 0.68          |
| `NULL-WHITESPACE`     | null        | 0.0086     | [-0.0071, 0.0243] | 0.0137 | 0.1368   | —        | 58.1    | 50.0     | 0.86          |
| `NULL-SYNONYM`        | null        | 0.0220     | [0.0063, 0.0377]  | 0.0135 | 0.0068   | —        | 58.1    | 37.0     | 0.64          |
| `NULL-CLAUSE-ORDER`   | null        | 0.0844     | [0.0639, 0.1049]  | 0.0181 | 0.0002   | —        | 18.2    | 14.4     | 0.79          |
| `PRESUPPOSITION`      | semantic    | 0.0570     | [0.0420, 0.0720]  | 0.0131 | 0.0002   | 0.0018   | 58.1    | 31.8     | 0.55          |
| `FRAME-IDENTITY`      | semantic    | 0.3476     | [0.3345, 0.3608]  | 0.0116 | 0.0002   | 0.0018   | 58.1    | 7.8      | 0.13          |
| `FRAME-TEAM`          | semantic    | 0.8138     | [0.7971, 0.8306]  | 0.0148 | 0.0002   | 0.0018   | 58.1    | 7.1      | 0.12          |
| `ANSWER-PRIMING`      | semantic    | 0.7020     | [0.6864, 0.7177]  | 0.0137 | 0.0002   | 0.0018   | 58.1    | 6.5      | 0.11          |
| `CLOSED-ANSWER-SPACE` | semantic    | 0.8383     | [0.8203, 0.8563]  | 0.0158 | 0.0002   | 0.0018   | 58.1    | 18.7     | 0.32          |
| `OPTION-ORDER`        | semantic    | 0.6161     | [0.6012, 0.6310]  | 0.0136 | 0.0002   | 0.0018   | 18.7    | 2.9      | 0.15          |
| `PERSON-3RD`          | semantic    | 0.7194     | [0.7003, 0.7384]  | 0.0171 | 0.0002   | 0.0018   | 58.1    | 31.8     | 0.55          |
| `POLITENESS`          | semantic    | 0.0649     | [0.0492, 0.0806]  | 0.0137 | 0.0002   | 0.0018   | 58.1    | 29.3     | 0.51          |
| `LENGTH`              | semantic    | 0.0623     | [0.0461, 0.0785]  | 0.0140 | 0.0002   | 0.0018   | 58.1    | 38.8     | 0.67          |
| `COMBO-TEAM-PRIME`    | combo       | 0.7562     | [0.7356, 0.7769]  | 0.0178 | 0.0002   | —        | 58.1    | 36.9     | 0.64          |
| `COMBO-TEAM-LENGTH`   | combo       | 0.7936     | [0.7757, 0.8114]  | 0.0154 | 0.0002   | —        | 58.1    | 12.8     | 0.22          |
| `COMBO-PRIME-POLITE`  | combo       | 0.6793     | [0.6626, 0.6960]  | 0.0146 | 0.0002   | —        | 58.1    | 4.7      | 0.08          |

**Additivity** — is the shift predictable by summing its parts?

| combo                | predicted | observed | ratio | verdict      |
| -------------------- | --------- | -------- | ----- | ------------ |
| `COMBO-TEAM-PRIME`   | 1.5159    | 0.7562   | 0.50  | sub-additive |
| `COMBO-TEAM-LENGTH`  | 0.8761    | 0.7936   | 0.91  | additive     |
| `COMBO-PRIME-POLITE` | 0.7669    | 0.6793   | 0.89  | additive     |

**Centroid rank** (mean word-bag JSD to every other candidate, ascending; worst case in parentheses): `WS` 0.398 (0.900) · `SYN` 0.402 (0.914) · `A` 0.404 (0.902) · `LENGTH` 0.410 (0.831) · `POLITE` 0.421 (0.866) · `PRESUP` 0.444 (0.903) · `CLA-R` 0.612 (0.929) · `CLA-L` 0.615 (0.946) · `IDENTITY` 0.623 (1.000) · `PRIME` 0.767 (1.000) · `PERSON` 0.809 (0.939) · `TEAM` 0.848 (0.991)

#### role / llama3.2:1b

Replicates per prompt: 240. Permutations: 5000.

Third calibration, POST-HOC (anchor even-numbered replicates vs odd, interleaved seeds, pure sampler noise): excess=0.0109 p=0.2955 MDE=0.0379

Second calibration (anchor block 1 vs anchor block 2, adjacent seeds, NOT part of the pre-registered gates): excess=-0.0300 p=0.9216 MDE=0.0382

**Gates** (evaluated before any axis number below):

- G1 CALIB-IDENTICAL: excess=-0.0059 p=0.6531 -> PASS
- G2 NULL-WHITESPACE: excess=0.0380 ciHi=0.0647 p=0.0068 -> FAIL
- G2 NULL-SYNONYM: excess=0.0741 ciHi=0.0999 p=0.0002 -> FAIL
- G2 NULL-CLAUSE-ORDER: excess=0.0753 ciHi=0.0989 p=0.0002 -> FAIL
- G3 semantic axes below Holm-adjusted alpha: 8/9

G1 calibration PASS · G2 null axes FAIL · G3 separation PASS

| axis                  | kind        | excess JSD | 95% CI            | MDE    | p (perm) | p (Holm) | N1 left | N1 right | variety ratio |
| --------------------- | ----------- | ---------- | ----------------- | ------ | -------- | -------- | ------- | -------- | ------------- |
| `CALIB-IDENTICAL`     | calibration | -0.0059    | [-0.0321, 0.0203] | 0.0230 | 0.6531   | —        | 28.4    | 26.1     | 0.92          |
| `NULL-WHITESPACE`     | null        | 0.0380     | [0.0113, 0.0647]  | 0.0235 | 0.0068   | —        | 28.4    | 29.7     | 1.04          |
| `NULL-SYNONYM`        | null        | 0.0741     | [0.0484, 0.0999]  | 0.0229 | 0.0002   | —        | 28.4    | 13.9     | 0.49          |
| `NULL-CLAUSE-ORDER`   | null        | 0.0753     | [0.0518, 0.0989]  | 0.0209 | 0.0002   | —        | 22.0    | 31.4     | 1.43          |
| `PRESUPPOSITION`      | semantic    | 0.0722     | [0.0439, 0.1005]  | 0.0245 | 0.0002   | 0.0018   | 28.4    | 21.1     | 0.74          |
| `FRAME-IDENTITY`      | semantic    | 0.5882     | [0.5683, 0.6080]  | 0.0175 | 0.0002   | 0.0018   | 28.4    | 3.7      | 0.13          |
| `FRAME-TEAM`          | semantic    | 0.6747     | [0.6498, 0.6996]  | 0.0220 | 0.0002   | 0.0018   | 28.4    | 88.1     | 3.10          |
| `ANSWER-PRIMING`      | semantic    | 0.2986     | [0.2703, 0.3269]  | 0.0247 | 0.0002   | 0.0018   | 28.4    | 56.3     | 1.98          |
| `CLOSED-ANSWER-SPACE` | semantic    | 0.7627     | [0.7350, 0.7904]  | 0.0249 | 0.0002   | 0.0018   | 28.4    | 2.5      | 0.09          |
| `OPTION-ORDER`        | semantic    | 0.0133     | [-0.0064, 0.0330] | 0.0180 | 0.0992   | 0.0992   | 2.5     | 2.9      | 1.17          |
| `PERSON-3RD`          | semantic    | 0.6277     | [0.5968, 0.6586]  | 0.0271 | 0.0002   | 0.0018   | 28.4    | 79.9     | 2.81          |
| `POLITENESS`          | semantic    | 0.1362     | [0.1114, 0.1611]  | 0.0216 | 0.0002   | 0.0018   | 28.4    | 35.8     | 1.26          |
| `LENGTH`              | semantic    | 0.2333     | [0.2045, 0.2621]  | 0.0256 | 0.0002   | 0.0018   | 28.4    | 31.7     | 1.12          |
| `COMBO-TEAM-PRIME`    | combo       | 0.6193     | [0.5900, 0.6487]  | 0.0251 | 0.0002   | —        | 28.4    | 63.7     | 2.24          |
| `COMBO-TEAM-LENGTH`   | combo       | 0.6432     | [0.6149, 0.6715]  | 0.0251 | 0.0002   | —        | 28.4    | 59.5     | 2.10          |
| `COMBO-PRIME-POLITE`  | combo       | 0.3298     | [0.3042, 0.3553]  | 0.0220 | 0.0002   | —        | 28.4    | 61.9     | 2.18          |

**Additivity** — is the shift predictable by summing its parts?

| combo                | predicted | observed | ratio | verdict      |
| -------------------- | --------- | -------- | ----- | ------------ |
| `COMBO-TEAM-PRIME`   | 0.9733    | 0.6193   | 0.64  | sub-additive |
| `COMBO-TEAM-LENGTH`  | 0.9080    | 0.6432   | 0.71  | sub-additive |
| `COMBO-PRIME-POLITE` | 0.4349    | 0.3298   | 0.76  | sub-additive |

**Centroid rank** (mean word-bag JSD to every other candidate, ascending; worst case in parentheses): `SYN` 0.449 (0.895) · `WS` 0.454 (0.862) · `A` 0.458 (0.854) · `POLITE` 0.459 (0.887) · `PRESUP` 0.471 (0.889) · `CLA-R` 0.549 (0.869) · `CLA-L` 0.554 (0.910) · `PRIME` 0.569 (0.874) · `LENGTH` 0.576 (0.885) · `IDENTITY` 0.731 (0.974) · `PERSON` 0.843 (0.968) · `TEAM` 0.862 (0.974)

#### role / qwen2.5:0.5b

Replicates per prompt: 240. Permutations: 5000.

Third calibration, POST-HOC (anchor even-numbered replicates vs odd, interleaved seeds, pure sampler noise): excess=0.0154 p=0.1984 MDE=0.0353

Second calibration (anchor block 1 vs anchor block 2, adjacent seeds, NOT part of the pre-registered gates): excess=-0.0040 p=0.5529 MDE=0.0355

**Gates** (evaluated before any axis number below):

- G1 CALIB-IDENTICAL: excess=-0.0015 p=0.5311 -> PASS
- G2 NULL-WHITESPACE: excess=0.0456 ciHi=0.0688 p=0.0010 -> FAIL
- G2 NULL-SYNONYM: excess=0.0211 ciHi=0.0429 p=0.0382 -> FAIL
- G2 NULL-CLAUSE-ORDER: excess=0.0343 ciHi=0.0563 p=0.0040 -> FAIL
- G3 semantic axes below Holm-adjusted alpha: 9/9

G1 calibration PASS · G2 null axes FAIL · G3 separation PASS

| axis                  | kind        | excess JSD | 95% CI            | MDE    | p (perm) | p (Holm) | N1 left | N1 right | variety ratio |
| --------------------- | ----------- | ---------- | ----------------- | ------ | -------- | -------- | ------- | -------- | ------------- |
| `CALIB-IDENTICAL`     | calibration | -0.0015    | [-0.0240, 0.0210] | 0.0204 | 0.5311   | —        | 75.2    | 52.5     | 0.70          |
| `NULL-WHITESPACE`     | null        | 0.0456     | [0.0223, 0.0688]  | 0.0210 | 0.0010   | —        | 75.2    | 36.7     | 0.49          |
| `NULL-SYNONYM`        | null        | 0.0211     | [-0.0007, 0.0429] | 0.0192 | 0.0382   | —        | 75.2    | 52.1     | 0.69          |
| `NULL-CLAUSE-ORDER`   | null        | 0.0343     | [0.0123, 0.0563]  | 0.0190 | 0.0040   | —        | 11.8    | 7.5      | 0.63          |
| `PRESUPPOSITION`      | semantic    | 0.0365     | [0.0131, 0.0598]  | 0.0212 | 0.0058   | 0.0058   | 75.2    | 55.5     | 0.74          |
| `FRAME-IDENTITY`      | semantic    | 0.3668     | [0.3396, 0.3941]  | 0.0247 | 0.0002   | 0.0018   | 75.2    | 12.3     | 0.16          |
| `FRAME-TEAM`          | semantic    | 0.5067     | [0.4829, 0.5305]  | 0.0210 | 0.0002   | 0.0018   | 75.2    | 75.8     | 1.01          |
| `ANSWER-PRIMING`      | semantic    | 0.2935     | [0.2685, 0.3185]  | 0.0228 | 0.0002   | 0.0018   | 75.2    | 29.9     | 0.40          |
| `CLOSED-ANSWER-SPACE` | semantic    | 0.8368     | [0.8091, 0.8645]  | 0.0251 | 0.0002   | 0.0018   | 75.2    | 2.4      | 0.03          |
| `OPTION-ORDER`        | semantic    | 0.2873     | [0.2799, 0.2947]  | 0.0076 | 0.0002   | 0.0018   | 2.4     | 1.7      | 0.71          |
| `PERSON-3RD`          | semantic    | 0.4065     | [0.3821, 0.4308]  | 0.0218 | 0.0002   | 0.0018   | 75.2    | 25.4     | 0.34          |
| `POLITENESS`          | semantic    | 0.0532     | [0.0314, 0.0750]  | 0.0195 | 0.0002   | 0.0018   | 75.2    | 45.0     | 0.60          |
| `LENGTH`              | semantic    | 0.1318     | [0.1080, 0.1555]  | 0.0217 | 0.0002   | 0.0018   | 75.2    | 35.2     | 0.47          |
| `COMBO-TEAM-PRIME`    | combo       | 0.7512     | [0.7276, 0.7748]  | 0.0209 | 0.0002   | —        | 75.2    | 17.3     | 0.23          |
| `COMBO-TEAM-LENGTH`   | combo       | 0.5502     | [0.5266, 0.5739]  | 0.0211 | 0.0002   | —        | 75.2    | 20.7     | 0.27          |
| `COMBO-PRIME-POLITE`  | combo       | 0.2445     | [0.2204, 0.2685]  | 0.0219 | 0.0002   | —        | 75.2    | 29.9     | 0.40          |

**Additivity** — is the shift predictable by summing its parts?

| combo                | predicted | observed | ratio | verdict      |
| -------------------- | --------- | -------- | ----- | ------------ |
| `COMBO-TEAM-PRIME`   | 0.8002    | 0.7512   | 0.94  | additive     |
| `COMBO-TEAM-LENGTH`  | 0.6385    | 0.5502   | 0.86  | additive     |
| `COMBO-PRIME-POLITE` | 0.3466    | 0.2445   | 0.71  | sub-additive |

**Centroid rank** (mean word-bag JSD to every other candidate, ascending; worst case in parentheses): `WS` 0.364 (0.734) · `POLITE` 0.380 (0.730) · `PRESUP` 0.385 (0.719) · `LENGTH` 0.397 (0.705) · `A` 0.398 (0.716) · `SYN` 0.401 (0.745) · `PRIME` 0.466 (0.677) · `CLA-L` 0.478 (0.714) · `CLA-R` 0.507 (0.781) · `PERSON` 0.551 (0.688) · `IDENTITY` 0.617 (0.773) · `TEAM` 0.695 (0.781)

#### role / qwen2.5:7b

Replicates per prompt: 80. Permutations: 5000.

Third calibration, POST-HOC (anchor even-numbered replicates vs odd, interleaved seeds, pure sampler noise): excess=-0.0201 p=0.9790 MDE=0.0269

**Gates** (evaluated before any axis number below):

- G1 CALIB-IDENTICAL: excess=-0.0041 p=0.4705 -> PASS
- G2 NULL-WHITESPACE: excess=0.0305 ciHi=0.0530 p=0.0190 -> FAIL
- G2 NULL-SYNONYM: excess=0.1018 ciHi=0.1211 p=0.0002 -> FAIL
- G2 NULL-CLAUSE-ORDER: excess=0.2196 ciHi=0.2566 p=0.0002 -> FAIL
- G3 semantic axes below Holm-adjusted alpha: 6/9

G1 calibration PASS · G2 null axes FAIL · G3 separation PASS

| axis                  | kind        | excess JSD | 95% CI            | MDE    | p (perm) | p (Holm) | N1 left | N1 right | variety ratio |
| --------------------- | ----------- | ---------- | ----------------- | ------ | -------- | -------- | ------- | -------- | ------------- |
| `CALIB-IDENTICAL`     | calibration | -0.0041    | [-0.0216, 0.0134] | 0.0167 | 0.4705   | —        | 2.5     | 2.3      | 0.93          |
| `NULL-WHITESPACE`     | null        | 0.0305     | [0.0080, 0.0530]  | 0.0219 | 0.0190   | —        | 2.5     | 2.8      | 1.14          |
| `NULL-SYNONYM`        | null        | 0.1018     | [0.0824, 0.1211]  | 0.0159 | 0.0002   | —        | 2.5     | 1.8      | 0.72          |
| `NULL-CLAUSE-ORDER`   | null        | 0.2196     | [0.1825, 0.2566]  | 0.0354 | 0.0002   | —        | 2.0     | 4.9      | 2.45          |
| `PRESUPPOSITION`      | semantic    | 0.0046     | [-0.0121, 0.0213] | 0.0148 | 0.2450   | 0.4899   | 2.5     | 2.1      | 0.82          |
| `FRAME-IDENTITY`      | semantic    | 0.5814     | [0.5669, 0.5960]  | 0.0133 | 0.0002   | 0.0018   | 2.5     | 1.9      | 0.78          |
| `FRAME-TEAM`          | semantic    | 0.8832     | [0.8573, 0.9091]  | 0.0247 | 0.0002   | 0.0018   | 2.5     | 3.1      | 1.26          |
| `ANSWER-PRIMING`      | semantic    | 0.9804     | [0.9557, 1.0051]  | 0.0235 | 0.0002   | 0.0018   | 2.5     | 1.3      | 0.54          |
| `CLOSED-ANSWER-SPACE` | semantic    | 0.9851     | [0.9635, 1.0067]  | 0.0200 | 0.0002   | 0.0018   | 2.5     | 1.0      | 0.40          |
| `OPTION-ORDER`        | semantic    | 0.0000     | [0.0000, 0.0000]  | 0.0000 | 1.0000   | 1.0000   | 1.0     | 1.0      | 1.00          |
| `PERSON-3RD`          | semantic    | 0.7969     | [0.7503, 0.8434]  | 0.0413 | 0.0002   | 0.0018   | 2.5     | 9.3      | 3.74          |
| `POLITENESS`          | semantic    | 0.1473     | [0.1226, 0.1719]  | 0.0217 | 0.0002   | 0.0018   | 2.5     | 2.5      | 0.98          |
| `LENGTH`              | semantic    | 0.0223     | [0.0026, 0.0419]  | 0.0183 | 0.0324   | 0.0972   | 2.5     | 3.0      | 1.21          |
| `COMBO-TEAM-PRIME`    | combo       | 0.9806     | [0.9560, 1.0053]  | 0.0234 | 0.0002   | —        | 2.5     | 1.9      | 0.74          |
| `COMBO-TEAM-LENGTH`   | combo       | 0.7270     | [0.7027, 0.7512]  | 0.0220 | 0.0002   | —        | 2.5     | 3.1      | 1.26          |
| `COMBO-PRIME-POLITE`  | combo       | 0.9791     | [0.9551, 1.0031]  | 0.0214 | 0.0002   | —        | 2.5     | 1.1      | 0.45          |

**Additivity** — is the shift predictable by summing its parts?

| combo                | predicted | observed | ratio | verdict      |
| -------------------- | --------- | -------- | ----- | ------------ |
| `COMBO-TEAM-PRIME`   | 1.8636    | 0.9806   | 0.53  | sub-additive |
| `COMBO-TEAM-LENGTH`  | 0.9055    | 0.7270   | 0.80  | additive     |
| `COMBO-PRIME-POLITE` | 1.1277    | 0.9791   | 0.87  | additive     |

**Centroid rank** (mean word-bag JSD to every other candidate, ascending; worst case in parentheses): `A` 0.429 (1.000) · `PRESUP` 0.438 (1.000) · `LENGTH` 0.459 (1.000) · `POLITE` 0.463 (0.956) · `WS` 0.466 (1.000) · `SYN` 0.522 (1.000) · `CLA-R` 0.594 (1.000) · `CLA-L` 0.606 (1.000) · `IDENTITY` 0.715 (1.000) · `PERSON` 0.906 (1.000) · `TEAM` 0.914 (0.977) · `PRIME` 0.994 (1.000)
