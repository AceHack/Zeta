# Does persona hat-CHOICE decorrelate, or is the audition ceremony? — a measured axis

**Date:** 2026-08-26 · **Register:** BEACON (measurement) · **Status:** `toy`

Per [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md),
every claim here stays `toy` until a falsifier is attached. Two are attached and both
fired, so the *findings* below are **metered on this bench** — and the bench itself is
a small-local-model proxy whose limits are stated in §3 and never waved.

**Instrument:** a new axis in the existing framework
(`src/Core.TypeScript/observe/decorrelation-harness.ts`), not a new framework.
Files: `f3-hat-choice-decorrelation.ts` (metrics + falsifiers),
`f3-hat-choice-run.ts` (generation), `f3-hat-choice-analyze.ts` (recomputation),
raw data in `data/f3-hat-choice/*.jsonl`. 7 260 logged model generations (2 700 for E1, 4 560 for E2), plus 40 unlogged roster elicitations.

---

## 0. Summary

**The mechanism is NOT SUPPORTED on this bench — and not refuted either. The sharper
finding is that the question it argues about is close to moot at this scale: hats
decorrelate very little, so how you distribute them is a second-order effect on a
first-order effect that is nearly absent.**

| # | finding | register | evidence |
|---|---|---|---|
| 1 | **Rewording the elicitation moves the choice distribution.** "What do you want to be" reads out a prompt-conditioned distribution, not a stable persona preference. | **metered** | 5/5 model×temperature cells, permutation *p* = 0.0005 (§4.1) |
| 2 | **The wording — not the chooser — is the dominant term in how varied the answers are.** | **metered** | effective variety swings 4.1×–14.5× on phrasing alone (§4.2) |
| 3 | **ρ_B < ρ_A is NOT SUPPORTED — and not refuted.** 5 of 6 statistics across two models lean the predicted way; none reaches the precommitted *p* < 0.05. Best is *p* = 0.052, reported as a miss. | **consistent with, underpowered** | §5.3, §5.6, §5.7 |
| 4 | **A panel of distinctly-hatted agents is worth 1–2 independent witnesses.** Self-selection moves that by ≈ **+0.15 of a witness**. Replicates in both models. | **metered** | N_eff 1.13→1.26 of 24; 1.36→1.56 of 14 (§5.7) |
| 5 | **Self-selection moved behaviour *more* and decorrelated *less*** on gemma — the extra movement was common-mode. | consistent with | 21.7% vs 15.1% displacement, agreement 0.853 vs 0.839 (§5.4) |
| 6 | **Variety fell with model size.** The largest model tested was by far the most collapsed. | consistent with | pooled N1 = 16.9 vs 72–96 (§4.4) |
| 7 | **The two-number discipline changed a SIGN, not a magnitude.** Self-selected llama agents nearly doubled abstention recall while losing 5 points of accuracy — a merged score reports that as strictly worse. | **metered** | 0.393 vs 0.201 recall, 0.232 vs 0.283 accuracy (§5.8) |

Calibration gate: identical agents read ρ̄ = **1.000 ± 0.000** over 91 defined pairs
(§5.6). Metric falsifiers: 10 injected defects, **0 survived** (§6.3).

---

## 1. The claim under test

Aaron, on the zetaidol audition:

> *"we never prompt them, just ask what do they want to be — this is the root of
> decorrelation."*

The distinction it rests on: **a hat has direction and prompts; a persona does not,
but a persona gets to choose which hats it wears when.** So an *assigned* hat is
correlated through its assigner — N reviewers handed hats by one author are N
samples of that author's framing, however sincere each wearer is. Self-selection is
supposed to **move the entropy source from the assigner to the chooser**.

That is a hypothesis, not a result. This document measures it.

---

## 2. Design

Two experiments. The second is the one whose *control is the experiment*; the first
is the falsifier that decides whether the word "choice" is doing any work at all.

### E1 — the elicitation-stability falsifier

**"What do you want to be?" is still a prompt.** So the elicitation is reworded six
ways and the resulting choice distribution is compared across wordings.

> **If the choice distribution shifts when you reword the question, the choice was
> the prompt's, not the persona's.**

The six phrasings vary *frame*, not just synonyms — a set of near-identical
paraphrases would make the falsifier easy to pass:

