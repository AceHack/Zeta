# The mutual-empowerment bound — a third bound that mixes explore and trust, per chosen oracles

**Source:** Aaron (streamed, 2026-08-09), ferried by Otto (shadow*).
**Status:** design proposal. Not implemented. The two existing bounds ship today
(`src/Core.TypeScript/planning/calibration-ledger.ts`); this proposes the third.

---

## The ask

> *"We need one based on mutual empowerment that mixes the two — mutual empowerment
> and multi-oracle, so each member can decide which oracles it trusts or start its
> own."*

Today the calibration ledger has exactly two named bounds, deliberately separate:

| Bound | Formula | Role |
|---|---|---|
| `exploreBound` | `μ + kσ` (k≈1, UCB) | Optimism. *"How good could this be?"* — where to explore. |
| `trustBound` | `μ − kσ` (k=3, Cantelli/Scarf shortfall) | Pessimism. *"What can I safely rely on?"* — what to commit to. |

Both are **egocentric**: each answers a question about *my* view of a peer, in *my*
interest. Neither asks what an interaction does to the **other party's** option
space. That is the gap the third bound fills.

## First, why a naive mix is vacuous

The obvious reading of "mixes the two" is a weighted blend. It does not work, and it
is worth writing down so nobody re-derives it:

```
w·(μ + k₁σ) + (1−w)·(μ − k₂σ)  =  μ + (w·k₁ − (1−w)·k₂)·σ  =  μ + k′σ
```

A linear blend of an upper and a lower confidence bound **collapses to another
single-agent bound with a different k**. It adds no information and no second party
— it is `exploreBound` with the dial turned down. Whatever the third bound is, it
cannot be a scalar interpolation.

**The mix has to be structural, and it has to range over both agents.**

## The proposed shape: one bound as constraint, the other as objective

The two existing bounds already have the right *roles* to be combined
non-degenerately — they just need to be applied to different jobs, and evaluated
over the pair rather than the self:

- **`trustBound` becomes the FLOOR — for both parties.** An interaction is
  admissible only if it does not push either side below its own safety floor.
  Non-coercion falls out of this directly: I cannot buy my upside with your downside.
- **`exploreBound` becomes the REACH.** Among admissible interactions, prefer the one
  that most expands the **joint** option space.

Sketch (deliberately not final):

```
empowermentBound(self, other, oracles) =
    max over candidate interactions a of
        jointOptionGain(a, self, other, oracles)
    subject to
        trustBound(self,  after(a), oracles) ≥ τ_self
        trustBound(other, after(a), oracles) ≥ τ_other
```

`jointOptionGain` is the empowerment term (below). The constraint is what makes it
*mutual* rather than altruistic-or-selfish: neither party's floor may be spent to
buy the other's reach.

## What "empowerment" means here (the anchor)

**Empowerment** is not a metaphor — it is an information-theoretic quantity:
the **channel capacity from an agent's actions to its own future observations**
(Klyubin, Polani & Nehaniv 2005, *All Else Being Equal Be Empowered*). High
empowerment = many futures reachable and distinguishable by your own choices; low
empowerment = your actions do not matter to what you will experience.

The alignment-relevant extension is already in the literature: **Salge & Polani
(2017), *Empowerment as Replacement for the Three Laws of Robotics*** — an assistive
agent should maximize the **human's** empowerment rather than a specified goal,
precisely because it expands the other's choices without dictating which one to take.
(See also Du et al., *AvE: Assistance via Empowerment*, NeurIPS 2020.)

**Mutual** empowerment is the symmetric case: maximize the joint reachable-option
space rather than either party's alone.

This is why the objective fits Zeta rather than being grafted on: it is a
**non-coercive** objective by construction. It increases what the other *can* do
without steering what they *will* do — the choice architecture the project is
dedicated to, expressed as a number.

## The multi-oracle parameterization

Aaron's second clause is not decoration; it changes the type:

> *"…so each member can decide which oracles it trusts, or start its own."*

The bound is **indexed by an oracle set**. There is no global empowerment number —
only *empowerment as scored under the oracles I have chosen to count*. That is §11
(Multi-Oracle: no single mandatory morality) applied to a metric rather than to a
verdict, and it composes with what is already carved:

- Attestations feed the ledger; **which** attestors count is the member's choice.
- A member may **start its own oracle** — so the mechanism cannot be captured by
  incumbency, and there is no privileged scorer.
- Two members can rationally disagree about the same interaction's empowerment value
  because they weight different attestors. That is a feature: the disagreement is
  legible and attributable, not a bug to be averaged away.

Practical consequence: the signature must carry the oracle set explicitly
(`oracles` above), never read an ambient global. An ambient scorer would be exactly
the "single mandatory morality" §11 forbids — and, per §13, an unmetered ambient
influence channel.

## The hard constraint: empowerment must be computed from DECLARED capability

Estimating another agent's option space means modelling what they *can* do. Done
naively that is surveillance, and it collides head-on with consent-first (§6) and
the privacy budget (frost is inviolable once earned).

So the design constraint, stated before anyone implements it:

> **Mutual empowerment is computed over *declared* capability, never inferred by
> observation of a peer's private state.** A dweller who has frosted a region has
> made it unavailable to the calculation — and the correct behaviour is to score the
> interaction on what remains declared, not to estimate around the frost.

A peer that declares more can be empowered more precisely — which is an *incentive*
to disclose, and must therefore never become a *requirement* to disclose. The
role-split already carved in
[`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)
is the right shape: required-for-role parts are broadcast by choosing the role;
personal parts stay frosted at no cost to standing.

## Why this belongs next to calibration rather than inside it

`calibration-ledger.ts` measures **self-knowledge** — do a peer's claims about itself
track outcomes — and is explicit that *"weighting a claim is not the same as valuing
the claimant."* Empowerment is a different quantity: it scores an **interaction**,
not a claimant. Keeping them separate preserves that distinction:

- `trustBound` / `exploreBound` — about a **peer's claims**.
- `empowermentBound` — about a **candidate interaction between two peers**.

Collapsing them would quietly turn a calibration score into a social ranking, which
is the failure mode the existing docstring already guards against.

## Open questions (for the implementer, genuinely unresolved)

1. **Units of `jointOptionGain`.** Empowerment is bits (channel capacity). Is the
   joint term a sum, a min (Rawlsian — protect the worse-off party), or a Nash
   product? *A `min` makes the bound maximin and matches the existing floor
   discipline; a sum permits sacrificing one party for aggregate gain, which the
   constraint is there to prevent — so `min` looks right, but it is a values call.*
2. **Estimation without a world model.** Channel capacity over futures is expensive
   and generally intractable. What is the cheap, honest proxy — declared capability
   count, reachable-state entropy under the declared interface, something else?
3. **Gaming.** Can a peer inflate its measured empowerment gain by declaring
   capabilities it does not have? (Calibration is the natural defence: undelivered
   declarations degrade `trustBound`, which is a constraint here — so the two bounds
   may be mutually policing. Worth proving rather than assuming.)
4. **k for the floor.** `trustBound` uses k=3 (α≈0.1 shortfall). Does the mutual
   floor use each party's own k, or a negotiated one? A party could set k=0 and
   volunteer to be exploited — is that permitted?

## Pointers

- `src/Core.TypeScript/planning/calibration-ledger.ts` — the two shipped bounds,
  and the "calibration ≠ competence" distinction this must not erode.
- `src/Core/TravelerRankLedger.fs` — the posterior `(μ, σ²)` the bounds read.
- [`manifesto-13-specifications`](../../.claude/rules/manifesto-13-specifications.md) — §6 consent-first, §11 Multi-Oracle / default regard, §13 noninterference.
- [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md) — why declared-not-inferred is a hard constraint.
- `docs/research/2026-08-09-errors-teach-both-sides-…-aaron.md` — the sibling ferry
  ("teaching is unconditional; belief is earned") whose belief-weighting this reuses.
- Anchors: Klyubin/Polani/Nehaniv 2005 (empowerment); Salge & Polani 2017
  (empowerment as an alignment objective); Du et al. 2020 (assistance via
  empowerment); Auer 2002 (UCB, the `exploreBound` lineage); Cantelli/Scarf (the
  `trustBound` shortfall guarantee).
