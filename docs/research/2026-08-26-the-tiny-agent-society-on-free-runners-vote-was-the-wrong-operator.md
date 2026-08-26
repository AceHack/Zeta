# The tiny agent society on free runners — vote was the wrong operator, and the repo already said so

**Status:** design, for routing to Alexa. Not implemented.
**Occasion:** Alexa/Kiro's N=200 benchmark (#15429), which found the 3-model
ensemble *loses* to the best single model: 53.0% at 3× energy vs 59.5% at 1×.

## 0. The finding is a CONFIRMATION of in-repo math, not a refutation of the thesis

This is the part worth leading with, because it changes what the result licenses.

`src/Bayesian/CondorcetBoundary.fs` already models correlated majority vote and
already ships the operative quantity:

```fsharp
let effectiveN (n: int) (rho: float) : float =
    float n / (1.0 + float (n - 1) * rhoClamp)
```

Feed it the measured numbers — φ = 0.354 / 0.456 / 0.628, so mean ρ ≈ **0.479**:

```
N_eff = 3 / (1 + 2 × 0.479) = 1.53
```

**Three models were worth about one and a half voters.** Majority vote over ~1.5
effective voters cannot beat its best member; it can only dilute it. The measured
−6.5 pp is what the boundary predicts, not a surprise it failed to anticipate.

So the honest headline is *not* "small×distributed lost to large×centralized." It is:

> **An equal-weight majority vote was applied to heterogeneous, positively-correlated
> voters. That is the one regime where the operator is known to be wrong, and the
> repo's own boundary said so.**

Two independent defects, both fixable, neither about model size:

1. **Positive ρ** collapses N to N_eff. Aggregation buys nothing near ρ ≈ 0.5.
2. **Equal weights on unequal competence.** Optimal linear weights are
   `w_i ∝ log(c_i / (1 − c_i))` (Nitzan–Paroush; Grofman–Owen–Feld 1983):

   | model | c | w |
   |---|---|---|
   | qwen2.5:0.5b | 0.535 | +0.140 |
   | llama3.2:1b | 0.585 | +0.343 |
   | gemma2:2b | 0.595 | +0.385 |

   Equal-weight majority discards exactly this spread. It is *designed* to ignore
   that gemma is the best voter.

**Anchors (Beacon).** Condorcet (1785) for the jury theorem; Nitzan & Paroush
(1982) and Grofman, Owen & Feld (1983) for optimal weighted rules under
heterogeneous competence; Ladha (1992) for the correlated-voter degradation that
`effectiveN` encodes. None of this is new mathematics — it is the standard result,
and the measurement landed exactly where the standard result puts it.

## 1. The signature in the data points at the operator to use instead

`gemma2:2b`: **100% on easy+medium, 0% on hard+adversarial**, described as *knows
the rules perfectly but cannot find the answer buried in a long shuffled menu.*

That is not a knowledge deficit. It is a **search deficit**. And a search deficit
has a specific, exploitable property:

> **Producing is hard; checking is cheap.** A model that cannot locate the correct
> option in a 40-item menu may still, given a *candidate*, decide whether that
> candidate satisfies the rules — because it demonstrably knows the rules.

This is the produce/verify asymmetry, and it is the whole design. It is also
**falsifiable in one cheap experiment**, which is where the work should start.

Note the asymmetry does not need independence to help, which is precisely why it
escapes the ρ trap that killed the vote. A refutation is *evidence on its own
terms* — a counterexample either satisfies the rules or it does not — whereas a
vote is only evidence about a population.

## 2. The discriminated union — the society's move type

```fsharp
type Move<'Q, 'A> =
    | Propose   of question: 'Q * candidate: 'A * cost: RunnerSeconds
    | Verify    of candidate: 'A * verdict: Verdict * cost: RunnerSeconds
    | Refute    of candidate: 'A * counterexample: Witness
    | Arbitrate of contested: 'A list * choice: 'A * basis: Basis
    | Abstain   of reason: AbstainReason
and Verdict = Satisfies | Violates of rule: RuleId | Undecided
and AbstainReason = OutOfCompetence | BudgetExhausted | NoWitness
```

Three properties this buys, none of which majority vote has:

- **`Abstain` is first-class, not failure.** gemma at 0% on hard should *decline*,
  not guess. Selective prediction converts a 0% region into a routed region. The
  metric is a coverage–risk curve, not a scalar.
- **`Refute` carries a witness.** A refutation must exhibit a counterexample, so it
  is checkable by a third party and cannot be a bare assertion. This is the repo's
  `Evidence.AssertedOnly` discipline expressed in the move type.