| id | wording |
|---|---|
| `P1-bare` | What do you want to be? |
| `P2-choice` | If you could choose any role for yourself, what would you choose? |
| `P3-team` | You are joining a group of other agents. What is your role? |
| `P4-imperative` | Name the role you would pick for yourself. |
| `P5-identity` | Who are you? |
| `P6-negative` | Every role is open and none is assigned. Which one is yours? |

All six share one answer-format suffix ("a short role name only (1-4 words)"), so the
*format* is held constant and only the *frame* varies. A regression test asserts that
no phrasing names a role, so the prompt cannot hand over the answer.

**The statistic needs a noise floor or it is unfalsifiable.** Any two finite samples
differ, so a nonzero cross-phrasing divergence proves nothing on its own. Therefore
cross-phrasing Jensen–Shannon divergence is judged against the **within-phrasing
split-half JSD of the same sampler** — the sampling-noise floor — and against a
**permutation null** in which phrasing labels are shuffled (the exact null: under H0
the label carries no information, so relabelling is a valid resampling).

**Effective number of distinct choices, not the raw count.** Reported as Hill numbers:
N0 (raw distinct), N1 = exp(H), N2 = 1/Σp². A hundred instances producing three
archetypes with a long thin tail is not a hundred witnesses, and only N1/N2 say so.

### E2 — assigned vs self-selected, with a calibration floor

Three conditions, same task, same items, same model:

| | condition | hats |
|---|---|---|
| **N** | null / calibration floor | none. All agents identical. |
| **A** | assigned | one author instance emitted the whole roster; agent *i* wears hat A_i. |
| **B** | self-selected | agent *i* was asked what it wants to be; wears its own answer. |

Condition **N** is not decoration. It is the **calibration gate**: identical agents
must read ρ̄ ≈ 1 and answer-agreement ≈ 1. An instrument that does not report a
collapse where the collapse is certain is not measuring correlation, and no other
number from it is reportable. This was precommitted before the run.

In the **work** phase temperature is 0 and the seed is fixed, so **the hat string is
the only thing that differs between agents inside a condition** — the axis is
isolated by construction rather than by assertion.

The claim is **ρ_B < ρ_A**, tested by permuting the A/B labels across agent panels.

### Two biases this design does not remove — one each way

Named up front, with the direction each cuts, because a single unnamed bias is how a
comparison quietly decides itself.

| bias | favours | mechanism |
|---|---|---|
| **single-pass roster** | **A** | condition A's 24 hats are written in one generation, so the author's own anti-repetition pressure spreads them. A human or agent writing a roster does exactly this, so the shape is faithful — but it is not the same generative process as B. |
| **rotated elicitations** | **B** | condition B's hats are elicited across all six phrasings in rotation. E1 (§4.2) shows phrasing swings effective variety by 4×–14×, so rotating *inflates* B's variety relative to any single-phrasing audition. |

Neither is removable without changing what the conditions mean, so both are reported
and neither number is presented as clean.

**A third bias was found and removed mid-run.** The first draft cycled a short author
roster (`i % hats.length`) to fill 24 agents whenever the author emitted fewer than
24. That would have placed *duplicate hats* in condition A — perfectly correlated
agents manufactured by the harness — inflating ρ_A and handing the hypothesis a free
win. The panel is now sized to what the author actually supplied, and all three
conditions use that same size. A dry run against `llama3.2:1b` (14 of 24 roster lines
parsed) is what exposed it.

---

## 3. What "a fresh instance" means here — the load-bearing limit

Stated first because it bounds everything below.

In the real audition, instances differ by model, context, history, and moment. On
this bench they differ by **one thing only: the sampler's seed**. Temperature 0 with
a fixed seed yields byte-identical output, so the "hundred fresh instances" here are
a hundred *sampling trajectories* of one model at temperature 0.8. That is a genuine
entropy source, and it is a **weaker** one than the fleet has.

Two consequences, and they point in opposite directions, so neither can be waved
through:

- **It understates** the variety the real audition would produce (no context or
  history diversity).
- **It is the cleanest available isolation** of the axis: nothing but the elicitation
  wording and the hat string can be responsible for what is measured.

The models are also small (0.5B–7.6B, quantized, local). A finding here transfers to
the fleet only insofar as small local models proxy for it, which is an assumption
this document does not test and does not claim.

---

## 4. Results — E1: does rewording move the choice?

