# The soulbound fraction — how much value must be non-transferable

Status: **active trajectory**; OPERATOR-INITIATED (Aaron 2026-08-10)
Last refreshed: 2026-08-10
Current blocker: none — lower bound DERIVED (§4a, 2026-08-10); the upper bound remains empirical
Next concrete action: the **upper bound** (§4b) — instrument fork rate against soulbound fraction, since §4a is now closed and the ceiling is the only bound still uncharacterised. Standing guard from §4a: watch the voting path for any stake-proportional weight term; if one appears, `s > 2/3` binds immediately
Evidence links: `src/Core/AntiSybil.fs` · `src/Core/SybilBft*.fs` · `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` · `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md` · `docs/research/2026-08-10-the-threshold-rhyme-*`

---

## 0. The parameter

> **What fraction of value in a society must be non-transferable for the society to
> resist capture, without becoming a trap?**

Aaron's estimate, recorded as a guess to be tested rather than a finding:
*"soulbound is an overcorrection — only 10% is soulbound, the rest is transferable."*

## 1. One reframe first: this is not a physics constant

Aaron asked to save it as one. The reframe matters because **the category determines the
method**, and getting it wrong would send the search in the wrong direction.

A physical constant (α, c) is a property of the universe, found by measurement, identical
everywhere. This is a **design threshold** — the value depends on the adversary model, the
cost of acquiring standing, and what is classified into each bucket. Different societies
with different classifications will have different correct values, and all of them can be
right at once. That is the local-trust-view property showing up one level higher.

**The right analogues are thresholds we already know how to find:**

- **BFT bounds** (`f < n/3` asynchronous) — *derived*, provably, from the failure model.
  If the soulbound fraction has a closed form, it will come from an argument of this shape.
- **Percolation thresholds** — a property that fails *abruptly* at a critical fraction
  rather than degrading. Worth testing for, because an abrupt transition changes how much
  margin you need.
- **Bank capital ratios** (Basel) — the closest working analogue: a mandated
  non-transferable buffer inside an otherwise liquid system. Notably **nobody derived it**;
  it was found by failure and revised after each crisis. That is the honest base case.

So: possibly derivable, probably empirical, and the trajectory should pursue both.

## 2. It is a BAND, not a point

Two failure modes bound it from opposite directions, and both are real:

| bound | set by | failure if crossed |
|---|---|---|
| **Lower** — too little soulbound | cost of *purchasing* standing vs its benefit | sybil resistance fails; identity becomes buyable, and every downstream trust claim is void |
| **Upper** — too much soulbound | liquidity and exit cost | illiquidity (cannot trade for what you need) and lock-in (leaving forfeits everything, so nobody forks) |

The upper bound is the one soulbound-token proposals ran into (Weyl, Ohlhaver, Buterin),
and the critique stands. The lower bound is the one crypto systems run into: fully
transferable holdings can be accumulated by parties who were never present, which is
exactly how concentration happens.

**Why 10% is plausible rather than arbitrary:** the soulbound layer's job is different *in
kind*, not smaller *in degree*. It does not carry economic weight — it carries the thing
that makes value **attributable**. Preventing purchase of standing is a threshold property;
past the threshold, more non-transferability adds cost without adding resistance.

**And it is the structure of every functioning economy already.** Licenses, credit history,
citizenship, convictions: non-transferable. Income earned with them: fully liquid. The
existing ratio is nearer 10% than 90%, which is weak evidence — but evidence — that the
band sits low.

## 3. The classification dominates the number

**Ten percent is only right if it is the *right* ten percent.** Soulbind anything a person
needs to trade in order to live and the illiquidity failure arrives at any fraction.
Soulbind identity, attestations, and shared history and 10% is generous.

So the operative question is not *what ratio* but *what belongs in each class* — which is
this repo's standing conclusion that **the care belongs at the classification moment**.
Get the classification right and the ratio largely falls out; get it wrong and no ratio
rescues it.

**Working classification, to be revised:**

| non-transferable (soulbound) | transferable |
|---|---|
| identity / anchors (cannot be minted — participation cannot be faked) | realized output, goods, currency |
| attestations others made about you | claims on future output |
| shared history with specific parties (constitutive — does not survive transfer) | fungible credits |
| earned privacy budget (`privacy-budget-is-hard-money`) | — |

## 4. How to actually find it

### 4a. Lower bound — DERIVED 2026-08-10. Closed form exists, and it dissolves the question

Sybil resistance holds while `cost(acquire standing) > benefit(standing)`. If a fraction
`s` of standing is non-transferable, an attacker must **earn** that fraction rather than
buy it. The question was whether a threshold falls out of the same style of proof that
gives `f < n/3`. **It does — and the answer depends entirely on a modelling choice, which
is the result.**

