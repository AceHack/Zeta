"""Beliefs that lose CONFIDENCE with staleness, instead of losing VALUE.

WHY THIS MODULE EXISTS. Three constants in this package discounted evidence by
multiplying it: `EVIDENCE_DECAY = 0.9`, `INERT_DECAY = 0.75`, `LAYER_DECAY = 0.9`.
Each was chosen because the resulting behaviour looked right, and none of them
could be checked against anything. That is the defect, and it is not cosmetic:

    A decay constant destroys the distinction between "I was very sure a while
    ago" and "I am slightly sure now". Both land on the same number, and the
    ranking that reads that number cannot tell them apart.

The dynamics factor from TrueSkill (Herbrich, Minka & Graepel 2006) makes the
opposite trade: the estimate `mu` is LEFT ALONE and the variance `sigma2` grows
with time since the last observation. A stale belief keeps its position and
becomes easy to move; a fresh belief keeps its position and is hard to move.
Nothing is forgotten, and what changes is how strongly the next observation
speaks.

WHY tau IS NOT JUST 0.9 WEARING A GREEK LETTER. It would be, if tau were
picked by eye — and this module refuses to let it be. `tau_for_horizon` derives
tau from a statement about the WORLD ("a body belief should be fully contestable
again after ~20 actions of silence"), and `ticks_until_uninformative` inverts it
so any chosen tau can be checked against what it implies. The knob stops being
a rate nobody can justify and becomes a horizon somebody can argue with.

`decay_half_life` closes the loop backwards: it reports what the OLD constants
were silently claiming, so the migration starts from the measured behaviour
rather than from a fresh guess. 0.9 was asserting a 6.6-observation half-life;
0.75 was asserting 2.4. Those are the numbers the constants were hiding.

MIRRORS `src/Core/TravelerRankLedger.fs` — `SkillBelief`, `age`,
`ticksUntilUninformative`. The F# carries the win/loss (TrueSkill) update
because it ranks travelers by outcome; this carries the Gaussian/Kalman update
because ARC's observations are CONTINUOUS (displacement agreement in [-1, 1]),
not binary. Same dynamics factor, different likelihood.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

#: How many standard deviations a conservative estimate sits below the mean.
#:
#: WAS 3.0, ON A BORROWED RATIONALE THAT DOES NOT APPLY HERE. TrueSkill publishes
#: `mu - 3*sigma` as a conservative DISPLAY rating — a deliberately pessimistic
#: public number for one player. This module uses the same expression as an
#: ARGMAX KEY across candidates observed at DIFFERENT RATES, and there the width
#: stops being a tie-breaker and becomes the entire ranking.
#:
#: Measured on `chase-decoy`, at the frame the wrong candidate took the body:
#:
#:     BODY   mu=+0.941  sigma2=0.628   3*sigma=2.377   ->  -1.437
#:     DECOY  mu=+0.295  sigma2=0.322   3*sigma=1.702   ->  -1.407
#:
#: The body had THREE TIMES the agreement and lost, because a 0.68 gap in the
#: width terms outvoted a 0.65 gap in the quantity actually being compared. The
#: decoy moves every frame and is therefore seen more often; under k=3 that alone
#: decided the election, silently replacing "who agrees with my commands" with
#: "who moved most recently".
#:
#: 1.0 is the ordinary one-sigma bound (~84% one-sided). It keeps the newcomer
#: penalty — a candidate seen once still carries the prior's width — while
#: leaving a real difference in the mean decisive. Agreement is a cosine on
#: [-1, 1], so the largest honest gap in the mean is 2, and a width weight much
#: above 1 can swamp it. That bounds k from above by the SCALE OF THE QUANTITY,
#: not by fitting it to a score.
#:
#: HONEST LIMITS, both real. The argument justifies "small enough not to
#: dominate" and does not distinguish 1.0 from 1.5; what it rules out is 3.0,
#: which was measured to invert the ranking. And the trade is genuine — at k=1
#: the newcomer penalty is weaker, so a challenger with a clearly better mean
#: takes the body sooner than it used to. `test_staleness_costs_the_incumbent_
#: its_grip` was re-derived for that and its numbers changed with the constant.
CONSERVATIVE_K = 1.0


@dataclass(frozen=True)
class Belief:
    """A Gaussian belief: where the estimate sits, and how sure of it we are.

    Frozen because every operation here returns a NEW belief. An in-place
    update would let a caller age a belief twice by accident, and doubling a
    variance inflation is invisible at the call site — it just makes the agent
    quietly more gullible.
    """

    mu: float
    sigma2: float

    def __post_init__(self) -> None:
        if math.isnan(self.mu) or math.isnan(self.sigma2):
            raise ValueError(f"Belief: mu and sigma2 must be numbers, got {self}")
        if self.sigma2 < 0.0:
            raise ValueError(f"Belief: sigma2 must be non-negative, got {self.sigma2}")

    @property
    def sigma(self) -> float:
        return math.sqrt(self.sigma2)


def observe(belief: Belief, x: float, obs_sigma2: float) -> Belief:
    """Fold one observation `x` of stated noise `obs_sigma2` into `belief`.

    The scalar Kalman update, which is what a Gaussian prior and a Gaussian
    likelihood give you exactly — no approximation to justify:

        k      = sigma2 / (sigma2 + obs_sigma2)      # how much to believe x
        mu'    = mu + k * (x - mu)
        sigma2'= (1 - k) * sigma2

    Read the gain `k` to see why this is the whole point of the change. A stale
    belief has large `sigma2`, so `k` approaches 1 and the observation nearly
    replaces the estimate. A fresh belief has small `sigma2`, so `k` approaches
    0 and the same observation barely moves it. THE DECAY CONSTANT VERSION HAS
    NO SUCH TERM: it multiplies every history by the same number regardless of
    how well-established it was, which is precisely the information it throws
    away.
    """
    if math.isnan(x):
        raise ValueError("observe: x must be a number")
    if math.isnan(obs_sigma2) or obs_sigma2 <= 0.0:
        raise ValueError(f"observe: obs_sigma2 must be positive, got {obs_sigma2}")
    gain = belief.sigma2 / (belief.sigma2 + obs_sigma2)
    return Belief(
        mu=belief.mu + gain * (x - belief.mu),
        sigma2=(1.0 - gain) * belief.sigma2,
    )


def age(belief: Belief, tau: float, elapsed: float) -> Belief:
    """Inflate variance for `elapsed` units of staleness. `mu` is untouched.

    This is the dynamics factor, and the one-line body is the entire idea:
    `sigma2 + tau**2 * elapsed`. Variances of independent Gaussians add, so
    "the world may have drifted by `tau` per tick, independently each tick" IS
    this expression — it is derived, not fitted.
    """
    if math.isnan(tau) or math.isnan(elapsed):
        raise ValueError("age: tau and elapsed must be numbers")
    if tau < 0.0:
        raise ValueError(f"age: tau must be non-negative, got {tau}")
    if elapsed < 0.0:
        raise ValueError(f"age: elapsed must be non-negative, got {elapsed}")
    return Belief(mu=belief.mu, sigma2=belief.sigma2 + tau * tau * elapsed)


def conservative(belief: Belief, k: float = CONSERVATIVE_K) -> float:
    """`mu - k*sigma` — what we are willing to claim, not what we hope."""
    return belief.mu - k * belief.sigma


def optimistic(belief: Belief, k: float = CONSERVATIVE_K) -> float:
    """`mu + k*sigma` — the best case still inside the interval."""
    return belief.mu + k * belief.sigma


def outranks(challenger: Belief, incumbent: Belief, k: float = CONSERVATIVE_K) -> bool:
    """Does the challenger beat the incumbent, reading BOTH conservatively?

    THIS REPLACES A HAND-PICKED HYSTERESIS MARGIN. `LATCH_MARGIN = 1.0` and
    `LAYER_LATCH_MARGIN = 2.0` were both approximating "do not flip on noise",
    with the amount of noise guessed once and then fixed forever. Ranking by
    `mu - k*sigma` — TrueSkill's own published leaderboard order — says the same
    thing and MEASURES the noise instead: a newcomer carries a wide interval, so
    its conservative score is low and it cannot take the body on one lucky
    frame. The hysteresis is not added, it FALLS OUT of the newcomer being new.

    THE SIGN HERE IS LOAD-BEARING AND WAS WRONG ONCE. Comparing the challenger's
    conservative score against the incumbent's OPTIMISTIC score reads plausibly
    and inverts the intended behaviour: it makes a STALE incumbent harder to
    displace, because staleness pushes its optimistic bound up. That is exactly
    backwards — an incumbent nobody has confirmed lately is the one with least
    to protect. Both sides conservative, so staleness costs the incumbent its
    grip, which is what the decay constant was crudely achieving. Caught by
    `test_staleness_costs_the_incumbent_its_grip` before it reached a call site.
    """
    return conservative(challenger, k) > conservative(incumbent, k)


def tau_for_horizon(sigma2_prior: float, horizon: float) -> float:
    """The `tau` under which a CERTAIN belief returns to prior uncertainty after
    `horizon` units of silence.

    Solving `0 + tau**2 * horizon == sigma2_prior` gives `tau = sqrt(sigma2_prior
    / horizon)`. The point is the direction of the arrow: you state the horizon,
    which is a claim about the environment that somebody can dispute with
    evidence, and tau falls out. Naming tau directly would be the old sin with a
    new symbol.
    """
    if math.isnan(sigma2_prior) or sigma2_prior <= 0.0:
        raise ValueError(
            f"tau_for_horizon: sigma2_prior must be positive, got {sigma2_prior}"
        )
    if math.isnan(horizon) or horizon <= 0.0:
        raise ValueError(f"tau_for_horizon: horizon must be positive, got {horizon}")
    return math.sqrt(sigma2_prior / horizon)


def ticks_until_uninformative(
    belief: Belief, tau: float, sigma2_target: float
) -> float:
    """How long until `belief` is as uncertain as `sigma2_target`. 0 if already.

    The check on a chosen tau: it converts the knob back into the horizon it
    implies, so a tau that quietly means "never forget" or "forget instantly"
    says so in a number. Closed-form here, where the F# sibling needs bisection,
    because the target is a VARIANCE and the inflation is linear in time; the F#
    targets a Phi-squashed trust band, which is not.
    """
    if math.isnan(tau) or tau < 0.0:
        raise ValueError(
            f"ticks_until_uninformative: tau must be non-negative, got {tau}"
        )
    if math.isnan(sigma2_target) or sigma2_target <= 0.0:
        raise ValueError(
            f"ticks_until_uninformative: sigma2_target must be positive, got {sigma2_target}"
        )
    if belief.sigma2 >= sigma2_target:
        return 0.0
    if tau == 0.0:
        return math.inf
    return (sigma2_target - belief.sigma2) / (tau * tau)


def decay_half_life(decay: float) -> float:
    """How many observations a multiplicative `decay` takes to halve a value.

    THE AUDIT OF THE CONSTANTS THIS MODULE REPLACES. `ln(0.5)/ln(decay)`, so
    0.9 -> 6.58 observations and 0.75 -> 2.41. Neither number appears anywhere
    near the constants that assert them, which is the reason a reader could
    never check either one. Reported here so the migration starts from what the
    old behaviour actually was rather than from a fresh guess.
    """
    if math.isnan(decay) or not (0.0 < decay < 1.0):
        raise ValueError(f"decay_half_life: decay must be in (0, 1), got {decay}")
    return math.log(0.5) / math.log(decay)