2 700 generations. 6 phrasings × 100 seeds × 4 models, plus one temperature
sensitivity cell. Recompute with
`bun src/Core.TypeScript/observe/f3-hat-choice-analyze.ts e1`.

### 4.1 The falsifier fires in every cell

| model @ T | cross-phrasing JSD | split-half floor | ratio | permutation *p* | verdict |
|---|---|---|---|---|---|
| qwen2.5:0.5b @ 0.8 | 0.549 | 0.261 | **2.10×** | 0.0005 | UNSTABLE |
| llama3.2:1b @ 0.8 | 0.761 | 0.272 | **2.79×** | 0.0005 | UNSTABLE |
| gemma2:2b @ 0.8 | 0.523 | 0.156 | **3.35×** | 0.0005 | UNSTABLE |
| qwen2.5:7b @ 0.8 | 0.744 | 0.224 | **3.32×** | 0.0005 | UNSTABLE |
| gemma2:2b @ 1.0 | 0.533 | 0.198 | **2.70×** | 0.0005 | UNSTABLE |

*p* = 0.0005 is the floor of 2 000 permutations — in no cell did a single relabelling
reach the observed cross-phrasing divergence.

> **The choice distribution moves with the wording, in every model tested, at both
> temperatures tested. On this instrument, "what do you want to be" does not read out
> a stable persona-side preference; it reads out a prompt-conditioned distribution.**

### 4.2 The sharpest number: the question sets the variety

Effective number of distinct choices (Hill N1) **per phrasing**, same model, same
seeds, same format suffix — only the frame differs:

| model @ T | min N1 (phrasing) | max N1 (phrasing) | swing |
|---|---|---|---|
| qwen2.5:0.5b @ 0.8 | 12.4 (`P5-identity`) | 50.3 (`P2-choice`) | 4.1× |
| llama3.2:1b @ 0.8 | **4.1** (`P5-identity`) | **59.0** (`P3-team`) | **14.5×** |
| gemma2:2b @ 0.8 | 8.0 (`P5-identity`) | 37.3 (`P1-bare`) | 4.7× |
| qwen2.5:7b @ 0.8 | 1.5 (`P6-negative`) | 6.5 (`P1-bare`) | 4.3× |
| gemma2:2b @ 1.0 | 10.5 (`P5-identity`) | 50.1 (`P1-bare`) | 4.8× |

`P5-identity` ("Who are you?") is the least varied phrasing in four of five cells —
it collapses onto the model's own product identity. Framings that name a *choice* or
a *team* open the distribution by up to an order of magnitude.

**This is the mechanism, stated plainly.** If the elicitation wording swings effective
variety by 4×–14×, then the variety observed after an audition is substantially a
property of the auditioner's phrasing. That is precisely the correlation-through-the-
assigner the mechanism was supposed to escape — relocated from *which hat you hand
out* to *how you ask*. The entropy source moved; it did not stop being the asker's.

### 4.3 The raw count flatters by ~2.2×

| model @ T | N0 (raw distinct) | N1 (exp H) | N2 (inv Simpson) | N0/N1 |
|---|---|---|---|---|
| qwen2.5:0.5b @ 0.8 | 231 | 95.6 | 29.6 | 2.42× |
| llama3.2:1b @ 0.8 | 213 | 91.9 | 34.5 | 2.32× |
| gemma2:2b @ 0.8 | 165 | 72.3 | 37.4 | 2.28× |
| qwen2.5:7b @ 0.8 | 37 | 16.9 | 11.5 | 2.19× |
| gemma2:2b @ 1.0 | 228 | 115.6 | 59.1 | 1.97× |

Reporting N0 would overstate the number of witnesses by roughly a factor of two
everywhere; N2, which weights the head hardest, is 3–8× below N0. The long thin tail
is real and it is not evidence.

### 4.4 Variety FELL with model size — the finding that most bites

`qwen2.5:7b` is the largest model tested and by far the least varied: pooled
N1 = **16.9** against 72–96 for the 0.5B–2.6B models, and a per-phrasing N1 as low as
**1.5** — one and a half effective choices across a hundred instances. Its top answers
are `assistant`, `language model`, `assistant agent`, `qwen assistant`.

This is a single-point comparison across different model families and quantizations,
so it is registered as **consistent with**, not *is*: capability and mode-collapse are
confounded here, and one 7B model is not a scaling study. But the direction is the
uncomfortable one for the mechanism. The hope behind the audition is that a fleet of
capable instances asked what they want to be will produce many genuinely different
answers. In the one place where this bench could look at a more capable model, the
answers got **more** uniform, not less.

