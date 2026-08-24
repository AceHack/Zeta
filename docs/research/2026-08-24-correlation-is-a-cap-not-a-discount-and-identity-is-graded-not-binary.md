# Correlation is a cap, not a discount — and identity is graded, not binary

**Register:** Aaron's framing (Mirror), with the formula it lands on already built and cited.
The formula is `metered` where it is exercised; **the society's actual `ρ` is UNMEASURED**, which
`SocietyUsefulWork.fs` states about itself. Nothing here measures it either.

## 1. The observation

Aaron 2026-08-24, on the anti-Sybil question:

> *"two correlated entities is weaker than two decorrelated ones — both are valid but one
> grants more identity than another."*

and, on the consequence:

> *"correlation is a cap."*

## 2. The formula is already in the repo, and it says exactly that

`src/Bayesian/CondorcetBoundary.fs:36`:

```text
N_eff = N / (1 + (N-1)·ρ)
```

*"Under pairwise error-correlation ρ, N voters behave like N_eff independent voters."*

The limit is the load-bearing part and it is why **cap** is the right word rather than
*discount*:

```text
lim (N→∞)  N / (1 + (N-1)·ρ)  =  1/ρ
```

A discount would scale down with each copy and keep growing. This **saturates**. At ρ = 0.5
the ceiling is 2 effective identities *no matter how many copies run* — the ten-thousandth
clone adds nothing the second did not already add. Correlation does not tax the fleet; it
**bounds** it.

## 3. What changes: a meter, not a detector

The valuable half of Aaron's sentence is *"both are valid."* Correlated entities are not
frauds — they exist, they contribute, they are simply not **two**. That converts anti-Sybil
from an adjudication into a measurement:

| | detector | meter |
|---|---|---|
| output | Sybil / honest | how much identity this configuration grants |
| requires | a verdict about **intent** | a measurement of **ρ** |
| failure mode | mislabels an honest cluster as an attack | none available — there is no label to get wrong |
| sanction | confiscation | identity simply not conferred twice for one thing |

This is `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` in its cleanest
instance: the mechanism reports the **neutral fact** (ρ) and never the **intent**. A clone
farm and an honest cluster of similar agents receive identical treatment, which is fair to
both and requires nobody to decide motive.

It also preserves the hard-money invariant. Nothing is **taken**: standing is not confiscated
from correlated entities, it is simply **not conferred twice for one contribution**. Spend /
stake / never-confiscate survives intact, because grading happens at conferral rather than at
seizure.

## 4. One quantity, two registers — and they were built separately

- **Contribution.** `src/Core/SocietyUsefulWork.fs` already prices ΔU under pairwise ρ with an
  idempotent union, so *"N copies price near one agent's worth — contribution does not scale
  with copies."*
- **Identity.** This note is the same ρ applied to how many *voices* a configuration is worth.

So a clone farm gets no extra credit **and** no extra vote, from **one measurement** rather
than two policies. That the two modules were written for different purposes and land on the
same quantity is corroboration rather than restatement — neither was built to support this
sentence.

## 5. The gap, which is the same gap as everywhere else today

`SocietyUsefulWork.fs` says it about itself: the society's *"actual ρ and c"* are **UNMEASURED**
(register row 15's A-method note). The formula is present and proven; **the input is not
measured.** Until it is, `N_eff` is an instrument with no reading.

That is the fourth distinct thread this week to terminate on meter accuracy — anti-Sybil,
not-predetermined, decorrelation-as-anti-money, and now graded identity. Either that is a deep
invariant (one measurement underwrites all four) or the same constraint is being rediscovered
under four names. **Deciding which is itself worth doing**, because if it is one measurement
then building it once discharges four obligations, and if it is four then three of them are
unowned.

## 6. Register

`toy` for the graded-identity application — no code, nothing measured. The `N_eff` formula is
built and cited, not re-derived here. §5's gap is quoted from the module that owns it rather
than asserted.

## Pointers

- `src/Bayesian/CondorcetBoundary.fs` — `N_eff = N/(1+(N-1)ρ)`, the cap and its `1/ρ` limit
- `src/Core/SocietyUsefulWork.fs` — the same ρ pricing contribution; the UNMEASURED admission
- `src/Core/AntiSybil.fs` — the pigeonhole claim, and its honest peel for noisy forgeries
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — fact, never intent
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — why grading at conferral, not seizure, keeps the invariant
- Condorcet (1785); Ladha (1992) — correlated jurors and the effective-voter correction
