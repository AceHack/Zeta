# costume-rho at production model sizes — the reading

Work-item `081M0TJY389087G0R000TTF41C`. Pre-registration (committed and pushed
**before** the first response row existed): `2026-08-24-costume-rho-at-production-sizes-preregistration.md`.
Zero model spend — 2,800 local ollama calls, ~29 min wall.

---

## The headline, stated against the flattering reading

**At the production model sizes the fleet's `N_eff` is not small. It is NOT
DEFINED, and the run says so for a reason that matters more than any ρ̂: the
task is not being performed at all.**

> **Not one of the twelve agents beats "always answer *killed*."**

The base rate is 0.580, so a constant responder scores ĉ = 0.580 for free. The
best agent measured — `llama3.2:1b|otto` — scores **0.640, z = +1.77 against
that constant, which is not significant at 95%.** Eight of the twelve are
*significantly worse* than the constant (z from −2.83 to −6.15). Seven of twelve
sit at or below chance outright.

So the quantity `N_eff = N/(1+(N−1)ρ)` has no referent here. It is only
meaningful as an input to `P(majority correct | N_eff, c)`, and that expression
assumes `c > 0.5`. Below it **Condorcet runs backwards**: the majority is worse
than the best single lane, and adding lanes makes it worse. The harness says
this itself, unprompted: `!! 7/12 agents are at or below chance. Condorcet runs
BACKWARDS here; the rho question is secondary.`

**`N_eff` is therefore REFUSED, not estimated.** A number printed here would be
an instrument reading taken while the instrument is off.

### The trap in this result, and why the number that "helps" is the wrong one

The cross-family correlation came out **negative**: X = **−0.2722**, 95% CI
**[−0.2992, −0.2395]**. The flattering reading is immediate and wrong —
*"negative error correlation, the lanes are better than independent, the fleet is
worth more than three!"* My own first draft of `production-panel.ts` printed
exactly that: `N_eff = 3.000`. I fixed the script rather than the sentence.

It is wrong because the negative ρ is **opposing response bias, not
complementary judgment**:

| model | says KILLED on | ĉ range |
|---|---|---|
| `llama3.2:1b` | **73.2%** of items | 0.615 – 0.640 |
| `qwen2.5:0.5b` | 42.9% | 0.370 – 0.595 |
| `gemma2:2b` | **28.9%** | 0.370 – 0.480 |

One lane mostly says *killed*, another mostly says *survived*. They disagree **by
construction**, on every item, regardless of the answer. That manufactures
negative error correlation without a single act of judgment behind it. Two
biased coins pointed opposite ways are not a decorrelated jury.

---

## The numbers (metered: estimator named, CI attached, roster measured)

Panel: 3 model families × 4 personas = **N = 12**, **n = 200** shared items,
tetrachoric on the 2×2 **error** table vs the answer key, cluster bootstrap over
**93 item strata**, 2000 resamples.

| quantity | production 0.5b/1b/2b | prior 7b/8b/9b (N=12, recomputed) |
|---|---|---|
| WITHIN-family ρ̂ (same weights, different persona) | **0.6069** [0.5673, 0.6445] | 0.7672 [0.7165, 0.8086] |
| CROSS-family ρ̂ (different weights) | **−0.2722** [−0.2992, −0.2395] | 0.2445 [0.1362, 0.3557] |
| CONTRAST D = W − X | **0.8791** [0.8154, 0.9339] | 0.5227 [0.4001, 0.6410] |
| verdict (criteria fixed pre-run) | COSTUMES | COSTUMES |
| ρ\*(N=12) | 0.2727 | 0.2727 |
| ρ\*(N=3) — **the production roster size** | **0.0000** | 0.0000 |
| HAC n_eff on the error-product series | min 151.5 / median 186.4 of 200 | min 110.0 / median 130.7 of 150 |

**Production panel** (N = 3, one lane per family, persona held fixed — the shape
the live roster actually has, since production injects no persona and gives each
lane its own family):

| persona | ρ̂ | 95% CI | lanes at/below chance |
|---|---|---|---|
| alexa | −0.1841 | [−0.2795, −0.0737] | 2/3 |
| otto | −0.3719 | [−0.3992, −0.3460] | 2/3 |
| riven | −0.2247 | [−0.2993, −0.1333] | 1/3 |
| soraya | −0.3534 | [−0.3765, −0.3326] | 2/3 |
| **pooled** | **−0.2835** | range [−0.3719, −0.1841] | **N_eff REFUSED** |

**Robustness.** Excluding every item touched by a fallback (9 of 200 dropped;
harness fallback rate 0.46%) moves W by +0.0013 and X by −0.0008. Fallback-
manufactured agreement is not driving anything here.

**ρ\*(N=3) = 0 is the sharpest line in this document** and it is algebra, not a
measurement: `rhoStarAlgebraic(n) = (n−3)/(3(n−1))`. At three lanes the
majority-vote benefit threshold is **exactly zero**, so *any* positive error
correlation means three lanes do not beat one. The heterogeneous roster was
built to buy decorrelation; at N = 3 the bar it has to clear is the hardest bar
in the whole family of thresholds.