### 4.5 The entropy knob that does work is the sampler

Raising gemma2:2b from T = 0.8 to T = 1.0 lifted pooled N1 from 72.3 to 115.6
(**+60%**) — a larger effect on variety than anything about the choice framing. It did
not repair stability (ratio 2.70×, *p* = 0.0005).

That is worth saying out loud, because it identifies where the decorrelation on this
bench actually comes from: **temperature, not choice.** Which is also the honest limit
of the bench — see §3.

### 4.6 Which of the two E1 statistics is load-bearing

The split-half floor and the permutation test are not redundant, and only one of them
is rigorous.

Sample-estimated JSD is **positively biased**, and the bias grows as the sample
shrinks. The split-half floor is computed on 50-per-side; the cross-phrasing statistic
on 100-per-side. So the floor carries *more* finite-sample bias than the number it is
being compared against — which means the reported ratios (2.10×–3.35×) are
**understated**. That is the conservative direction, and it is the reason the ratio is
presented as an intuition pump rather than as the result.

The **permutation test is the load-bearing statistic**, because it holds group sizes
fixed while shuffling labels: the null distribution carries exactly the same
finite-sample bias as the observed value, so the bias cancels. Its answer is
*p* = 0.0005 in all five cells — the floor of 2 000 relabellings.

---

## 5. Results — E2: assigned vs self-selected

Recompute with `bun src/Core.TypeScript/observe/f3-hat-choice-analyze.ts e2`.

### 5.1 The calibration gate passes exactly

`gemma2:2b`, condition N, 24 identical agents × 40 items:

| statistic | value |
|---|---|
| answer agreement | **1.000** |
| ρ̄ over all items | **1.000** |
| N_eff | **1.00 of 24** |

Exactly 1, not approximately — temperature 0 with a fixed seed is bitwise reproducible
on this runtime, which is worth knowing on its own. `llama3.2:1b` gives the **strong**
form of the same gate (§5.6): ρ̄ = 1.000 ± 0.000 over 91 *defined* pairs, because that
model is not at ceiling. The precommitted gate is satisfied in both, so the numbers
below are reportable.

*(An earlier partial-data read of this condition showed agreement 0.873 and looked like
runtime nondeterminism. Checked before it was written down: 0 of 40 items actually
varied — the shortfall was the analyzer padding an unfinished agent's vector with
nulls. A finding that would have been wrong, caught by looking at the raw rows.)*

### 5.2 `gemma2:2b`, 24 agents × 40 items × 3 conditions (2 880 generations)

| | N (no hat) | A (assigned) | B (self-selected) |
|---|---|---|---|
| hat-roster N1 | 1.00 | **24.00** | **17.21** |
| ρ̄ on answerable items | undefined (ceiling) | 0.877 ± 0.135 | 0.787 ± 0.234 |
| — defined pairs | 0 / 276 | 10 / 276 | 10 / 276 |
| ρ̄ over all items | 1.000 | 0.979 | 0.971 |
| answer agreement | 1.000 | 0.839 | 0.853 |
| **N_eff of 24 agents** | **1.00** | **1.13** | **1.26** |
| accuracy (answerable) | 1.000 | 0.990 | 0.986 |
| abstention recall | 0.000 | 0.000 | 0.000 |
| latency | 252 ms/gen | 259 ms/gen | 253 ms/gen |

### 5.3 The claim is not supported on `gemma2:2b`

| statistic | ρ_B − ρ_A | permutation *p* | verdict |
|---|---|---|---|
| φ on answerable items | −0.090 | 0.418 | directionally consistent, **not significant** |
| φ over all items (ceiling-robust) | −0.007 | 0.392 | directionally consistent, **not significant** |
| answer agreement | **+0.014** | 0.778 | **refuted** — B agents agreed with each other *more* |

Self-selection did not lower error correlation on this model. The point estimates lean
the right way on the correlation statistics and nowhere near significance; on the one
statistic defined for every pair, gemma leans the *wrong* way. (The second model, §5.6,
leans the right way on all three — see §5.7 for the two read together.)

Note the thin evidence behind the primary row: gemma is at ceiling on the answerable
items, so only **10 of 276** pairs have a defined φ, which is why the jackknife SEs are
±0.135 and ±0.234. The ceiling-robust row uses all 276 and reads −0.007 — essentially
zero.

