"""The seam: one place where Zeta touches the ARC engine.

This is the smallest honest version of the `IEnvironment` rung the design doc
(§7.2) calls for — advance-by-one-action over a game object, with the toolkit
behind it rather than in front of our agent. Everything above this file speaks
in actions and frames; only this file knows the engine's names, so a toolkit
change breaks one function instead of a codebase.

WHY NOT `Arcade.make()`. `arc_agi.Arcade` discovers environments by scanning
`environments_dir` for `metadata.json`, so its wrapper is for environments
published in that layout. For a Zeta-authored game we already hold the object.

THE ENGINE'S OWN LOOP IS PUBLIC, and we call it rather than reimplementing it.
`ARCBaseGame.perform_action(action_input)` says of itself: "DO NOT OVERRIDE
THIS METHOD, Your Game Logic should be in step()" — it drives `step()` until
the action completes, handles the level transition, and renders the frames.
An earlier version of this file rebuilt that loop by hand and deadlocked: a
level-clearing action sets `_next_level`, and `is_action_complete()` returns
`not self._next_level and self._action_complete`, so a hand-rolled loop that
only calls `step()` can never finish the action that WINS a level. Calling
their loop is both less code and the only correct version.

Measured against arc-agi / arcengine on 2026-08-24. Treat these names as facts
with an expiry date — the toolkit is pre-1.0.
"""

from __future__ import annotations

from arcengine import ActionInput, ARCBaseGame, FrameData, GameAction


def advance(game: ARCBaseGame, action_id: GameAction, **data: object) -> FrameData:
    """Apply one action and return the frame it produced.

    `perform_action` is declared `FrameData | FrameDataRaw` because it has a
    `raw: bool = False` switch. We never pass `raw`, so the `FrameData` branch
    is the only reachable one — asserted rather than cast, so that if the
    engine ever changes which branch the default takes, this fails loudly here
    instead of surfacing as an attribute error somewhere downstream.
    """
    frame = game.perform_action(ActionInput(id=action_id, data=dict(data)))
    assert isinstance(frame, FrameData), (
        f"engine returned {type(frame).__name__}, not FrameData"
    )
    return frame


def reset(game: ARCBaseGame) -> FrameData:
    """Reset through the engine's own RESET action."""
    return advance(game, GameAction.RESET)
