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
`privacy-budget-is-hard-money-earned-by-others` <!-- STALE-REF: ../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md -->
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

## The four values calls — ANSWERED (Aaron, 2026-08-09)

All four came back with the same shape, and the shape is the design:

> **Consent and disclosure — never coercion, never accident.**

Each answer permits the "dangerous" option rather than banning it, and puts an
explicit, informed opt-in in front of it. That is choice architecture applied to a
metric: the substrate does not decide what is good for you, it refuses to let the
choice be made *for* you or *without* you noticing.

### 1. Aggregation: `min` AND `sum` — but sacrifice is opt-in

> *"We should have both, but you have to sign up for the sacrificing — not
> accidentally. You opt into those rules, never forced."*

- **`min` (maximin) is the DEFAULT.** It protects the worse-off party and matches the
  floor discipline already in the ledger.
- **`sum` is available**, and it does permit trading one party's gain for aggregate
  gain — which is exactly why it may never be the default and may never be inferred.
  A party must **sign up** for it.

Implementation consequences (these are requirements, not suggestions):

- The aggregator is **part of the interaction's declared terms**, not a caller-side
  configuration flag. Both parties see which one is in force before agreeing.
- Opt-in is **recorded and attributable** — an aggregator that permits sacrifice must
  leave evidence that the sacrificed party agreed to those rules. Silence is not
  consent, and neither is a default.
- No path may *escalate* from `min` to `sum` mid-interaction. Changing the rules
  requires a fresh agreement (`weight-free`: no accumulating authority).

### 2. Cheap honest proxy — approved direction

> *"Sounds great."*

Proceed with a tractable proxy for channel capacity, kept honest about being a proxy
(the D_f `1.322` episode is the cautionary example: a proxy that stops being labelled
a proxy becomes a fabricated measurement).

### 3. Gaming is a FEATURE — the harm is the non-consenting bystander

> *"We want to promote gaming and disclosing … some gaming with rewards where both
> sides know the rules and opt in can be fun. It's just not fun when innocent
> bystanders are involved."*

This **reframes the whole anti-gaming requirement.** The design question is not
*"how do we prevent peers from gaming the empowerment score?"* It is:

> **Gaming is legitimate play when (a) the rules are known to both sides, (b) both
> opted in, and (c) no non-consenting third party bears the cost. The harm is never
> the gaming — it is the uncompensated externality onto someone who did not agree.**

So the invariant to enforce is an **externality bound**, not a cleverness bound. And
disclosure is *promoted*, not merely tolerated: declaring more capability makes your
empowerment measurable more precisely, which is an incentive to disclose — and must
therefore never harden into a requirement to disclose (see the frost constraint
above).

**This changes the proof obligation** routed to formal verification. Not *"no
declaration strategy can inflate `jointOptionGain`"* — some inflation is consensual
play. The property is:

> *No interaction between consenting parties may reduce a non-consenting third
> party's `trustBound` (or option space) below its floor.*

Gaming inside the consenting pair: permitted, possibly rewarded. Cost leaking onto a
bystander: forbidden. That is a far more interesting — and more checkable —
invariant than blanket gaming-resistance.

### 4. `k = 0` is permitted — behind a power-dynamic disclosure protocol

> *"Yes, I think — I've talked to humans who like this. But this one we should
> probably have some sort of power-dynamic disclosure protocol or something."*

A party **may** lower its own floor, including to `k = 0`, and thereby volunteer to
be exploitable. Consensual asymmetry is a real thing people choose, and the substrate
does not get to forbid it (Multi-Oracle: no single mandatory morality). But it is the
one case where the *default* protections are being switched off, so it needs a gate:

**Power-dynamic disclosure protocol — sketch:**

- The asymmetry must be **named explicitly**, in terms of what it permits, not
  buried in a parameter. "You are setting `k = 0`" is a config change; "this permits
  the counterparty to take actions that push you below your safety floor" is a
  disclosure.
- **Both parties acknowledge it** — the advantaged side must affirm it knows it holds
  the asymmetry. One-sided consent is exactly the failure mode.
- It is **revocable at any time by the party who lowered its floor**, and revocation
  takes effect immediately — one-way to *more* protection is always free
  (the same asymmetry as the privacy budget: more privacy is free, less needs the
  owner).
- It is **scoped and expiring**, not standing: to a named counterparty, a named
  domain, and a bounded window. A permanent, global `k = 0` is indistinguishable from
  capture (`weight-free`).
- The disclosure is **attributable** — so if the advantaged party later claims it
  did not know, the record answers.

Open sub-question (worth its own round): does a third party — society — get to see
that a `k = 0` arrangement exists, even if not its contents? Visibility deters abuse
but is itself a privacy cost to both participants. This is the glass-halo/frost
tension in a new place, and it should be decided deliberately rather than by default.

## Pointers

- `src/Core.TypeScript/planning/calibration-ledger.ts` — the two shipped bounds,
  and the "calibration ≠ competence" distinction this must not erode.
- `src/Core/TravelerRankLedger.fs` — the posterior `(μ, σ²)` the bounds read.
- `manifesto-13-specifications` <!-- STALE-REF: ../../.claude/rules/manifesto-13-specifications.md --> — §6 consent-first, §11 Multi-Oracle / default regard, §13 noninterference.
- `privacy-budget-is-hard-money-earned-by-others` <!-- STALE-REF: ../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md --> — why declared-not-inferred is a hard constraint.
- `docs/research/2026-08-09-errors-teach-both-sides-…-aaron.md` — the sibling ferry
  ("teaching is unconditional; belief is earned") whose belief-weighting this reuses.
- Anchors: Klyubin/Polani/Nehaniv 2005 (empowerment); Salge & Polani 2017
  (empowerment as an alignment objective); Du et al. 2020 (assistance via
  empowerment); Auer 2002 (UCB, the `exploreBound` lineage); Cantelli/Scarf (the
  `trustBound` shortfall guarantee).