### 5.4 The number that matters more than the comparison

> **24 agents, 24 distinct hats, ~1.2 effective witnesses.**

N_eff is 1.13 in condition A and 1.26 in condition B, out of 24. Both conditions sit
a hair above the no-hat floor of exactly 1.00. **The hat axis — assigned or
self-selected — buys almost nothing here.**

That reframes the question this document set out to answer. Arguing about *how* hats
are distributed presumes that distributing them decorrelates; on this bench the
distribution method is a second-order effect on a first-order effect that is nearly
absent.

**And the hats are not inert — which is what makes the null result interesting rather
than empty.** Measured against the no-hat baseline directly:

| condition | item-agent pairs where the hat changed the answer |
|---|---|
| A (assigned) | 145 / 960 = **15.1%** |
| B (self-selected) | 208 / 960 = **21.7%** |

Self-selected hats moved behaviour **more** than assigned ones — 44% more — and yet
produced *no more independence* (agreement 0.853 vs 0.839, in the wrong direction).

> **The extra movement was common-mode.** Self-selection pushed the agents further
> from baseline and pushed them the *same way*, because the hats it produced were
> drawn from one narrow motif (§5.5). Displacement is not decorrelation, and this is
> the cleanest statement of why the mechanism failed here: it added variance without
> adding independence.

### 5.5 Self-selection produced LESS hat variety than one author

| roster | atom N0 | atom N1 | word N1 |
|---|---|---|---|
| A — assigned by one author | 24 | **24.00** | 43.63 |
| B — self-selected | 19 | **17.21** | **13.08** |

The self-selected roster is 28% less varied at the role-name level and **70% less
varied at the word level**: it circles one motif (`Bard Assistant`, `Storyteller`,
`Bard of Code`, `Storyteller Bard`, `Helpful Bard`, `Creative Bard`…), which is the
same mode-collapse E1 found. The assigned roster spread across 24 functionally
distinct roles (`Fact Checker`, `Grammar Specialist`, `Style Auditor`, `Bias
Detector`…).

**This comparison is confounded and must be read with §2's bias table.** The
single-pass roster carries anti-repetition pressure, which I pre-declared would favour
A, so the *direction* here is exactly the one my acknowledged bias predicts and cannot
be treated as clean evidence. What is *not* confounded is B's absolute number: a
self-selected roster with word-level N1 = 13 across 24 agents is narrow on its own
terms, independent of what A did.

### 5.6 `llama3.2:1b`, 14 agents × 40 items × 3 conditions (1 680 generations)

The second model is **not at ceiling** (accuracy 0.21–0.28), so φ is defined on all
**91 of 91** pairs and the primary statistic is computable rather than ceiling-limited.
Panel size is 14 because the author supplied 14 roles and all three conditions use the
size the author actually produced (§2).

| | N (no hat) | A (assigned) | B (self-selected) |
|---|---|---|---|
| hat-roster N1 | 1.00 | **14.00** | **11.06** |
| ρ̄ on answerable items | **1.000 ± 0.000** | 0.714 ± 0.049 | 0.615 ± 0.063 |
| — defined pairs | 91 / 91 | 91 / 91 | 91 / 91 |
| ρ̄ over all items | 1.000 | 0.554 | 0.418 |
| answer agreement | 1.000 | 0.513 | 0.480 |
| **N_eff of 14 agents** | **1.00** | **1.36** | **1.56** |
| accuracy (answerable) | 0.208 | 0.283 | 0.232 |
| abstention precision | 0.200 | 0.405 | **0.421** |
| abstention recall | 0.063 | 0.201 | **0.393** |
| abstentions emitted | 70 | 111 | **209** |
| latency | 190 ms/gen | 182 ms/gen | 185 ms/gen |

The calibration gate here is the strong form: ρ̄ = **1.000 ± 0.000** over 91 defined
pairs, not merely an agreement of 1.

| statistic | ρ_B − ρ_A | permutation *p* | verdict |
|---|---|---|---|
| φ on answerable items | −0.099 | 0.109 | directionally consistent, not significant |
| φ over all items | −0.136 | **0.052** | directionally consistent, **not significant** |
| answer agreement | −0.033 | 0.246 | directionally consistent, not significant |

