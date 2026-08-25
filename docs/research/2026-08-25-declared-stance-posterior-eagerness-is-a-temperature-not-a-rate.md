# The declared-stance posterior — eagerness is a temperature, not a rate

**Work-item:** `081M0X49HBD087G0R001HM9VHF`
**Composes with:** the Eve Protocol primitive *pre-declared bias*
(`docs/backlog/P2/081KRW63S0008QG0R0030F8ZXA-eve-protocol-*.md`, PR #15414 — the
per-exchange half) and `src/Core/TravelerRankLedger.fs` (the EP posterior this reuses).
**Ships:** `src/Core/DeclaredStanceLedger.fs` + `tests/Tests.FSharp/DeclaredStanceLedger.Tests.fs`.

Aaron 2026-08-25, sharpening the primitive:

> *"yes this is very accurate over a bayesian inference prior on individuals, similar to
> TrueSkill. eager is also aggressive and reaches local optima quicker and gets stuck,
> it's mostly selfish but not always in the extremes."*

Three claims. This document argues one of them, operationalises a second, and declines
the third — and says why the decline is the honest answer rather than a shortfall.

---

## 0. The line this whole design is built on

> **The outcome record is trackable. The inner state is not.**

*"This party's claims declared under `Eager` have held up 40% of the time"* is a
measurement of **results**. *"This party is an eager person"* is an inference about their
**inner life** — forbidden by
[`engagement-profiles-public-work-only-not-surveillance-dossiers.md`](../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md)
(ask, never infer, about internal states) and contradicted by pigeonhole-by-self-claim
(the subject supplies the category, the evidence supplies the truth value).

The line is not held by good intentions. It is held by three structural properties of the
module, each with a falsifier:

| # | property | falsifier |
|---|---|---|
| 1 | `Stance` has exactly one introduction form, `declare`, which **refuses** when the declarer is not the subject. There is no function in the module with return type `Stance` — the stance is always an input, never an output. An observer cannot compute one. | `DSL-1`, `DSL-3` |
| 2 | The stance is a **key**, not a value. It selects which cell an outcome is filed under; nothing updates, corrects, or re-derives it. | `DSL-13`, `DSL-30` |
| 3 | Everything the module *emits* is a statistic over resolved claims — `holdRate`, `informativeness`, `searchProfile`, `beneficiaryProfile`. Each is a property of published claims and their published resolutions. | the whole suite |

Where the design pushed against the line, it lost: see §3, where the third claim is
declined outright because the only way to model it was to model a motive.

---

## 1. Composition — the declaration is an observation, the record is the posterior

The Eve primitive is **per-exchange**: a party states, before the result arrives, that it
wants a particular answer to be true. This module is **across-exchange**: what a
counterparty uses when no declaration is offered, or when it wants to know whether this
party's declarations have historically meant anything.

The join is that the declaration **is the cell key**:

```
cell = (party, domain, DECLARED stance)   →   TrueSkill/ADF posterior over "does it hold up"
```

Keying by the self-claim is what makes the design legitimate rather than merely careful.
The module never has to decide what a party *is*; it only ever reports how claims filed
under a self-chosen label turned out. Conditioning on a self-claim is the same move as
TrueSkill conditioning on a self-chosen hat-domain.

### 1.1 The case the brief singles out: declares `neutral`, record says otherwise

The honest answer, and the one implemented:

> **The record is evidence. The declaration is still authority over intent — not over
> accuracy.**

Concretely, three states, and none of them relabels the party:

| state | what the receiver uses | `PriorBasis` |
|---|---|---|
| the party's cells **separate** (hold rates differ by ≥ `SEPARATION_EPS`, both above the evidence floor) | that cell's posterior | `DeclaredCell stance` |
| the party's cells are **indistinguishable** | pooled across stances | `PooledAcrossStances` |
| not enough evidence | 0.5, the honest prior | `HonestPrior` |

The middle row is the answer to the question. A party declaring `Neutral` whose
neutral-declared claims resolve exactly like its eager-declared ones has a declaration
that **carries no information for this party** — so the receiver stops conditioning on it
and pools. What does *not* happen:

