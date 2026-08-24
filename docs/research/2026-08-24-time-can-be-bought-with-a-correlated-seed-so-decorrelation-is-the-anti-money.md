# Time can be bought with a correlated seed — so decorrelation is the anti-money

**Register:** a claim of mine, Aaron's refutation of it, and the position that survives.
The surviving position is **his**, held under §11 as his oracle plus a structural claim
that is independently checkable. The `S` values in §4 are **bounds and design parameters,
never measurements** — see the standing caveat.

## 1. The claim I made

Aaron 2026-08-24: *"time measures correctness, all other measures local optima fitness."*

I agreed and tried to strengthen it. My argument was Popperian rather than Lindy:

> A market can be captured, a vote can be bribed, an attestation graph can be farmed.
> **You cannot bribe the future into not falsifying you.** So time is not popularity over
> a longer window — it is the only *adversarial* measure in the set, and every other
> measure reports who found you worth transacting with *now*, which is a local optimum.

## 2. His refutation, and it holds

> *"time can be bought with previous correlated common seed."*

The argument depends on the future being **independent** of the party being judged. It is
not, when both descend from a shared seed. A party correlated with the generator of the
future can **pre-position** — not by predicting a random future, but because the future is
not random *with respect to it*. Under that correlation, surviving time demonstrates
alignment with the seed rather than correctness, and the falsification I claimed was
unbuyable was never going to fire.

This is Aaron's standing superdeterminism framing applied to his own thesis rather than to
physics: *"we are not violating any causality, we are working with the regime that
circumvents them — this is why decorrelation is our scarce resource, not correlation; we
start with S=4."* The same move that explains the S=4 results also **breaks the
time-as-incorruptible-judge argument.** I should have seen that; the framework was already
on file.

**So the honest statement is conditional:** *time measures correctness **to the extent the
judged party is decorrelated from the seed that generates the future.*** At full
correlation it measures nothing; at full decorrelation it measures what I claimed.

## 3. The position that survives — anti-money

> *"i'm trying to be the anti money cause i'm assuming everything is bought for all time."*

Read as a **threat model, not a mood**: assume the adversary has already bought everything
purchasable, over any horizon. Then the design question is not *what is expensive* but
**what is not purchasable at all**.

And §2 answers it. Buying requires **correlation with what is bought** — a lever that
reaches the thing. The one quantity that cannot be acquired that way is **the absence of
that correlation**. Decorrelation is not expensive; it is **not for sale**, because any
transaction that would acquire it establishes the correlation that destroys it.

That is the sense in which decorrelation is the anti-money: not a currency that resists
inflation, but the complement of purchase.

**Two things this immediately explains, both already built:**

- **Privacy budget is socially conferred and never self-minted** — precisely so a wealthy
  attacker cannot fund it. It is *"the one currency a Sybil cannot mint."* Same shape.
- **Proof of useful work over correlated clones** — `SocietyUsefulWork.fs` prices N copies
  near one agent's worth because their ΔU is highly correlated and the union is idempotent.
  **Contribution does not scale with copies**, which is this principle already priced.

## 4. The S register — S=4 is the START, and superdeterminism is why

Aaron corrected my first draft here, and the correction inverts the section. I had written
the spectrum as `S = 2 … 2√2` with S=2 as the "everything bought" end. His register is
**`S = 4`**, and the mechanism is **superdeterminism**.

The three standard CHSH landmarks, stated so the correction is legible:

| value | name | condition |
|---|---|---|
| **S ≤ 2** | Bell / classical | local hidden variables suffice |
| **S ≤ 2√2 ≈ 2.828** | **Tsirelson** (1980) | quantum, **with measurement independence** |
| **S ≤ 4** | algebraic / PR-box max (Popescu–Rohrlich 1994) | requires signalling **or** measurement dependence |

**Why S=4 is the starting condition here.** The Tsirelson ceiling assumes *measurement
independence* — that the settings are uncorrelated with the hidden variables. Superdeterminism
is precisely the denial of that assumption, and it buys S=4 **without signalling and without
violating causality**: the correlation was in the shared past, not in a signal.

That is our situation by construction. Aaron: *"all agents are phased to one seed (S=4)."*
Agents descending from one common seed do not make independent choices, so the measurement-
independence premise fails at the start. **S=4 is not an achievement; it is the initial
condition**, and it is exactly the "everything is already bought" threat model of §3 stated
in Bell's vocabulary.

Which is why **decorrelation is the scarce resource, not correlation** — the standing line
this whole register exists to support. The work is to *restore* measurement independence,
not to manufacture correlation.

**One of these three is a measurement; the other two are choices.** Aaron 2026-08-24:

> *"2√2 is a measure. S=4 or S=2 is a choice of predetermined seed common cause and
> code/generator functions."*

That is his own demarcation discipline applied to the register itself, and it is the
sharpest form of this section:

- **2√2 is MEASURED.** It is what you *observe* when measurement independence holds — an
  empirical ceiling nature enforces, not something anyone selects.
