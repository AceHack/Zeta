"""The higher layer: choose which lower layer acts, by which one moves the world.

Aaron 2026-08-25, on what the layer system should be: *"think of a layer system
where a higher layer can reference multiple parallel lower layers — it's not
just linear but more like a graph, and different games have different input
layers that higher layers can optionally work with."*

This is the smallest honest version of that. Two lower layers exist —
`PixelAgent` (directional, `ACTION1..4`) and `ClickPolicy` (coordinate,
`ACTION6`) — they are PARALLEL rather than stacked, and the environment decides
which of them is even wired up by what it offers on the frame.

HOW THE HIGHER LAYER CHOOSES, and why it is not a config flag. The same rule as
every other decision in this package: **the connected layer is the one whose
actions change the world.** `PixelAgent` finds its body by acting and watching
what answers; this finds its input modality the same way. A layer that has been
acting and changing nothing loses to one that has been acting and changing
something, with a latch so a single quiet frame does not flip the modality.

That matters more than it looks. It means an environment does not have to
declare itself keyboard-or-click, and we do not have to classify the roster in
advance — which is fortunate, because `EnvironmentInfo` carries no action-space
field and the classification is not available (see `frames.py`).

WHAT IS DELIBERATELY ABSENT. There is no learned weighting across layers, no
belief about WHICH object or WHICH direction pays, and no memory across levels.
Those are the next layer up, and the honest state of this one is: it picks a
modality, and the modality picks an action. Calling it a graph would be
generous — it is two nodes and a chooser, which is what a two-node graph is.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from arcengine import GameAction

from zeta_arc.agent import ACTION_VECTORS, PixelAgent
from zeta_arc.click import ClickPolicy
from zeta_arc.dynamics import (
    Belief,
    age,
    conservative,
    observe,
    outranks,
    tau_for_horizon,
)
from zeta_arc.frames import grid_of, is_click, offered_actions
from zeta_arc.perception import Grid

#: A layer belief lives on [-1, 1] (the world moved / it did not), so a variance
#: of 1.0 spans the whole range: the honest prior before any layer has acted.
LAYER_PRIOR_SIGMA2 = 1.0

#: How much one frame's answer is worth. "The grid changed after this layer
#: acted" is a good signal and not a perfect one — a grid can change because
#: something else in the world moved — so one observation is worth about as much
#: as the prior rather than overwhelming it.
LAYER_OBS_SIGMA2 = 1.0

#: WHEN A LAYER BELIEF GOES BACK UP FOR GRABS, stated as a claim about the world
#: rather than as a rate. Roughly seven frames without exercising a layer and it
#: is fully contestable again — long enough to survive a quiet stretch, short
#: enough that a modality which stopped working loses the wheel well inside a
#: level's 800-action budget.
#:
#: SEVEN IS NOT A FRESH GUESS. `LAYER_DECAY = 0.9` was already asserting it and
#: could not say so: `decay_half_life(0.9) == 6.58` observations. Starting from
#: the horizon the old constant implied makes this a re-parameterisation whose
#: behaviour can be compared, rather than a re-tune whose result cannot.
LAYER_STALENESS_HORIZON = 6.58

#: Derived, never named directly — that is the whole point. Naming tau by eye
#: would be `LAYER_DECAY` wearing a Greek letter.
LAYER_TAU = tau_for_horizon(LAYER_PRIOR_SIGMA2, LAYER_STALENESS_HORIZON)

KEYBOARD = "keyboard"
CLICK = "click"


@dataclass
class LayeredAgent:
    """Routes each frame to whichever lower layer the world is answering."""

    pixel: PixelAgent = field(default_factory=PixelAgent)
    click: ClickPolicy = field(default_factory=ClickPolicy)
    beliefs: dict[str, Belief] = field(default_factory=dict)
    _held: str | None = None
    _last_layer: str | None = None
    _last_grid: Grid | None = None

    def _available_layers(self, offered: list[GameAction]) -> list[str]:
        """Which layers this frame can even use.

        The keyboard layer needs at least one DIRECTION, not merely any simple
        action: an environment offering only `ACTION5` gives `PixelAgent`
        nothing to steer with, and routing to it there would spend the whole
        budget issuing an action it has no model of.
        """
        layers: list[str] = []
        if any(a in ACTION_VECTORS for a in offered):
            layers.append(KEYBOARD)
        if any(is_click(a) for a in offered):
            layers.append(CLICK)
        return layers

    def _credit_last_layer(self, grid: Grid) -> None:
        """Did the world move after the previous layer acted?

        Unreadable on the first frame (nothing acted yet), so it is skipped
        rather than scored as a failure — the same rule the pixel agent applies
        to a component that did not move: silence is not evidence against.

        PREDICT THEN UPDATE, in that order, which is the Kalman cycle and not a
        stylistic choice. A frame passed, so EVERY layer is one frame staler —
        including the ones that did not act, which is the entire point: a layer
        loses its grip by going unexercised, not by being punished. Only then
        does the layer that actually acted get told what happened.
        """
        if self._last_layer is None or self._last_grid is None:
            return
        for name in self.beliefs:
            self.beliefs[name] = age(self.beliefs[name], LAYER_TAU, 1.0)
        changed = grid != self._last_grid
        prior = self.beliefs.get(
            self._last_layer, Belief(mu=0.0, sigma2=LAYER_PRIOR_SIGMA2)
        )
        self.beliefs[self._last_layer] = observe(
            prior, 1.0 if changed else -1.0, LAYER_OBS_SIGMA2
        )

    def _elect(self, candidates: list[str]) -> str:
        """Pick a layer: unexplored first, then argmax of the conservative score.

        UNEXPLORED FIRST is the load-bearing half. Without it the tie at zero
        resolves by list order every time, so the click layer is never tried on
        an environment that also offers a direction — and the agent would report
        a confident modality it never actually compared against anything.

        THE EXPLICIT MARGIN IS GONE, and what replaced it is narrower than it
        first looks. `LAYER_LATCH_MARGIN = 2.0` existed to stop the modality
        flipping on one quiet frame, and that property does survive its removal
        — `test_a_single_quiet_frame_does_not_flip_the_modality` was written
        afterwards precisely because nothing had been covering it, and it holds.

        But the anti-thrash comes from the KALMAN GAIN, not from the interval
        width: an established belief has small `sigma2`, so a contradicting
        frame barely moves `mu`. Measured, because the guess was wrong: ranking
        by plain `mu` instead of `mu - k*sigma` leaves all 49 tests in
        `test_hosted_lane.py` green, the new quiet-frame test included.

        SO CONSERVATIVE RANKING IS UNFALSIFIED AT THIS CALL SITE, and saying
        otherwise would be the vacuity this package keeps finding. There is a
        structural reason and it is worth writing down: with two layers and
        winner-acts routing, the layer that holds the wheel is the only one
        being observed, so the leader is always the fresh one and the two
        orderings cannot come apart.

        TWO CLAIMS THIS PARAGRAPH USED TO MAKE WERE LATER MEASURED AND ONE WAS
        FALSE. It predicted the width would earn its keep where many candidates
        go unobserved at once — the body election in `agent.py` — and that
        holds: the same mutation there fails
        `test_a_body_that_stops_moving_loses_the_election_to_one_that_is_moving`.
        It also said the width "costs nothing", and that was wrong. At
        `CONSERVATIVE_K = 3.0` the width term outvoted the mean between
        candidates observed at different rates and cost 0.07 of environment
        score on `chase-decoy`; k is 1.0 for that reason, with the measurement
        in `dynamics.py`. A width weight is never free — it competes with the
        quantity it is supposed to be qualifying.

        THAT CONSTANT IS GLOBAL AND ITS RATIONALE IS NOT, so the gap was checked
        rather than waved at: `k` was derived entirely from the body election,
        and this file uses the same constant. Replaying a click-responsive and a
        keyboard-responsive world at k=1 and k=3 gives BYTE-IDENTICAL layer
        routing in both — every ACTION6-or-not decision the same. The sequences
        diverge only in the directional actions, which are `PixelAgent`'s body
        election delegated through this one. So the layer site is insensitive to
        `k`, exactly as the paragraph above predicts it should be, and the
        constant needs no separate justification here.

        The tie-break is real either way: `outranks` is strict, so an exact tie
        keeps the incumbent.
        """
        untried = [name for name in candidates if name not in self.beliefs]
        if untried:
            return untried[0]
        best = max(candidates, key=lambda name: conservative(self.beliefs[name]))
        if (
            self._held in candidates
            and self._held != best
            and not outranks(self.beliefs[best], self.beliefs[self._held])
        ):
            return self._held
        return best

    def act(self, frame: Any) -> tuple[GameAction, dict[str, int]]:
        """One action for this frame, plus the data it carries.

        Returns the data dict rather than a bare action because a coordinate
        action without its coordinate is not an action — the engine would
        validate `{}` into `x=0, y=0` and click the corner forever, which is a
        silent wrong answer of exactly the shape this package keeps finding.
        """
        grid = grid_of(frame)
        offered = offered_actions(frame)
        self._credit_last_layer(grid)

        candidates = self._available_layers(offered)
        if not candidates:
            # Nothing we model is on offer. Take the lowest-id offered action so
            # the episode still advances and the frame after it can be read;
            # RESET (id 0) is excluded because re-resetting is not progress.
            fallback = next(
                (a for a in offered if a is not GameAction.RESET), GameAction.RESET
            )
            self._last_layer, self._last_grid = None, grid
            return fallback, {}

        layer = self._elect(candidates)
        self._held = layer
        self._last_layer, self._last_grid = layer, grid

        if layer == CLICK:
            x, y = self.click.choose(grid)
            return next(a for a in offered if is_click(a)), {"x": x, "y": y}
        return self.pixel.act(grid, frozenset(offered)), {}