- The party is not reclassified as eager. Its `Neutral` claims stay filed under `Neutral`
  (`DSL-30` asserts the cell still holds five observations after pooling).
- No verdict is attached. `DeclarationCarriesNoInformation` names a **fact** and is
  exactly as consistent with a party that is uniformly reliable as with one whose
  self-report is off — per
  [`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md),
  the mechanism reports, the caller's oracle reads.

The honest limit worth stating: pooling is a *fallback*, not a correction. It says "this
label did not sort your outcomes", not "you were wrong about yourself".

### 1.2 The reciprocal obligation, made structural

The Eve row requires the receiver to declare its own stake in the same exchange. Here that
is a **required field**: `Exchange` carries two `Declaration`s, so a one-sided disclosure
is not representable and `weigh` cannot be reached from one. `openExchange` additionally
refuses an exchange a party holds with itself (`DSL-8`) — otherwise a party could
manufacture its own confirmation and satisfy §4's independence requirement with itself.

### 1.3 Timing is logical, not wall-clock

The Eve row makes timing load-bearing: declared *before* the result is a disclosure,
offered *after* is an excuse. The obvious implementation is a timestamp, and it would be
wrong here —
[`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
forbids a local clock filtering evidence into a shared fold, because two receivers with
different receive times would then fold different evidence sets and diverge. So
`DeclaredAtPhase` / `ResultPhase` are **logical phase ordinals** on the exchange.
`DSL-37` pins it negatively: two identical `declare` calls produce **equal** values, which
fails the moment any ambient source is captured.

---

## 2. The dynamics — a variance, not a rate

> *"eager is also aggressive and reaches local optima quicker and gets stuck"*

This is an exploration/exploitation characterisation. The question the brief asks is which
single parameter it is. There are two candidates and they make **opposite** predictions,
so the question is decidable rather than a matter of taste.

### 2.1 The rate reading fails on the second half

A *rate* is a step size: `x_{k+1} = x_k − α∇f(x_k)`. The classical conditions for
stochastic approximation (Robbins & Monro 1951, *Ann. Math. Statist.* 22(3):400–407) are
`Σα_k = ∞`, `Σα_k² < ∞` — a schedule that must decay, but not too fast.

What does a **large** α do? On a quadratic with curvature `L`, gradient descent diverges
for `α > 2/L`: the failure mode of a high rate is **overshoot and oscillation**, not
premature settling. In non-convex landscapes a large step is actively *anti*-sticking — it
is the standard explanation for why a large initial learning rate biases toward wide
basins, since a large step cannot remain inside a narrow one (Li, Wei & Ma 2019, *Towards
Explaining the Regularization Effect of Initial Large Learning Rate in Training Neural
Networks*, NeurIPS 2019; cf. Keskar et al. 2017, *On Large-Batch Training … Sharp Minima*,
ICLR 2017).

So the rate reading predicts the **opposite** of "gets stuck". It captures "aggressive"
and contradicts the rest of the sentence.

### 2.2 The temperature reading generates both symptoms

A *temperature* is a noise scale — the size of the worsening a search will tolerate.
Simulated annealing (Kirkpatrick, Gelatt & Vecchi 1983, *Science* 220(4598):671–680;
independently Černý 1985, *J. Optim. Theory Appl.* 45:41–51) accepts an uphill move with
probability `exp(−Δ/T)`.

- **Low `T`** ⇒ almost every accepted move is a descent move ⇒ the search descends hard
  and fast — this **is** "aggressive" — and then **freezes into whatever basin it is in**.
- **High `T`** ⇒ frequent uphill moves ⇒ slow, wandering, escapes basins.

The sharp form is a theorem. Hajek (1988), *Cooling schedules for optimal annealing*,
*Mathematics of Operations Research* 13(2):311–329, gives the necessary-and-sufficient
condition for convergence in probability to the **global** optimum: the schedule must
satisfy `T(k) ≥ d / log(k)`, where `d` is the depth of the deepest non-global local
minimum. Cool faster than logarithmically and the search still converges — but with
**positive probability to a local optimum**.

That is Aaron's sentence stated as a theorem: *faster cooling buys faster convergence and
pays for it in probability of the global optimum.* One parameter, both symptoms.

### 2.3 The bandit statement of the same thing

The same result appears in the exploration/exploitation literature with different
vocabulary, which is worth recording because it is the vocabulary a governance protocol
will actually reach for. Boltzmann action selection uses `π(a) ∝ exp(Q(a)/τ)` — the same
`τ`; greedy is `τ → 0`. Lai & Robbins (1985), *Asymptotically efficient adaptive
allocation rules*, *Adv. Appl. Math.* 6(1):4–22, prove the `Ω(log T)` lower bound: any
policy with sub-polynomial regret **must** sample each suboptimal arm on the order of
`log T` times. Auer, Cesa-Bianchi & Fischer (2002), *Finite-time Analysis of the
Multiarmed Bandit Problem*, *Machine Learning* 47:235–256, give the finite-time (UCB1)
version.

The consequence for a greedy policy is the standard one: it commits to whichever arm
looked best on an early, small sample and never revisits — **linear** regret. "Reaches
local optima quicker and gets stuck", in bandit vocabulary, and again a theorem rather
than an analogy.

### 2.4 The Bayesian restatement — and why it is an identification, not a coincidence

The ledger already contains an annealing schedule, which is why this is more than a
pleasing parallel. In the ADF update this module reuses from `TravelerRankLedger`:

```
μ_new = μ + σ² · sign · v(t)/√(σ²+β²)      ← the step is PROPORTIONAL to σ²
σ²_new = σ² · (1 − w(t)·σ²/(σ²+β²))         ← σ² is strictly decreasing
```

`σ²` is the temperature. It starts high (the search moves), decreases monotonically with
evidence (the schedule cools), and once it is small, new observations barely move `μ` —
the posterior has frozen. Modelling eagerness as an **effective-sample-size inflation**
`κ > 1` (treating each observation as if it carried `κ` observations' worth of evidence)
collapses `σ²` faster and therefore freezes `μ` earlier. One parameter, three vocabularies:

| vocabulary | parameter | eager = |
|---|---|---|
| annealing | temperature `T` | fast cooling |
| bandit | `τ` / exploration bonus | near-greedy |
| Bayes | posterior variance `σ²`, evidence weight `κ` | `κ > 1`, σ² collapses early |

Per [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md),
the check is whether structure — not a matching count — connects them. It does: in all
three, the parameter multiplies the *variance of the update*, not the *magnitude of the
step*, and in all three the fast-parameter regime is provably the one that converges
quickly to a possibly-wrong answer.

### 2.5 The answer, and what it costs

> **Eagerness is best modelled as a variance (a temperature), not as a rate.**
> "Aggressive" is the *consequence*, not the parameter: at low temperature every accepted
> move is a descent move, which looks aggressive from outside. A rate model reproduces
> the aggression and contradicts the stuckness; a temperature model produces both.

The honest caveat: the *full* picture is two parameters (a step size **and** a
temperature), and if both are available, "aggressive" is the rate and "gets stuck" is the
temperature. Forced to one — which is what a protocol parameter is — it is the
temperature, because it is the only one of the two that generates both named symptoms.

### 2.6 What is toy and what is metered

`κ` is a **toy** and is labelled as one. Nothing here measures any party's `κ`, and
**fitting one to a person would be exactly the forbidden inference** — a temperature is a
property of how a mind searches. So the model does not appear in the code as a parameter
of anyone.

What appears instead is the model's **observable signature** in the outcome record. If a
posterior freezes early, later claims in a run resolve no better than earlier ones. That
is `searchProfile`: hold rate of the later half of a cell's history minus the earlier
half, reported as `MarginalYieldRising` / `Flat` / `Falling`, with an
`InsufficientHistory` refusal below six observations (`DSL-32`).

It names the fact and not the reading, because it must: **flat marginal yield is equally
consistent with a party that was simply right from the start.** Calling it "stuck" would
be the vacuity failure — a statistic that convicts under either interpretation.

**Unverified, and stated as unverified.** The characterisation predicts that flat marginal
yield should be *more common* under `Eager` declarations than under `Neutral` or `Averse`
ones. We have **no data** on that. It is the natural falsifier for §2 and it cannot run
until a corpus of declared exchanges with resolutions exists. Until then §2 is an
argument, not a measurement.

---

## 3. The tails — DECLINED, and the decline is enforced by a test

> *"it's mostly selfish but not always in the extremes"*

This is a real claim about a non-monotone mapping, and the brief is right that a monotone
`eager ⇒ selfish` mapping contradicts it. It is **declined**, for two independent reasons
either of which is sufficient.

**Reason 1 — it is the forbidden inference, in its purest form.** Selfishness is a
*motivation*. A function from a declared stance to self-interest is precisely a model of
inner life derived from a self-claim, and shipping it would make this module a personality
model wearing a ledger's clothes — the exact failure the brief said to stop for. Note this
reason does not depend on the shape being hard; it would apply to a shape we knew exactly.

**Reason 2 — the shape is unidentified anyway.** "Mostly increasing, unconstrained at both
ends" is not a shape; it is an infinite family of them. The evidence is one introspective
self-report. Under the ask-don't-infer discipline that report is authority over Aaron's
own account and is explicitly **not** authority over its own causes (Nisbett & Wilson 1977,
*Telling More Than We Can Know*, *Psychological Review* 84(3):231–259 — people confabulate
reasons); under `numerology-vs-number-theory` it is a generator, not a conclusion. Drawing
a curve through n=1 is the coincidence-promoted-to-belief move.

### 3.1 What was built instead

The measurement, without the model. Each resolution carries a `Beneficiary`:

```
AccruedToClaimant | AccruedToBoth | AccruedToOthers
```

Who the resolved claim's realised value **actually accrued to** is an allocation you can
observe. `beneficiaryProfile` reports the raw counts and derives no scalar from them. If
the tail claim is ever to be checked, this is the column it would be checked in.

And the decline is **enforced**, not merely intended: `DSL-31` asserts that `weigh` is
invariant to the beneficiary counts — two ledgers identical except that one party's claims
all benefited itself and the other's all benefited others produce byte-identical
weightings. The test carries a control (the allocations *were* recorded, `(6,0,0)` vs
`(0,0,6)`), so the invariance is a design choice and not an artefact of the data never
arriving. Wire in a monotone selfishness penalty and it goes red — mutation `M10`, killed.

### 3.2 One structural note, offered as a hypothesis and not modelled

There is a mechanical reason the extremes could be non-monotone without anyone's motives
changing: **at the extreme, the investment itself is costly to the investor.** A party
that has spent enormously on a claim has, by construction, transferred value away from
itself; the beneficiary column can flip sign with no change in intent at all. That would
make "selfish" and "self-sacrificing" hard to distinguish behaviourally exactly where
Aaron says the monotone reading breaks.

It is recorded as a **hypothesis with no data**, per the coincidence-index discipline: the
register is stored with the observation so it can be promoted later if structure arrives,
and never silently becomes a belief.

### 3.3 A consequence for the type

`Stance` deliberately carries **no continuous intensity**. A scalar "eagerness level" is
precisely what would invite the monotone curve Aaron's own statement contradicts, and it
would also be an inference target — an observer could regress it. Three ordinal,
self-claimed values, and no more.

---

## 4. What a receiver actually does — *weight the evidence, not the enthusiasm*

The Eve row's operational sentence is:

> An eager claim requires an **independent** confirmation, because the eager party's own
> corroboration is **correlated with itself**. An eager party producing five supporting
> arguments has produced approximately one.

"Approximately one" is a quantity, and it has a name. **Kish's design effect** (Kish 1965,
*Survey Sampling*, Wiley, §8.2) is `deff = 1 + (m−1)·ρ`, hence

```
n_eff = n / (1 + (n−1)·ρ)
```

At `ρ = 1` this is **exactly 1 for every n**. So the row's sentence is not a slogan; it is
the `ρ → 1` limit of a standard identity. (The same identity is already in this repo, in
`src/Bayesian/CondorcetBoundary.fs` `effectiveN`, for correlated jurors — the restatement
in `Zeta.Core` is because `Zeta.Core` does not depend on `Zeta.Bayesian`.)

`effectiveCorroborations` groups supports by **source** (ordinal), discounts within a
source, and sums across sources: distinct sources are treated as independent, a source is
correlated with itself. A receiver requires `REQUIRED_EFFECTIVE_CORROBORATIONS = 2.0` — the
claimant plus one genuinely independent confirmation — before it may act without seeking
another source (`DSL-27`, `DSL-28`).

### 4.1 `ρ = 1` is a bound, not a fitted number

The default `CONSERVATIVE_WITHIN_SOURCE_RHO = 1.0` says: everything one source says about
its own claim counts once. Any smaller value would be an invented number asserting that a
party's self-corroborations are *partly* independent of each other, which nothing here has
measured. Choosing the bound is what keeps this metered rather than toy — and `DSL-26` is
the control that proves the discount is a formula and not a switch (`ρ = 0` gives
`n_eff = n`; `ρ = 0.5` gives strictly between).

### 4.2 EAGER IS NOT A DISCOUNT — enforced

`RequiresIndependentConfirmation` **never reads the stance.** This is deliberate and it is
the refinement that keeps the primitive usable: the Eve row warns that "eager ⇒ trust
less" would make declaring costly, and a costly disclosure does not get made. Making the
independence requirement *stance-blind* means declaring `Eager` costs a party **nothing**
— which is what the row's self-enforcement argument requires.

`DSL-24` is the falsifier: two parties with identical outcome records, differing only in
the stance they declared, weigh identically in every field. Wire in a stance penalty and it
goes red — mutation `M9`, killed.

What declaring honestly *does* buy is the other direction: a party whose declarations sort
its outcomes builds a **discriminating** record, and its counterparties get a sharper prior
in both directions.

---

## 5. Disciplines

| discipline | how |
|---|---|
| **#4 DST** | no wall clock; logical phase ordinals only; `DSL-36` replays a sequence to an identical ledger, `DSL-37` pins the absence of an ambient source |
| **#6 Idempotency** | `record` is keyed by `claimId`; replay is upsert (`DSL-20`, with a control that a *different* id does fold in) |
| **#8 DV2.0** | the cell key `(party, domain, stance)` is the hub; the belief + history is the fast-changing satellite |
| **#13 Noninterference** | the only doors into the fold are a `Declaration` and a `Resolution`; nothing ambient enters |
| **Culture-invariant** | `StringComparison.Ordinal` throughout; `DSL-3` is the falsifier (a case-folded comparison lets an observer declare on a subject's behalf) |
| **Result-over-exception** | every refusing constructor returns `Result` |
| **Toy vs metered** | `κ` (§2.4) is labelled toy and appears in no code path; the Kish discount and the ADF posterior are metered |

---

## 6. Pointers

- `src/Core/DeclaredStanceLedger.fs` — the module.
- `tests/Tests.FSharp/DeclaredStanceLedger.Tests.fs` — 35 falsifiers, `DSL-1`…`DSL-37`.
- `src/Core/TravelerRankLedger.fs` — the EP/ADF posterior reused here (Herbrich, Minka,
  Graepel 2006).
- `src/Bayesian/CondorcetBoundary.fs` — `effectiveN`, the same Kish identity for jurors.
- `docs/backlog/P2/081KRW63S0008QG0R0030F8ZXA-eve-protocol-*.md` — the per-exchange
  primitive (PR #15414, merged 2026-08-25); it now carries a §*The posterior half* pointer
  back to this document.
- [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)
  — the socially-conferred discipline this ledger inherits: the record is held by others
  and is never self-asserted.
