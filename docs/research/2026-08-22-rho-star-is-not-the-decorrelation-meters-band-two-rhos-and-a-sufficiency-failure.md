# ρ\* is not the decorrelation meter's band — two ρ's, and a sufficiency failure

**Date:** 2026-08-22 · **Author:** shadow · **Register:** mixed, marked per claim

The question put to me: `docs/research/rhostar-analytic-proof.md` proves
ρ\*(N) = (N−3)/(3(N−1)) and is frozen-core §A; `src/Core.TypeScript/society/effective-agent-count.ts`
measures ρ over `db/mutation-findings/` and fails against a **hardcoded** band. Connect them — replace
the arbitrary constant with the proven threshold.

**Answer: they do not correspond, and the repair would be wrong in four independent ways.** The
documented connection is below, and the parts of it that are mechanically checkable are pinned in
`src/Core.TypeScript/society/rho-star-not-a-gate.ts` + test rather than left as prose.

## 0. Two corrections to the brief, up front

- **"`rhoStar` appears nowhere in `src/`" is false.** `[ran]` It appears in five source files —
  `src/Bayesian/CondorcetBoundary.fs` (`rhoStarAlgebraic`), `src/Core/DelayDecorrelation.fs`,
  `src/Core/MoneyVelocityOracle.fs`, `src/Core.TypeScript/costume-rho/estimate-rho.ts` and
  `validate.ts`. The costume-rho experiment already compares measured ρ against `rhoStarAlgebraic(N)`
  and states why it uses that rather than `findRhoStar`. The connection has been made; it was simply
  never made *in this meter*, which is a narrower and more interesting fact.
- **"nobody has connected them" is false for the modelling question too.**
  `docs/research/2026-08-16-wiring-the-condorcet-society-*.md` §1a–1c settles it in advance, and
  §3's `[ran]` line already notes `rhoStarAlgebraic 3 = 0` for this exact `[alexa, otto, soraya]`
  roster. I did not need to derive the answer; I needed to find it.

## 1. Aaron's question — "is the fleet a jury?" — splits

He answered *yes for code changes*, with a propose-then-adversarially-review workflow. That **is** the
jury shape. But it is not the population this meter reads.

`[read]` `mutation-runner.ts` builds candidates from `git log --since="24 hours ago"`, pairs them with
sibling tests, and selects via `selectTarget`:

```ts
h = FNV1a(agent); h = (h ^ tick) * 16777619; return items[h % items.length];
```

An agent's identity contributes **one fixed 32-bit constant**. There is no proposition, no verdict, no
competence — three agents hashing into a shared list collide at a rate set by the list's *length*. So
the corpus measured here is not the jury Aaron means; the jury is the proposal/review workflow, which
this meter does not observe. Both can be true at once, and are.

## 2. Aaron's caution — "I don't know if it's the same ρ, in some of our math we've made ρ irrelevant"

`[read]` He is right, and the place is `src/Core/AggregationRule.fs` / `society/aggregation-rule.ts`:

> *"No correlation threshold appears here and none should be added — PR #10945 showed `rho` is not a
> sufficient statistic for the verdict."*

Two distinct senses, and both matter:

**(a) ρ is irrelevant to the SIGN under union aggregation.** `[ran]` `SocietyUsefulWork.expectedGain`
ships `(1−ρ)(1−c)(1−(1−c)^(n−1))·Σv`, strictly positive for every ρ < 1, exactly zero at ρ = 1.
Correlation attenuates the society's advantage and **never reverses it**. There is no ρ\* in this
regime — and `rhoFromUnionCoverage`, the failing estimator, inverts precisely this model.

**(b) ρ is not sufficient even under majority vote.** `[ran]` Recomputing the Dominance Lift
counterexamples exactly (two-point exchangeable mixtures, no simulation):

| label | m | ρ\*(m) | ρ | P(single) | P(majority) | lift | inside ρ\*? |
|---|---|---|---|---|---|---|---|
| m5 published | 5 | 0.1667 | 0.1668 | 0.5001 | 0.4403 | **−0.0597** | no (marginal) |
| m9 published | 9 | 0.2500 | **0.2501** | 0.5004 | 0.3741 | **−0.1263** | **no (marginal)** |
| m9 reproducing | 9 | 0.2500 | **0.2493** | 0.5002 | 0.3741 | **−0.1261** | **yes** |
| m15 published | 15 | 0.2857 | 0.2847 | 0.5005 | 0.3206 | **−0.1799** | yes |
| m51 published | 51 | 0.3200 | 0.2249 | 0.5001 | 0.2254 | **−0.2743** | yes |

**An owned correction.** The `m = 9` row is quoted in three module headers as *"ρ = 0.2495, inside the
published safe ρ\*(9) = 0.25"*. At the table's own 3-decimal mixing law (θ_hi = 0.999) it computes to
ρ = 0.2501 — **marginally outside**. The finding is unaffected: θ_hi = 0.998 gives ρ = 0.2493, strictly
inside, with the same −0.126 reversal, and `m = 15` / `m = 51` reproduce as published. The table
rounded past the boundary it was making a claim about. Both rows are now byte-locked so the correction
cannot rot back.