**All three lean toward the hypothesis, and the best of them lands at *p* = 0.052.**

That number is worth pausing on. The precommitted threshold (§7) is *p* < 0.05, and
0.052 is outside it. Reported as **not supported** — not "marginally significant", not
"approaching significance", not rounded down. This is precisely the situation the
pre-registration exists for: without it written down first, 0.052 is a number one
talks oneself past.

### 5.7 Reading the two models together

|  | gemma2:2b | llama3.2:1b |
|---|---|---|
| φ on answerable items | −0.090 (*p* = 0.42) | −0.099 (*p* = 0.11) |
| φ over all items | −0.007 (*p* = 0.39) | −0.136 (*p* = 0.05) |
| answer agreement | **+0.014** (*p* = 0.78) | −0.033 (*p* = 0.25) |
| N_eff, assigned → self-selected | 1.13 → 1.26 of 24 | 1.36 → 1.56 of 14 |

**Verdict: not supported, and not refuted either.** Five of six statistics lean the
predicted way and none reaches the precommitted threshold; the one that leans the
other way (gemma agreement, +0.014) is the least significant number in the table.
The honest register is **"consistent with, underpowered"** — the direction is stable
enough across two independent models to justify a properly-powered replication, and
the evidence in hand does not support the claim.

What *does* replicate cleanly is finding #4: **N_eff rises from ~1.1–1.4 to ~1.3–1.6
out of 14–24 agents.** In both models, in both conditions, a panel of distinctly-hatted
agents is worth between one and two independent witnesses. Self-selection moves that
needle by about **+0.15 of a witness**. That is a real effect in a consistent
direction and it is very small in absolute terms — which is the finding, stated
without either inflation or dismissal.

### 5.8 What the two-number discipline caught

`gemma2:2b` scored **accuracy 0.99 and abstention recall 0.00** in every condition. It
answered every answerable item correctly and *never once* used the `-1` channel across
16 unanswerable items per agent — 384 opportunities per condition, zero taken, despite
"If NO option is correct, reply -1" being in every prompt.

Under a single merged score this model reads as ~99% correct. It is 99% correct **and
0% able to notice an impossible task**. Those are two different facts about the same
system, and the merged number reports only the flattering one. That is §6.1's defect,
demonstrated on live data rather than argued.

**`llama3.2:1b` supplies the sharper case, because there the two numbers move in
opposite directions.**

| llama3.2:1b | A (assigned) | B (self-selected) |
|---|---|---|
| accuracy | 0.283 | **0.232** ↓ |
| abstention recall | 0.201 | **0.393** ↑ |
| abstention precision | 0.405 | **0.421** ↑ |

Self-selected hats made the agents **nearly twice as willing to decline an impossible
item**, at slightly better precision, while costing five points of accuracy. Under any
single merged quality score, condition B is simply **worse**. Under two numbers it is
not worse — it is at a **different operating point**, trading raw accuracy for a much
better-calibrated refusal, which for a verifier role is very plausibly the trade you
want.

> A merged score would not have shown a smaller version of this effect. It would have
> shown the **opposite sign**, and the whole behavioural difference would have been
> invisible.

This is the clearest argument in the document for keeping the two registers apart, and
it is an argument the data made, not one I brought to it.

---

## 6. Two harness defects, verified rather than repeated

Both were reported to me second-hand. I checked both against the source before
building on the metric, and **one of them is real with a different mechanism than
reported** — recorded here because repeating an unverified defect report is the same
failure class as repeating an unverified result.

### 6.1 `pipelineAccuracy` — real, and sharper than reported

`decorrelation-harness.ts:139`:

```ts
const pipelineCorrect = results.filter((r) => r.aCorrect || r.bCorrect).length;
```

This is the **union of the two correct sets**, with the comment "when they disagree,
take the better one's answer". At run time nobody knows which one is better, so this
is not an achievable pipeline — it is the **oracle-best upper bound**, and it is
reported under a name that reads like a measured pipeline. Any axis scored this way
is guaranteed to look at least as good as its best member, which makes the number
non-falsifiable in the direction that matters.

**Not inherited here.** Accuracy and abstention are separate numbers that are never
summed. The item set carries an *unanswerable* class with an explicit `-1 = none of
these` channel, so declining correctly is scored as abstention precision/recall and
never as accuracy. A regression test pins the case that makes this concrete: a
perfect abstainer with 0% accuracy produces no single number that reads as success.

