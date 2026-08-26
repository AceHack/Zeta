"""Falsifiers for the dynamics factor.

The tests that matter here are the ones a DECAY CONSTANT would fail. Anything
both formulations satisfy is not evidence for this change, so each of those is
labelled with what it discriminates against.
"""

from __future__ import annotations

import math

import pytest

from zeta_arc.dynamics import (
    CONSERVATIVE_K,
    Belief,
    age,
    conservative,
    decay_half_life,
    observe,
    optimistic,
    outranks,
    tau_for_horizon,
    ticks_until_uninformative,
)


def test_age_moves_confidence_and_never_the_estimate() -> None:
    """THE distinguishing property. A decay constant moves the estimate and
    leaves confidence unrepresented; the dynamics factor does exactly the
    reverse. Replace `age` with `mu * k` and this goes red on the first assert.
    """
    b = Belief(mu=2.5, sigma2=0.1)
    aged = age(b, tau=0.2, elapsed=10.0)
    assert aged.mu == 2.5, "aging must not touch the estimate"
    assert aged.sigma2 > b.sigma2, "aging must cost confidence"
    assert aged.sigma2 == pytest.approx(0.1 + 0.04 * 10.0)


def test_a_stale_belief_is_moved_more_by_the_same_observation() -> None:
    """The operational payoff, and the thing no decay constant can express.

    Two beliefs with the SAME estimate, one fresh and one stale, both shown the
    same contradicting observation. The stale one must move further — that is
    what "stale evidence loses confidence" buys. Under multiplicative decay both
    would have been shrunk toward zero identically and neither would be more
    persuadable than the other.
    """
    fresh = Belief(mu=1.0, sigma2=0.01)
    stale = age(Belief(mu=1.0, sigma2=0.01), tau=0.5, elapsed=20.0)
    assert stale.mu == fresh.mu

    contradiction = -1.0
    moved_fresh = observe(fresh, contradiction, obs_sigma2=0.25)
    moved_stale = observe(stale, contradiction, obs_sigma2=0.25)

    assert abs(moved_stale.mu - 1.0) > abs(moved_fresh.mu - 1.0)
    # And concretely: the fresh belief barely budges, the stale one nearly flips.
    assert moved_fresh.mu > 0.8
    assert moved_stale.mu < 0.0


def test_variances_add_so_aging_composes() -> None:
    """Aging twice by t is aging once by 2t. Independent per-tick drift is the
    justification for the whole formula, and this is that claim as an equation:
    if it failed, `tau` would not mean "drift per tick" and the horizon
    derivation below would be unfounded.
    """
    b = Belief(mu=0.3, sigma2=0.05)
    twice = age(age(b, tau=0.3, elapsed=4.0), tau=0.3, elapsed=4.0)
    once = age(b, tau=0.3, elapsed=8.0)
    assert twice.sigma2 == pytest.approx(once.sigma2)
    assert twice.mu == pytest.approx(once.mu)


def test_observation_gain_bounds() -> None:
    """A useless observation must not move the estimate, and a first observation
    into total ignorance must adopt it. Both are the Kalman gain at its limits.
    """
    ignorant = Belief(mu=0.0, sigma2=1e9)
    assert observe(ignorant, 0.7, obs_sigma2=0.01).mu == pytest.approx(0.7, abs=1e-6)

    certain = Belief(mu=0.7, sigma2=0.0)
    assert observe(certain, -5.0, obs_sigma2=0.01).mu == 0.7
    assert observe(certain, -5.0, obs_sigma2=0.01).sigma2 == 0.0


def test_observing_always_narrows() -> None:
    b = Belief(mu=0.0, sigma2=1.0)
    assert observe(b, 0.5, obs_sigma2=1.0).sigma2 < b.sigma2


def test_horizon_round_trips_through_tau() -> None:
    """State a horizon, get a tau, ask what horizon the tau implies, get the
    horizon back. This is what makes tau checkable rather than asserted.
    """
    horizon = 20.0
    prior = 0.25
    tau = tau_for_horizon(sigma2_prior=prior, horizon=horizon)
    certain = Belief(mu=1.0, sigma2=0.0)
    assert ticks_until_uninformative(certain, tau, prior) == pytest.approx(horizon)


def test_a_well_established_belief_survives_longer_than_a_shaky_one() -> None:
    """The self-tuning property that `INERT_DECAY`'s accumulate-then-decay was
    hand-approximating: more evidence must buy more time before the belief goes
    uninformative, with no extra bookkeeping.
    """
    prior = 0.25
    tau = tau_for_horizon(sigma2_prior=prior, horizon=20.0)
    shaky = observe(Belief(0.0, prior), 1.0, obs_sigma2=0.25)
    solid = shaky
    for _ in range(5):
        solid = observe(solid, 1.0, obs_sigma2=0.25)
    assert ticks_until_uninformative(solid, tau, prior) > ticks_until_uninformative(
        shaky, tau, prior
    )


