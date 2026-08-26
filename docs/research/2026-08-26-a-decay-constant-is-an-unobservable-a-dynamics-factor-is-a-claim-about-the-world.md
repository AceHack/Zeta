# A decay constant is an unobservable; a dynamics factor is a claim about the world

**Register:** Beacon. The mechanism below is implemented in
`src/Core/TravelerRankLedger.fs` with eight falsifiers in
`tests/Tests.FSharp/TravelerRankLedger.Tests.fs` (TRL-34..41). The *application* to the ARC
agent's three constants is **not** implemented and is filed, not claimed.

Aaron 2026-08-26, arriving from an unrelated thread about semver-adherence scoring:

> *"this is unrelated to ARC but i think we can borrow from its concepts to improve arbitrary
> decay rates that are hard coded."*

and, on why TrueSkill was the right estimator there:

> *"its dynamics factor inflates σ with time since last observation, so stale evidence loses
> confidence rather than being discounted by a number nobody can justify."*

That sentence is the whole idea, and it transfers.

## The distinction

```
decay      value  ←  value · k            the ESTIMATE moves toward the prior
dynamics   σ²     ←  σ² + τ²·Δt           the UNCERTAINTY widens; the estimate does not move
```

These are not two spellings of the same thing:

> **Decay says the world reverted. Dynamics says I stopped watching.**

Only the second is true of an unobserved quantity, and the difference is operational rather
than philosophical:

- **Direction survives.** Under decay, enough silence drags a bad record back to neutral —
  silence *forgives*. Under dynamics `μ` is untouched, so the record still says what it said;
  it just says it less confidently. One confirming observation brings it straight back
  (TRL-38), instead of being re-learned from scratch.
- **It cannot flip a verdict.** Aging drives `trustBand` toward 0.5 **from both sides** and
  never past it (TRL-37). A stale good record does not become distrusted; a stale bad one does
  not become trusted. Both become *no opinion*, which is the honest state.
- **It is asymmetric in the right direction.** Decay applied to a *bad* record is a slow
  pardon nobody granted. That is the failure mode this replaces.

## What was actually missing here

`TravelerRankLedger.fs` implements TrueSkill's ADF update (Herbrich, Minka & Graepel 2006)
over (traveler × hat-domain). Its own docstring states the invariant:

> *"σ² is **strictly decreasing** with each observation (posterior concentrates)."*

and a falsifier pins it. **Nothing ever widened it again.** There is no `tau`, no elapsed
time, no dynamics term anywhere in the module. So a belief built from observations that then
stopped arriving became **permanently confident**: a traveler who performed well and went
silent stayed maximally trusted forever, and no amount of elapsed time could move them.

That is a real defect in a ledger meant to be long-lived, and it is the reason TrueSkill
carries a τ term at all — a rating is a belief about a *moving* quantity, and beliefs about
moving quantities must lose confidence when unobserved. The estimator was here; the half that
handles time was not.

**Note the direction of the correction.** The prompting observation assumed the mechanism was
already available to borrow. It was half-available: the concentration half, not the staleness
half. Recording that because "the estimator you want is already in the repo" is the kind of
claim that is easy to check and easy to skip checking.

## On the free parameter — this does not eliminate it

Stated plainly, because the opposite is the tempting overclaim: **τ is still a constant
somebody chooses.** Replacing `0.75` with `τ = 0.2` is not obviously progress.

What changes is that the constant becomes *arguable*:

| | `INERT_DECAY = 0.75` | `τ` |
|---|---|---|
| units | none | belief-σ per tick |
| answers | nothing about the world | "how fast can this quantity actually change?" |
| estimable from data | no | yes — from observed change rates |
| wrong value shows up as | output that looks slightly off | a horizon you can state and disagree with |

And the horizon is why `ticksUntilUninformative` exists alongside `age`. Choosing τ directly
is still guessing; choosing it and then asking *"so how many ticks until a confident belief
goes neutral?"* produces a number somebody can reject. TRL-41 pins that the readout agrees
with actually aging that long, and that it is the **boundary** rather than any upper bound —
half the horizon must still be informative. A readout that cannot be checked against the
thing it predicts is decoration.

τ is also passed as an **argument, not a module constant**, deliberately. A default here would
have re-hidden exactly the unjustifiable number the function exists to replace.

## Where this applies in-tree — three constants, one shape

Surveyed across `src/`. Every hardcoded decay in the repo is in the ARC agent, and each one's
*own comment* describes a moving world rather than a shrinking value:

| constant | file | its own stated reason |
|---|---|---|
| `LAYER_DECAY = 0.9` | `zeta_arc/layered.py:51` | *"after the environment **changes** what it responds to"* |
| `EVIDENCE_DECAY = 0.9` | `zeta_arc/agent.py:49` | *"a wrong body decays out instead of being welded on"* |
| `INERT_DECAY = 0.75` (+ `INERT_FLOOR = 0.5`) | `zeta_arc/agent.py:108` | *"actions get upgraded over time"* |

All three are staleness, none is reversion — so all three are τ's semantics wearing a
multiplier's clothes. The third is mine, written earlier the same day, and `0.75` was chosen
because it matched the existing idiom rather than because anything measured it. `INERT_FLOOR`
is a second free parameter serving as a threshold; under a belief formulation the threshold
becomes a probability (*"I no longer believe this action is dead"*), which is at least a
statement about the world.

**Not converted here, and that is deliberate.** The ARC agent's behaviour is pinned by 93
tests including a measured environment score (0.354). Swapping three decay constants for
per-action Bayesian beliefs is a behaviour change that will move those numbers, and it wants
its own before/after measurement rather than being smuggled in beside an algebra result.
Filed as `081M0YSD5VA087G0R000W2Q9QW`.

## Honest limits

- **`age` is exact only for a Wiener-drift latent.** `σ² += τ²Δt` is the correct dynamics for
  a quantity performing Brownian motion between observations. A quantity that jumps (a game
  that unlocks an action at a discrete moment) is not that, and for it τ is an approximation
  chosen to bound the jump rather than to model it. The ARC case is arguably the jumping kind.
- **Nothing here is metered against a task.** The mechanism has falsifiers; that it *helps*
  any Zeta workload is untested and stays `toy` until something measures it.
- **The bisection in `ticksUntilUninformative` inverts this module's own `bigPhi`**, not a
  textbook Φ⁻¹, so the readout is consistent with the module rather than with a second,
  differently-approximated normal CDF. That is a deliberate choice, and it means the number is
  only as good as the A&S 7.1.26 approximation already in use (max error < 1.5e-7).

## Pointers

- `src/Core/TravelerRankLedger.fs` §"Dynamics factor (staleness)" — `age`, `ticksUntilUninformative`
- `tests/Tests.FSharp/TravelerRankLedger.Tests.fs` TRL-34..41 — TRL-36/37 are the pair that separate this from decay
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why the τ discussion is in the file rather than assumed
- Herbrich, Minka & Graepel, *TrueSkill™: A Bayesian Skill Rating System*, NIPS 2006 — the τ term is §2. Cited from standing knowledge, not page-checked.