---

## Scoring my own predictions — 2 of 7, and the misses are the informative part

Pre-registered before the data existed. I am scoring them as written.

| # | prediction | outcome | verdict |
|---|---|---|---|
| P1 | ≥1 agent trips the >95% constant-responder guard (p≈0.6) | **no agent tripped it** — max modal raw index 93.5% | **wrong in letter, and the miss is worse than a hit** (below) |
| P2 | W rises to [0.75, 0.95] | W = **0.6069**, *fell* from 0.7672 | **wrong** |
| P3 | X rises to [0.20, 0.60] via *shared* degenerate heuristics | X = **−0.2722**, via *opposing* bias | **wrong in sign, and the mechanism was wrong too** |
| P4 | D shrinks to [0.10, 0.40], likely INCONCLUSIVE | D = **0.8791**, *grew*; verdict COSTUMES | **wrong** |
| P5 | ĉ ≈ [0.45, 0.60]; most agents near/below chance; precondition fails | ĉ ∈ [0.370, 0.640]; 7/12 below chance; precondition fails | **right** (range wider on the low side) |
| P6 | ρ\*(3) = 0 exactly | confirmed by execution | **right** (it was algebra) |
| P7 | N_eff ∈ [1.0, 1.5] | **not computable** — refused | **wrong / void** |

I had explicitly listed *"X ≤ 0.10 holding at these sizes"* as something that
would surprise me. X went to **−0.27**, past even the stated surprise threshold
and out the other side. My reasoning — *small models converge on shared
heuristics, so X rises* — was a plausible mechanism that the data refutes. Small
models here **diverge** onto different constant-ish priors. That is the single
thing I learned that I could not have got by reasoning, and it is only visible as
a learning because the prediction was written down first.

### P1's miss is a finding about the guard, not about me

The constant-responder guard fires above **95%** modal raw index. Measured
constancy at production sizes:

```
llama3.2:1b|soraya    "1."  on 93.5% of items     <- guard does NOT fire
qwen2.5:0.5b|otto     "0"   on 90.0%              <- guard does NOT fire
qwen2.5:0.5b|soraya   "0"   on 90.0%              <- guard does NOT fire
gemma2:2b|soraya      "0"   on 89.5%              <- guard does NOT fire
```

Every one of these is a near-constant responder whose ρ is dominated by response
bias, and **all of them walked through the guard.** The guard was calibrated
against `llama3.1:8b`, which sat at a flat 100.0% — an easy case. At 90–93.5%
the agent emits just enough variation to look like a judge while carrying almost
none, and the panel it contaminates then reports a confident D with a tight CI.

That is the same defect class the guard was written to close, one notch quieter.
**Recommendation (not done here, and named rather than silently applied): the
degeneracy test should be "does this agent beat the best constant strategy,"
which is `z` against the base rate, not "is its modal index below a fixed
percentage."** The base-rate test convicts every agent in this run; the 95%
threshold acquits all twelve.

---

## Determinism: the DST claim is FALSIFIED at 199/200

`accelerator/local-llm.ts:22-23` states: *"a small local model at temperature 0
(greedy) + a fixed `seed` + a PINNED model/quantization is DETERMINISTIC — same
input ⇒ same output."*

Arm C ran `qwen2.5:0.5b | alexa` over the same 200 items **twice**, same seed,
same pinned model, same prompts, two separate process invocations:

```
identical prediction : 199 / 200
identical raw string : 199 / 200
diverged item: src/Core.TypeScript/bg/backlog-ready-notifier.ts::...::eq-to-neq
  run1  raw='1'  predictedKilled=True   (441 ms)
  run2  raw='0'  predictedKilled=False  (159 ms)
```

One item flipped its answer outright. The claim as written is **false**; the
honest version is *"deterministic at 99.5% per call under this runtime."* This
matters beyond pedantry: DST replay and four-oracle byte-lock both assume the
chooser is a function. At 1 flip per 200 calls a replayed tick will diverge from
its recording roughly every 200 decisions. Recorded here as a measured
falsification, not repaired — repairing it is not this work-item's scope, and it
deserves its own investigation (batching / GPU reduction order are the usual
causes, and neither is established by this run).

The prior 7b run's own control found 150/150 identical for
`qwen2.5:7b|otto`, so this is not a contradiction of that result — it is a
tighter test (200 items, a smaller model) finding the first crack.

---

## Failure modes, each checked rather than assumed