## 3. The four reasons, collected

1. **Wrong aggregation rule** — ρ\* exists only under majority vote; the meter is a union statistic.
2. **Wrong random variable** — ρ\* is error correlation; the meter is exposure correlation, and the
   exposure is a hash, not a judgement.
3. **ρ is not a sufficient statistic** — reversal occurs inside the "safe" region; the bound *crosses*
   the true reversal locus rather than bounding it, and is unsafe for c ≲ 0.68.
4. **Unsatisfiable anyway** — `[ran]` ρ\* rises to a supremum of 1/3; measured ρ ≈ 0.607. **No N
   reaches it.** ρ\*(3)=0, ρ\*(4)=0.111, ρ\*(5)=0.167, ρ\*(9)=0.25, ρ\*(21)=0.30, ρ\*(∞)=1/3.

Reason 4 is worth stating plainly because "add a fourth persona" is the intuitive fix and, *if* the
quantities corresponded, it would not work at any roster size.

## 4. ρ\*(3) = 0 is a degenerate corner, not a violation

`[read]` The proof says so itself: *"It holds for all N ≥ 4 (for N ≤ 3, ρ\*(N) = 0 …)"*, and
`rhoStarAlgebraic` returns `0.0` for `n <= 3` by a guard. `[ran]` The guard is in fact **redundant**:
the closed form already evaluates to exactly 0 at n = 3, so N_eff ≥ 3 with N = 3 saturates at
independence. Reporting "we measure 0.60 against a threshold of 0" as a violation would be reading a
boundary artifact as a result. It would also produce a test that **can never pass** — a correlation
clamped to [0,1] is never `< 0` — which is the vacuity class inverted: not a check that cannot fail,
but a gate that cannot go green.

## 5. What replaced the band — the relationship, not a level

#13753 established that the cumulative statistic **cannot carry a fixed upper bound at all**: a null
model whose agents' sampling distribution never changes still drives cumulative ρ from 0.156 to 0.949
as the corpus grows. It deliberately left the assertion red rather than swap a failing number for a
passing one in the same change that argued the number was wrong. That was right, and it left the
completion open.

The completion is **not** a wider level and **not** ρ\*. It is the observation that the test's own name
— *"the independent union-coverage estimator corroborates without restating"* — describes a
**relationship between two estimators**, and that relationship is invariant where the level is not.
`[ran]` Across the 741-point landed series, during which ρ itself moved 0.156 → 0.63:

| property | cumulative | windowed |
|---|---|---|
| `rhoFromUnion > rhoIcc` | **741/741** | **741/741** |
| ratio `rhoFromUnion / rhoIcc` | [1.0948, 1.5057] | [1.0695, 1.5794] |
| gap `\|rhoFromUnion − rhoIcc\|` | ≥ 0.0314 | ≥ 0.0314 |

**The direction is labelled EMPIRICAL, and that is an owned correction.** I first wrote that it was
structural — that unequal draw rates make three real agents cover less than three identical ones at
their mean rate, so the union estimator absorbs the shortfall as correlation. `[ran]` That is
backwards: the independent union is *convex* in the per-agent rates (AM-GM on `prod(1-p_i)` at fixed
sum), so unequal rates *raise* coverage and would push the estimator **down**. At the live rates
197/198/171 of 757: unequal 0.577127 vs equal-at-mean 0.576823 — wrong direction, and 3e-4, far too
small to account for the observed ~0.06 gap. The mechanism is **not** established; the regularity is.

So the assertions are non-degeneracy (0 < ρ < 1 — not vacuous, since `rhoFromUnionCoverage` has no
clamp and can return negative or > 1), the empirical direction, and the non-restatement gap. A drafted
`ratio < 2.5` ceiling was **removed**: `[ran]` the same four mutants die 4/4 with and without it, so it
carried no discriminating power, and an inert magic constant installed inside an argument that magic
constants on this statistic are unsupportable would have been the very move being refused.

`[ran]` **Mutation-verified:** 4 mutants on the union estimator — sign flip, spread sign, exponent
off-by-one, and aliasing `rhoFromUnion := rhoIcc` — **4/4 killed**.

**And the honest cost, recorded in the test itself:** this form is weaker than the level band against a
shift that moves `rhoFromUnion` alone within the ratio bound. That is the price of dropping a bound the
statistic cannot carry. Level surveillance belongs in `rho-series.ts`, which has a stationary windowed
instrument and a null model to compare against; it does not belong in a per-run assertion over an
append-only corpus.

## 5b. The frame problem is upstream of the band, and it was found twice independently

The sibling ρ-series work landed a fourth finding: `mutation-runner` draws from the last 24 hours of
churn, not the declared 757-file universe, so the meter substantially reads **repo churn breadth**.

That is the same observation as my §3 reason 2, reached from the opposite direction — I got there by
asking *"is this ρ the error-correlation ρ\* bounds?"* and reading `selectTarget`; the series got there
by asking *"why is cumulative ρ drifting?"* and reading `mutation-runner`. Two agents, two routes, one
mechanism. Worth naming as such rather than as agreement: it is the first thing in this thread that
was **independently** corroborated rather than inherited.