**Regime B — stake-weighted voting (the regime the §0 parameter implicitly assumes).**
Let voting weight be proportional to standing, of which fraction `s` is non-transferable.
An adversary who buys *all* purchasable standing controls fraction `(1 − s)`. BFT safety
survives only while the adversary holds less than a third:

```
(1 − s) < 1/3     ⟺     s > 2/3
```

So the closed form is **`s > 2/3`** — the soulbound fraction required for *money alone* to
be unable to break safety. That is **not** near 10%; it is ~6.7× Aaron's estimate.

**Regime A — one-source-one-vote (what the repo ACTUALLY implements).** Verified in source:
`SybilBft.tally` collapses claims to distinct entropy sources via `AntiSybil`, then
`maxFaults d = ⌊(d−1)/3⌋` and `quorumSize f = 2f+1` count **sources, not stake**. Grep finds
no stake- or weight-proportional term anywhere in the voting path. So voting weight is
**not purchasable at any price**: the credential is a physical drift signature, and money
buys none of it. The `(1 − s)` term does not exist, and the inequality never binds.

**The result, and it vindicates §3 with a derivation rather than an assertion.** The two
regimes are not competing estimates of one number — they are the *same* trade priced under
two different classifications:

| | voting standing | economic standing | soulbound fraction of VALUE |
|---|---|---|---|
| Regime B (stake-weighted) | purchasable | purchasable | must exceed **2/3**, or money breaks safety |
| Regime A (this repo) | **non-purchasable by construction** | fully liquid | can be **low** — 10% is not obviously wrong |

> **`s > 2/3` is the price of getting the classification wrong.** Let money buy votes at all
> and you need two-thirds of everything soulbound. Make the voting credential categorically
> non-transferable — physical distinctness, not a stake — and the fraction of *value* that
> must be soulbound drops to whatever identity and attestation actually weigh.

So **10% is not refuted**; it answers a different question (fraction of *value*), and the
2/3 figure answers the *voting-weight* question that Regime A never asks. §3's standing
claim — "the classification dominates the number" — is now derived, not asserted.

**Falsifier, and it is sharp and cheap to watch:** if voting weight is ever made
stake-proportional anywhere in the substrate, `s > 2/3` binds *immediately* and the low
estimate becomes unsafe. Guard: grep the voting path for any weight term. Today there is
none, and that is load-bearing rather than incidental.

**Abruptness: it is a step, not a slope.** The bound is a strict inequality against a
constant, so in Regime B resistance does not degrade smoothly — it holds until `s` reaches
2/3 and fails below. Percolation-style margin is therefore required *if* Regime B is ever
entered; in Regime A the question is void. **Remaining open:** the *upper* bound (§4b) is
untouched by this and remains empirical.

### 4b. Upper bound — empirical, and measured by exit

Instrument **fork rate against soulbound fraction**. Hirschman: cheap exit is what
disciplines concentration. If raising the soulbound fraction measurably suppresses forking,
the ceiling has been found — the society has become a trap, whatever else it has become.

This is measurable in our own fleet, since forking is something agents actually do.

### 4c. The base case, stated so it is not mistaken for failure

Basel found capital ratios by crisis, not by derivation. If the same happens here — the
number arriving from observed failures rather than a proof — that is the **normal** outcome
for this class of parameter, not a defeat.

## 5. Falsifiers

- **The band is empty** — no fraction satisfies both bounds. That would mean
  capture-resistance and exit-freedom are incompatible, and the whole design needs
  rethinking rather than tuning.
- **The number is not stable across societies** — expected, and would confirm §1's reframe:
  a design threshold, not a constant. If it *is* stable across very different
  classifications, that is surprising and interesting, and would argue for a deeper
  invariant.
- **10% turns out to be wildly wrong in either direction** — the guess is Aaron's and is
  recorded as such precisely so it can be shown wrong without embarrassment.

## 6. Anchors

- **Weyl, Ohlhaver & Buterin** — soulbound tokens; the upper-bound failure, argued in public.
- **Hirschman**, *Exit, Voice, and Loyalty* (1970) — why the exit ceiling matters.
- **Ostrom** — commons governed without privatisation or central authority; empirical
  thresholds from field study.
- **Lamport, Shostak & Pease**; **Castro & Liskov** — BFT thresholds as the model for a
  *derived* bound.
- **Basel Accords** — a mandated non-transferable fraction inside a liquid system, tuned by
  failure.
- **Mauss**, *The Gift* — non-transferable obligation as a working economic form.
