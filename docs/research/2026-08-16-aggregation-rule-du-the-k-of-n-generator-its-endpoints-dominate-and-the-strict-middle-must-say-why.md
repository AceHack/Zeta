# The aggregation-rule DU: k-of-n is the generator, its endpoints dominate, and the strict middle must say why

> **Provenance.** Aaron 2026-08-16 authorized this — _"sounds good"_ — to a discriminated union of
> aggregation rules plus a classification pass, framed by him as _"discriminated unions we can pick
> for the right tasks at hand… building blocks we can model on."_ Otto routed it to the shadow. The
> type and the pass are the shadow's (Claude Opus 5).
>
> **Register.** The DU is **`unmetered`** (`toy-is-free-metered-must-be-earned`): nothing in the repo
> consumes it to change a decision yet, and it earns `metered` when a rule change is blocked or
> admitted because of it — not before. The `classify` / `ofKOfN` / `dominanceAxes` / `toBooleanRule`
> functions **are** metered: each has a test that fails when the behaviour changes.
>
> **No aggregation behaviour was changed.** This is typing plus classification. Changing how the
> society reaches verdicts is architectural and is Aaron's.

---

## 0. What this adds to PR #10945 and PR #10955

Neither prior result is re-derived here.

- **#10945** proved the **Dominance Lift Theorem**: an aggregation rule beats its best part **iff it
  can imitate that part**. Union qualifies; log-odds-weighted majority qualifies (Nitzan–Paroush
  1982); unweighted k-of-n does not, and loses to its best member in **58.8% of 20 000 exact draws at
  ρ = 0** — heterogeneity, not correlation, is the killer.
- **#10955** inventoried **21 live aggregation sites** and classified each by reading the aggregation
  expression: 3 does-not-qualify, 2 weights-not-competence, 6 qualifies, 10 not-an-accuracy-aggregator.

What is new is a **type** that makes the distinction unsayable-in-passing, and a **pass** that runs
every one of the 21 sites through it. Two things fell out that neither prior pass could have found,
because neither had a name for them: a **mirror defect** and a **missing rule case**.

---

## 1. The type