def test_zero_tau_never_forgets_and_says_so() -> None:
    """A tau of 0 is a permanent belief. It is allowed, and it must be LEGIBLE —
    the horizon reports infinity rather than a large finite number that reads as
    a policy someone chose.
    """
    b = Belief(mu=1.0, sigma2=0.01)
    assert ticks_until_uninformative(b, tau=0.0, sigma2_target=0.25) == math.inf


def test_staleness_costs_the_incumbent_its_grip() -> None:
    """Replaces the fixed `LATCH_MARGIN`, and pins the sign that was wrong once.

    Same two estimates throughout; only the incumbent's staleness varies. While
    the incumbent is fresh it holds the body against a challenger with a better
    estimate but a wider interval. Once the incumbent has gone unconfirmed long
    enough, the SAME challenger takes it. A constant margin cannot do this,
    because it does not know which case it is in.

    Ranking the incumbent optimistically instead reverses this test, which is
    the whole reason it exists.
    """
    challenger = Belief(mu=0.65, sigma2=0.25)
    incumbent = Belief(mu=0.6, sigma2=0.01)

    assert not outranks(challenger, incumbent), "fresh incumbent holds"
    stale = age(incumbent, tau=0.2, elapsed=20.0)
    assert stale.mu == incumbent.mu, "its estimate never changed — only its grip"
    assert outranks(challenger, stale), "unconfirmed incumbent loses the body"


def test_a_newcomer_cannot_take_the_body_on_one_lucky_frame() -> None:
    """The hysteresis half, with no margin constant anywhere. A brand-new
    component with a perfect first observation still carries the prior's width,
    so its conservative score sits below a modestly-established incumbent's.
    """
    prior_width = 0.25
    newcomer = observe(Belief(mu=0.0, sigma2=prior_width), 1.0, obs_sigma2=0.25)
    established = Belief(mu=0.8, sigma2=0.01)

    assert newcomer.mu > 0.0
    assert not outranks(newcomer, established)


def test_conservative_and_optimistic_bracket_the_mean() -> None:
    b = Belief(mu=0.4, sigma2=0.09)
    assert conservative(b) == pytest.approx(0.4 - CONSERVATIVE_K * 0.3)
    assert optimistic(b) == pytest.approx(0.4 + CONSERVATIVE_K * 0.3)
    assert conservative(b) < b.mu < optimistic(b)


def test_the_width_must_not_outvote_the_mean_between_unequally_seen_candidates() -> (
    None
):
    """THE DEFECT `CONSERVATIVE_K = 3.0` CAUSED, pinned as a property so the
    constant cannot drift back without this going red.

    These are the real numbers from `chase-decoy` at the frame the wrong
    candidate won the body election. The one with three times the agreement was
    observed less often, and under a 3-sigma key its extra width outvoted the
    mean: a 0.68 gap in `k*sigma` against a 0.65 gap in `mu`.

    Deliberately NOT written in terms of `CONSERVATIVE_K` — a test that derives
    from the constant cannot catch the constant being wrong, which is the whole
    failure being guarded here.
    """
    body = Belief(mu=0.941, sigma2=0.628)
    decoy = Belief(mu=0.295, sigma2=0.322)
    assert outranks(body, decoy), (
        f"the better-agreeing candidate lost on width alone: "
        f"body={conservative(body):+.3f} decoy={conservative(decoy):+.3f}"
    )


def test_decay_half_life_audits_the_constants_being_replaced() -> None:
    """What `0.9` and `0.75` were claiming without saying so. These two numbers
    are the reason the migration is a re-parameterisation and not a re-guess.
    """
    assert decay_half_life(0.9) == pytest.approx(6.5788, abs=1e-4)
    assert decay_half_life(0.75) == pytest.approx(2.4094, abs=1e-4)
    # Monotone: a slower decay remembers longer.
    assert decay_half_life(0.95) > decay_half_life(0.9) > decay_half_life(0.75)


@pytest.mark.parametrize(
    "call",
    [
        lambda: Belief(mu=float("nan"), sigma2=1.0),
        lambda: Belief(mu=0.0, sigma2=-1.0),
        lambda: age(Belief(0.0, 1.0), tau=-1.0, elapsed=1.0),
        lambda: age(Belief(0.0, 1.0), tau=1.0, elapsed=-1.0),
        lambda: observe(Belief(0.0, 1.0), 0.0, obs_sigma2=0.0),
        lambda: observe(Belief(0.0, 1.0), float("nan"), obs_sigma2=1.0),
        lambda: tau_for_horizon(sigma2_prior=0.0, horizon=1.0),
        lambda: tau_for_horizon(sigma2_prior=1.0, horizon=0.0),
        lambda: ticks_until_uninformative(
            Belief(0.0, 1.0), tau=-1.0, sigma2_target=1.0
        ),
        lambda: decay_half_life(1.0),
        lambda: decay_half_life(0.0),
    ],
)
def test_contract_violations_are_refused(call) -> None:
    """The refusals ARE the falsifiers. A silently-accepted negative variance or
    zero observation noise produces a belief that looks fine and reasons wrong.
    """
    with pytest.raises(ValueError):
        call()