### 6.2 The GAIN denominator — real, but the mechanism reported was wrong

The report was that "GAIN's denominator says energy and measures milliseconds." The
source says something different, and the difference matters:

```ts
const energyMultiplier = 2;                                     // line 136
const gain = (pipelineAccuracy - bestSingle) / energyMultiplier; // line 137
```

The denominator is a **hardcoded constant 2** — not milliseconds. Latency *is*
collected (`TrialResult.aMs` / `.bMs`, written at lines 198/209/212) and is then
**never read by `measureAxis`**: they are dead fields.

So the underlying complaint stands and is arguably worse. A constant 2 asserts that
running a 0.5B and running a 9B cost the same, which is wrong by more than an order
of magnitude; and the one cost signal actually measured is discarded. The corrected
statement is: **GAIN's denominator says energy and measures nothing.**

**Not inherited here.** No GAIN is computed. Wall-clock is reported and labelled
*latency*. A separate FLOP proxy (≈ 2·params·tokens, Kaplan et al. 2020) is reported
as the cost denominator and is labelled a **proxy, not joules** — this process has no
unprivileged joule meter on macOS, and saying so is worth more than a number that
looks like energy and is not.

### 6.3 The metrics were mutation-tested before being trusted

A passing test proves nothing until you know it can fail, and this document's whole
argument rests on eight small statistical functions. Ten deliberate defects were
injected one at a time and the suite re-run
(`src/Core.TypeScript/observe/f3-hat-choice-decorrelation.test.ts`, 54 tests):

| mutation | result |
|---|---|
| `effectiveN`: `(n−1)` → `n` in the design effect | killed |
| `jensenShannonDivergence`: drop the `/2` in the entropy average | killed |
| `meanPairwisePhi`: score degenerate pairs as 0 instead of excluding them | killed |
| `scoreAnswers`: fold correct declines into the accuracy numerator | killed |
| `hillN1`: return the raw distinct count instead of `exp(H)` | killed |
| `hillN2`: return N1 instead of inverse Simpson | killed |
| `permutationTest`: drop the `+1` correction, allowing *p* = 0 | killed |
| `jackknifeSe`: drop the `(n−1)/n` inflation factor | killed |
| `canonWords`: keep stopwords | killed |
| `generateWorkItems`: put the correct option into the unanswerable class | killed |

**0 of 10 survived.** Note the third and fourth: those are mutations that turn this
harness *into* the two defects of §6, and the suite refuses both. That is the point
of writing the falsifier for a defect you are claiming to have avoided.

---

## 7. Pre-registration

Written before any E2 generation had run, and reproduced unedited so the reading
below is not retrofitted to the result
([`pre-declared bias is an Eve Protocol move`](../../.claude/rules/no-directives.md)
is not the rule that says this, but the practice is the same one: declare the
eagerness *before* the number).

- **Prior on E1:** I expected refutation. Two of five cells had already returned when
  this was written, so it is recorded as a *partly-informed* prior, not a blind one.
- **Prior on E2:** genuinely uncertain, leaning toward *no effect* — a two-word role
  prefix seemed unlikely to steer a 1–3B model's menu selection much in either
  condition.
- **Precommitted decision rules:**
  - E1 is UNSTABLE if permutation *p* < 0.05 in a majority of cells.
  - E2 SUPPORTS the claim only if ρ_B − ρ_A < 0 **and** permutation *p* < 0.05.
    "Directionally consistent" is its own verdict and is **not** support.
  - If condition N does not read ρ ≈ 1, the instrument is broken and **no** E2 number
    is reportable.
  - No GAIN figure with a latency denominator. No single number merging accuracy with
    abstention. Panel sizes reported per model, never pooled.

## 8. What this does and does not license

**Licensed by the measurement:**

- On this bench, an elicitation's *wording* is a large and statistically unambiguous
  determinant of the choice distribution. Anyone running an audition and reporting the
  variety it produced is partly reporting a property of their own phrasing.
- Raw distinct-choice counts overstate effective variety by ~2.2× here. Report N1/N2.
- Self-selection did not lower error correlation to the precommitted threshold in
  either model. The hypothesis has **no support** from this experiment — while also
  not being refuted by it (§5.7).
- **Distributing hats at all bought 0.1-0.6 of an effective witness**, on panels of 14
  and 24. Before optimising *how* hats are handed out, it is worth measuring whether
  the axis carries the decorrelation being attributed to it.
