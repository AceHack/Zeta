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
from zeta_arc.frames import grid_of, is_click, offered_actions
from zeta_arc.perception import Grid

#: Same Schmitt-trigger idiom as `PixelAgent`'s body latch: a challenger must
#: beat the incumbent by a margin, so a modality does not flip on one frame
#: where nothing happened to move.
LAYER_LATCH_MARGIN = 2.0

#: Evidence leaks, so a layer that USED to work does not hold the wheel forever
#: after the environment changes what it responds to.
LAYER_DECAY = 0.9

KEYBOARD = "keyboard"
CLICK = "click"


@dataclass
class LayeredAgent:
    """Routes each frame to whichever lower layer the world is answering."""

    pixel: PixelAgent = field(default_factory=PixelAgent)
    click: ClickPolicy = field(default_factory=ClickPolicy)
    evidence: dict[str, float] = field(default_factory=dict)
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
        """
        if self._last_layer is None or self._last_grid is None:
            return
        changed = grid != self._last_grid
        prior = self.evidence.get(self._last_layer, 0.0)
        self.evidence[self._last_layer] = prior * LAYER_DECAY + (
            1.0 if changed else -1.0
        )

    def _elect(self, candidates: list[str]) -> str:
        """Pick a layer: unexplored first, then argmax with hysteresis.

        UNEXPLORED FIRST is the load-bearing half. Without it the tie at zero
        resolves by list order every time, so the click layer is never tried on
        an environment that also offers a direction — and the agent would report
        a confident modality it never actually compared against anything.
        """
        untried = [name for name in candidates if name not in self.evidence]
        if untried:
            return untried[0]
        best = max(candidates, key=lambda name: self.evidence.get(name, 0.0))
        if self._held in candidates and self._held != best:
            margin = self.evidence.get(best, 0.0) - self.evidence.get(self._held, 0.0)
            if margin < LAYER_LATCH_MARGIN:
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