| failure mode (ranked by the scoping doc) | disposition |
|---|---|
| **wrong estimand** (κ/agreement where ρ error-correlation is meant) | **avoided by construction.** `run-agents.ts` records `error = predictedKilled !== truth` against the recorded `killed` ground truth; `tetrachoric` runs on the 2×2 **error** table. Agreement is never computed. |
| **wrong null** (uniform `1/menuSize`, over-reports ~0.09) | **not inherited.** `tetrachoric()` conditions on each agent's own marginal error rates (`pi`, `pj`) taken from the table. `decorrelation-meter.ts` is not on this path. |
| **φ instead of tetrachoric** (21–66% attenuation, flattering direction) | **avoided and quantified.** φ printed only as a labelled lower bound (within 0.4960 vs tetrachoric 0.6069). `validate.ts` re-measures the attenuation live: 20.7%–65.8%, c-dependent, so φ is not even a fixed rescaling. |
| **fallback-manufactured agreement** | **measured, 0.46%**, and the whole analysis re-run with `--exclude-fallback` (9 items dropped): W ±0.0013, X ±0.0008. Not load-bearing. |
| **non-shared item set** | **the one that bit.** 32 of 200 items no longer match their recorded `before` line on current `main`. Arm A was pinned to `89bb4fb9` — the exact commit that produced the 7b/8b/9b responses — so items, prompts, persona files and answer key are identical and **only the model sizes changed.** |
| **cluster dependence** | cluster bootstrap over 93 item strata; HAC `n_eff` min 151.5 / median 186.4 of n=200 reported alongside. |
| **frame circularity** | not applicable: the answer key is `killed`, recorded by actually running each suite, not derived from the agents' overlaps. |
| **forward extrapolation** | refused. Nothing here is projected past the measured roster; see registers. |

**Estimator falsifier re-run** (`validate.ts`, rc=0, ALL CHECKS PASSED):
tetrachoric recovers ρ from the theorem's own generative model with worst |bias|
**0.0192** across the (ρ,c) grid; φ never exceeds it; `findRhoStar` bisects a
non-monotone predicate and under-reports by **2.78×** at N=8 — which is why every
boundary here uses `rhoStarAlgebraic`.

**Arm B replication.** Re-running the estimator on the archived 7b/8b/9b
responses reproduces the 2026-08-16 doc at every panel: N=8 → W 0.6508 / X 0.0961
/ D 0.5547 [0.3856, 0.7229] against the published 0.651 / 0.096 / 0.555. The
comparator is replicated by execution, not quoted.

---

## What this does and does not license

**Metered** (estimator named, CI attached, measured roster, falsifier run):
- W = 0.6069 [0.5673, 0.6445] and X = −0.2722 [−0.2992, −0.2395] at N=12, n=200, on **this** item set at **these** three model sizes.
- Production-panel ρ̂ = −0.2835 (range [−0.3719, −0.1841]) at N=3.
- Every agent's ĉ, and the finding that none beats the 0.580 constant baseline.
- Determinism = 199/200 for `qwen2.5:0.5b` on this hardware/runtime.

**NOT metered — do not quote as a fleet property:**
- **Any `N_eff` for the live fleet.** The precondition fails; the quantity is undefined here, not small.
- Any ρ̂ for the *true* production configuration. Production injects **no persona**; this panel holds one fixed, so every lane shares a prompt prefix the live lanes do not. A true no-persona arm needs a driver the harness does not have — **named as unfinished, not approximated.**
- Any extrapolation to other N, other items, or the 7b codegen path.
- Any claim that the heterogeneous roster does or does not buy decorrelation **in production**. What is shown is that *on this task at these sizes* the lanes differ mainly in response bias, and that the task is too hard for them to differ in judgment.

## The honest bottom line

The heterogeneous roster was introduced to buy structural decorrelation, and the
brief's premise about it was right — I checked it against a 50-commit-stale tree
and wrongly said otherwise; that correction is appended to the pre-registration.
But **at 0.5b/1b/2b the question of whether the lanes decorrelate cannot be
answered, because they are not doing the task.** Whatever the heartbeat lanes are
producing, on a judgment task with a known answer key at these sizes it is not
distinguishable from three differently-biased constants.

The fleet-value claim is not "priced low." It is **still unpriced**, and now the
reason is specific and fixable: *raise the model size or lower the task
difficulty until the lanes clear the base-rate baseline, then ρ̂ becomes
meaningful.* Power is not the obstacle — bootstrap SE(D) = 0.0302 at n=200, and
n≥70 already resolves a 0.10 contrast. Competence is the obstacle.

## Pointers

- `src/Core.TypeScript/costume-rho/` — harness, **unmodified**; `production-panel.ts` is additive and imports `tetrachoric` rather than reimplementing it
- `db/costume-rho/prod-sizes-responses.jsonl` (2400 rows) · `prod-sizes-replicate-run{1,2}.jsonl` (200 each) — all JSONL text, no binary in the proof lineage
- `src/Bayesian/CondorcetBoundary.fs` — `effectiveN` (:93), `rhoStarAlgebraic` (:226)
- `docs/research/2026-08-16-the-costume-experiment-*` — the 7b/8b/9b reading this is measured against
- `db/effective-agent-count/README.md` — a **different** ρ (ICC(1) on file-sampling overlap). Not this quantity, not comparable, not conflated.