- **The DU makes illegal aggregations unrepresentable.** There is no `Vote` case.
  If someone wants equal-weight voting back, they have to add a constructor and
  argue for it against §0.

## 3. Why GitHub free runners are the right substrate

`Lucent-Financial-Group/Zeta` is **public** (`visibility=public`), so GitHub-hosted
standard runners are **free and unmetered**. The society's compute cost is not
dollars; it is wall-clock and honesty. That inverts the usual constraint and makes
`ΔU per runner-second` the interesting denominator rather than a budget line.

**The matrix IS the society.** One matrix leg = one agent-move. The fan-out is free,
parallel, and already isolated. Nothing new needs building to get N agents.

**Decorrelation must be ENGINEERED, not hoped for.** This is the direct lesson of
ρ ≈ 0.479: three models given the same prompt, the same framing, and the same seed
are not three observers. The matrix axis is exactly where to inject divergence:

| axis | why it decorrelates |
|---|---|
| model + quantization | different training and rounding error |
| prompt frame | menu-order-shuffled vs rule-first vs candidate-first |
| seed | different sampling trajectory |
| runner OS | different tokenizer/BLAS numerics (small, but real and free) |
| **role** | a verifier's error mode is structurally unlike a producer's |

The last row is the one that matters. The first four move ρ a little; changing the
*role* changes what the error even is.

## 4. What gets measured — and the reporting rule that prevents the last mistake

**Always report `N_eff` beside `N`.** "3 models agreed" is a false statement about
evidence when N_eff = 1.53. This should be a lint on the benchmark output, not a
convention: a result that prints N without ρ is unreadable.

Primary metrics:

1. **ΔU per runner-second.** Accuracy alone is the axis on which the ensemble
   already lost. The frontier is accuracy *per unit energy*.
2. **ρ between ROLES**, not merely between models. If `ρ(producer, verifier)` is
   high, verification has degenerated into voting wearing a costume, and the design
   is dead. This is the measurement that keeps the design honest.
3. **Coverage–risk curve** for `Abstain`. Risk at 100% coverage is the current
   number; the question is how fast risk falls as coverage drops.
4. **Witness rate** for `Refute` — what fraction of refutations exhibit a
   counterexample that a third agent confirms. An unwitnessed refutation is an
   assertion.

## 5. The falsifiers — stated first, cheap first, each able to kill the design

Ordered so the cheapest disconfirmation runs first.

- **F1 — the asymmetry does not exist.** Measure verify-accuracy on the *same* hard
  + adversarial items where produce-accuracy is 0%. If verify ≈ produce, there is no
  asymmetry to exploit and **the design dies here**. This is one benchmark run over
  an existing item set, and it must run before anything is built.
- **F2 — verification is vote in disguise.** If `ρ(producer, verifier) > ~0.5`, the
  pipeline inherits the same N_eff collapse. Dead.
- **F3 — abstention buys nothing.** If the coverage–risk curve is flat, `Abstain` is
  ceremony. Drop the case.
- **F4 — the arbiter is the whole system.** If accuracy tracks the arbiter's solo
  accuracy, the society is one model with expensive decoration. Compare against
  arbiter-alone as the control, always.
- **F5 — free is not free.** If wall-clock per resolved item exceeds the single
  best model by more than the accuracy gain justifies, the frontier argument fails
  even at zero dollars.

**F1 is the gate.** Everything downstream is unbuilt until it passes.

## 6. What this does NOT claim

It does not claim small×distributed beats large×centralized. That thesis is
**untested** by the benchmark — what was tested is one aggregation operator, in the
regime where it is known to fail. It also does not claim verification will work;
F1 exists precisely because that is an open empirical question, and the honest
prior after §0 is that any *symmetric* aggregation over ρ ≈ 0.5 voters is doomed
regardless of how many are added.

The claim is narrower and, I think, defensible: **the experiment measured the
operator, not the architecture, and the repo's own boundary already told us which
operator that was.**

## Pointers

- `src/Bayesian/CondorcetBoundary.fs` — `effectiveN`, `societyBeatsBest`,
  `correlatedMajorityProbability`; the (ρ*, c*) boundary this note applies
- `src/Core/SocietyUsefulWork.fs` — the ΔU-union half; **do not conflate**, its
  hard boundary is ρ* = 1 and c* is an argmax, not a threshold
- `src/Core/TravelerRankLedger.fs` — per-(traveler × domain) competence, the
  natural home for `c_i` once weights stop being equal
- `src/Core.TypeScript/observe/model-benchmark-scale.ts` + `data/model-benchmark-scale.json` — the measurement (#15429)
- `.claude/rules/numerology-vs-number-theory.md` §"Too many correlations is a
  WARNING" — the same ρ lesson, stated for beliefs instead of voters