Shipped twice, and the F# is not a port — it is where a proof can be pointed
(Aaron: F# _"lets us get close to the math and formal analysis"_).

- `src/Core/AggregationRule.fs`
- `src/Core.TypeScript/society/aggregation-rule.ts`

Pure: no instance state, no classes, no behaviour. Nothing in either file aggregates anything.

### 1.1 The structural fact the type exists to carry

**k-of-n is the generator and the dominating rules are its endpoints.** `Union` is `k = 1`, `Veto` is
`k = n`, unweighted majority is `k = ⌈n/2⌉`. One parameterised building block produces all three —
`only-the-irreducible-is-primitive-generate-the-rest` — so the generator ships, as `ofKOfN`, and it
**normalises**:

```fsharp
let ofKOfN (k: int) (n: int) (why: Justification) : Rule =
    let n = max 1 n
    if k <= 1 then Union
    elif k >= n then Veto
    else Threshold(k, why)
```

**But the family is smooth in `k` and the dominance property is not.** It holds at both endpoints and
fails everywhere strictly between. A DU of `KOfN of int` would be a faithful parameterisation that
silently hides the one fact a caller needs. So the strict middle is a **different case**, and it
carries a mandatory `Justification`:

| case                             | `k`              | dominates on                                                             |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `Union`                          | 1                | **recall** — `⋃Aᵢ ⊇ A_{i*}`, set monotonicity                            |
| `Veto`                           | n                | **safety** — `⋂Aᵢ ⊆ A_{i*}`, any unit can stop it                        |
| `Weighted of WeightBasis`        | —                | **accuracy**, _if_ the basis is a competence or an endogenous likelihood |
| `Threshold of k * Justification` | strict middle    | **nothing** — and it has to say why it is nonetheless right              |
| `Plurality of Justification`     | argmax, no floor | **nothing** — see §4.1                                                   |
| `AllOf` / `AnyOf`                | —                | conjunction keeps safety, disjunction keeps recall                       |

This is the earned-privilege pattern (`interfaces-free-classes-earned-under-rules`) at the value
level: **the dominating rules are free; the non-dominating one must be justified at the point of use.**

### 1.2 The justification field is what keeps BFT honest

`k = 2f+1` is correct in a Byzantine quorum, justified by **fault tolerance**, not by accuracy over
heterogeneous competences. Without the field, the type would be calling BFT a defect — which #10955
verified it is not. `Justification` therefore carries `FaultTolerance of f`, `IntegrityCheck`,
`IndependenceCheck`, `Legitimacy`, `Authorization`, `LivenessPrecondition`, `ModelNotMechanism`,
`PricedPrecisionTrade of rationale` — and `Unstated of note`, which is a **legal, and damning,**
answer.

Two guards keep that from becoming an escape hatch, and both are tested:

- **The same k, at a site claiming an accuracy objective, is still a finding.** The rule shape does
  not change; the _purpose_ does. `classify TwoSidedAccuracy (Threshold(3, FaultTolerance 1))` is
  `DoesNotDominate`.
- **A bare quorum cannot borrow a comfortable label.** If a site declares itself a fault-tolerance
  mechanism but its threshold names something else, the verdict is
  `JustificationDisagreesWithPurpose`, not `OutOfScope`.

### 1.3 Order statistics — the same generator, a different codomain

On a totally ordered result the k-of-n family **is** the order statistics: `max` is `k = 1`, `min` is
`k = n`, the median is `k = ⌈n/2⌉` ("the largest value at least `k` members are at or above"). So a
median-of-estimates is the same strict middle as an unweighted majority wearing a different statistic,
and inherits the same verdict.

The prediction is checkable, and it checks out against work done before the algebra existed: #10955
independently recommended replacing `rmo.ts`'s median of staffing targets with the **max** where
under-staffing is the expensive error. That is exactly `ofKOfN 1 n`, i.e. `Union` — arrived at from
the code, not from the type.

### 1.4 Relation to `Levels.Aggregation.canImitateEveryProjection`

The DU **connects to** the shipped witness check rather than duplicating it: `imitationWitnesses`
derives, from the rule itself, the witness family `canImitateEveryProjection` asks for — for `Union`,
the input where only `i` accepts; for `Veto`, where only `i` rejects. Both discharge it.

**And there is a finding here, recorded rather than fixed** (see §5): the witness check asks for
pointwise agreement on **one caller-chosen input per index**, which is much weaker than "the
projection lies in the rule class", and **unweighted 2-of-3 discharges it** with the witness family
`[[T,T,F]; [F,T,T]; [F,T,T]]`. The helper's docstring already forbids reading a discharge as a
dominance result; this pass pins _why_ that caveat is load-bearing rather than decorative, and locks
the counterexample as a test.

---

## 2. The classification pass — all 21 sites, each as one DU case

Verdicts are locked as text keys in `tests/Tests.FSharp/AggregationRule.Tests.fs` and duplicated
byte-for-byte in `src/Core.TypeScript/society/aggregation-rule.test.ts`. If the two oracles ever
disagree, the classification has diverged.

| #   | site                                                     | purpose                            | rule                                              | verdict                     |
| --- | -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- | --------------------------- |
| 1   | `review-board.ts:115`                                    | Recall                             | `Threshold(3, Unstated)`                          | **DoesNotDominate**         |
| 2   | `workflow-engine/consensus.ts:195`                       | TwoSidedAccuracy                   | `Threshold(k, Unstated)`                          | **DoesNotDominate**         |
| 3   | `rmo.ts:331-338` (median)                                | TwoSidedAccuracy                   | `Threshold(⌈n/2⌉, Unstated)`                      | **DoesNotDominate**         |
| 4   | `ThousandBrains.fs:73`                                   | TwoSidedAccuracy                   | `Weighted(ExperienceProxy "log(1+IV)")`           | DeferenceReachableNotChosen |
| 5   | `QuorumAlgebra.fs:151`                                   | TwoSidedAccuracy                   | `Weighted(SelfAsserted "amplitude")`              | DeferenceReachableNotChosen |
| 6   | `SocietyUsefulWork.fs:32,82`                             | Recall                             | `Union`                                           | Dominates (recall)          |
| 7   | `BeliefConvergence.fs:33,63`                             | TwoSidedAccuracy                   | `Weighted(EndogenousEvidence "likelihood ratio")` | Dominates (accuracy)        |
| 8   | `SocietyBootstrap.fs` + `SparseSocietyNetwork.fs`        | TwoSidedAccuracy                   | `Weighted(EndogenousEvidence "inverse variance")` | Dominates (accuracy)        |
| 9   | `LocalConsensus.fs:52`                                   | TwoSidedAccuracy                   | `Weighted(EndogenousEvidence "inverse variance")` | Dominates (accuracy)        |
| 10  | `MutualFalsification.fs:185`                             | Recall                             | `Union`                                           | Dominates (recall)          |
| 11  | `DecorrelationMeter.fs` + `DecorrelationExcessFusion.fs` | Recall                             | `Union` (`List.max` = `k = 1`)                    | Dominates (recall)          |
| 12  | `Consensus.cs` / `Consensus.fs` (BFT)                    | NonAccuracy(FaultTolerance)        | `Threshold(2f+1, FaultTolerance)`                 | OutOfScope                  |
| 13  | `SybilBft.fs` / `SybilBftProtocol.fs`                    | NonAccuracy(FaultTolerance)        | `Threshold(2f+1, FaultTolerance)`                 | OutOfScope                  |
| 14  | `nway-diff.ts:407,456`                                   | NonAccuracy(IntegrityCheck)        | **`Plurality(IntegrityCheck)`**                   | OutOfScope                  |
| 15  | `constitution-gate.ts:93-110`                            | NonAccuracy(Legitimacy)            | **`AllOf [Veto; Threshold(q, Legitimacy)]`**      | OutOfScope                  |
| 16  | `change-control-policy.ts:35` (security stage)           | **Safety**                         | `Veto` (3 of 3)                                   | **Dominates (safety)**      |
| 17  | `work-market.ts:625-645`                                 | NonAccuracy(Authorization)         | `Threshold(k, Authorization)`                     | OutOfScope                  |
| 18  | `mutual-repair.ts:34-40`                                 | NonAccuracy(LivenessPrecondition)  | `Threshold(3, LivenessPrecondition)`              | OutOfScope                  |
| 19  | `Veridicality.fs:200`                                    | NonAccuracy(**IndependenceCheck**) | `Threshold(2, IndependenceCheck)`                 | OutOfScope                  |
| 20  | `Diversity.fs:45`                                        | NonAccuracy(ModelNotMechanism)     | **`Plurality(ModelNotMechanism)`**                | OutOfScope                  |
| 21  | `CondorcetBoundary.fs`                                   | NonAccuracy(ModelNotMechanism)     | `Threshold(k, ModelNotMechanism)`                 | OutOfScope                  |

### 2.1 Counts, and the one delta from #10955

| verdict                     | count | #10955's bucket                   |
| --------------------------- | ----- | --------------------------------- |
| Dominates                   | **7** | "qualifies" = 6                   |
| DeferenceReachableNotChosen | 2     | 2                                 |
| DoesNotDominate             | 3     | 3                                 |
| OutOfScope                  | **9** | "not-an-accuracy-aggregator" = 10 |

**The delta is one row, and it is a promotion, not a demotion.** The change-control **security stage**
is quorum **3 of 3** — `k = n`, which `ofKOfN` normalises to `Veto` — on a **safety** objective. So it
does not merely fall outside the accuracy theorem; it **dominates on the safety axis**. #10955 filed
it under "not an accuracy aggregator" because it is not accuracy, and that is true; the triangle in
that same document already says veto dominates on safety, so this is the doc agreeing with itself more
precisely once the axis is a value rather than prose.

---

## 3. The mirror sweep — the quadrant nobody had examined

The brief's request: _a safety-shaped task with an accept-dominant rule, or vice versa, becomes a
visible mismatch rather than something nobody looked for._ It falls out of `ofKOfN` normalising,
because `k = n` **is** `Veto` whether or not anyone noticed.

Several sites are one rule at their default configuration and a different rule at another. Those are
recorded separately (so the count of _sites_ stays #10955's 21) and are where the sweep lands:

| regime                                          | rule after normalisation | verdict                                           |
| ----------------------------------------------- | ------------------------ | ------------------------------------------------- |
| **`review-board` at `n = quorum`**              | **`Veto`**               | **MirrorMismatch(needed recall, offered safety)** |
| `work-market` at `requiredApprovals = 1`        | `Union`                  | OutOfScope (authorization)                        |
| `consensus.ts` mechanism `unanimous`            | `Veto`                   | WrongAxis(needed accuracy, offered safety)        |
| `consensus.ts` mechanism `first-n-agree, n = 1` | `Union`                  | WrongAxis(needed accuracy, offered recall)        |
| `consensus.ts` mechanism `supermajority`        | `Threshold`              | DoesNotDominate (unstated)                        |

### 3.1 The one mirror defect, stated precisely

`review-board.ts:146` refuses to convene unless `reviewerCount >= quorum`, and `DEFAULT_REVIEW_QUORUM`
is 3. **At the minimum convening size the quorum is every reviewer.** So in that regime the rule is
not "3 of many" — it is `k = n`, **unanimity**, on a task whose dominant rule is union.

This is strictly sharper than #10955's finding, which said the site "dominates on nothing." In the
minimum-convening regime it _does_ dominate — **on the opposite axis to the one the task needs.** The
type reports `MirrorMismatch(OnRecall, OnSafety)` without anyone having to notice the coincidence
between `quorum` and the convening floor.

**Honest scope.** This is a statement about the rule at a configuration, established by reading
`review-board.ts:143-149`. It is **not** a measurement of how often boards actually convene at exactly
`quorum` reviewers — no such measurement was taken, and the claim must not be rounded up into one.

### 3.2 The other arm, referenced and not touched

The gate above the board (`review-gate.ts:81-83`) approves when nothing is adopted. That is
accept-by-default on an outcome whose expensive error is a shipped defect — the _other_ half of the
same mirror. **A sibling agent is actively fixing that fail-open, so neither
`packages/application/src/review-gate.ts` nor `packages/metrics/src/review-board.ts` was edited here.**
Recorded so the two halves are legible as one shape, not so this pass claims the fix.

---

## 4. What did not fit — findings about the taxonomy, not forced rows

### 4.1 Plurality is not a threshold, and the type had to grow a case

Two sites select by **argmax over a tally with no floor**, and neither is a k-of-n threshold:

- `Diversity.fs:45` — `countBy id |> maxBy snd`.
- `nway-diff.ts:456` — the reference fallback when no canonical value exists.

The difference is not cosmetic: **a threshold refuses when unmet; plurality never refuses.** Over more
than two candidates it can return a value backed by a minority of a minority. Rendering it as
`Threshold` would have credited it with a floor it does not have, so `Plurality of Justification` was
added. It dominates on nothing, for the same reason the strict middle does and then some.

**Naming observation, not a behaviour finding:** the helper at `nway-diff.ts:456` is **named**
`majority` and is plurality — it returns the most common value with no absolute-majority test. In its
actual use the discrepancy is benign (it is the fallback reference, and every dissent is reported
regardless), so this is filed as a naming honesty note, not a defect.

### 4.2 `IndependenceCheck` had no home in the four buckets

`Veridicality.fs:200` requires ≥ 2 **distinct root authorities**. It counts _independence_, not votes
— it exists to refuse pseudo-consensus (fifty claims tracing to one upstream are one piece of
evidence). That is neither an accuracy aggregator nor any of #10955's other named non-accuracy kinds:
it is a site that **checks the theorem's own independence hypothesis** rather than aggregating under
it. `Justification.IndependenceCheck` was added for it.

### 4.3 "One site, one DU case" is true only at a fixed configuration

This is the honest limitation of the whole exercise. Three sites compute their rule from runtime
configuration (`review-board`'s `quorum` against reviewer count, `consensus.ts`'s four mechanisms,
`work-market`'s `requiredApprovals`). A single DU value describes such a site only **at a stated
configuration**, which is why the regime table in §3 exists and is kept separate. A taxonomy that
pretended otherwise would have had to pick one configuration per site and would have missed exactly
the mirror defect in §3.1.

### 4.4 `rmo.ts`'s median fits only through the order-statistic reading

Recorded as `Threshold(⌈n/2⌉, …)` on the reading in §1.3. That reading is an argument, stated in the
module header, not a fact read off the code — the code computes a median of numbers, and calling it a
k-of-n threshold is an identification I am making. It is offered as such.

### 4.5 Cases that ship unpopulated, and why each is not a hidden mechanism

The exhaustiveness tests **force** each of these to be declared, with a reason, or fail:

| case                                        | status      | why it ships anyway                                                                                                                                                                                                                            |
| ------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WeightBasis.LogOddsCompetence`             | **no site** | **This is the finding.** Nobody in this repo weights by a _measured_ competence — #10955's central recommendation, restated as a type. The available dominating rules today are the free ones.                                                 |
| `Justification.PricedPrecisionTrade`        | **no site** | The defence a quorum gate is _entitled_ to make. #10955 looked for it at the review board and did not find it. Without the case, a legitimate quorum would be mislabelled a defect — and a finding that fires on every threshold is worthless. |
| `Rule.AnyOf`                                | no site     | Its dominance law is the exact dual of `AllOf`'s (earned by `constitution-gate`). Shipping one half of a lattice would misrepresent the algebra.                                                                                               |
| `Verdict.JustificationDisagreesWithPurpose` | not reached | A **guard**, not a classification. That no site triggers it is the good outcome; its falsifier constructs the disagreement deliberately.                                                                                                       |

---

## 5. A finding about a shipped predicate, recorded and not fixed

`Levels.Aggregation.canImitateEveryProjection` (PR #10952) is **discharged by unweighted 2-of-3** —
the canonical non-deferential rule — with the witness family `[[T,T,F]; [F,T,T]; [F,T,T]]`. Verified,
and locked as a test in both oracles.

The helper's own docstring already says a discharge is the hypothesis and not the conclusion, and
forbids citing it as a dominance result. So this is **not** a claim that the module is wrong. It is
the reason the structural verdict in this DU is not redundant with it, and it is the measurement the
caveat was asserting without: a check that the thing it is meant to exclude can pass is a weak check,
and now there is a locked counterexample to measure any future strengthening against.

**Not changed here** for two reasons: a sibling agent is editing `src/Core/Levels.fs` for asymmetric
level obligations, and strengthening a shipped predicate is a behaviour change.

---

## 6. Method, and what was not verified

- Every row's **purpose** and **rule** comes from #10955, which established them by reading the
  aggregation expression. Where this pass changed a classification (row 16) or added a case (§4.1,
  §4.2), the underlying code was re-read here: `change-control-policy.ts:35`
  (`hatIds: [security_a, security_b, security_c], threshold: 3`), `review-board.ts:143-149`,
  `constitution-gate.ts:85-110`, `nway-diff.ts:456`, `Diversity.fs:41-46`, `Veridicality.fs:199-210`,
  `work-market.ts:625-645`, `run-org-cadence.ts:761`.
- **No aggregation logic was changed.** No file outside the two new modules, their two test files, and
  the two project manifests was edited.
- **No empirical claim** is made about any site's error rate. The 58.8% figure belongs to #10945's
  synthetic draws and is quoted, not reproduced.
- **Liveness** is inherited from #10955 (`has a non-test caller`, established by grep) and was not
  re-established.
- The **cross-oracle lock** proves the two implementations agree on the classification. It proves
  nothing about whether a classified site behaves as classified.

---

## Pointers

- `src/Core/AggregationRule.fs` · `src/Core.TypeScript/society/aggregation-rule.ts` — the DU
- `tests/Tests.FSharp/AggregationRule.Tests.fs` · `src/Core.TypeScript/society/aggregation-rule.test.ts` — the falsifiers, the inventory fixture, the cross-oracle lock
- `docs/research/2026-08-14-does-society-beats-best-individual-lift-to-world-beats-best-society-the-dominance-lift-theorem.md` — the theorem (§3 union, §4.1 heterogeneity, §6 the lift, §6.1 the three costs)
- `docs/research/2026-08-16-dominance-lift-aggregation-inventory-where-unweighted-majority-already-bites.md` — the 21-site inventory this pass types
- `src/Core/Levels.fs` §`Aggregation` — `canImitateEveryProjection`, and §5 above
- `.claude/rules/interfaces-free-classes-earned-under-rules.md` — free default, earned privilege; the shape this type applies to values
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — k-of-n as the generator, the dominating rules as recovered endpoints
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why the DU is `unmetered` and the functions are `metered`
- **Beacon anchors (checked):** Nitzan & Paroush, _Optimal Decision Rules in Uncertain Dichotomous
  Choice Situations_, International Economic Review 23(2):289–297, 1982 — optimal aggregation of
  independent experts is weighted majority with `wᵢ = log(cᵢ/(1−cᵢ))`, each weight depending only on
  that expert's own competence. Condorcet, _Essai sur l'application de l'analyse…_, 1785 — the
  identical-competence hypothesis the unweighted rules silently assume.