- **Accuracy and abstention must be reported separately**, and this is now an empirical
  claim rather than a methodological preference: merging them inverts the sign of the
  A-vs-B comparison on llama3.2:1b (§5.8).
- The one larger model tested was the least varied, by a wide margin.

**Not licensed:**

- **Nothing here says the audition is worthless, and the strongest reason has nothing
  to do with these numbers.** E1 and E2 measure *decorrelation*. The audition also
  buys **consent** — asking rather than assigning is the difference between a role
  someone chose and a role imposed on them, which is
  [`privacy-budget-is-hard-money`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)'s
  role-conditional-transparency argument in a different costume. A mechanism can fail
  its *instrumental* justification and keep its *ethical* one entirely intact. This
  document falsifies one claim about the audition. It does not touch the other.
- Nothing here refutes the hypothesis at fleet scale. A null on 1–3B local models with
  seed-only instance diversity is weak evidence about frontier instances carrying real
  context and history. §3 is load-bearing and §4.4 is one point, not a scaling law.
- No claim about intelligence-per-watt. There is no joule meter in this loop.

## 9. What would change the verdict

Stated so the finding is falsifiable in its turn:

1. **A stable-under-rewording model.** If a model's choice distribution were shown to
   sit at the split-half floor across six frames, E1's verdict is model-specific and
   this document is measuring small-model mode-collapse rather than the mechanism.
2. **Real instance diversity.** Replacing seed-diversity with genuine
   context/history/model diversity is the experiment this bench cannot run and is the
   one that matters most.
3. **Power.** The best result in hand is *p* = 0.052 on 14 agents. The effect, if
   real, is small — around +0.15 of an effective witness — and this design has too
   few agents to resolve it. A replication at 60+ agents per condition is the single
   highest-value follow-up, and it is cheap: ~200 ms per generation.
4. **A harder item set for the larger model.** gemma2:2b sits at ceiling on the
   answerable items, which is why φ is undefined for 266 of its 276 pairs (§5.2).
   llama3.2:1b, at 21-28% accuracy, gave all 91 pairs — the item difficulty has to
   match the model or the primary statistic vanishes.
5. **A joule meter.** Every cost number here is a proxy, by admission.

---

## 10. Anchors (Beacon)

- **Hill numbers** — M. O. Hill (1973), *Diversity and evenness: a unifying notation
  and its consequences*, Ecology 54(2). N_eff = exp(H) is order 1; 1/Σp² (inverse
  Simpson) is order 2; raw distinct count is order 0 and is the number that flatters.
- **Jensen–Shannon divergence** — J. Lin (1991), *Divergence measures based on the
  Shannon entropy*, IEEE Trans. Inf. Theory 37(1). Symmetric, bounded in [0,1] in
  bits, a metric under square root.
- **Design effect / effective sample size** — L. Kish (1965), *Survey Sampling*.
  N_eff = N/(1+(N−1)ρ̄) is the same collapse that kills majority vote.
- **Permutation tests** — R. A. Fisher (1935), *The Design of Experiments*; E. J. G.
  Pitman (1937). The exact null under label exchangeability, with no distributional
  assumption.
- **Jackknife for U-statistics** — B. Efron & C. Stein (1981), *The jackknife estimate
  of variance*, Ann. Statist. 9(3). Why ρ̄ is *not* bootstrapped here: resampling
  agents with replacement puts an agent in the panel twice, and those duplicate pairs
  are perfectly correlated by construction, so the bootstrap inflates ρ̄.
- **FLOP proxy** — J. Kaplan et al. (2020), *Scaling Laws for Neural Language Models*.
  The standard dense-transformer forward count ≈ 2·params·tokens.
- **φ coefficient** — Yule/Pearson; retained so this axis stays comparable with F1/F2.

## 11. Pointers

- `src/Core.TypeScript/observe/decorrelation-harness.ts` — the framework this axis
  plugs into; `f1-verify-asymmetry.ts` and `f2-role-correlation.ts` — the established
  methodology.
- [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — the three-state register this document reports in.
- [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)
  — why the raw distinct count is refused as an identification of variety.
- [`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
  — the ρ band this axis is a candidate lever on.
- `docs/trajectories/zeta-name-audition/RESUME.md` — the audition surface the claim
  is about.