**The consequence is sharper than either framing alone, and it constrains this PR.** If the meter is
substantially measuring churn, then **no bound is the right answer yet — not ρ\*, not a re-derived
window** — because a correct bound on the wrong quantity is still wrong. That is precisely why the
repair in §5 asserts **estimator consistency** (direction, non-degeneracy, non-restatement), which is
frame-independent, and asserts **nothing about the level**, which is not. A drafted ratio ceiling was
removed for the same reason after it measured as carrying zero discriminating power.

## 6. "Is the society progressing well enough to warrant a fourth persona?" — not answerable yet, and here is why

`[ran]` Daily means over the 60-commit windowed series (`db/effective-agent-count/`):

| day | mean ρ_ICC | mean nEff | mean poolFraction |
|---|---|---|---|
| 08-17 | 0.2015 | 2.150 | 0.291 |
| 08-18 | 0.2162 | 2.134 | 0.289 |
| 08-19 | 0.5822 | 1.398 | 0.099 |
| 08-20 | **0.7110** | **1.239** | **0.061** |
| 08-21 | 0.6147 | 1.349 | 0.075 |
| 08-22 | 0.5952 | 1.370 | 0.095 |

Two readings, and the second dominates:

- **The society did degrade and is partially recovering.** nEff fell from ~2.15 to 1.24 and is back to
  1.37. Three agents are currently worth ~1.4 independent ones.
- **But ρ is mostly not measuring the agents.** `[ran]` **corr(poolFraction, ρ_ICC) = −0.8555** over
  741 points — r² ≈ 0.73. The 24-hour churn pool is what moves this meter. When the repo changes few
  files, three agents hashing into a short list collide, and ρ rises with no change in agent
  behaviour whatsoever.

**So the honest answer to the fourth-persona question is: this meter cannot answer it yet.** Roughly
three-quarters of its variance is repo churn breadth. A fourth persona would change the head count and
the collision arithmetic simultaneously, and the meter as it stands could not separate the two.
`[proposed]` The prerequisite is to make the sampling frame independent of churn — either draw from
the declared frame rather than the 24-hour list, or record the pool length per tick and condition on
it — after which "did adding an agent help" becomes a question the series can answer.

## 7. Register

- **metered** — everything marked `[ran]`: the ladder, the mixture recomputations, the union-gain
  positivity, the poolFraction correlation. Falsifiers in `rho-star-not-a-gate.test.ts`; 7 mutants
  applied, 6 killed, 1 proven **equivalent** (weakening the `n <= 3` guard to `n <= 2` differs nowhere
  on the integer domain — recorded rather than papered over).
- **toy, and left a toy** — `YinYangEnsemble.reseedIfCollapsed` fires at
  `tsirelsonThreshold = ρ\*/√2 = 1/(3√2) ≈ 0.2357`, the reseed trigger Aaron asked about. Its own
  proof §6 calls ρ_T *"a design choice … not a derived result"*, fixed by the map ρ = S/12 chosen for
  homoiconicity with Bell/CHSH. It inherits every defect above (it is majority-vote, and ρ\* is not
  sufficient), so it is related here and **not** promoted. ρ\* being §A does not make it §A.

## Leftovers this document cites and does not close

- **leftover-on-main #13753** named the 24h-frame finding (`corr(poolFraction, ρ_ICC) = −0.8555`).
  The PR landed; the frame itself is still open. This document cites it. It does not close it.
- **leftover-on-main #13785** sealed series depth against the checked-in TSV
  `db/effective-agent-count/rho-series-cumulative.tsv`. Git-log depth is not the series
  assertion. The 56756b29 conjunctive shallow-and-blind skip (`is-shallow-repository` AND
  `commits.length <= 1`) was a **fetch-depth hatch**, not a series claim. It is not
  reintroduced.
- **leftover-on-main #13817** still asserts `rhoFromUnion / rhoIcc < 2.5` on `main`. That
  expect is gone here (tombstone comment only).

## Pointers

- `src/Core.TypeScript/society/rho-star-not-a-gate.ts` + `.test.ts` + `golden-vectors-rho-star-not-a-gate.json`
  — discharges obligation **L3** of the Dominance Lift doc ("land the §4.3 counterexample as a
  byte-locked golden vector — it is the falsifier for any future ρ\* claim"), assigned to shadow.
- `docs/research/rhostar-analytic-proof.md` — the theorem, undisputed here.
- `docs/research/2026-08-14-does-society-beats-best-individual-lift-to-world-beats-best-society-the-dominance-lift-theorem.md` §4.3.
- `docs/research/2026-08-16-wiring-the-condorcet-society-*.md` §1a–1c — the aggregation-rule split.
- `docs/research/2026-08-22-the-decorrelation-meter-left-its-band-and-i-may-be-the-reason.md` — the band's own story.

## Anchors (Beacon)

de Finetti (1931) exchangeability · Condorcet (1785) · Dunnett & Sobel (1955) correlated binomials ·
Kish (1965) design effect · Nitzan & Paroush (1982) optimal weighted majority.