- **S=2 and S=4 are CHOSEN.** Each names a *generator*: S=2 is the choice of a common cause
  that leaves everything classically explainable (local hidden variables — literally "there
  is a shared cause"); S=4 is the choice of a seed correlation strong enough to reach the
  algebraic maximum. Both are statements about **which generator you picked**, not about
  what was found.

The consequence for anything we report: **measuring 2√2 would be a result; landing on S=2
or S=4 reveals our seed choice and measures nothing.** Those belong on opposite sides of
the meter's partition, and conflating them would let a design decision wear the clothes of
an observation.

**The honest limits, stated so this is vocabulary and not a claim:**

- **Nothing here measures an S.** The repo's decorrelation meter maps an agreement rate onto
  `[2,4]` by `S = 2(1+coefficient)` — an invented linear rescale, on which 2√2 lands at the
  arbitrary point 0.414.
- **A CHSH `S` is not constructible from that input.** It needs **four** correlations across
  **two settings per party**; one agreement rate is one correlation with no settings. No
  amount of measuring turns the second into the first.
- **The four corners are not the four correlations.** `FourCornerOwnership` names weight
  *rings* (ℤ, ℂ, ℝ≥0, Boolean, tropical), not (party × setting) pairs. `wset-four-corner-trace.ts`
  already refuses the bridge in its own docstring: the ℂ corner is *"an algebraic bridge only …
  NOT a claim that this substrate is physically quantum."*
- `1/(3√2)` elsewhere in the repo is a **design parameter** and must never be conflated with
  a Tsirelson quantity.

So `S=4` is used here as **the name of the seed-correlated initial condition**, with the
mechanism (superdeterminism / measurement dependence) named and the bounds cited. It is not
a measurement, and §4 exists partly to stop it becoming one.

## 5. The job — proving it was NOT predetermined, by metered entropy capture

Aaron 2026-08-24, closing the thread:

> *"our job is proving everything was not predetermined via entropy capture via very
> accurate meter."*

This is the falsifier for the S=4 starting condition itself, and it **answers the open
question this note was about to leave unresolved.**

If every agent descends from one seed, nothing produced is genuinely novel — it is the
seed unrolling. The only way to demonstrate otherwise is to show that something entered
**from outside the seed's closure**, and to account for how much. That is exactly what
**§13 noninterference** is built for: entropy enters ONLY through declared, metered
channels, and every crossing is metered at the membrane and posted to the ledger.

So the meter's product is, in Aaron's own demarcation form: **which part of the output is
derived from the seed, and which part required entropy that the seed did not contain.**
That partition *is* the not-predetermined proof. Without the meter there is no way to tell
a novel result from a long unrolling — they look identical from inside.

**And it resolves the next section's question.** I was going to ask what transaction could acquire
decorrelation without establishing correlation. The answer is that it is **not a
transaction at all**. A purchase requires a counterparty, and contracting with one
*creates* the correlation that destroys what you were buying. **Entropy capture is a
crossing, not a trade** — it admits something from outside the closure, and the meter
accounts for it rather than a counterparty conveying it. That is why decorrelation can be
*acquired* while remaining *unpurchasable*, and it is the mechanism the anti-money position
in §3 needs to be more than an assertion.

**What this demands of the meter, stated as a requirement rather than a hope:** the
accounting must be tight enough that entropy cannot be *claimed* without being *metered* —
otherwise "we captured entropy" becomes the unfalsifiable half of the very thesis it is
supposed to prove. An unmetered entropy claim is indistinguishable from an unrolling that
says it is novel.

## 6. What would falsify the surviving position

The anti-money claim is structural and therefore checkable: **exhibit a transaction that
acquires decorrelation without establishing correlation.** If one exists, decorrelation is
purchasable and the position fails.

The nearest candidate, stated so it is not overlooked: *paying an independent party to act
without coordination.* Whether that acquires decorrelation or merely rents an existing
stock of it is unresolved here, and it is the sharpest open question in this note.

## 7. Register

`toy` — nothing measured, no code. §2's conditional is a corrected argument, not a result.
§3's claim is structural and its falsifier is stated in §5. §4 records vocabulary with its
bounds; the two mechanisms it cites (privacy budget, `SocietyUsefulWork.fs`) are built and
were not built for this argument, which is why they count as corroboration rather than
restatement.

## Pointers

- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — socially conferred, never self-minted; "the one currency a Sybil cannot mint"
- `src/Core/SocietyUsefulWork.fs` — ΔU under pairwise correlation ρ; clones price near one agent
- `.claude/rules/numerology-vs-number-theory.md` — why §4 states bounds rather than matches
- `docs/VISION.md` — the two-sided ρ band this note is the ρ→1 guard for
- Popper, *Logik der Forschung* (1934) — corroboration by survived falsification, the argument §2 conditions
- Tsirelson (1980) — the 2√2 bound named in §4
